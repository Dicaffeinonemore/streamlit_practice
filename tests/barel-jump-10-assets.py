"""Jump source provenance, isolated frames, registration and physics protection."""
import hashlib
import json
from pathlib import Path
from PIL import Image

root=Path(__file__).resolve().parents[1]
folder=root/'assets/aseprite/barel-jump-10';export=root/'assets/aseprite/exports/barel-jump-10'
source=Image.open(folder/'source/original.png').convert('RGBA')
m=json.loads((folder/'barel-jump-10.animation.json').read_text())
audit=json.loads((folder/'separation.json').read_text())
data=json.loads((export/'barel-jump-10.json').read_text())
assert source.size==(1600,686) and source.getpixel((0,0))[3]==0
assert hashlib.sha256((folder/'source/original.png').read_bytes()).hexdigest()==m['source']['sha256']
assert len(data['frames'])==10 and [f['duration'] for f in data['frames']]==m['expectedDurationsMs']
assert sum(m['expectedDurationsMs'][:8])==600 and sum(m['expectedDurationsMs'][8:])==84
assert m['animationType']=='oneshot' and m['loop'] is False
tag=data['meta']['frameTags'][0]
assert len(data['meta']['frameTags'])==1 and tag['name']=='jump' and tag['from']==0 and tag['to']==9 and tag['direction']=='forward'
assert abs(m['renderScale']*158-142)<1e-9
sheet=Image.open(export/'barel-jump-10.png').convert('RGBA')
for ext in ['png','json']:assert (folder/f'barel-jump-10.{ext}').read_bytes()==(export/f'barel-jump-10.{ext}').read_bytes()
used=set();results=[]
for i,record in enumerate(audit['frames']):
    im=Image.open(folder/f'F{i+1:02}.png').convert('RGBA');box=im.getbbox()
    assert im.size==(384,384) and 0<box[0]<box[2]<384 and 0<box[1]<box[3]<384
    assert box[3]+m['frameOffsets'][i][1]==352
    f=data['frames'][i]['frame'];assert im.tobytes()==sheet.crop((f['x'],f['y'],f['x']+f['w'],f['y']+f['h'])).tobytes()
    ax,ay=record['sourceAnchor'];points=set()
    for y in range(384):
        for x in range(384):
            rgba=im.getpixel((x,y))
            if rgba[3]:
                original=(x-200+ax,y-352+ay)
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
    results.append({'frame':i+1,'bbox':box,'sourceAnchor':[ax,ay],'pixels':len(points),'components':1})
assert len({r['sourceAnchor'][1] for r in results})>5,'Source-authored arc removed via individual sole anchors'
before=json.loads((root/'artifacts/barel-jump-10/before-hashes.json').read_text(encoding='utf-8-sig'))
mutable={'game.js','barel-runtime.js'}
for name,digest in before.items():
    if name not in mutable:assert hashlib.sha256((root/name).read_bytes()).hexdigest()==digest,name
game=(root/'game.js').read_bytes()
for line in [b'  globalThis.BarelJump?.reset();',b'  globalThis.BarelJump?.observe(player);']:
    assert game.count(line)==1;game=game.replace(line+b'\r\n',b'').replace(line+b'\n',b'')
assert hashlib.sha256(game).hexdigest()==before['game.js'],'Physics/state logic changed beyond two read-only visual hooks'
runtime=(root/'barel-runtime.js').read_bytes()
hook=b"  const jump=globalThis.BarelJump?.frameFor(p,MS,scene!=='clear'&&scene!=='ending');\n  if(jump)return jump;\n"
assert runtime.count(hook)==1
assert hashlib.sha256(runtime.replace(hook,b'')).hexdigest()==before['barel-runtime.js'],'Other animation selection changed'
(root/'artifacts/barel-jump-10/asset-checks.json').write_text(json.dumps({'frames':results,'sourcePixels':len(used),
 'protectedFiles':[n for n in before if n not in mutable],'gameBeyondVisualHooksUnchanged':True,'otherAnimationSelectionUnchanged':True},indent=2))
print(f'PASS jump assets: ten original RGBA cels, no clones/fragments/canvas crops, source arc normalized; {len(before)-2} files preserved, physics/state code unchanged')
