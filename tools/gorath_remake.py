"""1스테이지 보스 "도살자 고라스" 리메이크 스프라이트: 격자 시트 → 아틀라스 + 프레임 데이터.

    python tools/gorath_remake.py                # assets/runtime/*.webp, data/gorath_remake.json, gorath-remake-art.js, tools/out/scale_check.png
    python tools/gorath_remake.py --preview DIR  # 동작별 피벗·판정 검수 그림

원본: assets_src/gorath_remake/gorath/*.png (배경 투명, 오른쪽을 봄). 격자는 SHEETS 표 그대로 자른다(덩어리 검출로 자르지 않는다).
 1. 격자 분할, 빈 칸 버림.
 2. 초록 키 잔여물 제거(G 가 R·B 보다 뚜렷이 큰 픽셀) + 가장자리 초록 번짐 제거.
 3. 고기 시트에 구워진 바닥 그림자 제거, 던지기·끌어당기기 시트의 손에서 떨어진 사슬·갈고리 제거, hook.png 의 체크무늬 배경 제거.
 4. 크기 통일: 시트마다 기준 프레임의 몸 키를 H(기존 고라스 서 있는 키, 월드 px)로 맞추는 배율 k(월드 px / 원본 px).
    원본 픽셀은 그대로 저장하고 게임이 k 로 그린다.
 5. 피벗: 지면선 = 그 동작 프레임들의 발바닥 y 중앙값, 가로 = 몸통(높이 35~75%) 불투명 픽셀 x 중앙값, 이웃 대비 튀면 보정.
    녹다운·사망·기상·고기는 고정 기준점.
 6. 2048x2048 이하 WebP(품질 90) 아틀라스 여러 장 + 프레임 데이터(JS/JSON) + data/runtime-assets.json 갱신.
측정값(칼 닿는 칸, 갈고리 손 떠나는 칸, 사슬이 칸 밖으로 나가는 위치·각도, 고기 착지 칸 …)은 marks 에 기록한다.
"""
import hashlib
import io
import json
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'assets_src' / 'gorath_remake' / 'gorath'
JSON_OUT = ROOT / 'data' / 'gorath_remake.json'
JS_OUT = ROOT / 'gorath-remake-art.js'
MANIFEST = ROOT / 'data' / 'runtime-assets.json'
OUT = ROOT / 'tools' / 'out'
# 기준 키 H: 기존 고라스 대기 1번 프레임(gorath-art.js clips.idle[0], 높이 277px) × 아틀라스 배율 .5 × BOSS_VISUAL_SCALE .85
H = 277 * .5 * .85
QUALITY = 90                     # 기존 캐릭터 시트와 같은 손실 WebP 품질
PAGE = 2048                      # 한 장이 400만 픽셀을 넘으면 게임이 프레임마다 따로 잘라 그리는 느린 경로를 탄다
S8 = np.ones((3, 3))

# id: (파일, 열, 행, 사용 프레임 수, 아틀라스 묶음)
SHEETS = {
    'intro_chop': ('gorath intro 1.png', 4, 4, 16, 'p1'),
    'intro_smash': ('gorath intro 3.png', 4, 4, 16, 'p1'),
    'p1_idle': ('gorth idle.png', 4, 3, 10, 'p1'),
    'p1_walk': ('gorath walk.png', 4, 3, 10, 'p1'),
    'p1_chop': ('gorath attack1 10f.png', 4, 3, 10, 'p1'),
    'p1_thrust': ('gorath attack2 10f.png', 4, 3, 10, 'p1'),
    'p1_tackle': ('gorath attack3 10f.png', 4, 3, 10, 'p1'),
    'p1_sweep': ('gorath attack3 16f.png', 4, 4, 16, 'p1'),
    'p1_hook': ('gorath hook 16f.png', 4, 4, 16, 'p1'),
    'p1_hook_pull': ('gorath grap 5f.png', 4, 2, 5, 'p1'),
    'p1_hit': ('gorath hit 10f.png', 4, 3, 10, 'p1'),
    'p1_knockdown': ('gorath knockdown 16f.png', 4, 4, 16, 'p1'),
    'p1_getup': ('gorath standing 10f.png', 4, 3, 10, 'p1'),
    'transform': ('gorath transform 16f.png', 4, 4, 16, 'p2'),
    'p2_idle': ('gorath 2페이즈 idle 10f.png', 4, 3, 10, 'p2'),
    'p2_walk': ('gorath 2페이즈 walk 10f.png', 4, 3, 10, 'p2'),
    'p2_double_chop': ('gorath 2페이즈 attack1 16f.png', 4, 4, 16, 'p2'),
    'p2_punch': ('gorath 2페이즈 attack2 16f.png', 4, 4, 16, 'p2'),
    'p2_charge': ('gorath 2페이즈 attack3 16f.png', 4, 4, 16, 'p2'),
    'p2_hook': ('gorath 2페이즈 hook 16f.png', 4, 4, 16, 'p2'),
    'p2_hook_pull': ('gorath 2페이즈 grab 2f.png', 2, 1, 2, 'p2'),
    'p2_hit_high': ('gorath 2페이즈 hit 10f.png', 4, 3, 10, 'p2'),
    'p2_hit_low': ('gorath 2페이즈 hit2 10f.png', 4, 3, 10, 'p2'),
    'p2_knockdown': ('gorath 2페이즈 knockdown 16f.png', 4, 4, 16, 'p2'),
    'p2_getup': ('gorath 2페이즈 standing 10f.png', 4, 3, 10, 'p2'),
    'p2_ult_cast': ('gorath 2페이즈 ultimate 16f.png', 4, 4, 16, 'p2'),
    'p2_ult_shake': ('gorath 2페이즈 shaking 10f.png', 4, 3, 10, 'p2'),
    'death': ('고라스 2페이즈 death 16f.png', 4, 4, 16, 'p2'),
    'meat_carcass': ('meat1 falling 16f.png', 4, 4, 16, 'fx'),
    'meat_bundle': ('meat2 falling 16f.png', 4, 4, 16, 'fx'),
    'meat_bone': ('meat3 falling 12f.png', 4, 3, 12, 'fx'),
    'hook': ('hook.png', 1, 1, 1, 'p1'),
    'chain': ('chain.png', 1, 1, 1, 'p1'),
}
MEATS = {'meat_carcass': .85, 'meat_bundle': .45, 'meat_bone': .45}   # 1번 칸 고기 길이 = H × 이 값
# 기준 프레임(1부터). 표에 없으면 1번. 고정 기준점 동작은 이 프레임의 발 위치를 피벗으로 쓴다
REF = {'p1_getup': 10, 'p2_getup': 10, 'intro_smash': 16}
FIXED = ('p1_knockdown', 'p2_knockdown', 'death', 'p1_getup', 'p2_getup')
# 배율을 다른 시트의 프레임에 맞추는 동작: (대상 시트, 프레임, 방법)
#   same  = 그 시트와 같은 배율 / legs = 발바닥~허리 아래 실루엣이 가장 잘 겹치는 배율
SCALE_LIKE = {'intro_chop': ('intro_smash', 1, 'height'), 'p2_ult_shake': ('p2_ult_cast', 16, 'legs'),
              'p1_hook_pull': ('p1_hook', 16, 'legs'), 'p2_hook_pull': ('p2_hook', 16, 'same'),
              'hook': ('p1_idle', 1, 'same'), 'chain': ('p1_idle', 1, 'same')}
# 눈으로 확인하고 고친 배율 보정(시트 배율에 곱한다). scale_check.png 로 확인.
SCALE_FIX = {}
# 손에서 떨어져 나간 사슬·갈고리 지우기. thin = 이 x 부터 오른쪽에서 가는(반지름 r 이하) 것만 지움,
# cut = 이 x 부터 찾은 주먹 끝(세로 두께가 팔뚝의 45% 아래로 줄어드는 곳)의 오른쪽 전부, at = 이 x 의 오른쪽 전부(눈으로 잰 주먹 끝)
CHAIN_ERASE = {
    'p1_hook': {f: ('thin', 238, 7) for f in range(9, 17)},
    'p1_hook_pull': {f: ('cut', 240) for f in range(1, 6)},
    'p2_hook': {9: ('at', 306), 10: ('cut', 290), **{f: ('cut', 300) for f in range(11, 17)}},
    'p2_hook_pull': {1: ('cut', 250), 2: ('cut', 250)},
}
# 판정 프레임(1부터): 칼날·주먹이 닿는 칸. 처리한 그림에서 그 칸들의 앞 끝(tip)·뒤 끝(back)을 재서 판정 상자를 만든다
HITS = {'p1_chop': [[7, 8]], 'p1_thrust': [[6, 9]], 'p1_tackle': [[6, 9]], 'p1_sweep': [[10, 13]],
        'p2_double_chop': [[7, 8], [12, 13]], 'p2_punch': [[9, 11]], 'p2_charge': [[6, 12]]}
LAND_RATIO = {'p1_knockdown': .73, 'p2_knockdown': .73, 'death': .73}
INTRO_EYES = [(195, 141), (205, 141)]   # intro_smash 2번 칸의 투구 눈 위치(칸 좌표, 눈으로 잰 값)


def webp(img):
    buf = io.BytesIO(); img.save(buf, 'WEBP', quality=QUALITY, method=6, exact=True)
    data = buf.getvalue()
    return f'assets/runtime/{hashlib.sha256(data).hexdigest()[:24]}.webp', data


def grid(name, cols, rows, n):
    a = np.asarray(Image.open(SRC / name).convert('RGBA'))
    ch, cw = a.shape[0] // rows, a.shape[1] // cols
    cells = [a[r * ch:(r + 1) * ch, c * cw:(c + 1) * cw].copy() for r in range(rows) for c in range(cols)][:n]
    for c in cells: c[c[..., 3] < 128] = 0
    return cells


def opaque(c): return c[..., 3] > 0


def degreen(c):
    """초록 키 잔여물: G 가 R·B 보다 뚜렷이 큰 픽셀을 투명하게, 그 둘레 2px 의 초록 번짐은 G 를 낮춘다. 지운 픽셀 수를 돌려준다."""
    r, g, b = (c[..., k].astype(int) for k in range(3))
    mx = np.maximum(r, b)
    m = opaque(c) & (g > r + 20) & (g > b + 10) & (g * 5 >= mx * 6)
    c[m] = 0
    near = ndimage.binary_dilation(m, structure=S8, iterations=2) & opaque(c)
    spill = near & (g > mx + 3)
    c[..., 1][spill] = mx[spill]
    return int(m.sum())


def main_blob(c, m=None):
    m = opaque(c) if m is None else m
    lab, n = ndimage.label(m, structure=S8)
    if n < 2: return m
    sizes = ndimage.sum_labels(np.ones_like(lab), lab, index=range(1, n + 1))
    return lab == int(np.argmax(sizes)) + 1


def drop_specks(c, limit=12):
    """떨어져 있는 아주 작은 점(limit px 미만)을 지운다."""
    lab, n = ndimage.label(opaque(c), structure=S8)
    if n < 2: return 0
    sizes = ndimage.sum_labels(np.ones_like(lab), lab, index=range(1, n + 1))
    small = np.flatnonzero(sizes < limit) + 1
    kill = np.isin(lab, small)
    c[kill] = 0
    return int(kill.sum())


def strip_intruders(c):
    """옆 칸 그림이 경계를 넘어 들어온 조각: 칸 가장자리에 닿은, 본체와 떨어진 작은 덩어리(전체의 1.5% 미만)를 지운다."""
    lab, n = ndimage.label(opaque(c), structure=S8)
    if n < 2: return 0
    sizes = ndimage.sum_labels(np.ones_like(lab), lab, index=range(1, n + 1))
    total, biggest = sizes.sum(), int(np.argmax(sizes)) + 1
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0, biggest}
    gone = 0
    for i in edge:
        if sizes[i - 1] < total * .015: c[lab == i] = 0; gone += int(sizes[i - 1])
    return gone


def erase_chain(c, rule):
    """던지기·끌어당기기 시트의 손 바깥쪽 사슬·갈고리. 지운 픽셀 수와 손(주먹 끝) 위치(칸 좌표)를 돌려준다."""
    m = opaque(c); before = int(m.sum())
    h, w = m.shape
    if rule[0] == 'thin':
        _, x0, r = rule
        yy, xx = np.ogrid[-r:r + 1, -r:r + 1]
        disk = xx * xx + yy * yy <= r * r
        thick = ndimage.binary_dilation(ndimage.binary_opening(m, structure=disk), structure=S8, iterations=2) & m
        kill = m & ~thick; kill[:, :x0] = False
        c[kill] = 0
    elif rule[0] == 'at':
        c[:, rule[1]:] = 0
    else:
        x0 = rule[1]
        col = m.sum(0)
        peak = col[x0:x0 + 60].max()                 # 팔뚝·주먹의 세로 두께
        x = x0 + int(np.argmax(col[x0:x0 + 60]))
        while x < w and col[x] >= peak * .45: x += 1  # 주먹이 끝나고 사슬(가는 부분)이 시작되는 곳
        c[:, x:] = 0
    keep = main_blob(c)                              # 잘려 떨어진 조각
    lab, n = ndimage.label(opaque(c) & ~keep, structure=S8)
    for i in range(1, n + 1):
        ys, xs = np.nonzero(lab == i)
        if xs.mean() >= (rule[1] - 100) and ys.max() < h * .8: c[lab == i] = 0
    m = opaque(c)
    from_x = rule[1] - 80                              # 손(주먹 끝) = 팔 높이에서 가장 오른쪽 불투명 픽셀
    xs = np.nonzero(m[:int(h * .8), from_x:].any(0))[0]
    hx = from_x + int(xs.max())
    ys = np.nonzero(m[:int(h * .8), hx - 9:hx + 1].any(1))[0]
    return before - int(m.sum()), (hx - 4, float(np.median(ys)))


def clean_hook(c):
    """hook.png: 불투명 픽셀로 구워진 체크무늬 배경(R=G=B 회색)을 지운다."""
    r, g, b = (c[..., k].astype(int) for k in range(3))
    m = opaque(c) & (r == g) & (g == b) & (r >= 100)
    c[m] = 0
    c[~main_blob(c)] = 0
    return int(m.sum())


SHADOW_FRAMES = {'meat_carcass': range(4, 8), 'meat_bundle': range(3, 17)}   # 그림자 색 픽셀을 지우는 칸(1부터)


def meat_shadow(cid, cells):
    """고기 시트의 구워진 바닥 그림자: 채도가 낮은 어두운 회색(meat1)·올리브색(meat2) 픽셀 덩어리를 지운다. 지운 픽셀 수(칸별).
    (착지 전 칸에서 고기보다 완전히 아래에 떨어져 있는 덩어리는 main 에서 따로 지운다.)"""
    gone = []
    for n, c in enumerate(cells):
        if n + 1 not in SHADOW_FRAMES.get(cid, ()): gone.append(0); continue
        n0 = int(opaque(c).sum())
        r, g, b = (c[..., k].astype(int) for k in range(3))
        mx, mn = np.maximum(np.maximum(r, g), b), np.minimum(np.minimum(r, g), b)
        grey = opaque(c) & (mx - mn <= 26) & (mx >= 55) & (mx <= 150) & (r <= g + 14)      # 회색 타원(meat1)
        olive = opaque(c) & (g >= r) & (g > b + 8) & (mx <= 110)                           # 올리브색 타원(meat2)
        lab, n = ndimage.label(grey | olive, structure=S8)
        if n:
            sizes = ndimage.sum_labels(np.ones_like(lab), lab, index=range(1, n + 1))
            for i in np.flatnonzero(sizes >= 40) + 1: c[lab == i] = 0
        gone.append(n0 - int(opaque(c).sum()))
    return gone


def meat_bottoms(cells):
    """칸마다 가장 큰 덩어리(고기)의 bbox."""
    out = []
    for c in cells:
        ys, xs = np.nonzero(main_blob(c))
        out.append((int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())))
    return out


def feret(mask):
    """덩어리의 가장 긴 길이(px)."""
    ys, xs = np.nonzero(mask)
    best = 0
    for deg in range(0, 180, 5):
        t = math.radians(deg); p = xs * math.cos(t) + ys * math.sin(t)
        best = max(best, p.max() - p.min() + 1)
    return best


def body_box(c):
    ys, xs = np.nonzero(main_blob(c))
    return int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())


def torso_x(c, ground, hpx):
    """몸통 중심 x: 지면선에서 위로 35~75% 높이 줄의 불투명 픽셀 x 중앙값."""
    m = opaque(c)
    y0, y1 = max(0, int(ground - .75 * hpx)), max(1, int(ground - .35 * hpx))
    xs = np.nonzero(m[y0:y1 + 1])[1]
    if len(xs) < 50: xs = np.nonzero(m)[1]
    return float(np.median(xs))


def smooth(cx, limit=10):
    out = list(cx)
    for i in range(len(cx)):
        nb = [cx[j] for j in (i - 1, i + 1) if 0 <= j < len(cx)]
        avg = sum(nb) / len(nb)
        if abs(cx[i] - avg) > limit: out[i] = avg
    return out


def resized_mask(m, s):
    im = Image.fromarray((m * 255).astype(np.uint8)).resize((max(1, round(m.shape[1] * s)), max(1, round(m.shape[0] * s))), Image.BILINEAR)
    return np.asarray(im) > 127


def legs_scale(a, b):
    """a 를 몇 배 하면 b 의 다리(발바닥~키의 45%)와 가장 잘 겹치는가. 발바닥 줄을 맞추고 가로는 가장 잘 겹치는 위치."""
    mb = main_blob(b); yb, xb = np.nonzero(mb); fb, hb = yb.max(), yb.max() - yb.min() + 1
    leg = int(hb * .45); B = mb[fb - leg + 1:fb + 1]
    ma = main_blob(a); best = (0, 1)
    for s in np.arange(.6, 1.9, .01):
        A = resized_mask(ma, s); ya = np.nonzero(A)[0]; fa = ya.max()
        if fa - leg + 1 < 0: continue
        A = A[fa - leg + 1:fa + 1]
        pa, pb = A.sum(0), B.sum(0)                      # 세로 합 프로파일끼리 상관 → 가로 위치
        W = A.shape[1] + B.shape[1]
        big = np.zeros((leg, W * 2), bool); big[:, W:W + B.shape[1]] = B
        corr = np.correlate(np.pad(pb, (W, W - B.shape[1])).astype(float), pa.astype(float), 'valid')
        sh = int(np.argmax(corr))
        cand = np.zeros_like(big); cand[:, sh:sh + A.shape[1]] = A[:, :min(A.shape[1], big.shape[1] - sh)]
        iou = (cand & big).sum() / max(1, (cand | big).sum())
        if iou > best[0]: best = (iou, float(s))
    return best[1], best[0]


def steel_y(c, region=None):
    """칼날(밝고 채도 낮은 강철색) 픽셀의 무게중심 y 와 가장 낮은 y. region = (x0, y0, x1, y1)."""
    r, g, b = (c[..., k].astype(int) for k in range(3))
    mx, mn = np.maximum(np.maximum(r, g), b), np.minimum(np.minimum(r, g), b)
    m = opaque(c) & (mn >= 150) & (mx - mn <= 45)
    if region: x0, y0, x1, y1 = region; keep = np.zeros_like(m); keep[y0:y1, x0:x1] = True; m &= keep
    m = ndimage.binary_opening(m, structure=np.ones((3, 3)))
    ys = np.nonzero(m)[0]
    return (float(ys.mean()), int(ys.max()), int(m.sum())) if len(ys) else (0, 0, 0)


def chain_exit(c):
    """흔들기·시전 칸에서 사슬이 칸 밖으로 나가는 곳(위·오른쪽 가장자리)과 방향(도, 오른쪽=0·위=90)."""
    m = main_blob(c); h, w = m.shape
    border = np.zeros_like(m); border[:2] = True; border[:, -2:] = True
    ys, xs = np.nonzero(m & border)
    if len(xs): ex, ey = float(xs.mean()), float(ys.mean())
    else:                                            # 사슬이 칸 안에서 끝난다(시전 16번): 오른쪽 위로 가장 멀리 뻗은 끝
        ys, xs = np.nonzero(m); i = int(np.argmax(xs - ys)); ex, ey = float(xs[i]), float(ys[i])
    yy, xx = np.nonzero(m)
    d = np.hypot(xx - ex, yy - ey)
    sel = (d >= 4) & (d <= 38)
    px, py = xx[sel].astype(float), yy[sel].astype(float)
    cov = np.cov(np.vstack([px - px.mean(), py - py.mean()]))
    vals, vecs = np.linalg.eigh(cov)
    vx, vy = vecs[:, int(np.argmax(vals))]
    if (ex - px.mean()) * vx + (ey - py.mean()) * vy < 0: vx, vy = -vx, -vy   # 바깥쪽을 향하게
    return ex, ey, math.degrees(math.atan2(-vy, vx))


def tips(c, px, ground, k):
    """피벗 기준(월드 px): tip = 몸 키 20% 위에서 가장 앞 [앞 거리, 높이], back = 가장 뒤, low = 앞쪽 끝 30px 구간의 가장 낮은 높이."""
    ys, xs = np.nonzero(opaque(c))
    hgt = (ground - ys) * k
    up = hgt >= .2 * H
    if not up.any(): return None, None
    i, j = np.flatnonzero(up)[np.argmax(xs[up])], np.flatnonzero(up)[np.argmin(xs[up])]
    return [round((xs[i] - px) * k, 1), round(float(hgt[i]), 1)], [round((xs[j] - px) * k, 1), round(float(hgt[j]), 1)]


def pack(frames):
    """프레임(높이 순) → PAGE x PAGE 이하 여러 장. frames = [{'img': RGBA 배열, ...}]. 각 프레임에 'page', 'atlas' 를 채운다."""
    pages, cur, x, y, rowh = [], [], 0, 0, 0
    for f in sorted(frames, key=lambda f: -f['img'].shape[0]):
        hh, ww = f['img'].shape[:2]
        if x + ww > PAGE: x, y, rowh = 0, y + rowh + 2, 0
        if y + hh > PAGE: pages.append(cur); cur, x, y, rowh = [], 0, 0, 0
        f['page'] = len(pages); f['atlas'] = [x, y, ww, hh]; cur.append(f)
        x += ww + 2; rowh = max(rowh, hh)
    pages.append(cur)
    out = []
    for fs in pages:
        w = max(f['atlas'][0] + f['atlas'][2] for f in fs); h = max(f['atlas'][1] + f['atlas'][3] for f in fs)
        a = np.zeros((h, w, 4), np.uint8)
        for f in fs: ax, ay, ww, hh = f['atlas']; a[ay:ay + hh, ax:ax + ww] = f['img']
        out.append(Image.fromarray(a, 'RGBA'))
    return out


def main():
    preview = Path(sys.argv[sys.argv.index('--preview') + 1]) if '--preview' in sys.argv else None
    if preview: preview.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    report = {'green': {}, 'specks': {}, 'intruders': {}, 'shadow': {}, 'chain': {}}
    marks = {}
    cells, hands = {}, {}
    # ---------------------------------------------------------------- 1~3. 자르기 · 지우기
    for cid, (name, cols, rows, n, _) in SHEETS.items():
        cs = [c for c in grid(name, cols, rows, n) if opaque(c).sum() >= 50]
        if cid == 'hook': report['hook_checker'] = clean_hook(cs[0])
        g = [degreen(c) for c in cs]
        if sum(g): report['green'][cid] = g
        if cid in MEATS:
            sh = meat_shadow(cid, cs)
            if sum(sh): report['shadow'][cid] = sh
        if cid not in MEATS and cid not in ('hook', 'chain'):
            it = [strip_intruders(c) for c in cs]
            if sum(it): report['intruders'][cid] = it
            sp = [drop_specks(c) for c in cs]
            if sum(sp): report['specks'][cid] = sp
        if cid in CHAIN_ERASE:
            hands[cid] = {}
            for f, rule in CHAIN_ERASE[cid].items():
                gone, hand = erase_chain(cs[f - 1], rule)
                report['chain'].setdefault(cid, {})[f] = gone; hands[cid][f] = hand
        cells[cid] = cs
    # 흔들기 칸의 떠 있는 사슬 조각(본체와 떨어진 것)
    for cid in ('p2_ult_shake', 'p2_ult_cast'):
        for c in cells[cid]:
            keep = ndimage.binary_dilation(main_blob(c), structure=S8, iterations=6)
            lab, n = ndimage.label(opaque(c) & ~keep, structure=S8)
            for i in range(1, n + 1):
                ys, xs = np.nonzero(lab == i)
                if ys.max() < c.shape[0] * .45: c[lab == i] = 0
    # ---------------------------------------------------------------- 고기: 착지 칸 · 떠 있는 그림자
    for cid in MEATS:
        cs = cells[cid]; boxes = meat_bottoms(cs)
        bottoms = [b[3] for b in boxes]
        # 착지 칸 = 낙하가 멈추는 첫 칸(그 뒤 세 칸의 바닥이 8px 넘게 더 내려가지 않는다). 지면선 = 그 칸의 고기 바닥 y
        # (뒤쪽 칸은 피 웅덩이가 고기와 붙어 바닥이 더 내려가므로 마지막 칸 기준으로 재지 않는다)
        land = next(i for i in range(len(bottoms) - 3) if bottoms[i] >= max(bottoms[i + 1:i + 4]) - 8)
        marks[cid] = {'land': land + 1, 'bottoms': bottoms}
        extra = 0
        for i in range(land):                           # 착지 전: 고기보다 완전히 아래에 있는 덩어리 = 구워진 그림자·바닥 선
            body = main_blob(cs[i]); lab, n = ndimage.label(opaque(cs[i]) & ~body, structure=S8)
            for j in range(1, n + 1):
                ys, xs = np.nonzero(lab == j)
                if ys.min() > boxes[i][3] + 6 or ys.max() >= bottoms[land] - 10: cs[i][lab == j] = 0; extra += len(ys)
        if extra: report['shadow'][cid + '_below'] = extra
    # ---------------------------------------------------------------- 4. 배율
    refh, scale = {}, {}
    for cid, cs in cells.items():
        if cid in MEATS or cid in SCALE_LIKE: continue
        x0, y0, x1, y1 = body_box(cs[REF.get(cid, 1) - 1])
        refh[cid] = y1 - y0 + 1; scale[cid] = H / refh[cid]
    for cid, (other, f, how) in SCALE_LIKE.items():
        if how == 'same': scale[cid] = scale[other]
        elif how == 'height':                           # 같은 자세(탁자 앞)의 몸 키가 같아지게
            ha = body_box(cells[cid][0]); hb = body_box(cells[other][f - 1])
            scale[cid] = scale[other] * (hb[3] - hb[1] + 1) / (ha[3] - ha[1] + 1)
        else:
            s, iou = legs_scale(cells[cid][0], cells[other][f - 1])
            scale[cid] = scale[other] * s; report.setdefault('legs_match', {})[cid] = [round(s, 3), round(iou, 3)]
    for cid, part in MEATS.items():
        scale[cid] = part * H / feret(main_blob(cells[cid][0]))
    for cid, fix in SCALE_FIX.items(): scale[cid] *= fix
    # ---------------------------------------------------------------- 5. 피벗
    pivots = {}
    for cid, cs in cells.items():
        k = scale[cid]; hpx = H / k
        if cid in ('hook', 'chain'):
            x0, y0, x1, y1 = body_box(cs[0])
            pivots[cid] = [((x0 if cid == 'chain' else x0 + 6), (y0 + y1) / 2 if cid == 'chain' else y0 + 13)]   # 갈고리: 고리(사슬이 걸리는 곳) 중심
            continue
        if cid in MEATS:
            land = marks[cid]['land'] - 1; x0, y0, x1, y1 = meat_bottoms(cs)[land]
            pivots[cid] = [((x0 + x1) / 2, y1 + 1)] * len(cs)
            continue
        feet = [int(np.nonzero(opaque(c))[0].max()) for c in cs]
        if cid in FIXED:
            r = REF.get(cid, 1) - 1
            pivots[cid] = [(torso_x(cs[r], feet[r], hpx), feet[r] + 1)] * len(cs)
            continue
        ground = float(np.median(feet))
        cx = smooth([torso_x(c, ground, hpx) for c in cs])
        pivots[cid] = [(x, ground + 1) for x in cx]
    # ---------------------------------------------------------------- 측정해서 기록하는 프레임
    T = cells['intro_chop']; hb = body_box(T[0])
    blade = [steel_y(c, (0, 0, c.shape[1], int(c.shape[0] * .72))) for c in T]
    ys = [b[0] for b in blade]
    marks['intro_chop'] = {'bladeY': [round(y, 1) for y in ys],
                           'hit': [i + 1 for i in range(len(ys)) if ys[i] >= ys[i - 1] and ys[i] > ys[(i + 1) % len(ys)] and ys[i] >= max(ys) * .85]}
    S = cells['intro_smash']
    sb = [steel_y(S[i]) for i in (5, 6)]
    marks['intro_smash'] = {'bladeY': {6: sb[0][:2], 7: sb[1][:2]}, 'hit': 6 if sb[0][1] > sb[1][1] else 7}
    for cid in ('p1_hook', 'p2_hook'):
        raw = grid(*SHEETS[cid][:4])
        marks[cid] = {'release': next(i + 1 for i, c in enumerate(raw) if i >= 4 and opaque(c)[:int(c.shape[0] * .7), -3:].any())}
    # 흔들기: 왼손(사슬을 쥔 손) 높이 = 몸 왼쪽 절반의 가장 높은 불투명 픽셀. 가장 낮은 칸 = 잡아당기는 칸
    K = cells['p2_ult_shake']; hand_top = []
    for c, (px, gy) in zip(K, pivots['p2_ult_shake']):
        m = opaque(c); hand_top.append(int(np.nonzero(m[:, :int(px)].any(1))[0].min()))
    lowest = max(hand_top)
    marks['p2_ult_shake'] = {'handTop': hand_top, 'pull': [i + 1 for i, y in enumerate(hand_top) if y >= lowest - 2 and (i == 0 or hand_top[i - 1] < lowest - 2)]}
    # 회수 끝 칸: p2_ult_cast 9·10·11 중 p2_idle 1번과 실루엣이 가장 비슷한 칸
    def sil(cid, f):
        c = cells[cid][f]; px, gy = pivots[cid][f]; m = resized_mask(opaque(c), scale[cid] / scale['p2_idle'])
        s = scale[cid] / scale['p2_idle']; canvas = np.zeros((420, 520), bool)
        ox, oy = int(260 - px * s), int(400 - gy * s)
        ys_, xs_ = np.nonzero(m); ok = (ys_ + oy >= 0) & (ys_ + oy < 420) & (xs_ + ox >= 0) & (xs_ + ox < 520)
        canvas[ys_[ok] + oy, xs_[ok] + ox] = True; return canvas
    idle = sil('p2_idle', 0)
    sim = {f: round(float((sil('p2_ult_cast', f - 1) & idle).sum() / (sil('p2_ult_cast', f - 1) | idle).sum()), 3) for f in (9, 10, 11)}
    marks['p2_ult_cast'] = {'idleIoU': sim, 'recoverEnd': max(sim, key=sim.get)}
    for cid in ('p1_knockdown', 'p2_knockdown', 'death'):
        # 몸이 바닥에 닿는 첫 칸: 불투명 픽셀 무게중심의 높이(지면선 기준)가 서 있을 때(1번 칸)의 LAND_RATIO 아래로 내려오는 첫 칸
        cs = cells[cid]; gy = pivots[cid][0][1]
        hh = [round(float(gy - np.nonzero(opaque(c))[0].mean()), 1) for c in cs]
        marks[cid] = {'massH': hh, 'land': next((i + 1 for i, v in enumerate(hh) if v < hh[0] * LAND_RATIO[cid]), len(cs))}
    # ---------------------------------------------------------------- 저장
    frames, clips = [], {}
    for cid, cs in cells.items():
        k = scale[cid]; ids = []
        for n, (c, (px, gy)) in enumerate(zip(cs, pivots[cid])):
            ys, xs = np.nonzero(opaque(c)); x0, y0, x1, y1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
            if cid == 'chain': y0, y1 = 0, c.shape[0]; x0, x1 = xs.min(), xs.max() + 1
            f = {'img': c[y0:y1, x0:x1], 'anchor': [round(float(px - x0), 1), round(float(gy - y0), 1)], 'clip': cid, 'n': n, 'cell': c, 'pivot': (px, gy)}
            if cid not in MEATS and cid not in ('hook', 'chain'): f['tip'], f['back'] = tips(c, px, gy, k)
            if cid in hands and n + 1 in hands[cid]:
                hx, hy = hands[cid][n + 1]; f['hand'] = [round((hx - px) * k, 1), round((gy - hy) * k, 1)]
            if cid in ('p2_ult_shake', 'p2_ult_cast') and (cid == 'p2_ult_shake' or n == 15):
                ex = chain_exit(c)
                if ex: f['chain'] = [round((ex[0] - px) * k, 1), round((gy - ex[1]) * k, 1), round(ex[2], 1)]
            frames.append(f); ids.append(f)
        clips[cid] = ids
    groups = {}
    for f in frames: groups.setdefault(SHEETS[f['clip']][4], []).append(f)
    files, page_names = {}, []
    for gname, fs in groups.items():
        base = len(page_names)
        for im in pack(fs):
            name, data = webp(im); files[name] = data; page_names.append(name)
            print(f'page {gname}: {im.size} {len(data) // 1024} KB')
        for f in fs: f['page'] += base
    eyes = None
    if INTRO_EYES:
        px, gy = pivots['intro_smash'][1]; k = scale['intro_smash']
        eyes = [[round((x - px) * k, 1), round((gy - y) * k, 1)] for x, y in INTRO_EYES]
    result = {'H': round(H, 2), 'pages': page_names, 'marks': {**marks, 'introEyes': eyes}, 'hits': {}, 'clips': {}}
    for cid, fs in clips.items():
        out = []
        for f in fs:
            o = {'p': f['page'], 'atlas': f['atlas'], 'anchor': f['anchor']}
            for key in ('tip', 'back', 'hand', 'chain'):
                if f.get(key): o[key] = f[key]
            out.append(o)
        result['clips'][cid] = {'k': round(scale[cid], 5), 'frames': out}
    for cid, spans in HITS.items():                      # 판정 상자: 판정 칸들의 앞 끝 최댓값, 뒤 끝 최솟값, 높이 범위
        boxes = []
        for a, b in spans:
            fs = clips[cid][a - 1:b]
            boxes.append({'f': [a, b], 'reach': max(f['tip'][0] for f in fs), 'back': min(f['back'][0] for f in fs)})
        result['hits'][cid] = boxes
    # ---------------------------------------------------------------- 확인용 그림
    scale_check(cells, scale, pivots)
    if preview: previews(preview, clips, scale)
    previous = json.loads(JSON_OUT.read_text(encoding='utf-8')) if JSON_OUT.exists() else {}
    stale = set(previous.get('pages', [])) - set(files)
    for n, data in files.items():
        if not (ROOT / n).exists(): (ROOT / n).write_bytes(data)
    # 이전 아틀라스 파일은 다른 작업에서 참조할 수 있으므로 삭제하지 않는다.
    JSON_OUT.write_text(json.dumps(result, ensure_ascii=False) + '\n', encoding='utf-8')
    JS_OUT.write_text("'use strict';\n// tools/gorath_remake.py 가 만든다 (data/gorath_remake.json 과 같은 내용). 직접 고치지 말 것.\n"
                      f'const GORATH2_ART = {json.dumps(result, ensure_ascii=False)};\n', encoding='utf-8')
    manifest = set(json.loads(MANIFEST.read_text(encoding='utf-8')))
    MANIFEST.write_text(json.dumps(sorted((manifest - stale) | set(files)), indent=2) + '\n', encoding='utf-8')
    summary = {'H': round(H, 2), 'scale': {c: round(s, 4) for c, s in scale.items()}, 'refHeightPx': refh, 'marks': marks, 'removed': report,
               'hits': result['hits'], 'frames': len(frames), 'bytes': sum(map(len, files.values()))}
    (OUT / 'gorath_remake_report.json').write_text(json.dumps(summary, ensure_ascii=False, indent=1, default=str) + '\n', encoding='utf-8')
    print(json.dumps(summary, ensure_ascii=False, default=str))


def scale_check(cells, scale, pivots):
    """p1_idle 1번과 각 시트 기준 프레임을 같은 배율(월드 px × 2)로 나란히 놓는다. 가로선 = 지면과 키 H."""
    Z = 2; names = [c for c in cells if c not in ('hook', 'chain')]
    cw, chh = 300, 330; cols = 8; rows = (len(names) * 2 + cols - 1) // cols
    sheet = Image.new('RGBA', (cols * cw, rows * chh), (58, 58, 80, 255)); d = ImageDraw.Draw(sheet)
    def put(slot, cid, f, label):
        c = cells[cid][f]; px, gy = pivots[cid][f]; s = scale[cid] * Z
        im = Image.fromarray(c, 'RGBA').resize((max(1, round(c.shape[1] * s)), max(1, round(c.shape[0] * s))), Image.NEAREST)
        ox, oy = (slot % cols) * cw, (slot // cols) * chh; gx, gyy = ox + cw // 2, oy + chh - 30
        d.line([(ox, gyy), (ox + cw, gyy)], fill=(0, 255, 0)); d.line([(ox, gyy - H * Z), (ox + cw, gyy - H * Z)], fill=(255, 220, 0))
        tile = Image.new('RGBA', (cw, chh)); tile.alpha_composite(im, (max(0, round(cw // 2 - px * s)), max(0, round(chh - 30 - gy * s))),
                                                                   (max(0, round(px * s - cw // 2)), max(0, round(gy * s - chh + 30))))
        sheet.alpha_composite(tile, (ox, oy)); d.text((ox + 4, oy + 4), label, fill=(255, 255, 255))
    for i, cid in enumerate(names):
        put(i * 2, 'p1_idle', 0, 'p1_idle 1')
        f = marks_ref(cid, cells)
        put(i * 2 + 1, cid, f, f'{cid} {f + 1}  k={scale[cid]:.3f}')
    sheet.convert('RGB').save(OUT / 'scale_check.png')


def marks_ref(cid, cells):
    if cid in SCALE_LIKE and SCALE_LIKE[cid][2] != 'same': return 0
    return REF.get(cid, 1) - 1


def previews(out, clips, scale):
    for cid, fs in clips.items():
        ch, cw = fs[0]['cell'].shape[:2]; cols = min(8, len(fs)); rows = (len(fs) + cols - 1) // cols
        sheet = Image.new('RGBA', (cw * cols, ch * rows), (70, 70, 95, 255)); d = ImageDraw.Draw(sheet); k = scale[cid]
        for n, f in enumerate(fs):
            ox, oy = (n % cols) * cw, (n // cols) * ch
            if (n % cols + n // cols) % 2: d.rectangle([ox, oy, ox + cw - 1, oy + ch - 1], fill=(92, 92, 118, 255))
            sheet.alpha_composite(Image.fromarray(f['cell'], 'RGBA'), (ox, oy)); px, gy = f['pivot']
            d.line([(ox + px, oy), (ox + px, oy + ch)], fill=(0, 255, 0)); d.line([(ox, oy + gy), (ox + cw, oy + gy)], fill=(0, 255, 0))
            for key, col in (('tip', (255, 0, 0)), ('back', (255, 140, 0)), ('hand', (255, 255, 0))):
                if f.get(key):
                    tx, ty = ox + px + f[key][0] / k, oy + gy - f[key][1] / k
                    d.ellipse([tx - 5, ty - 5, tx + 5, ty + 5], outline=col, width=2)
            if f.get('chain'):
                tx, ty = ox + px + f['chain'][0] / k, oy + gy - f['chain'][1] / k; a = math.radians(f['chain'][2])
                d.line([(tx, ty), (tx - 60 * math.cos(a), ty + 60 * math.sin(a))], fill=(0, 255, 255), width=2)
            d.text((ox + 4, oy + 2), str(n + 1), fill=(255, 255, 0))
        sheet.convert('RGB').save(out / f'{cid}.png')


if __name__ == '__main__':
    main()
