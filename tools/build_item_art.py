"""Build item-art.js from the supplied item PNGs for both local and Streamlit play.

The originals in assets/items stay unchanged. Background keying, trimming and the
cached diagonal lighting used to run in the browser through getImageData on the
full-size PNGs (~13.8MB bundle). The same processing now runs here, and the
bundle stores small ready-to-draw PNGs.
"""
from pathlib import Path
import base64
import io
import json
import shutil
import sys

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
FILES = {'big': '고기.png', 'gold': '금괴.png', 'coinBag': '동전 주머니.png',
         'coin': '동전.png', 'scroll': '마법 스크롤.png', 'box': '상자.png',
         'potion': '생선.png', 'crystal': '엘릭서.png'}
MAX_SIDE = 192   # drawn at most 48 world px (72 screen px); 192 keeps a 2.6x margin
LIGHT = [(0, (255, 237, 195, .22)), (.45, (255, 237, 195, 0)), (1, (12, 8, 28, .38))]


def key_background(rgba):
    """Clear neutral bright pixels 4-connected to the outer edge; enclosed highlights stay."""
    rgb = rgba[:, :, :3].astype(np.int16)
    lo, hi = rgb.min(2), rgb.max(2)
    candidate = (rgba[:, :, 3] == 0) | ((lo >= 175) & (hi - lo <= 22))
    background = np.zeros_like(candidate)
    background[0, :], background[-1, :], background[:, 0], background[:, -1] = (
        candidate[0, :], candidate[-1, :], candidate[:, 0], candidate[:, -1])
    while True:
        grown = background.copy()
        grown[1:] |= background[:-1]
        grown[:-1] |= background[1:]
        grown[:, 1:] |= background[:, :-1]
        grown[:, :-1] |= background[:, 1:]
        grown &= candidate
        if (grown == background).all():
            break
        background = grown
    out = rgba.copy()
    out[background, 3] = 0
    return out


def light(rgba):
    """Diagonal top-left → bottom-right tint, composited source-atop."""
    h, w = rgba.shape[:2]
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    dx, dy = max(1, w - 1), max(1, h - 1)
    t = np.clip((x * dx + y * dy) / (dx * dx + dy * dy), 0, 1)
    color, alpha = np.zeros((h, w, 3), np.float32), np.zeros((h, w), np.float32)
    for (t0, c0), (t1, c1) in zip(LIGHT, LIGHT[1:]):
        band = (t >= t0) & (t <= t1)
        u = ((t - t0) / (t1 - t0))[band]
        for i in range(3):
            color[:, :, i][band] = c0[i] + (c1[i] - c0[i]) * u
        alpha[band] = c0[3] + (c1[3] - c0[3]) * u
    out = rgba.astype(np.float32)
    out[:, :, :3] = out[:, :, :3] * (1 - alpha[:, :, None]) + color * alpha[:, :, None]
    return np.clip(np.rint(out), 0, 255).astype(np.uint8)


def prepare(path):
    rgba = key_background(np.array(Image.open(path).convert('RGBA')))
    ys, xs = np.nonzero(rgba[:, :, 3])
    rgba = light(rgba[ys.min():ys.max() + 1, xs.min():xs.max() + 1])
    image = Image.fromarray(rgba)
    scale = min(1, MAX_SIDE / max(image.size))
    image = image.resize((max(1, round(image.width * scale)), max(1, round(image.height * scale))), Image.Resampling.LANCZOS)
    stream = io.BytesIO()
    image.save(stream, 'PNG', optimize=True)
    return stream.getvalue()


if __name__ == '__main__':
    folder = ROOT / 'assets/items'
    folder.mkdir(parents=True, exist_ok=True)
    data = {}
    for key, name in FILES.items():
        target = folder / name
        if len(sys.argv) > 1:
            shutil.copyfile(Path(sys.argv[1]) / name, target)
        data[key] = 'data:image/png;base64,' + base64.b64encode(prepare(target)).decode('ascii')
    (ROOT / 'item-art.js').write_text('const ITEM_ART = ' + json.dumps(data) + ';\n', encoding='utf-8')
    print({k: len(v) for k, v in data.items()})
