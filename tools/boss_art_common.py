"""Deterministic atlas packing shared by boss importers."""
from PIL import Image


def pack_tiles(tiles, width=2048, height=4096, gap=2):
    atlas = Image.new('RGBA', (width, height))
    x = y = row_height = 0
    for frame, tile in tiles:
        if x + tile.width + gap > width:
            x = 0
            y += row_height + gap
            row_height = 0
        if tile.width > width or y + tile.height + gap > height:
            raise ValueError('Atlas capacity exceeded')
        frame['atlas'][:2] = [x, y]
        atlas.paste(tile, (x, y))
        x += tile.width + gap
        row_height = max(row_height, tile.height)
    return atlas.crop((0, 0, width, y + row_height + gap))


def pack_pages(tiles, limit=4096):
    pages, batch = [], []
    x = y = row_height = 0
    for frame, tile in tiles:
        if tile.width + 2 > limit or tile.height + 2 > limit:
            raise ValueError('Frame exceeds sheet limit')
        if x + tile.width + 2 > limit:
            x = 0
            y += row_height + 2
            row_height = 0
        if y + tile.height + 2 > limit:
            pages.append(pack_tiles(batch, limit, limit))
            batch = []
            x = y = row_height = 0
        frame['sheet'] = len(pages)
        batch.append((frame, tile))
        x += tile.width + 2
        row_height = max(row_height, tile.height)
    if batch:
        pages.append(pack_tiles(batch, limit, limit))
    return pages
