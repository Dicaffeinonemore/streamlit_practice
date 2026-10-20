"""Reproducible Vargul sheet import. Source files are data, never executable code.

The supplied manifest fixes row counts, frame counts and the discarded reference.
processing.json records inspected body measurements, FX boundaries and corrections.
The --inspect pass produces numbered source crops for choosing those measurements.
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import io
import json
import math
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

from boss_art_common import pack_pages

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'assets/vargul_src'
OUT = ROOT / 'assets/vargul'
QA = ROOT / 'artifacts/vargul-1.36/art'


def load_json(path):
    return json.loads(path.read_text(encoding='utf-8'))


def save_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def key_green(image):
    """Key green dominance only; preserve genuine cyan where blue supports green."""
    a = np.array(image.convert('RGBA')).astype(np.float32)
    r, g, b = a[:, :, 0], a[:, :, 1].copy(), a[:, :, 2]
    excess = g - np.maximum(r, b)
    matte = 1 - np.clip((excess - 18) / 72, 0, 1)
    a[:, :, 3] *= matte
    spill = excess > 0
    a[:, :, 1][spill] = np.minimum(g[spill], np.maximum(r, b)[spill])
    a[:, :, 3][a[:, :, 3] < 12] = 0
    a[a[:, :, 3] == 0] = 0
    return Image.fromarray(np.rint(a).astype(np.uint8))


def components(mask):
    """8-connected components via scanline union/find; no optional CV dependency."""
    parents, runs = [], []

    def find(i):
        while parents[i] != i:
            parents[i] = parents[parents[i]]
            i = parents[i]
        return i

    previous = []
    for y, row in enumerate(mask):
        edges = np.flatnonzero(np.diff(np.r_[False, row, False].astype(np.int8)))
        current = []
        j = 0
        for x0, x1 in zip(edges[::2], edges[1::2]):
            n = len(parents)
            parents.append(n)
            while j < len(previous) and previous[j][1] < x0:
                j += 1
            k = j
            while k < len(previous) and previous[k][0] <= x1:
                parent = find(previous[k][2])
                parents[find(n)] = parent
                k += 1
            current.append((int(x0), int(x1), n))
            runs.append((y, int(x0), int(x1), n))
        previous = current
    groups = {}
    for y, x0, x1, n in runs:
        p = find(n)
        if p not in groups:
            groups[p] = {'box': [x0, y, x1, y + 1], 'area': 0, 'runs': []}
        c = groups[p]
        c['area'] += x1 - x0
        c['box'] = [min(c['box'][0], x0), min(c['box'][1], y),
                    max(c['box'][2], x1), max(c['box'][3], y + 1)]
        c['runs'].append((y, x0, x1))
    return sorted(groups.values(), key=lambda c: c['area'], reverse=True)


def row_bounds(image, count):
    a = np.array(image.getchannel('A')) > 100
    density = a.sum(axis=1)
    h = image.height
    result = [0]
    for n in range(1, count):
        center = h * n / count
        radius = h / count * .18
        lo, hi = round(center - radius), round(center + radius)
        # Average a narrow band so a single empty scanline cannot split a hand.
        smooth = np.convolve(density, np.ones(7) / 7, mode='same')
        section = smooth[lo:hi]
        candidates = np.flatnonzero(section <= section.min() + 1)
        best = min(candidates, key=lambda p: abs(p + lo - center)) + lo
        result.append(int(best))
    return result + [h]


def paste_component_mask(size, selected, padding=2):
    mask = np.zeros((size[1], size[0]), dtype=np.uint8)
    for c in selected:
        for y, x0, x1 in c['runs']:
            mask[y, x0:x1] = 255
    image = Image.fromarray(mask)
    # Pillow's native MaxFilter(1) crashes on this Windows runtime.
    return image.filter(ImageFilter.MaxFilter(padding * 2 + 1)) if padding else image


def seeded_figures(band, seeds, boundaries, feet=None):
    """Multi-source geodesic watershed inside keyed foreground.

    Only original pixels are assigned. Torso scribbles and spear shafts fix
    ownership across overlapping coats. Detached border islands are discarded.
    """
    alpha = np.array(band.getchannel('A'))
    mask = alpha > 30
    height, width = mask.shape
    labels = np.zeros(mask.shape, dtype=np.uint8)
    queue = deque()
    for label, seed in enumerate(seeds, 1):
        cx, cy, spear = seed
        boxes = [(cx - 12, cy - 72, cx + 13, cy + 100)]
        if spear is not None:
            boxes.append((spear - 2, 30, spear + 3, 120))
        for fx, fy in (feet or [[] for _ in seeds])[label - 1]:
            boxes.append((fx - 4, fy - 6, fx + 5, fy + 2))
        for x0, y0, x1, y1 in boxes:
            for y in range(max(0, y0), min(height, y1)):
                for x in range(max(0, x0), min(width, x1)):
                    if mask[y, x] and labels[y, x] == 0:
                        labels[y, x] = label
                        queue.append((y, x))
    print('watershed seeded', width, height, len(queue), flush=True)
    while queue:
        y, x = queue.popleft()
        label = labels[y, x]
        for dy, dx in ((0, -1), (0, 1), (-1, 0), (1, 0), (-1, -1), (-1, 1), (1, -1), (1, 1)):
            yy, xx = y + dy, x + dx
            if 0 <= yy < height and 0 <= xx < width and mask[yy, xx] and labels[yy, xx] == 0:
                labels[yy, xx] = label
                queue.append((yy, xx))
    print('watershed foreground assigned', int((labels > 0).sum()), flush=True)
    result = []
    for i in range(len(seeds)):
        own = labels == i + 1
        groups = components(own)
        # Never retain tiny islands created where a neighbouring spear grazes
        # the cut. Actual disconnected large shaft / garment pieces are kept.
        selected = [c for c in groups if c['area'] >= 45]
        matte = paste_component_mask(band.size, selected, 0)
        # Recover only antialias pixels immediately adjacent to an owned core.
        edge = np.array(matte.filter(ImageFilter.MaxFilter(3))) > 0
        edge &= (labels == 0) | own
        keyed = band.copy()
        keyed.putalpha(Image.fromarray(np.where(edge, alpha, 0).astype(np.uint8)))
        box = keyed.getbbox()
        if not box:
            raise ValueError(('watershed empty', i))
        result.append((keyed.crop(box), list(box)))
    return result


def split_actor(entry, config):
    image = key_green(Image.open(SRC / entry['file']))
    counts = config.get('observed_rows', entry['rows'])
    cuts_y = config.get('rows_y') or row_bounds(image, len(counts))
    frames, audit = [], []
    ordinal = 0
    for row, count in enumerate(counts):
        y0, y1 = config['row_regions_y'][row] if config.get('row_regions_y') else cuts_y[row:row + 2]
        band = image.crop((0, y0, image.width, y1))
        groups = components(np.array(band.getchannel('A')) > 95)
        major = [c for c in groups if c['area'] > max(180, band.width * band.height * .002)]
        major.sort(key=lambda c: c['box'][0])
        seeded = None
        if str(row + 1) in config.get('seeded_rows', {}):
            spec = config['seeded_rows'][str(row + 1)]
            seeded = seeded_figures(band, spec['seeds'], spec['boundaries'], spec.get('feet'))
        use_components = len(major) == count and entry['split'] != 'uniform'
        if config.get('force_grid'):
            use_components = False
        row_audit = {'row': row + 1, 'expected': count, 'major_components': len(major),
                     'method': 'seeded_geodesic' if seeded else 'components' if use_components else 'uniform', 'y': [y0, y1]}
        for col in range(count):
            ordinal += 1
            if seeded:
                tile, box = seeded[col]
                source_box = [box[0], y0 + box[1], box[2], y0 + box[3]]
            elif use_components:
                core = major[col]
                box = core['box']
                # Keep disconnected decorations belonging to this figure, bounded
                # by the midpoints to adjacent large connected silhouettes.
                left = 0 if col == 0 else (major[col - 1]['box'][2] + box[0]) // 2
                right = band.width if col == count - 1 else (box[2] + major[col + 1]['box'][0]) // 2
                core_near = np.array(paste_component_mask(band.size, [core], 5)) > 0
                selected = [core]
                for c in groups:
                    if c is core or c['area'] < 8:
                        continue
                    if c['box'][1] > core['box'][3] - 8:
                        continue  # next row's isolated spear point below this foot
                    if not left <= (c['box'][0] + c['box'][2]) / 2 < right:
                        continue
                    if any(core_near[y, x0:x1].any() for y, x0, x1 in c['runs']):
                        selected.append(c)
                matte = paste_component_mask(band.size, selected)
                isolated = band.copy()
                isolated.putalpha(ImageChops.multiply(band.getchannel('A'), matte))
                bbox = isolated.getbbox()
                x0, by0, x1, by1 = bbox
                tile = isolated.crop(bbox)
                source_box = [x0, y0 + by0, x1, y0 + by1]
            else:
                custom = config.get('row_cuts_x', {}).get(str(row + 1))
                bounds = custom or [round(image.width * i / count) for i in range(count + 1)]
                x0, x1 = bounds[col:col + 2]
                raw = band.crop((x0, 0, x1, band.height))
                gs = components(np.array(raw.getchannel('A')) > 95)
                if not gs:
                    raise ValueError((entry['id'], ordinal, 'empty frame'))
                # A grid cell can contain clipped tips from the next figure.
                # Keep its dominant figure and non-border disconnected decoration.
                largest = gs[0]['area']
                selected = [c for c in gs if c is gs[0] or
                            c['area'] >= 12 and c['area'] > largest * .0015 and
                            c['box'][0] > 1 and c['box'][2] < raw.width - 1]
                if entry['id'] == 'death' and ordinal <= 8:
                    selected = [c for c in selected if c is gs[0] or not
                                (c['box'][1] > raw.height * .8 and c['area'] < largest * .08)]
                if entry['id'] == 'death':
                    selected = [c for c in selected if not
                                (c['box'][1] < raw.height * .12 and
                                 c['box'][3] - c['box'][1] < raw.height * .12)]
                isolated = raw.copy()
                isolated.putalpha(ImageChops.multiply(raw.getchannel('A'), paste_component_mask(raw.size, selected)))
                bbox = isolated.getbbox()
                bx0, by0, bx1, by1 = bbox
                tile = isolated.crop(bbox)
                source_box = [x0 + bx0, y0 + by0, x0 + bx1, y0 + by1]
            removals = config.get('erase_source_rects', {}).get(str(ordinal), [])
            if removals:
                a = np.array(tile)
                for ax0, ay0, ax1, ay1 in removals:
                    a[max(0, ay0-source_box[1]):max(0, ay1-source_box[1]),
                      max(0, ax0-source_box[0]):max(0, ax1-source_box[0])] = 0
                tile = Image.fromarray(a)
            polygon = config.get('keep_source_polygons', {}).get(str(ordinal))
            if polygon:
                matte = Image.new('L', tile.size)
                ImageDraw.Draw(matte).polygon([(x-source_box[0], y-source_box[1]) for x, y in polygon], fill=255)
                tile.putalpha(ImageChops.multiply(tile.getchannel('A'), matte))
            frames.append({'image': tile, 'source_box': source_box, 'source_index': ordinal,
                           'foreign_fragment_removals': removals,
                           'source_row': row + 1, 'source_col': col + 1})
        audit.append(row_audit)
    if entry['reference_first']:
        reference = frames.pop(0)
    else:
        reference = None
    for i, f in enumerate(frames, 1):
        f['drawing'] = i
    return frames, audit, reference


def font(size=14):
    path = Path('C:/Windows/Fonts/consola.ttf')
    return ImageFont.truetype(str(path), size) if path.exists() else ImageFont.load_default()


def contact_sheet(frames, path, title, scale=1, columns=4, cell=None, pivots=False):
    tiles = [f['image'] for f in frames]
    mw = max(math.ceil(im.width * scale) for im in tiles)
    mh = max(math.ceil(im.height * scale) for im in tiles)
    cw, ch = cell or (max(mw + 24, 140), max(mh + 52, 180))
    rows = math.ceil(len(frames) / columns)
    canvas = Image.new('RGB', (cw * columns, ch * rows + 38), '#212632')
    draw = ImageDraw.Draw(canvas)
    draw.text((12, 8), title, font=font(17), fill='#e4f4ff')
    for i, f in enumerate(frames):
        im = f['image'].copy()
        im.thumbnail((cw - 18, ch - 46))
        if scale != 1:
            im = f['image'].resize((round(f['image'].width * scale), round(f['image'].height * scale)), Image.Resampling.NEAREST)
        x = i % columns * cw + (cw - im.width) // 2
        baseline = 38 + i // columns * ch + ch - 36
        y = baseline - im.height
        draw.rectangle((i % columns * cw, 38 + i // columns * ch,
                        (i % columns + 1) * cw - 1, 38 + (i // columns + 1) * ch - 1), outline='#414b5d')
        canvas.paste(im, (x, y), im if im.mode == 'RGBA' else None)
        label = f"d{f.get('drawing', i + 1):02}  src{f.get('source_index', i + 1):02}  {f['image'].width}x{f['image'].height}"
        draw.text((i % columns * cw + 8, baseline + 9), label, font=font(13), fill='#c3d7e8')
        if pivots and f.get('pivot'):
            px, py = f['pivot']
            fac = im.height / f['image'].height
            ax, ay = x + px * fac, y + py * fac
            draw.line((ax - 6, ay, ax + 6, ay), fill='#ffc56b', width=1)
            draw.line((ax, ay - 6, ax, ay + 3), fill='#ffc56b', width=1)
    path.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(path)


def inspect():
    manifest = load_json(SRC / 'manifest.json')
    config = load_json(SRC / 'processing.json') if (SRC / 'processing.json').exists() else {}
    QA.mkdir(parents=True, exist_ok=True)
    summary = {}
    for entry in manifest['entries']:
        if entry['role'] != 'motion':
            continue
        frames, audit, reference = split_actor(entry, config.get('motions', {}).get(entry['id'], {}))
        for f in frames:
            p = QA / 'source-crops' / entry['id'] / f"{f['drawing']:02}.png"
            p.parent.mkdir(parents=True, exist_ok=True)
            f['image'].save(p)
        contact_sheet(frames, QA / 'source-review' / (entry['id'] + '.jpg'), entry['id'] + ' | source crops',
                      columns=4, cell=(440, 510))
        summary[entry['id']] = {'rows': audit, 'frames': [{k: v for k, v in f.items() if k != 'image'} | {'size': list(f['image'].size)} for f in frames]}
        print(entry['id'], len(frames), [(r['major_components'], r['method']) for r in audit], flush=True)
    save_json(QA / 'source-splits.json', summary)


def foot_pivot(image, fallen=False):
    a = np.array(image)
    opaque = a[:, :, 3] > 110
    if fallen:
        ys, xs = np.where(opaque)
        ground = int(np.quantile(ys, .995)) + 1
        return [float(np.median(xs)), float(ground)]
    # Boots are dark. This rejects the luminous lower point of an upright spear.
    dark = opaque & (a[:, :, :3].max(axis=2) < 145)
    ys, xs = np.where(dark)
    if not len(ys):
        return [image.width / 2, float(image.height)]
    ground = int(np.quantile(ys, .998)) + 1
    low = dark.copy()
    # Use both supporting boots for x; choosing only the lowest boot makes the
    # idle animation jump sideways when the other foot is a few pixels higher.
    low[:max(0, ground - max(7, round(image.height * .18)))] = False
    yy, xx = np.where(low)
    return [float(np.median(xx)), float(ground)]


def actor_extent(image):
    """Measure the body, excluding sparse spear tips and cyan weapon/glow pixels."""
    a = np.array(image).astype(np.int16)
    r, g, b, alpha = [a[:, :, i] for i in range(4)]
    body = (alpha >= 110) & ~((b > r * 1.18) & (g > r * 1.12) & (b > 110))
    ys, xs = np.where(body)
    if not len(ys):
        raise ValueError('Actor has no measurable body')
    # Percentiles discard isolated weapon fragments without including FX bounds.
    return [float(np.quantile(xs, .99) - np.quantile(xs, .01) + 1),
            float(np.quantile(ys, .995) - np.quantile(ys, .005) + 1)]


def actor_scale(image, target_height, actor_id, drawing, config):
    width, height = actor_extent(image)
    # A fallen body keeps its length; do not stretch its short vertical silhouette
    # to standing height. Pose-specific height preserves crouching during a dash.
    fallen = ('knockdown' in actor_id and 5 <= drawing <= 12) or (actor_id == 'death' and drawing >= 9)
    pose_height = config.get('pose_heights', {}).get(str(drawing), 1)
    extent = max(width, height) if fallen else height
    return target_height * pose_height / extent, extent, pose_height


def tattoo_mask(image, actor_id, drawing, body_height, config):
    """Conservative cyan-line mask inside inspected skin regions, not the weapon.

    ROI per frame is exported with the mask for visual audit. A mask is derived
    from source pixels, never from a hue shift of the complete character.
    """
    a = np.array(image)
    h, w = a.shape[:2]
    output = np.zeros_like(a)
    if actor_id == 'death' and drawing >= 9:
        return Image.fromarray(output), None
    if actor_id == 'awaken' and drawing < 6:
        return Image.fromarray(output), None
    defaults = {'p2_idle': [.50, .25], 'p2_walk': [.46, .25], 'p2_combo': [.45, .28],
                'p2_dash': [.51, .30], 'p2_cast': [.52, .43], 'p2_cast_b': [.50, .43],
                'p2_sweep': [.50, .28], 'ultimate': [.47, .32], 'p2_hurt': [.53, .38],
                'p2_knockdown': [.51, .34], 'death': [.45, .29], 'awaken': [.54, .30]}
    custom = config.get('tattoo_centers', {}).get(str(drawing))
    cx, cy = custom if custom else defaults.get(actor_id, [.5, .3])
    cx, cy = cx * w, cy * h
    # Chest and abdomen: small deliberately excludes ice shoulder armour / blade.
    rx, ry = body_height * .108, body_height * .16
    poly = [(cx - rx * .7, cy - ry), (cx + rx * .6, cy - ry),
            (cx + rx, cy - ry * .2), (cx + rx * .55, cy + ry),
            (cx - rx * .7, cy + ry * .85), (cx - rx, cy - ry * .2)]
    roi = Image.new('L', image.size)
    ImageDraw.Draw(roi).polygon(poly, fill=255)
    r, g, b, alpha = [a[:, :, i].astype(np.float32) for i in range(4)]
    candidates = (b > 150) & (g > 95) & (b - r > 36) & (g - r > 17) & (g < b * 1.08) & (alpha > 80)
    selected = candidates & (np.array(roi) > 0)
    strength = np.clip(np.minimum(b - r - 26, (g - r - 12) * 1.6) * 3, 0, 255)
    output[:, :, :3] = [116, 207, 255]
    output[:, :, 3] = np.where(selected, np.minimum(alpha, strength), 0).astype(np.uint8)
    output[output[:, :, 3] == 0] = 0
    return Image.fromarray(output), [[round(x, 2), round(y, 2)] for x, y in poly]


def make_strip(frames, path, meta_path, extra):
    left = math.ceil(max(f['pivot'][0] for f in frames)) + 2
    up = math.ceil(max(f['pivot'][1] for f in frames)) + 2
    right = math.ceil(max(f['image'].width - f['pivot'][0] for f in frames)) + 2
    below = math.ceil(max(f['image'].height - f['pivot'][1] for f in frames)) + 2
    cell = [left + right, up + below]
    strip = Image.new('RGBA', (cell[0] * len(frames), cell[1]))
    for i, f in enumerate(frames):
        x, y = round(i * cell[0] + left - f['pivot'][0]), round(up - f['pivot'][1])
        strip.paste(f['image'], (x, y))
    path.parent.mkdir(parents=True, exist_ok=True)
    strip.save(path, 'WEBP', lossless=True, method=6, exact=True)
    data = {'file': str(path.relative_to(OUT)).replace('\\', '/'), 'cell': cell,
            'pivot': [left, up], 'frames': len(frames), **extra,
            'frame_data': [{k: v for k, v in f.items() if k != 'image'} for f in frames]}
    save_json(meta_path, data)
    return data


def fx_rows(config, profile):
    result = {}
    maxw, maxh = profile['fx_max_size']
    for sheet, rows in config['fx'].items():
        source = Image.open(SRC / f'fx/fx_sheet_{sheet}.png').convert('RGB')
        for row in rows:
            fs = []
            y0, y1 = row['y']
            for i, (x0, x1) in enumerate(zip(row['x'], row['x'][1:])):
                image = source.crop((x0, y0, x1, y1))
                scale = min(1, maxw / image.width, maxh / image.height)
                image = image.resize((max(1, round(image.width * scale)), max(1, round(image.height * scale))), Image.Resampling.LANCZOS)
                rgb = np.array(image).astype(np.float32)
                # Original RGB against black is already premultiplied radiance.
                # Alpha variant is unpremultiplied, preserving the same light.
                alpha = rgb.max(axis=2)
                alpha[alpha < 3] = 0
                unpremult = np.clip(rgb * 255 / np.maximum(alpha[:, :, None], 1), 0, 255)
                add = np.dstack((rgb, np.full(alpha.shape, 255))).astype(np.uint8)
                over = np.dstack((unpremult, alpha)).astype(np.uint8)
                over[alpha == 0] = 0
                pivot = [(row['centers'][i] - x0) * scale, row['pivot_y'] * scale]
                fs.append({'image': Image.fromarray(add), 'alpha_image': Image.fromarray(over),
                           'pivot': pivot, 'drawing': i + 1, 'source_index': i + 1,
                           'source_box': [x0, y0, x1, y1], 'source_scale': scale})
            result[row['id']] = (fs, row | {'sheet': sheet})
    return result


def encode_pages(groups, quality):
    clips, sheets, sizes = {}, [], []
    for category, sequences in groups:
        tiles = []
        offset = len(sheets)
        for key, frames in sequences.items():
            clips[key] = []
            for drawing in frames:
                tile = drawing['image']
                f = {'atlas': [0, 0, tile.width, tile.height], 'anchor': drawing['pivot']}
                clips[key].append(f)
                tiles.append((f, tile))
        pages = pack_pages(tiles)
        for f, _ in tiles:
            f['sheet'] += offset
        for page in pages:
            stream = io.BytesIO()
            if category == 'tattoos':
                page.save(stream, 'PNG', optimize=True)
                ext = 'png'
            elif category == 'actors':
                # Binary pixel-art alpha avoids spending most of the bundle on
                # subpixel chroma-key fringe. RGB remains full-colour: a global
                # RGBA palette flattened the cyan tattoos in the review pass.
                a = np.array(page)
                a[:, :, 3] = np.where(a[:, :, 3] >= 96, 255, 0)
                a[a[:, :, 3] == 0] = 0
                page = Image.fromarray(a)
                page.save(stream, 'WEBP', lossless=True, method=6, exact=True)
                ext = 'webp'
            else:
                page.save(stream, 'WEBP', quality=quality, method=6, exact=True)
                ext = 'webp'
            raw = stream.getvalue()
            decoded = Image.open(io.BytesIO(raw)).convert('RGBA')
            if decoded.getchannel('A').tobytes() != page.convert('RGBA').getchannel('A').tobytes():
                raise ValueError((category, 'encoded alpha mismatch'))
            name = f'atlas-{len(sheets)}.{ext}'
            sheets.append((name, raw))
            sizes.append({'file': name, 'category': category, 'bytes': len(raw), 'size': list(page.size)})
    return clips, sheets, sizes


def build():
    manifest = load_json(SRC / 'manifest.json')
    config = load_json(SRC / 'processing.json')
    profile = config['build']
    actor_frames, masks, motions, splits = {}, {}, {}, {}
    scale_records = []
    ratio = 1  # One body size across both phases, including the awakening bridge.
    world_scale = profile['world_p1_body_height'] / profile['stored_p1_body_height']
    for entry in manifest['entries']:
        if entry['role'] != 'motion':
            continue
        id = entry['id']
        conf = config['motions'][id]
        fs, audit, reference = split_actor(entry, conf)
        if len(fs) != entry['frames']:
            raise ValueError((id, len(fs), entry['frames']))
        body = conf['body_reference']
        p2 = id.startswith('p2_') or id in ('ultimate', 'death')
        target_height = profile['stored_p1_body_height'] * (ratio if p2 else 1)
        k = target_height / body['height']
        rec = {'id': id, 'reference': body, 'raw_to_stored': k,
               'raw_to_world': k * world_scale, 'reference_body_world': target_height * world_scale,
               'phase': 2 if p2 else 'bridge' if id == 'awaken' else 1}
        scale_records.append(rec)
        rendered, tattoo_frames = [], []
        for f in fs:
            raw = f['image']
            k, extent, pose_height = actor_scale(raw, target_height, id, f['drawing'], conf)
            fallen = ('knockdown' in id and f['drawing'] < 12) or id == 'death'
            pivot = foot_pivot(raw, fallen)
            image = raw.resize((max(1, round(raw.width * k)), max(1, round(raw.height * k))), Image.Resampling.NEAREST)
            arr = np.array(image)
            arr[arr[:, :, 3] < 9] = 0
            image = Image.fromarray(arr)
            item = {key: value for key, value in f.items() if key != 'image'}
            item.update(image=image, pivot=[round(v * k, 3) for v in pivot],
                        raw_size=list(raw.size), raw_pivot=pivot, source_scale=k,
                        body_extent=extent, pose_height=pose_height)
            rendered.append(item)
            if p2 or id == 'awaken':
                mask, roi = tattoo_mask(raw, id, f['drawing'], body['height'], conf)
                mask = mask.resize(image.size, Image.Resampling.NEAREST)
                ma = np.array(mask)
                ma[:, :, 3] = (np.round(ma[:, :, 3].astype(float) / 255 * 7) * 255 / 7).astype(np.uint8)
                ma[:, :, :3] = [116, 207, 255]
                ma[ma[:, :, 3] == 0] = 0
                mask = Image.fromarray(ma)
                tattoo_frames.append(item | {'image': mask, 'skin_roi': roi})
        actor_frames[id] = rendered
        if tattoo_frames:
            masks['mask_' + id] = tattoo_frames
        motions[id] = make_strip(rendered, OUT / 'motion' / (id + '.webp'), OUT / 'motion' / (id + '.json'),
                                 {'loop': 'idle' in id or 'walk' in id, 'scale': world_scale,
                                  'body_scale': rec, 'reference_discarded': entry['reference_first'],
                                  'timing': 'defined independently by runtime; drawing number only'})
        if tattoo_frames:
            make_strip(tattoo_frames, OUT / 'masks' / (id + '.webp'), OUT / 'masks' / (id + '.json'),
                       {'blend': 'lighter', 'source_motion': id, 'scale': world_scale})
        contact_sheet(rendered, QA / 'motion' / (id + '.png'),
                      f'{id} | {len(rendered)} drawings | feet + | x{world_scale:.5f} world',
                      scale=2, columns=4, pivots=True)
        splits[id] = {'rows': audit, 'reference_discarded': entry['reference_first'],
                      'frames': [{key: value for key, value in f.items() if key != 'image'} for f in rendered]}
        print('motion', id, len(fs), 'body world', round(rec['reference_body_world'], 3), flush=True)
    fx = fx_rows(config, profile)
    add_clips, alpha_clips, effect_meta = {}, {}, {}
    for id, (fs, row) in fx.items():
        add = [{key: value for key, value in f.items() if key != 'alpha_image'} for f in fs]
        alpha = [{key: value for key, value in f.items() if key not in ('image', 'alpha_image')} | {'image': f['alpha_image']} for f in fs]
        add_clips['fx_' + id + '_add'] = add
        alpha_clips['fx_' + id + '_alpha'] = alpha
        for variant, frames in [('add', add), ('alpha', alpha)]:
            effect_meta[id + '_' + variant] = make_strip(frames, OUT / 'fx' / f'{id}_{variant}.webp', OUT / 'fx' / f'{id}_{variant}.json',
                                                         {'blend': 'lighter' if variant == 'add' else 'source-over',
                                                          'source_sheet': row['sheet'], 'source_row': row['row'],
                                                          'floor_scale_y': row['floor_scale_y']})
        contact_sheet(alpha, QA / 'fx' / f"{row['sheet']}{row['row']}-{id}.png",
                      f"FX {row['sheet']} row {row['row']} | {id} | {len(fs)} cells", columns=4, scale=1.5)
    clips, sheets, sizes = encode_pages([('actors', actor_frames), ('fx_add', add_clips),
                                        ('tattoos', masks)], profile['webp_quality'])
    # Both finished variants are exported as strips. The standalone bundle
    # stores one premultiplied RGB FX atlas: alpha=max(R,G,B), RGB'=RGB/alpha.
    # The runtime can cache that reversible alpha conversion once per sheet.
    # Never draw this alias with source-over without performing the conversion.
    for key in alpha_clips:
        source_key = key.removesuffix('_alpha') + '_add'
        clips[key] = [f | {'alphaFromMaxRGB': True} for f in clips[source_key]]
    source_hashes = {e['file']: e['sha256'] for e in manifest['entries']}
    metadata = {'version': '1.36', 'units': manifest['units'], 'clips': clips, 'motions': {id: {k: v for k, v in m.items() if k != 'frame_data'} for id, m in motions.items()},
                'effects': {id: {k: v for k, v in m.items() if k != 'frame_data'} for id, m in effect_meta.items()},
                'scale': world_scale, 'idleHeight': profile['stored_p1_body_height'],
                'worldHeight': profile['world_p1_body_height'], 'phaseHeightRatio': ratio,
                'transition': config['awaken_bridge'], 'tattooMaskPrefix': 'mask_',
                'tattooPulseTicks': 90, 'sources': source_hashes,
                'fxAlphaStorage': {'mode': 'derive-once-from-add-atlas', 'alpha': 'max(R,G,B)',
                                   'rgb': 'alpha ? RGB*255/alpha : 0',
                                   'exportedAlphaStrips': True},
                'actorColorEncoding': 'lossless WebP', 'actorResampling': 'nearest',
                'actorSizing': 'per-frame body extent; fixed phase size', 'actorAlphaThreshold': 96,
                'drawingRoles': {'p1_spear_combo': {'referenceSkipped': True, 'thirdHit': [7, 8], 'thirdWindupHold': 7, 'kind': 'deep_thrust'},
                                 'p2_cast': {'startup': [1, 8], 'concentration': [9, 12], 'recovery': [13, 19], 'crossMarkDrawing': 8}},
                'fxAliases': {'awaken_burst': 'frost_burst', 'awaken_shards': 'ice_shard', 'awaken_floor_ring': 'cross_eruption'},
                'runtimeConnected': False}
    bundle = metadata | {'sheets': ['data:image/' + name.split('.')[-1] + ';base64,' + base64.b64encode(raw).decode('ascii') for name, raw in sheets]}
    js = ('const VARGUL_ART = ' + json.dumps(bundle, ensure_ascii=False, separators=(',', ':')) + ';\n').encode('utf-8')
    if len(js) > 5_000_000:
        raise ValueError(('Lossless actor bundle exceeds 5 MB budget', len(js)))
    for name, raw in sheets:
        (OUT / name).write_bytes(raw)
    (ROOT / 'vargul-art.js').write_bytes(js)
    save_json(OUT / 'frames.json', metadata)
    save_json(OUT / 'processing-audit.json', splits)
    summary = {'version': '1.36', 'art_bytes': len(js), 'aurelion_art_bytes': (ROOT / 'aurelion-art.js').stat().st_size,
               'webp_quality': profile['webp_quality'], 'stored_p1_body_height': profile['stored_p1_body_height'],
               'scale': world_scale, 'phase_ratio': ratio, 'motions': len(actor_frames),
               'motion_frames': sum(map(len, actor_frames.values())), 'effect_rows': len(fx),
               'effect_frames_per_variant': sum(len(fs) for fs, row in fx.values()), 'mask_frames': sum(map(len, masks.values())),
               'scales': scale_records, 'sheets': sizes, 'runtime_connected': False}
    save_json(OUT / 'build-report.json', summary)
    save_json(QA / 'build-report.json', summary)
    decoded_sheets = [Image.open(io.BytesIO(raw)).convert('RGBA') for _, raw in sheets]
    for id, fs in actor_frames.items():
        for f, atlas_frame in zip(fs, clips[id]):
            x, y, w, h = atlas_frame['atlas']
            f['image'] = decoded_sheets[atlas_frame['sheet']].crop((x, y, x+w, y+h))
        contact_sheet(fs, QA / 'motion' / (id + '.png'),
                      f'{id} | {len(fs)} drawings | final decoded atlas | feet +',
                      scale=2, columns=4, pivots=True)
    create_comparisons(actor_frames, masks, config, world_scale)
    print(json.dumps({k: v for k, v in summary.items() if k not in ('scales', 'sheets')}, ensure_ascii=False), flush=True)
    return summary


def create_comparisons(actors, masks, config, scale):
    # The live renderer uses BAREL_PLAYER_SCALE=.72; all three share one world
    # scale here. The source sheet scale is not the camera zoom.
    text = (ROOT / 'barel-art.js').read_text(encoding='utf-8')
    data = json.loads(text[text.index('=') + 1:].strip().rstrip(';'))
    atlas = Image.open(io.BytesIO(base64.b64decode(data['atlas'].split(',')[1]))).convert('RGBA')
    f = data['clips']['idle'][0]
    x, y, w, h = f['atlas']
    barel = atlas.crop((x, y, x + w, y + h))
    canvas = Image.new('RGB', (1240, 650), '#1b2130')
    d = ImageDraw.Draw(canvas)
    baseline = 540
    d.line((20, baseline, 1220, baseline), fill='#9ab6ca', width=2)
    ratio = 1
    entries = [(barel, f['anchor'], .72, 'BAREL | 102.24 world px'),
               (actors['p1_idle'][0]['image'], actors['p1_idle'][0]['pivot'], scale, 'VARGUL P1 | 127.80 world px'),
               (actors['p2_idle'][0]['image'], actors['p2_idle'][0]['pivot'], scale,
                f'VARGUL P2 | {127.8 * ratio:.2f} world px')]
    for i, (image, pivot, k, label) in enumerate(entries):
        k *= 3
        image = image.resize((round(image.width * k), round(image.height * k)), Image.Resampling.NEAREST)
        cx = 170 + i * 420
        canvas.paste(image, (round(cx - pivot[0] * k), round(baseline - pivot[1] * k)), image)
        d.text((i * 410 + 16, 570), label, font=font(17), fill='#e2f1fc')
    d.text((22, 18), 'Same world scale x3 | spears excluded from body-height measurements', font=font(18), fill='#a1daf8')
    d.text((22, 46), 'P2 / P1 = 1; fixed body size across phases', font=font(17), fill='#c5dfeb')
    canvas.save(QA / 'barel-p1-p2-comparison.png')
    samples = []
    for id in ['p2_idle', 'p2_combo', 'p2_cast', 'p2_sweep', 'p2_hurt', 'ultimate']:
        actor = actors[id][0]
        mask = masks['mask_' + id][0]
        samples.extend([actor, mask | {'drawing': actor['drawing']}])
    contact_sheet(samples, QA / 'tattoo-mask-review.png', 'Actor / isolated cyan tattoo mask | no whole-body tint',
                  scale=3, columns=4)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--inspect', action='store_true')
    args = parser.parse_args()
    if args.inspect:
        inspect()
    else:
        build()


if __name__ == '__main__':
    main()
