"""Pixel provenance, frame isolation, CLI consistency and dash-only code changes."""
import hashlib
import json
from pathlib import Path
from PIL import Image

root=Path(__file__).resolve().parents[1]
folder=root/'assets/aseprite/barel-dash-10'
source=Image.open(folder/'source/original.png').convert('RGBA')
m=json.loads((folder/'barel-dash-10.animation.json').read_text())
audit=json.loads((folder/'separation.json').read_text())
assert source.size==(2172,724) and source.getpixel((0,0))[3]==0
assert hashlib.sha256((folder/'source/original.png').read_bytes()).hexdigest()==m['source']['sha256']
export=root/'assets/aseprite/exports/barel-dash-10'
data=json.loads((export/'barel-dash-10.json').read_text())
assert len(data['frames'])==10 and all(f['duration']==19 for f in data['frames'])
assert sum(f['duration'] for f in data['frames'])==190
tag=data['meta']['frameTags'][0]
assert len(data['meta']['frameTags'])==1 and tag['name']=='dash' and tag['from']==0 and tag['to']==9 and tag['direction']=='forward'
assert m['clock']=={'source':'player.t * MS','legacyDurationMs':190}
assert m['animationType']=='oneshot' and m['loop'] is False
assert abs(m['renderScale']*261-142)<1e-9
sheet=Image.open(export/'barel-dash-10.png').convert('RGBA')
for extension in ['png','json']:
    assert (folder/f'barel-dash-10.{extension}').read_bytes()==(export/f'barel-dash-10.{extension}').read_bytes()
used=set();results=[]
for i,record in enumerate(audit['frames']):
    im=Image.open(folder/f'F{i+1:02}.png').convert('RGBA');box=im.getbbox()
    assert im.size==(384,384) and 0<box[0]<box[2]<384 and 0<box[1]<box[3]<384
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
    results.append({'frame':i+1,'bbox':box,'pixels':len(points),'components':1})
before=json.loads((root/'artifacts/barel-dash-10/before-hashes.json').read_text(encoding='utf-8-sig'))
previous=json.loads((root/'artifacts/barel-walk-10/before-hashes.json').read_text())
for name,digest in previous.items():
    if name.startswith('assets/aseprite/'):
        assert hashlib.sha256((root/name).read_bytes()).hexdigest()==digest,name
mutable={'game.js','barel-runtime.js','src/animation/aseprite.js'}
for name,digest in before.items():
    if name not in mutable:assert hashlib.sha256((root/name).read_bytes()).hexdigest()==digest,name
# Undo exactly the intended hooks and verify the entire rest of game.js byte-for-byte.
game=(root/'game.js').read_bytes()
for line in [b'  globalThis.BarelDashFx?.clear();',b'  if(!isViesa())globalThis.BarelDashFx?.start(p);',b'  globalThis.BarelDashFx?.update(player,MS);']:
    assert game.count(line)==1
    game=game.replace(line+b'\r\n',b'').replace(line+b'\n',b'')
new=b"      if(p.characterId==='barel'&&globalThis.BarelDashFx)BarelDashFx.capture(p,MS);\r\n      else if (every(t, 30)) ghost(p.x, p.y, p.z, 'player', p.face, '#9cc3ff', 240);"
old=b"      if (every(t, 30)) ghost(p.x, p.y, p.z, 'player', p.face, '#9cc3ff', 240);"
assert game.count(new)==1
game=game.replace(new,old)
assert hashlib.sha256(game).hexdigest()==before['game.js'],'Unexpected simulation change'
(root/'artifacts/barel-dash-10/asset-checks.json').write_text(json.dumps({'frames':results,'sourcePixels':len(used),
    'protectedFiles':[n for n in before if n not in mutable],'gameLogicBeyondVisualHooksUnchanged':True},indent=2))
print('PASS dash: original RGBA, ten isolated cels, margins, 190ms, CLI copies, preserved non-dash resources, entire game except four visual hooks unchanged')
