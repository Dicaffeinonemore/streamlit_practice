"""Idle source RGBA/provenance, complete cels, measured registration and regressions."""
import hashlib
import json
from pathlib import Path

from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
folder=ROOT/"assets/aseprite/barel-idle-10"
export=ROOT/"assets/aseprite/exports/barel-idle-10"
m=json.loads((folder/"barel-idle-10.animation.json").read_text())
audit=json.loads((folder/"separation.json").read_text())
data=json.loads((export/"barel-idle-10.json").read_text())
source=Image.open(folder/"source/original.png").convert("RGBA")
assert source.getpixel((0,0))[3]==0
assert hashlib.sha256((folder/"source/original.png").read_bytes()).hexdigest()==m["source"]["sha256"]
assert len(data["frames"])==10 and all(f["duration"]==130 for f in data["frames"])
assert sum(f["duration"] for f in data["frames"])==1300
assert m["loop"] and m["clock"]["legacyPeriodMs"]==1300 and "combat" not in m
sheet=Image.open(export/"barel-idle-10.png").convert("RGBA")
results=[]
for i in range(10):
    image=Image.open(folder/f"F{i+1:02}.png").convert("RGBA")
    assert image.size==(448,448)
    box=image.getbbox()
    assert 0<box[0]<box[2]<448 and 0<box[1]<box[3]<448,(i,box)
    assert box[3]+m["frameOffsets"][i][1]==m["anchor"][1]
    assert image.tobytes()==sheet.crop((448*i,0,448*(i+1),448)).tobytes()
    ax,ay=audit["frames"][i]["sourceAnchor"]
    clones={(x,y):(sx,sy) for x,y,sx,sy in audit["frames"][i]["sourcePixelClones"]}
    assert i<9 or not clones
    assert all(2143<=sx<=2171 and 525<=sy<=553 for sx,sy in clones.values())
    pixels=image.load();occupied=set()
    for y in range(448):
        for x in range(448):
            rgba=pixels[x,y]
            assert rgba[3]==0 or rgba[3]>=audit["alphaThreshold"]
            if rgba[3]:
                original=clones.get((x,y),(x-audit["anchor"][0]+ax,y-audit["anchor"][1]+ay))
                assert rgba==source.getpixel(original),(i,x,y)
                occupied.add((x,y))
    assert len(occupied)>25000
    stack=[next(iter(occupied))];remaining=occupied.copy();remaining.remove(stack[0])
    while stack:
        x,y=stack.pop()
        for dx in (-1,0,1):
            for dy in (-1,0,1):
                point=(x+dx,y+dy)
                if point in remaining:remaining.remove(point);stack.append(point)
    assert not remaining,f"F{i+1}: detached fragment"
    foot=m["alignment"]["footAnalysis"]
    f=foot["centroids"][i]
    corrected=(f["left"]+f["right"])/2+m["frameOffsets"][i][0]
    assert abs(corrected-foot["targetPairMidpoint"])<.001
    assert sum(1 for x,y in occupied if x>290 and 390<=y<=408)>20,"Front toe missing"
    results.append({"frame":i+1,"bbox":box,"pixels":len(occupied),"components":1,
                    "clonedToePixels":sum(1 for p in occupied if p in clones),"groundAligned":True,"correctedFootMidpoint":corrected})
assert abs(m["renderScale"]*m["alignment"]["newBodyHeight"]-142)<1e-9
out=ROOT/"artifacts/barel-idle-10"
before=json.loads((out/"before-hashes.json").read_text())
protected={name:digest for name,digest in before.items() if name!="src/animation/aseprite.js"}
for name,digest in protected.items():assert hashlib.sha256((ROOT/name).read_bytes()).hexdigest()==digest,name
(out/"asset-checks.json").write_text(json.dumps({"frames":results,"protectedFiles":list(protected),
    "sharedAdapterChange":"Adds non-combat loop metadata validation; existing attack contracts regression-tested"},indent=2))
print("PASS idle: 10 original-density/RGBA cels, source toe provenance, complete single-component characters, margins, foot alignment, 1300ms loop, protected combat/combos unchanged")
