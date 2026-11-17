"""index.html 을 서버 없이 더블클릭으로 실행되는 HTML 파일 하나로 묶는다.

    python tools/build_standalone.py [출력경로]

기본 출력: dist/black-moon-knight-standalone.html (git 에서 제외)

방식
  * <script src> 80여 개를 인라인한다.
  * 게임이 실제로 읽는 에셋(data/runtime-assets.json + 코드 속 assets/runtime 경로
    + Aseprite 메타데이터 → exports JSON → PNG 연쇄 + 보스 BGM)을 내용 기준으로
    중복 제거해 base64 블록으로 한 번씩만 넣는다.
  * 맨 앞의 작은 shim 이 img/audio 의 src, fetch(), CSS url() 요청을 가로채
    해당 블록의 data: URL 로 바꿔 준다. 게임 코드는 수정하지 않는다.
"""
from __future__ import annotations

import base64
import hashlib
import json
import mimetypes
import posixpath
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_OUT = ROOT / "dist" / "black-moon-knight-standalone.html"

MIME = {
    ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif",
    ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".mp3": "audio/mpeg",
    ".ogg": "audio/ogg", ".wav": "audio/wav", ".json": "application/json",
}
SCRIPT_TAG = re.compile(r'<script\s+src=(["\'])([^"\']+)\1\s*>\s*</script>')
ASSET_LITERAL = re.compile(r"""["'`]((?:\./)?assets/[^"'`\s]+?\.(?:png|webp|gif|jpe?g|mp3|ogg|wav|json))["'`]""")


def norm(path: str) -> str:
    return posixpath.normpath(path.replace("\\", "/"))


def collect_assets(html: str, scripts: list[str]) -> set[str]:
    wanted: set[str] = set()
    manifest = ROOT / "data/runtime-assets.json"
    if manifest.is_file():
        wanted.update(json.loads(manifest.read_text(encoding="utf-8")))
    wanted.add("assets/bgm/boss.mp3")
    for text in [html, *scripts]:
        for match in ASSET_LITERAL.finditer(text):
            path = norm(match.group(1))
            # assets/named, assets/floors 등은 *-art.js 안의 출처 메타데이터일 뿐 로드되지 않는다.
            if path.startswith("assets/runtime/") or path.startswith("assets/aseprite/") or path.startswith("assets/bgm/"):
                wanted.add(path)
    # Aseprite: NAME.animation.json -> "sprite" (exports JSON) -> meta.image (PNG)
    queue = [p for p in wanted if p.endswith(".json")]
    while queue:
        path = queue.pop()
        file = ROOT / path
        if not file.is_file():
            continue
        try:
            doc = json.loads(file.read_text(encoding="utf-8"))
        except ValueError:
            continue
        refs = []
        if isinstance(doc, dict):
            if isinstance(doc.get("sprite"), str):
                refs.append(doc["sprite"])
            if isinstance(doc.get("image"), str):
                refs.append(doc["image"])
            meta = doc.get("meta")
            if isinstance(meta, dict) and isinstance(meta.get("image"), str):
                refs.append(meta["image"])
        for ref in refs:
            target = norm(posixpath.join(posixpath.dirname(path), ref))
            if target not in wanted:
                wanted.add(target)
                if target.endswith(".json"):
                    queue.append(target)
    return {p for p in wanted if (ROOT / p).is_file()}


SHIM = r"""<script>
/* standalone bundle shim: logical asset path -> embedded data: URL */
(function () {
  'use strict';
  var INDEX = __INDEX__;
  var MIMES = __MIMES__;
  var cache = Object.create(null);
  var basePath = new URL('.', location.href).pathname;
  function logical(u) {
    if (u == null) return null;
    u = typeof u === 'string' ? u : (u.url || String(u));
    if (/^(data|blob):/i.test(u)) return null;
    try {
      var abs = new URL(u, location.href);
      if (abs.protocol !== location.protocol || abs.host !== location.host) return null;
      if (abs.pathname.indexOf(basePath) !== 0) return null;
      return decodeURIComponent(abs.pathname.slice(basePath.length));
    } catch (e) { return null; }
  }
  function resolve(u) {
    var p = logical(u); if (p == null) return null;
    var id = INDEX[p]; if (id === undefined) return null;
    if (cache[id]) return cache[id];
    var el = document.getElementById('bmk-asset-' + id);
    if (!el) return null;
    var url = 'data:' + MIMES[id] + ';base64,' + el.textContent.replace(/\s+/g, '');
    el.textContent = '';
    return (cache[id] = url);
  }
  window.__BMK_RESOLVE_ASSET = resolve;

  function hookSrc(proto) {
    var d = Object.getOwnPropertyDescriptor(proto, 'src');
    if (!d || !d.set) return;
    var last = new WeakMap();
    Object.defineProperty(proto, 'src', {
      configurable: true, enumerable: d.enumerable,
      get: d.get,
      set: function (v) {
        var r = resolve(v);
        if (r) { if (last.get(this) === r) return; last.set(this, r); return d.set.call(this, r); }
        last.delete(this);
        return d.set.call(this, v);
      }
    });
  }
  hookSrc(HTMLImageElement.prototype);
  hookSrc(HTMLMediaElement.prototype);
  if (window.HTMLSourceElement) hookSrc(HTMLSourceElement.prototype);

  var setAttr = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function (name, value) {
    if (typeof name === 'string' && /^(src|href)$/i.test(name)) { var r = resolve(value); if (r) value = r; }
    return setAttr.call(this, name, value);
  };

  var realFetch = window.fetch && window.fetch.bind(window);
  if (realFetch) window.fetch = function (input, init) {
    var r = resolve(input);
    return r ? realFetch(r, init) : realFetch(input, init);
  };

  function cssUrls(v) {
    return typeof v !== 'string' || v.indexOf('url(') < 0 ? v :
      v.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, function (m, q, u) { var r = resolve(u); return r ? 'url("' + r + '")' : m; });
  }
  var CSD = CSSStyleDeclaration.prototype;
  var setProp = CSD.setProperty;
  CSD.setProperty = function (name, value, prio) { return setProp.call(this, name, cssUrls(value), prio); };
  ['backgroundImage', 'background', 'borderImage', 'borderImageSource', 'listStyleImage', 'content', 'cursor', 'maskImage', 'cssText'].forEach(function (k) {
    var d = Object.getOwnPropertyDescriptor(CSD, k);
    if (!d || !d.set) return;
    Object.defineProperty(CSD, k, { configurable: true, enumerable: d.enumerable, get: d.get,
      set: function (v) { return d.set.call(this, cssUrls(v)); } });
  });
})();
</script>
"""


def build(out: Path) -> None:
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    # 형제 파일이 필요한 개발용 링크는 단일 파일에서 깨지므로 제거한다.
    html = re.sub(r'<a id="mobileLabLink"[^>]*>.*?</a>', '', html, flags=re.S)
    html = re.sub(r'<a id="referenceLabLink"[^>]*>.*?</a>', '', html, flags=re.S)

    names = [m.group(2) for m in SCRIPT_TAG.finditer(html)]
    codes = {}
    for name in names:
        file = ROOT / name
        if not file.is_file():
            raise SystemExit(f"index.html 이 연결한 스크립트가 없습니다: {name}")
        codes[name] = file.read_text(encoding="utf-8")

    assets = sorted(collect_assets(html, list(codes.values())))
    by_hash: dict[str, int] = {}
    blobs: list[tuple[str, Path]] = []
    index: dict[str, int] = {}
    for path in assets:
        file = ROOT / path
        digest = hashlib.sha256(file.read_bytes()).hexdigest()
        if digest not in by_hash:
            by_hash[digest] = len(blobs)
            mime = MIME.get(file.suffix.lower()) or mimetypes.guess_type(file.name)[0] or "application/octet-stream"
            blobs.append((mime, file))
        index[path] = by_hash[digest]

    def inline(match: re.Match) -> str:
        code = codes[match.group(2)]
        code = re.sub(r"</(script)", r"<\\/\1", code, flags=re.I)
        return f"<script>/* {match.group(2)} */\n{code}\n</script>"

    html = SCRIPT_TAG.sub(inline, html)

    shim = (SHIM.replace("__INDEX__", json.dumps(index, ensure_ascii=False))
                .replace("__MIMES__", json.dumps([m for m, _ in blobs])))
    head_open = re.search(r"<head[^>]*>", html, flags=re.I)
    if not head_open:
        raise SystemExit("index.html 에 <head> 가 없습니다")
    first_script = html.find("<script>/* ")
    if first_script < 0:
        raise SystemExit("인라인할 스크립트를 찾지 못했습니다")

    out.parent.mkdir(parents=True, exist_ok=True)
    total_raw = 0
    with out.open("w", encoding="utf-8", newline="\n") as f:
        # shim 은 <head> 직후, 에셋 블록은 첫 게임 스크립트 직전에 둬서
        # 최상위에서 바로 img.src 를 지정하는 스크립트도 블록을 찾을 수 있게 한다.
        f.write(html[:head_open.end()])
        f.write("\n" + shim)
        f.write(html[head_open.end():first_script])
        for i, (mime, file) in enumerate(blobs):
            data = file.read_bytes()
            total_raw += len(data)
            f.write(f'<script type="application/x-bmk-asset" id="bmk-asset-{i}">')
            f.write(base64.b64encode(data).decode("ascii"))
            f.write("</script>\n")
        f.write(html[first_script:])

    size = out.stat().st_size
    print(f"스크립트 {len(names)}개 인라인")
    print(f"에셋 경로 {len(index)}개 -> 고유 파일 {len(blobs)}개 ({total_raw / 1e6:.1f} MB 원본)")
    print(f"출력: {out}  ({size / 1e6:.1f} MB)")


if __name__ == "__main__":
    build(Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else DEFAULT_OUT)
