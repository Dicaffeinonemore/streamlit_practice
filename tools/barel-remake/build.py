"""Convert the remade Barel rig into the game's ten-frame Aseprite exports and named skill sheets.

Run: python tools/barel-remake/build.py   (needs numpy + Pillow)

Every clip keeps the cell size, anchor, frame timing and gameplay metadata (hit boxes, physics) of the
asset it replaces; only the drawing, renderScale and alignment change. Effects are left to the game,
which already draws slashes, dust, afterimages and projectiles for each move.
"""
import copy
import hashlib
import json
import math
import sys
from io import BytesIO
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(HERE))
import motion as M  # noqa: E402  (rig, sword and the twenty-frame motion specs)
import motion_states as S  # noqa: E402  (hurt, knockdown, grabbed, death, victory, cast, ultimate opening)

OUTL = M.OUTL
SHIFTED = ("root", "hand_f", "hand_b", "foot_f", "foot_b")
WAVE_GLOW = {1: .15, 2: .3, 3: .45, 4: .65, 5: .85, 6: 1.0}
ALL = lambda n: list(range(1, n + 1))  # noqa: E731

# name: source motion, (fractional) source frames, cell, anchor, replaced asset, source frames drawn in place
CLIPS = {
    "idle": dict(src="idle", frames=list(range(1, 20, 2)), cell=448, anchor=(224, 416), base="barel-idle-stationary-10"),
    "walk": dict(src="walk", frames=list(range(1, 20, 2)), cell=448, anchor=(224, 416), base="barel-walk-revised-10"),
    "dash": dict(src="dash", frames=[2, 3, 4, 6, 9, 12, 15, 16, 18, 20], cell=384, anchor=(200, 352), base="barel-dash-10", dust=True),
    "dash-attack": dict(src="dash_thrust", frames=[3, 5, 6, 8, 9, 10, 13, 15, 17, 20], cell=640, anchor=(320, 576), base="barel-dash-attack-10"),
    "combo0": dict(src="attack_combo", frames=[1, 1.3, 1.65, 2, 3, 3.5, 4, 5, 5.5, 6], cell=384, anchor=(200, 352), base="barel-combo0-dot-10"),
    "combo1": dict(src="attack_combo", frames=[7, 8, 9, 10, 11, 11.5, 12, 12.5, 13, 13], cell=384, anchor=(200, 352), base="barel-combo1-dot-10"),
    "combo2": dict(src="attack_combo", frames=[13, 13.5, 14, 14.5, 15, 16, 17, 18, 19, 20], cell=384, anchor=(200, 352), base="barel-combo2-dot-10"),
    "jump": dict(src="jump", frames=[3, 4, 6, 8, 10, 11, 14, 16, 17, 19], cell=640, anchor=(320, 576), base="barel-jump-revised-10",
                 in_place=range(6, 17)),
    "air-attack": dict(src="jump_attack", frames=[1, 3, 4, 5, 6, 7, 8, 10, 13, 16], cell=448, anchor=(224, 384), base="barel-air-attack-10",
                       in_place=range(1, 21)),
    "hurt": dict(src="hurt", frames=ALL(12), cell=640, anchor=(320, 576), base="barel-hurt-12"),
    "down": dict(src="down", frames=ALL(10), cell=640, anchor=(320, 576), base="barel-knockdown-getup-design-10"),
    "grabbed": dict(src="grabbed", frames=ALL(10), cell=448, anchor=(224, 416), base="barel-grabbed-10"),
}
# BarelNamedMotion sheets: 640 px cells, anchor (320, 580), picked by skill time.
NAMED = {
    "whirl": dict(src="skill_spin_slash", frames=[2, 4, 5, 7, 9, 11, 15, 18], columns=4),
    "leap": dict(src="skill_leap_slam", frames=[2, 4, 6, 8, 9, 11, 12, 14, 16, 19], columns=5, in_place=range(5, 12)),
    "slam": dict(src="skill_ground_slam", frames=[2, 4, 6, 8, 9, 11, 13, 16, 18, 20], columns=5),
    "redwave": dict(src="skill_sword_wave", frames=[1, 3, 5, 6, 7, 8, 12, 15, 18, 20], columns=5, glow=WAVE_GLOW),
    "thrust": dict(src="dash_thrust", frames=[5, 6, 8, 9, 10, 11, 12, 14, 17, 20], columns=5),
    "getup": dict(src="getup", frames=ALL(6), columns=3),
    "death": dict(src="death", frames=ALL(10), columns=5),
    "victory": dict(src="victory", frames=ALL(10), columns=5),
    "cast": dict(src="cast", frames=ALL(10), columns=5, glow=S.CAST_GLOW),
    # ultimate: opening (0-620 ms), four 160 ms slashes, leap-slam finisher (1260-2100 ms, hit at 1580)
    "special0": dict(src="special0", frames=ALL(10), columns=5, glow=S.SPECIAL0_GLOW),
    "special1": dict(src="attack_combo", frames=[1, 1.3, 1.6, 2, 3, 3.3, 3.6, 4, 5, 6], columns=5),
    "special2": dict(src="attack_combo", frames=[7, 7.5, 8, 8.5, 9, 10, 10.5, 11, 12, 13], columns=5),
    "special3": dict(src="dash_thrust", frames=[6, 7, 8, 8.5, 9, 10, 11, 12, 13, 14], columns=5),
    "special4": dict(src="attack_combo", frames=[13, 13.5, 14, 14.5, 15, 16, 16.5, 17, 18, 19], columns=5),
    "special5": dict(src="skill_leap_slam", frames=[3, 4, 6, 8, 9, 11, 12, 14, 17, 20], columns=5),
}
PORTRAIT_CROP, PORTRAIT_SCALE = (94, 50, 173, 140), 2   # head to belt of the rest pose -> 158x180, like the old portrait
NAMED_CELL, NAMED_ANCHOR = 640, (320, 580)


# ---------------------------------------------------------------- poses
def mix(a, b, t):
    if isinstance(a, dict) or isinstance(b, dict):
        a, b = a or {}, b or {}
        return {k: mix(a.get(k, b.get(k)), b.get(k, a.get(k)), t) for k in set(a) | set(b)}
    if a is None or b is None or isinstance(a, (bool, str)) or isinstance(b, (bool, str)):
        return a if a is not None else b          # flags follow the earlier key
    va, vb = np.array(a, float), np.array(b, float)
    v = va + (vb - va) * t
    return tuple(v.tolist()) if v.ndim else float(v)


def pose_at(frames, s):
    i = int(math.floor(s)); t = s - i
    q = copy.deepcopy(frames[i - 1]["q"])
    return q if t < 1e-9 else mix(q, frames[i]["q"], t)


def in_place(q):
    """The game lifts airborne frames by actor.z; drop the rig's own vertical travel."""
    dy = -q.get("root", (0, 0))[1]
    q = dict(q)
    for k in SHIFTED:
        if k in q or k == "root":
            x, y = q.get(k, (0, 0))
            q[k] = (x, y + dy)
    return q


# ---------------------------------------------------------------- drawing
def squash_cell(img, sx, cx):
    n = img.shape[1]
    xx = np.arange(n) + 0.5
    src = np.floor((xx - cx) / sx + cx).astype(int)
    ok = (src >= 0) & (src < n)
    out = np.zeros_like(img)
    out[:, ok] = img[:, src[ok]]
    return out


def glow_cell(sword, level):
    out = np.zeros_like(sword)
    cur = sword[..., 3] > 0
    cols = [M.P["w"], M.P["fr"], M.P["fd"]] if level > .66 else [M.P["fr"], M.P["fd"], M.P["fd"]] if level > .33 else [M.P["fd"]] * 3
    for i in range(1 + int(level * 2.99)):
        p = np.pad(cur, 1)
        nxt = cur | p[:-2, 1:-1] | p[2:, 1:-1] | p[1:-1, :-2] | p[1:-1, 2:]
        ring = nxt & ~cur
        out[ring, :3] = cols[i]; out[ring, 3] = 255
        cur = nxt
    return out


def paste(dst, img, ox, oy):
    ys, xs = np.where(img[..., 3] > 0)
    dst[ys + oy, xs + ox] = img[ys, xs]


def render(q, cell, anchor, airborne=False, glow=0.0, extra=None):
    """Character only, in a game cell with the rig's ground point (128, 240) on the anchor."""
    rig = M.rig()
    layers = rig.pose(**{**q, "no_sword": True})
    ox, oy = anchor[0] - 128, anchor[1] - 240
    sword = M.render_sword(rig.hand_f[0] + ox, rig.hand_f[1] + oy, rig.sword_world, size=cell)
    # grounded blades stop at the floor (or the buried depth); airborne ones may hang below the feet
    clip = cell if airborne else int(q["sword_clip"]) + oy if q.get("sword_clip") else anchor[1] + 1
    if sword[clip:, :, 3].any():
        sword[clip:] = 0
        row = sword[clip - 1]; row[row[:, 3] > 0, :3] = OUTL
    sx = q.get("sx", 1.0) * (-1 if q.get("flip") else 1)
    if sx != 1.0:
        sword = squash_cell(sword, sx, 128 + ox)
    out = np.zeros((cell, cell, 4), np.uint8)
    over = q.get("sword_layer") == "sword_over"
    for name in M.LAYERS[:8]:
        paste(out, layers[name], ox, oy)
    if glow > 0:
        g = glow_cell(sword, glow); m = g[..., 3] > 0; out[m] = g[m]
    if not over:
        m = sword[..., 3] > 0; out[m] = sword[m]
    paste(out, layers["arm_front"], ox, oy)
    if over:
        m = sword[..., 3] > 0; out[m] = sword[m]
    if extra is not None:
        paste(out, extra, ox, oy)
    return out


def frames_for(spec):
    src = M.MOTIONS[spec["src"]]()["frames"]
    keep = spec.get("in_place", ())
    out = []
    for s in spec["frames"]:
        q = pose_at(src, s)
        airborne = int(round(s)) in keep
        if airborne:
            q = in_place(q)
        out.append((s, q, airborne))
    return out


def body_height():
    a = np.zeros((M.N, M.N), bool)
    for img in M.rig().pose().values():
        a |= img[..., 3] > 0
    rows = np.where(a.any(1))[0]
    return int(rows.max() - rows.min() + 1)


# ---------------------------------------------------------------- writers
def write_clip(name, spec, height):
    folder = f"barel-remake-{name}-{len(spec['frames'])}"
    src_dir, exp_dir = ROOT / "assets/aseprite" / folder, ROOT / "assets/aseprite/exports" / folder
    src_dir.mkdir(parents=True, exist_ok=True); exp_dir.mkdir(parents=True, exist_ok=True)
    base = json.loads((ROOT / "assets/aseprite" / spec["base"] / f"{spec['base']}.animation.json").read_text(encoding="utf-8"))
    durations = base["expectedDurationsMs"]
    cell, (ax, ay) = spec["cell"], spec["anchor"]
    assert list(base["anchor"]) == [ax, ay], (name, base["anchor"])
    cells = []
    for i, (s, q, airborne) in enumerate(frames_for(spec)):
        extra = None
        if spec.get("dust") and 15 <= s <= 17:
            extra = M.dust(M.blank(), 160, M.GROUND_F - 1, (s - 14) / 4, n=6, spread=8, seed=5, size=3.5, dirx=1, rise=8)
        img = render(q, cell, (ax, ay), airborne, extra=extra)
        Image.fromarray(img).save(src_dir / f"F{i + 1:02d}.png")
        cells.append(img)
    n = len(cells)
    assert n == len(durations), (name, n, len(durations))
    strip = np.concatenate(cells, 1)
    Image.fromarray(strip).save(exp_dir / f"{folder}.png", optimize=True)
    Image.fromarray(strip).save(src_dir / "review-strip.png", optimize=True)
    clip = base["clip"]
    sheet = {"frames": [{"filename": f"F{i + 1:02d}.png", "frame": {"x": i * cell, "y": 0, "w": cell, "h": cell},
                         "rotated": False, "trimmed": False, "spriteSourceSize": {"x": 0, "y": 0, "w": cell, "h": cell},
                         "sourceSize": {"w": cell, "h": cell}, "duration": d} for i, d in enumerate(durations)],
             "meta": {"image": f"{folder}.png", "size": {"w": cell * n, "h": cell}, "scale": "1",
                      "frameTags": [{"name": clip, "from": 0, "to": n - 1, "direction": "forward"}]}}
    (exp_dir / f"{folder}.json").write_text(json.dumps(sheet, indent=1) + "\n", encoding="utf-8")
    meta = copy.deepcopy(base)
    for k in ("separation", "separationReview", "previewBounds"):
        meta.pop(k, None)
    meta["sprite"] = f"../exports/{folder}/{folder}.json"
    meta["frameOffsets"] = [[0, 0] for _ in range(n)]
    meta["renderScale"] = 142 / height
    key = "newNeutralHeight" if "attackId" in base else "newBodyHeight"
    meta["alignment"] = {"referenceLegacyHeight": 142, key: height, "canvasGround": ay, "worldOffsetsApplied": False,
                         "method": "Rig ground point (128,240) on the anchor; airborne frames drawn in place (actor.z lifts them)"}
    if name == "idle":
        a = np.zeros((cell, cell), bool)
        for img in cells:
            a |= img[..., 3] > 0
        ys, xs = np.where(a)
        meta["previewBounds"] = [int(xs.min() - ax), int(ys.min() - ay), int(xs.max() + 1 - ax), 0]
    meta["source"] = {"generator": "tools/barel-remake/build.py", "motion": spec["src"], "sourceFrames": [s for s, _, _ in frames_for(spec)],
                      "replaces": spec["base"], "redrawn": True, "effectsBaked": bool(spec.get("dust"))}
    (src_dir / f"{folder}.animation.json").write_text(json.dumps(meta, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return folder


def write_named(name, spec, height):
    cols = spec["columns"]
    frames = frames_for(spec)
    rows = math.ceil(len(frames) / cols)
    atlas = np.zeros((rows * NAMED_CELL, cols * NAMED_CELL, 4), np.uint8)
    for i, (s, q, airborne) in enumerate(frames):
        glow = spec.get("glow", {}).get(int(s), 0.0)
        img = render(q, NAMED_CELL, NAMED_ANCHOR, airborne, glow=glow)
        r, c = divmod(i, cols)
        atlas[r * NAMED_CELL:(r + 1) * NAMED_CELL, c * NAMED_CELL:(c + 1) * NAMED_CELL] = img
    buf = BytesIO(); Image.fromarray(atlas).save(buf, format="PNG", optimize=True)
    data = buf.getvalue()
    path = f"assets/runtime/{hashlib.sha256(data).hexdigest()[:24]}.png"
    (ROOT / path).write_bytes(data)
    return {"path": path, "columns": cols, "frames": len(frames), "scale": 142 / height}


def save_runtime_png(img):
    buf = BytesIO(); Image.fromarray(img).save(buf, format="PNG", optimize=True)
    data = buf.getvalue()
    path = f"assets/runtime/{hashlib.sha256(data).hexdigest()[:24]}.png"
    (ROOT / path).write_bytes(data)
    return path


def write_portrait():
    x0, y0, x1, y1 = PORTRAIT_CROP
    img = render(M.MOTIONS["idle"]()["frames"][0]["q"], M.N, (128, 240))[y0:y1, x0:x1]
    return save_runtime_png(np.repeat(np.repeat(img, PORTRAIT_SCALE, 0), PORTRAIT_SCALE, 1))


def main():
    height = body_height()
    folders = [write_clip(n, s, height) for n, s in CLIPS.items()]
    named = {n: write_named(n, s, height) for n, s in NAMED.items()}
    portrait = write_portrait()
    generated = {v["path"] for v in named.values()} | {portrait}
    manifest = ROOT / "data/runtime-assets.json"
    old = json.loads(manifest.read_text(encoding="utf-8"))
    record = HERE / "named.json"
    stale = set(json.loads(record.read_text(encoding="utf-8")).get("paths", [])) if record.is_file() else set()
    for p in stale - generated:
        (ROOT / p).unlink(missing_ok=True)
    manifest.write_text(json.dumps(sorted((set(old) - stale) | generated), indent=2) + "\n", encoding="utf-8")
    record.write_text(json.dumps({"paths": sorted(generated)}, indent=2) + "\n", encoding="utf-8")
    (ROOT / "src/animation/barel-remake-data.js").write_text(
        "// Generated by tools/barel-remake/build.py. Remade Barel sheets for BarelNamedMotion and the HUD portrait.\n"
        "globalThis.BAREL_REMAKE_NAMED_DATA = " + json.dumps(named, indent=2) + ";\n"
        "globalThis.BAREL_REMAKE_PORTRAIT_DATA = " + json.dumps(portrait) + ";\n", encoding="utf-8")
    print(json.dumps({"bodyHeight": height, "renderScale": 142 / height, "clips": folders, "portrait": portrait,
                      "named": {k: v["path"] for k, v in named.items()}}, indent=2))


if __name__ == "__main__":
    main()
