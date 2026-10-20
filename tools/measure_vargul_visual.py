"""Measure immutable atlas body coverage to prevent pose-height enlargement.

Only updates runtime scale data. Does not resample or rewrite sprite assets.
"""
import json
import math
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]


def main():
    meta = json.loads((ROOT / 'assets/vargul/frames.json').read_text(encoding='utf8'))
    sheets = {int(p.stem.split('-')[1]): Image.open(p).convert('RGBA')
              for p in (ROOT / 'assets/vargul').glob('atlas-*')}
    areas = {}
    for clip in meta['motions']:
        areas[clip] = []
        for frame in meta['clips'][clip]:
            x, y, w, h = frame['atlas']
            a = np.array(sheets[frame['sheet']].crop((x, y, x+w, y+h))).astype(float)
            r, g, b, alpha = [a[:, :, c] for c in range(4)]
            body = (alpha > 110) & ~((b > r*1.18) & (g > r*1.12) & (b > 110))
            areas[clip].append(int(body.sum()))
    baseline = [float(np.median(areas[p+'_idle'])) for p in ['p1', 'p2']]
    scales = {}
    for clip, values in areas.items():
        p2 = clip.startswith('p2_') or clip in ['ultimate', 'death']
        bases = [baseline[int(p2)]] * len(values)
        if clip == 'awaken':
            bases = [baseline[0] + (baseline[1]-baseline[0])*i/(len(values)-1) for i in range(len(values))]
        # Never enlarge a naturally smaller pose or late death debris.
        # Keep intro's throne and death's intended break-apart composition intact.
        scales[clip] = [round(min(1, math.sqrt(base/max(1, value))), 6)
                        if clip not in ['p1_intro', 'death'] else 1
                        for value, base in zip(values, bases)]
    code = ('// VISUAL_SCALE_BEGIN\n'
            '// Body coverage relative to phase idle; excludes cyan spear/glow. Shrink only.\n'
            'const VARGUL_VISUAL_SCALES = '+json.dumps(scales, separators=(',', ':'))+';\n'
            '// VISUAL_SCALE_END')
    path = ROOT / 'vargul-data.js'
    text = path.read_text(encoding='utf8')
    if '// VISUAL_SCALE_BEGIN' in text:
        start = text.index('// VISUAL_SCALE_BEGIN')
        end = text.index('// VISUAL_SCALE_END') + len('// VISUAL_SCALE_END')
        text = text[:start] + code + text[end:]
    else:
        text = text.replace('// Combat time is independent', code+'\n\n// Combat time is independent', 1)
    path.write_text(text, encoding='utf8')
    out = ROOT / 'artifacts/vargul-1.36/visual-fix'
    out.mkdir(parents=True, exist_ok=True)
    (out / 'measurements.json').write_text(json.dumps({'baseline': baseline, 'areas': areas, 'scales': scales}, indent=2), encoding='utf8')
    print('Measured316 frozen frames; runtime-only shrink correction; no sprite assets changed.')


if __name__ == '__main__':
    main()
