"""Offline, repeatable build validation using the preserved original bytes."""
import copy
import json
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools'))
from build_aurelion_art import BUDGET, build, validate
from boss_art_common import pack_tiles


class BuildTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.original = ROOT / 'assets/aurelion/original'
        read = lambda p: json.loads((cls.original / p).read_text(encoding='utf8'))
        cls.catalog = read('sprites_240/aurelion.json')['motions']
        cls.effects = read('sprites_240/fx/fx.json')['effects']
        cls.moves = {e['id']: read('framedata/moves/' + e['id'] + '.json') for e in cls.catalog}
        cls.projectiles = read('framedata/projectiles.json')
        cls.images = {e['id']: Image.open(cls.original / 'sprites_240' / (e.get('file') or e['files']['add'])) for e in cls.catalog + cls.effects}

    def test_invalid_inputs_stop(self):
        validate(self.moves, self.catalog, self.effects, self.projectiles, self.images)
        mutations = [lambda m: m['combo']['drawings'].pop(),
                     lambda m: m['combo']['drawings'][1].update(start=999),
                     lambda m: m['combo']['sequences'].update(full=[999]),
                     lambda m: m['cleave']['events'].append({'frame': 1, 'type': 'spawn', 'id': 'missing'})]
        for change in mutations:
            moves = copy.deepcopy(self.moves); change(moves)
            with self.assertRaises(AssertionError):
                validate(moves, self.catalog, self.effects, self.projectiles, self.images)
        images = dict(self.images, idle=Image.new('RGBA', (1, 1)))
        with self.assertRaises(AssertionError):
            validate(self.moves, self.catalog, self.effects, self.projectiles, images)

    def test_deterministic_size_originals_and_decode(self):
        with tempfile.TemporaryDirectory() as temp:
            temp = Path(temp)
            for source, prefix, name in [('sprites_240', 'aurelion/sprites_240', 'sprites'), ('framedata', 'aurelion_framedata', 'data')]:
                with zipfile.ZipFile(temp / (name + '.zip'), 'w') as archive:
                    for p in sorted((self.original / source).rglob('*')):
                        if p.is_file(): archive.write(p, prefix + '/' + p.relative_to(self.original / source).as_posix())
            for name in ['a', 'b']:
                report = build(temp / 'sprites.zip', temp / 'data.zip', temp / name)
                self.assertLessEqual(report['art_bytes'], BUDGET)
                self.assertEqual(report['frames'], 148)
            self.assertEqual((temp / 'a/aurelion-art.js').read_bytes(), (temp / 'b/aurelion-art.js').read_bytes())
            self.assertEqual((temp / 'a/aurelion-art.js').read_bytes(), (ROOT / 'aurelion-art.js').read_bytes())
            for p in self.original.rglob('*'):
                if p.is_file(): self.assertEqual(p.read_bytes(), (temp / 'a/assets/aurelion/original' / p.relative_to(self.original)).read_bytes())
            for sheet in report['sheets']:
                with Image.open(temp / 'a/assets/aurelion' / sheet['file']) as im:
                    im.load(); self.assertLessEqual(max(im.size), 4096)

    def test_shared_packer_preserves_legacy_layout(self):
        tiles = [({'atlas': [0, 0, w, h]}, Image.new('RGBA', (w, h), (i, 42, 99, 255))) for i, (w, h) in enumerate([(120, 30), (80, 90), (200, 50)] * 8)]
        old = Image.new('RGBA', (2048, 4096)); x = y = row = 0; positions = []
        for _, tile in tiles:
            if x + tile.width + 2 > 2048: x = 0; y += row + 2; row = 0
            positions.append([x, y]); old.paste(tile, (x, y)); x += tile.width + 2; row = max(row, tile.height)
        old = old.crop((0, 0, 2048, y + row + 2))
        new = pack_tiles(tiles)
        self.assertEqual(new.tobytes(), old.tobytes())
        self.assertEqual([f['atlas'][:2] for f, _ in tiles], positions)

    def test_single_html(self):
        sys.path.insert(0, str(ROOT))
        from server import build_single_html, SCRIPTS
        html = build_single_html()
        self.assertNotIn('<script src=', html)
        self.assertIn('const AURELION_ART = ', html)
        self.assertLess(SCRIPTS.index('aurelion-art.js'), SCRIPTS.index('aurelion-runtime.js'))
        self.assertLess(SCRIPTS.index('aurelion-runtime.js'), SCRIPTS.index('game.js'))


if __name__ == '__main__':
    unittest.main()
