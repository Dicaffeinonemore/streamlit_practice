"""Register original walking pixels without foot locking or simulation changes."""
import hashlib
import json
import shutil
from pathlib import Path
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
folder=ROOT/'assets/aseprite/barel-walk-dot-10'
assert hashlib.sha256((folder/'source/original.png').read_bytes()).hexdigest()=='f9866fda2afda4135f74646f1087be6ec5630cdc599075eac7c67802776b48ed'
audit=json.loads((folder/'separation.json').read_text())
images=[Image.open(folder/f'F{i:02}.png').convert('RGBA') for i in range(1,11)]
feet=[]
for im in images:
    p=im.load()
    groups=[]
    for lo,hi in [(0,200),(220,448)]:
        points=[(x,y) for y in range(390,417) for x in range(lo,hi) if p[x,y][3]>=128]
        bottom=max(y for x,y in points)
        sole=[x for x,y in points if y>=bottom-3]
        groups.append({'bottom':bottom,'soleX':sum(sole)/len(sole)})
    feet.append({'rear':groups[0],'front':groups[1]})
height=images[0].getbbox()[3]-images[0].getbbox()[1]
scale=142/height
offsets=[[0,416-im.getbbox()[3]] for im in images]
front=[f['front']['soleX'] for f in feet]
gait={'feet':feet,'frontSoleRangeSourcePx':max(front)-min(front),
      'frontSoleRangeWorldPx':(max(front)-min(front))*scale*.72,
      'worldTravelPerCycle':167.4,'approved':False,
      'reviewedIn':['local Chrome','local Streamlit iframe'],
      'reason':'Front foot remains the forward ground contact throughout the cycle without alternating stance. Original gait preserved at the unchanged 900ms period / 186 world units per second.',
      'activation':{'defaultMode':'aseprite10','reason':'User requested this supplied dot walk as the default; preserve the original gait.'}}
metadata={'schemaVersion':1,'character':'barel','animationId':'walk','animationType':'loop','loop':True,
 'clip':'walk','sprite':'../exports/barel-walk-dot-10/barel-walk-dot-10.json','anchor':audit['anchor'],
 'frameOffsets':offsets,'renderScale':scale,'durationMs':900,'expectedDurationsMs':[90]*10,
 'source':{'file':'source/original.png','sha256':hashlib.sha256((folder/'source/original.png').read_bytes()).hexdigest(),
           'resampled':False,'redrawn':False,'pixelClones':False},
 'alignment':{'referenceLegacyHeight':142,'newBodyHeight':height,'canvasGround':416,'worldOffsetsApplied':False},
 'clock':{'source':'player.walkTime','legacyPeriodMs':900,'resetOnStart':True,'continueOnFacingChange':True},
 'visualReview':gait}
(folder/'barel-walk-dot-10.animation.json').write_text(json.dumps(metadata,indent=2)+'\n',encoding='utf-8')
for extension in ['png','json']:
    shutil.copy2(ROOT/f'assets/aseprite/exports/barel-walk-dot-10/barel-walk-dot-10.{extension}',folder/f'barel-walk-dot-10.{extension}')
print(json.dumps({'height':height,'scale':scale,'offsets':offsets,'gait':gait},indent=2))
