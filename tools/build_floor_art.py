"""Bundle the five supplied floor PNGs unchanged for local and Streamlit play."""
from pathlib import Path
import base64
import hashlib
import json
import shutil
import sys
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
source = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'assets/floors'
out = ROOT / 'assets/floors'
out.mkdir(parents=True, exist_ok=True)
records, payload = [], []
for stage in range(1, 6):
    name = f'{stage}스테이지 바닥.png'
    original, target = source / name, out / name
    if original.resolve() != target.resolve():
        shutil.copyfile(original, target)
    raw = target.read_bytes()
    with Image.open(target) as im:
        width, height = im.size
    # Show the open stone plane, excluding rear structures and foreground walls.
    top, bottom = (.30, .79) if stage == 4 else (.22, .79)
    crop = [0, round(height * top), width, round(height * (bottom - top))]
    records.append(dict(stage=stage, filename=name, path=f'assets/floors/{name}',
                        size=[width, height], crop=crop, sha256=hashlib.sha256(raw).hexdigest(),
                        status='applied: field, boss entrance, boss arena and phase two',
                        treatment='Unmodified PNG; runtime crop of walkable plane; alternating horizontal reflection; no collision changes'))
    payload.append('data:image/png;base64,' + base64.b64encode(raw).decode('ascii'))
(ROOT / 'data/stage-floors.json').write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding='utf8')
(ROOT / 'floor-art.js').write_text("'use strict';\nconst FLOOR_ART = " + json.dumps(records, ensure_ascii=False) +
    ';\nconst FLOOR_IMAGES = ' + json.dumps(payload) +
    '.map(src => { const im = new Image(); im.src = src; return im; });\n', encoding='utf8')
print('Bundled five unchanged floor PNGs.')
