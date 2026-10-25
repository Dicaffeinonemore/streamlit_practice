"""Original RGBA provenance, uncut connected cels and protected simulation."""
import hashlib
import json
from pathlib import Path
from PIL import Image

root=Path(__file__).resolve().parents[1]
folder=root/'assets/aseprite/barel-walk-10'
m=json.loads((folder/'barel-walk-10.animation.json').read_text())
audit=json.loads((folder/'separation.json').read_text())
source=Image.open(folder/'source/original.png').convert('RGBA')
assert source.size==(1536,1024) and source.getpixel((0,0))[3]==0
assert hashlib.sha256((folder/'source/original.png').read_bytes()).hexdigest()==m['source']['sha256']
export=root/'assets/aseprite/exports/barel-walk-10'
data=json.loads((export/'barel-walk-10.json').read_text())
assert len(data['frames'])==10 and all(f['duration']==90 for f in data['frames'])
tag=data['meta']['frameTags'][0]
assert len(data['meta']['frameTags'])==1 and tag['name']=='walk' and tag['from']==0 and tag['to']==9 and tag['direction']=='forward'
sheet=Image.open(export/'barel-walk-10.png').convert('RGBA')
for extension in ['png','json']:
    assert (folder/f'barel-walk-10.{extension}').read_bytes()==(export/f'barel-walk-10.{extension}').read_bytes()
results=[];used=set()
for i,record in enumerate(audit['frames']):
    im=Image.open(folder/f'F{i+1:02}.png').convert('RGBA');box=im.getbbox()
    assert im.size==(448,448) and 0<box[0]<box[2]<448 and 0<box[1]<box[3]<448
    assert record['gridRow']==i//5+1 and record['gridColumn']==i%5+1
    assert m['frameOffsets'][i][0]==0 and box[3]+m['frameOffsets'][i][1]==416
    f=data['frames'][i]['frame'];actual=sheet.crop((f['x'],f['y'],f['x']+f['w'],f['y']+f['h']))
    assert im.tobytes()==actual.tobytes()
    ax,ay=record['sourceAnchor'];occupied=set()
    for y in range(448):
        for x in range(448):
            rgba=im.getpixel((x,y))
            if rgba[3]:
                assert rgba[3]>=32
                original=(x-224+ax,y-416+ay)
                assert original not in used and rgba==source.getpixel(original)
                used.add(original);occupied.add((x,y))
    assert len(occupied)==record['retainedPixels'] and not record['pixelClones']
    remaining=occupied.copy();stack=[remaining.pop()]
    while stack:
        x,y=stack.pop()
        for p in [(x-1,y),(x+1,y),(x,y-1),(x,y+1)]:
            if p in remaining:remaining.remove(p);stack.append(p)
    assert not remaining,('Detached fragment',i)
    results.append({'frame':i+1,'bbox':box,'sourceBounds':record['sourceBounds'],'pixels':len(occupied),'components':1})
assert len(used)>470000 and abs(m['renderScale']*347-142)<1e-9
protected=json.loads((root/'artifacts/barel-walk-10/before-hashes.json').read_text())
for name,digest in protected.items():assert hashlib.sha256((root/name).read_bytes()).hexdigest()==digest,name
(root/'artifacts/barel-walk-10/asset-checks.json').write_text(json.dumps({'frames':results,'protectedFiles':list(protected),'uniqueOriginalPixels':len(used)},indent=2))
print(f'PASS walk assets: 10 original RGBA cels, no clones/foreign pixels/fragments/crops, ground alignment; {len(protected)} protected files unchanged')
