"""Embed unchanged supplied item PNGs for both local and Streamlit play."""
from pathlib import Path
import base64
import json
import shutil
import sys

ROOT = Path(__file__).resolve().parents[1]
FILES = {'big': '고기.png', 'gold': '금괴.png', 'coinBag': '동전 주머니.png',
         'coin': '동전.png', 'scroll': '마법 스크롤.png', 'box': '상자.png',
         'potion': '생선.png', 'crystal': '엘릭서.png'}

if __name__ == '__main__':
    folder = ROOT / 'assets/items'
    folder.mkdir(parents=True, exist_ok=True)
    data = {}
    for key, name in FILES.items():
        target = folder / name
        if len(sys.argv) > 1:
            shutil.copyfile(Path(sys.argv[1]) / name, target)
        data[key] = 'data:image/png;base64,' + base64.b64encode(target.read_bytes()).decode('ascii')
    (ROOT / 'item-art.js').write_text('const ITEM_ART = ' + json.dumps(data) + ';\n', encoding='utf-8')
