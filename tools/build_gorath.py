"""Import supplied sprite/data ZIPs without running their bundled tools."""
import argparse, base64, io, json, zipfile
from pathlib import Path
from PIL import Image

parser=argparse.ArgumentParser()
parser.add_argument('sprites',type=Path)
parser.add_argument('framedata',type=Path)
args=parser.parse_args()
root=Path(__file__).resolve().parents[1]
out=root/'assets/gorath';out.mkdir(exist_ok=True)
sprites=zipfile.ZipFile(args.sprites);data=zipfile.ZipFile(args.framedata)
catalog=json.loads(sprites.read('sprites_280/gorath.json'))
fx=json.loads(sprites.read('sprites_280/fx/fx.json'))
clips={};timing={};tiles=[]
for m in catalog['motions']:
    timing[m['id']]=json.loads(data.read('game/data/bosses/gorath/moves/'+m['id']+'.json'))
for m in catalog['motions']+fx['effects']+fx['parts']:
    name=m['id'];cell=m.get('cell',m.get('size'));pivot=m.get('pivot',[0,cell[1]/2])
    path=m.get('file',m.get('files',{}).get('alpha','fx/'+name+'.png'))
    im=Image.open(io.BytesIO(sprites.read('sprites_280/'+path))).convert('RGBA')
    clips[name]=[]
    for i in range(m['frames']):
        tile=im.crop((i*cell[0],0,(i+1)*cell[0],cell[1]))
        tile=tile.resize((round(cell[0]*.5),round(cell[1]*.5)),Image.Resampling.NEAREST)
        f={'atlas':[0,0,*tile.size],'anchor':[round(pivot[0]*.5),round(pivot[1]*.5)]}
        clips[name].append(f);tiles.append((f,tile))
atlas=Image.new('RGBA',(2048,4096));x=y=rh=0
for f,tile in tiles:
    if x+tile.width+2>2048:x=0;y+=rh+2;rh=0
    f['atlas'][:2]=[x,y];atlas.paste(tile,(x,y));x+=tile.width+2;rh=max(rh,tile.height)
atlas=atlas.crop((0,0,2048,y+rh+2));atlas.save(out/'atlas.png')
meta={'clips':clips,'timing':timing,'scale':.5,'idleHeight':140}
(out/'frames.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2),encoding='utf-8')
b=io.BytesIO();atlas.save(b,format='PNG');meta['atlas']='data:image/png;base64,'+base64.b64encode(b.getvalue()).decode()
(root/'gorath-art.js').write_text('const GORATH_ART = '+json.dumps(meta,separators=(',',':'))+';\n',encoding='utf-8')
print('Gorath:',len(tiles),'frames;',atlas.size)
