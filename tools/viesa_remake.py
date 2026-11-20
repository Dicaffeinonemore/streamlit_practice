"""Viesa remake sheets (assets_src/viesa/Viesa_Remake): 384px grid, transparent PNG.

Each sheet is row-major on a 384x384 grid. Parts of a pose (a staff tip, a slash
arc) may cross a cell edge, so pixels are grouped into connected components and
each component belongs to the cell holding most of its pixels.

Every frame of a sheet shares one cell-relative pivot: the head column of a
standing reference pose and the median ground line. The art's own movement inside
a cell (a lunge, a flip) is therefore preserved instead of being re-centred.
"""
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage

CELL = 384
SRC = Path(__file__).resolve().parents[1] / 'assets_src/viesa/Viesa_Remake'
# sheet file prefix -> (frame count, standing reference frame for the pivot)
SHEETS = {
    1: (16, 0),   # walk
    2: (16, 15),  # melee combo 4/6/6 (frame 1's pale slash arc reads as skin)
    3: (16, 0),   # idle
    4: (10, 9),   # dash
    5: (10, 9),   # backflip
    6: (16, 0),   # death
    7: (10, 0),   # rapid fire, kneeling
    8: (15, 0),   # jump
    9: (10, 4),   # jump shot
    10: (16, 15), # knockdown / get up
    11: (10, 0),  # run loop
    12: (12, 11), # charge shot (hold on frame 7)
    13: (10, 0),  # hurt
    14: (6, 0),   # basic shot (J)
}
# Every jump-shot pose is airborne; use the jump sheet's ground line.
GROUND = {9: 319.0}
# clip -> (sheet, first frame, frame count)
CLIPS = {
    'idle': (3, 0, 16), 'walk': (1, 0, 16), 'run': (11, 0, 10), 'dash': (4, 0, 10),
    'slash1': (2, 0, 4), 'slash2': (2, 4, 6), 'kick': (2, 10, 6),
    'jump': (8, 0, 15), 'jump_shot': (9, 0, 10),
    'snipe_draw': (12, 0, 7), 'snipe_release': (12, 7, 5),
    'rapid_start': (7, 0, 4), 'rapid_loop': (7, 4, 4), 'rapid_end': (7, 8, 2),
    'backflip': (5, 0, 10),
    'shot': (14, 0, 6),
    'hurt': (13, 0, 10), 'knockdown': (10, 1, 7), 'getup': (10, 8, 8), 'death': (6, 0, 16),
}
REPLACED = set(CLIPS) | {'dash_slash'}


def split_cells(sheet, count):
    """Return count RGBA frames (full cell size, cell-relative) and their cell origins."""
    rgba = np.array(sheet.convert('RGBA'))
    h, w = rgba.shape[:2]
    cols = w // CELL
    labels, n = ndimage.label(rgba[:, :, 3] > 0, structure=np.ones((3, 3), bool))
    cell_index = (np.arange(h)[:, None] // CELL) * cols + (np.arange(w)[None, :] // CELL)
    owner = np.zeros(n + 1, dtype=np.int32)
    if n:
        flat = labels.ravel()
        pairs = np.stack([flat[flat > 0], cell_index.ravel()[flat > 0]], 1)
        keys, counts = np.unique(pairs, axis=0, return_counts=True)
        best = {}
        for (label, cell), c in zip(keys.tolist(), counts.tolist()):
            if c > best.get(label, (-1, 0))[1]: best[label] = (cell, c)
        for label, (cell, _) in best.items(): owner[label] = cell
    frames = []
    for index in range(count):
        cy, cx = divmod(index, cols)
        x0, y0 = cx * CELL - CELL // 2, cy * CELL - CELL // 2
        # A one-cell margin keeps crossing components; only owned pixels survive.
        ax, ay = max(0, x0), max(0, y0)
        bx, by = min(w, cx * CELL + CELL + CELL // 2), min(h, cy * CELL + CELL + CELL // 2)
        crop = rgba[ay:by, ax:bx].copy()
        mask = (labels[ay:by, ax:bx] > 0) & (owner[labels[ay:by, ax:bx]] == index)
        crop[~mask] = 0
        frames.append((Image.fromarray(crop), (ax - cx * CELL, ay - cy * CELL)))
    return frames


def drop_detached_right(tile, gap=10):
    """Remove a loose arrow drawn ahead of the bow; the game spawns its own."""
    a = np.array(tile)
    labels, n = ndimage.label(a[:, :, 3] > 0, structure=np.ones((3, 3), bool))
    if n < 2: return tile
    sizes = ndimage.sum(np.ones_like(labels), labels, range(1, n + 1))
    main = int(np.argmax(sizes)) + 1
    right = np.where(labels == main)[1].max()
    for label in range(1, n + 1):
        xs = np.where(labels == label)[1]
        if label != main and xs.min() > right + gap: a[labels == label] = 0
    return Image.fromarray(a)


def bow_tip(tile, pivot_x, ground_y, box):
    a = np.array(tile)[:, :, 3] > 96
    h = a.shape[0]
    band = a[int(h * .2):max(int(h * .7), 1)]
    yy, xx = np.where(band)
    if not len(xx): return [tile.width * .88 - (pivot_x - box[0]), ground_y - box[1] - h * .43]
    tx = xx.max(); ty = np.median(yy[xx >= tx - 3]) + int(h * .2)
    return [tx + box[0] - pivot_x, ground_y - (ty + box[1])]


def build(body_measure, stored_body, report):
    """Return {clip: [(frame, tile)]} scaled so idle stands stored_body px tall."""
    sheets = {}
    for number, (count, ref) in SHEETS.items():
        path = next(SRC.glob(f'{number:02d}_*.png'))
        frames = split_cells(Image.open(path), count)
        if number == 12:
            tile, origin = frames[10]
            frames[10] = (drop_detached_right(tile), origin)
        if number == 14:
            # The release pose draws its own flying arrow; the game spawns one.
            frames = [(drop_detached_right(tile), origin) for tile, origin in frames]
        cells = []
        for tile, (ox, oy) in frames:
            box = tile.getbbox()
            if box is None: raise ValueError(f'{path.name}: empty frame')
            cells.append({'tile': tile.crop(box), 'box': (box[0] + ox, box[1] + oy, box[2] + ox, box[3] + oy)})
        bottoms = sorted(c['box'][3] for c in cells)
        ground = GROUND.get(number, float(np.median(bottoms[len(bottoms) // 2:])))
        m = body_measure(cells[ref], wide_stance=True)
        pivot = cells[ref]['box'][0] + m['bodyX']
        sheets[number] = {'cells': cells, 'ground': ground, 'pivot': pivot, 'path': path, 'measure': m}
    idle = sheets[3]
    scale = stored_body / idle['measure']['height']
    report['remake'] = {'source': str(SRC.name), 'cell': CELL, 'sourceToAtlas': scale,
                        'idleHeight': idle['measure']['height'],
                        'sheets': {s['path'].name: {'ground': s['ground'], 'pivotX': s['pivot']} for s in sheets.values()}}
    out = {}
    for name, (number, first, count) in CLIPS.items():
        s = sheets[number]; out[name] = []
        for i in range(first, first + count):
            c = s['cells'][i]; box = c['box']
            tip = bow_tip(c['tile'], s['pivot'], s['ground'], box)
            tile = c['tile'].resize((max(1, round(c['tile'].width * scale)), max(1, round(c['tile'].height * scale))), Image.Resampling.LANCZOS)
            frame = {'atlas': [0, 0, tile.width, tile.height],
                     'anchor': [round((s['pivot'] - box[0]) * scale, 3), round((s['ground'] - box[1]) * scale, 3)],
                     'source': [box[0], box[1], box[2] - box[0], box[3] - box[1]], 'sourceSheet': f'remake-{number:02d}',
                     'drawing': i + 1, 'tip': [round(tip[0] * scale, 3), round(tip[1] * scale, 3)]}
            if name == 'death':
                # Every collapse pose rests on the floor once z reaches 0.
                shift = tile.height - frame['anchor'][1]
                frame['anchor'][1] = tile.height
                frame['tip'][1] = round(frame['tip'][1] + shift, 3)
            out[name].append((frame, tile))
    # After the release the bow tip detector finds the upper limb; keep the
    # arrow line of the full-draw pose for the follow-through frames.
    for frame, _ in out['shot'][4:]:
        frame['tip'] = list(out['shot'][3][0]['tip'])
    return out, [s['path'] for s in sheets.values()], (idle['cells'][0]['tile'], idle['measure'])
