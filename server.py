"""벨트스크롤 게임 실행 파일.

두 가지 방식으로 모두 실행됩니다.
  1) 로컬 서버:      python server.py          -> 브라우저가 자동으로 열립니다.
  2) Streamlit:      streamlit run server.py   (Streamlit Cloud 배포 포함)

Streamlit 환경에서는 소켓 서버를 열 수 없으므로(포트 바인딩 오류),
게임 파일을 로컬 컴포넌트로 제공해 거대한 HTML 메시지 생성을 피합니다.
"""
import http.server
import hashlib
import base64
import csv
import json
import mimetypes
import os
import re
import shutil
import threading
import tempfile
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent
TITLE_ASSETS = ("godot/phase4/title_art/menu.webp", "godot/phase4/title_art/selection.png", "godot/phase4/title_art/lettering.png", "godot/phase4/title_art/menu.csv")
CHARACTER_SELECT_CSS = "character-select.css"
CHARACTER_SELECT_ASSETS = (
    "godot/phase4/character_select/img/barel.jpg",
    "godot/phase4/character_select/img/viesa.jpg",
    "assets/character-select/fonts/Cinzel.woff2",
    "assets/character-select/fonts/NanumMyeongjo-ExtraBold.woff2",
    "assets/character-select/fonts/NotoSansKR.woff2",
)
START_PORT = 8000
PORT_TRIES = 30            # 포트가 사용 중이면 8000, 8001, ... 순서로 빈 포트를 찾는다
SCRIPTS = ["perf-runtime.js", "combat-data.js", "motion.js", "sprites.js", "backgrounds.js", "score.js", "death-sfx.js", "viesa-sfx.js", "aurelion-sfx.js", "audio.js", "hd_sprites.js", "legion_sprites.js", "game-ui.js", "release-art.js", "release.js", "named-art.js", "named-runtime.js", "floor-art.js", "floor-runtime.js", "zone-art.js", "zone-runtime.js", "barel-art.js", "src/animation/aseprite.js", "src/animation/barel-combo0.js", "src/animation/barel-combo1.js", "src/animation/barel-combo2.js", "src/animation/barel-idle.js", "src/animation/barel-walk.js", "src/animation/barel-dash.js", "src/animation/barel-dash-attack.js", "src/animation/barel-hurt.js", "src/animation/barel-down.js", "src/animation/barel-jump.js", "src/animation/barel-air-attack.js", "src/animation/barel-grabbed.js", "barel-runtime.js", "viesa-art.js", "viesa-runtime.js", "gorath-art.js", "gorath-runtime.js", "gorath-remake-art.js", "gorath-remake-runtime.js", "morgra-art.js", "judgment-art.js", "judgment-runtime.js", "morgra-runtime.js", "aurelion-art.js", "aurelion-runtime.js", "vargul-art.js", "vargul-melee-art.js", "vargul-data.js", "vargul-runtime.js", "sovereign-art.js", "sovereign-data.js", "sovereign-runtime.js", "item-art.js", "item-runtime.js", "hud-ui-art.js", "enemy-ui-art.js", "viesa-ui-art.js", "viesa-ui.js", "pixel-ui.js", "stage1-bg-art.js", "stage1-fx-art.js", "stage1-enemy-art.js", "stage1-runtime.js", "feel-runtime.js", "demo-runtime.js", "game.js"]   # 순서 중요: combat-data.js(전투 수치) → motion.js(엔진) 먼저


def in_streamlit() -> bool:
    """Streamlit 이 이 스크립트를 실행 중인지 확인한다."""
    try:
        from streamlit.runtime.scriptrunner import get_script_run_ctx

        try:
            return get_script_run_ctx(suppress_warning=True) is not None
        except TypeError:          # 오래된 버전은 suppress_warning 인자가 없다
            return get_script_run_ctx() is not None
    except Exception:
        return False


def embed_boss_bgm(html: str) -> str:
    """Embed MP3 bytes before the audio engine, avoiding a separate media request."""
    boss_bgm = ROOT / "assets/bgm/boss.mp3"
    if boss_bgm.is_file():
        url = "data:audio/mpeg;base64," + base64.b64encode(boss_bgm.read_bytes()).decode("ascii")
        html = re.sub(
            r'<script\s+src=([\"\'])audio\.js\1\s*>',
            lambda match: f'<script>window.BOSS_BGM_URL="{url}";</script>\n' + match.group(0),
            html, count=1,
        )
    return html


def build_single_html() -> str:
    """index.html 의 <script src=...> 를 실제 코드로 치환해 파일 하나짜리 HTML 로 만든다."""
    html = embed_boss_bgm((ROOT / "index.html").read_text(encoding="utf-8"))
    selector_stylesheet = f'<link rel="stylesheet" href="{CHARACTER_SELECT_CSS}">'
    if selector_stylesheet in html:
        styles = (ROOT / CHARACTER_SELECT_CSS).read_text(encoding="utf-8")
        html = html.replace(selector_stylesheet, f"<style>\n{embed_select_assets(styles)}\n</style>")
    # Compact HUD PNGs also need to work in the self-contained HTML export.
    hud_dirs = ("assets/aseprite/ui/hud-v4", "assets/aseprite/ui/enemy-v3")
    hud_images = {}
    for folder in hud_dirs:
        for image in (ROOT / folder).glob("*.png"):
            if "preview" in image.stem:
                continue
            path = f"{folder}/{image.name}"
            hud_images[path] = "data:image/png;base64," + base64.b64encode(image.read_bytes()).decode("ascii")
    for path, data in hud_images.items():
        html = html.replace(path, data)
    # The settings backdrop is CSS rather than a script asset; embed it for the
    # single-file export too, just as title-menu.js embeds the same image below.
    backdrop = "url('godot/phase4/title_art/menu.webp')"
    if backdrop in html:
        title_image = base64.b64encode((ROOT / TITLE_ASSETS[0]).read_bytes()).decode("ascii")
        html = html.replace(backdrop, "url('data:image/webp;base64," + title_image + "')")
    # The developer lab needs its sibling files and a same-origin game iframe.
    html = re.sub(r'<a id="mobileLabLink"[^>]*>.*?</a>', '', html)
    # 실제 HTML의 연결 순서가 기준이다. 오래된 목록에만 남은 파일을 읽지 않는다.
    def inline_script(match: re.Match) -> str:
        name = match.group(2)
        script = ROOT / name
        if not script.is_file():
            raise FileNotFoundError(
                f"index.html에서 연결한 스크립트가 없습니다: {name}. "
                "배포 저장소에 index.html, server.py와 해당 JavaScript 파일이 "
                "같은 버전으로 포함되어 있는지 확인하세요."
            )
        code = script.read_text(encoding="utf-8")
        if name == "common-hud-v3.js":
            for folder in hud_dirs:
                values = {Path(path).stem: data for path, data in hud_images.items() if path.startswith(folder + "/")}
                code = code.replace(f"`{folder}/${{name}}.png`", f"({json.dumps(values)})[name]")
        for path, data in hud_images.items():
            code = code.replace(path, data)
        # The standalone export remains self-contained; normal play uses cached files.
        def embed_image(asset: re.Match) -> str:
            image_path = ROOT / asset.group(0)
            extension = image_path.suffix.lstrip(".")
            mime = "jpeg" if extension == "jpg" else extension
            return "data:image/" + mime + ";base64," + base64.b64encode(image_path.read_bytes()).decode("ascii")
        code = re.sub(r"assets/runtime/[a-f0-9]+\.(?:png|webp|gif|jpg)", embed_image, code)
        if name in ("title-menu.js", "game-language.js"):
            for asset in TITLE_ASSETS:
                if asset not in code:
                    continue
                mime = "text/csv;charset=utf-8" if asset.endswith(".csv") else mimetypes.guess_type(asset)[0]
                encoded = base64.b64encode((ROOT / asset).read_bytes()).decode("ascii")
                code = code.replace(asset, f"data:{mime};base64,{encoded}")
        if name == "character-select.js":
            code = embed_select_assets(code)
        return f"<script>\n{code}\n</script>"

    html = re.sub(r'<script\s+src=([\"\'])([^\"\']+)\1\s*>\s*</script>', inline_script, html)
    return html


def embed_select_assets(source: str) -> str:
    for asset in CHARACTER_SELECT_ASSETS:
        if asset in source:
            mime = "font/woff2" if asset.endswith(".woff2") else "image/jpeg"
            encoded = base64.b64encode((ROOT / asset).read_bytes()).decode("ascii")
            source = source.replace(asset, f"data:{mime};base64,{encoded}")
    return source


def _copy_component_file(name: str, destination: Path) -> None:
    """Copy only changed public game files, with bounded memory and atomic replacement."""
    source = ROOT / name
    target = destination / name
    info = source.stat()
    if target.is_file():
        old = target.stat()
        if old.st_size == info.st_size and old.st_mtime_ns == info.st_mtime_ns:
            return
    target.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=target.parent, delete=False) as output:
        temporary = Path(output.name)
        try:
            with source.open("rb") as incoming:
                shutil.copyfileobj(incoming, output, length=1024 * 1024)
        except BaseException:
            output.close()
            temporary.unlink(missing_ok=True)
            raise
    try:
        os.utime(temporary, ns=(info.st_atime_ns, info.st_mtime_ns))
        os.replace(temporary, target)
    finally:
        temporary.unlink(missing_ok=True)


def prepare_streamlit_component() -> Path:
    """Publish only required files; JS/images stay out of Streamlit's WebSocket messages."""
    identity = hashlib.sha256(str(ROOT).encode("utf-8")).hexdigest()[:16]
    destination = Path(tempfile.gettempdir()) / f"bmk-component-{identity}" / "game"
    destination.mkdir(parents=True, exist_ok=True)
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    files = set(re.findall(r'<script\s+src=[\"\']([^\"\']+)[\"\']', html))
    if "title-menu.js" in files:
        files.update(TITLE_ASSETS)
    if "character-select.js" in files:
        files.add(CHARACTER_SELECT_CSS)
        files.update(CHARACTER_SELECT_ASSETS)
        files.update(path.relative_to(ROOT).as_posix() for path in (ROOT / "assets/character-select/fonts").glob("OFL-*.txt"))
    if "src/animation/barel-combo0.js" in files:
        # Runtime fetches are relative to the component document, as locally.
        animation_files = (
            "assets/aseprite/barel-combo0-10/barel-combo0-10.animation.json",
            "assets/aseprite/exports/barel-combo0-10/barel-combo0-10.json",
            "assets/aseprite/exports/barel-combo0-10/barel-combo0-10.png",
        )
        files.update(name for name in animation_files if (ROOT / name).is_file())
    if "src/animation/barel-combo1.js" in files:
        animation_files = (
            "assets/aseprite/barel-combo1-10/barel-combo1-10.animation.json",
            "assets/aseprite/exports/barel-combo1-10/barel-combo1-10.json",
            "assets/aseprite/exports/barel-combo1-10/barel-combo1-10.png",
        )
        files.update(name for name in animation_files if (ROOT / name).is_file())
    html = embed_boss_bgm(html)
    files.update(name for name in ("mobile-lab.html", "mobile-lab.css", "mobile-lab.js") if (ROOT / name).is_file())
    manifest = ROOT / "data/runtime-assets.json"
    if manifest.is_file():
        files.update(json.loads(manifest.read_text(encoding="utf-8")))
    files.add("streamlit-bridge.js")
    if "src/animation/barel-idle.js" in files:
        animation_files = (
            "assets/aseprite/barel-idle-10/barel-idle-10.animation.json",
            "assets/aseprite/exports/barel-idle-10/barel-idle-10.json",
            "assets/aseprite/exports/barel-idle-10/barel-idle-10.png",
        )
        files.update(name for name in animation_files if (ROOT / name).is_file())
    if "src/animation/barel-combo2.js" in files:
        animation_files = (
            "assets/aseprite/barel-combo2-10/barel-combo2-10.animation.json",
            "assets/aseprite/exports/barel-combo2-10/barel-combo2-10.json",
            "assets/aseprite/exports/barel-combo2-10/barel-combo2-10.png",
        )
        files.update(name for name in animation_files if (ROOT / name).is_file())
    if "src/animation/barel-walk.js" in files:
        animation_files = (
            "assets/aseprite/barel-walk-revised-10/barel-walk-revised-10.animation.json",
            "assets/aseprite/exports/barel-walk-revised-10/barel-walk-revised-10.json",
            "assets/aseprite/exports/barel-walk-revised-10/barel-walk-revised-10.png",
            "assets/aseprite/barel-walk-10/barel-walk-10.animation.json",
            "assets/aseprite/exports/barel-walk-10/barel-walk-10.json",
            "assets/aseprite/exports/barel-walk-10/barel-walk-10.png",
        )
        files.update(name for name in animation_files if (ROOT / name).is_file())
    if "src/animation/barel-down.js" in files:
        name = "barel-knockdown-getup-design-10"
        files.update((f"assets/aseprite/{name}/{name}.animation.json",
                      f"assets/aseprite/exports/{name}/{name}.json",
                      f"assets/aseprite/exports/{name}/{name}.png"))
    if "src/animation/barel-hurt.js" in files:
        name = "barel-hurt-12"
        files.update((f"assets/aseprite/{name}/{name}.animation.json",
                      f"assets/aseprite/exports/{name}/{name}.json",
                      f"assets/aseprite/exports/{name}/{name}.png"))
    if "src/animation/barel-dash-attack.js" in files:
        name = "barel-dash-attack-10"
        files.update((f"assets/aseprite/{name}/{name}.animation.json",
                      f"assets/aseprite/exports/{name}/{name}.json",
                      f"assets/aseprite/exports/{name}/{name}.png"))
    if "src/animation/barel-dash.js" in files:
        animation_files = (
            "assets/aseprite/barel-dash-10/barel-dash-10.animation.json",
            "assets/aseprite/exports/barel-dash-10/barel-dash-10.json",
            "assets/aseprite/exports/barel-dash-10/barel-dash-10.png",
        )
        files.update(name for name in animation_files if (ROOT / name).is_file())
    for combo_index in range(3):
        if f"src/animation/barel-combo{combo_index}.js" in files:
            name = f"barel-combo{combo_index}-dot-10"
            animation_files = (
                f"assets/aseprite/{name}/{name}.animation.json",
                f"assets/aseprite/exports/{name}/{name}.json",
                f"assets/aseprite/exports/{name}/{name}.png",
            )
            files.update(name for name in animation_files if (ROOT / name).is_file())
    if "src/animation/barel-jump.js" in files:
        name = "barel-jump-revised-10"
        files.update((f"assets/aseprite/{name}/{name}.animation.json",
                      f"assets/aseprite/exports/{name}/{name}.json",
                      f"assets/aseprite/exports/{name}/{name}.png"))
        animation_files = (
            "assets/aseprite/barel-jump-10/barel-jump-10.animation.json",
            "assets/aseprite/exports/barel-jump-10/barel-jump-10.json",
            "assets/aseprite/exports/barel-jump-10/barel-jump-10.png",
        )
        files.update(name for name in animation_files if (ROOT / name).is_file())
    if "src/animation/barel-air-attack.js" in files:
        animation_files = (
            "assets/aseprite/barel-air-attack-10/barel-air-attack-10.animation.json",
            "assets/aseprite/exports/barel-air-attack-10/barel-air-attack-10.json",
            "assets/aseprite/exports/barel-air-attack-10/barel-air-attack-10.png",
        )
        files.update(name for name in animation_files if (ROOT / name).is_file())
    if "src/animation/barel-idle.js" in files:
        animation_files = (
            "assets/aseprite/barel-idle-stationary-10/barel-idle-stationary-10.animation.json",
            "assets/aseprite/exports/barel-idle-stationary-10/barel-idle-stationary-10.json",
            "assets/aseprite/exports/barel-idle-stationary-10/barel-idle-stationary-10.png",
            "assets/aseprite/barel-idle-dot-10/barel-idle-dot-10.animation.json",
            "assets/aseprite/exports/barel-idle-dot-10/barel-idle-dot-10.json",
            "assets/aseprite/exports/barel-idle-dot-10/barel-idle-dot-10.png",
        )
        files.update(name for name in animation_files if (ROOT / name).is_file())
    if "src/animation/barel-grabbed.js" in files:
        animation_files = (
            "assets/aseprite/barel-grabbed-10/barel-grabbed-10.animation.json",
            "assets/aseprite/exports/barel-grabbed-10/barel-grabbed-10.json",
            "assets/aseprite/exports/barel-grabbed-10/barel-grabbed-10.png",
        )
        files.update(name for name in animation_files if (ROOT / name).is_file())
    if "src/animation/barel-walk.js" in files:
        animation_files = (
            "assets/aseprite/barel-walk-dot-10/barel-walk-dot-10.animation.json",
            "assets/aseprite/exports/barel-walk-dot-10/barel-walk-dot-10.json",
            "assets/aseprite/exports/barel-walk-dot-10/barel-walk-dot-10.png",
        )
        files.update(name for name in animation_files if (ROOT / name).is_file())
    for name in sorted(files):
        _copy_component_file(name, destination)
    html = html.replace("<head>", '<head>\n<script src="streamlit-bridge.js"></script>', 1)
    target = destination / "index.html"
    if not target.is_file() or target.read_text(encoding="utf-8") != html:
        target.write_text(html, encoding="utf-8")
    return destination


def run_streamlit():
    import streamlit as st

    st.set_page_config(page_title="Lunatic Nights", page_icon="🌑", layout="wide")
    # 좌우 여백 최소화: 기본 block-container 의 max-width / 좌우 padding 제거
    st.markdown(
        "<style>.block-container,.stMainBlockContainer{padding:1rem .5rem .5rem;max-width:100%}</style>",
        unsafe_allow_html=True,
    )
    with st.container(key="game_help"):
        help_caption = st.empty()
    # The parent iframe must fill the mobile browser, not just the game canvas.
    css = (ROOT / "streamlit-game.css").read_text(encoding="utf-8")
    st.markdown(f"<style>{css}</style>", unsafe_allow_html=True)
    # Component files are streamed via HTTP, rather than serializing ~177 MB of HTML.
    import streamlit.components.v1 as components

    directory = prepare_streamlit_component()
    component = components.declare_component("black_moon_game", path=str(directory))
    with st.container(key="game_host"):
        language = component(height=680, key="game", default="en")
    locale = "ko" if language == "ko" else "en"
    with (ROOT / "godot/phase4/title_art/menu.csv").open(encoding="utf-8-sig", newline="") as source:
        captions = {row["keys"]: row[locale] for row in csv.DictReader(source)}
    help_caption.caption(captions["HOST_CONTROLS"])
    with st.container(key="game_footer"):
        st.caption(captions["HOST_VERSION"])


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        # Content-hashed images can be cached; editable scripts refresh immediately.
        if self.path.startswith("/assets/runtime/"):
            self.send_header("Cache-Control", "public, max-age=31536000, immutable")
        else:
            self.send_header("Cache-Control", "no-cache")
        super().end_headers()


def bind_server() -> http.server.ThreadingHTTPServer:
    # Windows 에서는 SO_REUSEADDR 가 "이미 사용 중인 포트에도 바인딩"을 허용해 버리므로 끈다
    http.server.ThreadingHTTPServer.allow_reuse_address = os.name != "nt"
    http.server.ThreadingHTTPServer.request_queue_size = 128
    last_error = None
    for port in range(START_PORT, START_PORT + PORT_TRIES):
        try:
            return http.server.ThreadingHTTPServer(("127.0.0.1", port), Handler)
        except OSError as e:       # 포트 사용 중 등 -> 다음 포트 시도
            last_error = e
    raise SystemExit(f"사용 가능한 포트를 찾지 못했습니다 ({START_PORT}~{START_PORT + PORT_TRIES - 1}): {last_error}")


def run_local():
    with bind_server() as httpd:
        url = f"http://localhost:{httpd.server_address[1]}/index.html"
        print(f"게임 서버 실행 중: {url}  (종료: Ctrl+C)")
        threading.Timer(0.5, lambda: webbrowser.open(url)).start()
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n서버를 종료합니다.")


if in_streamlit():
    run_streamlit()
elif __name__ == "__main__":
    run_local()
