import hashlib
import json
import shutil
from pathlib import Path
from PIL import Image
root=Path(__file__).resolve().parents[1]
folder=root/'assets/aseprite/barel-idle-dot-10'
digest=hashlib.sha256((folder/'source/original.png').read_bytes()).hexdigest()
assert digest=='a761ff668069f25777d976d558706ec41f32ecf7541df44ceead725c571f7fac'
boxes=[Image.open(folder/f'F{i:02}.png').getbbox() for i in range(1,11)]
height=boxes[0][3]-boxes[0][1]
offsets=[[0,416-b[3]] for b in boxes]
bounds=[min(b[0]-224 for b in boxes),min(b[1]-416+o[1] for b,o in zip(boxes,offsets)),
        max(b[2]-224 for b in boxes),max(b[3]-416+o[1] for b,o in zip(boxes,offsets))]
m={'schemaVersion':1,'character':'barel','animationId':'idle','animationType':'loop','loop':True,
 'clip':'idle','sprite':'../exports/barel-idle-dot-10/barel-idle-dot-10.json','anchor':[224,416],
 'frameOffsets':offsets,'expectedDurationsMs':[130]*10,'durationMs':1300,'renderScale':142/height,
 'previewBounds':bounds,'alignment':{'referenceLegacyHeight':142,'newBodyHeight':height,'worldOffsetsApplied':False},
 'clock':{'source':'tick * MS','legacyPeriodMs':1300,'resetOnIdleEntry':False},
 'source':{'file':'source/original.png','sha256':digest,'resampled':False,'redrawn':False,'pixelClones':False}}
(folder/'barel-idle-dot-10.animation.json').write_text(json.dumps(m,indent=2)+'\n',encoding='utf-8')
for ext in ['png','json']:shutil.copy2(root/f'assets/aseprite/exports/barel-idle-dot-10/barel-idle-dot-10.{ext}',folder/f'barel-idle-dot-10.{ext}')
print('Idle dot: body',height,'1300ms, preview bounds',bounds)
