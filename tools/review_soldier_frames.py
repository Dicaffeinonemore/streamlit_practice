"""Render every runtime soldier frame on a contrasting background for inspection."""
from pathlib import Path
import json
import sys
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parents[1]
out = Path(sys.argv[1])
out.mkdir(parents=True, exist_ok=True)
manifest = json.loads((root / 'data/named-sprites.json').read_text(encoding='utf8'))
atlas = Image.open(root / 'assets/named/combat.png').convert('RGBA')
for stage in range(1, 6):
    columns = max(sum(map(len, manifest['clips'][f'stage{stage}_{role}'].values()))
                  for role in ('grunt', 'rogue', 'archer', 'brute'))
    canvas = Image.new('RGB', (columns * 150, 720), '#353544')
    draw = ImageDraw.Draw(canvas)
    for row, role in enumerate(('grunt', 'rogue', 'archer', 'brute')):
        col = 0
        for action, ids in manifest['clips'][f'stage{stage}_{role}'].items():
            for index in ids:
                f = manifest['frames'][index]
                x, y, w, h = f['atlas']
                im = atlas.crop((x, y, x+w, y+h))
                im.thumbnail((145, 150), Image.Resampling.NEAREST)
                canvas.paste(im, (col*150+(150-im.width)//2, row*180+150-im.height), im)
                draw.text((col*150+3, row*180+153), f'{role} {action} {index}', fill='white')
                col += 1
    canvas.save(out / f'soldiers-{stage}.png')
