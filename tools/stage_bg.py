"""1스테이지 도트 배경 만들기: mp4 → 정지 배경 1장 + 움직이는 조각 여러 개.

    python tools/stage_bg.py            # 만들고 저장 (assets/runtime/*.webp, data/stage1_bg.json, stage1-bg-art.js)
    python tools/stage_bg.py --dry      # 저장하지 않고 배경별 결과만 출력
    python tools/stage_bg.py --only arena      # 일부 배경만 다시 (쉼표로 여러 개)
    python tools/stage_bg.py --marks   # 측정 위치(BACKGROUNDS 의 marks 등)만 다시 계산해 json/js 갱신
    python tools/stage_bg.py --preview DIR   # 검수용 그림(조각 상자·바닥선·이음새·측정 위치, 투기장 전경)도 DIR 에 저장

필요: numpy, Pillow, imageio-ffmpeg(ffmpeg 실행 파일). 원본은 assets_src/stage1_bg/ 의 mp4 (미리보기 gif는 쓰지 않는다).

처리 순서
 1. mp4 → 36프레임(12fps, 3초 반복)
 2. 정지 배경 = 프레임별 픽셀 중앙값
 3. 움직이는 영역 = 36프레임 최대 변화량 ≥ MOTION_T → 6px 팽창 → 덩어리 → 가까운 덩어리 합치기 → 400px² 미만 버림
    각 영역은 36프레임 조각 띠(프레임을 가로로 늘어놓음, 너무 넓으면 여러 줄)로 저장. 팽창 마스크 밖은 투명.
 4. 배경마다 팔레트 64색 1개(정지 배경과 조각 공용), 디더링 없음, 살짝 선명하게(언샤프) 한 뒤 색 줄이기
 5. 정육 시장: 02·03의 바닥선을 맞춰 세로 정렬 후 가로로 붙이고 이음새 60px를 섞는다(프레임 단계에서 섞으므로 조각도 같이 처리)
 6. 투기장: 아래 25% 중 왼쪽·오른쪽 30%에서 모래색과 다른 픽셀(울타리·말뚝·쇠사슬)을 전경 레이어로 분리, 정지 배경의 그 자리는 모래로 채움
 7. 크기: 바닥선 → GTOP, 그림 아래 끝 → 화면 아래 끝(OY+VH). 배율 scale = 원본 1px 당 월드 px.
    그림은 원본 해상도로 저장하고 게임이 이 배율로 nearest(도트 유지) 확대·축소해서 그린다. len = 너비 × scale.
"""
import hashlib
import io
import json
import subprocess
import sys
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'assets_src' / 'stage1_bg'
OUT_DIR = ROOT / 'assets' / 'runtime'
JSON_OUT = ROOT / 'data' / 'stage1_bg.json'
JS_OUT = ROOT / 'stage1-bg-art.js'
MANIFEST = ROOT / 'data' / 'runtime-assets.json'

GTOP, OY, VH = 340, 146, 360            # game.js 와 같은 값: 걸을 수 있는 바닥 시작 / 화면 위 끝 / 화면 높이(월드)
SCREEN_BOTTOM = OY + VH
FRAMES = 36
MOTION_T = 40                           # 36프레임 동안 최대 변화량 기준
DILATE = 6
MERGE_GAP = 10                          # 이만큼 가까운 덩어리는 합친다
MIN_AREA = 400
MIN_MOVING = 60                         # 팽창 전 움직인 픽셀이 이보다 적으면 잡음
COLORS = 64
SEAM = 60
MAX_STRIP = 16000                       # WebP 최대 변 16383

# floorY: 원본 그림에서 바닥이 시작되는 줄(뒤쪽 벽·가게 밑단). marks: 원본 x 좌표 → json 에는 월드 x 로 기록
BACKGROUNDS = [
    {'id': 'street', 'src': ['01_점령당한_거리_입구.mp4'], 'floorY': [458],
     'marks': {'shopDoor': 1645}},
    {'id': 'market', 'src': ['02_정육시장_첫번째_장.mp4', '03_정육시장_두번째_장.mp4'], 'floorY': [455, 465],
     # 2층 발코니 바닥(난간 기둥이 서는 보): 02 y≈137, 03 y≈122 (이어 붙인 좌표 기준 147 / 122)
     'marks': {'balconyFrom': 700, 'balconyTo': 3520}, 'balconyDeckY': [137, 122]},
    {'id': 'kennel', 'src': ['04_개사육장_뒷골목.mp4'], 'floorY': [448],
     'marks': {'cageDoor': 760}},
    {'id': 'plaza', 'src': ['05_투기장_앞_광장.mp4'], 'floorY': [460],
     # 금 간 벽: 기둥과 울타리 사이 돌무더기가 쌓인 벽면. 철문: 오른쪽 내리닫이 쇠창살 문(아치 안쪽).
     # 철문 윗부분은 큰 깃발이 가리므로 깃발 아래(y≈335)부터 밀어 올린다
     'marks': {'crackedWall': 1195, 'gateLeft': 1600, 'gateRight': 1900}, 'gateTopY': 335},
    {'id': 'arena', 'src': ['06_고라스_보스_투기장.mp4'], 'floorY': [640], 'foreground': True},
]


def ffmpeg():
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()


def decode(path):
    probe = subprocess.run([ffmpeg(), '-i', str(path)], capture_output=True, text=True, encoding='utf-8', errors='replace').stderr
    import re
    w, h = map(int, re.search(r'Video:.*?(\d{3,5})x(\d{3,5})', probe).groups())
    raw = subprocess.run([ffmpeg(), '-v', 'error', '-i', str(path), '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
                         capture_output=True, check=True).stdout
    frames = np.frombuffer(raw, np.uint8).reshape(-1, h, w, 3)
    if len(frames) < FRAMES:
        raise SystemExit(f'{path.name}: 프레임 {len(frames)}개 (36개 필요)')
    return frames[:FRAMES].copy()


def pad_rows(frames, top, bottom):
    """위·아래를 가장자리 줄 복제로 채운다 (바닥선 맞추기)."""
    parts = []
    if top: parts.append(np.repeat(frames[:, :1], top, axis=1))
    parts.append(frames)
    if bottom: parts.append(np.repeat(frames[:, -1:], bottom, axis=1))
    return np.concatenate(parts, axis=1)


def stitch(a, fa, b, fb):
    """바닥선 fa, fb 를 맞춰 a 오른쪽에 b 를 붙인다. 이음새 SEAM px 는 선형으로 섞는다."""
    above = max(fa, fb)
    below = max(a.shape[1] - fa, b.shape[1] - fb)
    a = pad_rows(a, above - fa, below - (a.shape[1] - fa))
    b = pad_rows(b, above - fb, below - (b.shape[1] - fb))
    w = np.linspace(0, 1, SEAM, dtype=np.float32)[None, None, :, None]
    seam = (a[:, :, -SEAM:].astype(np.float32) * (1 - w) + b[:, :, :SEAM].astype(np.float32) * w).round().astype(np.uint8)
    return np.concatenate([a[:, :, :-SEAM], seam, b[:, :, SEAM:]], axis=2), above, {
        'shiftA': above - fa, 'shiftB': above - fb, 'seamX': a.shape[2] - SEAM, 'seam': SEAM}


def median(frames):
    out = np.empty(frames.shape[1:], np.uint8)
    for y in range(0, frames.shape[1], 64):
        out[y:y + 64] = np.median(frames[:, y:y + 64], axis=0).round().astype(np.uint8)
    return out


def dilate(mask, r):
    m = mask.copy()
    for axis in (0, 1):
        src = m.copy()
        for d in range(1, r + 1):
            if axis == 0:
                m[d:] |= src[:-d]; m[:-d] |= src[d:]
            else:
                m[:, d:] |= src[:, :-d]; m[:, :-d] |= src[:, d:]
    return m


def components(mask, block=4):
    """4px 칸 단위로 이어진 덩어리를 찾아 픽셀 bbox 목록으로 돌려준다."""
    H, W = mask.shape
    gh, gw = (H + block - 1) // block, (W + block - 1) // block
    pad = np.zeros((gh * block, gw * block), bool); pad[:H, :W] = mask
    grid = pad.reshape(gh, block, gw, block).any(axis=(1, 3))
    seen = np.zeros_like(grid); boxes = []
    for sy, sx in zip(*np.nonzero(grid)):
        if seen[sy, sx]: continue
        q = deque([(sy, sx)]); seen[sy, sx] = True
        y0 = y1 = sy; x0 = x1 = sx
        while q:
            y, x = q.popleft()
            y0, y1, x0, x1 = min(y0, y), max(y1, y), min(x0, x), max(x1, x)
            for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
                if 0 <= ny < gh and 0 <= nx < gw and grid[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True; q.append((ny, nx))
        # 칸 bbox 안에서 실제 픽셀 bbox
        sub = mask[y0 * block:(y1 + 1) * block, x0 * block:(x1 + 1) * block]
        ys, xs = np.nonzero(sub)
        boxes.append([x0 * block + xs.min(), y0 * block + ys.min(), x0 * block + xs.max() + 1, y0 * block + ys.max() + 1])
    return boxes


def merge_boxes(boxes, gap):
    boxes = [list(b) for b in boxes]
    changed = True
    while changed:
        changed = False
        for i in range(len(boxes)):
            for j in range(i + 1, len(boxes)):
                a, b = boxes[i], boxes[j]
                if a[0] - gap <= b[2] and b[0] - gap <= a[2] and a[1] - gap <= b[3] and b[1] - gap <= a[3]:
                    boxes[i] = [min(a[0], b[0]), min(a[1], b[1]), max(a[2], b[2]), max(a[3], b[3])]
                    del boxes[j]; changed = True; break
            if changed: break
    return boxes


def sharpen(arr):
    return np.asarray(Image.fromarray(arr).filter(ImageFilter.UnsharpMask(radius=1, percent=60, threshold=3)))


def build_palette(base, frames, boxes):
    """정지 배경 + 각 조각의 6프레임마다 한 장을 모아 64색 팔레트를 만든다."""
    tiles = [base.reshape(-1, 3)]
    for x0, y0, x1, y1 in boxes:
        for f in range(0, FRAMES, 6):
            tiles.append(frames[f, y0:y1, x0:x1].reshape(-1, 3))
    px = np.concatenate(tiles)
    side = int(np.ceil(np.sqrt(len(px))))
    sample = np.zeros((side * side, 3), np.uint8); sample[:len(px)] = px; sample[len(px):] = px[-1]
    pal = Image.fromarray(sample.reshape(side, side, 3)).quantize(COLORS, method=Image.Quantize.MEDIANCUT, kmeans=2)
    return pal


_LUT = {}


def apply_palette(arr, pal):
    """가장 가까운 팔레트 색으로 (디더링 없음). RGB 각 6비트 조회표를 팔레트마다 한 번 만든다."""
    key = id(pal)
    if key not in _LUT:
        colors = np.array(pal.getpalette()[:COLORS * 3], np.int32).reshape(-1, 3)
        g = (np.arange(64) * 4 + 2).astype(np.int32)
        grid = np.stack(np.meshgrid(g, g, g, indexing='ij'), -1).reshape(-1, 1, 3)
        idx = np.empty(len(grid), np.uint8)
        for s in range(0, len(grid), 16384):
            idx[s:s + 16384] = ((grid[s:s + 16384] - colors[None]) ** 2).sum(-1).argmin(1)
        _LUT[key] = (colors.astype(np.uint8), idx.reshape(64, 64, 64))
    colors, idx = _LUT[key]
    q = arr >> 2
    return colors[idx[q[..., 0], q[..., 1], q[..., 2]]]


def erode(mask, r):
    return ~dilate(~mask, r)


def arena_foreground(base):
    """아래 25% 중 왼쪽·오른쪽 30%에서 모래색과 다른 픽셀 중 그림 가장자리(아래·옆)에 닿은 덩어리 = 울타리·말뚝·쇠사슬.
    모래색과 다른 것 = 어두운 나무·쇠(밝기 < 34) 또는 채도 낮은 쇠·돌. 얇은 핏자국은 열림(침식→팽창)으로 떼고,
    울타리 안쪽 빈틈은 닫힘(팽창→침식)으로 메운 뒤, 바로 옆의 모래색과 먼 픽셀(밝은 테두리)만 다시 붙인다."""
    H, W = base.shape[:2]
    y0 = int(H * .75)
    f = base.astype(np.float32)
    sand = np.median(f[y0:, int(W * .4):int(W * .6)].reshape(-1, 3), axis=0)
    dist = np.linalg.norm(f - sand, axis=2)
    luma = f @ np.array([.299, .587, .114], np.float32)
    sat = (f.max(2) - f.min(2)) / (f.max(2) + 1)
    region = np.zeros((H, W), bool); region[y0:, :int(W * .3)] = True; region[y0:, int(W * .7):] = True
    cand = ((luma < 34) | ((sat < .42) & (luma < 140))) & region
    cand = dilate(erode(cand, 2), 2)
    cand = erode(dilate(cand, 5), 5) & region
    # 가장자리에 닿은 덩어리만 남긴다 (모래 위 돌멩이 제외)
    block = 2; gh, gw = H // block, W // block
    grid = cand[:gh * block, :gw * block].reshape(gh, block, gw, block).any(axis=(1, 3))
    keep = np.zeros_like(grid); q = deque()
    for y, x in zip(*np.nonzero(grid)):
        if y == gh - 1 or x == 0 or x == gw - 1:
            keep[y, x] = True; q.append((y, x))
    while q:
        y, x = q.popleft()
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= ny < gh and 0 <= nx < gw and grid[ny, nx] and not keep[ny, nx]:
                keep[ny, nx] = True; q.append((ny, nx))
    mask = np.zeros((H, W), bool)
    mask[:gh * block, :gw * block] = np.repeat(np.repeat(keep, block, 0), block, 1)
    mask &= cand
    mask |= dilate(mask, 3) & (dist > 62) & region
    # 정지 배경의 그 자리는 같은 줄의 가운데 모래로 채운다
    filled = base.copy(); off = int(W * .3)
    ys, xs = np.nonzero(mask)
    src_x = np.where(xs < W // 2, xs + off, xs - off)
    filled[ys, xs] = base[ys, src_x]
    return mask, filled


def webp(img):
    buf = io.BytesIO(); img.save(buf, 'WEBP', lossless=True, quality=100, method=6)
    data = buf.getvalue()
    name = f'assets/runtime/{hashlib.sha256(data).hexdigest()[:24]}.webp'
    return name, data


def marks(cfg, out):
    """원본 좌표의 측정 위치 → 월드 좌표 (x 는 구간 왼쪽 끝 기준, 높이는 바닥선 기준)."""
    scale, floor_y, seam = out['scale'], out['floorY'], out.get('seam')
    m = {k: round(v * scale, 1) for k, v in cfg.get('marks', {}).items()}
    if 'balconyDeckY' in cfg:
        decks = [cfg['balconyDeckY'][0] + seam['shiftA'], cfg['balconyDeckY'][1] + seam['shiftB']]
        m['balconyDeckH'] = [round((floor_y - d) * scale, 1) for d in decks]
    if 'gateTopY' in cfg:
        m['gateTop'] = round(GTOP - (floor_y - cfg['gateTopY']) * scale, 1)
    return m


def process(cfg):
    paths = [SRC / s for s in cfg['src']]
    frames = decode(paths[0]); floor_y = cfg['floorY'][0]; seam = None
    if len(paths) == 2:
        frames, floor_y, seam = stitch(frames, cfg['floorY'][0], decode(paths[1]), cfg['floorY'][1])
    _, H, W, _ = frames.shape
    base = median(frames)
    change = (frames.max(axis=0).astype(np.int16) - frames.min(axis=0)).max(axis=2)
    moving = change >= MOTION_T
    grown = dilate(moving, DILATE)
    boxes = merge_boxes(components(grown), MERGE_GAP)
    # 너무 작은 것, 실제로 움직인 픽셀이 몇 개 안 되는 바닥 깜빡임(영상 압축 잡음)은 버린다
    boxes = [b for b in boxes if (b[2] - b[0]) * (b[3] - b[1]) >= MIN_AREA and moving[b[1]:b[3], b[0]:b[2]].sum() >= MIN_MOVING]
    boxes.sort(key=lambda b: (b[0], b[1]))

    sharp = np.stack([sharpen(f) for f in frames])
    sbase = sharpen(base)
    pal = build_palette(sbase, sharp, boxes)
    qbase = apply_palette(sbase, pal)
    files = {}
    fg_name = None
    fg_px = 0
    if cfg.get('foreground'):
        mask, qbase_filled = arena_foreground(qbase)
        fg = np.dstack([qbase, (mask * 255).astype(np.uint8)])
        fg_name, data = webp(Image.fromarray(fg, 'RGBA')); files[fg_name] = data
        qbase = qbase_filled; fg_px = int(mask.sum())
    base_name, data = webp(Image.fromarray(qbase)); files[base_name] = data

    anims = []
    for x0, y0, x1, y1 in boxes:
        w, h = x1 - x0, y1 - y0
        cols = min(FRAMES, max(1, MAX_STRIP // w)); rows = -(-FRAMES // cols)
        strip = np.zeros((rows * h, cols * w, 4), np.uint8)
        alpha = (grown[y0:y1, x0:x1] * 255).astype(np.uint8)
        for f in range(FRAMES):
            q = apply_palette(sharp[f, y0:y1, x0:x1].copy(), pal)
            r, c = divmod(f, cols)
            strip[r * h:(r + 1) * h, c * w:(c + 1) * w] = np.dstack([q, alpha])
        name, data = webp(Image.fromarray(strip, 'RGBA')); files[name] = data
        anims.append({'file': name, 'x': int(x0), 'y': int(y0), 'w': int(w), 'h': int(h), 'frames': FRAMES, 'cols': cols})

    scale = (SCREEN_BOTTOM - GTOP) / (H - floor_y)
    used = len(np.unique(qbase.reshape(-1, 3), axis=0))
    out = {'base': base_name, 'fg': fg_name, 'anims': anims, 'floorY': int(floor_y), 'scale': round(scale, 5),
           'len': int(round(W * scale)), 'width': int(W), 'height': int(H), 'fps': 12, 'colors': used}
    if seam: out['seam'] = seam
    out['marks'] = marks(cfg, out)
    stats = {'id': cfg['id'], 'size': f'{W}x{H}', 'scale': out['scale'], 'len': out['len'], 'anims': len(anims),
             'colors': used, 'animPx': sum(a['w'] * a['h'] for a in anims) * FRAMES, 'fgPx': fg_px,
             'bytes': sum(len(d) for d in files.values())}
    if PREVIEW:
        from PIL import ImageDraw
        im = Image.fromarray(qbase).convert('RGB'); d = ImageDraw.Draw(im)
        for a in anims: d.rectangle([a['x'], a['y'], a['x'] + a['w'] - 1, a['y'] + a['h'] - 1], outline=(0, 255, 255))
        if seam: d.line([(seam['seamX'], 0), (seam['seamX'], H)], fill=(255, 0, 255)); d.line([(seam['seamX'] + SEAM, 0), (seam['seamX'] + SEAM, H)], fill=(255, 0, 255))
        d.line([(0, floor_y), (W, floor_y)], fill=(0, 255, 0))
        for k, v in cfg.get('marks', {}).items(): d.line([(v, 0), (v, H)], fill=(255, 255, 0)); d.text((v + 3, 4), k, fill=(255, 255, 0))
        im.save(PREVIEW / f"{cfg['id']}_base.png")
        if fg_name: Image.fromarray(fg, 'RGBA').save(PREVIEW / f"{cfg['id']}_fg.png")
    return out, files, stats


PREVIEW = None


def write_data(result):
    JSON_OUT.write_text(json.dumps(result, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    JS_OUT.write_text("'use strict';\n// tools/stage_bg.py 가 만든다 (data/stage1_bg.json 과 같은 내용). 직접 고치지 말 것.\n"
                      f'const STAGE1_BG = {json.dumps(result, ensure_ascii=False)};\n', encoding='utf-8')


def main():
    global PREVIEW
    dry = '--dry' in sys.argv
    if '--preview' in sys.argv:            # 검수용: 조각 상자·바닥선·이음새·측정 위치를 그린 정지 배경과 전경 마스크
        PREVIEW = Path(sys.argv[sys.argv.index('--preview') + 1]); PREVIEW.mkdir(parents=True, exist_ok=True)
    if '--marks' in sys.argv:              # 측정 위치만 고쳤을 때: 영상은 다시 처리하지 않는다
        result = json.loads(JSON_OUT.read_text(encoding='utf-8'))
        for cfg in BACKGROUNDS: result[cfg['id']]['marks'] = marks(cfg, result[cfg['id']])
        write_data(result); return
    only = sys.argv[sys.argv.index('--only') + 1].split(',') if '--only' in sys.argv else None   # 일부 배경만 다시
    previous = json.loads(JSON_OUT.read_text(encoding='utf-8')) if JSON_OUT.exists() else {}
    result, all_files = {}, {}
    for cfg in BACKGROUNDS:
        if only and cfg['id'] not in only:
            result[cfg['id']] = previous[cfg['id']]; continue
        out, files, stats = process(cfg)
        print(json.dumps(stats, ensure_ascii=False), flush=True)
        result[cfg['id']] = out; all_files.update(files)
    if dry: return
    # 예전 실행이 남긴 1스테이지 배경 파일 중 이번 결과에 없는 것은 manifest 에서 빼고 지운다
    files_of = lambda bgs: {f for b in bgs for f in (b['base'], b['fg'], *(a['file'] for a in b['anims'])) if f}
    stale = files_of(previous.values()) - files_of(result.values())
    for name in stale: (ROOT / name).unlink(missing_ok=True)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for name, data in all_files.items():
        target = ROOT / name
        if not target.exists(): target.write_bytes(data)
    write_data(result)
    manifest = set(json.loads(MANIFEST.read_text(encoding='utf-8'))) if MANIFEST.exists() else set()
    manifest = (manifest - stale) | set(all_files)
    MANIFEST.write_text(json.dumps(sorted(manifest), indent=2) + '\n', encoding='utf-8')
    print(f'저장: {len(all_files)}개 이미지, {sum(map(len, all_files.values())) / 1048576:.2f} MiB')


if __name__ == '__main__':
    main()
