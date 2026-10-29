"""Black Moon Sovereign sheet import (v1.38). Source files are data, never code.

Reuses the Vargul keying / component split / atlas packing helpers.
Body sheets: green key -> split -> per-sheet scale -> foot pivot.
Gauntlet sheets: same split; one world length for every fist drawing.
Effect sheets: black background, stored as additive RGB like Vargul FX.
07_Retro_8bit is never read.
"""
from __future__ import annotations

import base64
import io
import json
from pathlib import Path

import numpy as np
from PIL import Image

from boss_art_common import pack_pages
from build_vargul_art import components, key_green, row_bounds

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'assets/sovereign_src'
OUT = ROOT / 'assets/sovereign'
PPW = 1.5            # atlas pixels per world pixel (actors); 1:1 on screen at the 1.5x world zoom
BODY_WORLD = 138.0   # Barel 102.24 x 1.35, helm top to sole on P1 idle drawing 1
ACTOR_QUALITY = 84
FX_QUALITY = 78
FX_MAX = 240         # longest side of a stored effect drawing (atlas px)

# id, file, cells per row, scale rule, pivot rule
BODY = [
    ('intro', '02_Phase1_Body_16f/Intro.png', [4, 4, 4, 4], 'height', 'feet'),
    ('idle', '02_Phase1_Body_16f/Idle.png', [4, 4, 4, 4], 'height', 'feet'),
    ('walk', '02_Phase1_Body_16f/Walk.png', [4, 4, 4, 4], 'height', 'feet'),
    ('command', '02_Phase1_Body_16f/Command.png', [4, 4, 4, 4], 'height', 'feet'),
    ('beam', '02_Phase1_Body_16f/Helm_Beam_BodyOnly.png', [4, 4, 4, 4], 'height', 'feet'),
    ('hurt', '02_Phase1_Body_16f/Hurt.png', [5, 5, 4, 4], 'height', 'feet'),
    ('kneel', '02_Phase1_Body_16f/Kneel.png', [4, 4, 4, 4], 'height', 'center'),
    ('awaken', '03_Transformation/Phase1_to_Phase2_16f.png', [4, 4, 4, 4], 'p2last', 'feet'),
    ('idle_p2', '04_Phase2_Body_16f/Idle_Berserk.png', [4, 4, 4, 4], 'foot', 'feet'),
    ('walk_p2', '04_Phase2_Body_16f/Walk.png', [4, 4, 4, 4], 'p2', 'feet'),
    ('command_p2', '04_Phase2_Body_16f/Command.png', [4, 4, 4, 4], 'p2', 'feet'),
    ('beam_p2', '04_Phase2_Body_16f/Beam_BodyOnly.png', [4, 4, 4, 4], 'p2', 'feet'),
    ('hurt_p2', '04_Phase2_Body_16f/Hurt.png', [4, 4, 4, 4], 'p2', 'feet'),
    ('kneel_p2', '04_Phase2_Body_16f/Kneel.png', [4, 4, 4, 4], 'p2', 'center'),
    ('death', '04_Phase2_Body_16f/Death.png', [4, 4, 4, 4], 'p2', 'center'),
]
# Phase-2 drawings that receive the pulsing magenta mask.
MASKED = {'awaken', 'idle_p2', 'walk_p2', 'command_p2', 'beam_p2', 'hurt_p2', 'kneel_p2', 'death'}

FISTS = [
    ('fist_p1', '05_Gauntlets/Phase1_Parts_12.png', [4, 4, 4], 'center'),
    ('fist_p2', '05_Gauntlets/Phase2_Parts_12.png', [4, 4, 4], 'center'),
    ('fallen_p2', '05_Gauntlets/Fallen_4.png', [4], 'bottom'),
]
# sheet, 1-based source row, id, expected drawings
FX = [
    ('06_Effects/E1_Fist_Effects.png', 5, [(1, 'punch_trail', 8), (2, 'fist_impact', 8), (3, 'ground_wave', 10),
                                          (4, 'slam_mark', 10), (5, 'fist_shatter', 10)]),
    ('06_Effects/Beam_Effects_Latest.png', 8, [(4, 'mark_alt', 11), (6, 'helm_beam', 10), (7, 'eruption', 10),
                                              (8, 'reform', 10)]),
]
FX_PIVOT = {'punch_trail': 'center', 'fist_impact': 'center', 'ground_wave': 'bottom', 'slam_mark': 'center',
            'fist_shatter': 'center', 'mark_alt': 'center', 'helm_beam': 'left', 'eruption': 'bottom', 'reform': 'center'}


def save_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def mask_image(size, groups):
    m = np.zeros((size[1], size[0]), dtype=bool)
    for c in groups:
        for y, x0, x1 in c['runs']:
            m[y, x0:x1] = True
    return m


def column_cuts(band, count):
    """Valley search near uniform column boundaries (row_bounds, transposed)."""
    rotated = band.transpose(Image.Transpose.ROTATE_90)  # columns become rows (reversed)
    cuts = row_bounds(rotated, count)
    w = band.width
    return sorted(w - c for c in cuts)


def split_sheet(image, rows):
    """Split a keyed sheet into drawings. Returns tiles and per-row method."""
    cuts_y = row_bounds(image, len(rows))
    tiles, audit = [], []
    for r, count in enumerate(rows):
        y0, y1 = cuts_y[r], cuts_y[r + 1]
        band = image.crop((0, y0, image.width, y1))
        alpha = np.array(band.getchannel('A'))
        groups = components(alpha > 95)
        largest = groups[0]['area'] if groups else 0
        major = sorted([g for g in groups if g['area'] > largest * .25], key=lambda g: g['box'][0])
        method = 'components' if len(major) == count else 'grid'
        if method == 'components':
            owners = [[g] for g in major]
            for g in groups:
                if g in major or g['area'] < 30:
                    continue
                cx = (g['box'][0] + g['box'][2]) / 2
                i = min(range(count), key=lambda k: abs(cx - (major[k]['box'][0] + major[k]['box'][2]) / 2))
                b = major[i]['box']
                if b[0] - 40 <= cx <= b[2] + 40:
                    owners[i].append(g)
            for sel in owners:
                keep = mask_image(band.size, sel)
                a = np.array(band)
                a[..., 3] = np.where(keep, a[..., 3], 0)
                im = Image.fromarray(a)
                box = im.getbbox()
                tiles.append((im.crop(box), [box[0], y0 + box[1], box[2], y0 + box[3]]))
        else:
            xs = column_cuts(band, count)
            for c in range(count):
                x0, x1 = xs[c], xs[c + 1]
                cell = band.crop((x0, 0, x1, band.height))
                gs = components(np.array(cell.getchannel('A')) > 95)
                big = gs[0]['area']
                # Dominant drawing plus its detached pieces; drop slivers entering
                # from the neighbouring cell across the left / right border.
                sel = [g for g in gs if g is gs[0] or g['area'] >= 30 and g['area'] > big * .002 and
                       g['box'][0] > 1 and g['box'][2] < cell.width - 1]
                keep = mask_image(cell.size, sel)
                a = np.array(cell)
                a[..., 3] = np.where(keep, a[..., 3], 0)
                im = Image.fromarray(a)
                box = im.getbbox()
                tiles.append((im.crop(box), [x0 + box[0], y0 + box[1], x0 + box[2], y0 + box[3]]))
        audit.append({'row': r + 1, 'cells': count, 'separate_figures': len(major), 'method': method})
    return tiles, audit


def rgb_alpha(image):
    a = np.array(image).astype(np.int16)
    return a[..., 0], a[..., 1], a[..., 2], a[..., 3]


def cape_mask(image):
    r, g, b, alpha = rgb_alpha(image)
    return (alpha > 110) & (r > g * 1.6) & (r > 70) & (r > b * 1.05)


def glow_mask(image):
    """Bright magenta light (#ff498d family): excludes the darker crimson cape."""
    r, g, b, alpha = rgb_alpha(image)
    return (alpha > 80) & (r > 190) & (b > r * .42) & (g > 35) & (g < r * .72) & (r - g > 90)


def helm_height(image):
    """Helm top (crown spikes excluded) to sole, source pixels."""
    a = np.array(image.getchannel('A')) > 110
    ys = np.flatnonzero(a.any(axis=1))
    bottom = ys[-1] + 1
    est = bottom - ys[0]
    need = max(8, round(est * .065))
    for y in ys:
        row = np.r_[False, a[y], False].astype(np.int8)
        edges = np.flatnonzero(np.diff(row))
        if len(edges) and (edges[1::2] - edges[::2]).max() >= need:
            return float(bottom - y)
    return float(est)


def foot_length(image):
    """Longest armour run in the lowest band: the front sabaton, source pixels."""
    a = np.array(image.getchannel('A')) > 110
    armour = a & ~cape_mask(image)
    ys = np.flatnonzero(armour.any(axis=1))
    if not len(ys):
        return 0.0
    bottom = ys[-1]
    band = armour[max(0, bottom - max(3, round(image.height * .025))):bottom + 1]
    best = 0
    for row in band:
        e = np.flatnonzero(np.diff(np.r_[False, row, False].astype(np.int8)))
        if len(e):
            best = max(best, int((e[1::2] - e[::2]).max()))
    return float(best)


def body_pivot(image, rule):
    a = np.array(image.getchannel('A')) > 110
    armour = a & ~cape_mask(image)
    ys, xs = np.where(armour if armour.any() else a)
    ground = float(np.quantile(ys, .998)) + 1
    if rule == 'center':
        return [float(np.median(xs)), ground]
    low = ys >= ground - max(7, image.height * .12)
    return [float(np.median(xs[low])), ground]


def resize(image, k):
    out = image.resize((max(1, round(image.width * k)), max(1, round(image.height * k))), Image.Resampling.LANCZOS)
    a = np.array(out)
    a[a[..., 3] < 9] = 0
    return Image.fromarray(a)


def mask_tile(image):
    """Additive pulse mask: glow pixels only, cropped to its own box."""
    m = glow_mask(image)
    r, g, b, alpha = rgb_alpha(image)
    out = np.zeros(m.shape + (4,), dtype=np.uint8)
    out[..., 0], out[..., 1], out[..., 2] = 255, 92, 170
    out[..., 3] = np.where(m, np.clip(alpha, 0, 255), 0)
    out[out[..., 3] == 0] = 0
    im = Image.fromarray(out)
    return im, im.getbbox()


def dim_core(image):
    """Phase-1 fallen fist: wrist core light switched off (colour replacement)."""
    a = np.array(image).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    hot = (a[..., 3] > 0) & (r > 120) & (b > 60) & (r - g > 60) & (g < r * .75)
    for ch, k in ((0, .22), (1, .2), (2, .28)):
        a[..., ch] = np.where(hot, a[..., ch] * k + 10, a[..., ch])
    return Image.fromarray(np.rint(a).astype(np.uint8))


def frame(tile, pivot, k):
    image = resize(tile, k)
    return {'image': image, 'anchor': [pivot[0] * k, pivot[1] * k]}


def build_body():
    clips, masks, scales, audits = {}, {}, {}, {}
    raw = {}
    for id, file, rows, rule, pivot_rule in BODY:
        tiles, audit = split_sheet(key_green(Image.open(SRC / file)), rows)
        raw[id] = tiles
        audits[id] = audit
    idle1 = raw['idle'][0][0]
    k_idle = BODY_WORLD * PPW / helm_height(idle1)
    foot_world = foot_length(idle1) * k_idle
    feet_p2 = [foot_length(t) for t, _ in raw['idle_p2']]
    p2_height = helm_height(raw['idle_p2'][0][0]) * foot_world / float(np.median([f for f in feet_p2 if f > 0]))
    for id, file, rows, rule, pivot_rule in BODY:
        tiles = raw[id]
        if rule == 'height':
            k = BODY_WORLD * PPW / helm_height(tiles[0][0])
            basis = {'rule': 'helm-to-sole of drawing 1 = 138 world'}
        elif rule in ('p2', 'p2last'):
            # Every P2 sheet opens in the same berserk stance as idle_p2 drawing 1
            # (awaken ends in it): match that drawing so poses do not pop.
            ref = tiles[-1 if rule == 'p2last' else 0][0]
            k = p2_height / helm_height(ref)
            basis = {'rule': ('last' if rule == 'p2last' else 'first') + ' drawing height = idle_p2 drawing 1'}
        else:
            feet = [foot_length(t) for t, _ in tiles]
            median = float(np.median([f for f in feet if f > 0]))
            k = foot_world / median
            basis = {'rule': 'median sabaton length = P1 idle', 'foot_source_px': round(median, 1)}
        scales[id] = {'atlas_per_source': round(k, 4), **basis,
                      'drawing1_world_height': round(helm_height(tiles[0][0]) * k / PPW, 1)}
        clips[id] = []
        for tile, box in tiles:
            f = frame(tile, body_pivot(tile, pivot_rule), k)
            clips[id].append(f)
            if id in MASKED:
                m, mbox = mask_tile(tile)
                if mbox:
                    mm = resize(m.crop(mbox), k)
                    ax, ay = f['anchor']
                    masks.setdefault('mask_' + id, []).append({'image': mm, 'anchor': [ax - mbox[0] * k, ay - mbox[1] * k]})
                else:
                    masks.setdefault('mask_' + id, []).append(None)
        print('body', id, len(tiles), [a['method'] for a in audits[id]], scales[id], flush=True)
    return clips, masks, scales, audits


def master_fist_ratio():
    image = key_green(Image.open(SRC / '01_Master/Phase1_Body_With_Fists.png'))
    groups = components(np.array(image.getchannel('A')) > 110)
    body, fists = groups[0], sorted(groups[1:3], key=lambda g: g['box'][0])
    a = np.array(image)
    a[..., 3] = np.where(mask_image(image.size, [body]), a[..., 3], 0)
    body_h = helm_height(Image.fromarray(a).crop(body['box']))
    fist_h = float(np.mean([g['box'][3] - g['box'][1] for g in fists]))
    return fist_h / body_h, body_h, fist_h


def core_offset(tile, anchor):
    m = glow_mask(tile)
    if not m.any():
        return None
    ys, xs = np.where(m)
    return [float(xs.mean()) - anchor[0], float(ys.mean()) - anchor[1]]


def build_fists():
    ratio, body_h, fist_h = master_fist_ratio()
    fist_len = BODY_WORLD * ratio            # world length of the gauntlet's long axis
    clips, audits, scales = {}, {}, {}
    for id, file, rows, pivot_rule in FISTS:
        tiles, audit = split_sheet(key_green(Image.open(SRC / file)), rows)
        audits[id] = audit
        ref = tiles[0][0]
        target = fist_len
        k = target * PPW / max(ref.width, ref.height)
        scales[id] = round(k, 4)
        clips[id] = []
        for tile, box in tiles:
            pivot = [tile.width / 2, tile.height / 2] if pivot_rule == 'center' else [tile.width / 2, float(tile.height)]
            f = frame(tile, pivot, k)
            c = core_offset(tile, pivot)
            if c:
                f['core'] = [c[0] * k, c[1] * k]
            clips[id].append(f)
        print('fist', id, len(tiles), [a['method'] for a in audit], k, flush=True)
    # Phase-1 has no fallen drawing: side fist and the two cracked stages, core dimmed.
    clips['fallen_p1'] = [dict(f, image=dim_core(f['image'])) for f in (clips['fist_p1'][0], clips['fist_p1'][5], clips['fist_p1'][6])]
    side = clips['fist_p1'][0]['image']
    meta = {'masterRatio': round(ratio, 4), 'masterBodyPx': body_h, 'masterFistPx': fist_h,
            'fistLength': round(fist_len, 2), 'fistHeight': round(fist_len * side.height / side.width, 2)}
    return clips, audits, scales, meta


def fx_bands(lum, expected):
    rows = lum.max(axis=1) > 28
    runs, y = [], 0
    while y < len(rows):
        if rows[y]:
            s = y
            while y < len(rows) and rows[y]:
                y += 1
            runs.append([s, y])
        else:
            y += 1
    runs = [r for r in runs if r[1] - r[0] > 6]
    while len(runs) > expected:      # merge the closest pair
        gaps = [runs[i + 1][0] - runs[i][1] for i in range(len(runs) - 1)]
        i = int(np.argmin(gaps))
        runs[i:i + 2] = [[runs[i][0], runs[i + 1][1]]]
    if len(runs) < expected:
        # Glow tails join neighbouring rows: cut at the darkest line near each
        # uniform boundary instead.
        density = np.convolve((lum > 40).sum(axis=1).astype(float), np.ones(9) / 9, mode='same')
        h, cuts = len(density), [0]
        for n in range(1, expected):
            c, r = h * n / expected, h / expected * .3
            lo, hi = round(c - r), round(c + r)
            cuts.append(lo + int(np.argmin(density[lo:hi])))
        cuts.append(h)
        runs = [[cuts[i], cuts[i + 1]] for i in range(expected)]
    return runs


def fx_columns(lum, expected):
    cols = lum.max(axis=0) > 24
    runs, x = [], 0
    while x < len(cols):
        if cols[x]:
            s = x
            while x < len(cols) and cols[x]:
                x += 1
            runs.append([s, x])
        else:
            x += 1
    runs = [r for r in runs if r[1] - r[0] > 3]
    found = len(runs)
    # Faint smoke can leave a narrow gap inside one drawing: merge closest gaps.
    while len(runs) > expected:
        gaps = [runs[i + 1][0] - runs[i][1] for i in range(len(runs) - 1)]
        i = int(np.argmin(gaps))
        runs[i:i + 2] = [[runs[i][0], runs[i + 1][1]]]
    if len(runs) < expected:
        # Touching drawings (beam, ground wave): uniform cells over the content.
        lo, hi = runs[0][0], runs[-1][1]
        edges = [round(lo + (hi - lo) * i / expected) for i in range(expected + 1)]
        runs = [[edges[i], edges[i + 1]] for i in range(expected)]
        return runs, found, 'uniform'
    return runs, found, 'gaps'


def build_fx():
    clips, audit = {}, []
    for file, band_count, rows in FX:
        rgb = np.array(Image.open(SRC / file).convert('RGB'))
        lum = rgb.max(axis=2)
        bands = fx_bands(lum, band_count)
        for row, id, expected in rows:
            y0, y1 = bands[row - 1]
            y0, y1 = max(0, y0 - 2), min(rgb.shape[0], y1 + 2)
            cols, found, method = fx_columns(lum[y0:y1], expected)
            frames = []
            cap = FX_MAX * (2 if id == 'helm_beam' else 1)
            for x0, x1 in cols:
                x0, x1 = max(0, x0 - 2), min(rgb.shape[1], x1 + 2)
                im = Image.fromarray(rgb[y0:y1, x0:x1])
                k = min(1, cap / im.width, cap / im.height)
                im = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.Resampling.LANCZOS)
                a = np.dstack((np.array(im), np.full((im.height, im.width), 255, np.uint8)))
                rule = FX_PIVOT[id]
                anchor = [im.width / 2, im.height / 2] if rule == 'center' else [im.width / 2, float(im.height)] if rule == 'bottom' else [0.0, im.height / 2]
                frames.append({'image': Image.fromarray(a), 'anchor': anchor})
            clips['fx_' + id] = frames
            audit.append({'sheet': file, 'row': row, 'id': id, 'expected': expected, 'separated': found,
                          'used': len(frames), 'method': method})
            print('fx', id, 'expected', expected, 'separated', found, method, flush=True)
    return clips, audit


def encode(groups):
    clips, sheets = {}, []
    for category, sequences in groups:
        tiles, offset = [], len(sheets)
        for key, frames in sequences.items():
            clips[key] = []
            for f in frames:
                if f is None:
                    clips[key].append(None)
                    continue
                im = f['image']
                entry = {'atlas': [0, 0, im.width, im.height], 'anchor': [round(v, 2) for v in f['anchor']]}
                if 'core' in f:
                    entry['core'] = [round(v, 2) for v in f['core']]
                clips[key].append(entry)
                tiles.append((entry, im))
        for page in pack_pages(tiles):
            stream = io.BytesIO()
            if category == 'fx':
                page.convert('RGB').save(stream, 'WEBP', quality=FX_QUALITY, method=6)
            else:
                page.save(stream, 'WEBP', quality=ACTOR_QUALITY, method=6, exact=True)
            sheets.append(stream.getvalue())
        for entry, _ in tiles:
            entry['sheet'] += offset
    return clips, sheets


def main():
    body, masks, body_scales, body_audit = build_body()
    fists, fist_audit, fist_scales, fist_meta = build_fists()
    fx, fx_audit = build_fx()
    clips, sheets = encode([('actors', {**body, **fists}), ('masks', masks), ('fx', fx)])
    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob('atlas-*.webp'):
        old.unlink()
    for i, raw in enumerate(sheets):
        (OUT / f'atlas-{i}.webp').write_bytes(raw)
    meta = {'version': '1.38', 'ppw': PPW, 'bodyHeight': BODY_WORLD, **fist_meta, 'clips': clips,
            'maskPrefix': 'mask_', 'maskPulseTicks': 90}
    bundle = meta | {'sheets': ['data:image/webp;base64,' + base64.b64encode(raw).decode('ascii') for raw in sheets]}
    js = 'const SOVEREIGN_ART = ' + json.dumps(bundle, ensure_ascii=False, separators=(',', ':')) + ';\n'
    (ROOT / 'sovereign-art.js').write_text(js, encoding='utf-8')
    save_json(OUT / 'frames.json', meta | {'split': {'body': body_audit, 'fists': fist_audit, 'fx': fx_audit},
                                           'scales': {'body': body_scales, 'fists': fist_scales}})
    print(json.dumps({'bytes': len(js), 'sheets': len(sheets), **fist_meta}, ensure_ascii=False))


if __name__ == '__main__':
    main()
