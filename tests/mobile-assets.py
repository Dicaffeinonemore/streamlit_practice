"""Run: py -3.14 -B tests/mobile-assets.py

Also writes the optimized fixture for MOBILE_SUITE=1 node tests/regression.cjs.
MOBILE_STREAMLIT=http://localhost:8517 runs that suite in a live Streamlit iframe.
"""
import json
import re
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import server
from asset_bundle import prepare_item

html = server.build_single_html("static/game-assets/")
assert len(html.encode()) < 15_000_000
assert "data:image/" not in html
groups = json.loads(re.search(r"GAME_ASSET_GROUPS=(.*?);globalThis.ITEM_ART_PREPARED", html).group(1))
assert set(groups.values()) >= {"common", "first-scene", "opening", "stage0", "stage1", "stage2", "stage3", "stage4"}
for url in groups:
    assert (ROOT / url).is_file(), url
assert html.count('"sheet":"stage') > 0
assert "GAME_ASSETS.image()" in html
# Border key must preserve an enclosed white highlight.
source = Image.new("RGBA", (9, 9), "white")
for y in range(2, 7):
    for x in range(2, 7):
        source.putpixel((x, y), (30, 20, 10, 255))
source.putpixel((4, 4), (255, 255, 255, 255))
prepared = prepare_item(source)
assert prepared.size == (5, 5)
assert prepared.getpixel((2, 2))[3] == 255
(ROOT / "static/mobile-test.html").write_text(html, encoding="utf-8")
print(f"PASS external assets, stage groups, item key, HTML {len(html.encode()):,} bytes")
