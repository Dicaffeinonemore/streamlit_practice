import hashlib
import json
import shutil
from pathlib import Path
from PIL import Image
root=Path(__file__).resolve().parents[1]
folder=root/'assets/aseprite/barel-grabbed-10'
digest=hashlib.sha256((folder/'source/original.png').read_bytes()).hexdigest()
assert digest=='ac160cbc2c3f4d358a1167c449ff1a8712520552760cb2a5558e5f5e808cd500'
boxes=[Image.open(folder/f'F{i:02}.png').getbbox() for i in range(1,11)]
height=boxes[0][3]-boxes[0][1]
m={'schemaVersion':1,'character':'barel','animationId':'grabbed','animationType':'loop','loop':True,
 'clip':'grabbed','sprite':'../exports/barel-grabbed-10/barel-grabbed-10.json','anchor':[224,416],
 'frameOffsets':[[0,416-b[3]] for b in boxes],'expectedDurationsMs':[65]*10,'durationMs':650,
 'loopFromFrame':2,'loopDurationMs':520,'renderScale':142/height,
 'clock':{'source':'player.t * MS','legacyPeriodMs':650},
 'alignment':{'referenceLegacyHeight':142,'newBodyHeight':height,'worldOffsetsApplied':False},
 'source':{'file':'source/original.png','sha256':digest,'resampled':False,'redrawn':False,'pixelClones':False}}
(folder/'barel-grabbed-10.animation.json').write_text(json.dumps(m,indent=2)+'\n',encoding='utf-8')
for ext in ['png','json']:shutil.copy2(root/f'assets/aseprite/exports/barel-grabbed-10/barel-grabbed-10.{ext}',folder/f'barel-grabbed-10.{ext}')
print('Grabbed: ten original components, body',height,'650ms entry, F3-F10 520ms loop')
