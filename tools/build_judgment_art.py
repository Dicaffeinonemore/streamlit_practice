"""Embed the supplied Moon Judgment sprite sheets without changing their frame grid."""
import base64
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
art = {}
# Lossless GIF decoding only: keep the supplied transparent pixels and all 24 frames.
gif = Image.open(ROOT / 'assets/morgra/judgment-field.gif')
sheet = Image.new('RGBA', (gif.width * 6, gif.height * 4))
durations = []
for i in range(gif.n_frames):
    gif.seek(i)
    sheet.paste(gif.convert('RGBA'), ((i % 6) * gif.width, (i // 6) * gif.height))
    durations.append(gif.info.get('duration', 80))
sheet.save(ROOT / 'assets/morgra/judgment-field-gif.png', optimize=True)
art['fieldDurations'] = durations
for key, filename in [('moon', 'judgment-moon.png'), ('field', 'judgment-field-gif.png')]:
    art[key] = 'data:image/png;base64,' + base64.b64encode((ROOT / 'assets/morgra' / filename).read_bytes()).decode('ascii')
(ROOT / 'judgment-art.js').write_text('const JUDGMENT_ART = ' + json.dumps(art, separators=(',', ':')) + ';\n', encoding='utf-8')
