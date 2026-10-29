"""Remove retired ultimate cels from shared atlases without changing other pixels."""
import hashlib
import json
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1]
js = root / 'sovereign-art.js'
text = js.read_text(encoding='utf-8')
data = json.loads(text[text.index('{'):text.rindex(';')])
retired = ('ultimate', 'mask_ultimate', 'giant')
rects = {}
for key in retired:
    for frame in data['clips'].pop(key, []):
        if frame:
            rects.setdefault(frame['sheet'], []).append(frame['atlas'])
for sheet, boxes in rects.items():
    # Packing uses independent rectangles. Refuse to erase a live cel.
    for frames in data['clips'].values():
        for frame in frames:
            if not frame or frame['sheet'] != sheet:
                continue
            x,y,w,h = frame['atlas']
            for a,b,c,d in boxes:
                assert not (x<a+c and a<x+w and y<b+d and b<y+h), 'Live atlas frame overlaps retired frame'
    old = data['sheets'][sheet]
    im = Image.open(root/old).convert('RGBA')
    for x,y,w,h in boxes:
        im.paste((0,0,0,0), (x,y,x+w,y+h))
    tmp = root/'assets/runtime/sovereign-atlas-tmp.webp'
    im.save(tmp, format='WEBP', lossless=True, method=4, exact=True)
    name = 'assets/runtime/'+hashlib.sha256(tmp.read_bytes()).hexdigest()[:24]+'.webp'
    tmp.replace(root/name)
    data['sheets'][sheet] = name
    manifest = root/'data/runtime-assets.json'
    assets = json.loads(manifest.read_text(encoding='utf-8'))
    assets = [name if item==old else item for item in assets]
    manifest.write_text(json.dumps(assets,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
js.write_text('const SOVEREIGN_ART = '+json.dumps(data,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
