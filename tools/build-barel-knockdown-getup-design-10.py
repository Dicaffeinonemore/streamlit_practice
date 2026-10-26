"""Separate the design-matched sheet into ten editable Aseprite cels."""
import hashlib
import json
import shutil
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT=Path(__file__).resolve().parents[1]
FOLDER=ROOT/'assets/aseprite/barel-knockdown-getup-design-10'
FOLDER.mkdir(parents=True,exist_ok=True)
(FOLDER/'source').mkdir(exist_ok=True)
SOURCE=FOLDER/'source/design-matched-sheet.png'
if not SOURCE.exists():
    shutil.copy2(Path.home()/'.codex/generated_images/01a177fb-81e4-76b1-825a-8b4481ecd2ce/exec-0ee6a7a7-fbd0-4b7d-82e4-7aa224bed3b4.png',SOURCE)
references=Path.home()/'Desktop/흑월의 기사 리부트/Barel_All_Images_30_PNG/Barel_All_Images'
for original,name in [('02_Animations/10_Knockdown_getup_export.png','motion-reference.png'),
                      ('01_Character/02_Barel_reference_diagonal.png','design-reference.png')]:
    shutil.copy2(references/original,FOLDER/'source'/name)
image=Image.open(SOURCE).convert('RGBA');a=np.array(image)
points=set(zip(*np.where(a[:,:,3]>=32)));groups=[]
while points:
    q=[points.pop()]
    for y,x in q:
        for p in ((y-1,x),(y+1,x),(y,x-1),(y,x+1)):
            if p in points:points.remove(p);q.append(p)
    groups.append(np.array(q))
main=sorted((g for g in groups if len(g)>1500),key=lambda g:(int(g[:,0].mean()>image.height*.53),g[:,1].min()))
assert len(main)==10,[(len(g),g.min(0).tolist(),g.max(0).tolist()) for g in main]
owned=[list(g) for g in main]
boxes=[(g.min(0),g.max(0)) for g in main]
def nearby(points):
    distances=[]
    for low,high in boxes:
        delta=np.maximum(np.maximum(low-points,points-high),0)
        distances.append(int(np.min(np.sum(delta*delta,axis=1))))
    return sorted(range(10),key=lambda i:distances[i])[:2]
for fragment in groups:
    if len(fragment)>1500:continue
    candidates=nearby(fragment)
    gap=min(int(np.min(np.sum(np.maximum(np.maximum(boxes[i][0]-fragment,fragment-boxes[i][1]),0)**2,axis=1))) for i in candidates)
    if gap>64:continue
    distances={i:min(int(np.min(np.sum((main[i]-p)**2,axis=1))) for p in fragment) for i in candidates}
    owner=min(candidates,key=lambda i:distances[i])
    if distances[owner]<=9:owned[owner].extend(fragment)
# Alpha below 32 and remote detached specks are generated matte residue,
# not sprite parts; use the same threshold as the existing Barel dot tools.

durations=[80,80,80,80,100,240,120,120,100,100]
cell=640;anchor=[320,576];frames=[];audit=[]
review=Image.new('RGBA',(cell*5,cell*2))
for i,points in enumerate(owned):
    g=np.array(points);y0,x0=g.min(0);y1,x1=g.max(0)+1
    data=np.zeros((y1-y0,x1-x0,4),dtype=np.uint8)
    data[g[:,0]-y0,g[:,1]-x0]=a[g[:,0],g[:,1]]
    tile=Image.fromarray(data)
    # Keep contact on a common floor. Torso/hip center owns X, not sword/cape tips.
    metal=(data[:,:,3]>0)&(data[:,:,0]<data[:,:,1]*1.6+12)
    yy,xx=np.where(metal)
    if i in (2,3,4,5):
        band=(xx>tile.width*.3)&(xx<tile.width*.65)
    else:
        band=(yy>tile.height*.35)&(yy<tile.height*.75)
    pivot=[int(round(float(np.median(xx[band])))),tile.height-1]
    x,y=anchor[0]-pivot[0],anchor[1]-pivot[1]
    assert 0<=x and x+tile.width<=cell and 0<=y and y+tile.height<=cell
    cel=Image.new('RGBA',(cell,cell));cel.paste(tile,(x,y))
    cel.save(FOLDER/f'F{i+1:02}.png')
    review.paste(cel,((i%5)*cell,(i//5)*cell))
    frames.append({'file':f'F{i+1:02}.png','durationMs':durations[i]})
    audit.append({'frame':i+1,'sourceBox':[int(x0),int(y0),int(x1),int(y1)],'sourcePivot':pivot,'retainedPixels':len(points)})
review.save(FOLDER/'review-sheet.png')
preview=review.resize((1600,640),Image.Resampling.NEAREST);preview.save(FOLDER/'preview-sheet.png')
metadata={'name':'barel-knockdown-getup-design-10','cell':[cell,cell],'anchor':anchor,'frames':frames,
          'durationMs':sum(durations),'sourceOrder':[1,2,3,4,5,6,8,9,10,11],
          'sourceSha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),'separation':audit,'resampled':False,
          'motion':['ready','stagger','airborne knockback','back impact','roll','prone','kneel','rise','recover','ready']}
(FOLDER/'build.json').write_text(json.dumps(metadata,indent=2)+'\n')
print(json.dumps({'frames':len(frames),'cell':cell,'durationMs':sum(durations),'boxes':[f['sourceBox'] for f in audit]},indent=2))
