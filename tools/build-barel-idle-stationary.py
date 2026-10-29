"""Keep the supplied idle poses while locking their feet to the first pose."""
import json
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1]
ase = root / 'assets/aseprite'
source = ase / 'barel-idle-dot-10'
dest = ase / 'barel-idle-stationary-10'
export = ase / 'exports/barel-idle-stationary-10'
dest.mkdir(parents=True, exist_ok=True)
export.mkdir(parents=True, exist_ok=True)
frames = [Image.open(source / f'F{i:02}.png').convert('RGBA') for i in range(1, 11)]
# The source's rear sole drifts left. Align that contact before pinning both
# lower legs; the sword tip lies to the right of this leg-only rectangle.
shifts = [0, 2, 1, 2, 3, 6, 9, 15, 18, 20]
foot_box = (120, 377, 280, 448)
sheet = Image.new('RGBA', (4480, 448))
bounds = []
for i, (frame, dx) in enumerate(zip(frames, shifts)):
    aligned = Image.new('RGBA', frame.size)
    aligned.paste(frame, (dx, 0))
    aligned.paste(frames[0].crop(foot_box), foot_box[:2])
    bounds.append(aligned.getbbox())
    sheet.paste(aligned, (i*448, 0))
sheet.save(export / 'barel-idle-stationary-10.png')
atlas = json.loads((ase/'exports/barel-idle-dot-10/barel-idle-dot-10.json').read_text(encoding='utf-8'))
atlas['meta']['image'] = 'barel-idle-stationary-10.png'
(export/'barel-idle-stationary-10.json').write_text(json.dumps(atlas, indent=2)+'\n', encoding='utf-8')
meta = json.loads((source/'barel-idle-dot-10.animation.json').read_text(encoding='utf-8'))
meta['sprite'] = '../exports/barel-idle-stationary-10/barel-idle-stationary-10.json'
meta['source']['file'] = '../barel-idle-dot-10/source/original.png'
meta['source']['pixelClones'] = True
meta['source']['stationaryFootBox'] = list(foot_box)
meta['source']['horizontalAlignment'] = shifts
meta['previewBounds'] = [min(b[0] for b in bounds)-224, min(b[1] for b in bounds)-416,
                         max(b[2] for b in bounds)-224, max(b[3] for b in bounds)-416]
(dest/'barel-idle-stationary-10.animation.json').write_text(json.dumps(meta, indent=2)+'\n', encoding='utf-8')
