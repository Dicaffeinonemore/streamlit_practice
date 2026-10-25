"""Reference timeline only: the actual attack still ends on landing."""
import hashlib
import json
import shutil
from pathlib import Path
from PIL import Image
root=Path(__file__).resolve().parents[1]
folder=root/'assets/aseprite/barel-air-attack-10'
digest=hashlib.sha256((folder/'source/original.png').read_bytes()).hexdigest()
assert digest=='0ade8aa05bc3aa6e30c1afc0f086cad5571051004760dd15306d943fdaec37c9'
box=Image.open(folder/'F10.png').getbbox();height=box[3]-box[1]
m={'schemaVersion':1,'character':'barel','animationId':'air','animationType':'oneshot','loop':False,
 'clip':'air','sprite':'../exports/barel-air-attack-10/barel-air-attack-10.json','anchor':[224,384],
 'frameOffsets':[[0,0] for _ in range(10)],'expectedDurationsMs':[40]*10,'durationMs':400,'renderScale':142/height,
 'alignment':{'referenceLegacyHeight':142,'newBodyHeight':height,'worldOffsetsApplied':False,
              'method':'Pelvis registration; F10 sole defines ground; actor.z applied once'},
 'clock':{'source':'player.t * MS','mapping':'remaining-flight','termination':'landing-or-interrupt',
          'legacyVisualDurationMs':400,'hitPoseFloor':5},
 'combatReference':{'damage':14,'reach':64,'knockdown':True,'hitStopTicks':5,'effectiveHitStopTicks':6,'forwardPerTick':2.6,
                    'active':'every-air-attack-step','gravityPerTick':.55,'maxFlightTicks':36},
 'source':{'file':'source/original.png','sha256':digest,'resampled':False,'redrawn':False,'pixelClones':False}}
(folder/'barel-air-attack-10.animation.json').write_text(json.dumps(m,indent=2)+'\n',encoding='utf-8')
for ext in ['png','json']:shutil.copy2(root/f'assets/aseprite/exports/barel-air-attack-10/barel-air-attack-10.{ext}',folder/f'barel-air-attack-10.{ext}')
print('Saved air attack: legacy 400ms visual reference, actual duration remains landing-dependent; body',height)
