"""Convert the supplied black-matted 5x2 image into the game's walk atlas."""
import hashlib
import json
import shutil
import sys
from collections import deque
from pathlib import Path

from PIL import Image

root = Path(__file__).resolve().parents[1]
source = Path(sys.argv[1])
folder = root / 'assets/aseprite/barel-walk-revised-10'
export = root / 'assets/aseprite/exports/barel-walk-revised-10'
folder.mkdir(parents=True, exist_ok=True)
export.mkdir(parents=True, exist_ok=True)
shutil.copyfile(source, folder / 'source.png')
im = Image.open(source).convert('RGB')
assert im.size == (1536, 1024)
pixels = im.load()
sheet = Image.new('RGBA', (4480, 448))
anchors = [224, 525, 827, 1124, 1425, 223, 525, 828, 1125, 1427]
for row, (y0, y1, ground) in enumerate(((70, 485, 465), (530, 950, 914))):
    foreground = bytearray(1536 * (y1-y0))
    for y in range(y0, y1):
        for x in range(1536):
            if max(pixels[x, y]) > 10:
                foreground[(y-y0)*1536+x] = 1
    components = []
    for start in range(len(foreground)):
        if not foreground[start]:
            continue
        foreground[start] = 0
        queue = deque([start]); component = []
        while queue:
            p = queue.popleft(); component.append(p)
            x, y = p % 1536, p // 1536
            for nx, ny in ((x-1,y),(x+1,y),(x,y-1),(x,y+1)):
                if 0 <= nx < 1536 and 0 <= ny < y1-y0:
                    n = ny*1536+nx
                    if foreground[n]:
                        foreground[n] = 0; queue.append(n)
        if len(component) > 10000:
            components.append(component)
    assert len(components) == 5, (row, [len(c) for c in components])
    components.sort(key=lambda c: min(p % 1536 for p in c))
    for col, component in enumerate(components):
        index = row*5+col
        for p in component:
            x, y = p % 1536, p // 1536+y0
            dx, dy = x-anchors[index]+224, y-ground+416
            assert 0 <= dx < 448 and 0 <= dy < 448
            sheet.putpixel((index*448+dx, dy), (*pixels[x,y], 255))
sheet.save(export / 'barel-walk-revised-10.png')
old = root / 'assets/aseprite'
atlas = json.loads((old/'exports/barel-walk-dot-10/barel-walk-dot-10.json').read_text(encoding='utf-8'))
atlas['meta']['image'] = 'barel-walk-revised-10.png'
(export/'barel-walk-revised-10.json').write_text(json.dumps(atlas, indent=2)+'\n', encoding='utf-8')
meta = json.loads((old/'barel-walk-dot-10/barel-walk-dot-10.animation.json').read_text(encoding='utf-8'))
meta['sprite'] = '../exports/barel-walk-revised-10/barel-walk-revised-10.json'
meta['frameOffsets'] = [[0, 0]] * 10
meta['source'] = {'file':'source.png', 'sha256':hashlib.sha256(source.read_bytes()).hexdigest(), 'blackMatteRemoved':True}
meta.pop('visualReview', None)
(folder/'barel-walk-revised-10.animation.json').write_text(json.dumps(meta, indent=2)+'\n', encoding='utf-8')
