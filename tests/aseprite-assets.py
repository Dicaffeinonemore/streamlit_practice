"""Ensure the CLI export is a pixel-exact copy of existing Barel combo0."""
import hashlib
import json
import subprocess
from pathlib import Path
from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parents[1]
source = ROOT / 'assets/aseprite/tests/black-knight-basic-attack.aseprite'
output = ROOT / 'assets/aseprite/exports/tests/black-knight-basic-attack'
frames = json.loads((ROOT / 'assets/barel/frames.json').read_text())['combo0']
atlas = Image.open(ROOT / 'assets/barel/atlas.png').convert('RGBA')
sheet = Image.open(output.with_suffix('.png')).convert('RGBA')
data = json.loads(output.with_suffix('.json').read_text())
assert sheet.size == (996, 143)
for old, new in zip(frames, data['frames'], strict=True):
    x, y, w, h = old['atlas']
    expected = Image.new('RGBA', (166, 143))
    expected.paste(atlas.crop((x, y, x+w, y+h)), (67-old['anchor'][0], 143-old['anchor'][1]))
    r = new['frame']
    actual = sheet.crop((r['x'], r['y'], r['x']+r['w'], r['y']+r['h']))
    # Invisible RGB values can be discarded by Aseprite; compare visible pixels.
    bg = Image.new('RGBA', actual.size, '#252333')
    assert ImageChops.difference(Image.alpha_composite(bg, expected).convert('RGB'), Image.alpha_composite(bg, actual).convert('RGB')).getbbox() is None
protected = [ROOT/'game.js', ROOT/'barel-runtime.js', ROOT/'assets/barel/atlas.png', source, output.with_suffix('.png'), output.with_suffix('.json')]
hashes = lambda: [hashlib.sha256(p.read_bytes()).hexdigest() for p in protected]
before = hashes()
result = subprocess.run(['powershell', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', str(ROOT/'tools/export-sprites.ps1')], capture_output=True)
assert result.returncode != 0, 'Existing exports must be refused by default'
assert b'Export exists:' in result.stderr, result.stderr
assert before == hashes(), 'Refusal must preserve source, exports and game runtime'
print('PASS: six visible frames match original combo0; overwrite refusal preserves source, exports and runtime')
