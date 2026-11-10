"""Build Barel's Rika AI motion atlases from the sheets in assets/barel/rika-source.

Every Rika sheet starts from the same standing pose, so each clip is sized by the
height of that pose (142 legacy units, like the earlier Barel motions) and anchored
at its feet. Airborne clips anchor each frame at its own lowest pixel because the
game already moves the actor through `z`.

    python tools/build-barel-rika.py [--preview DIR]
"""
from io import BytesIO
from pathlib import Path
import hashlib
import json
import sys

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'assets/barel/rika-source'
RUNTIME = ROOT / 'assets/runtime'
DATA = ROOT / 'src/animation/barel-rika-data.js'
MANIFEST = ROOT / 'data/runtime-assets.json'
LEGACY_HEIGHT = 142
PAD = 2

# clip: (file, columns, rows, background, options)
#   ref      index of the standing frame used for size and anchor
#   scale    take the size from another clip (no standing frame in this sheet)
#   floating frames anchored at their own lowest pixel (the game supplies z)
SHEETS = {
    # 대기: "바렐 대기 스프라이트 10f.png" 와 같은 10장. 그 PNG 는 배경을 지울 때 검은 갑옷에 구멍이 났으므로
    # 같은 동작의 원본 GIF(어두운 단색 배경)에서 만든다.
    'idle':   ('바렐 대기.gif', 0, 0, 'dark', {'resize': .5}),
    'walk':   ('바렐 이동 스프라이트 10f.png', 4, 3, 'alpha', {}),
    'dash':   ('바렐 대시 10f..png', 4, 3, 'alpha', {}),
    'jump':   ('바렐 점프.gif', 0, 0, 'dark', {'floating': [4, 5, 6, 7], 'resize': .5}),   # GIF 는 다른 시트의 2배 해상도
    'air':    ('바렐 점프 베기.png', 4, 2, 'alpha', {'scale': 'thrust', 'floating': 'all'}),
    'hurt':   ('바렐 피격 10f.png', 4, 3, 'alpha', {}),
    'down':   ('바렐 녹다운 10f.png', 4, 3, 'alpha', {'floating': [3, 4, 5]}),
    'combo0': ('바렐 1타 10f.png', 4, 3, 'alpha', {}),
    # 2타(역일섬) 7장: 0번이 서 있는 자세가 아니므로 크기는 같은 Rika 384px 시트(thrust)에서, 발은 장마다 바닥에.
    # 팔·망토에 초록 배경이 청록색으로 번져 있어 회색으로 되돌린다.
    'combo1': ('바렐 2타 7f.png', 4, 2, 'alpha', {'scale': 'thrust', 'decyan': True}),
    'combo2': ('바렐 3타 16f.png', 4, 4, 'alpha', {}),
    'cast':   ('바렐 i키 10f.png', 4, 3, 'alpha', {}),
    'whirl':  ('바렐 o키 10f.png', 4, 3, 'alpha', {}),
    'leap':   ('바렐 p키 10f.png', 10, 1, 'alpha', {'strip': True, 'floating': [2, 3, 4, 5, 6, 7, 8]}),
    'thrust': ('바렐 u키 10f.png', 4, 3, 'alpha', {}),
    'slam':   ('바렐 h키 10f.png', 4, 3, 'alpha', {}),
    'special1': ('흑월참 1타 10f.png', 4, 3, 'alpha', {}),
    'special2': ('흑월참 2타 10f.png', 4, 3, 'alpha', {}),
    'special3': ('흑월참 3타 10f.png', 4, 3, 'alpha', {}),
    'special4': ('흑월참 4타 10f.png', 4, 3, 'alpha', {}),
    'special5': ('흑월참 5타 10f.png', 4, 3, 'alpha', {}),
}


def despill(rgba):
    """Rika keys on pure green; no Barel colour is green-dominant, so clamp it."""
    rgb = rgba[..., :3].astype(np.int16)
    limit = np.maximum(rgb[..., 0], rgb[..., 2])
    rgb[..., 1] = np.minimum(rgb[..., 1], limit)
    rgba[..., :3] = rgb.astype(np.uint8)
    return rgba


def decyan(rgba):
    """Green-screen spill mixed into dark armour reads as teal (G≈B ≫ R). Barel has no
    teal, so turn those pixels into the armour's slightly blue-violet grey at the same brightness."""
    rgb = rgba[..., :3].astype(np.float32)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    teal = (np.minimum(g, b) > r + 18) & (rgba[..., 3] > 0)
    level = (r + g + b) / 3
    grey = np.stack([level * .96, level * .96, level * 1.08], axis=-1)
    rgb[teal] = grey[teal]
    rgba[..., :3] = np.clip(rgb, 0, 255).astype(np.uint8)
    return rgba


def key_green(rgba):
    r, g, b = (rgba[..., k].astype(np.int16) for k in range(3))
    background = (g > 140) & (g > r + 60) & (g > b + 60)
    rgba[..., 3] = np.where(background, 0, rgba[..., 3])
    return rgba


def key_dark(rgba):
    """Remove the GIF's flat near-black backdrop by flooding from the border only,
    so the equally dark armour inside the silhouette survives."""
    rgb = rgba[..., :3].astype(np.int16)
    near = np.abs(rgb - rgb[0, 0]).max(axis=2) <= 2   # the backdrop is one flat colour
    labels, _ = ndimage.label(near)
    edge = set(np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))) - {0}
    body = ~np.isin(labels, list(edge))
    # The GIF palette shares the backdrop colour with the deepest armour shadow,
    # which leaks out through gaps between the legs; close and refill the silhouette.
    body = ndimage.binary_fill_holes(ndimage.binary_closing(body, structure=np.ones((9, 9)), border_value=0)) | body
    rgba[..., 3] = np.where(body, 255, 0)
    return rgba


def strip_columns(sheet, count):
    """The P sheet places poses on an arc with uneven spacing; cut at empty columns."""
    used = (sheet[..., 3] >= 128).any(axis=0)
    runs, start = [], None
    for x, value in enumerate(used):
        if value and start is None:
            start = x
        if not value and start is not None:
            runs.append([start, x])
            start = None
    if start is not None:
        runs.append([start, len(used)])
    while len(runs) > count:   # join the narrowest gap (a detached blade or cape tip)
        k = min(range(len(runs) - 1), key=lambda i: runs[i + 1][0] - runs[i][1])
        runs[k:k + 2] = [[runs[k][0], runs[k + 1][1]]]
    if len(runs) != count:
        raise ValueError(f'expected {count} poses, found {len(runs)}')
    return [sheet[:, a:b].copy() for a, b in runs]


def cells(name):
    file, cols, rows, bg, opt = SHEETS[name]
    image = Image.open(SOURCE / file)
    if opt.get('strip'):
        frames = strip_columns(np.array(image.convert('RGBA')), cols)
    elif file.endswith('.gif'):
        frames = []
        for k in range(image.n_frames):
            image.seek(k)
            frames.append(np.array(image.convert('RGBA')))
    else:
        sheet = np.array(image.convert('RGBA'))
        h, w = sheet.shape[:2]
        cw, ch = w // cols, h // rows
        frames = [sheet[r * ch:(r + 1) * ch, c * cw:(c + 1) * cw].copy() for r in range(rows) for c in range(cols)]
    out = []
    for rgba in frames:
        if bg == 'green':
            rgba = key_green(rgba)
        elif bg == 'dark':
            rgba = key_dark(rgba)
        rgba[..., 3] = np.where(rgba[..., 3] >= 128, 255, 0)
        rgba = despill(rgba)
        if opt.get('decyan'):
            rgba = decyan(rgba)
        # Rika fills unused grid cells with flat colour or leaves them empty.
        if (rgba[..., 3] > 0).sum() < 400:
            continue
        rgba[rgba[..., 3] == 0] = 0
        if 'resize' in opt:
            small = Image.fromarray(rgba).resize((round(rgba.shape[1] * opt['resize']), round(rgba.shape[0] * opt['resize'])), Image.LANCZOS)
            rgba = np.array(small)
            rgba[rgba[..., 3] < 24] = 0
        out.append(rgba)
    return out


def bbox(rgba):
    ys, xs = np.nonzero(rgba[..., 3])
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1


def feet_x(rgba):
    x0, y0, x1, y1 = bbox(rgba)
    band = rgba[max(y0, y1 - max(6, (y1 - y0) // 12)):y1, :, 3]
    xs = np.nonzero(band.any(axis=0))[0]
    return (xs.min() + xs.max() + 1) / 2


def build():
    clips, standing = {}, {}
    frames_by_clip = {name: cells(name) for name in SHEETS}
    for name, (_, _, _, _, opt) in SHEETS.items():
        if 'scale' in opt:
            continue
        ref = frames_by_clip[name][opt.get('ref', 0)]
        x0, y0, x1, y1 = bbox(ref)
        standing[name] = {'height': int(y1 - y0), 'ground': int(y1), 'x': float(feet_x(ref))}
    for name, (_, _, _, _, opt) in SHEETS.items():
        frames = frames_by_clip[name]
        own = standing.get(name) or {**standing[opt['scale']], 'ground': None, 'x': None}
        ground, cx = own['ground'], own['x']
        if cx is None:
            cx = float(np.median([feet_x(f) for f in frames]))
        floating = opt.get('floating', [])
        if floating == 'all':
            floating = list(range(len(frames)))
        records = []
        for i, rgba in enumerate(frames):
            x0, y0, x1, y1 = bbox(rgba)
            base = y1 if (i in floating or ground is None) else ground
            records.append((rgba[y0:y1, x0:x1], [round(float(cx - x0), 2), round(float(base - y0), 2)]))
        # Pack frames left-to-right into rows no wider than 2048 px.
        placed, x, y, row_h, width = [], PAD, PAD, 0, 0
        for crop, anchor in records:
            h, w = crop.shape[:2]
            if x + w + PAD > 2048:
                x, y, row_h = PAD, y + row_h + PAD, 0
            placed.append((x, y, crop, anchor))
            x += w + PAD
            row_h = max(row_h, h)
            width = max(width, x)
        atlas = Image.new('RGBA', (width, y + row_h + PAD))
        for x, y, crop, _ in placed:
            atlas.paste(Image.fromarray(crop), (x, y))
        buffer = BytesIO()
        atlas.save(buffer, format='PNG', optimize=True)
        data = buffer.getvalue()
        path = f'assets/runtime/{hashlib.sha256(data).hexdigest()[:24]}.png'
        (ROOT / path).write_bytes(data)
        clips[name] = {
            'path': path,
            'renderScale': LEGACY_HEIGHT / own['height'],
            'standingHeight': own['height'],
            'frames': [{'atlas': [x, y, crop.shape[1], crop.shape[0]], 'anchor': anchor} for x, y, crop, anchor in placed],
        }
    return clips


def write(clips):
    old_paths = set()
    if DATA.exists():
        text = DATA.read_text(encoding='utf-8')
        old = json.loads(text[text.index('{'):text.rindex('}') + 1])
        old_paths = {clip['path'] for clip in old.values()}
    new_paths = {clip['path'] for clip in clips.values()}
    for stale in old_paths - new_paths:
        (ROOT / stale).unlink(missing_ok=True)
    manifest = set(json.loads(MANIFEST.read_text(encoding='utf-8')))
    MANIFEST.write_text(json.dumps(sorted((manifest - old_paths) | new_paths), indent=2) + '\n', encoding='utf-8')
    DATA.write_text('// Generated by tools/build-barel-rika.py — do not edit.\n'
                    'globalThis.BAREL_RIKA_DATA = ' + json.dumps(clips, ensure_ascii=False, indent=1) + ';\n',
                    encoding='utf-8')


def preview(clips, out):
    """Contact sheets on a ground line, all at in-game scale, for review."""
    out = Path(out)
    out.mkdir(parents=True, exist_ok=True)
    for name, clip in clips.items():
        atlas = Image.open(ROOT / clip['path'])
        k = clip['renderScale'] * 1.4
        n = len(clip['frames'])
        cell = 260
        sheet = Image.new('RGB', (cell * min(n, 8), cell * ((n + 7) // 8)), (38, 70, 110))
        draw = ImageDraw.Draw(sheet)
        for i, f in enumerate(clip['frames']):
            x, y, w, h = f['atlas']
            crop = atlas.crop((x, y, x + w, y + h)).resize((max(1, round(w * k)), max(1, round(h * k))), Image.LANCZOS)
            ox, oy = (i % 8) * cell + cell // 2, (i // 8) * cell + cell - 30
            draw.line((ox - 120, oy, ox + 120, oy), fill=(90, 120, 160))
            sheet.paste(crop, (round(ox - f['anchor'][0] * k), round(oy - f['anchor'][1] * k)), crop)
            draw.text(((i % 8) * cell + 4, (i // 8) * cell + 4), str(i), fill=(255, 255, 0))
        sheet.save(out / f'{name}.png')


if __name__ == '__main__':
    result = build()
    write(result)
    if '--preview' in sys.argv:
        preview(result, sys.argv[sys.argv.index('--preview') + 1])
    for name, clip in result.items():
        print(f"{name:9s} frames={len(clip['frames']):2d} standing={clip['standingHeight']} scale={clip['renderScale']:.4f}")
