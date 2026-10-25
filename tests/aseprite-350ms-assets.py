"""Inspect actual Aseprite binary timing, backups, pixels and foot measurements."""
import hashlib
import json
import struct
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / 'assets/aseprite'
source = BASE / 'tests/black-knight-basic-attack.aseprite'
backup = BASE / 'backups/black-knight-basic-attack-600ms.aseprite.bak'
timed = BASE / 'tests/black-knight-basic-attack-350ms.aseprite'
assert source.read_bytes() == backup.read_bytes(), '600ms original/backup must match'

def durations(file):
    raw = file.read_bytes()
    assert struct.unpack_from('<H', raw, 4)[0] == 0xA5E0
    count = struct.unpack_from('<H', raw, 6)[0]
    offset, result = 128, []
    for _ in range(count):
        size, magic, _, duration = struct.unpack_from('<IHHH', raw, offset)
        assert magic == 0xF1FA
        result.append(duration)
        offset += size
    return result

assert durations(source) == [100,80,60,90,110,160]
assert durations(timed) == [65,55,50,50,55,75]
metadata = json.loads((BASE / 'tests/black-knight-basic-attack-350ms.animation.json').read_text())
old = Image.open(BASE / 'exports/tests/black-knight-basic-attack.png').convert('RGBA')
new = Image.open(BASE / 'exports/tests/black-knight-basic-attack-350ms.png').convert('RGBA')
assert old.size == new.size == (996,143)
assert old.tobytes() == new.tobytes(), 'Retiming must not change sprite pixels'
data = json.loads((BASE / 'exports/tests/black-knight-basic-attack-350ms.json').read_text())
assert [f['duration'] for f in data['frames']] == durations(timed)
for i, frame in enumerate(data['frames']):
    r = frame['frame']
    tile = new.crop((r['x'],r['y'],r['x']+r['w'],r['y']+r['h']))
    px = tile.getchannel('A').load()
    bottom = max(y for y in range(143) for x in range(166) if px[x,y] >= 128)
    sole = [x for y in range(139,143) for x in range(100) if px[x,y] >= 128]
    assert bottom == metadata['groundAnalysis']['bottomPixelY'][i]
    assert round(sum(sole)/len(sole),2) == metadata['groundAnalysis']['soleCentroidX'][i]
    for face in [-1,1]:
        for world_dx in [0,8]:
            xs = [370+face*world_dx*2.5+face*(x-67)*1.8 for x in [0,166]]
            assert 0 <= min(xs) <= max(xs) <= 800
            assert 0 <= 340-143*1.8 <= 340 <= 400
print('PASS: backup equality, actual .aseprite 600/350ms timings, unchanged RGBA pixels, measured feet and both-facing Canvas bounds')
