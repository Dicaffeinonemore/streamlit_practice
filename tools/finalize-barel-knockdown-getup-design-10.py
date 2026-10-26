"""Register the authored Aseprite clip without changing knockdown physics."""
import json
from pathlib import Path
import numpy as np
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
name='barel-knockdown-getup-design-10'
folder=ROOT/'assets/aseprite'/name
build=json.loads((folder/'build.json').read_text())
idle=json.loads((ROOT/'assets/aseprite/barel-idle-dot-10/barel-idle-dot-10.animation.json').read_text())
def helmet_width(path,band):
    im=Image.open(path).convert('RGBA');a=np.array(im.crop(im.getbbox()))
    metal=(a[:,:,3]>0)&(a[:,:,0]<a[:,:,1]*1.6+12)
    return int(metal[band[0]:band[1]].sum(axis=1).max())
idle_width=helmet_width(ROOT/'assets/aseprite/barel-idle-dot-10/F01.png',(18,38))
down_width=helmet_width(folder/'F01.png',(24,50))
scale=idle_width*idle['renderScale']/down_width
m={'schemaVersion':1,'character':'barel','animationId':'down','animationType':'oneshot','loop':False,
   'clip':'knockdown_getup','sprite':f'../exports/{name}/{name}.json','anchor':build['anchor'],
   'frameOffsets':[[0,0] for _ in range(10)],'expectedDurationsMs':[f['durationMs'] for f in build['frames']],
   'durationMs':build['durationMs'],'renderScale':scale,
   'tickDurations':[3,4,12,3,4,10,6,5,5,4],
   'alignment':{'reference':'idle F1 helmet width / down F1 helmet width','idleHelmetWidth':idle_width,
                'downHelmetWidth':down_width,'idleRenderScale':idle['renderScale']},
   'physicsReference':{'recoveryAfterTick':55,'initialVz':5,'knockback':3.5,'friction':.96,'getupInvulnerability':100}}
(folder/f'{name}.animation.json').write_text(json.dumps(m,indent=2)+'\n')
print(json.dumps({'renderScale':scale,'idleHelmetWidth':idle_width,'downHelmetWidth':down_width,'ticks':sum(m['tickDurations'])}))
