"""Reuse unchanged combat schedules, registering the three new dot sheets."""
import hashlib
import json
import shutil
from pathlib import Path
from PIL import Image

root=Path(__file__).resolve().parents[1]
digests=['ea6d36d761942e4bcbbf607983a90d814dcc14614e3b26abb012fba4424a4104',
         '45f40be72dbe53afd34bbd0b376c65de95ed4bc0514b5c1cd65ca1bd0b7263f8',
         '2e405630dfa86ec750e052248549fcfb462fd4e9c5f13377a9786fd0dd189f1c']
for i,neutral in enumerate([0,8,9]):
    name=f'barel-combo{i}-dot-10';folder=root/'assets/aseprite'/name
    digest=hashlib.sha256((folder/'source/original.png').read_bytes()).hexdigest();assert digest==digests[i]
    m=json.loads((root/f'assets/aseprite/barel-combo{i}-10/barel-combo{i}-10.animation.json').read_text())
    audit=json.loads((folder/'separation.json').read_text())
    boxes=[Image.open(folder/f'F{f:02}.png').getbbox() for f in range(1,11)]
    height=boxes[neutral][3]-boxes[neutral][1]
    m['sprite']=f'../exports/{name}/{name}.json';m['anchor']=audit['anchor']
    m['frameOffsets']=[[0,352-box[3]] for box in boxes];m['renderScale']=142/height
    m['source']={'file':'source/original.png','sha256':digest,'resampled':False,'redrawn':False,'pixelClones':False}
    m['alignment']={'referenceLegacyHeight':142,'newNeutralHeight':height,'neutralFrame':neutral+1,
                    'canvasGround':352,'worldOffsetsApplied':False,'note':'Original dot source density; shared display scale and sole alignment only'}
    (folder/f'{name}.animation.json').write_text(json.dumps(m,indent=2)+'\n',encoding='utf-8')
    for extension in ['png','json']:
        shutil.copy2(root/f'assets/aseprite/exports/{name}/{name}.{extension}',folder/f'{name}.{extension}')
    print(name,'neutral height',height,'duration',m['combat']['durationMs'])
