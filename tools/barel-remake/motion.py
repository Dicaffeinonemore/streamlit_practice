"""Barel motions: each motion() returns 20 frames of {layer: image}, durations, cel opacities, extra layers."""
import sys, os, math, json
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rig import *

FRAMES = os.path.join(WORK, "_frames")
NF = 20
RIG = None


def rig():
    global RIG
    if RIG is None:
        RIG = Rig()
    return RIG


# ---------------------------------------------------------------- interpolation
def ease(t, kind="smooth"):
    t = min(max(t, 0.0), 1.0)
    if kind == "lin":
        return t
    if kind == "in":
        return t * t
    if kind == "out":
        return 1 - (1 - t) * (1 - t)
    if kind == "hold":
        return 0.0
    return t * t * (3 - 2 * t)


def kf(f, keys, kind="smooth"):
    """keys: [(frame, value[, ease])]; values may be numbers or tuples."""
    keys = sorted(keys, key=lambda k: k[0])
    if f <= keys[0][0]:
        return keys[0][1]
    for a, b in zip(keys, keys[1:]):
        if a[0] <= f <= b[0]:
            t = ease((f - a[0]) / max(b[0] - a[0], 1e-9), b[2] if len(b) > 2 else kind)
            va, vb = np.array(a[1], float), np.array(b[1], float)
            v = va + (vb - va) * t
            return tuple(v) if v.ndim else float(v)
    return keys[-1][1]


def add(a, b):
    return tuple(np.array(a, float) + np.array(b, float))


# ---------------------------------------------------------------- FX painters (full-canvas RGBA)
def blank():
    return np.zeros((N, N, 4), np.uint8)


def put(img, mask, col):
    img[mask, :3] = col; img[mask, 3] = 255


YY, XX = np.mgrid[0:N, 0:N].astype(float) + 0.5


def arc_slash(img, cx, cy, r, a0, a1, width, sy=1.0, core=True):
    """Crescent smear along a circle (angles in degrees, screen clockwise). Thickness peaks mid-arc."""
    dx, dy = XX - cx, (YY - cy) / sy
    rr = np.hypot(dx, dy)
    th = np.degrees(np.arctan2(dy, dx))
    lo, hi = min(a0, a1), max(a0, a1)
    th = np.where(th < lo - 180, th + 360, th); th = np.where(th > hi + 180, th - 360, th)
    s = (th - lo) / max(hi - lo, 1e-6)
    inside = (s >= 0) & (s <= 1)
    # thickness grows toward the leading edge (a1) then tapers sharply
    lead = s if a1 >= a0 else 1 - s
    w = width * np.clip(np.sin(np.pi * np.clip(lead, 0, 1) ** 0.7), 0, 1)
    d = r - rr  # depth inside the outer radius
    band = inside & (d >= 0) & (d <= w)
    put(img, band & (d > w * 0.62), P["fd"])
    put(img, band & (d <= w * 0.62), P["fr"])
    if core:
        put(img, band & (d <= w * 0.38), P["w2"])
        put(img, band & (d <= 1.2) & (w > 2.5), P["w"])
    return img


def ellipse_ring(img, cx, cy, rx, ry, th, cols):
    e = np.hypot((XX - cx) / max(rx, 1), (YY - cy) / max(ry, 1))
    for i, c in enumerate(cols):
        t0 = 1 - (i + 1) * th / max(rx, 1); t1 = 1 - i * th / max(rx, 1)
        put(img, (e <= t1) & (e > t0), c)
    return img


def disc(img, cx, cy, r, col):
    put(img, np.hypot(XX - cx, YY - cy) <= r, col); return img


def dust(img, cx, cy, age, n=5, spread=10.0, seed=0, size=4.0, dirx=0.0, rise=6.0):
    """Puffs that grow and darken with age (0..1)."""
    rs = np.random.RandomState(seed)
    for i in range(n):
        ox = (rs.rand() - 0.5) * 2 * spread + dirx * age * (6 + 6 * rs.rand())
        oy = -rs.rand() * rise * age - 1
        r = size * (0.6 + 0.6 * rs.rand()) * (0.6 + 0.8 * age) * (1.0 - 0.55 * age ** 2)
        if r < 0.8:
            continue
        x, y = cx + ox, cy + oy
        disc(img, x, y, r + 1, P["p1"] if age > 0.5 else P["p2"])
        disc(img, x - 0.4, y - 0.6, r, P["p3"] if age > 0.5 else P["p4"])
        if age < 0.45:
            disc(img, x - r * 0.35, y - r * 0.35, r * 0.45, P["p5"])
    return img


def debris(img, cx, cy, t, n=8, seed=1, speed=3.0, g=0.45, cols=("p2", "p3", "p4")):
    rs = np.random.RandomState(seed)
    for i in range(n):
        vx = (rs.rand() - 0.5) * 2 * speed * 1.6
        vy = -(1.5 + rs.rand() * speed)
        x = cx + vx * t; y = cy + vy * t + g * t * t
        if y > GROUND_F:
            continue
        s = 1 + (i % 2)
        c = P[cols[i % len(cols)]]
        xi, yi = int(x), int(y)
        if 0 <= xi < N - s and 0 <= yi < N - s:
            img[yi:yi + s, xi:xi + s, :3] = c; img[yi:yi + s, xi:xi + s, 3] = 255
            img[yi + s, xi:xi + s, :3] = P["o"]; img[yi + s, xi:xi + s, 3] = 255
    return img


def cracks(img, cx, cy, reach, seed=3, n=4, cols=("fd", "fr", "w")):
    rs = np.random.RandomState(seed)
    for side in (-1, 1):
        for i in range(n // 2):
            x, y = cx, cy
            L = reach * (0.55 + 0.45 * rs.rand())
            steps = int(L)
            jitter = 0
            for s in range(steps):
                x += side
                if rs.rand() < 0.3:
                    jitter += rs.choice([-1, 1])
                    jitter = max(-3, min(3, jitter))
                yy = int(cy + jitter + i * 2)
                xi = int(x)
                if 0 <= xi < N and 0 <= yy < N:
                    fade = s / max(steps, 1)
                    c = P[cols[2]] if fade < 0.25 else P[cols[1]] if fade < 0.6 else P[cols[0]]
                    img[yy, xi, :3] = c; img[yy, xi, 3] = 255
                    if fade < 0.4 and yy + 1 < N:
                        img[yy + 1, xi, :3] = P[cols[0]]; img[yy + 1, xi, 3] = 255
    return img


def speed_lines(img, x0, x1, ys, cols=("p4", "p3")):
    for i, y in enumerate(ys):
        a, b = int(x0[i % len(x0)]), int(x1[i % len(x1)])
        if b < a:
            a, b = b, a
        a, b = max(a, 0), min(b, N)
        img[int(y), a:b, :3] = P[cols[i % len(cols)]]; img[int(y), a:b, 3] = 255
    return img


def silhouette(layers, col, dx=0, dy=0):
    m = np.zeros((N, N), bool)
    for n in LAYERS:
        if n in layers:
            m |= layers[n][..., 3] > 0
    m = np.roll(np.roll(m, dx, 1), dy, 0)
    if dx > 0:
        m[:, :dx] = False
    elif dx < 0:
        m[:, dx:] = False
    out = blank(); put(out, m, col); return out


def glow(sword_img, level):
    """Crimson aura around the blade: level 0..1 grows the ring and brightens it."""
    out = blank()
    a = sword_img[..., 3] > 0
    rings = []
    cur = a.copy()
    for i in range(3):
        nxt = cur.copy(); p = np.pad(cur, 1)
        nxt |= p[:-2, 1:-1] | p[2:, 1:-1] | p[1:-1, :-2] | p[1:-1, 2:]
        rings.append(nxt & ~cur); cur = nxt
    cols = [P["w"], P["fr"], P["fd"]] if level > 0.66 else [P["fr"], P["fd"], P["fd"]] if level > 0.33 else [P["fd"], P["fd"], P["fd"]]
    nr = 1 + int(level * 2.99)
    for i in range(nr):
        put(out, rings[i], cols[i])
    # light the blade edge itself
    return out


def thrust_flash(img, x, y, size):
    d = np.abs(XX - x) / max(size, 1) + np.abs(YY - y) / max(size * 0.45, 1)
    put(img, d <= 1.0, P["fr"]); put(img, d <= 0.7, P["w2"]); put(img, d <= 0.4, P["w"])
    put(img, (np.abs(YY - y) <= 0.6) & (XX > x - size * 2.6) & (XX < x + size * 1.6), P["w"])
    return img


def crescent_wave(img, cx, cy, h, thick, squeeze=1.0):
    """Upright crescent (opens to the left) used for the sword-wave projectile."""
    ry = h / 2.0; rx = ry * 0.55 * squeeze
    outer = ((XX - cx) / rx) ** 2 + ((YY - cy) / ry) ** 2 <= 1
    inner = ((XX - (cx - thick)) / max(rx * 0.95, 1)) ** 2 + ((YY - cy) / (ry * 0.93)) ** 2 <= 1
    band = outer & ~inner & (XX >= cx - rx * 0.9)
    put(img, band, P["fd"])
    inner2 = ((XX - (cx - thick * 0.45)) / max(rx * 0.97, 1)) ** 2 + ((YY - cy) / (ry * 0.9)) ** 2 <= 1
    put(img, band & ~inner2, P["fr"])
    core = ((XX - (cx - thick * 0.15)) / max(rx * 0.99, 1)) ** 2 + ((YY - cy) / (ry * 0.84)) ** 2 <= 1
    put(img, band & ~core & (np.abs(YY - cy) < ry * 0.8), P["w"])
    return img


# ---------------------------------------------------------------- common poses
def stand(**kw):
    q = dict(root=(0, 0))
    q.update(kw)
    return q


def idle_cloth(f, speed=1.0, delay=2):
    ph = 2 * math.pi * (f - 1 - delay) / NF * speed
    return dict(cape=dict(bend=2 * math.sin(ph), amp=2.2, phase=ph),
                scarf=dict(amp=1.0, phase=ph),
                tabard=dict(amp=0.8, phase=ph * 0.5))


# ---------------------------------------------------------------- motions
def m_idle():
    out = []
    for f in range(1, NF + 1):
        b = int(round(2 * (1 - math.cos(2 * math.pi * (f - 1) / NF)) / 2))
        q = stand(breath=b, sword_ang=BASE_ANGLE - 1.5 * b / 2, hand_b=add(SHO_B + (WRI_B - SHO_B), (b * 0.5, -b)))
        q.update(idle_cloth(f))
        out.append(dict(q=q))
    return dict(frames=out, dur=[120] * NF, tags=[("idle", 1, 20, "forward")])


def gait(f, period, stride, lift, contact_frac, ground, hipx, phase0):
    """Foot ankle target for an in-place gait. Returns (x, y, foot_angle)."""
    s = ((f - 1) / period + phase0) % 1.0
    if s < contact_frac:  # planted, slides back
        u = s / contact_frac
        x = hipx + stride * (1 - 2 * u)
        y = ground
        a = -6 * (1 - u) ** 3 + 18 * max(0, u - 0.75) / 0.25
    else:
        u = (s - contact_frac) / (1 - contact_frac)
        x = hipx - stride + 2 * stride * ease(u)
        y = ground - lift * math.sin(math.pi * u) ** 0.8
        a = 18 * (1 - u) ** 2 - 8 * u ** 2
    return (x, y), a


def m_walk():
    out = []
    for f in range(1, NF + 1):
        bob = 2 * math.cos(2 * math.pi * (f - 3) / 10)
        root = (0, 3 + round(bob))
        ff, fa = gait(f, 20, 13, 7, 0.5, ANK_F[1], 122, 0.0)
        fb, fba = gait(f, 20, 13, 7, 0.5, ANK_B[1], 140, 0.5)
        sway = math.sin(2 * math.pi * (f - 1) / 20)
        q = dict(root=root, lean=3, foot_f=ff, foot_f_ang=fa, foot_b=fb, foot_b_ang=fba,
                 hand_f=add(SHO_F + (WRI_F - SHO_F), (2 + 3 * sway, root[1] + 1)),
                 sword_ang=BASE_ANGLE + 3 + 3 * sway,
                 hand_b=add(SHO_B + (WRI_B - SHO_B), (4 - 7 * sway, root[1] - 1)),
                 cape=dict(bend=8 + 3 * math.sin(2 * math.pi * (f - 3) / 10), amp=2.5, phase=2 * math.pi * (f - 3) / 10),
                 tabard=dict(bend=-5 * sway, amp=1, phase=2 * math.pi * f / 10),
                 scarf=dict(amp=1.2, phase=2 * math.pi * (f - 2) / 10, bend=4))
        out.append(dict(q=q))
    return dict(frames=out, dur=[70] * NF, tags=[("walk", 1, 20, "forward")])


RUN_ROOT = {1: 2, 2: 3, 3: 5, 4: 3, 5: 1, 6: -1, 7: -3, 8: -3, 9: -3, 10: 0}


RUN_LEAN = 28


def m_run():
    """Full sprint: torso pitched forward, sword kept in the idle grip (blade forward-down), far arm pumping."""
    out = []
    for f in range(1, NF + 1):
        k = (f - 1) % 10 + 1
        ry = RUN_ROOT[k] + 4
        ff, fa = gait(f, 20, 24, 17, 0.3, ANK_F[1], 132, 0.0)
        fb, fba = gait(f, 20, 24, 17, 0.3, ANK_B[1], 142, 0.5)
        # airborne frames: lift both feet a little with the root
        if k in (7, 8, 9):
            ff = (ff[0], min(ff[1], ANK_F[1] - 3)); fb = (fb[0], min(fb[1], ANK_B[1] - 3))
        ph = 2 * math.pi * (f - 1) / 20
        hip_w = HIP + np.array([0, ry])
        sho_f = hip_w + rot(SHO_F - HIP, RUN_LEAN); sho_b = hip_w + rot(SHO_B - HIP, RUN_LEAN)
        # sword arm keeps the idle hold, hanging from the pitched shoulder with a small pump
        hand = sho_f + (WRI_F - SHO_F) + np.array([4 * math.cos(ph) - 2, -2 * abs(math.sin(ph))])
        # far arm pumps in phase with the near leg (opposite to its own leg)
        hand_b = sho_b + np.array([18 * math.cos(ph) + 4, 28 - 8 * math.cos(ph)])
        q = dict(root=(0, ry), lean=RUN_LEAN, foot_f=ff, foot_f_ang=fa, foot_b=fb, foot_b_ang=fba,
                 hand_f=tuple(hand), sword_ang=BASE_ANGLE + 6 + 3 * math.cos(ph), hand_b=tuple(hand_b),
                 cape=dict(bend=50, amp=3.5, phase=2 * math.pi * (f - 2) / 5),
                 tabard=dict(bend=26, amp=2, phase=2 * math.pi * f / 5),
                 scarf=dict(amp=2, phase=2 * math.pi * (f - 2) / 5, bend=35))
        fx = {}
        if k in (1, 2, 3):
            age = (k - 1) / 3
            d = dust(blank(), ff[0] if f <= 10 else fb[0], GROUND_F - 1 if f <= 10 else GROUND_B - 1, age, n=3, spread=4, seed=f // 10, size=2.6, dirx=-1, rise=4)
            fx["fx_dust"] = d
        out.append(dict(q=q, fx=fx))
    return dict(frames=out, dur=[50] * NF, tags=[("run", 1, 20, "forward")])


def dash_pose(f):
    low = dict(root=(4, 12), lean=30, foot_f=(150, ANK_F[1]), foot_f_ang=-4, foot_b=(104, ANK_B[1] + 2), foot_b_ang=20,
               hand_f=(118, 160), elbow_f=1, sword_ang=158, hand_b=(170, 140), elbow_b=-1, knee_b=-1)
    return low


def m_dash():
    out = []
    rest = dict(root=(0, 0), lean=0)
    for f in range(1, NF + 1):
        if f <= 3:
            t = f / 3
            q = dict(root=kf(t, [(0, (0, 0)), (1, (2, 14))]), lean=kf(t, [(0, 0), (1, 32)]),
                     foot_f=kf(t, [(0, tuple(ANK_F)), (1, (132, ANK_F[1]))]), foot_b=kf(t, [(0, tuple(ANK_B)), (1, (112, ANK_B[1] + 1))]),
                     foot_b_ang=kf(t, [(0, 0), (1, 16)]),
                     hand_f=kf(t, [(0, tuple(WRI_F)), (1, (116, 162))]), sword_ang=kf(t, [(0, BASE_ANGLE), (1, 160)]),
                     hand_b=kf(t, [(0, tuple(WRI_B)), (1, (170, 142))]), elbow_b=-1)
            cb = kf(t, [(0, 0), (1, 50)])
        elif f <= 14:
            q = dash_pose(f)
            q["root"] = (4, 12 + (1 if f % 2 else 0))
            cb = 54
        elif f <= 17:
            t = (f - 14) / 3
            q = dict(root=kf(t, [(0, (4, 12)), (1, (2, 8))]), lean=kf(t, [(0, 30), (1, -6)], "out"),
                     foot_f=kf(t, [(0, (150, ANK_F[1])), (1, (146, ANK_F[1]))]), foot_f_ang=kf(t, [(0, -4), (1, -14)]),
                     foot_b=kf(t, [(0, (104, ANK_B[1] + 2)), (1, (116, ANK_B[1]))]), foot_b_ang=kf(t, [(0, 20), (1, 6)]),
                     hand_f=kf(t, [(0, (118, 160)), (1, (112, 152))]), sword_ang=kf(t, [(0, 158), (1, 120)]),
                     hand_b=kf(t, [(0, (170, 140)), (1, (162, 146))]), elbow_b=-1)
            cb = kf(t, [(0, 54), (1, 26)])
        else:
            t = (f - 17) / 3
            q = dict(root=kf(t, [(0, (2, 8)), (1, (0, 0))]), lean=kf(t, [(0, -6), (1, 0)]),
                     foot_f=kf(t, [(0, (146, ANK_F[1])), (1, tuple(ANK_F))]), foot_f_ang=kf(t, [(0, -14), (1, 0)]),
                     foot_b=kf(t, [(0, (116, ANK_B[1])), (1, tuple(ANK_B))]), foot_b_ang=kf(t, [(0, 6), (1, 0)]),
                     hand_f=kf(t, [(0, (112, 152)), (1, tuple(WRI_F))]), sword_ang=kf(t, [(0, 120), (1, BASE_ANGLE)]),
                     hand_b=kf(t, [(0, (162, 146)), (1, tuple(WRI_B))]), elbow_b=-1)
            cb = kf(t, [(0, 26), (1, 2)])
        q["cape"] = dict(bend=cb, amp=2.5 if f < 15 else 2, phase=2 * math.pi * f / 4, stretch=1.0 + cb / 600)
        q["tabard"] = dict(bend=cb * 0.45, amp=1.5, phase=2 * math.pi * f / 4)
        q["scarf"] = dict(bend=cb * 0.5, amp=1.5, phase=2 * math.pi * f / 4)
        out.append(dict(q=q, ghost=(4 <= f <= 14), brake=(15 <= f <= 17)))
    return dict(frames=out, dur=[40] * NF, tags=[("dash", 1, 20, "forward")])


# ================================================================ combat helpers
STANCE = dict(foot_f=(104.0, ANK_F[1]), foot_b=(150.0, ANK_B[1]))
REST_HAND = tuple(WRI_F)


def air_feet(root, tuck_f=(-6, -16), tuck_b=(4, -10), af=18, ab=12):
    r = np.array(root, float)
    return dict(foot_f=tuple(ANK_F + r + np.array(tuck_f)), foot_b=tuple(ANK_B + r + np.array(tuck_b)),
                foot_f_ang=af, foot_b_ang=ab)


def cloth(f, bend=0.0, amp=2.0, speed=1.0, lift=0.0):
    ph = 2 * math.pi * f / 10 * speed
    return dict(cape=dict(bend=bend, amp=amp, phase=ph, lift=lift),
                tabard=dict(bend=bend * 0.4, amp=amp * 0.5, phase=ph),
                scarf=dict(bend=bend * 0.5, amp=amp * 0.5, phase=ph))


def two_hand(hand, ang, back=7.0):
    a = math.radians(ang)
    return (hand[0] - back * math.cos(a), hand[1] - back * math.sin(a))


def frames_from(rows, stance=True):
    out = []
    for q in rows:
        q = dict(q)
        if stance:
            for k, v in STANCE.items():
                q.setdefault(k, v)
        out.append(q)
    return out


def clampx(img, lo=1, hi=N - 2):
    img[:, :lo] = 0; img[:, hi + 1:] = 0; return img


# ================================================================ attack combo
def m_attack_combo():
    S = [
        # 1st: horizontal slash
        dict(root=(-3, 3), lean=-8, hand_f=(106, 104), sword_ang=-150, hand_b=(122, 112), c=6),
        dict(root=(0, 3), lean=0, hand_f=(116, 96), sword_ang=-95, hand_b=(128, 104), c=10, no_sword=True),
        dict(root=(4, 4), lean=12, hand_f=(138, 118), sword_ang=2, hand_b=(150, 124), c=18),
        dict(root=(4, 4), lean=13, hand_f=(140, 122), sword_ang=12, hand_b=(150, 128), c=20),
        dict(root=(3, 4), lean=10, hand_f=(138, 132), sword_ang=40, hand_b=(148, 134), c=14),
        dict(root=(2, 4), lean=8, hand_f=(132, 140), sword_ang=62, hand_b=(146, 140), c=10),
        # 2nd: rising slash
        dict(root=(0, 5), lean=10, hand_f=(112, 152), sword_ang=150, hand_b=(140, 146), c=8),
        dict(root=(1, 4), lean=6, hand_f=(122, 150), sword_ang=118, hand_b=(144, 142), c=8),
        dict(root=(3, 3), lean=0, hand_f=(138, 136), sword_ang=40, hand_b=(148, 132), c=12),
        dict(root=(3, 1), lean=-10, hand_f=(146, 104), sword_ang=-68, hand_b=two_hand((146, 104), -68), c=20),
        dict(root=(2, 1), lean=-10, hand_f=(146, 104), sword_ang=-66, hand_b=two_hand((146, 104), -66), c=22),
        dict(root=(1, 2), lean=-6, hand_f=(140, 106), sword_ang=-58, hand_b=two_hand((140, 106), -58), c=16),
        dict(root=(0, 2), lean=-6, hand_f=(128, 104), sword_ang=-120, hand_b=two_hand((128, 104), -120), c=12),
        # 3rd: overhead slam
        dict(root=(-2, -1), lean=-12, hand_f=(120, 64), sword_ang=-160, hand_b=two_hand((120, 64), -160), c=4, lift=-4),
        dict(root=(2, 1), lean=4, hand_f=(140, 104), sword_ang=-45, hand_b=two_hand((140, 104), -45), c=18, no_sword=True),
        dict(root=(5, 6), lean=24, hand_f=(150, 146), sword_ang=62, hand_b=two_hand((150, 146), 62), c=26, sword_clip=241),
        dict(root=(5, 6), lean=24, hand_f=(150, 146), sword_ang=62, hand_b=two_hand((150, 146), 62), c=20, sword_clip=241),
        dict(root=(4, 5), lean=16, hand_f=(140, 146), sword_ang=58, hand_b=(150, 144), c=12),
        dict(root=(2, 2), lean=6, hand_f=(120, 148), sword_ang=46, c=6),
        dict(root=(0, 0), lean=0, hand_f=REST_HAND, sword_ang=BASE_ANGLE, c=2),
    ]
    out = []
    for i, q in enumerate(frames_from(S)):
        f = i + 1
        c = q.pop("c"); lift = q.pop("lift", 0)
        if f == 20:
            q["foot_f"], q["foot_b"] = tuple(ANK_F), tuple(ANK_B)
        q.update(cloth(f, bend=c, amp=2.2, lift=lift))

        def fx(st, f=f):
            o = {}
            fr = blank()
            if f == 2:
                arc_slash(fr, 122, 106, 92, -170, -80, 10)
            if f == 3:
                arc_slash(fr, 122, 106, 100, -75, 6, 18)
            if f == 4:
                arc_slash(fr, 122, 106, 100, -25, 14, 9, core=False)
            if f == 9:
                arc_slash(fr, 136, 122, 92, 115, 40, 10)
            if f == 10:
                arc_slash(fr, 136, 122, 96, 105, -74, 18)
            if f == 11:
                arc_slash(fr, 136, 122, 96, 10, -82, 8, core=False)
            if f == 15:
                arc_slash(fr, 128, 104, 96, -165, 40, 20)
            if f in (16, 17, 18, 19, 20):
                tx = int(st["tip"][0]) if f in (16, 17) else 200
                du = blank()
                if f == 16:
                    disc(fr, tx, GROUND_F - 2, 7, P["fr"]); disc(fr, tx, GROUND_F - 2, 4, P["w"])
                    cracks(fr, tx, GROUND_F - 1, 34, seed=4)
                if f == 17:
                    cracks(fr, tx, GROUND_F - 1, 46, seed=4, cols=("fd", "fd", "fr"))
                age = {16: 0.1, 17: 0.35, 18: 0.6, 19: 0.8, 20: 1.0}[f]
                dust(du, tx - 12, GROUND_F - 2, age, n=5, spread=8, seed=7, size=4, dirx=-1, rise=10)
                dust(du, tx + 10, GROUND_F - 2, age, n=5, spread=8, seed=8, size=4, dirx=1, rise=10)
                debris(du, tx, GROUND_F - 3, {16: 1, 17: 4, 18: 7, 19: 10, 20: 13}[f], n=9, seed=11)
                o["fx_dust"] = clampx(du)
            o["fx_front"] = clampx(fr)
            return o
        out.append(dict(q=q, fxfn=fx))
    dur = [55] * NF
    dur[0] = 80; dur[2] = 40; dur[9] = 40; dur[13] = 100; dur[15] = 40; dur[16] = 120
    tags = [("attack_combo", 1, 20, "forward"), ("atk1", 1, 6, "forward"), ("atk2", 7, 13, "forward"), ("atk3", 14, 20, "forward"),
            ("hit1", 3, 4, "forward"), ("hit2", 10, 11, "forward"), ("hit3", 16, 17, "forward")]
    return dict(frames=out, dur=dur, tags=tags)


# ================================================================ jump
JUMP_Y = [0, 3, 6, -6, -16, -24, -32, -37, -40, -40, -40, -39, -36, -28, -18, -6, 5, 3, 1, 0]


def fall_pose(root, f):
    q = dict(root=root, lean=2, hand_f=tuple(WRI_F + np.array(root) + np.array([10, -12])), sword_ang=28,
             hand_b=tuple(WRI_B + np.array(root) + np.array([8, -18])), elbow_b=1)
    q.update(air_feet(root, tuck_f=(-2, -5), tuck_b=(3, -3), af=12, ab=8))
    q.update(cloth(f, bend=56, amp=3, speed=1.6, lift=6)); q["cape"]["stretch"] = 0.74
    return q


def m_jump():
    out = []
    for f in range(1, NF + 1):
        y = JUMP_Y[f - 1]; root = (0, y)
        if f <= 3 or f >= 17:
            lean = {1: 4, 2: 8, 3: 10, 17: 12, 18: 6, 19: 2, 20: 0}[f]
            q = dict(root=root, lean=lean, foot_f=tuple(ANK_F), foot_b=tuple(ANK_B),
                     hand_f=tuple(WRI_F + np.array([2, y])), sword_ang=BASE_ANGLE + (8 if f in (2, 3, 17) else 2),
                     hand_b=tuple(WRI_B + np.array([0, y])))
            q.update(cloth(f, bend={1: 0, 2: -4, 3: -6, 17: 18, 18: 10, 19: 4, 20: 1}[f], amp=1.5))
        elif f == 4:
            q = dict(root=root, lean=-4, hand_f=tuple(WRI_F + np.array([6, y - 8])), sword_ang=50,
                     hand_b=tuple(WRI_B + np.array([4, y - 10])))
            q.update(air_feet(root, tuck_f=(0, 6), tuck_b=(0, 6), af=28, ab=24))
            q.update(cloth(f, bend=-14, amp=1.5))
        elif f <= 12:
            k = min((f - 4) / 5, 1)
            q = dict(root=root, lean={5: 0, 6: 0, 7: 2, 8: 3, 9: 4, 10: 5, 11: 5, 12: 4}[f],
                     hand_f=tuple(WRI_F + np.array([8, y - 10])), sword_ang=46,
                     hand_b=tuple(WRI_B + np.array([6, y - 12])))
            q.update(air_feet(root, tuck_f=(-6 * k, -18 * k), tuck_b=(4 * k, -12 * k), af=20, ab=14))
            q.update(cloth(f, bend=-16 if f < 10 else 12, amp=3 if f >= 10 else 2, speed=1.2))
        else:
            q = fall_pose(root, f)
        out.append(dict(q=q))
        if f == 17 or f == 18 or f == 19:
            age = {17: 0.15, 18: 0.5, 19: 0.85}[f]
            du = dust(blank(), 98, GROUND_F - 1, age, n=4, spread=6, seed=21, size=3.6, dirx=-1, rise=6)
            dust(du, 160, GROUND_B, age, n=4, spread=6, seed=22, size=3.2, dirx=1, rise=6)
            out[-1]["fx"] = {"fx_dust": du}
    tags = [("jump", 1, 20, "forward"), ("jump_start", 1, 5, "forward"), ("jump_up", 6, 9, "forward"),
            ("jump_apex", 10, 12, "forward"), ("jump_fall", 13, 16, "forward"), ("jump_land", 17, 20, "forward")]
    return dict(frames=out, dur=[60] * NF, tags=tags)


# ================================================================ jump attack
def m_jump_attack():
    out = []
    keys = {
        1: dict(root=(0, -30), lean=-4, hand_f=(116, 76), sword_ang=-150, c=-6),
        2: dict(root=(0, -31), lean=-8, hand_f=(112, 66), sword_ang=-160, c=-8),
        3: dict(root=(0, -32), lean=-10, hand_f=(110, 62), sword_ang=-164, c=-8),
        4: dict(root=(-1, -32), lean=-12, hand_f=(110, 60), sword_ang=-166, c=-6),
        5: dict(root=(4, -30), lean=18, hand_f=(146, 100), sword_ang=48, c=30),
        6: dict(root=(4, -29), lean=20, hand_f=(148, 106), sword_ang=68, c=34),
        7: dict(root=(3, -28), lean=18, hand_f=(146, 110), sword_ang=82, c=34),
        8: dict(root=(2, -28), lean=14, hand_f=(142, 112), sword_ang=92, c=32),
    }
    for f in range(1, NF + 1):
        if f in keys:
            q = dict(keys[f]); c = q.pop("c")
            q["hand_b"] = two_hand(q["hand_f"], q["sword_ang"])
            q.update(air_feet(q["root"], tuck_f=(-6, -14), tuck_b=(4, -10), af=18, ab=12))
            q.update(cloth(f, bend=c, amp=2.5, speed=1.3))
        elif f <= 14:
            t = (f - 8) / 6
            fp = fall_pose((0, -30), f)
            q = dict(root=kf(t, [(0, (2, -28)), (1, (0, -30))]), lean=kf(t, [(0, 14), (1, 2)]),
                     hand_f=kf(t, [(0, (142, 112)), (1, fp["hand_f"])]), sword_ang=kf(t, [(0, 92), (1, 28)]),
                     hand_b=kf(t, [(0, two_hand((142, 112), 92)), (1, fp["hand_b"])]), elbow_b=1)
            q.update(air_feet(q["root"], tuck_f=kf(t, [(0, (-6, -14)), (1, (-2, -5))]), tuck_b=kf(t, [(0, (4, -10)), (1, (3, -3))]), af=15, ab=10))
            q.update(cloth(f, bend=kf(t, [(0, 32), (1, 44)]), amp=3, speed=1.5))
        else:
            q = fall_pose((0, -30), f)

        def fx(st, f=f):
            fr = blank()
            if f == 5:
                arc_slash(fr, 132, 92, 80, -165, 52, 20)
            if f == 6:
                arc_slash(fr, 132, 92, 80, -40, 66, 12)
            if f == 7:
                arc_slash(fr, 132, 92, 80, 20, 74, 6, core=False)
            return {"fx_front": clampx(fr)}
        out.append(dict(q=q, fxfn=fx))
    dur = [50] * NF; dur[4] = 40
    return dict(frames=out, dur=dur, tags=[("jump_attack", 1, 20, "forward"), ("hit", 5, 7, "forward")])


# ================================================================ dash thrust
def m_dash_thrust():
    base = m_dash()["frames"]
    out = []
    for f in range(1, NF + 1):
        if f <= 4:
            q = dict(base[f - 1]["q"]); q["root"] = (q["root"][0] - 10, q["root"][1])
            fr = dict(q=q, ghost=(f >= 2))
            out.append(fr); continue
        if f <= 8:
            t = (f - 4) / 4
            q = dict(root=kf(t, [(0, (-6, 12)), (1, (-12, 12))]), lean=kf(t, [(0, 30), (1, 26)]),
                     foot_f=(140, ANK_F[1]), foot_f_ang=-4, foot_b=(96, ANK_B[1] + 2), foot_b_ang=20,
                     hand_f=kf(t, [(0, (106, 156)), (1, (96, 146))]), sword_ang=kf(t, [(0, 60), (1, 15)]),
                     hand_b=(150, 146), elbow_b=-1)
            cb = 54; ghost = True
        elif f <= 12:
            q = dict(root=(-6, 10), lean=24, foot_f=(146, ANK_F[1]), foot_f_ang=-6, foot_b=(98, ANK_B[1] + 2), foot_b_ang=22,
                     hand_f=(138 + (1 if f > 9 else 0), 134), sword_ang=15, hand_b=(156, 140), elbow_b=-1)
            cb = 40; ghost = False
        elif f <= 16:
            t = (f - 12) / 4
            q = dict(root=kf(t, [(0, (-6, 10)), (1, (-3, 5))]), lean=kf(t, [(0, 24), (1, 8)]),
                     foot_f=kf(t, [(0, (146, ANK_F[1])), (1, (126, ANK_F[1]))]), foot_b=kf(t, [(0, (98, ANK_B[1] + 2)), (1, (126, ANK_B[1]))]),
                     foot_f_ang=kf(t, [(0, -6), (1, 0)]), foot_b_ang=kf(t, [(0, 22), (1, 6)]),
                     hand_f=kf(t, [(0, (138, 134)), (1, (116, 146))]), sword_ang=kf(t, [(0, 15), (1, 34)]),
                     hand_b=kf(t, [(0, (156, 140)), (1, (156, 148))]), elbow_b=-1)
            cb = kf(t, [(0, 34), (1, 14)]); ghost = False
        else:
            t = (f - 16) / 4
            q = dict(root=kf(t, [(0, (-3, 5)), (1, (0, 0))]), lean=kf(t, [(0, 8), (1, 0)]),
                     foot_f=kf(t, [(0, (126, ANK_F[1])), (1, tuple(ANK_F))]), foot_b=kf(t, [(0, (126, ANK_B[1])), (1, tuple(ANK_B))]),
                     foot_b_ang=kf(t, [(0, 6), (1, 0)]),
                     hand_f=kf(t, [(0, (116, 146)), (1, REST_HAND)]), sword_ang=kf(t, [(0, 34), (1, BASE_ANGLE)]),
                     hand_b=kf(t, [(0, (156, 148)), (1, tuple(WRI_B))]), elbow_b=-1)
            cb = kf(t, [(0, 14), (1, 2)]); ghost = False
        q["cape"] = dict(bend=cb, amp=2.5, phase=2 * math.pi * f / 4)
        q["tabard"] = dict(bend=cb * 0.45, amp=1.5, phase=2 * math.pi * f / 4)
        q["scarf"] = dict(bend=cb * 0.5, amp=1.5, phase=2 * math.pi * f / 4)

        def fx(st, f=f):
            fr = blank()
            tip = st["tip"]
            if f == 9:
                thrust_flash(fr, min(tip[0], 244), tip[1], 9)
            elif f == 10:
                thrust_flash(fr, min(tip[0], 246), tip[1], 6)
            elif f == 11:
                thrust_flash(fr, min(tip[0], 247), tip[1], 3)
            return {"fx_front": clampx(fr)}
        out.append(dict(q=q, ghost=ghost, fxfn=fx))
    dur = [45] * NF; dur[8] = 40
    return dict(frames=out, dur=dur, tags=[("dash_thrust", 1, 20, "forward"), ("hit", 9, 11, "forward")])


# ================================================================ skill: ground slam
def m_skill_ground_slam():
    K = {
        1: dict(root=(0, 2), lean=-2, hand_f=(114, 120), sword_ang=-10, c=4),
        2: dict(root=(0, 1), lean=-6, hand_f=(116, 112), sword_ang=-80, c=6, lift=-3),
        3: dict(root=(0, 0), lean=-10, hand_f=(120, 92), sword_ang=-135, c=8, lift=-6),
        4: dict(root=(-1, -1), lean=-13, hand_f=(121, 70), sword_ang=-155, c=10, lift=-8),
        5: dict(root=(-2, -2), lean=-15, hand_f=(122, 60), sword_ang=-160, c=12, lift=-10),
        6: dict(root=(-2, -2), lean=-16, hand_f=(121, 59), sword_ang=-162, c=12, lift=-10),
        7: dict(root=(1, 2), lean=6, hand_f=(140, 100), sword_ang=-40, c=18, no_sword=True),
        8: dict(root=(3, 5), lean=18, hand_f=(150, 124), sword_ang=35, c=24),
        9: dict(root=(4, 8), lean=26, hand_f=(150, 160), sword_ang=72, c=26, sword_clip=241),
    }
    for f in range(10, 16):
        K[f] = dict(root=(4, 8), lean=26 - (f - 10) * 0.6, hand_f=(150, 160), sword_ang=72, c=22 - (f - 10) * 2, sword_clip=241)
    K[16] = dict(root=(4, 6), lean=20, hand_f=(150, 150), sword_ang=70, c=10, sword_clip=241)
    K[17] = dict(root=(3, 4), lean=12, hand_f=(140, 142), sword_ang=58, c=6)
    K[18] = dict(root=(2, 3), lean=6, hand_f=(128, 146), sword_ang=48, c=4)
    K[19] = dict(root=(1, 1), lean=2, hand_f=(116, 147), sword_ang=42, c=2)
    K[20] = dict(root=(0, 0), lean=0, hand_f=REST_HAND, sword_ang=BASE_ANGLE, c=1)
    out = []
    for f in range(1, NF + 1):
        q = dict(K[f]); c = q.pop("c"); lift = q.pop("lift", 0)
        if f <= 16:
            q["hand_b"] = two_hand(q["hand_f"], q["sword_ang"])
        q.update(STANCE if f < 20 else dict(foot_f=tuple(ANK_F), foot_b=tuple(ANK_B)))
        if f == 6:
            q["root"] = (-2, -3)  # tension tremble
        q.update(cloth(f, bend=c, amp=2.4 if f > 8 else 1.8, lift=lift))

        def fx(st, f=f):
            o = {}
            fr = blank(); du = blank()
            if f == 7:
                arc_slash(fr, 132, 104, 92, -170, 40, 20)
            if f == 8:
                arc_slash(fr, 132, 104, 92, -30, 50, 10)
            if f == 9:
                tx = 184
                disc(fr, tx, GROUND_F - 2, 9, P["fr"]); disc(fr, tx, GROUND_F - 2, 5, P["w"])
                cracks(fr, tx, GROUND_F - 1, 20, seed=31, n=6)
                dust(du, tx, GROUND_F - 2, 0.1, n=6, spread=10, seed=32, size=4, rise=8)
            if 10 <= f <= 15:
                tx = 184
                k = (f - 10) / 5
                reach = 20 + 90 * ease(k, "out")
                cracks(fr, tx, GROUND_F - 1, reach, seed=31, n=6, cols=("fd", "fr", "w") if k < 0.6 else ("fd", "fd", "fr"))
                # ground glow line along the cracks
                y = GROUND_F - 1
                x0, x1 = int(max(2, tx - reach)), int(min(N - 3, tx + reach))
                fr[y, x0:x1, :3] = P["fd"]; fr[y, x0:x1, 3] = 255
                dust(du, tx - 14, GROUND_F - 2, k, n=6, spread=12, seed=33, size=4.5, dirx=-1.5, rise=12)
                dust(du, tx + 12, GROUND_F - 2, k, n=6, spread=12, seed=34, size=4.5, dirx=1.5, rise=12)
                debris(du, tx, GROUND_F - 4, 2 + (f - 10) * 3.2, n=12, seed=35, speed=3.4)
                op = int(255 - 150 * ease(k, "in"))
                o["_op_fx_front"] = op; o["_op_fx_dust"] = op
            o["fx_front"] = clampx(fr); o["fx_dust"] = clampx(du)
            return o
        out.append(dict(q=q, fxfn=fx))
    dur = [55] * NF
    for i in range(5):
        dur[i] = 100
    dur[5] = 140; dur[8] = 40
    return dict(frames=out, dur=dur, tags=[("skill_ground_slam", 1, 20, "forward"), ("hit", 9, 13, "forward")])


# ================================================================ skill: spin slash
def ellipse_arc(img, cx, cy, rx, ry, a_head, span, width, front):
    """Bright ring segment trailing behind a_head (deg). front=True keeps the near (lower) half."""
    for i in range(int(span)):
        phi = math.radians(a_head - i)
        y = cy + ry * math.sin(phi)
        if front != (math.sin(phi) >= 0):
            continue
        x = cx + rx * math.cos(phi)
        w = width * (1 - i / span)
        if w < 0.6:
            continue
        col = P["w"] if i < span * 0.2 else P["fr"] if i < span * 0.55 else P["fd"]
        r = max(w / 2, 0.6)
        m = (np.abs(XX - x) <= r + 0.3) & (np.abs(YY - y) <= max(r * 0.6, 0.6))
        put(img, m & (img[..., 3] == 0) | (m & (col is P["w"])), col)
    return img


def m_skill_spin_slash():
    out = []
    for f in range(1, NF + 1):
        q = dict(STANCE)
        theta = None
        if f <= 3:
            t = f / 3
            q.update(root=kf(t, [(0, (0, 0)), (1, (0, 4))]), lean=kf(t, [(0, 0), (1, -6)]),
                     hand_f=kf(t, [(0, REST_HAND), (1, (114, 126))]), sword_ang=kf(t, [(0, BASE_ANGLE), (1, 165)]),
                     hand_b=kf(t, [(0, tuple(WRI_B)), (1, (128, 118))]))
            q.update(cloth(f, bend=kf(t, [(0, 2), (1, -10)]), amp=2))
        elif f <= 15:
            theta = ((f - 4) % 6) * 60.0
            sx = math.cos(math.radians(theta))
            if abs(sx) < 0.3:
                sx = 0.3 * (1 if sx >= 0 else -1)
            q.update(root=(0, 4), lean=4, hand_f=(138, 126), sword_ang=0, hand_b=two_hand((138, 126), 0, 9),
                     sx=sx, sword_layer="sword_over" if 0 < theta < 180 else "sword")
            q.update(cloth(f, bend=34 * math.cos(math.radians(theta)) + 10, amp=3, speed=2))
        else:
            t = (f - 15) / 5
            th = 300 + 60 * ease(min(t * 1.6, 1), "out")
            sx = max(math.cos(math.radians(th)), 0.3)
            q.update(root=kf(t, [(0, (0, 4)), (1, (0, 0))]), lean=kf(t, [(0, 4), (1, 0)]),
                     hand_f=kf(t, [(0, (138, 126)), (1, REST_HAND)]), sword_ang=kf(t, [(0, 0), (1, BASE_ANGLE)]),
                     hand_b=kf(t, [(0, two_hand((138, 126), 0, 9)), (1, tuple(WRI_B))]), sx=sx)
            if f == 20:
                q.update(foot_f=tuple(ANK_F), foot_b=tuple(ANK_B), sx=1.0)
            q.update(cloth(f, bend=kf(t, [(0, 30), (1, 2)]), amp=2.5))

        def fx(st, f=f, theta=theta):
            fb, ff = blank(), blank()
            cy = 126 + 4
            if theta is not None:
                ellipse_arc(fb, 128, cy, 118, 16, theta, 200, 5, front=False)
                ellipse_arc(ff, 128, cy, 118, 16, theta, 200, 5, front=True)
            elif f == 16:
                ellipse_arc(ff, 128, cy, 118, 16, 330, 110, 3, front=True)
                ellipse_arc(fb, 128, cy, 118, 16, 330, 110, 3, front=False)
            return {"fx_back": clampx(fb), "fx_front": clampx(ff)}
        out.append(dict(q=q, fxfn=fx, extra=["sword_over"]))
    return dict(frames=out, dur=[45] * NF, tags=[("skill_spin_slash", 1, 20, "forward"), ("hit", 4, 15, "forward")])


# ================================================================ skill: leap slam
def m_skill_leap_slam():
    K = {
        1: dict(root=(0, 4), lean=8, hand_f=(108, 150), sword_ang=60, c=2),
        2: dict(root=(0, 8), lean=12, hand_f=(106, 154), sword_ang=128, c=-2),
        3: dict(root=(0, 10), lean=14, hand_f=(104, 156), sword_ang=148, c=-4),
        4: dict(root=(0, -20), lean=-4, hand_f=(110, 112), sword_ang=162, c=-14, air=(0, 6, 26)),
        5: dict(root=(0, -28), lean=-6, hand_f=(114, 76), sword_ang=-150, c=-16, air=(-3, -8, 20)),
        6: dict(root=(0, -34), lean=-8, hand_f=(118, 56), sword_ang=-164, c=-16, air=(-5, -12, 20)),
        7: dict(root=(0, -38), lean=-10, hand_f=(118, 50), sword_ang=-167, c=-12, air=(-6, -14, 20)),
        8: dict(root=(0, -40), lean=-12, hand_f=(118, 48), sword_ang=-170, c=-6, air=(-6, -16, 20)),
        9: dict(root=(-2, -40), lean=-15, hand_f=(116, 48), sword_ang=-172, c=6, air=(-8, -18, 22)),
        10: dict(root=(2, -25), lean=14, hand_f=(144, 92), sword_ang=-30, c=40, air=(-4, -10, 16), no_sword=True),
        11: dict(root=(4, -8), lean=24, hand_f=(150, 122), sword_ang=55, c=46, air=(0, -2, 10)),
        12: dict(root=(4, 8), lean=26, hand_f=(150, 160), sword_ang=74, c=30, sword_clip=241),
    }
    for f in range(13, 17):
        K[f] = dict(root=(4, 8), lean=26 - (f - 12), hand_f=(150, 160), sword_ang=74, c=24 - (f - 12) * 4, sword_clip=241)
    K[17] = dict(root=(3, 6), lean=16, hand_f=(146, 150), sword_ang=66, c=8, sword_clip=241)
    K[18] = dict(root=(2, 4), lean=8, hand_f=(132, 146), sword_ang=52, c=4)
    K[19] = dict(root=(1, 1), lean=2, hand_f=(116, 147), sword_ang=42, c=2)
    K[20] = dict(root=(0, 0), lean=0, hand_f=REST_HAND, sword_ang=BASE_ANGLE, c=1)
    out = []
    for f in range(1, NF + 1):
        q = dict(K[f]); c = q.pop("c"); a = q.pop("air", None)
        if f <= 17:
            q["hand_b"] = two_hand(q["hand_f"], q["sword_ang"])
        if a is not None:
            q.update(air_feet(q["root"], tuck_f=(a[0], a[1]), tuck_b=(4 + a[0] * -0.3, a[1] * 0.7), af=a[2], ab=a[2] - 6))
        elif f <= 3 or f >= 20:
            q.update(foot_f=tuple(ANK_F), foot_b=tuple(ANK_B))
        else:
            q.update(STANCE)
        q.update(cloth(f, bend=c, amp=2.8, speed=1.4))

        def fx(st, f=f):
            o = {}
            fr, du, fb = blank(), blank(), blank()
            tx = 186
            if f == 10:
                arc_slash(fr, 134, 92, 82, -172, 40, 22)
            if f == 11:
                arc_slash(fr, 132, 90, 86, -20, 56, 10)
                for x in range(100, 170, 9):
                    fb[40:110, x, :3] = P["p3"]; fb[40:110, x, 3] = 255
            if f == 12:
                disc(fr, tx, GROUND_F - 2, 10, P["fr"]); disc(fr, tx, GROUND_F - 2, 6, P["w"])
                ellipse_ring(du, tx, GROUND_F - 2, 22, 5, 3, [P["w"], P["fr"], P["fd"]])
                cracks(fr, tx, GROUND_F - 1, 26, seed=41, n=6)
            if 13 <= f <= 16:
                k = (f - 12) / 4
                rx = 22 + 88 * ease(k, "out"); ry = 5 + 10 * ease(k, "out")
                ellipse_ring(du, tx, GROUND_F - 3, rx, ry, 3, [P["w"], P["fr"], P["fd"]] if k < 0.6 else [P["fr"], P["fd"], P["fd"]])
                cracks(fr, tx, GROUND_F - 1, 26 + 50 * k, seed=41, n=6, cols=("fd", "fr", "w") if k < 0.5 else ("fd", "fd", "fr"))
                dust(du, tx, GROUND_F - 4, k, n=9, spread=9, seed=42, size=5, rise=40)
                debris(du, tx, GROUND_F - 5, 2 + (f - 13) * 3.5, n=12, seed=43, speed=3.6)
                op = int(255 - 140 * ease(k, "in"))
                o["_op_fx_dust"] = op; o["_op_fx_front"] = op
            if 17 <= f <= 19:
                dust(du, tx, GROUND_F - 4, 0.75 + (f - 17) * 0.12, n=9, spread=9, seed=42, size=5, rise=40)
            o["fx_front"] = clampx(fr); o["fx_dust"] = clampx(du); o["fx_back"] = clampx(fb)
            return o
        out.append(dict(q=q, fxfn=fx))
    return dict(frames=out, dur=[50] * NF, tags=[("skill_leap_slam", 1, 20, "forward"), ("hit", 12, 14, "forward")])


# ================================================================ skill: sword wave
def m_skill_sword_wave():
    K = {
        1: dict(root=(0, 2), lean=-2, hand_f=(106, 140), sword_ang=110, g=0.15),
        2: dict(root=(-1, 3), lean=-6, hand_f=(106, 132), sword_ang=148, g=0.3),
        3: dict(root=(-2, 3), lean=-8, hand_f=(110, 126), sword_ang=164, g=0.45),
        4: dict(root=(-3, 4), lean=-10, hand_f=(114, 122), sword_ang=170, g=0.65),
        5: dict(root=(-3, 4), lean=-10, hand_f=(114, 122), sword_ang=171, g=0.85),
        6: dict(root=(-3, 4), lean=-11, hand_f=(114, 121), sword_ang=171, g=1.0),
        7: dict(root=(3, 4), lean=12, hand_f=(138, 118), sword_ang=0, g=0.0),
        8: dict(root=(4, 4), lean=14, hand_f=(140, 124), sword_ang=20, g=0.0),
        9: dict(root=(4, 4), lean=13, hand_f=(138, 130), sword_ang=36, g=0.0),
    }
    for f in range(10, 15):
        K[f] = dict(root=(4, 4), lean=12, hand_f=(136, 132), sword_ang=40, g=0.0)
    for f, t in zip(range(15, 21), (0.15, 0.35, 0.55, 0.75, 0.9, 1.0)):
        K[f] = dict(root=kf(t, [(0, (4, 4)), (1, (0, 0))]), lean=kf(t, [(0, 12), (1, 0)]),
                    hand_f=kf(t, [(0, (136, 132)), (1, REST_HAND)]), sword_ang=kf(t, [(0, 40), (1, BASE_ANGLE)]), g=0.0)
    WAVE = {8: (206, 1.0, 13), 9: (220, 1.0, 12), 10: (230, 0.8, 10), 11: (238, 0.6, 8), 12: (244, 0.45, 6), 13: (248, 0.3, 4)}
    out = []
    for f in range(1, NF + 1):
        q = dict(K[f]); g = q.pop("g")
        q["hand_b"] = two_hand(q["hand_f"], q["sword_ang"]) if f <= 9 else (156, 146)
        q.update(STANCE if f < 20 else dict(foot_f=tuple(ANK_F), foot_b=tuple(ANK_B)))
        q.update(cloth(f, bend=(-4 if f <= 6 else 22 if f <= 10 else 10 - (f - 10)), amp=2.2 + g, lift=-3 * g))

        def fx(st, f=f, g=g):
            fr = blank()
            if g > 0:
                fr = glow(render_sword(st["hand"][0], st["hand"][1], st["ang"]), g)
            if f == 7:
                arc_slash(fr, 124, 120, 100, -178, 4, 22)
            if f in WAVE:
                x, sq, th = WAVE[f]
                crescent_wave(fr, x - 40 * 0.55 * sq + 2, 130, 80, th, squeeze=sq)
            return {"fx_front": clampx(fr)}
        out.append(dict(q=q, fxfn=fx))
    dur = [50] * NF; dur[5] = 100
    return dict(frames=out, dur=dur, tags=[("skill_sword_wave", 1, 20, "forward"), ("release", 8, 8, "forward")])


MOTIONS = dict(idle=m_idle, walk=m_walk, run=m_run, dash=m_dash, jump=m_jump, attack_combo=m_attack_combo,
               jump_attack=m_jump_attack, dash_thrust=m_dash_thrust, skill_ground_slam=m_skill_ground_slam,
               skill_spin_slash=m_skill_spin_slash, skill_leap_slam=m_skill_leap_slam, skill_sword_wave=m_skill_sword_wave)


# ---------------------------------------------------------------- render + write
def render(name):
    spec = MOTIONS[name]()
    R = rig()
    frames = []
    opac = {}
    extra = set()
    for i, fr in enumerate(spec["frames"]):
        f = i + 1
        L = R.pose(**fr["q"])
        for k, v in fr.get("fx", {}).items():
            L[k] = over(L.get(k, blank()), v)
        if "fxfn" in fr:
            st = dict(hand=np.array(R.hand_f), ang=fr["q"].get("sword_ang", BASE_ANGLE), f=f)
            a = math.radians(st["ang"]); st["tip"] = st["hand"] + 109 * np.array([math.cos(a), math.sin(a)])
            for k, v in fr["fxfn"](st).items():
                if k.startswith("_op_"):
                    opac.setdefault(k[4:], {})[f] = v
                else:
                    L[k] = over(L.get(k, blank()), v)
        if fr.get("ghost"):
            gx = fr.get("ghost_dx", (-14, -28))
            L["fx_back"] = over(L.get("fx_back", blank()), over(silhouette(L, P["p2"], dx=gx[0]), speed_lines(blank(), [40, 52, 30, 60], [96, 110, 84, 120], [118, 140, 166, 190, 210])))
            L["fx_back"] = clampx(L["fx_back"])
            L["fx_back2"] = clampx(silhouette(L, P["p1"], dx=gx[1]))
            opac.setdefault("fx_back", {})[f] = 128; opac.setdefault("fx_back2", {})[f] = 77
            extra.add("fx_back2")
        if fr.get("brake"):
            age = (f - 14) / 4
            L["fx_dust"] = over(L.get("fx_dust", blank()), dust(blank(), 160, GROUND_F - 1, age, n=6, spread=8, seed=5, size=3.5, dirx=1, rise=8))
        for k, v in fr.get("opacity", {}).items():
            opac.setdefault(k, {})[f] = v
        extra |= set(fr.get("extra", []))
        if "sword_over" in L:
            extra.add("sword_over")
        frames.append(L)
    return spec, frames, opac, sorted(extra)


EXTRA_DEF = {"fx_back2": ("FX_BACK", "fx_back", False), "sword_over": ("FX_FRONT", "fx_front", False)}


def write(name):
    spec, frames, opac, extra = render(name)
    d = os.path.join(FRAMES, name)
    os.makedirs(d, exist_ok=True)
    for fn in os.listdir(d):
        if fn.endswith(".png"):
            os.remove(os.path.join(d, fn))
    names = LAYERS + ["fx_back", "fx_back2", "fx_front", "fx_dust", "sword_over"]
    pos = {}
    for i, L in enumerate(frames):
        for n in names:
            if n not in L:
                continue
            a = L[n][..., 3] > 0
            if not a.any():
                continue
            ys, xs = np.where(a)
            x0, y0, x1, y1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
            Image.fromarray(L[n][y0:y1, x0:x1]).save(os.path.join(d, "%s_%02d.png" % (n, i + 1)))
            pos.setdefault(n, {})[i + 1] = (int(x0), int(y0))
    lua = ['local spr = app.activeSprite', 'local dir = "%s/"' % d.replace("\\", "/"),
           'local function find(layers, name) for _, l in ipairs(layers) do if l.name == name then return l end; if l.isGroup then local r = find(l.layers, name); if r then return r end end end end']
    for e in extra:
        g, ref, above = EXTRA_DEF[e]
        lua.append('if not find(spr.layers, "%s") then local g = find(spr.layers, "%s"); local l = spr:newLayer(); l.name = "%s"; l.parent = g; l.stackIndex = %s end'
                   % (e, g, e, "find(spr.layers, \"%s\").stackIndex" % ref if e == "sword_over" else "1"))
    lua.append('while #spr.frames < %d do spr:newEmptyFrame() end' % NF)
    lua.append('local DUR = {%s}' % ",".join(str(x) for x in spec["dur"]))
    lua.append('for f = 1, %d do spr.frames[f].duration = DUR[f] / 1000 end' % NF)
    lua.append('local POS = {}')
    for n, fr in pos.items():
        lua.append('POS["%s"] = {%s}' % (n, ",".join("[%d]={%d,%d}" % (f, x, y) for f, (x, y) in fr.items())))
    lua.append('local OPA = {}')
    for n, fr in opac.items():
        lua.append('OPA["%s"] = {%s}' % (n, ",".join("[%d]=%d" % (f, v) for f, v in fr.items())))
    lua.append('local names = {%s}' % ",".join('"%s"' % n for n in names))
    lua.append('''local count = 0
for _, n in ipairs(names) do
  local layer = find(spr.layers, n)
  if layer then
    for f = 1, %d do
      local c = layer:cel(f); if c then spr:deleteCel(c) end
      local p = POS[n] and POS[n][f]
      if p then
        local img = Image{ fromFile = dir .. n .. string.format("_%%02d.png", f) }
        local cel = spr:newCel(layer, f, img, Point(p[1], p[2]))
        if OPA[n] and OPA[n][f] then cel.opacity = OPA[n][f] end
        count = count + 1
      end
    end
  end
end
print("cels loaded: " .. count .. " frames: " .. #spr.frames)
spr:saveAs(spr.filename)''' % NF)
    with open(os.path.join(d, "load.lua"), "w", encoding="utf-8") as fh:
        fh.write("\n".join(lua))
    # preview sheet for quick review (scratchpad)
    tiles = []
    for fi, L in enumerate(frames):
        L2 = dict(L); L2["_opacity"] = {k: v.get(fi + 1, 255) for k, v in opac.items()}
        c = composite(L2, bg=(233, 233, 236))
        tiles.append(c[30:250, 20:236, :3])
    rows = [np.concatenate(tiles[i:i + 5], 1) for i in range(0, NF, 5)]
    sheet = np.concatenate(rows, 0)
    Image.fromarray(sheet).resize((sheet.shape[1] * 2 // 2, sheet.shape[0] * 2 // 2), Image.NEAREST).save(os.path.join(SP, "prev_%s.png" % name))
    print(name, "written", sum(len(v) for v in pos.values()), "cels; extra", extra)


if __name__ == "__main__":
    for nm in sys.argv[1:]:
        write(nm)
