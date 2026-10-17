"""Validate and import trusted data only; never execute bundled ZIP scripts."""
import argparse
import base64
import hashlib
import io
import json
from pathlib import Path
import zipfile
from PIL import Image
from boss_art_common import pack_pages

ROOT = Path(__file__).resolve().parents[1]
SCALE = .55


def validate(moves, catalog, effects, projectiles, images):
    for entry in catalog + effects:
        name = entry['id']
        image = images[name]
        assert image.size == (entry['cell'][0] * entry['frames'], entry['cell'][1]), (name, 'sheet dimensions')
        if name not in moves:
            continue
        move = moves[name]
        assert len(move['drawings']) == entry['frames'], (name, 'drawing count')
        total = 0
        for i, drawing in enumerate(move['drawings'], 1):
            assert drawing['index'] == i and drawing['start'] == total and drawing['duration'] > 0, (name, 'start')
            total += drawing['duration']
        assert total == move['total_frames'], (name, 'total')
        for sequence in list(move.get('sequences', {}).values()) + [move.get('run_loop', {}).get('drawings', [])]:
            assert all(isinstance(i, int) and 1 <= i <= entry['frames'] for i in sequence), (name, 'sequence')
        for event in move.get('events', []):
            assert 0 <= event['frame'] < total, (name, 'event frame')
            if event['type'] == 'spawn':
                assert event['id'] in projectiles, (name, 'spawn', event['id'])
    fx_ids = {e['id'] for e in effects}
    for key, value in projectiles.items():
        if not isinstance(value, dict):
            continue
        assert value.get('use', key) in fx_ids, (key, 'FX alias')


def build(sprites_path, data_path, out_root=ROOT):
    sources = {}
    with zipfile.ZipFile(sprites_path) as sprites, zipfile.ZipFile(data_path) as data:
        for archive, prefix, target in ((sprites, 'aurelion/sprites_240/', 'sprites_240/'),
                                         (data, 'aurelion_framedata/', 'framedata/')):
            for name in sorted(archive.namelist()):
                if not name.startswith(prefix) or '/tools/' in name or not name.endswith(('.json', '.png', '.md')):
                    continue
                relative = name[len(prefix):]
                if '..' in Path(relative).parts:
                    raise ValueError('Unsafe archive path')
                sources[target + relative] = archive.read(name)
    read = lambda name: json.loads(sources[name].decode('utf-8-sig'))
    catalog = read('sprites_240/aurelion.json')['motions']
    effects = read('sprites_240/fx/fx.json')['effects']
    moves = {e['id']: read('framedata/moves/' + e['id'] + '.json') for e in catalog}
    boss = read('framedata/aurelion_boss.json')
    projectiles = read('framedata/projectiles.json')
    images = {e['id']: Image.open(io.BytesIO(sources['sprites_240/' + (e['file'] if 'file' in e else e['files']['add'])])).convert('RGBA')
              for e in catalog + effects}
    validate(moves, catalog, effects, projectiles, images)
    clips, sheets = {}, []
    # Additive FX never share a sheet with transparent actors.
    for entries in (catalog, effects):
        tiles = []
        offset = len(sheets)
        for e in entries:
            key = e['id'] if entries is catalog else 'fx_' + e['id']
            clips[key] = []
            w, h = e['cell']
            for i in range(e['frames']):
                tile = images[e['id']].crop((i*w, 0, (i+1)*w, h))
                tile = tile.resize((round(w*SCALE), round(h*SCALE)), Image.Resampling.NEAREST)
                f = {'atlas': [0, 0, *tile.size], 'anchor': [round(v*SCALE) for v in e['pivot']]}
                clips[key].append(f)
                tiles.append((f, tile))
        pages = pack_pages(tiles)
        for f, _ in tiles:
            f['sheet'] += offset
        sheets.extend(pages)
    encoded, report = [], []
    for i, sheet in enumerate(sheets):
        stream = io.BytesIO()
        sheet.save(stream, 'WEBP', quality=88, method=6, exact=True)
        raw = stream.getvalue()
        # WebP alpha is lossless; verify it instead of assuming an intact edge.
        decoded = Image.open(io.BytesIO(raw)).convert('RGBA')
        if decoded.getchannel('A').tobytes() != sheet.getchannel('A').tobytes():
            stream = io.BytesIO(); sheet.save(stream, 'PNG'); raw = stream.getvalue(); fmt = 'png'
        else:
            fmt = 'webp'
        encoded.append((f'sheet-{i}.{fmt}', raw))
        report.append({'file': encoded[-1][0], 'size': list(sheet.size), 'bytes': len(raw)})
    meta = {'clips': clips, 'timing': moves, 'boss': boss, 'projectiles': projectiles,
            'effects': {e['id']: e for e in effects}, 'scale': SCALE, 'idleHeight': 240*SCALE,
            'sources': {name: hashlib.sha256(raw).hexdigest() for name, raw in sorted(sources.items())}}
    bundle = dict(meta, sheets=['data:image/' + name.split('.')[-1] + ';base64,' + base64.b64encode(raw).decode('ascii') for name, raw in encoded])
    js = ('const AURELION_ART = ' + json.dumps(bundle, ensure_ascii=False, separators=(',', ':')) + ';\n').encode('utf8')
    assert len(js) <= 4_000_000, ('aurelion-art.js exceeds 4 MB', len(js))
    # All validation and encoding must succeed before producing any output.
    out = Path(out_root) / 'assets/aurelion'
    out.mkdir(parents=True, exist_ok=True)
    for name, raw in sources.items():
        path = out / 'original' / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(raw)
    for name, raw in encoded:
        (out / name).write_bytes(raw)
    (out / 'frames.json').write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding='utf8')
    report = {'art_bytes': len(js), 'quality': 88, 'scale': SCALE, 'sheets': report,
              'motions': len(catalog), 'fx': len(effects), 'frames': sum(map(len, clips.values()))}
    (out / 'build-report.json').write_text(json.dumps(report, indent=2), encoding='utf8')
    (Path(out_root) / 'aurelion-art.js').write_bytes(js)
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('sprites', type=Path)
    parser.add_argument('framedata', type=Path)
    parser.add_argument('--out-root', type=Path, default=ROOT)
    args = parser.parse_args()
    print(json.dumps(build(args.sprites, args.framedata, args.out_root), indent=2))
