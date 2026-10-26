"""Build the replacement jump from alpha components, with torso-centered air pivots."""
import hashlib
import json
import shutil
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT/'assets_src/barel/barel_jump.png'
if not SOURCE.exists():
    SOURCE.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(Path.home()/'Desktop/흑월의 기사 리부트/바렐 무브셋/바렐 점프.png',SOURCE)
image = Image.open(SOURCE).convert('RGBA')
assert image.size == (1600,640)
rgba = np.array(image)
points = set(zip(*np.where(rgba[:,:,3]>0)))
components = []
while points:
    queue = [points.pop()]
    for y,x in queue:
        for point in ((y-1,x),(y+1,x),(y,x-1),(y,x+1)):
            if point in points:
                points.remove(point);queue.append(point)
    components.append(np.array(queue))
major = sorted((g for g in components if len(g)>1500),
               key=lambda g:(int(g[:,0].mean()>335),g[:,1].min()))
assert len(major)==10,[(len(g),g.min(0).tolist(),g.max(0).tolist()) for g in major]
owned = [list(g) for g in major]
for fragment in components:
    if len(fragment)>1500:
        continue
    distances = [min(int(np.min(np.sum((g-p)**2,axis=1))) for p in fragment) for g in major]
    owned[int(np.argmin(distances))].extend(fragment)

previous = ROOT/'assets/aseprite/barel-jump-10'
backup = ROOT/'assets/aseprite/jump_old'
if not backup.exists():
    shutil.copytree(previous,backup)
    shutil.copytree(ROOT/'assets/aseprite/exports/barel-jump-10',backup/'exports')
    shutil.copy2(ROOT/'src/animation/barel-jump.js',backup/'jump_old.js')

def torso(tile):
    a = np.array(tile)
    yy,xx = np.where((a[:,:,3]>0)&(a[:,:,0]<a[:,:,1]*1.6+12))
    band = (yy>=tile.height*.35)&(yy<tile.height*.75)
    center = np.median(xx[band]);band &= abs(xx-center)<tile.height*.18
    return [float(np.median(xx[band])),float(np.median(yy[band]))]

tiles,centers,boxes = [],[],[]
for points in owned:
    g = np.array(points);y0,x0 = g.min(0);y1,x1 = g.max(0)+1
    data = np.zeros((y1-y0,x1-x0,4),dtype=np.uint8)
    data[g[:,0]-y0,g[:,1]-x0] = rgba[g[:,0],g[:,1]]
    tile = Image.fromarray(data)
    tiles.append(tile);centers.append(torso(tile))
    boxes.append([int(x0),int(y0),int(x1),int(y1)])
idle_meta = json.loads((ROOT/'assets/aseprite/barel-idle-dot-10/barel-idle-dot-10.animation.json').read_text())
idle = Image.open(ROOT/'assets/aseprite/barel-idle-dot-10/F01.png').convert('RGBA')
# The old jump was already oversized. Match a rigid feature to the actual idle,
# rather than stretching a crouched pose to an upright character's body height.
def helmet_width(tile,band):
    a = np.array(tile)
    metal = (a[:,:,3]>0)&(a[:,:,0]<a[:,:,1]*1.6+12)
    return int(metal[band[0]:band[1]].sum(axis=1).max())

idle_helmet_band,jump_helmet_band = (18,38),(24,42)
idle_helmet_width = helmet_width(idle.crop(idle.getbbox()),idle_helmet_band)
jump_helmet_width = helmet_width(tiles[2],jump_helmet_band)
scale = idle_helmet_width*idle_meta['renderScale']/jump_helmet_width
idle_world_height = (idle.getbbox()[3]-idle.getbbox()[1]-24)*idle_meta['renderScale']
idle_half_in_source = idle_world_height/scale/2
pivots = []
for i,(tile,center) in enumerate(zip(tiles,centers)):
    px,py = center
    pivots.append([round(px),tile.height-1 if i in (0,8,9) else round(py+idle_half_in_source)])
raw_pivots = [p[:] for p in pivots]
# Correct only isolated air-pose outliers, relative to the measured torso.
for i in range(2,7):
    for axis in (0,1):
        average = (raw_pivots[i-1][axis]+raw_pivots[i+1][axis])/2
        if abs(raw_pivots[i][axis]-average)>idle_half_in_source*.65:
            pivots[i][axis] = round(average)

name = 'barel-jump-revised-10'
folder = ROOT/'assets/aseprite'/name
export = ROOT/'assets/aseprite/exports'/name
for path in (folder,export,folder/'source'):
    path.mkdir(parents=True,exist_ok=True)
shutil.copy2(SOURCE,folder/'source/original.png')
cell,anchor = 640,[320,576]
atlas = Image.new('RGBA',(cell*10,cell))
frames = []
for i,(tile,pivot) in enumerate(zip(tiles,pivots)):
    x,y = anchor[0]-pivot[0],anchor[1]-pivot[1]
    assert x>=0 and y>=0 and x+tile.width<=cell and y+tile.height<=cell
    cel = Image.new('RGBA',(cell,cell));cel.paste(tile,(x,y))
    cel.save(folder/f'F{i+1:02}.png');atlas.paste(cel,(cell*i,0))
    frames.append({'filename':f'F{i+1:02}.png','frame':{'x':cell*i,'y':0,'w':cell,'h':cell},'rotated':False,'trimmed':False,
        'spriteSourceSize':{'x':0,'y':0,'w':cell,'h':cell},'sourceSize':{'w':cell,'h':cell},'duration':50})
metadata = {'schemaVersion':1,'character':'barel','animationId':'jump','animationType':'oneshot','loop':False,
    'clip':'jump','sprite':f'../exports/{name}/{name}.json','anchor':anchor,'frameOffsets':[[0,0] for _ in frames],
    'expectedDurationsMs':[50]*10,'durationMs':500,'renderScale':scale,
    'poseMap':{'prejump':1,'riseFast':[2,3],'riseSlow':4,'apex':[5,6],'fall':[7,8],'landing':[9,10]},
    'selection':{'fastRiseAbove':4,'fastRiseFirstTicks':4,'apexLow':-2,'apexHigh':1,'apexFirstTicks':5,
                 'fastFallBelow':-5,'landingFirstTicks':4,'landingVisualTicks':6},
    'physicsReference':{'initialVz':9.6,'gravityPerTick':.55,'prejumpDelayTicks':0,'landingLockTicks':0},
    'alignment':{'comparison':'idle F1 helmet width -> new jump F3 helmet width; uniform scale for all poses',
                 'idleHelmetBand':idle_helmet_band,'jumpHelmetBand':jump_helmet_band,
                 'idleHelmetWidth':idle_helmet_width,'jumpHelmetWidth':jump_helmet_width,
                 'idleRenderScale':idle_meta['renderScale'],'idleHeightInRenderUnits':idle_world_height,
                 'idleHalfHeightInSourcePixels':idle_half_in_source,'torsoCenters':centers,'rawPivots':raw_pivots,'pivots':pivots},
    'source':{'file':'source/original.png','sha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),'resampled':False},
    'separation':{'count':10,'boxes':boxes,'alphaThreshold':1,'componentThreshold':1500}}
data = {'frames':frames,'meta':{'image':f'{name}.png','size':{'w':cell*10,'h':cell},'scale':'1',
    'frameTags':[{'name':'jump','from':0,'to':9,'direction':'forward'}]}}
for path in (folder,export):
    atlas.save(path/f'{name}.png')
    (path/f'{name}.json').write_text(json.dumps(data,indent=2)+'\n')
(folder/f'{name}.animation.json').write_text(json.dumps(metadata,indent=2)+'\n')
print(json.dumps({'count':10,'scale':scale,'idleHelmetWidth':idle_helmet_width,
                  'jumpHelmetWidth':jump_helmet_width,'pivots':pivots,'boxes':boxes},indent=2))
