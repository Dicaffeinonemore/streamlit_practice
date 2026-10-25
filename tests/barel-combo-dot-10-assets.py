"""Verify the three dot replacements without changing combat or prior resources."""
import hashlib
import json
from pathlib import Path
from PIL import Image

root=Path(__file__).resolve().parents[1]
results=[]
for combo in range(3):
    name=f'barel-combo{combo}-dot-10';folder=root/'assets/aseprite'/name;export=root/'assets/aseprite/exports'/name
    source=Image.open(folder/'source/original.png').convert('RGBA')
    metadata=json.loads((folder/f'{name}.animation.json').read_text())
    old=json.loads((root/f'assets/aseprite/barel-combo{combo}-10/barel-combo{combo}-10.animation.json').read_text())
    assert source.getpixel((0,0))[3]==0
    assert hashlib.sha256((folder/'source/original.png').read_bytes()).hexdigest()==metadata['source']['sha256']
    assert not metadata['source']['resampled'] and not metadata['source']['redrawn'] and not metadata['source']['pixelClones']
    assert metadata['combat']==old['combat'] and metadata['expectedDurationsMs']==old['expectedDurationsMs']
    assert abs(metadata['renderScale']*metadata['alignment']['newNeutralHeight']-142)<1e-9
    audit=json.loads((folder/'separation.json').read_text())
    data=json.loads((export/f'{name}.json').read_text());sheet=Image.open(export/f'{name}.png').convert('RGBA')
    assert len(data['frames'])==10 and [f['duration'] for f in data['frames']]==metadata['expectedDurationsMs']
    assert sum(f['duration'] for f in data['frames'])==[350,310,680][combo]
    assert data['meta']['frameTags'][0]['name']==metadata['clip']
    for ext in ['png','json']:assert (folder/f'{name}.{ext}').read_bytes()==(export/f'{name}.{ext}').read_bytes()
    used=set();frames=[]
    for i,record in enumerate(audit['frames']):
        im=Image.open(folder/f'F{i+1:02}.png').convert('RGBA');box=im.getbbox()
        assert im.size==(384,384) and 0<box[0]<box[2]<384 and 0<box[1]<box[3]<384
        assert box[3]+metadata['frameOffsets'][i][1]==352
        f=data['frames'][i]['frame'];assert im.tobytes()==sheet.crop((f['x'],f['y'],f['x']+f['w'],f['y']+f['h'])).tobytes()
        ax,ay=record['sourceAnchor'];points=set();source_edge=False
        for y in range(384):
            for x in range(384):
                rgba=im.getpixel((x,y))
                if rgba[3]:
                    original=(x-200+ax,y-352+ay)
                    assert rgba[3]>=32 and original not in used and rgba==source.getpixel(original)
                    used.add(original);points.add((x,y))
                    source_edge|=original[0] in (0,source.width-1)
        assert len(points)==record['retainedPixels'] and not record['pixelClones']
        remaining=points.copy();stack=[remaining.pop()]
        while stack:
            x,y=stack.pop()
            for dx in [-1,0,1]:
                for dy in [-1,0,1]:
                    p=(x+dx,y+dy)
                    if p in remaining:remaining.remove(p);stack.append(p)
        assert not remaining,('Detached fragment',combo,i)
        if combo==2 and i==6:
            # The preceding sword must not steal this original rear boot.
            for oy in range(478,486):
                for ox in range(984,1008):
                    rgba=source.getpixel((ox,oy))
                    if rgba[3]>=32:assert im.getpixel((ox-ax+200,oy-ay+352))==rgba,'F7 rear boot lost'
        frames.append({'frame':i+1,'bbox':box,'pixels':len(points),'components':1,'touchesOriginalSourceEdge':source_edge})
    results.append({'combo':combo,'durationMs':metadata['combat']['durationMs'],'frames':frames})
before=json.loads((root/'artifacts/barel-combo-dot-10/before-hashes.json').read_text(encoding='utf-8-sig'))
for name,digest in before.items():assert hashlib.sha256((root/name).read_bytes()).hexdigest()==digest,name
(root/'artifacts/barel-combo-dot-10/asset-checks.json').write_text(json.dumps({'combos':results,'protectedFiles':list(before)},indent=2))
print(f'PASS dot combos: 30 original RGBA frames, isolated/no clones, timing/combat unchanged; {len(before)} prior files preserved')
