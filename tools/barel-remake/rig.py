"""Barel cut-out rig: rest parts from barel_work/_parts, 2-bone IK limbs, RotSprite rotation, cloth warps."""
import numpy as np, math, os, sys, json
from PIL import Image, ImageDraw
SP = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SP)
from swordlib import render_sword, BASE_GRIP, BASE_ANGLE

WORK = os.environ.get("BAREL_REMAKE_WORK", SP)
PARTS = os.environ.get("BAREL_REMAKE_PARTS", os.path.join(SP, "parts"))
N = 256
LAYERS = ["cape_back", "arm_back", "leg_back", "torso", "leg_front", "tabard",
          "head", "scarf_front", "sword", "arm_front"]


def hx(h):
    h = h.lstrip("#")
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], np.uint8)


OUTL = hx("#0A0A0E")
P = {k: hx(v) for k, v in dict(
    o="#0A0A0E", p0="#1A1620", p1="#2E2634", p2="#433A4A", p3="#5E5A6C", p4="#868494", p5="#B4B4C0", hl="#E2E2EA",
    c0="#2E0606", c1="#540808", c2="#7A0E14", c3="#9C1418", c4="#C42A22",
    w="#FFFFFF", w2="#F2E6E6", fr="#E04030", fd="#8A1018").items()}

# ---------------------------------------------------------------- rest skeleton (sprite coords)
HIP = np.array([136.0, 146.0])
NECK = np.array([136.0, 88.0])
SHO_F, ELB_F, WRI_F = np.array([113.0, 92.0]), np.array([108.0, 120.0]), np.array(BASE_GRIP)
SHO_B, ELB_B, WRI_B = np.array([143.0, 98.0]), np.array([149.0, 124.0]), np.array([155.0, 150.0])
HIP_F, KNE_F, ANK_F = np.array([117.0, 155.0]), np.array([112.0, 191.0]), np.array([108.0, 226.0])
HIP_B, KNE_B, ANK_B = np.array([140.0, 156.0]), np.array([143.0, 193.0]), np.array([143.0, 219.0])
CAPE_A = np.array([118.0, 90.0])
TAB_A = np.array([140.0, 128.0])
SCARF_A = np.array([136.0, 86.0])
GROUND_F, GROUND_B = 240, 232


def rot(v, deg):
    a = math.radians(deg); c, s = math.cos(a), math.sin(a)
    return np.array([c * v[0] - s * v[1], s * v[0] + c * v[1]])


def ang(v):
    return math.degrees(math.atan2(v[1], v[0]))


def load(n):
    im = np.asarray(Image.open(os.path.join(PARTS, n + ".png")).convert("RGBA")).copy()
    im[im[..., 3] == 0] = 0
    return im


def poly(pts):
    im = Image.new("L", (N, N), 0); ImageDraw.Draw(im).polygon([tuple(p) for p in pts], fill=1)
    return np.asarray(im).astype(bool)


def ring(a):
    p = np.pad(a, 1)
    return ~a & (p[:-2, 1:-1] | p[2:, 1:-1] | p[1:-1, :-2] | p[1:-1, 2:])


def outline(img):
    r = ring(img[..., 3] > 0); img[r, :3] = OUTL; img[r, 3] = 255; return img


def is_col(img, c):
    return (img[..., 3] > 0) & np.all(img[..., :3] == c, -1)


def shade_flat(img, region):
    """Give flat #2E2634 fill a lit left edge and dark right edge so hidden fills read as plate."""
    a = img[..., 3] > 0
    flat = is_col(img, P["p1"]) & region
    # only treat big flat blobs (hidden fills), not ordinary p1 shading
    f = flat.astype(int); p = np.pad(f, 2)
    cnt = sum(p[2 + dy:N + 2 + dy, 2 + dx:N + 2 + dx] for dy in range(-2, 3) for dx in range(-2, 3))
    blob = flat & (cnt >= 20)
    for _ in range(2):
        q = np.pad(blob, 1); blob = blob | (flat & (q[:-2, 1:-1] | q[2:, 1:-1] | q[1:-1, :-2] | q[1:-1, 2:]))
    ys, xs = np.where(blob)
    if len(ys) == 0:
        return img
    y0 = ys.min()
    for y in np.unique(ys):
        row = np.where(blob[y])[0]
        l, r = row.min(), row.max()
        for x in row:
            u = (x - l) / max(r - l, 1)
            c = P["p3"] if u < 0.12 else P["p2"] if u < 0.35 else P["p1"] if u < 0.78 else P["p0"]
            k = (y - y0) % 9
            if k == 0:
                c = P["p0"]
            elif k == 1 and u < 0.6:
                c = P["p4"] if u < 0.3 else P["p3"]
            img[y, x, :3] = c
    return img


# ---------------------------------------------------------------- RotSprite
def scale2x(img):
    H, W = img.shape[:2]
    pad = np.pad(img, ((1, 1), (1, 1), (0, 0)), mode="edge")
    A, B, C, D = pad[:-2, 1:-1], pad[1:-1, 2:], pad[1:-1, :-2], pad[2:, 1:-1]
    eq = lambda X, Y: np.all(X == Y, -1)
    out = np.zeros((H * 2, W * 2, 4), np.uint8)
    out[0::2, 0::2] = np.where((eq(C, A) & ~eq(C, D) & ~eq(A, B))[..., None], A, img)
    out[0::2, 1::2] = np.where((eq(A, B) & ~eq(A, C) & ~eq(B, D))[..., None], B, img)
    out[1::2, 0::2] = np.where((eq(D, C) & ~eq(D, B) & ~eq(C, A))[..., None], C, img)
    out[1::2, 1::2] = np.where((eq(B, D) & ~eq(B, A) & ~eq(D, C))[..., None], D, img)
    return out


class Piece:
    """A rigid image with a pivot; place() returns a full-canvas image."""

    def __init__(self, img, pivot):
        a = img[..., 3] > 0
        ys, xs = np.where(a)
        if len(xs) == 0:
            self.empty = True; return
        self.empty = False
        x0, x1, y0, y1 = xs.min() - 1, xs.max() + 2, ys.min() - 1, ys.max() + 2
        self.org = np.array([x0, y0], float)
        self.crop = img[y0:y1, x0:x1].copy()
        self.pivot = np.array(pivot, float)
        self._up = None

    @property
    def up(self):
        if self._up is None:
            u = self.crop
            for _ in range(3):
                u = scale2x(u)
            self._up = u
        return self._up

    def place(self, dst_pivot, angle=0.0, sx=1.0, sy=1.0, canvas=None):
        out = np.zeros((N, N, 4), np.uint8) if canvas is None else canvas
        if self.empty:
            return out
        d = np.array(dst_pivot, float)
        if abs(angle) < 0.5 and sx == 1.0 and sy == 1.0:
            off = np.round(d - self.pivot).astype(int)
            h, w = self.crop.shape[:2]
            X0, Y0 = int(self.org[0]) + off[0], int(self.org[1]) + off[1]
            xs0, ys0 = max(0, -X0), max(0, -Y0)
            xe, ye = min(w, N - X0), min(h, N - Y0)
            if xe <= xs0 or ye <= ys0:
                return out
            src = self.crop[ys0:ye, xs0:xe]
            m = src[..., 3] > 0
            tgt = out[Y0 + ys0:Y0 + ye, X0 + xs0:X0 + xe]
            tgt[m] = src[m]
            return out
        h, w = self.crop.shape[:2]
        corners = np.array([[0, 0], [w, 0], [0, h], [w, h]], float) + self.org - self.pivot
        a = math.radians(angle); c, s = math.cos(a), math.sin(a)
        tc = np.array([[c * x * sx - s * y * sy, s * x * sx + c * y * sy] for x, y in corners]) + d
        bx0, by0 = np.floor(tc.min(0)).astype(int) - 1
        bx1, by1 = np.ceil(tc.max(0)).astype(int) + 1
        bx0, by0, bx1, by1 = max(bx0, 0), max(by0, 0), min(bx1, N), min(by1, N)
        if bx1 <= bx0 or by1 <= by0:
            return out
        yy, xx = np.mgrid[by0:by1, bx0:bx1].astype(float) + 0.5
        qx, qy = xx - d[0], yy - d[1]
        rx = (c * qx + s * qy) / sx
        ry = (-s * qx + c * qy) / sy
        ux = ((rx + self.pivot[0] - self.org[0]) * 8).astype(int)
        uy = ((ry + self.pivot[1] - self.org[1]) * 8).astype(int)
        up = self.up
        ok = (ux >= 0) & (uy >= 0) & (ux < up.shape[1]) & (uy < up.shape[0])
        smp = np.zeros(ux.shape + (4,), np.uint8)
        smp[ok] = up[uy[ok], ux[ok]]
        m = smp[..., 3] > 0
        tgt = out[by0:by1, bx0:bx1]
        tgt[m] = smp[m]
        return out


def over(dst, src):
    m = src[..., 3] > 0; dst[m] = src[m]; return dst


def split_by_bone(img, a, b, lo, hi):
    """Keep pixels whose projection on bone a->b (in px from a) lies in [lo, hi]."""
    yy, xx = np.mgrid[0:N, 0:N].astype(float)
    v = b - a; L = np.linalg.norm(v); v = v / L
    t = (xx - a[0]) * v[0] + (yy - a[1]) * v[1]
    out = img.copy(); out[~((t >= lo) & (t <= hi))] = 0
    return out, L


FAR_SHADE = [("hl", "p5"), ("p5", "p4"), ("p4", "p3"), ("p3", "p2"), ("p2", "p1"), ("p1", "p0")]


def far_arm(img, a, b, trim=None):
    """Copy of a near-arm segment for the far side: optional width trim around bone a->b, one ramp step darker."""
    out = img.copy()
    if trim is not None:
        yy, xx = np.mgrid[0:N, 0:N].astype(float)
        v = (b - a) / np.linalg.norm(b - a)
        u = np.abs(-(xx - a[0]) * v[1] + (yy - a[1]) * v[0])
        had = out[..., 3] > 0
        out[u > trim] = 0
        cut = ring(out[..., 3] > 0) & had
        out[cut, :3] = OUTL; out[cut, 3] = 255
    src = out.copy()
    for k_from, k_to in FAR_SHADE:
        out[is_col(src, P[k_from]), :3] = P[k_to]
    return out


def ik2(root, target, L1, L2, side):
    """2-bone IK. side=+1 puts the joint on the (-vy, vx) side of root->target."""
    v = target - root; d = np.linalg.norm(v)
    d = min(max(d, abs(L1 - L2) + 0.01), L1 + L2 - 0.01)
    v = v / (np.linalg.norm(v) + 1e-9)
    a = (L1 * L1 - L2 * L2 + d * d) / (2 * d)
    h = math.sqrt(max(L1 * L1 - a * a, 0))
    n = np.array([-v[1], v[0]]) * side
    j = root + v * a + n * h
    end = root + v * d
    return j, end


# ---------------------------------------------------------------- warps for cloth
def warp(img, anchor_rest, anchor_now, bend=0.0, amp=0.0, phase=0.0, k=0.09, reach=90.0, lift=0.0, stretch=1.0):
    """Inverse-map a cloth layer: rotation grows with distance from the anchor (bend, degrees),
    plus a travelling wave (amp px, phase rad) perpendicular to the hang direction."""
    a = img[..., 3] > 0
    if not a.any():
        return img.copy()
    yy, xx = np.mgrid[0:N, 0:N].astype(float) + 0.5
    qx, qy = xx - anchor_now[0], yy - anchor_now[1]
    r = np.hypot(qx, qy)
    w = np.clip(r / reach, 0, 1.4)
    th = np.radians(-bend * w)
    c, s = np.cos(th), np.sin(th)
    sx_ = (c * qx - s * qy) / stretch
    sy_ = (s * qx + c * qy) / stretch
    wave = amp * np.clip(r / reach, 0, 1.2) * np.sin(phase - r * k)
    sx_ = sx_ - wave
    sy_ = sy_ - 0.35 * amp * np.clip(r / reach, 0, 1.2) * np.cos(phase - r * k) - lift * w
    X = np.floor(sx_ + anchor_rest[0]).astype(int); Y = np.floor(sy_ + anchor_rest[1]).astype(int)
    ok = (X >= 0) & (Y >= 0) & (X < N) & (Y < N)
    out = np.zeros_like(img)
    out[ok] = img[Y[ok], X[ok]]
    return out


# ---------------------------------------------------------------- build rig parts once
class Rig:
    def __init__(self):
        R = {n: load(n) for n in LAYERS}
        # leg cleanup: cut to limb silhouettes, drop old-sword ghost lines, shade hidden thigh fill
        lb_poly = poly([(128, 150), (153, 150), (156, 186), (154, 214), (178, 223), (178, 234), (131, 234), (133, 214), (131, 190)])
        lf_poly = poly([(106, 150), (130, 150), (127, 172), (123, 192), (119, 223), (129, 231), (129, 242), (95, 242), (98, 223), (102, 192), (104, 170)])
        for n, pl in (("leg_back", lb_poly), ("leg_front", lf_poly)):
            im = R[n]; ybot = np.where((im[..., 3] > 0).any(1))[0].max()
            im[~pl] = 0
            im = shade_flat(im, np.ones((N, N), bool))
            im = outline(im); im[ybot + 1:] = 0          # keep the sole on its original ground row
            R[n] = im
        yy, xx = np.mgrid[0:N, 0:N]
        ta = R["torso"][..., 3] > 0
        stray = (xx < 103) & ta                                  # dark cape tips mislabelled as torso
        R["cape_back"][stray] = R["torso"][stray]
        R["torso"][stray | ((yy > 172) & ta)] = 0               # old-sword leftovers under the blade
        R["cape_back"] = drop_specks(R["cape_back"], 12)
        R["torso"] = shade_flat(R["torso"], np.ones((N, N), bool))
        af = R["arm_front"]
        chunk = (xx >= 119) & (yy >= 121) & (yy <= 160) & (af[..., 3] > 0)
        R["torso"][chunk] = af[chunk]          # torso side shadow belongs to the torso, not the arm
        af[chunk] = 0
        R["arm_front"] = af
        self.R = R
        # limbs
        self.af_up, self.Laf1 = split_by_bone(R["arm_front"], SHO_F, ELB_F, -30, np.linalg.norm(ELB_F - SHO_F) + 2)
        self.af_lo, self.Laf2 = split_by_bone(R["arm_front"], ELB_F, WRI_F, -3, 60)
        # The far arm in the illustration is only a sliver beside the torso, which reads as a stick once it
        # swings clear of the body. Build it from the near arm instead: pauldron flare trimmed, one ramp darker.
        self.ab_up = far_arm(self.af_up, SHO_F, ELB_F, trim=8.5); self.Lab1 = self.Laf1
        self.ab_lo = far_arm(self.af_lo, ELB_F, WRI_F); self.Lab2 = self.Laf2
        self.lf_th, self.Llf1 = split_by_bone(R["leg_front"], HIP_F, KNE_F, -30, np.linalg.norm(KNE_F - HIP_F) + 3)
        self.lf_sh, self.Llf2 = split_by_bone(R["leg_front"], KNE_F, ANK_F, -3, np.linalg.norm(ANK_F - KNE_F) + 1)
        self.lf_ft, _ = split_by_bone(R["leg_front"], KNE_F, ANK_F, np.linalg.norm(ANK_F - KNE_F) - 2, 80)
        self.lb_th, self.Llb1 = split_by_bone(R["leg_back"], HIP_B, KNE_B, -30, np.linalg.norm(KNE_B - HIP_B) + 3)
        self.lb_sh, self.Llb2 = split_by_bone(R["leg_back"], KNE_B, ANK_B, -3, np.linalg.norm(ANK_B - KNE_B) + 1)
        self.lb_ft, _ = split_by_bone(R["leg_back"], KNE_B, ANK_B, np.linalg.norm(ANK_B - KNE_B) - 2, 80)
        self.P = dict(
            af_up=Piece(self.af_up, SHO_F), af_lo=Piece(self.af_lo, ELB_F),
            ab_up=Piece(self.ab_up, SHO_F), ab_lo=Piece(self.ab_lo, ELB_F),
            lf_th=Piece(self.lf_th, HIP_F), lf_sh=Piece(self.lf_sh, KNE_F), lf_ft=Piece(self.lf_ft, ANK_F),
            lb_th=Piece(self.lb_th, HIP_B), lb_sh=Piece(self.lb_sh, KNE_B), lb_ft=Piece(self.lb_ft, ANK_B),
            torso=Piece(R["torso"], HIP), head=Piece(R["head"], NECK))
        self.rest_dir = dict(af1=ang(ELB_F - SHO_F), af2=ang(WRI_F - ELB_F), ab1=ang(ELB_F - SHO_F), ab2=ang(WRI_F - ELB_F),
                             lf1=ang(KNE_F - HIP_F), lf2=ang(ANK_F - KNE_F), lb1=ang(KNE_B - HIP_B), lb2=ang(ANK_B - KNE_B))

    # ------------------------------------------------------------ pose -> layer images
    def pose(self, **q):
        root = np.array(q.get("root", (0, 0)), float)
        lean = q.get("lean", 0.0)
        breath = q.get("breath", 0.0)
        hip_w = HIP + root

        def T(p, extra_up=True):  # torso-attached point to world
            w = hip_w + rot(p - HIP, lean)
            if extra_up:
                w = w + np.array([0, -breath])
            return w

        L = {n: np.zeros((N, N, 4), np.uint8) for n in LAYERS}
        Pc = self.P
        # torso, head
        Pc["torso"].place(hip_w + np.array([0, -breath]), lean, canvas=L["torso"])
        neck_w = T(NECK) + np.array(q.get("head_off", (0, 0)), float)
        Pc["head"].place(neck_w, lean * 0.6 + q.get("head", 0.0), canvas=L["head"])
        # legs
        for side, th, sh, ft, H0, K0, A0, L1, L2, r1, r2, lay, key in (
                ("f", "lf_th", "lf_sh", "lf_ft", HIP_F, KNE_F, ANK_F, self.Llf1, self.Llf2, "lf1", "lf2", "leg_front", "foot_f"),
                ("b", "lb_th", "lb_sh", "lb_ft", HIP_B, KNE_B, ANK_B, self.Llb1, self.Llb2, "lb1", "lb2", "leg_back", "foot_b")):
            hw = H0 + root + np.array(q.get("hip_" + side, (0, 0)), float)
            tgt = np.array(q.get(key, A0), float)
            knee, ank = ik2(hw, tgt, L1, L2, side=q.get("knee_" + side, -1))
            d1 = ang(knee - hw) - self.rest_dir[r1]; d2 = ang(ank - knee) - self.rest_dir[r2]
            Pc[th].place(hw, d1, canvas=L[lay])
            Pc[sh].place(knee, d2, canvas=L[lay])
            Pc[ft].place(ank, q.get(key + "_ang", 0.0), canvas=L[lay])
            L[lay][GROUND_F + 1:] = 0          # soles never sink below the ground line
        # arms
        sho_f = T(SHO_F); sho_b = T(SHO_B)
        hand_f = np.array(q["hand_f"], float) if "hand_f" in q else sho_f + (WRI_F - SHO_F)
        hand_b = np.array(q["hand_b"], float) if "hand_b" in q else sho_b + (WRI_B - SHO_B)
        for sho, hand, L1, L2, up, lo, r1, r2, lay, key in (
                (sho_b, hand_b, self.Lab1, self.Lab2, "ab_up", "ab_lo", "ab1", "ab2", "arm_back", "elbow_b"),
                (sho_f, hand_f, self.Laf1, self.Laf2, "af_up", "af_lo", "af1", "af2", "arm_front", "elbow_f")):
            if key in q:
                elb, hnd = ik2(sho, hand, L1, L2, side=q[key])
            else:
                # default: elbow hangs back; with the hand raised above the shoulder, take the lower elbow
                e1, h1 = ik2(sho, hand, L1, L2, side=1); e2, h2 = ik2(sho, hand, L1, L2, side=-1)
                elb, hnd = (e1, h1) if (hand[1] >= sho[1] - 4 or e1[1] >= e2[1]) else (e2, h2)
            Pc[up].place(sho, ang(elb - sho) - self.rest_dir[r1], canvas=L[lay])
            Pc[lo].place(elb, ang(hnd - elb) - self.rest_dir[r2], canvas=L[lay])
            if lay == "arm_front":
                hand_f = hnd
        # sword
        if not q.get("no_sword"):
            sa = q.get("sword_ang", BASE_ANGLE + lean)
            sw = render_sword(hand_f[0], hand_f[1], sa, glow=q.get("glow"))
            clip = int(q.get("sword_clip", GROUND_F + 1))   # the blade never goes through the floor
            if sw[clip:, :, 3].any():
                sw[clip:] = 0
                r_ = sw[clip - 1]; r_[r_[:, 3] > 0, :3] = OUTL
            L[q.get("sword_layer", "sword")] = sw
            self.sword_ang = sa
        # cloth
        cp = q.get("cape", {})
        L["cape_back"] = warp(self.R["cape_back"], CAPE_A, T(CAPE_A, False) + np.array([0, -breath]), **cp)
        tb = q.get("tabard", {})
        L["tabard"] = warp(self.R["tabard"], TAB_A, TAB_A + root, reach=70, **tb)
        sc = q.get("scarf", {})
        L["scarf_front"] = warp(self.R["scarf_front"], SCARF_A, T(SCARF_A), reach=30, k=0.2, **sc)
        for n in ("cape_back", "tabard", "scarf_front", "leg_front", "leg_back", "arm_front", "arm_back"):
            L[n] = drop_specks(L[n], 24 if n in ("cape_back", "tabard", "scarf_front") else 30)
        # facing / turn squash
        if q.get("flip") or q.get("sx", 1.0) != 1.0:
            sx = q.get("sx", 1.0) * (-1 if q.get("flip") else 1)
            for n in list(L):
                L[n] = squash_x(L[n], sx)
        self.hand_f = hand_f
        return L


def components(a):
    """8-connected labels by min-label propagation (vectorised)."""
    lab = np.where(a, np.arange(a.size).reshape(a.shape) + 1, 0)
    big = a.size + 10
    while True:
        p = np.pad(np.where(a, lab, big), 1, constant_values=big)
        m = lab.copy()
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                m = np.minimum(m, p[1 + dy:N + 1 + dy, 1 + dx:N + 1 + dx])
        m = np.where(a, m, 0)
        if np.array_equal(m, lab):
            return lab
        lab = m


def drop_specks(img, minpx):
    a = img[..., 3] > 0
    if not a.any():
        return img
    lab = components(a)
    ids, cnt = np.unique(lab[a], return_counts=True)
    small = ids[cnt < minpx]
    if len(small):
        img = img.copy(); img[np.isin(lab, small)] = 0
    return img


def squash_x(img, sx, cx=128.0):
    xx = np.arange(N) + 0.5
    src = np.floor((xx - cx) / sx + cx).astype(int)
    ok = (src >= 0) & (src < N)
    out = np.zeros_like(img)
    out[:, ok] = img[:, src[ok]]
    return out


def composite(layers, order=None, bg=None):
    order = order or (["fx_back", "fx_back2"] + LAYERS[:8] + ["sword", "sword_over", "arm_front", "fx_front", "fx_dust"])
    out = np.zeros((N, N, 4), np.uint8)
    if bg is not None:
        out[..., :3] = bg; out[..., 3] = 255
    seen = set()
    for n in order:
        if n in layers and n not in seen:
            seen.add(n)
            im = layers[n]
            op = layers.get("_opacity", {}).get(n, 255) / 255.0
            m = im[..., 3] > 0
            if op >= 0.999:
                out[m] = im[m]
            else:
                a = out[m, :3].astype(float); b = im[m, :3].astype(float)
                out[m, :3] = (a * (1 - op) + b * op).astype(np.uint8) if bg is not None else im[m, :3]
                out[m, 3] = np.maximum(out[m, 3], int(255 * op))
    return out
