"""Verify original RGBA/density, complete cels and unchanged earlier attacks."""
import hashlib
import json
from pathlib import Path

from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
folder=ROOT/"assets/aseprite/barel-combo2-10"
export=ROOT/"assets/aseprite/exports/barel-combo2-10"
m=json.loads((folder/"barel-combo2-10.animation.json").read_text())
audit=json.loads((folder/"separation.json").read_text())
data=json.loads((export/"barel-combo2-10.json").read_text())
source=Image.open(folder/"source/original.png").convert("RGBA")
assert hashlib.sha256((folder/"source/original.png").read_bytes()).hexdigest()==m["source"]["sha256"]
assert len(data["frames"])==10
assert [f["duration"] for f in data["frames"]]==[70,60,70,20,29,91,30,90,90,130]
assert sum(f["duration"] for f in data["frames"])==680
assert sum(f["duration"] for f in data["frames"][:3])==200
assert sum(f["duration"] for f in data["frames"][:5])==249
assert sum(f["duration"] for f in data["frames"][:7])==370
assert m["terminalAttack"] and m["combat"]["comboLinkMs"] is None
sheet=Image.open(export/"barel-combo2-10.png").convert("RGBA")
results=[]
for i in range(10):
    image=Image.open(folder/f"F{i+1:02}.png").convert("RGBA")
    assert image.size==(384,384)
    box=image.getbbox()
    assert 0<box[0]<box[2]<384 and 0<box[1]<box[3]<384,(i,box)
    assert box[3]+m["frameOffsets"][i][1]==m["anchor"][1]
    assert image.tobytes()==sheet.crop((384*i,0,384*(i+1),384)).tobytes()
    ax,ay=audit["frames"][i]["sourceAnchor"]
    pixels=image.load();occupied=set()
    for y in range(384):
        for x in range(384):
            rgba=pixels[x,y]
            assert rgba[3]==0 or rgba[3]>=audit["alphaThreshold"]
            if rgba[3]:
                assert rgba==source.getpixel((x-audit["anchor"][0]+ax,y-audit["anchor"][1]+ay)),(i,x,y)
                occupied.add((x,y))
    assert len(occupied)>15000
    stack=[next(iter(occupied))];remaining=occupied.copy();remaining.remove(stack[0])
    while stack:
        x,y=stack.pop()
        for dx in (-1,0,1):
            for dy in (-1,0,1):
                point=(x+dx,y+dy)
                if point in remaining:remaining.remove(point);stack.append(point)
    assert not remaining,f"F{i+1}: detached part"
    results.append({"frame":i+1,"pixels":len(occupied),"bbox":box,"components":1,"originalRgba":True})
assert abs(m["renderScale"]*m["alignment"]["newNeutralHeight"]-142)<1e-9
out=ROOT/"artifacts/barel-combo2-10"
before=json.loads((out/"before-hashes.json").read_text())
for name,digest in before.items():assert hashlib.sha256((ROOT/name).read_bytes()).hexdigest()==digest,name
(out/"asset-checks.json").write_text(json.dumps({"frames":results,"protectedFiles":list(before)},indent=2))
print("PASS combo2: 10 original RGBA cels, one connected character, no extra crop/fragments, aligned soles, 680ms, terminal attack, earlier attacks/combat unchanged")
