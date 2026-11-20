"""Viesa per-sheet consistency: size factors and tone matching to the idle sheet.

The supplied sheets were drawn at different sizes and brightness. Sizes are
corrected by a hand-checked factor per sheet (head and torso against idle, legs
kept plausible). Tones are corrected by matching each sheet's luminance
distribution to the idle sheet's, scaling RGB together so hue is kept.
"""
import base64
import io
from pathlib import Path

import numpy as np
from PIL import Image

# Remake sheet number -> size factor against the shared idle-based scale.
# 02 melee · 12 charge shot · 14 basic shot: head/torso ~78% of idle.
# 07 rapid fire: head ~20% larger than idle.
REMAKE_SCALE = {2: 1.1, 12: 1.1, 14: 1.1, 7: 0.9}
# First-generation sheet number -> size factor. The ultimate (4) and the
# lightning scroll end standing and hand over to idle, so they keep matching
# idle's height (their heads are ~20% larger; shrinking them makes the
# hand-over pop by ~10% instead). Only their tone is corrected.
FIRST_GEN_SCALE = {}
SCROLL_SCALE = 1.0
REFERENCE_SHEET = 'remake-03'
_WEIGHTS = np.array([.299, .587, .114])
_SOLID = 160
# Near-white, low-saturation pixels (melee slash arcs) keep their brightness.
_PROTECT_FROM = 205.0


def _luma(rgb):
    return rgb @ _WEIGHTS


def _glow(rgb):
    """Blue lightning/magic glow drawn into a sheet; never part of the body."""
    return (rgb[..., 2] > rgb[..., 0] * 1.2) & (rgb[..., 2] > 110)


def quantiles(tiles):
    """Luminance quantiles (0..100%) of the solid pixels of the given tiles."""
    values = []
    for tile in tiles:
        a = np.asarray(tile.convert('RGBA'), dtype=float)
        solid = (a[:, :, 3] > _SOLID) & ~_glow(a[:, :, :3])
        values.append(_luma(a[:, :, :3][solid]))
    return np.percentile(np.concatenate(values), np.linspace(0, 100, 101))


def match(tile, source_q, reference_q):
    """Map the tile's luminance from source_q to reference_q, keeping hue."""
    a = np.asarray(tile.convert('RGBA'), dtype=float)
    rgb = a[:, :, :3]
    luma = _luma(rgb)
    # Quantiles may repeat at the ends; interp needs increasing x.
    src = np.maximum.accumulate(source_q + np.arange(len(source_q)) * 1e-6)
    target = np.interp(luma, src, reference_q)
    spread = rgb.max(2) - rgb.min(2)
    keep = np.clip((luma - _PROTECT_FROM) / 30, 0, 1) * (spread < 45)
    keep = np.maximum(keep, _glow(rgb))
    target = target * (1 - keep) + luma * keep
    ratio = target / np.maximum(luma, 1)
    a[:, :, :3] = np.clip(rgb * ratio[:, :, None], 0, 255)
    return Image.fromarray(a.round().astype('uint8'))


def match_groups(groups, reference_tiles):
    """groups: {name: [tile]} -> {name: [matched tile]}; also returns stats."""
    reference_q = quantiles(reference_tiles)
    out, stats = {}, {}
    for name, tiles in groups.items():
        source_q = quantiles(tiles)
        out[name] = [match(t, source_q, reference_q) for t in tiles]
        stats[name] = {'medianBefore': round(float(source_q[50]), 1),
                       'medianAfter': round(float(quantiles(out[name])[50]), 1),
                       'reference': round(float(reference_q[50]), 1)}
    return out, stats


def open_sheet(src, root):
    """Atlas page from viesa-art.js: a data URI before externalizing, else a path."""
    if src.startswith('data:'):
        return Image.open(io.BytesIO(base64.b64decode(src.split(',', 1)[1]))).convert('RGBA')
    return Image.open(Path(root) / src).convert('RGBA')


def idle_tiles(art, root):
    pages = {}
    tiles = []
    for f in art['clips']['idle']:
        page = pages.setdefault(f['sheet'], open_sheet(art['sheets'][f['sheet']], root))
        x, y, w, h = f['atlas']
        tiles.append(page.crop((x, y, x + w, y + h)))
    return tiles
