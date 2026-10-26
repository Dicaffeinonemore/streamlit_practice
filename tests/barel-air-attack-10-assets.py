"""Original aerial pixels, isolated cels, preserved combat and other animations."""
import hashlib
import json
from pathlib import Path
from PIL import Image
root=Path(__file__).resolve().parents[1]
folder=root/'assets/aseprite/barel-air-attack-10';export=root/'assets/aseprite/exports/barel-air-attack-10'
source=Image.open(folder/'source/original.png').convert('RGBA')
m=json.loads((folder/'barel-air-attack-10.animation.json').read_text())
audit=json.loads((folder/'separation.json').read_text())
data=json.loads((export/'barel-air-attack-10.json').read_text())
assert source.size==(1600,686) and source.getpixel((0,0))[3]==0
assert hashlib.sha256((folder/'source/original.png').read_bytes()).hexdigest()==m['source']['sha256']
assert len(data['frames'])==10 and [f['duration'] for f in data['frames']]==[40]*10
assert m['durationMs']==400 and m['clock']['mapping']=='remaining-flight' and m['clock']['termination']=='landing-or-interrupt'
assert m['combatReference']['damage']==14 and m['combatReference']['effectiveHitStopTicks']==6
assert abs(m['renderScale']*190-142)<1e-9
sheet=Image.open(export/'barel-air-attack-10.png').convert('RGBA')
for ext in ['png','json']:assert (folder/f'barel-air-attack-10.{ext}').read_bytes()==(export/f'barel-air-attack-10.{ext}').read_bytes()
used=set();results=[]
for i,record in enumerate(audit['frames']):
    im=Image.open(folder/f'F{i+1:02}.png').convert('RGBA');box=im.getbbox()
    assert im.size==(448,448) and 0<box[0]<box[2]<448 and 0<box[1]<box[3]<448
    assert m['frameOffsets'][i]==[0,0]
    f=data['frames'][i]['frame'];assert im.tobytes()==sheet.crop((f['x'],f['y'],f['x']+f['w'],f['y']+f['h'])).tobytes()
    ax,ay=record['sourceAnchor'];px,py=record['sourcePelvis']
    assert px==ax and py-ay+384==308,'Pelvis registration must be stable'
    points=set()
    for y in range(448):
        for x in range(448):
            rgba=im.getpixel((x,y))
            if rgba[3]:
                original=(x-224+ax,y-384+ay)
                assert rgba[3]>=32 and original not in used and rgba==source.getpixel(original)
                used.add(original);points.add((x,y))
    assert len(points)==record['retainedPixels'] and not record['pixelClones']
    remaining=points.copy();stack=[remaining.pop()]
    while stack:
        x,y=stack.pop()
        for dx in [-1,0,1]:
            for dy in [-1,0,1]:
                p=(x+dx,y+dy)
                if p in remaining:remaining.remove(p);stack.append(p)
    assert not remaining,('Detached fragment',i)
    # Reviewed residue regions must not retain the preceding blade.
    for y in range(448):
        for x in range(448):
            if im.getpixel((x,y))[3]:
                ox,oy=x-224+ax,y-384+ay
                if i==5:assert not (790<=ox<=815 and 434<=oy<=445),'F5 blade fragment in F6'
                if i==9:assert not (1438<=ox<=1458 and 498<=oy<=510),'F9 blade fragment in F10'
    results.append({'frame':i+1,'bbox':box,'sourceAnchor':[ax,ay],'sourcePelvis':[px,py],'pixels':len(points),'components':1})
before=json.loads((root/'artifacts/barel-air-attack-10/before-hashes.json').read_text(encoding='utf-8-sig'))
for name,digest in before.items():
    if name!='barel-runtime.js':assert hashlib.sha256((root/name).read_bytes()).hexdigest()==digest,name
runtime=(root/'barel-runtime.js').read_bytes()
hook=b'    const air=globalThis.BarelAirAttack?.frameFor(p,MS);\n    if(air)return air;\n'
assert runtime.count(hook)==1
assert hashlib.sha256(runtime.replace(hook,b'')).hexdigest()==before['barel-runtime.js'],'Other selection changes'
(root/'artifacts/barel-air-attack-10/asset-checks.json').write_text(json.dumps({'frames':results,'sourcePixels':len(used),
 'protectedFiles':[n for n in before if n!='barel-runtime.js'],'entireGameUnchanged':True,'otherAnimationSelectionUnchanged':True},indent=2))
print(f'PASS aerial assets: ten original RGBA cels, no clones/fragments/canvas crops, pelvis alignment; {len(before)-1} files including entire game.js unchanged')
