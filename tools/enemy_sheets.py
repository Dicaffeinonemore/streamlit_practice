"""1스테이지 새 적 5종 스프라이트: 격자 시트 → 적별 아틀라스 + 프레임 데이터.

    python tools/enemy_sheets.py                 # assets/runtime/*.webp, data/stage1_enemies.json, stage1-enemy-art.js
    python tools/enemy_sheets.py --preview DIR   # 피벗·무기 끝 검수 그림

원본: assets_src/stage1_enemies/일반 병사/*.png (배경 투명, 오른쪽을 봄)
 - 기본은 격자 분할. 칼 도적 2타 및 1·3타 윗줄은 칸을 넘은 부분을 원본에서 분리해 보존한다.
 - 피벗: 발바닥 y(가장 아래 불투명 줄) + 몸통 중심 x(발에서 위로 35~75% 높이 줄의 불투명 픽셀 x 중앙값).
   선 자세 동작에서 피벗 x가 이웃 평균보다 크게 튀면 이웃 평균으로 맞춘다. 녹다운·기상은 그대로.
 - 시트 배율 맞추기: 칸이 큰 시트(400·512px)는 인물도 크게 그려져 있어, 시트마다 대기 시트의 그림 배율로 먼저 줄인다(sheet_ratios).
 - 크기: 대기 1번 프레임 몸 키 → 목표 키(바렐 키 H 의 배수, 사냥개는 어깨 높이). 그 적의 모든 시트에 같은 배율.
 - 기상 1번 칸(누움)은 녹다운 마지막 칸과 겹침이 가장 큰 위치로 피벗 x 를 맞춘다. 사냥개 다이빙 3~5칸(공중)은 몸 중심 기준.
   원본을 STORE 배율로 줄여 WebP(품질 90, 기존 캐릭터 시트 규칙)로 저장하고, 게임이 그릴 때 나머지 배율(scale)을 적용한다.
 - 무기 끝: 프레임마다 피벗 기준 가장 앞(오른쪽)·가장 뒤 불투명 픽셀의 위치(월드 px)를 기록 → 공격 판정 상자.
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage
from stage1_blade_frames import split as split_blade_attack, PAD_X, PAD_Y

sys.path.insert(0, str(Path(__file__).resolve().parent))

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'assets_src' / 'stage1_enemies' / '일반 병사'
JSON_OUT = ROOT / 'data' / 'stage1_enemies.json'
JS_OUT = ROOT / 'stage1-enemy-art.js'
MANIFEST = ROOT / 'data' / 'runtime-assets.json'
H = 102.24                       # 바렐 서 있는 키(월드 px)
# 원본을 이 배율로 줄여 저장(고품질 보간 — 게임 렌더러가 축소할 때와 같은 방식). 적 하나의 아틀라스가 400만 픽셀을 넘으면
# 게임이 프레임마다 따로 잘라 캐시하는 느린 경로로 그리므로, 그 아래로 맞춘다.
STORE = 0.6
QUALITY = 90                     # 기존 캐릭터 시트와 같은 손실 WebP 품질 (build_vargul_art.py ACTOR_QUALITY)
LYING = {'knockdown', 'getup'}

ENEMIES = {
    'axe': {'name': '도끼 도적', 'height': 1.0, 'clips': {
        'idle': '도끼 도적 대기 모션', 'walk': '도끼 도적 이동 모션', 'attack': '도끼 도적 공격 모션',
        'hurt': '도끼 도적 피격 모션', 'knockdown': '도끼 도적 녹다운 모션', 'getup': '도끼 도적 기상 모션'}},
    'blade': {'name': '칼 도적', 'height': 1.05, 'clips': {
        'idle': '칼 도적 대기 모션', 'walk': '칼 도적 이동 모션', 'atk1': '칼 도적 1타', 'atk2': '칼 도적 2타', 'atk3': '칼 도적 3타',
        'hurt': '칼 도적 피격 모션', 'knockdown': '칼 도적 녹다운 모션', 'getup': '칼 도적 기상 모션'}},
    'club': {'name': '곤봉잡이', 'height': 0.92, 'clips': {
        'idle': '곤봉 대기', 'walk': '곤봉 이동', 'attack': '곤봉 공격', 'hurt': '곤봉 피격', 'knockdown': '곤봉 녹다운', 'getup': '곤봉 기상'}},
    'heavy': {'name': '도살 중갑병', 'height': 1.35, 'clips': {
        'idle': '중갑 대기', 'walk': '중갑 이동', 'spin': '중갑 회전 공격', 'grab': '중갑 잡기', 'choke': '중갑 조르기',
        'hurt': '중갑 피격', 'knockdown': '중갑 녹다운', 'getup': '중갑 기상'}},
    'molotov': {'name': '화염병 투척자', 'height': 0.95, 'clips': {
        'idle': '화염병 대기', 'walk': '화염병 이동', 'throw': '화염병 투척', 'hurt': '화염병 피격',
        'knockdown': '화염병 녹다운', 'getup': '화염병 기상'}},
    # 사냥개: 크기는 어깨 높이(대기 1번 칸) = 0.42H. 물기 다이빙 3~5칸은 공중 → 몸 중심 기준(높이는 코드가 준다)
    'hound': {'name': '사냥개', 'shoulder': 0.42, 'airborne': {'dive': [3, 4, 5]}, 'clips': {
        'idle': '사냥개 대기', 'run': '사냥개 이동', 'dive': '사냥개 공격', 'hurt': '사냥개 피격',
        'knockdown': '사냥개 녹다운', 'getup': '사냥개 기상'}},
}
# 칸이 큰 시트일수록 인물이 크게 그려져 있다(320px 칸 기준 400px 칸 ≈ 1.15~1.2배, 512px 칸 ≈ 1.4~1.5배).
# 시트마다 이 비율로 줄여 대기 시트와 같은 그림 배율로 맞춘다(아래 sheet_ratio).
BODY_ONLY = ('hurt', 'walk', 'run', 'throw')       # 무기 궤적이 없어 면적 비교가 믿을 만한 동작


def webp(img):
    import hashlib, io
    buf = io.BytesIO(); img.save(buf, 'WEBP', quality=QUALITY, method=6, exact=True)
    data = buf.getvalue()
    return f'assets/runtime/{hashlib.sha256(data).hexdigest()[:24]}.webp', data


def grid(img):
    w, h = img.size
    cols, rows = (3, 2) if (w, h) == (1536, 1024) else (5, 2)
    cw, ch = w // cols, h // rows
    a = np.asarray(img.convert('RGBA'))
    return [strip_intruders(a[r * ch:(r + 1) * ch, c * cw:(c + 1) * cw].copy()) for r in range(rows) for c in range(cols)]


def strip_intruders(cell):
    """옆 칸 인물이 경계를 넘어 들어온 조각을 지운다: 칸 위·아래 끝에 닿은, 본체와 떨어진 작은 덩어리(전체의 6% 미만),
    왼쪽·오른쪽 끝에 닿은 아주 작은 덩어리(2% 미만). 궤적·먼지처럼 가장자리에 닿지 않는 덩어리는 그대로 둔다."""
    lab, n = ndimage.label(cell[..., 3] > 16, structure=np.ones((3, 3)))
    if n < 2: return cell
    sizes = ndimage.sum_labels(np.ones_like(lab), lab, index=range(1, n + 1))
    total, biggest = sizes.sum(), int(np.argmax(sizes)) + 1
    tb = set(np.unique(np.concatenate([lab[0], lab[-1]]))) - {0}
    lr = set(np.unique(np.concatenate([lab[:, 0], lab[:, -1]]))) - {0}
    for i in tb | lr:
        if i == biggest: continue
        limit = .06 if i in tb else .02
        if sizes[i - 1] < total * limit: cell[lab == i] = 0
    return cell


def measure(cell):
    """bbox, 발 y, 몸통 중심 x (칸 좌표)."""
    m = cell[..., 3] > 16
    ys, xs = np.nonzero(m)
    top, foot = ys.min(), ys.max()
    h = foot - top + 1
    band = m[int(foot - .75 * h):int(foot - .35 * h) + 1]
    bx = np.nonzero(band)[1]
    cx = float(np.median(bx)) if len(bx) else float(np.median(xs))
    return (xs.min(), top, xs.max() + 1, foot + 1), foot, cx


def opaque_area(cells):
    return float(np.median([(c[..., 3] > 16).sum() for c in cells]))


def height_of(cell):
    ys = np.nonzero(cell[..., 3] > 16)[0]
    return ys.max() - ys.min() + 1


def sheet_ratios(spec, sheets):
    """시트별 배율(→ 대기 시트 그림 배율). 320px 칸 = 1.
    400px 칸: 그 적의 무기 궤적 없는 400px 시트(피격·이동·투척)의 면적 비율 √(대기/시트) 중앙값을 같은 칸 크기 시트 모두에.
    512px 칸: 시트마다 대기 1번 칸 키 / 그 시트의 선 자세 칸 키(기상 = 마지막 칸, 피격·녹다운 = 첫 칸)."""
    idle = sheets['idle']; ia, ih = opaque_area(idle), height_of(idle[0])
    size = {cid: cells[0].shape[0] for cid, cells in sheets.items()}
    out = {}
    for ch in sorted(set(size.values())):
        group = [cid for cid in sheets if size[cid] == ch]
        if ch == size['idle']:
            for cid in group: out[cid] = 1.0
            continue
        if ch >= 512:                               # 시트마다 선 자세 칸의 키로: 기상은 마지막 칸, 피격·녹다운은 첫 칸
            for cid in group: out[cid] = ih / height_of(sheets[cid][-1 if cid == 'getup' else 0])
            continue
        area_r = {cid: (ia / opaque_area(sheets[cid])) ** .5 for cid in group}
        body = [area_r[c] for c in group if c in BODY_ONLY] or list(area_r.values())
        for cid in group: out[cid] = float(np.median(body))
    return out


def rescale(cell, r):
    if abs(r - 1) < 1e-3: return cell
    h, w = cell.shape[:2]
    im = Image.fromarray(cell, 'RGBA').convert('RGBa').resize((round(w * r), round(h * r)), Image.LANCZOS).convert('RGBA')
    return np.asarray(im).copy()


def shoulder_height(cell):
    """어깨 높이(px): 몸통 중심에서 머리 쪽(오른쪽)으로 25~55% 구간 기둥들의 가장 높은 불투명 픽셀."""
    box, foot, cx = measure(cell)
    x0, x1 = int(cx + .25 * (box[2] - cx)), int(cx + .55 * (box[2] - cx))
    ys = np.nonzero((cell[..., 3] > 16)[:, x0:x1 + 1].any(1))[0]
    return foot - ys.min() + 1, (x0, x1, ys.min())


def align_x(a, b, foot_a, foot_b):
    """b 를 가로로 얼마나 옮기면 a 와 가장 많이 겹치는가 (발 줄을 맞춘 뒤 불투명 마스크 겹침)."""
    ma, mb = a[..., 3] > 16, b[..., 3] > 16
    h = min(foot_a, foot_b) + 1
    ma, mb = ma[foot_a + 1 - h:foot_a + 1], mb[foot_b + 1 - h:foot_b + 1]
    W = max(ma.shape[1], mb.shape[1]) + 400
    A = np.zeros((h, W), bool); A[:, 200:200 + ma.shape[1]] = ma
    best, bs = -1, 0
    for s in range(-200, 201, 2):
        B = np.zeros((h, W), bool); B[:, 200 + s:200 + s + mb.shape[1]] = mb
        v = (A & B).sum()
        if v > best: best, bs = v, s
    return bs                                       # b[x] ≈ a[x + bs]


def smooth_pivots(cx):
    out = list(cx)
    for i in range(len(cx)):
        nb = [cx[j] for j in (i - 1, i + 1) if 0 <= j < len(cx)]
        avg = sum(nb) / len(nb)
        if abs(cx[i] - avg) > 10: out[i] = avg
    return out


def tips(cell, px, foot, k, body):
    """피벗 기준 무기 끝 (월드 px: [앞쪽 거리, 발에서의 높이]).
    tip/back = 몸 키 20% 위(발·그림자 제외)에서 가장 앞/뒤 불투명 픽셀, hand = 몸 키 45% 위에서 가장 앞 픽셀(잡기·조르기 손)."""
    m = cell[..., 3] > 16
    ys, xs = np.nonzero(m)
    hgt = (foot - ys) * k
    def pick(mask, fn):
        if not mask.any(): return None
        i = np.flatnonzero(mask)[fn(xs[mask])]
        return [round((xs[i] - px) * k, 1), round(float(hgt[i]), 1)]
    low, mid = hgt >= .2 * body, hgt >= .45 * body
    return pick(low, np.argmax), pick(low, np.argmin), pick(mid, np.argmax)


def main():
    preview = Path(sys.argv[sys.argv.index('--preview') + 1]) if '--preview' in sys.argv else None
    if preview: preview.mkdir(parents=True, exist_ok=True)
    result, files = {}, {}
    for eid, spec in ENEMIES.items():
        sheets = {cid: grid(Image.open(SRC / f'{name}.png')) for cid, name in spec['clips'].items()}
        ratios = sheet_ratios(spec, sheets)
        repaired = ({cid: [rescale(c, ratios[cid]) for c in split_blade_attack(Image.open(SRC / f'{spec["clips"][cid]}.png'),cid)]
                     for cid in ('atk1','atk2','atk3')} if eid == 'blade' else {})
        sheets = {cid: [rescale(c, ratios[cid]) for c in cells] for cid, cells in sheets.items()}
        idle_box, idle_foot, idle_cx = measure(sheets['idle'][0])
        body = idle_box[3] - idle_box[1]
        if spec.get('shoulder'):
            sh, _ = shoulder_height(sheets['idle'][0])
            k = spec['shoulder'] * H / sh                    # 원본 1px → 월드 px (어깨 높이 기준)
        else:
            k = spec['height'] * H / body                    # 원본 1px → 월드 px (서 있는 키 기준)
        tall = body * k                                      # 무기 끝 측정용 몸 키(월드)
        stand_center = idle_foot - (idle_box[1] + idle_box[3]) / 2   # 대기 1번 칸: 발에서 몸 중심까지(px)
        crops, clips, kd_last = [], {}, None
        for cid, cells in sheets.items():
            info = [measure(c) for c in cells]
            cx = [i[2] for i in info]
            if cid not in LYING: cx = smooth_pivots(cx)
            if cid == 'getup' and kd_last is not None:       # 기상 1번 칸(누움)은 녹다운 마지막 칸과 위치가 이어지게
                kc, kfoot, kpx = kd_last
                s = align_x(kc, cells[0], kfoot, info[0][1])
                cx[0] = kpx - s
            ids = []
            for n, (cell, (box, foot, _), px) in enumerate(zip(cells, info, cx)):
                x0, y0, x1, y1 = box
                if n + 1 in spec.get('airborne', {}).get(cid, []):   # 공중 칸: 몸 중심을 서 있을 때의 몸 중심 높이에 맞춘다
                    foot = (y0 + y1) / 2 + stand_center
                fwd, back, hand = tips(cell, px, foot, k, tall)
                # Lower-row poses of 1/3 overlap a neighbouring leg. Keep
                # their existing extraction until an unoccluded source exists.
                if cid in repaired and (cid == 'atk2' or n < 5):
                    # Animation pixels are repaired, while hitboxes and their
                    # original pivot remain exactly as before this art fix.
                    cell = repaired[cid][n]
                    px += PAD_X * ratios[cid]
                    foot += PAD_Y * ratios[cid]
                    x0, y0, x1, y1 = measure(cell)[0]
                im = Image.fromarray(cell[y0:y1, x0:x1], 'RGBA').convert('RGBa')
                im = im.resize((max(1, round((x1 - x0) * STORE)), max(1, round((y1 - y0) * STORE))), Image.LANCZOS).convert('RGBA')
                crops.append({'img': np.asarray(im), 'anchor': [round((px - x0) * STORE, 1), round((foot + 1 - y0) * STORE, 1)], 'tip': fwd, 'back': back, 'hand': hand,
                              'cell': cell, 'pivot': (px, foot), 'box': box})
                ids.append(len(crops) - 1)
            clips[cid] = ids
            if cid == 'knockdown': kd_last = (cells[-1], info[-1][1], cx[-1])
        # 아틀라스 (너비 2048, 2px 간격)
        x = y = rowh = 0
        for c in crops:
            hh, ww = c['img'].shape[:2]
            if x + ww > 2048: x, y, rowh = 0, y + rowh + 2, 0
            c['atlas'] = [x, y, ww, hh]; x += ww + 2; rowh = max(rowh, hh)
        atlas = np.zeros((y + rowh, 2048, 4), np.uint8)
        for c in crops:
            ax, ay, ww, hh = c['atlas']; atlas[ay:ay + hh, ax:ax + ww] = c['img']
        used = int(max(c['atlas'][0] + c['atlas'][2] for c in crops))
        name, data = webp(Image.fromarray(atlas[:, :used], 'RGBA')); files[name] = data
        extra = {}
        if spec.get('shoulder'): extra['shoulder'] = round(shoulder_height(sheets['idle'][0])[0] * k, 1)
        result[eid] = {'name': spec['name'], 'atlas': name, 'scale': round(k / STORE, 5), 'height': round(body * k, 1), **extra,
                       'sheetRatio': {c: round(r, 3) for c, r in ratios.items()},
                       'clips': clips, 'frames': [{'atlas': c['atlas'], 'anchor': c['anchor'], 'tip': c['tip'], 'back': c['back'], 'hand': c['hand']} for c in crops]}
        print(json.dumps({'id': eid, 'scale': round(k, 4), 'stand_world': round(body * k, 1), 'stand_screen': round(body * k * 1.5, 1), **extra,
                          'ratios': {c: round(r, 3) for c, r in ratios.items() if r != 1},
                          'frames': {c: len(v) for c, v in clips.items()}, 'atlas': [used, y + rowh]}, ensure_ascii=False))
        if preview:
            from PIL import ImageDraw
            for cid, ids in clips.items():
                cw, ch = crops[ids[0]]['cell'].shape[1], crops[ids[0]]['cell'].shape[0]
                sheet = Image.new('RGBA', (cw * len(ids), ch), (90, 90, 110, 255))
                for n, i in enumerate(ids):
                    c = crops[i]; sheet.alpha_composite(Image.fromarray(c['cell'], 'RGBA'), (n * cw, 0))
                    d = ImageDraw.Draw(sheet); px, foot = c['pivot']
                    d.line([(n * cw + px, 0), (n * cw + px, ch)], fill=(0, 255, 0)); d.line([(n * cw, foot), (n * cw + cw, foot)], fill=(0, 255, 0))
                    for key, col in (('tip', (255, 0, 0)), ('hand', (255, 255, 0))):
                        if c[key]:
                            tx = n * cw + px + c[key][0] / k; ty = foot - c[key][1] / k
                            d.ellipse([tx - 5, ty - 5, tx + 5, ty + 5], outline=col, width=2)
                sheet.convert('RGB').save(preview / f'{eid}_{cid}.png')

    previous = json.loads(JSON_OUT.read_text(encoding='utf-8')) if JSON_OUT.exists() else {}
    stale = {v['atlas'] for v in previous.values()} - set(files)
    # Keep old atlases on disk: they may still be referenced outside this build.
    for n, data in files.items():
        if not (ROOT / n).exists(): (ROOT / n).write_bytes(data)
    JSON_OUT.write_text(json.dumps(result, ensure_ascii=False) + '\n', encoding='utf-8')
    JS_OUT.write_text("'use strict';\n// tools/enemy_sheets.py 가 만든다 (data/stage1_enemies.json 과 같은 내용). 직접 고치지 말 것.\n"
                      f'const STAGE1_ENEMY_ART = {json.dumps(result, ensure_ascii=False)};\n', encoding='utf-8')
    manifest = set(json.loads(MANIFEST.read_text(encoding='utf-8')))
    MANIFEST.write_text(json.dumps(sorted((manifest - stale) | set(files)), indent=2) + '\n', encoding='utf-8')
    print(f'저장: {len(files)}개, {sum(map(len, files.values())) / 1048576:.2f} MiB')


if __name__ == '__main__':
    main()
