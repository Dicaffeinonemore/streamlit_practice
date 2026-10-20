"""Import supplied sprite/data ZIPs without running their bundled tools."""
import argparse, base64, io, json, zipfile
from pathlib import Path
from PIL import Image
from boss_art_common import pack_tiles

# Logical frame units stay at x.55 of the source (hitboxes, anchors); the atlas keeps
# source pixels and the runtime divides by HD when drawing.
SCALE = .55
HD = 1 / SCALE

parser=argparse.ArgumentParser()
parser.add_argument('sprites',type=Path)
parser.add_argument('framedata',type=Path)
args=parser.parse_args()
root=Path(__file__).resolve().parents[1]
out=root/'assets/morgra';out.mkdir(exist_ok=True)
sprites=zipfile.ZipFile(args.sprites);data=zipfile.ZipFile(args.framedata)
catalog=json.loads(sprites.read('sprites_220/morgra.json'))
fx=json.loads(sprites.read('sprites_220/fx/fx.json'))
clips={};timing={};tiles=[]
for m in catalog['motions']:
    timing[m['id']]=json.loads(data.read('game/data/bosses/morgra/moves/'+m['id']+'.json'))
for m in catalog['motions']+fx['effects']+fx['parts']:
    name=m['id'];cell=m.get('cell',m.get('size'));pivot=m.get('pivot',[0,cell[1]/2])
    path=m.get('file',m.get('files',{}).get('alpha','fx/'+name+'.png'))
    im=Image.open(io.BytesIO(sprites.read('sprites_220/'+path))).convert('RGBA')
    key=name if m in catalog['motions'] else 'fx_'+name
    clips[key]=[]
    for i in range(m['frames']):
        tile=im.crop((i*cell[0],0,(i+1)*cell[0],cell[1]))
        box=tile.getbbox() or (0,0,*tile.size);tile=tile.crop(box)
        f={'atlas':[0,0,*tile.size],'anchor':[round((pivot[0]-box[0])*SCALE,2),round((pivot[1]-box[1])*SCALE,2)]}
        clips[key].append(f);tiles.append((f,tile))
tiles.sort(key=lambda t:-t[1].height)
atlas=pack_tiles(tiles,4096,4096);atlas.save(out/'atlas.png')
meta={'clips':clips,'timing':timing,'scale':SCALE,'hd':HD,'idleHeight':121,'projectiles':json.loads(data.read('game/data/bosses/morgra/projectiles.json')),'boss':json.loads(data.read('game/data/bosses/morgra/morgra_boss.json'))}
(out/'frames.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2),encoding='utf-8')
b=io.BytesIO();atlas.save(b,format='PNG',optimize=True);meta['atlas']='data:image/png;base64,'+base64.b64encode(b.getvalue()).decode()
(root/'morgra-art.js').write_text('const MORGRA_ART = '+json.dumps(meta,separators=(',',':'))+';\n',encoding='utf-8')
print('Morgra:',len(tiles),'frames;',atlas.size)
