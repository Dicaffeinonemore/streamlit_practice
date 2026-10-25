"""Source provenance, cel/boot isolation, registration and protected combo0 files."""
import hashlib
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
folder = ROOT / "assets/aseprite/barel-combo1-10"
export = ROOT / "assets/aseprite/exports/barel-combo1-10"
metadata = json.loads((folder / "barel-combo1-10.animation.json").read_text())
audit = json.loads((folder / "separation.json").read_text())
data = json.loads((export / "barel-combo1-10.json").read_text())
source = Image.open(folder / "source/original.png").convert("RGBA")
assert hashlib.sha256((folder / "source/original.png").read_bytes()).hexdigest() == metadata["source"]["sha256"]
assert len(data["frames"]) == 10
assert [f["duration"] for f in data["frames"]] == [70,35,35,30,30,20,20,20,25,25]
assert sum(f["duration"] for f in data["frames"]) == 310
assert data["frames"][0]["duration"] == 70
assert sum(f["duration"] for f in data["frames"][:2]) == 105
assert sum(f["duration"] for f in data["frames"][:4]) == 170
assert sum(f["duration"] for f in data["frames"][:5]) == 200
sheet = Image.open(export / "barel-combo1-10.png").convert("RGBA")
results = []
for i in range(10):
    image = Image.open(folder / f"F{i+1:02}.png").convert("RGBA")
    assert image.size == (384, 384)
    bbox = image.getbbox()
    assert 0 < bbox[0] < bbox[2] < 384 and 0 < bbox[1] < bbox[3] < 384, (i, bbox)
    assert bbox[3] + metadata["frameOffsets"][i][1] == metadata["anchor"][1]
    assert image.tobytes() == sheet.crop((384*i, 0, 384*(i+1), 384)).tobytes()
    ax, ay = audit["frames"][i]["sourceAnchor"]
    clones = {(x,y):(sx,sy) for x,y,sx,sy in audit["frames"][i]["sourcePixelClones"]}
    assert i==7 or not clones
    assert all(900 <= sx <= 950 and 506 <= sy <= 532 for sx,sy in clones.values())
    pixels, occupied = image.load(), set()
    for y in range(384):
        for x in range(384):
            rgba = pixels[x,y]
            assert rgba[3] == 0 or rgba[3] >= audit["alphaThreshold"]
            if rgba[3]:
                original = clones.get((x,y),(x-audit["anchor"][0]+ax,y-audit["anchor"][1]+ay))
                assert rgba == source.getpixel(original), (i,x,y)
                occupied.add((x,y))
    assert len(occupied)>15000
    stack=[next(iter(occupied))];remaining=occupied.copy();remaining.remove(stack[0])
    while stack:
        x,y=stack.pop()
        for dx in (-1,0,1):
            for dy in (-1,0,1):
                point=(x+dx,y+dy)
                if point in remaining: remaining.remove(point);stack.append(point)
    assert not remaining, f"F{i+1}: detached fragment/boot"
    if i==7: assert sum(1 for x,y in occupied if 100<=x<=150 and y>=345)>50, "F8 rear boot preserved"
    results.append({"frame":i+1,"pixels":len(occupied),"bbox":bbox,"components":1,
                    "sourcePixelClonesRetained":sum(1 for p in occupied if p in clones)})
assert abs(metadata["renderScale"]*metadata["alignment"]["newNeutralHeight"]-142)<1e-9
out=ROOT/"artifacts/barel-combo1-10";out.mkdir(exist_ok=True)
before=json.loads((out/"before-hashes.json").read_text())
for name,digest in before.items(): assert hashlib.sha256((ROOT/name).read_bytes()).hexdigest()==digest, name
(out/"asset-checks.json").write_text(json.dumps({"frames":results,"protectedFiles":list(before)},indent=2))
print("PASS combo1: 10 cels, original RGBA/provenance, connected boot, no fragments/clipping, aligned soles, 310ms, rising F3-F4 hits plus F5 follow-through, protected combo0/combat unchanged")
