from pathlib import Path
import json
from PIL import Image, ImageDraw

root=Path(__file__).resolve().parents[2]
out=Path(__file__).parent
rows=[]
cache={}
for who, keys in [('viesa',['shot','snipe_draw','snipe_release']), ('vargul',['p1_spear_combo','p2_combo']), ('sovereign',['command']), ('gorath_remake',['p1_idle','p1_walk','p1_attack','p1_hook','p2_idle'])]:
    p=root/('data/gorath_remake.json' if who=='gorath_remake' else f'assets/{who}/frames.json')
    data=json.loads(p.read_text(encoding='utf-8'))
    for key in keys:
        if key not in data['clips']: continue
        clip=data['clips'][key]
        frames=clip if isinstance(clip,list) else clip['frames']
        images=[]
        for f in frames:
            page=f.get('p',f.get('sheet',0))
            if who=='gorath_remake': path=root/data['pages'][page]
            else:
                folder=root/'assets'/who
                path=next(p for p in [folder/f'atlas-{page}.png',folder/f'atlas-{page}.webp'] if p.exists())
            if path not in cache: cache[path]=Image.open(path).convert('RGBA')
            x,y,w,h=f['atlas']
            images.append(cache[path].crop((x,y,x+w,y+h)))
        rows.append((who+' '+key,images))

for start in range(0,len(rows),4):
    group=rows[start:start+4]
    canvas=Image.new('RGB',(1330,220*len(group)),'#30343c'); d=ImageDraw.Draw(canvas)
    for row,(label,fs) in enumerate(group):
        d.text((7,row*220+4),label,fill='white')
        k=min(176/max(f.width for f in fs),180/max(f.height for f in fs))
        ids=list(range(len(fs))) if len(fs)<=7 else [round(i*(len(fs)-1)/6) for i in range(7)]
        for col,i in enumerate(ids):
            im=fs[i].resize((round(fs[i].width*k),round(fs[i].height*k)),Image.Resampling.NEAREST)
            canvas.paste(im,(col*190+(190-im.width)//2,row*220+200-im.height),im)
            d.text((col*190+6,row*220+204),f'{i+1}/{len(fs)}',fill='white')
    canvas.save(out/f'details-{start//4+1}.png')
print('detail sheets:',len(rows))
