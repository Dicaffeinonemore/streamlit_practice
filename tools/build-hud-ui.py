"""Build the player / boss HUD atlas from the supplied 1672 x 941 design (assets_src/hud).

The design is a full-screen overlay. Everything that changes in play is removed from the frames
and drawn live by pixel-ui.js: the name, lives, score and stage text, the bar fills and the boss
name. The original fills are kept as strips in the empty middle of the atlas.

    python tools/build-hud-ui.py
"""
import hashlib
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "assets_src/hud/player-boss-hud.png"
RUNTIME = ROOT / "assets/runtime"
ART_JS = ROOT / "hud-ui-art.js"
MANIFEST = ROOT / "data/runtime-assets.json"

# Interiors of the three bars (inclusive left/top, exclusive right/bottom).
HP = (152, 99, 584, 122)
SP = (56, 147, 563, 168)
BOSS = (475, 850, 1617, 874)
# Fill strips: source box -> top-left in the atlas.
STRIPS = {
    "hp": ((153, 100, 584, 121), (100, 400)),
    "sp": ((57, 147, 562, 168), (100, 440)),
    "boss": ((476, 851, 1521, 873), (100, 480)),
    "bossLow": ((1522, 851, 1616, 873), (100, 520)),
}
PLAYER_TEXT = (137, 8, 800, 78)      # "varel  1P×3  86600  level 1"
BOSS_PLATE = (139, 829, 462, 880)   # the dark plate behind "황금왕 아우렐리온"


def fill(px, box, top, bottom):
    x0, y0, x1, y1 = box
    for y in range(y0, y1):
        t = (y - y0) / max(1, y1 - y0 - 1)
        colour = tuple(round(a + (b - a) * t) for a, b in zip(top, bottom)) + (255,)
        for x in range(x0, x1):
            px[x, y] = colour


def main() -> None:
    source = Image.open(SOURCE).convert("RGBA")
    assert source.size == (1672, 941), source.size
    atlas = source.copy()
    px = atlas.load()
    x0, y0, x1, y1 = PLAYER_TEXT
    for y in range(y0, y1):
        for x in range(x0, x1):
            px[x, y] = (0, 0, 0, 0)
    fill(px, HP, (22, 5, 7), (9, 2, 3))
    fill(px, SP, (4, 10, 24), (2, 4, 11))
    fill(px, BOSS, (22, 5, 7), (9, 2, 3))
    fill(px, BOSS_PLATE, (6, 5, 5), (21, 18, 13))
    # The name's tops stood above the plate; clear them and mirror the bottom rim as a top rim.
    px0, py0, px1, _ = BOSS_PLATE
    for y in range(800, py0):
        for x in range(px0, px1):
            px[x, y] = (0, 0, 0, 0)
    atlas.paste(source.crop((px0, 880, px1, 893)).transpose(Image.Transpose.FLIP_TOP_BOTTOM), (px0, py0 - 13))
    for box, at in STRIPS.values():
        atlas.paste(source.crop(box), at)
    RUNTIME.mkdir(parents=True, exist_ok=True)
    tmp = RUNTIME / "_hud.png"
    atlas.save(tmp, optimize=True)
    data = tmp.read_bytes()
    name = f"assets/runtime/{hashlib.sha256(data).hexdigest()[:24]}.png"
    (ROOT / name).write_bytes(data)
    tmp.unlink()
    previous = None
    if ART_JS.exists():
        text = ART_JS.read_text(encoding="utf-8")
        start = text.find("'assets/runtime/")
        if start >= 0:
            previous = text[start + 1:text.index("'", start + 1)]
    ART_JS.write_text(
        "'use strict';\n"
        "// Player and boss HUD (design 2026-11): built by tools/build-hud-ui.py from assets_src/hud.\n"
        f"const HUD_UI_SOURCE = '{name}';\n",
        encoding="utf-8", newline="\n")
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    manifest = [a for a in manifest if a != previous]
    if name not in manifest:
        manifest.append(name)
    manifest.sort()
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(name)


if __name__ == "__main__":
    main()
