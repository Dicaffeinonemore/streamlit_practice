"""Build the ten-frame lightning scroll clip without repacking existing art.

Also called by viesa_build.py. Run externalize-art.cjs after a full art rebuild.
"""
from pathlib import Path
import hashlib
import json
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
source = Image.open(ROOT / 'assets_src/viesa/lightning-scroll/source-10.png').convert('RGBA')
art_file = ROOT / 'viesa-art.js'
art = json.loads(art_file.read_text(encoding='utf-8').split('=', 1)[1].strip().rstrip(';'))
# Idempotent: replace the previous scroll page on subsequent builds.
old = art['clips'].get('scroll_cast')
sheet = old[0]['sheet'] if old else len(art['sheets'])
cols = 5
ch = source.height // 2
edges = [[0,342,642,930,1220,1536], [0,308,640,956,1275,1536]]
cw = max(b-a for row in edges for a,b in zip(row,row[1:]))
scale = (art['worldHeight'] / art['scale']) / (ch * .735)
tw, th = round(cw * scale), round(ch * scale)
atlas = Image.new('RGBA', (tw * cols, th * 2))
frames = []
# Feet stay planted, despite the raised scroll extending above the head.
feet = [(210,474),(511,474),(796,474),(1086,474),(1388,474),
        (190,992),(490,992),(797,992),(1095,992),(1415,992)]
tips = [(180,260),(540,210),(860,200),(1145,210),(1460,90),
        (234,550),(560,550),(830,560),(1200,600),(1480,770)]

def extract_sprite(tile, tip):
    """Separate neighboring silhouettes when hair crosses a grid boundary."""
    pixels = tile.load()
    remaining = {(x,y) for y in range(tile.height) for x in range(tile.width) if pixels[x,y][3]>24}
    groups = []
    while remaining:
        start = remaining.pop()
        stack, group = [start], [start]
        while stack:
            x,y = stack.pop()
            for point in ((x-1,y),(x+1,y),(x,y-1),(x,y+1)):
                if point in remaining:
                    remaining.remove(point);stack.append(point);group.append(point)
        groups.append(group)
    body = max(groups, key=len)
    mask = Image.new('L',tile.size)
    target = mask.load()
    for group in groups:
        effect = any((pixels[x,y][2]>pixels[x,y][0]*1.15 or
                      pixels[x,y][0]>180 and pixels[x,y][1]>130)
                     and (x-tip[0])**2+(y-tip[1])**2<140**2 for x,y in group)
        if group is body or effect:
            for x,y in group:
                target[x,y]=pixels[x,y][3]
    tile.putalpha(mask)
    return tile

for i, (foot, tip) in enumerate(zip(feet, tips)):
    row, col = divmod(i, cols)
    x, right = edges[row][col:col+2]
    y = row * ch
    tile = extract_sprite(source.crop((x,y,right,y+ch)), (tip[0]-x,tip[1]-y))
    tile = tile.resize((round((right-x)*scale), th), Image.Resampling.LANCZOS)
    atlas.paste(tile, (i % cols * tw, i // cols * th))
    ax, ay = (foot[0]-x)*scale, (foot[1]-y)*scale
    frames.append({'atlas': [i % cols * tw, i // cols * th, tw, th],
                   'anchor': [round(ax, 3), round(ay, 3)], 'sheet': sheet,
                   'tip': [round((tip[0]-foot[0])*scale, 3), round((foot[1]-tip[1])*scale, 3)]})
out = ROOT / 'assets/viesa/lightning-scroll.png'
atlas.save(out)
digest = hashlib.sha256(out.read_bytes()).hexdigest()[:24]
url = f'assets/runtime/{digest}.png'
(ROOT / url).write_bytes(out.read_bytes())
if old:
    art['sheets'][sheet] = url
else:
    art['sheets'].append(url)
art['clips']['scroll_cast'] = frames
art_file.write_text('const VIESA_ART = ' + json.dumps(art, separators=(',', ':')) + ';\n', encoding='utf-8')
metadata = ROOT / 'assets/viesa/frames.json'
data = json.loads(metadata.read_text(encoding='utf-8'))
data['clips']['scroll_cast'] = frames
metadata.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
preview = []
for frame in frames:
    x, y, w, h = frame['atlas']
    tile = atlas.crop((x, y, x + w, y + h)).resize((w * 2, h * 2), Image.Resampling.NEAREST)
    canvas = Image.new('RGBA', (360, 430), '#17151d')
    ax, ay = frame['anchor']
    canvas.alpha_composite(tile, (round(180 - ax * 2), round(390 - ay * 2)))
    preview.append(canvas.convert('RGB'))
preview[0].save(ROOT / 'assets/viesa/lightning-scroll-preview.gif', save_all=True,
                append_images=preview[1:], duration=[60, 50, 50, 60, 50, 60, 50, 80, 90, 90], loop=0)
print(f'Built scroll_cast: {len(frames)} frames, {url}')
