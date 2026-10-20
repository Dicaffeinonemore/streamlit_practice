"""Vargul stage-one artifact contract; no gameplay or browser state changes."""
import base64
import hashlib
import io
import json
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'assets/vargul_src'
OUT = ROOT / 'assets/vargul'


def read(path):
    return json.loads(path.read_text(encoding='utf-8'))


manifest = read(SRC / 'manifest.json')
provenance = {Path(e['path']).name: e['sha256'] for e in read(ROOT / 'docs/vargul-stage0/zip-inventory.json')['entries'] if 'sha256' in e}
config = read(SRC / 'processing.json')
meta = read(OUT / 'frames.json')
summary = read(OUT / 'build-report.json')
text = (ROOT / 'vargul-art.js').read_text(encoding='utf-8')
bundle = json.loads(text[text.index('=') + 1:].strip().rstrip(';'))
assert len(manifest['entries']) == 37
assert len([e for e in manifest['entries'] if e['role'] == 'unused']) == 6
assert not meta['runtimeConnected']
assert summary['art_bytes'] == (ROOT / 'vargul-art.js').stat().st_size
assert summary['art_bytes'] <= 24_000_000, 'Actor bundle exceeds 24 MB budget'
assert bundle['units']['depth'] == manifest['units']['depth'] == 1
assert manifest['units']['x_height_speed'] == .5112
assert abs(meta['worldHeight'] - 127.8) < 1e-9
assert meta['phaseHeightRatio'] == 1
assert meta['actorResampling'] == 'lanczos' and meta['hd'] == 3
assert meta['actorColorEncoding'].endswith('lossless alpha')
assert meta['transition']['crossfade_ticks'] == 8

images = []
for uri, sheet in zip(bundle['sheets'], summary['sheets']):
    raw = base64.b64decode(uri.split(',')[1])
    assert raw == (OUT / sheet['file']).read_bytes()
    im = Image.open(io.BytesIO(raw)).convert('RGBA')
    im.load()
    assert list(im.size) == sheet['size']
    assert len(raw) == sheet['bytes']
    images.append(im)

motion_count = 0
green_pixels = 0
mask_nonzero = {}
for e in manifest['entries']:
    original = (SRC / e['source']).read_bytes()
    organized = (SRC / e['file']).read_bytes()
    assert original == organized
    assert hashlib.sha256(original).hexdigest() == e['sha256']
    assert e['sha256'] == provenance[Path(e['source']).name]
    if e['role'] != 'motion':
        continue
    id = e['id']
    metadata = read(OUT / 'motion' / (id + '.json'))
    assert metadata['frames'] == e['frames'] == len(meta['clips'][id])
    assert metadata['reference_discarded'] == e['reference_first']
    strip = Image.open(OUT / metadata['file'])
    assert strip.size == (metadata['cell'][0] * e['frames'], metadata['cell'][1])
    assert 0 <= metadata['pivot'][0] <= metadata['cell'][0]
    assert 0 <= metadata['pivot'][1] <= metadata['cell'][1]
    assert [f['drawing'] for f in metadata['frame_data']] == list(range(1, e['frames'] + 1))
    if id == 'p1_spear_combo':
        assert [f['source_index'] for f in metadata['frame_data']] == list(range(2, 10))
    if id == 'p2_cast':
        assert e['rows'] == [5, 5, 5, 4]
        assert metadata['body_scale']['reference']['drawing'] == 19
        assert [f['source_index'] for f in metadata['frame_data']] == list(range(1, 20))
    for number, f in enumerate(meta['clips'][id]):
        measured = metadata['frame_data'][number]
        assert abs(measured['body_extent'] * measured['source_scale'] /
                   measured['pose_height'] - bundle['idleHeight']) < 1e-6, (id, number, 'fixed body size')
        x, y, w, h = f['atlas']
        image = images[f['sheet']].crop((x, y, x + w, y + h))
        a = np.array(image).astype(np.int16)
        sx = round(number * metadata['cell'][0] + metadata['pivot'][0] - metadata['frame_data'][number]['pivot'][0])
        sy = round(metadata['pivot'][1] - metadata['frame_data'][number]['pivot'][1])
        working_alpha = np.array(strip.crop((sx, sy, sx+w, sy+h)).getchannel('A'))
        assert np.array_equal(a[:, :, 3], working_alpha), (id, number, 'alpha contract')
        green_pixels += int(((a[:, :, 1] > np.maximum(a[:, :, 0], a[:, :, 2]) + 28) & (a[:, :, 3] > 128)).sum())
    mask_id = 'mask_' + id
    if mask_id in meta['clips']:
        assert len(meta['clips'][mask_id]) == e['frames']
        mask_nonzero[id] = []
        for actor, mask in zip(meta['clips'][id], meta['clips'][mask_id]):
            assert actor['anchor'] == mask['anchor']
            assert actor['atlas'][2:] == mask['atlas'][2:]
            x, y, w, h = mask['atlas']
            a = np.array(images[mask['sheet']].crop((x, y, x+w, y+h)))
            mask_nonzero[id].append(int((a[:, :, 3] > 0).sum()))
        assert max(mask_nonzero[id]) > 0, (id, 'entire mask strip empty')
    motion_count += e['frames']
assert motion_count == summary['motion_frames'] == 316
# Lossy colour can leave a few isolated codec-noise pixels; real key spill is thousands.
assert green_pixels <= 50, ('green spill remaining', green_pixels)

for id, frames in meta['clips'].items():
    for f in frames:
        x, y, w, h = f['atlas']
        image = images[f['sheet']]
        assert min(x, y) >= 0 and min(w, h) > 0
        assert x + w <= image.width and y + h <= image.height, (id, f)
        assert all(np.isfinite(f['anchor']))

fx_count = 0
max_alpha_reconstruction_error = 0
for sheet, rows in config['fx'].items():
    for row in rows:
        id = row['id']
        assert len(row['x']) == row['frames'] + 1
        assert row['x'][0] == 0 and row['x'][-1] == 1672
        assert all(x1 > x0 for x0, x1 in zip(row['x'], row['x'][1:]))
        for variant in ['add', 'alpha']:
            data = read(OUT / 'fx' / (id + '_' + variant + '.json'))
            assert data['frames'] == row['frames']
            image = Image.open(OUT / data['file']).convert('RGBA')
            assert image.size == (data['cell'][0] * row['frames'], data['cell'][1])
        adds = meta['clips']['fx_' + id + '_add']
        alphas = meta['clips']['fx_' + id + '_alpha']
        assert len(adds) == len(alphas) == row['frames']
        for add, alpha in zip(adds, alphas):
            assert alpha['alphaFromMaxRGB']
            assert add['sheet'] == alpha['sheet'] and add['atlas'] == alpha['atlas']
            x, y, w, h = add['atlas']
            rgb = np.array(images[add['sheet']].crop((x, y, x+w, y+h)))[:, :, :3].astype(float)
            a = rgb.max(axis=2)
            unpremult = np.round(rgb * 255 / np.maximum(a[:, :, None], 1))
            premult = np.round(unpremult * a[:, :, None] / 255)
            err = int(np.abs(premult - rgb).max())
            max_alpha_reconstruction_error = max(max_alpha_reconstruction_error, err)
        if id == 'cross_warning':
            assert row['floor_scale_y'] == .35
        fx_count += row['frames']
assert fx_count == summary['effect_frames_per_variant'] == 219
assert max_alpha_reconstruction_error <= 1
assert meta['drawingRoles']['p1_spear_combo']['thirdHit'] == [7, 8]
assert meta['drawingRoles']['p2_cast']['concentration'] == [9, 12]
qa = config['motions']['p1_sword_summon']['qa']
assert len(qa['severely_damaged_frames']) < 5
assert not qa['fills'] and not qa['replacements']

result = {'motion_frames': motion_count, 'motion_clips': 24, 'fx_rows': 15,
          'fx_frames_each_variant': fx_count, 'green_spill_pixels': green_pixels,
          'alpha_reconstruction_max_error': max_alpha_reconstruction_error,
          'art_bytes': summary['art_bytes'], 'aurelion_bytes': summary['aurelion_art_bytes'],
          'mask_nonzero_pixels': mask_nonzero, 'source_hashes': '37/37 identical',
          'runtime_connected': False, 'result': 'PASS'}
(ROOT / 'artifacts/vargul-1.36/art/validation.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
print(json.dumps({k: v for k, v in result.items() if k != 'mask_nonzero_pixels'}, indent=2))
