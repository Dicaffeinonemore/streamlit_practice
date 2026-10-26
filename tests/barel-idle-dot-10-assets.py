"""Dot idle provenance and unchanged combat/physics outside selection UI."""
import hashlib
import json
from pathlib import Path
from PIL import Image
root=Path(__file__).resolve().parents[1]
folder=root/'assets/aseprite/barel-idle-dot-10';export=root/'assets/aseprite/exports/barel-idle-dot-10'
source=Image.open(folder/'source/original.png').convert('RGBA')
m=json.loads((folder/'barel-idle-dot-10.animation.json').read_text())
audit=json.loads((folder/'separation.json').read_text())
data=json.loads((export/'barel-idle-dot-10.json').read_text())
assert source.size==(1600,533) and source.getpixel((0,0))[3]==0
assert hashlib.sha256((folder/'source/original.png').read_bytes()).hexdigest()==m['source']['sha256']
assert len(data['frames'])==10 and [f['duration'] for f in data['frames']]==[130]*10
assert m['durationMs']==1300 and m['clock']=={'source':'tick * MS','legacyPeriodMs':1300,'resetOnIdleEntry':False}
assert abs(m['renderScale']*282-142)<1e-9
sheet=Image.open(export/'barel-idle-dot-10.png').convert('RGBA')
for ext in ['png','json']:assert (folder/f'barel-idle-dot-10.{ext}').read_bytes()==(export/f'barel-idle-dot-10.{ext}').read_bytes()
used=set();results=[];bounds=[]
for i,record in enumerate(audit['frames']):
    im=Image.open(folder/f'F{i+1:02}.png').convert('RGBA');box=im.getbbox()
    assert im.size==(448,448) and 0<box[0]<box[2]<448 and 0<box[1]<box[3]<448
    assert box[3]+m['frameOffsets'][i][1]==416
    bounds.append([box[0]-224,box[1]-416+m['frameOffsets'][i][1],box[2]-224,0])
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
        for dx in [-1,0,1]:
            for dy in [-1,0,1]:
                p=(x+dx,y+dy)
                if p in remaining:remaining.remove(p);stack.append(p)
    assert not remaining,('Detached fragment',i)
    results.append({'frame':i+1,'bbox':box,'pixels':len(points),'components':1})
assert m['previewBounds']==[min(b[0] for b in bounds),min(b[1] for b in bounds),max(b[2] for b in bounds),0]
before=json.loads((root/'artifacts/barel-idle-dot-10/before-hashes.json').read_text(encoding='utf-8-sig'))
for name,digest in before.items():
    if name not in {'game.js','barel-runtime.js'}:assert hashlib.sha256((root/name).read_bytes()).hexdigest()==digest,name
game=(root/'game.js').read_bytes()
old="""  if (!BAREL_ATLAS.naturalWidth) return;
  const canvas = $('barelSelectPreview'), c = canvas.getContext('2d');
  const frame = barelFrame('idle', tick * MS / 1300, true), [x,y,w,h] = frame.atlas;
  const scale = Math.min(250/w, 225/h);
  c.clearRect(0,0,canvas.width,canvas.height);c.imageSmoothingEnabled = false;
  c.drawImage(BAREL_ATLAS,x,y,w,h,(canvas.width-w*scale)/2,canvas.height-h*scale-8,w*scale,h*scale);
""".replace('\n','\r\n').encode()
new=b"  drawBarelIdlePreview($('barelSelectPreview'),tick*MS);\r\n"
assert game.count(new)==1;game=game.replace(new,old)
for line in [b"  drawBarelIdlePreview($('barelChallengePreview'),tick*MS);\r\n",b"  if (scene === 'challenge') drawBarelIdlePreview($('barelChallengePreview'),tick*MS);\r\n"]:
    assert game.count(line)==1;game=game.replace(line,b'')
assert hashlib.sha256(game).hexdigest()==before['game.js'],'Change outside preview rendering'
runtime=(root/'barel-runtime.js').read_bytes();start=runtime.index(b'// Shared stable framing');end=runtime.index(b'function barelEffect(',start)
assert hashlib.sha256(runtime[:start]+runtime[end:]).hexdigest()==before['barel-runtime.js'],'Other gameplay rendering changed'
(root/'artifacts/barel-idle-dot-10/asset-checks.json').write_text(json.dumps({'frames':results,'previewBounds':m['previewBounds'],
 'protectedFiles':[n for n in before if n not in {'game.js','barel-runtime.js'}],'gameBeyondPreviewCodeUnchanged':True},indent=2))
print(f'PASS idle dot: ten original RGBA cels, no clones/foreign fragments/canvas crops, ground/preview fit; {len(before)-2} files preserved, combat/physics unchanged')
