from pathlib import Path
import json, re
from PIL import Image, ImageDraw, ImageSequence

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).parent
REF = Path('C:/Users/훈도/Desktop/흑월의 기사 리부트/참고품들')
CW, CH, COLS = 190, 220, 7

def sheet(rows, filename):
    canvas = Image.new('RGB', (CW*COLS, CH*len(rows)), '#30343c')
    d = ImageDraw.Draw(canvas)
    for row, (label, frames) in enumerate(rows):
        d.text((8, row*CH+4), label, fill='white')
        ids = list(range(len(frames))) if len(frames) <= COLS else [round(i*(len(frames)-1)/(COLS-1)) for i in range(COLS)]
        # A single scale per sequence retains the size differences between poses.
        scale = min((CW-12)/max(f.width for f in frames), (CH-45)/max(f.height for f in frames))
        scale = min(scale, 2)
        for col, i in enumerate(ids):
            im = frames[i].convert('RGBA')
            im = im.resize((round(im.width*scale), round(im.height*scale)), Image.Resampling.NEAREST)
            x, y = col*CW+(CW-im.width)//2, row*CH+CH-18-im.height
            canvas.paste(im, (x,y), im)
            d.text((col*CW+7,row*CH+CH-16), f'{i+1}/{len(frames)}', fill='#dddddd')
    dest = OUT / filename
    canvas.save(dest)
    print(dest)

refs = []
for p in sorted(REF.glob('*.gif')):
    gif = Image.open(p)
    frames = [f.convert('RGBA').copy() for f in ImageSequence.Iterator(gif)]
    gif.seek(0)
    durations=[]
    for i in range(gif.n_frames):
        gif.seek(i)
        durations.append(gif.info.get('duration',0))
    print(p.name, 'frames=',len(frames), 'ms=',sum(durations), 'holds=',sorted(set(durations)))
    refs.append((p.stem,frames))
for i in range(0,len(refs),4):
    sheet(refs[i:i+4],f'kenji-{i//4+1}.png')

def gd_clip(name):
    text = (ROOT/'godot/port_assets/resources'/f'barel_rika.sheet.{name}.tres').read_text(encoding='utf-8')
    path = re.search(r'path="res://(port_assets/images/[^\"]+)"', text).group(1)
    atlas = Image.open(ROOT/'godot'/path).convert('RGBA')
    rects = re.findall(r'region = Rect2\(([^)]+)\)',text)
    return [atlas.crop((int(x),int(y),int(x+w),int(y+h))) for x,y,w,h in [map(float,r.split(',')) for r in rects]]

rows=[]
for name in ['idle','walk','run','combo0','combo1','combo2']:
    try: rows.append(('Barel Godot '+name,gd_clip(name)))
    except FileNotFoundError: pass
sheet(rows,'barel-current.png')

for who in ['viesa','morgra','aurelion','vargul','sovereign']:
    data=json.loads((ROOT/'assets'/who/'frames.json').read_text(encoding='utf-8'))
    clips=data['clips']
    print(who, 'clips=',list(clips))
    keys=[k for k in clips if any(s in k for s in ['idle','walk','run','attack','slash','shot','draw','cleave','melee'])][:4]
    rows=[]
    for key in keys:
        raw=clips[key]
        fs=raw if isinstance(raw,list) else raw.get('frames',[])
        frames=[]
        for f in fs:
            if 'atlas' not in f: continue
            page=f.get('sheet',f.get('p',0))
            folder=ROOT/'assets'/who
            candidates=[folder/f'atlas-{page}.png',folder/f'atlas-{page}.webp',folder/f'sheet-{page}.webp',folder/'atlas.png']
            p=next((p for p in candidates if p.exists()),None)
            if p is None: continue
            atlas=Image.open(p).convert('RGBA')
            x,y,w,h=f['atlas']
            frames.append(atlas.crop((x,y,x+w,y+h)))
        if frames: rows.append((who+' '+key,frames))
    if rows: sheet(rows,who+'-current.png')

data=json.loads((ROOT/'data/gorath_remake.json').read_text(encoding='utf-8'))
print('gorath_remake keys',list(data))
