"""Verify source density/RGB, cel isolation, ground registration, CLI round trip."""
import hashlib
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
folder = ROOT / "assets/aseprite/barel-combo0-10"
export = ROOT / "assets/aseprite/exports/barel-combo0-10"
metadata = json.loads((folder / "barel-combo0-10.animation.json").read_text())
audit = json.loads((folder / "separation.json").read_text())
data = json.loads((export / "barel-combo0-10.json").read_text())
source = Image.open(folder / "source/original.png").convert("RGBA")
assert hashlib.sha256((folder / "source/original.png").read_bytes()).hexdigest() == metadata["source"]["sha256"]
assert len(data["frames"]) == 10
assert [f["duration"] for f in data["frames"]] == metadata["expectedDurationsMs"]
assert sum(f["duration"] for f in data["frames"]) == 350
sheet = Image.open(export / "barel-combo0-10.png").convert("RGBA")
results = []
for i in range(10):
    image = Image.open(folder / f"F{i+1:02}.png").convert("RGBA")
    assert image.size == (384, 384)
    bbox = image.getbbox()
    assert 0 < bbox[0] < bbox[2] < 384 and 0 < bbox[1] < bbox[3] < 384, (i, bbox)
    assert bbox[3] + metadata["frameOffsets"][i][1] == metadata["anchor"][1]
    assert image.tobytes() == sheet.crop((384*i, 0, 384*(i+1), 384)).tobytes()
    ax, ay = audit["frames"][i]["sourceAnchor"]
    pixels = image.load()
    occupied = set()
    for y in range(384):
        for x in range(384):
            rgba = pixels[x, y]
            assert rgba[3] in (0, 255)
            if rgba[3]:
                assert rgba == source.getpixel((x-160+ax, y-352+ay)), (i, x, y)
                occupied.add((x, y))
    assert len(occupied) > 15000
    stack = [next(iter(occupied))]
    remaining = occupied.copy()
    remaining.remove(stack[0])
    while stack:
        x, y = stack.pop()
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                point = x+dx, y+dy
                if point in remaining:
                    remaining.remove(point)
                    stack.append(point)
    assert not remaining, f"F{i+1}: detached fragment"
    results.append({"frame": i+1, "pixels": len(occupied), "bbox": bbox,
                    "components": 1, "sourceRgbUnchanged": True, "groundAligned": True})
assert metadata["renderScale"] * (353-107) == 142
before = {
    "game.js": "e96ecfacb977b1d9befcbacbe795bab9d71f00c60f49ff88e5385cce8f46d8b0",
    "motion.js": "27a3d33623b0b7840eb40bff622448eeb9e469276efd6d17d700c5c42488ddc7",
    "barel-art.js": "67d40801261e178b25da1ac83158f8815966aed7666f070ea7eacf65f1b633d4",
    "assets/barel/atlas.png": "31399b82a9ee75f073f9df878f8619696b042e2cd1ff167f8ff7e40a20cb61c0",
    "assets/barel/frames.json": "03dacdfe625fbca7f7f64995694a576e369339de1de1d5c98cfece0e260eb19b",
}
preserved = ["game.js", "motion.js", "barel-art.js", "assets/barel/atlas.png", "assets/barel/frames.json"]
for name in preserved:
    assert hashlib.sha256((ROOT / name).read_bytes()).hexdigest() == before[name], name
output = ROOT / "artifacts/barel-combo0-10-v2"
output.mkdir(parents=True, exist_ok=True)
(output / "asset-checks.json").write_text(json.dumps({"frames": results, "preserved": preserved}, indent=2))
print("PASS 10 cels: original RGB/density, one component, transparent background, canvas margins, ground alignment, 350ms, CLI pixels, unchanged combat/legacy assets")
