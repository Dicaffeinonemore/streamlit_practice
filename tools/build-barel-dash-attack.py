"""Separate the supplied alpha components and export the existing Barel PNG/JSON format."""
from pathlib import Path
import hashlib
import json
import shutil
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'assets_src/barel/barel_dash_attack.png'
if not SOURCE.exists():
    SOURCE.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(Path.home() / 'Desktop/흑월의 기사 리부트/바렐 무브셋/바렐 대시 공격.png', SOURCE)
im = Image.open(SOURCE).convert('RGBA')
assert im.size == (1600, 538)
a = np.array(im)
points = set(zip(*np.where(a[:, :, 3] > 0)))
groups = []
while points:
    q = [points.pop()]
    for y, x in q:
        for p in ((y-1,x), (y+1,x), (y,x-1), (y,x+1)):
            if p in points:
                points.remove(p)
                q.append(p)
    groups.append(np.array(q))
main = sorted([g for g in groups if len(g) > 1500], key=lambda g: (int(g[:,0].mean() > 280), g[:,1].min()))
assert len(main) == 10, [(len(g), g.min(0).tolist(), g.max(0).tolist()) for g in main]
# Attach every disconnected remnant by shortest distance to the owning silhouette.
boxes = [(g.min(0), g.max(0)) for g in main]
owned = [list(g) for g in main]
for g in groups:
    if len(g) > 1500:
        continue
    distances = []
    for silhouette in main:
        distances.append(min(int(np.min(np.sum((silhouette-pixel)**2,axis=1))) for pixel in g))
    owned[int(np.argmin(distances))].extend(g)
name = 'barel-dash-attack-10'
folder = ROOT / 'assets/aseprite' / name
export = ROOT / 'assets/aseprite/exports' / name
folder.mkdir(parents=True, exist_ok=True)
export.mkdir(parents=True, exist_ok=True)
(folder/'source').mkdir(exist_ok=True)
shutil.copy2(SOURCE, folder/'source/original.png')
tiles, pivots, source_boxes = [], [], []
for pts in owned:
    g = np.array(pts)
    y0,x0 = g.min(0); y1,x1 = g.max(0)+1
    rgba = np.zeros_like(a); rgba[g[:,0],g[:,1]] = a[g[:,0],g[:,1]]
    tile = Image.fromarray(rgba).crop((x0,y0,x1,y1))
    t = np.array(tile)
    # Metal pixels exclude the red cape; central torso band excludes the blade.
    mask = (t[:,:,3]>0) & (t[:,:,0] < t[:,:,1]*1.6+12)
    yy,xx = np.where(mask)
    torso = (yy >= tile.height*.35) & (yy < tile.height*.75)
    center = np.median(xx[torso])
    torso &= abs(xx-center) < tile.height*.18
    px = int(round(float(np.median(xx[torso]))))
    tiles.append(tile); pivots.append([px, tile.height-1])
    source_boxes.append([int(x0),int(y0),int(x1),int(y1)])
raw = [p[0] for p in pivots]
# Compare local anatomical offsets rather than sheet coordinates/cape bounds.
relative = [p[0]-t.width/2 for p,t in zip(pivots,tiles)]
for i in range(1,9):
    avg = (relative[i-1]+relative[i+1])/2
    if abs(relative[i]-avg)>tiles[0].height*.3:
        pivots[i][0] = round(tiles[i].width/2+avg)
# First pose: helmet crown below the horns (source y=46), sole y=272.
# Existing idle's full 282px silhouette includes its horns; measure its crown too.
idle = Image.open(ROOT/'assets/aseprite/barel-idle-dot-10/F01.png').convert('RGBA')
idle_meta = json.loads((ROOT/'assets/aseprite/barel-idle-dot-10/barel-idle-dot-10.animation.json').read_text())
# Idle crown is 24 pixels below the alpha top; keep the same anatomical body height.
idle_height = idle.getbbox()[3]-idle.getbbox()[1]-24
body_height = source_boxes[0][3]-1-46
scale = idle_height*idle_meta['renderScale']/body_height
ticks = [3,4,4,3,3,6,6,6,6,6]
durations = [n*1000/60 for n in ticks]
anchor = [320,576]
atlas = Image.new('RGBA', (6400,640))
frames, offsets = [], []
for i,(tile,pivot) in enumerate(zip(tiles,pivots)):
    xy = (anchor[0]-pivot[0], anchor[1]-pivot[1])
    assert xy[0]>=0 and xy[0]+tile.width<=640 and xy[1]>=0
    cel = Image.new('RGBA',(640,640)); cel.paste(tile,xy)
    cel.save(folder/f'F{i+1:02}.png')
    atlas.paste(cel,(640*i,0))
    frames.append({'filename':f'F{i+1:02}.png','frame':{'x':640*i,'y':0,'w':640,'h':640},'rotated':False,'trimmed':False,'spriteSourceSize':{'x':0,'y':0,'w':640,'h':640},'sourceSize':{'w':640,'h':640},'duration':durations[i]})
    offsets.append([0,0])
# F5 blade: scan the metal at the horizontal blade's actual source height.
f5 = np.array(tiles[4]); yy,xx = np.where((f5[:,:,3]>0)&(f5[:,:,0]<f5[:,:,1]*1.6+12))
tipx = int(xx.max()); tipy = int(np.median(yy[xx>=tipx-3]))
world = scale*.72
tip = [(tipx-pivots[4][0])*world,(pivots[4][1]-tipy)*world]
box = {'front':8,'reach':round(tip[0],3),'bottom':round(tip[1]-12,3),'top':round(tip[1]+12,3),'depth':38}
metadata = {'schemaVersion':1,'character':'barel','animationId':'dash_attack','animationType':'oneshot','loop':False,'clip':'dash_attack','sprite':f'../exports/{name}/{name}.json','anchor':anchor,'frameOffsets':offsets,'expectedDurationsMs':durations,'durationMs':sum(durations),'renderScale':scale,'bodyHeight':body_height*scale*.72,'hitbox':box,'bladeTip':tip,'source':{'file':'source/original.png','sha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),'resampled':False},'separation':{'count':10,'boxes':source_boxes,'pivots':pivots,'rawPivotX':raw,'firstCrownY':46,'firstSoleY':source_boxes[0][3]-1,'idleBodyHeight':idle_height}}
data = {'frames':frames,'meta':{'image':f'{name}.png','size':{'w':6400,'h':640},'scale':'1','frameTags':[{'name':'dash_attack','from':0,'to':9,'direction':'forward'}]}}
for dest in (folder,export):
    atlas.save(dest/f'{name}.png')
    (dest/f'{name}.json').write_text(json.dumps(data,indent=2)+'\n')
(folder/f'{name}.animation.json').write_text(json.dumps(metadata,indent=2)+'\n')
print(json.dumps(metadata,indent=2))
