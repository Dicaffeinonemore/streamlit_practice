"""Build the Barel trial atlas from supplied green-screen sheets (originals untouched)."""
from pathlib import Path
from PIL import Image, ImageDraw
import numpy as np
import json, base64, io, argparse

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('source', type=Path)
args = parser.parse_args()
out = ROOT / 'assets/barel'
out.mkdir(parents=True, exist_ok=True)
files = {int(p.name[:2]): p for p in args.source.rglob('*.png')}
spec = {'idle':(3,3,2), 'walk':(4,3,3), 'combo0':(5,3,2), 'combo1':(6,3,2),
        'combo2':(7,4,2), 'hurt':(8,4,2), 'down':(10,4,3), 'hook':(11,4,2),
        'dash':(12,3,2), 'jump':(13,4,2), 'air':(15,3,2), 'back':(16,3,2),
        'thrust':(17,4,2), 'slam':(18,4,2), 'whirl':(19,4,2), 'leap':(20,4,2),
        'super1':(21,4,2), 'super2':(23,4,2), 'cast':(25,3,2),
        'death':(26,4,2), 'intro':(27,3,2), 'victory':(28,3,2)}

def key_green(im):
    a = np.array(im.convert('RGB')).astype(float)
    # Soft chroma matte; retain black armour and remove green spill at edges.
    r,g,b = a[:,:,0],a[:,:,1],a[:,:,2]
    alpha = 1 - np.clip((g - np.maximum(r,b) - 18) / 85, 0, 1)
    a[:,:,1] = np.minimum(g, np.maximum(r,b)+18)
    return Image.fromarray(np.dstack((a,alpha*255)).astype('uint8'))

frames = {}; tiles = []
for name,(num,cols,rows) in spec.items():
    sheet = key_green(Image.open(files[num]))
    # Label whole-sheet silhouettes before cropping: generated sheets are not exact grids.
    small = sheet.getchannel('A').resize((sheet.width//2,sheet.height//2))
    mask = np.array(small)>100; seen=np.zeros(mask.shape,dtype=bool); groups=[]
    hh,ww=mask.shape
    for sy,sx in zip(*np.where(mask)):
        if seen[sy,sx]: continue
        stack=[(int(sy),int(sx))];seen[sy,sx]=True;pts=[]
        while stack:
            yy,xx=stack.pop();pts.append((yy,xx))
            for ny,nx in ((yy-1,xx),(yy+1,xx),(yy,xx-1),(yy,xx+1)):
                if 0<=ny<hh and 0<=nx<ww and mask[ny,nx] and not seen[ny,nx]:
                    seen[ny,nx]=True;stack.append((ny,nx))
        if len(pts)>900:
            v=np.array(pts); groups.append((v[:,0].min(),v[:,1].min(),v[:,0].max()+1,v[:,1].max()+1,pts))
    if name=='whirl':
        split=[]
        for g in groups:
            if g[3]-g[1]>ww*.36:
                for side in (False,True):
                    pts=[(y,x) for y,x in g[4] if (x>=ww//2)==side]
                    v=np.array(pts);split.append((v[:,0].min(),v[:,1].min(),v[:,0].max()+1,v[:,1].max()+1,pts))
            else: split.append(g)
        groups=split
    groups.sort(key=lambda g:(round(((g[0]+g[2])/2)/(hh/rows)-.5),g[1]))
    scale = None; frames[name] = []
    for y0,x0,y1,x1,pts in groups:
        alpha=Image.new('L',small.size);arr=np.zeros(mask.shape,dtype=np.uint8)
        for yy,xx in pts: arr[yy,xx]=255
        # Expand component matte slightly to retain the original antialiased edge.
        from PIL import ImageFilter,ImageChops
        alpha=Image.fromarray(arr).resize(sheet.size,Image.Resampling.NEAREST).filter(ImageFilter.MaxFilter(7))
        tile=sheet.copy();tile.putalpha(ImageChops.multiply(sheet.getchannel('A'),alpha))
        tile=tile.crop(tile.getbbox())
        if scale is None: scale = 142/tile.height
        tile = tile.resize((max(1,round(tile.width*scale)),max(1,round(tile.height*scale))),Image.Resampling.LANCZOS)
        # Upper-body mass is a steadier pivot than a sword-dependent bounding box.
        anchor_mask = np.array(tile.getchannel('A'))
        yy,xx = np.where(anchor_mask[:max(1,int(tile.height*.45))]>150)
        anchor = float(np.median(xx)) if len(xx) else tile.width/2
        frames[name].append({'atlas':[0,0,tile.width,tile.height], 'anchor':[round(anchor),tile.height]})
        tiles.append((frames[name][-1],tile))

# Effect rows: horizontal cut, rising cut, ground impact / wave, moon, lightning.
for num, name, y0, y1, cuts in [
    (29,'slash',0,325,[0,320,740,1110,1448]),
    (29,'rise',325,650,[0,320,740,1110,1448]),
    (29,'impact',650,1086,[0,340,730,1100,1448]),
    (30,'wave',0,195,[0,385,835,1260,1672]),
    (30,'moon',195,510,[0,280,635,1020,1370,1672]),
    (30,'lightning',510,800,[0,320,650,980,1350,1672]),
    (30,'dust',800,941,[0,380,800,1220,1672])]:
    sheet = Image.open(files[num]).convert('RGB')
    frames[name]=[]
    for x0,x1 in zip(cuts,cuts[1:]):
            tile=sheet.crop((x0,y0,x1,y1))
            a=np.array(tile); alpha=np.max(a,axis=2)
            # Unpremultiply against the original black background for clean additive edges.
            rgb=np.minimum(255,a.astype(float)*255/np.maximum(alpha[:,:,None],1))
            tile=Image.fromarray(np.dstack((rgb,alpha)).astype('uint8'))
            tile.thumbnail((210,170),Image.Resampling.LANCZOS)
            frames[name].append({'atlas':[0,0,tile.width,tile.height], 'anchor':[tile.width/2,tile.height]})
            tiles.append((frames[name][-1],tile))

atlas=Image.new('RGBA',(2048,4096)); x=y=rowh=0
for f,tile in tiles:
    if x+tile.width+2>atlas.width: x=0;y+=rowh+2;rowh=0
    f['atlas'][:2]=[x,y];atlas.paste(tile,(x,y));x+=tile.width+2;rowh=max(rowh,tile.height)
atlas=atlas.crop((0,0,2048,y+rowh+2));atlas.save(out/'atlas.png')
portrait=key_green(Image.open(files[1])).crop((200,0,770,650));portrait.thumbnail((180,180));portrait.save(out/'portrait.png')
def uri(im):
    b=io.BytesIO();im.save(b,format='PNG');return 'data:image/png;base64,'+base64.b64encode(b.getvalue()).decode()
data={'clips':frames,'atlas':uri(atlas),'portrait':uri(portrait)}
(ROOT/'barel-art.js').write_text('const BAREL_ART = '+json.dumps(data,separators=(',',':'))+';\n',encoding='utf-8')
(out/'frames.json').write_text(json.dumps(frames,indent=2),encoding='utf-8')
preview=Image.new('RGB',(1000,((len(spec)+4)//5)*180),'#252333');d=ImageDraw.Draw(preview)
for i,name in enumerate(spec):
    f=frames[name][0];sx,sy,w,h=f['atlas'];tile=atlas.crop((sx,sy,sx+w,sy+h));preview.paste(tile,((i%5)*200,(i//5)*180),tile);d.text(((i%5)*200,(i//5)*180+160),name,fill='white')
preview.save(out/'preview.jpg')
print('Built',len(tiles),'frames',atlas.size)

