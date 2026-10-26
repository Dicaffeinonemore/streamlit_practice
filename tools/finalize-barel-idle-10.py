"""Register idle with the original 1300ms clock and measured sole corrections."""
import hashlib
import json
from pathlib import Path

from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
folder=ROOT/"assets/aseprite/barel-idle-10"
digest="9e910d98d75c7248427eb9d08bd4bba84a365062180c1e5814a8ff6d6ceb61e8"
assert hashlib.sha256((folder/"source/original.png").read_bytes()).hexdigest()==digest
source=Image.open(folder/"source/original.png")
head=source.getchannel("A").crop((90,185,180,250)).point(lambda a:255 if a>=128 else 0).getbbox()
head_top=185+head[1]
audit=json.loads((folder/"separation.json").read_text())
origin=audit["anchor"]
images=[Image.open(folder/f"F{i:02}.png").convert("RGBA") for i in range(1,11)]
body_height=audit["frames"][0]["sourceAnchor"][1]-head_top
feet=[]
for image in images:
    pixels=image.load()
    left=[x for y in range(400,417) for x in range(180) if pixels[x,y][3]>=128]
    right=[x for y in range(400,417) for x in range(220,448) if pixels[x,y][3]>=128]
    assert left and right
    feet.append({"left":sum(left)/len(left),"right":sum(right)/len(right)})
target=(feet[0]["left"]+feet[0]["right"])/2
offsets=[[round(target-(f["left"]+f["right"])/2,3),origin[1]-image.getbbox()[3]] for f,image in zip(feet,images)]
metadata={
    "schemaVersion":1,"character":"barel","animationId":"idle","animationType":"loop","loop":True,
    "clip":"idle","sprite":"../exports/barel-idle-10/barel-idle-10.json",
    "anchor":origin,"frameOffsets":offsets,"renderScale":142/body_height,
    "durationMs":1300,"expectedDurationsMs":[130]*10,
    "source":{"file":"source/original.png","sha256":digest,"resampled":False,"redrawn":False,
              "pixelCloneRepair":"F1-F9 missing front toes use only unoccluded supplied F10 toe samples; mappings in separation.json"},
    "alignment":{"referenceLegacyHeight":142,"newBodyHeight":body_height,"headSourceTop":head_top,
                 "canvasGround":origin[1],"worldOffsetsApplied":False,
                 "footAnalysis":{"alphaThreshold":128,"rows":[400,417],"centroids":feet,"targetPairMidpoint":target,
                                 "method":"Least-squares common translation of two sole centroids, referenced to F1"}},
    "clock":{"source":"tick * MS","legacyPeriodMs":1300,"resetOnIdleEntry":False},
}
(folder/"barel-idle-10.animation.json").write_text(json.dumps(metadata,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print(f"Saved idle: 10 x 130ms, 1300ms loop, body {body_height}px, measured foot offsets")
