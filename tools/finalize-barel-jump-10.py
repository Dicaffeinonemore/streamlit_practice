"""Jump timing follows existing jumpTime; landing uses existing free-state t."""
import hashlib
import json
import shutil
from pathlib import Path
from PIL import Image

root=Path(__file__).resolve().parents[1]
folder=root/'assets/aseprite/barel-jump-10'
digest=hashlib.sha256((folder/'source/original.png').read_bytes()).hexdigest()
assert digest=='f4a9ad3d085ff18d620b85e3c8e0f44ee84ee83dd8f147ea7d1d6879cc85d60e'
audit=json.loads((folder/'separation.json').read_text())
boxes=[Image.open(folder/f'F{i:02}.png').getbbox() for i in range(1,11)]
height=boxes[0][3]-boxes[0][1]
m={'schemaVersion':1,'character':'barel','animationId':'jump','animationType':'oneshot','loop':False,
   'clip':'jump','sprite':'../exports/barel-jump-10/barel-jump-10.json','anchor':[200,352],
   'frameOffsets':[[0,352-b[3]] for b in boxes],'expectedDurationsMs':[17,33,83,84,66,50,134,133,34,50],
   'durationMs':684,'renderScale':142/height,
   'alignment':{'referenceLegacyHeight':142,'newBodyHeight':height,'worldOffsetsApplied':False,
                'method':'Per-pose source sole removes baked sheet arc. Render subtracts actor.z exactly once.'},
   'clock':{'airSource':'player.jumpTime * MS','airDurationMs':600,
            'landingSource':'(player.t - landingT) * MS','landingDurationMs':84},
   'physicsReference':{'initialVz':9.6,'gravityPerTick':0.55,'airTicks':36,'apexTick':18},
   'source':{'file':'source/original.png','sha256':digest,'resampled':False,'redrawn':False,'pixelClones':False}}
(folder/'barel-jump-10.animation.json').write_text(json.dumps(m,indent=2)+'\n',encoding='utf-8')
for ext in ['png','json']:
    shutil.copy2(root/f'assets/aseprite/exports/barel-jump-10/barel-jump-10.{ext}',folder/f'barel-jump-10.{ext}')
print(f'Saved jump: body {height}, 600ms flight + 84ms visual landing, no physics changes')
