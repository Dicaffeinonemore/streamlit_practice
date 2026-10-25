"""Dash registration and the existing 190ms clock, without resampling."""
import hashlib
import json
import shutil
from pathlib import Path
from PIL import Image

root=Path(__file__).resolve().parents[1]
folder=root/'assets/aseprite/barel-dash-10'
digest=hashlib.sha256((folder/'source/original.png').read_bytes()).hexdigest()
assert digest=='93ac58e9556e8bf7cdd1050372b1b3c6a4636354660720b7042758d755d648d9'
audit=json.loads((folder/'separation.json').read_text())
neutral=Image.open(folder/'F10.png').getbbox();height=neutral[3]-neutral[1]
m={'schemaVersion':1,'character':'barel','animationId':'dash','animationType':'oneshot','loop':False,
   'clip':'dash','sprite':'../exports/barel-dash-10/barel-dash-10.json','anchor':[200,352],
   'frameOffsets':[[0,0] for _ in range(10)],'expectedDurationsMs':[19]*10,'durationMs':190,
   'renderScale':142/height,'alignment':{'referenceLegacyHeight':142,'newBodyHeight':height,
       'method':'Anatomical pelvis X / per-pose sole Y; baked dust is not used to lock the feet','worldOffsetsApplied':False},
   'clock':{'source':'player.t * MS','legacyDurationMs':190},
   'source':{'file':'source/original.png','sha256':digest,'resampled':False,'redrawn':False,'pixelClones':False},
   'effects':{'bakedSpeedLines':True,'bakedDust':True,'extraSpeedLines':False,
       'afterimageIntervalMs':1000/30,'afterimageLifeMs':150,'afterimageMax':4,'exitFadeMs':50,
       'color':'#9E1A1F','peakAlpha':0.18},
   'separationReview':{'method':'Minimum-alpha seams with original RGBA; disconnected remnants excluded',
       'overlap':'Seven independent groups: F1, F2, F3, F4-F6, F7-F8, F9, F10. Only shared blur/dust groups divided at recorded seams; hidden pixels not reconstructed.'}}
(folder/'barel-dash-10.animation.json').write_text(json.dumps(m,indent=2)+'\n',encoding='utf-8')
for extension in ['png','json']:
    shutil.copy2(root/f'assets/aseprite/exports/barel-dash-10/barel-dash-10.{extension}',folder/f'barel-dash-10.{extension}')
print(f'Saved dash: 10 x 19ms, height {height}, render scale {142/height}')
