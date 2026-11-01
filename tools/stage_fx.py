"""1스테이지 기믹 이펙트 시트 → 도트 스프라이트 띠.

    python tools/stage_fx.py                 # assets/runtime/*.webp, data/stage1_fx.json, stage1-fx-art.js
    python tools/stage_fx.py --preview DIR   # 칸 나누기 검수 그림도 저장

원본: assets_src/stage1_fx/fire_fx.png (검은 배경, 가산 합성용), props_fx.png (초록 #00FF00 배경)
 1. 배경 제거: 불 시트는 알파 = max(R,G,B), 색 = RGB / 알파 (검은 배경 위 가산 합성과 같은 결과).
    소품 시트는 초록 키 제거 + 가장자리 초록 번짐 제거(초록이 빨강·파랑보다 큰 만큼 깎고, 초록이 남는 테두리는 투명).
 2. 줄 = 가로 투영의 빈 띠, 칸 = 줄 안 세로 투영의 덩어리. 표의 칸 수보다 많으면 가장 가까운 덩어리끼리 합친다
    (떨어진 불씨·파편이 가장 가까운 칸에 붙는다). 적으면 배경 기준을 높여 다시 나눈다.
 3. 색: stage_bg.py 와 같이 살짝 선명하게(언샤프) 한 뒤 시트마다 48색 팔레트로 줄인다(디더링 없음).
 4. 크기: 목표 크기(바렐 키 H 기준, 월드 px)에 맞춰 nearest 로 줄인다. 저장은 화면 해상도(월드 × 1.5)라
    기본 화질에서 1:1 로 그려진다. json 의 scale = 저장 1px 당 월드 px.
 5. 칸마다 같은 크기의 셀에 기준점(아래 가운데 / 가운데)을 맞춰 가로 띠로 저장.
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

sys.path.insert(0, str(Path(__file__).resolve().parent))
from stage_bg import apply_palette, dilate, webp   # noqa: E402  같은 팔레트·저장 방식

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'assets_src' / 'stage1_fx'
JSON_OUT = ROOT / 'data' / 'stage1_fx.json'
JS_OUT = ROOT / 'stage1-fx-art.js'
MANIFEST = ROOT / 'data' / 'runtime-assets.json'
COLORS = 48
Z = 1.5                          # 월드 → 화면 (game.js 의 Z)
H = 102.24                       # 바렐 서 있는 키(월드 px, docs/boss4_vargul.md)
HEAVY_H = 100                    # 도살 중갑병(중기사) 키 = ET.brute.h

# 시트별 줄: (id, 칸 수, 기준점)
FIRE_ROWS = [('fire_burst', 7, 'bottom'), ('fire_loop', 6, 'bottom'), ('fire_out', 5, 'bottom'), ('fuse', 4, 'bottom'), ('embers', 6, 'center')]
PROP_ROWS = [('bottle', 8, 'center'), ('glass', 5, 'center'), ('rubble', 6, None), ('dust', 6, 'bottom'), ('wall_hole', 1, 'center')]


def runs(flags):
    """True 가 이어진 구간 [(시작, 끝)]."""
    out, start = [], None
    for i, f in enumerate(flags):
        if f and start is None: start = i
        if not f and start is not None: out.append([start, i]); start = None
    if start is not None: out.append([start, len(flags)])
    return out


def group(spans, n):
    """가장 가까운(빈 틈이 가장 좁은) 이웃부터 합쳐 n 개로."""
    spans = [list(s) for s in spans]
    while len(spans) > n:
        gaps = [spans[i + 1][0] - spans[i][1] for i in range(len(spans) - 1)]
        i = int(np.argmin(gaps)); spans[i][1] = spans[i + 1][1]; del spans[i + 1]
    return spans


def split(mask, rows):
    """줄 → 칸. 반환: [(id, anchor, [(x0,y0,x1,y1), ...])]"""
    ys = group(runs(mask.any(1)), len(rows))
    if len(ys) != len(rows): raise SystemExit(f'줄 {len(ys)}개 (필요 {len(rows)})')
    out = []
    for (rid, n, anchor), (y0, y1) in zip(rows, ys):
        band = mask[y0:y1]
        spans, mass = runs(band.any(0)), band.sum(0)
        # 떨어진 작은 불씨·파편(줄 전체 픽셀의 1% 미만)은 빼 두었다가 칸을 정한 뒤 가장 가까운 칸에 붙인다
        total = mass.sum()
        big = [s for s in spans if mass[s[0]:s[1]].sum() >= total * .01]
        strays = [s for s in spans if mass[s[0]:s[1]].sum() < total * .01]
        xs = group(big, n) if len(big) >= n else group(spans, n)
        if len(big) >= n:
            for s0, s1 in strays:
                c = (s0 + s1) / 2
                g = min(xs, key=lambda x: 0 if x[0] <= c <= x[1] else min(abs(c - x[0]), abs(c - x[1])))
                g[0], g[1] = min(g[0], s0), max(g[1], s1)
        if len(xs) != n: raise SystemExit(f'{rid}: 칸 {len(xs)}개 (필요 {n})')
        cells = []
        for x0, x1 in xs:
            yy = np.nonzero(band[:, x0:x1].any(1))[0]
            cells.append((x0, y0 + yy[0], x1, y0 + yy[-1] + 1))
        out.append((rid, anchor, cells))
    return out


def fire_rgba(path):
    a = np.asarray(Image.open(path).convert('RGB'))
    return a, a.max(2) > 24


def props_rgba(path):
    a = np.asarray(Image.open(path).convert('RGB')).astype(np.int16)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    key = (g > 140) & (g > r + 60) & (g > b + 60)
    # 키 바로 옆의 초록빛 테두리도 지운다
    edge = dilate(key, 2) & ~key & (g > np.maximum(r, b) + 25)
    alpha = ~(key | edge)
    rgb = a.copy()
    rgb[..., 1] = np.minimum(g, np.maximum(r, b) + 8)          # 남은 초록 번짐 깎기
    rgb[~alpha] = 0
    return rgb.astype(np.uint8), alpha


def palette_for(rgb, mask):
    px = rgb[mask]
    side = int(np.ceil(np.sqrt(len(px))))
    sample = np.zeros((side * side, 3), np.uint8); sample[:len(px)] = px; sample[len(px):] = px[-1]
    return Image.fromarray(sample.reshape(side, side, 3)).quantize(COLORS, method=Image.Quantize.MEDIANCUT, kmeans=2)


def clean(rgb, mask, additive):
    """언샤프 → 48색 → RGBA. 불은 알파 = max(RGB), 색은 알파로 나눠 복원."""
    sharp = np.asarray(Image.fromarray(rgb).filter(ImageFilter.UnsharpMask(radius=1, percent=60, threshold=3)))
    q = apply_palette(sharp, palette_for(sharp, mask))
    if additive:
        alpha = q.max(2).astype(np.float32)
        col = np.where(alpha[..., None] > 0, q.astype(np.float32) * 255 / np.maximum(alpha, 1)[..., None], 0)
        a = np.where(mask, alpha, 0)
        return np.dstack([col.round().clip(0, 255).astype(np.uint8), a.astype(np.uint8)])
    return np.dstack([q, (mask * 255).astype(np.uint8)])


def crop(img, box):
    x0, y0, x1, y1 = box
    return img[y0:y1, x0:x1]


def scaled(frames, k):
    out = []
    for f in frames:
        h, w = f.shape[:2]
        out.append(np.asarray(Image.fromarray(f, 'RGBA').resize((max(1, round(w * k)), max(1, round(h * k))), Image.NEAREST)))
    return out


def strip(frames, anchor):
    """같은 크기 셀에 기준점을 맞춰 가로로 늘어놓는다."""
    cw = max(f.shape[1] for f in frames); ch = max(f.shape[0] for f in frames)
    cw += cw % 2
    out = np.zeros((ch, cw * len(frames), 4), np.uint8)
    for i, f in enumerate(frames):
        h, w = f.shape[:2]
        x = i * cw + (cw - w) // 2
        y = ch - h if anchor == 'bottom' else (ch - h) // 2
        out[y:y + h, x:x + w] = f
    ax, ay = cw / 2, (ch if anchor == 'bottom' else ch / 2)
    return out, cw, ch, ax, ay


def largest_piece(f):
    """한 칸 안에서 가장 큰 조각(이어진 덩어리)의 긴 변."""
    m = f[..., 3] > 0
    from collections import deque
    seen = np.zeros_like(m); best = 0
    for sy, sx in zip(*np.nonzero(m)):
        if seen[sy, sx]: continue
        q = deque([(sy, sx)]); seen[sy, sx] = True; y0 = y1 = sy; x0 = x1 = sx
        while q:
            y, x = q.popleft(); y0, y1, x0, x1 = min(y0, y), max(y1, y), min(x0, x), max(x1, x)
            for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
                if 0 <= ny < m.shape[0] and 0 <= nx < m.shape[1] and m[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True; q.append((ny, nx))
        best = max(best, y1 - y0 + 1, x1 - x0 + 1)
    return best


def main():
    preview = Path(sys.argv[sys.argv.index('--preview') + 1]) if '--preview' in sys.argv else None
    if preview: preview.mkdir(parents=True, exist_ok=True)
    cells = {}
    for name, loader, rows, additive in (('fire_fx.png', fire_rgba, FIRE_ROWS, True), ('props_fx.png', props_rgba, PROP_ROWS, False)):
        rgb, mask = loader(SRC / name)
        rgba = clean(rgb, mask, additive)
        for rid, anchor, boxes in split(mask, rows):
            cells[rid] = {'anchor': anchor, 'additive': additive, 'frames': [crop(rgba, b) for b in boxes], 'boxes': boxes}
        if preview:
            from PIL import ImageDraw
            im = Image.fromarray(rgb); d = ImageDraw.Draw(im)
            for rid, anchor, boxes in split(mask, rows):
                for i, (x0, y0, x1, y1) in enumerate(boxes):
                    d.rectangle([x0, y0, x1 - 1, y1 - 1], outline=(0, 255, 255)); d.text((x0 + 2, y0 + 2), f'{rid}{i + 1}', fill=(255, 255, 0))
            im.save(preview / name)

    # 화염병 회전: 1~3칸을 0·90·180·270°(시계 방향, 보간 없음)
    bottle = cells.pop('bottle')['frames'][:3]
    spin = [np.ascontiguousarray(np.rot90(f, -k)) for k in range(4) for f in bottle]
    cells['bottle_spin'] = {'anchor': 'center', 'additive': False, 'frames': spin}
    rubble = cells.pop('rubble')['frames']
    cells['rubble_pile'] = {'anchor': 'bottom', 'additive': False, 'frames': rubble[:2]}
    cells['rubble_chunk'] = {'anchor': 'center', 'additive': False, 'frames': rubble[2:]}
    for c in cells.values(): c.pop('boxes', None)

    # 목표 크기(월드 px) / 원본에서 잰 길이
    W_ = lambda fr: max(f.shape[1] for f in fr)
    H_ = lambda fr: max(f.shape[0] for f in fr)
    fire_k = 140 / W_(cells['fire_loop']['frames'])                       # 바닥 불 판정 지름(가로 140)
    target = {
        'bottle_spin': (0.2 * H) / bottle[0].shape[0],                    # 서 있는 병(1칸)의 길이
        'fire_burst': fire_k, 'fire_loop': fire_k, 'fire_out': fire_k,
        'fuse': (0.12 * H) / H_(cells['fuse']['frames']),
        'embers': (0.5 * H) / W_(cells['embers']['frames']),
        'glass': (0.1 * H) / np.mean([largest_piece(f) for f in cells['glass']['frames']]),   # 조각 하나
        'rubble_chunk': (0.3 * H) / max(max(f.shape[:2]) for f in cells['rubble_chunk']['frames']),
        'rubble_pile': (0.7 * H) / W_(cells['rubble_pile']['frames']),
        'dust': (0.8 * H) / W_(cells['dust']['frames']),
        'wall_hole': (HEAVY_H * 1.15) / H_(cells['wall_hole']['frames']),
    }
    order = ['bottle_spin', 'fuse', 'fire_burst', 'fire_loop', 'fire_out', 'embers', 'glass', 'rubble_chunk', 'rubble_pile', 'dust', 'wall_hole']
    result, files = {}, {}
    for rid in order:
        c, k = cells[rid], target[rid]
        frames = scaled(c['frames'], k * Z)
        img, cw, ch, ax, ay = strip(frames, c['anchor'])
        name, data = webp(Image.fromarray(img, 'RGBA')); files[name] = data
        result[rid] = {'file': name, 'w': int(cw), 'h': int(ch), 'frames': len(frames), 'ax': ax, 'ay': ay,
                       'scale': round(1 / Z, 5), 'additive': c['additive'],
                       'world': [round(cw / Z, 1), round(ch / Z, 1)],
                       'sizes': [[round(f.shape[1] / Z, 1), round(f.shape[0] / Z, 1)] for f in frames]}
        print(json.dumps({'id': rid, 'frames': len(frames), 'cell_px': [cw, ch], 'world': result[rid]['world'],
                          'k_src_to_world': round(k, 4)}, ensure_ascii=False))
        if preview: Image.fromarray(img, 'RGBA').save(preview / f'{rid}.png')

    previous = json.loads(JSON_OUT.read_text(encoding='utf-8')) if JSON_OUT.exists() else {}
    stale = {v['file'] for v in previous.values()} - set(files)
    for n in stale: (ROOT / n).unlink(missing_ok=True)
    for n, data in files.items():
        if not (ROOT / n).exists(): (ROOT / n).write_bytes(data)
    JSON_OUT.write_text(json.dumps(result, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    JS_OUT.write_text("'use strict';\n// tools/stage_fx.py 가 만든다 (data/stage1_fx.json 과 같은 내용). 직접 고치지 말 것.\n"
                      f'const STAGE1_FX = {json.dumps(result, ensure_ascii=False)};\n', encoding='utf-8')
    manifest = set(json.loads(MANIFEST.read_text(encoding='utf-8')))
    MANIFEST.write_text(json.dumps(sorted((manifest - stale) | set(files)), indent=2) + '\n', encoding='utf-8')
    print(f'저장: {len(files)}개, {sum(map(len, files.values())) / 1024:.0f} KiB')


if __name__ == '__main__':
    main()
