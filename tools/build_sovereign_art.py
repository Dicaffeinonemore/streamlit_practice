"""Black Moon Sovereign (boss5, v1.38) sheet import. Reuses the Vargul splitter.

Source: assets/sovereign_src (07_Retro_8bit is never read).
Output: sovereign-art.js (SOVEREIGN_ART) + assets/sovereign/build-report.json.
All atlas frames are stored at HD atlas px per world px; anchors are world px.
"""
from __future__ import annotations

import base64
import io
import json
from pathlib import Path

import numpy as np
from PIL import Image

import build_vargul_art as V
from boss_art_common import pack_pages

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'assets/sovereign_src'
OUT = ROOT / 'assets/sovereign'
V.SRC = SRC
HD = 1.5
BODY_WORLD = 102.24 * 1.35          # helmet top → sole, crown spikes excluded
CROWN = .06                         # crown spikes share of a standing frame (measured on idle d1)
ACTOR_Q, FX_Q = 86, 80

BODY = [  # id, file, rows, scale rule
    ('intro', '02_Phase1_Body_16f/Intro.png', [4, 4, 4, 4], 'stand'),
    ('idle', '02_Phase1_Body_16f/Idle.png', [4, 4, 4, 4], 'stand'),
    ('walk', '02_Phase1_Body_16f/Walk.png', [4, 4, 4, 4], 'stand'),
    ('command', '02_Phase1_Body_16f/Command.png', [4, 4, 4, 4], 'stand'),
    ('beam', '02_Phase1_Body_16f/Helm_Beam_BodyOnly.png', [4, 4, 4, 4], 'stand'),
    ('hurt', '02_Phase1_Body_16f/Hurt.png', [5, 5, 4, 4], 'stand'),
    ('kneel', '02_Phase1_Body_16f/Kneel.png', [4, 4, 4, 4], 'stand'),
    ('awaken', '03_Transformation/Phase1_to_Phase2_16f.png', [4, 4, 4, 4], 'kneel_match'),
    ('idle_p2', '04_Phase2_Body_16f/Idle_Berserk.png', [4, 4, 4, 4], 'sabaton'),
    ('walk_p2', '04_Phase2_Body_16f/Walk.png', [4, 4, 4, 4], 'sabaton'),
    ('command_p2', '04_Phase2_Body_16f/Command.png', [4, 4, 4, 4], 'sabaton'),
    ('beam_p2', '04_Phase2_Body_16f/Beam_BodyOnly.png', [4, 4, 4, 4], 'sabaton'),
    ('hurt_p2', '04_Phase2_Body_16f/Hurt.png', [4, 4, 4, 4], 'sabaton'),
    ('kneel_p2', '04_Phase2_Body_16f/Kneel.png', [4, 4, 4, 4], 'sabaton'),
    ('ultimate', '04_Phase2_Body_16f/Ultimate.png', [4, 4, 4, 4], 'sabaton'),
    ('death', '04_Phase2_Body_16f/Death.png', [4, 4, 4, 4], 'sabaton'),
]
FALLEN_POSE = {'kneel', 'kneel_p2', 'death'}   # pivot: ground under body centre
GLOW_MASKED = {'awaken', 'idle_p2', 'walk_p2', 'command_p2', 'beam_p2', 'hurt_p2', 'kneel_p2', 'ultimate'}
FX = [  # name, sheet, row (1-based)
    ('punch_trail', 'E1_Fist_Effects.png', 1), ('fist_impact', 'E1_Fist_Effects.png', 2),
    ('ground_wave', 'E1_Fist_Effects.png', 3), ('slam_mark', 'E1_Fist_Effects.png', 4),
    ('fist_shatter', 'E1_Fist_Effects.png', 5), ('mark_alt', 'Beam_Effects_Latest.png', 4),
    ('helm_beam', 'Beam_Effects_Latest.png', 6), ('eruption', 'Beam_Effects_Latest.png', 7),
    ('reform', 'Beam_Effects_Latest.png', 8),
]
ROW_COUNT = {'E1_Fist_Effects.png': 5, 'Beam_Effects_Latest.png': 8}
FX_EXPECTED = {'helm_beam': 8, 'punch_trail': 8, 'fist_impact': 8, 'ground_wave': 10, 'slam_mark': 10, 'fist_shatter': 10}


def split(file, rows):
    frames, audit, _ = V.split_actor({'file': file, 'rows': rows, 'split': 'components', 'id': file,
                                      'reference_first': False}, {})
    return frames, audit


def sabaton(image):
    """Longest opaque run in the lowest 6% of the dark-armour silhouette (one boot)."""
    a = np.array(image).astype(int)
    op = a[:, :, 3] > 110
    dark = op & (a[:, :, :3].max(2) < 150)
    ys = np.where(dark)[0]
    ground = int(np.quantile(ys, .998)) + 1
    best = 0
    for y in range(max(0, ground - int(image.height * .06)), ground):
        edges = np.flatnonzero(np.diff(np.r_[False, op[y], False].astype(int)))
        if len(edges):
            best = max(best, int((edges[1::2] - edges[::2]).max()))
    return best


def glow_mask(image):
    a = np.array(image).astype(np.int16)
    r, g, b, al = (a[:, :, i] for i in range(4))
    sel = (r > 205) & (b > 95) & (g < 150) & (r - g > 90) & (al > 60)
    out = np.zeros(a.shape, np.uint8)
    out[:, :, :3] = [255, 106, 168]
    out[:, :, 3] = np.where(sel, al, 0)
    out[out[:, :, 3] == 0] = 0
    return Image.fromarray(out)


def dim_core(image):
    """Phase-1 fallen fist: wrist core magenta → unlit grey (Fallen_4 is phase-2 art only)."""
    a = np.array(image).astype(np.int16)
    r, g, b = a[:, :, 0], a[:, :, 1], a[:, :, 2]
    sel = (r > 140) & (b > 70) & (r - g > 70) & (a[:, :, 3] > 0)
    lum = (r * .3 + g * .3 + b * .4) * .32
    for i in range(3):
        a[:, :, i] = np.where(sel, lum + 22, a[:, :, i])
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


def resize(image, k):
    out = image.resize((max(1, round(image.width * k * HD)), max(1, round(image.height * k * HD))), Image.Resampling.LANCZOS)
    arr = np.array(out)
    arr[arr[:, :, 3] < 9] = 0
    return Image.fromarray(arr)


def fx_cells(sheet, row, expected=None):
    src = Image.open(SRC / '06_Effects' / sheet).convert('RGB')
    a = np.array(src).astype(np.int16).max(2)
    lit = a > 34
    # Rows touch through smoke; cut at the density minimum near each even boundary.
    count = ROW_COUNT[sheet]
    density = np.convolve((a > 50).sum(1), np.ones(9) / 9, mode='same')
    cuts = [0]
    for n in range(1, count):
        centre, radius = src.height * n / count, src.height / count * .35
        lo, hi = round(centre - radius), round(centre + radius)
        cuts.append(int(lo + np.argmin(density[lo:hi])))
    cuts.append(src.height)
    y0, y1 = cuts[row - 1], cuts[row]
    cols = lit[y0:y1].sum(0) > 0
    # Columns: runs separated by ≥6 dark columns; tiny runs join neighbours.
    runs, x = [], 0
    while x < len(cols):
        if cols[x]:
            x0 = x
            gap = 0
            while x < len(cols) and gap < 6:
                gap = 0 if cols[x] else gap + 1
                x += 1
            runs.append([x0, x - gap])
        else:
            x += 1
    runs = [r for r in runs if r[1] - r[0] > 8]
    if expected and len(runs) < expected:
        # Connected strip (cells touching): fall back to equal division of the lit span.
        lo, hi = runs[0][0], runs[-1][1]
        runs = [[round(lo + (hi - lo) * i / expected), round(lo + (hi - lo) * (i + 1) / expected)] for i in range(expected)]
    while expected and len(runs) > expected:
        # Detached shards: join across the narrowest gap.
        i = min(range(len(runs) - 1), key=lambda j: runs[j + 1][0] - runs[j][1])
        runs[i:i + 2] = [[runs[i][0], runs[i + 1][1]]]
    cells = []
    for x0, x1 in runs:
        crop = src.crop((max(0, x0 - 3), y0, min(src.width, x1 + 3), y1))
        crop = crop.resize((max(1, crop.width // 2), max(1, crop.height // 2)), Image.Resampling.LANCZOS)
        rgba = np.dstack((np.array(crop), np.full((crop.height, crop.width), 255, np.uint8)))
        cells.append(Image.fromarray(rgba))
    return cells, [y0, y1], runs


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    report = {'version': '1.38', 'hd': HD, 'body_world': BODY_WORLD, 'motions': {}, 'fx': {}, 'notes': []}
    raw = {id: split(file, rows) for id, file, rows, _ in BODY}
    idle0 = raw['idle'][0][0]['image']
    s_idle = BODY_WORLD / (idle0.height * (1 - CROWN))
    sab_world = float(np.median([sabaton(f['image']) for f in raw['idle'][0][:4]])) * s_idle
    report['sabaton_world'] = sab_world
    scales = {}
    for id, file, rows, rule in BODY:
        fs = raw[id][0]
        if rule == 'stand':
            scales[id] = BODY_WORLD / (fs[0]['image'].height * (1 - CROWN))
        elif rule == 'sabaton':
            scales[id] = sab_world / float(np.median([sabaton(f['image']) for f in fs[:4]]))
    # A boot hidden by the cape skews one sheet's run; fall back to the phase median.
    p2 = float(np.median([scales[id] for id, *_, rule in BODY if rule == 'sabaton']))
    for id, *_, rule in BODY:
        if rule == 'sabaton' and abs(scales[id] / p2 - 1) > .08:
            report['notes'].append(f'{id}: sabaton scale {scales[id]:.4f} → phase-2 median {p2:.4f}')
            scales[id] = p2
    # Transformation starts kneeling: match its first drawing to kneel's held groggy pose.
    scales['awaken'] = scales['kneel'] * raw['kneel'][0][8]['image'].height / raw['awaken'][0][0]['image'].height
    clips, tiles = {}, []
    for id, file, rows, rule in BODY:
        fs, audit = raw[id]
        k = scales[id]
        frames, masks = [], []
        for f in fs:
            image = resize(f['image'], k)
            px, py = V.foot_pivot(f['image'], id in FALLEN_POSE)
            frames.append((image, [round(px * k, 3), round(py * k, 3)]))
            if id in GLOW_MASKED:
                masks.append((glow_mask(image), [round(px * k, 3), round(py * k, 3)]))
        clips[id] = frames
        if masks:
            clips['mask_' + id] = masks
        report['motions'][id] = {'frames': len(fs), 'raw_to_world': round(k, 5), 'rule': rule,
                                 'rows': [(r['expected'], r['major_components'], r['method']) for r in audit]}
    # Gauntlets
    master = V.key_green(Image.open(SRC / '01_Master/Phase1_Body_With_Fists.png'))
    comps = V.components(np.array(master.getchannel('A')) > 95)
    body_box, fist_box = comps[0]['box'], comps[1]['box']
    fist_world = BODY_WORLD * (fist_box[3] - fist_box[1]) / ((body_box[3] - body_box[1]) * (1 - CROWN))
    report['fist_world_length'] = fist_world
    p1, a1 = split('05_Gauntlets/Phase1_Parts_12.png', [4, 4, 4])
    p2, a2 = split('05_Gauntlets/Phase2_Parts_12.png', [4, 4, 4])
    fallen, a3 = split('05_Gauntlets/Fallen_4.png', [4])
    merged, a4 = split('05_Gauntlets/Merged_Giant_Fist_6.png', [3, 3])
    k1 = fist_world / p1[0]['image'].width
    k2 = fist_world * 1.15 / p2[0]['image'].width       # phase-2 knuckle spikes
    k3 = fist_world * 1.15 / fallen[0]['image'].width
    k4 = fist_world * 2.2 / merged[2]['image'].width
    centre = lambda im, k: [round(im.width * k / 2, 3), round(im.height * k / 2, 3)]
    clips['fist_p1'] = [(resize(f['image'], k1), centre(f['image'], k1)) for f in p1]
    clips['fist_p2'] = [(resize(f['image'], k2), centre(f['image'], k2)) for f in p2]
    clips['fist_p1_dim'] = [(dim_core(resize(p1[i]['image'], k1)), centre(p1[i]['image'], k1)) for i in (0, 5, 6)]
    clips['fist_fallen_p2'] = [(resize(f['image'], k3), centre(f['image'], k3)) for f in fallen]
    clips['fist_giant'] = [(resize(f['image'], k4), centre(f['image'], k4)) for f in merged]
    for name, audit, k in [('fist_p1', a1, k1), ('fist_p2', a2, k2), ('fist_fallen_p2', a3, k3), ('fist_giant', a4, k4)]:
        report['motions'][name] = {'raw_to_world': round(k, 5), 'rows': [(r['expected'], r['major_components'], r['method']) for r in audit]}
    # Effects (black background, additive)
    fx_clips = {}
    for name, sheet, row in FX:
        cells, band, runs = fx_cells(sheet, row, FX_EXPECTED.get(name))
        fx_clips['fx_' + name] = [(c, [c.width / 2 / HD, c.height / HD]) for c in cells]
        report['fx'][name] = {'sheet': sheet, 'row': row, 'cells': len(cells), 'expected': FX_EXPECTED.get(name), 'y': band}
    # Pack: actors/gauntlets/masks in one set of pages, FX (opaque RGB) in another.
    out_clips, sheets = {}, []
    for group, quality in [(clips, ACTOR_Q), (fx_clips, FX_Q)]:
        tiles, offset = [], len(sheets)
        for key, frames in group.items():
            out_clips[key] = []
            for image, anchor in frames:
                f = {'atlas': [0, 0, image.width, image.height], 'anchor': anchor}
                out_clips[key].append(f)
                tiles.append((f, image))
        pages = pack_pages(tiles)
        for f, _ in tiles:
            f['sheet'] += offset
        for page in pages:
            stream = io.BytesIO()
            if group is fx_clips:
                page.convert('RGB').save(stream, 'WEBP', quality=quality, method=6)
            else:
                page.save(stream, 'WEBP', quality=quality, method=6, exact=True)
            sheets.append(stream.getvalue())
    for i, data in enumerate(sheets):
        (OUT / f'atlas-{i}.webp').write_bytes(data)
    bundle = {'version': '1.38', 'hd': HD, 'bodyWorld': BODY_WORLD, 'fistWorld': round(fist_world, 3),
              'clips': out_clips, 'sheets': ['data:image/webp;base64,' + base64.b64encode(s).decode('ascii') for s in sheets]}
    js = 'const SOVEREIGN_ART = ' + json.dumps(bundle, separators=(',', ':')) + ';\n'
    (ROOT / 'sovereign-art.js').write_text(js, encoding='utf-8')
    report['art_bytes'] = len(js)
    report['sheets'] = [len(s) for s in sheets]
    (OUT / 'build-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({k: v for k, v in report.items() if k not in ('motions',)}, ensure_ascii=False, indent=1))


if __name__ == '__main__':
    main()
