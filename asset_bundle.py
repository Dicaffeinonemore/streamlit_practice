"""Build cacheable media for Streamlit without putting image bytes in srcdoc.

Original art stays untouched. Content-addressed PNGs work with Streamlit's
static-file MIME allowlist, including versions that don't allow WebP or JS.
"""
import base64
import hashlib
import io
import json
import re
import threading
from collections import deque
from functools import lru_cache
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent
MEDIA = ROOT / "static/game-assets"
DATA_IMAGE = re.compile(r"data:image/(?:png|webp|jpeg);base64,[A-Za-z0-9+/=]+")
BUILD_LOCK = threading.Lock()
VERSION = "mobile-v1"


def split_named(code, asset_base, groups):
    """Partition the 82 MB decoded atlas into shared player + stage sheets."""
    art_start = re.search(r"const NAMED_ART\s*=\s*", code).end()
    art, _ = json.JSONDecoder().raw_decode(code[art_start:])
    # The animated title alone embeds tens of MB. Use its supplied still image.
    if art.get("titleStill") and art.get("title", "").startswith("data:image/gif"):
        code = code.replace(art["title"], art["titleStill"], 1)
    start = re.search(r"const NAMED_SPRITES\s*=\s*", code).end()
    metadata, length = json.JSONDecoder().raw_decode(code[start:])
    atlas_match = DATA_IMAGE.search(code)
    atlas_uri = atlas_match.group()
    partitions = {}
    owners = {}
    for actor, clips in metadata["clips"].items():
        if actor == "player":
            group = "common"
        elif actor.startswith("stage"):
            group = f"stage{int(actor[5]) - 1}"
        else:
            group = f"stage{int(actor[4]) - 1}"
        for ids in clips.values():
            for frame_id in ids:
                owners.setdefault(frame_id, set()).add(group)
    for frame_id, owners_for_frame in owners.items():
        group = next(iter(owners_for_frame)) if len(owners_for_frame) == 1 else "common"
        partitions.setdefault(group, []).append(frame_id)
    source = None
    urls = {}
    for group, ids in partitions.items():
        digest = hashlib.sha256((VERSION + group + atlas_uri).encode()).hexdigest()[:24]
        path = MEDIA / f"{digest}.png"
        x = y = row_height = 0
        tiles = []
        for frame_id in sorted(ids):
            frame = metadata["frames"][frame_id]
            sx, sy, w, h = frame["atlas"]
            if x + w > 2048:
                x = 0
                y += row_height + 2
                row_height = 0
            tiles.append(((sx, sy, sx + w, sy + h), (x, y)))
            frame["atlas"] = [x, y, w, h]
            frame["sheet"] = group
            x += w + 2
            row_height = max(row_height, h)
        if not path.exists():
            if source is None:
                source = Image.open(io.BytesIO(base64.b64decode(atlas_uri.split(",", 1)[1]))).convert("RGBA")
            page = Image.new("RGBA", (2048, y + row_height))
            for box, position in tiles:
                page.paste(source.crop(box), position)
            temporary = path.with_suffix(".tmp")
            page.save(temporary, format="PNG")
            temporary.replace(path)
        urls[group] = asset_base + path.name
        groups[urls[group]] = group
    code = code[:start] + json.dumps(metadata, separators=(",", ":")) + code[start + length:]
    code = code.replace(atlas_uri, urls["common"], 1)
    code += "\nglobalThis.NAMED_PAGES=Object.fromEntries(Object.entries(" + json.dumps(urls) + """).map(([group,src])=>{
      const image=src===NAMED_ART.atlas?NAMED_ATLAS:GAME_ASSETS.image(group);
      if(image!==NAMED_ATLAS)image.src=src;
      return [group,image];
    }));"""
    return code


def prepare_item(image):
    """Bake the runtime's border-connected white key and directional light."""
    a = np.array(image.convert("RGBA"))
    rgb = a[:, :, :3].astype(np.int16)
    allowed = (a[:, :, 3] == 0) | ((rgb.min(2) >= 175) & (rgb.max(2) - rgb.min(2) <= 22))
    h, w = allowed.shape
    seen = np.zeros((h, w), dtype=bool)
    queue = deque()

    def visit(y, x):
        if not seen[y, x] and allowed[y, x]:
            seen[y, x] = True
            queue.append((y, x))

    for x in range(w):
        visit(0, x)
        visit(h - 1, x)
    for y in range(h):
        visit(y, 0)
        visit(y, w - 1)
    while queue:
        y, x = queue.popleft()
        if x:
            visit(y, x - 1)
        if x + 1 < w:
            visit(y, x + 1)
        if y:
            visit(y - 1, x)
        if y + 1 < h:
            visit(y + 1, x)
    a[seen, 3] = 0
    bbox = Image.fromarray(a).getbbox()
    if not bbox:
        return Image.new("RGBA", (1, 1))
    left, top, right, bottom = bbox
    # Match Canvas source-atop gradient; retain enclosed pale highlights.
    yy, xx = np.mgrid[top:bottom, left:right]
    dx, dy = right - left - 1, bottom - top - 1
    t = np.clip(((xx + .5 - left) * dx + (yy + .5 - top) * dy) / max(1, dx * dx + dy * dy), 0, 1)
    alpha = np.where(t <= .45, .22 * (1 - t / .45), .38 * (t - .45) / .55)
    color = np.where((t <= .45)[:, :, None], [255, 237, 195], [12, 8, 28])
    crop = a[top:bottom, left:right].copy()
    crop[:, :, :3] = np.rint(crop[:, :, :3] * (1 - alpha[:, :, None]) + color * alpha[:, :, None]).astype(np.uint8)
    crop[crop[:, :, 3] == 0] = 0
    result = Image.fromarray(crop)
    # Items are rendered at small HUD/world sizes, not their 1254px source size.
    result.thumbnail((256, 256), Image.Resampling.NEAREST)
    return result


def group_for(name, index, prefix):
    bosses = {"gorath-art.js": "stage0", "morgra-art.js": "stage1",
              "aurelion-art.js": "stage2", "vargul-art.js": "stage3"}
    if name in bosses:
        return bosses[name]
    if name == "floor-art.js":
        return "first-scene" if index == 0 else f"stage{index}"
    if name == "release-art.js":
        keys = re.findall(r'["\']([^"\']+)["\']\s*:\s*["\']$', prefix)
        key = keys[-1] if keys else ""
        if key.startswith("opening"):
            return "opening"
        if key == "field1":
            return "first-scene"
        if key and key[-1] in "12345":
            return f"stage{int(key[-1]) - 1}"
    return "common"


def build_html(scripts, asset_base):
    paths = [ROOT / p for p in (*scripts, "index.html", "asset-loader.js")]
    if (ROOT / "assets/bgm/boss.mp3").exists():
        paths.append(ROOT / "assets/bgm/boss.mp3")
    signature = tuple((str(p), p.stat().st_mtime_ns, p.stat().st_size) for p in paths)
    with BUILD_LOCK:
        return _build_cached(tuple(scripts), asset_base, signature)


@lru_cache(maxsize=2)
def _build_cached(scripts, asset_base, signature):
    MEDIA.mkdir(parents=True, exist_ok=True)
    groups, codes = {}, {}
    for name in scripts:
        code = (ROOT / name).read_text(encoding="utf-8")
        if name == "named-art.js":
            code = split_named(code, asset_base, groups)
        ordinal = 0

        def externalize(match):
            nonlocal ordinal
            uri = match.group()
            digest = hashlib.sha256((VERSION + name + uri).encode()).hexdigest()[:24]
            path = MEDIA / f"{digest}.png"
            if not path.exists():
                raw = base64.b64decode(uri.split(",", 1)[1])
                image = Image.open(io.BytesIO(raw)).convert("RGBA")
                if name == "item-art.js":
                    image = prepare_item(image)
                temporary = path.with_suffix(".tmp")
                image.save(temporary, format="PNG")
                temporary.replace(path)
            url = asset_base + path.name
            groups[url] = group_for(name, ordinal, code[max(0, match.start() - 100):match.start()])
            ordinal += 1
            return url

        code = DATA_IMAGE.sub(externalize, code)
        if name.endswith("-art.js") or name in (
            "barel-runtime.js", "gorath-runtime.js", "morgra-runtime.js",
            "aurelion-runtime.js", "vargul-runtime.js", "item-runtime.js"
        ):
            code = code.replace("new Image()", "GAME_ASSETS.image()")
        codes[name] = code
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    # Audio follows the existing engine; image bytes are all external.
    bgm = ROOT / "assets/bgm/boss.mp3"
    audio = ""
    if bgm.exists():
        # Streamlit does not allow audio MIME through static serving. Keeping
        # this one audio data URI avoids relying on content sniffing in Safari.
        audio = "window.BOSS_BGM_URL=" + json.dumps("data:audio/mpeg;base64," + base64.b64encode(bgm.read_bytes()).decode()) + ";"
    bootstrap = ("globalThis.GAME_ASSET_GROUPS=" + json.dumps(groups) + ";"
                 "globalThis.ITEM_ART_PREPARED=true;" + audio +
                 (ROOT / "asset-loader.js").read_text(encoding="utf-8"))
    html = html.replace('<script src="motion.js">', "<script>" + bootstrap + '</script><script src="motion.js">', 1)
    for name, code in codes.items():
        html = html.replace(f'<script src="{name}"></script>', f"<script>\n{code}\n</script>")
    html = html.replace("</body>", "<script>GAME_ASSETS.enterStage(null);</script></body>")
    return html
