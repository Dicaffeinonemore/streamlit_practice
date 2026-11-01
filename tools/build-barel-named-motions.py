"""Build animation atlases from the eight user-supplied, named sprite sheets."""
from pathlib import Path
import hashlib
import json
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'assets/barel/named-motion-source'
OUT = ROOT / 'assets/runtime'
SPECS = [('whirl', '바렐 o스킬.png', 4, 430, .35),
         ('leap', '바렐 p스킬.png', 5, 430, .40),
         ('getup', '바렐 기상.png', 3, 475, .34)] + [
         (f'special{i}', f'바렐 흑월참 {i}타.png', 5, 310, .62) for i in range(1, 6)]
CELL = 640

def keep_main_shape(frame):
    """Remove disconnected scraps from adjacent poses after seam separation."""
    a = frame.getchannel('A')
    w,h = a.size
    data = bytearray(a.tobytes())
    seen = bytearray(w*h)
    largest = []
    for pos, value in enumerate(data):
        if value < 32 or seen[pos]:
            continue
        seen[pos] = 1
        stack = [pos]
        group = []
        while stack:
            k = stack.pop(); group.append(k)
            x,y = k%w,k//w
            for ny in range(max(0,y-1),min(h,y+2)):
                for nx in range(max(0,x-1),min(w,x+2)):
                    q = ny*w+nx
                    if not seen[q] and data[q] >= 32:
                        seen[q] = 1; stack.append(q)
        if len(group) > len(largest): largest = group
    retained = bytearray(w*h)
    for k in largest: retained[k] = data[k]
    frame.putalpha(Image.frombytes('L',(w,h),bytes(retained)))
    return frame

def seam(alpha, x, top, height, radius=50):
    """Find a low-ink separator, allowing swords to cross a nominal cell edge."""
    width = alpha.width
    lo, hi = max(1, x-radius), min(width-2, x+radius)
    pix = alpha.load()
    prev = [abs(a-x)*.08 for a in range(lo, hi+1)]
    back = []
    for y in range(top, top+height):
        cur, trace = [], []
        for j, a in enumerate(range(lo, hi+1)):
            candidates = [(prev[k]+abs(k-j)*.4, k) for k in range(max(0,j-2), min(len(prev),j+3))]
            cost,k = min(candidates)
            cur.append(cost + (1000 if pix[a,y] >= 32 else 0) + abs(a-x)*.08)
            trace.append(k)
        prev = cur
        back.append(trace)
    index = min(range(len(prev)), key=prev.__getitem__)
    result = [0]*height
    for y in range(height-1,-1,-1):
        result[y] = lo+index
        index = back[y][index]
    return result

def build(name, filename, cols, ground, scale):
    image = Image.open(SOURCE / filename).convert('RGBA')
    w,h = image.size
    rh = h//2
    atlas = Image.new('RGBA', (CELL*cols, CELL*2))
    for row in range(2):
        top = row*rh
        boundaries = [seam(image.getchannel('A'), round(w*i/cols), top, rh) for i in range(1,cols)]
        for col in range(cols):
            left = boundaries[col-1] if col else [0]*rh
            right = boundaries[col] if col < cols-1 else [w]*rh
            mask = Image.new('L',(w,rh))
            polygon = [(left[y],y) for y in range(rh)] + [(right[y],y) for y in range(rh-1,-1,-1)]
            ImageDraw.Draw(mask).polygon(polygon,fill=255)
            frame = image.crop((0,top,w,top+rh))
            # The O sheet's horizontal blades overlap the next pose's cape.
            # Assign the original steel-coloured pixels to the sword's owner.
            corrections = {
                'whirl': [(0,2,1200,1300,180,225),(1,1,800,925,150,200)],
                'special3': [(0,3,1280,1320,150,195),(1,0,320,405,140,205)],
            }.get(name, [])
            if corrections:
                mp,ip = mask.load(),frame.load()
                for rr,owner,x0,x1,y0,y1 in corrections:
                    if row != rr or col not in (owner,owner+1): continue
                    for yy in range(y0,y1):
                        for xx in range(x0,x1):
                            r,g,b,a=ip[xx,yy]
                            if a >= 32 and abs(r-g)<35 and abs(g-b)<35 and r>30:
                                mp[xx,yy] = 255 if col == owner else 0
            frame.putalpha(Image.composite(frame.getchannel('A'), Image.new('L',(w,rh)), mask))
            frame = keep_main_shape(frame)
            center = round((col+.5)*w/cols)
            atlas.paste(frame, (col*CELL+320-center,row*CELL+580-ground), frame)
    from io import BytesIO
    output = BytesIO(); atlas.save(output,format='PNG',optimize=True)
    data = output.getvalue()
    path = f'assets/runtime/{hashlib.sha256(data).hexdigest()[:24]}.png'
    (ROOT/path).write_bytes(data)
    return {'path':path,'columns':cols,'frames':cols*2,'scale':scale}

OUT.mkdir(parents=True,exist_ok=True)
clips = {name:build(name,filename,cols,ground,scale) for name,filename,cols,ground,scale in SPECS}
manifest = ROOT/'data/runtime-assets.json'
old = json.loads(manifest.read_text(encoding='utf-8'))
manifest.write_text(json.dumps(sorted(set(old) | {v['path'] for v in clips.values()}),indent=2)+'\n',encoding='utf-8')
(ROOT/'src/animation/barel-named-motion-data.js').write_text('globalThis.BAREL_NAMED_MOTION_DATA = '+json.dumps(clips,indent=2)+';\n',encoding='utf-8')
print(json.dumps(clips,indent=2))
