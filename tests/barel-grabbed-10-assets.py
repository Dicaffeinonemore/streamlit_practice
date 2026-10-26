"""Whole original grabbed silhouettes and immutable state/physics code."""
import hashlib
import json
from pathlib import Path
from PIL import Image
root=Path(__file__).resolve().parents[1]
folder=root/'assets/aseprite/barel-grabbed-10';export=root/'assets/aseprite/exports/barel-grabbed-10'
source=Image.open(folder/'source/original.png').convert('RGBA')
m=json.loads((folder/'barel-grabbed-10.animation.json').read_text());audit=json.loads((folder/'separation.json').read_text())
data=json.loads((export/'barel-grabbed-10.json').read_text());sheet=Image.open(export/'barel-grabbed-10.png').convert('RGBA')
assert source.size==(1600,533) and source.getpixel((0,0))[3]==0
assert hashlib.sha256((folder/'source/original.png').read_bytes()).hexdigest()==m['source']['sha256']
assert len(data['frames'])==10 and [f['duration'] for f in data['frames']]==[65]*10
assert m['durationMs']==650 and m['loopFromFrame']==2 and m['loopDurationMs']==520
assert m['clock']=={'source':'player.t * MS','legacyPeriodMs':650}
assert abs(m['renderScale']*244-142)<1e-9
assert data['meta']['frameTags'][0]['name']=='grabbed'
for ext in ['png','json']:assert (folder/f'barel-grabbed-10.{ext}').read_bytes()==(export/f'barel-grabbed-10.{ext}').read_bytes()
used=set();results=[]
for i,record in enumerate(audit['frames']):
    im=Image.open(folder/f'F{i+1:02}.png').convert('RGBA');box=im.getbbox()
    assert im.size==(448,448) and 0<box[0]<box[2]<448 and 0<box[1]<box[3]<448
    assert box[3]+m['frameOffsets'][i][1]==416
    f=data['frames'][i]['frame'];assert im.tobytes()==sheet.crop((f['x'],f['y'],f['x']+f['w'],f['y']+f['h'])).tobytes()
    ax,ay=record['sourceAnchor'];points=set()
    for y in range(448):
        for x in range(448):
            rgba=im.getpixel((x,y))
            if rgba[3]:
                original=(x-224+ax,y-416+ay)
                assert rgba[3]>=32 and original not in used and rgba==source.getpixel(original)
                used.add(original);points.add((x,y))
    assert len(points)==record['retainedPixels'] and not record['pixelClones']
    remaining=points.copy();stack=[remaining.pop()]
    while stack:
        x,y=stack.pop()
        for dx,dy in [(-1,0),(1,0),(0,-1),(0,1)]:
            p=(x+dx,y+dy)
            if p in remaining:remaining.remove(p);stack.append(p)
    assert not remaining,('Detached fragment',i)
    results.append({'frame':i+1,'bbox':box,'pixels':len(points),'components':1,'groundOffset':m['frameOffsets'][i][1]})
before=json.loads((root/'artifacts/barel-grabbed-10/before-hashes.json').read_text(encoding='utf-8-sig'))
for name,digest in before.items():
    if name!='barel-runtime.js':assert hashlib.sha256((root/name).read_bytes()).hexdigest()==digest,name
runtime=(root/'barel-runtime.js').read_bytes()
new=b"  if(p.st==='grabbed')return globalThis.BarelGrabbed?.frameFor(p,MS) || barelFrame('hook',t/650,true);"
old=b"  if(p.st==='grabbed')return barelFrame('hook',t/650,true);"
assert runtime.count(new)==1 and hashlib.sha256(runtime.replace(new,old)).hexdigest()==before['barel-runtime.js']
(root/'artifacts/barel-grabbed-10/asset-checks.json').write_text(json.dumps({'frames':results,'sourcePixels':len(used),
 'protectedFiles':[n for n in before if n!='barel-runtime.js'],'gameAndBothGrabSystemsUnchanged':True},indent=2))
print(f'PASS grabbed: ten complete source RGBA silhouettes, no clones/crops/foreign pixels, aligned soles; {len(before)-1} protected files including game/both grab systems unchanged')
