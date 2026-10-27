"""Export twelve alpha-connected Barel hurt poses, retaining source pixel density."""
import base64
import hashlib
import io
import json
import shutil
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'assets_src/barel/barel_hurt.png'
if not SOURCE.exists():
    SOURCE.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(Path.home() / 'Desktop/흑월의 기사 리부트/바렐 무브셋/바렐 피격.png', SOURCE)
image = Image.open(SOURCE).convert('RGBA')
assert image.size == (1448, 1086)
rgba = np.array(image)
points = set(zip(*np.where(rgba[:, :, 3] > 0)))
components = []
while points:
    queue = [points.pop()]
    for y, x in queue:
        for point in ((y-1,x), (y+1,x), (y,x-1), (y,x+1)):
            if point in points:
                points.remove(point)
                queue.append(point)
    components.append(np.array(queue))
major = sorted((g for g in components if len(g) > 1500),
               key=lambda g: (int(g[:,0].mean() // 362), g[:,1].min()))
assert len(major) == 12, [(len(g), g.min(0).tolist(), g.max(0).tolist()) for g in major]
owned = [list(g) for g in major]
for fragment in components:
    if len(fragment) > 1500:
        continue
    distance = [min(int(np.min(np.sum((g-p)**2, axis=1))) for p in fragment) for g in major]
    owned[int(np.argmin(distance))].extend(fragment)

name = 'barel-hurt-12'
folder = ROOT / 'assets/aseprite' / name
export = ROOT / 'assets/aseprite/exports' / name
for path in (folder, export, folder/'source'):
    path.mkdir(parents=True, exist_ok=True)
shutil.copy2(SOURCE, folder/'source/original.png')

# Back up the actual legacy seven-frame clip, including its original atlas/pivots.
old = ROOT / 'assets/aseprite/hurt_old'
if not (old/'hurt_old.json').exists():
    old.mkdir(parents=True, exist_ok=True)
    art = json.loads((ROOT/'barel-art.js').read_text(encoding='utf-8').split(' = ',1)[1].rstrip(';\n\r '))
    data = base64.b64decode(art['atlas'].split(',',1)[1])
    (old/'hurt_old.png').write_bytes(data)
    atlas = Image.open(io.BytesIO(data))
    for i,frame in enumerate(art['clips']['hurt'],1):
        x,y,w,h = frame['atlas']
        atlas.crop((x,y,x+w,y+h)).save(old/f'F{i:02}.png')
    (old/'hurt_old.json').write_text(json.dumps({'clip':'hurt_old','atlas':'hurt_old.png','frames':art['clips']['hurt'],
        'legacyDurationTicks':17,'legacyRenderDurationMs':280,'renderScale':.72},indent=2)+'\n')

tiles, pivots, boxes = [], [], []
for points in owned:
    g = np.array(points)
    y0,x0 = g.min(0); y1,x1 = g.max(0)+1
    tile_data = np.zeros((y1-y0,x1-x0,4),dtype=np.uint8)
    tile_data[g[:,0]-y0,g[:,1]-x0] = rgba[g[:,0],g[:,1]]
    tile = Image.fromarray(tile_data)
    yy,xx = np.where((tile_data[:,:,3]>0)&(tile_data[:,:,0]<tile_data[:,:,1]*1.6+12))
    torso = (yy>=tile.height*.35)&(yy<tile.height*.75)
    center = np.median(xx[torso])
    torso &= abs(xx-center)<tile.height*.18
    pivots.append([int(round(float(np.median(xx[torso])))),tile.height-1])
    tiles.append(tile)
    boxes.append([int(x0),int(y0),int(x1),int(y1)])
raw_pivots = [p[:] for p in pivots]
for start,end in ((1,6),(6,10)):
    mean = round(sum(p[0] for p in pivots[start:end])/(end-start))
    for pivot in pivots[start:end]:
        pivot[0] = mean

# Crown landmarks exclude the horns, using the same idle measurement as dash_attack.
idle = Image.open(ROOT/'assets/aseprite/barel-idle-dot-10/F01.png')
idle_meta = json.loads((ROOT/'assets/aseprite/barel-idle-dot-10/barel-idle-dot-10.animation.json').read_text())
idle_body_height = idle.getbbox()[3]-idle.getbbox()[1]-24
neutral_crown_y = boxes[11][1]+30
neutral_sole_y = boxes[11][3]-1
body_height = neutral_sole_y-neutral_crown_y
scale = idle_body_height*idle_meta['renderScale']/body_height
cell,anchor = 640,[320,576]
atlas = Image.new('RGBA',(cell*12,cell))
frames = []
for i,(tile,pivot) in enumerate(zip(tiles,pivots)):
    x,y = anchor[0]-pivot[0],anchor[1]-pivot[1]
    assert x>=0 and y>=0 and x+tile.width<=cell and y+tile.height<=cell
    cel = Image.new('RGBA',(cell,cell));cel.paste(tile,(x,y))
    cel.save(folder/f'F{i+1:02}.png');atlas.paste(cel,(cell*i,0))
    frames.append({'filename':f'F{i+1:02}.png','frame':{'x':cell*i,'y':0,'w':cell,'h':cell},'rotated':False,'trimmed':False,
        'spriteSourceSize':{'x':0,'y':0,'w':cell,'h':cell},'sourceSize':{'w':cell,'h':cell},'duration':50})
meta = {'schemaVersion':1,'character':'barel','animationId':'hurt','animationType':'oneshot','loop':False,
    'clip':'hurt','sprite':f'../exports/{name}/{name}.json','anchor':anchor,'frameOffsets':[[0,0] for _ in frames],
    'expectedDurationsMs':[50]*12,'durationMs':600,'renderScale':scale,
    'sequences':{'hurt_high':{'frames':[2,3,4,5,6,12],'ticks':[3,5,5,5,6,6]},
                 'hurt_low':{'frames':[7,8,9,10,11,12],'ticks':[3,5,5,6,6,5]}},
    'recoveryTicks':6,'defaultHitstunTicks':17,'highThreshold':.55,
    'lowHurtboxHeight':round(min(90,float(np.median([t.height-1 for t in tiles[6:10]]))*scale*.72),6),
    'alignment':{'referenceIdleBodyHeight':idle_body_height,'neutralBodyHeight':body_height,
                 'neutralCrownY':neutral_crown_y,'neutralSoleY':neutral_sole_y,'rawPivots':raw_pivots,'pivots':pivots},
    'source':{'file':'source/original.png','sha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),'resampled':False},
    'separation':{'count':12,'boxes':boxes,'componentThreshold':1500,'alphaThreshold':1}}
data = {'frames':frames,'meta':{'image':f'{name}.png','size':{'w':cell*12,'h':cell},'scale':'1',
    'frameTags':[{'name':'hurt','from':0,'to':11,'direction':'forward'}]}}
for path in (folder,export):
    atlas.save(path/f'{name}.png')
    (path/f'{name}.json').write_text(json.dumps(data,indent=2)+'\n')
(folder/f'{name}.animation.json').write_text(json.dumps(meta,indent=2)+'\n')
print(json.dumps({'count':12,'renderScale':scale,'bodyHeight':body_height,'lowHurtboxHeight':meta['lowHurtboxHeight'],
                  'boxes':boxes,'pivots':pivots},indent=2))
