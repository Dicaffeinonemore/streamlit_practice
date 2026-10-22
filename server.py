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
import json
import os
import re
import shutil
import socketserver
import threading
import tempfile
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent
START_PORT = 8000
PORT_TRIES = 30            # 포트가 사용 중이면 8000, 8001, ... 순서로 빈 포트를 찾는다
SCRIPTS = ["motion.js", "sprites.js", "backgrounds.js", "score.js", "death-sfx.js", "audio.js", "hd_sprites.js", "legion_sprites.js", "game-ui.js", "release-art.js", "release.js", "named-art.js", "named-runtime.js", "floor-art.js", "floor-runtime.js", "zone-art.js", "zone-runtime.js", "barel-art.js", "barel-runtime.js", "viesa-art.js", "viesa-runtime.js", "gorath-art.js", "gorath-runtime.js", "morgra-art.js", "morgra-runtime.js", "aurelion-art.js", "aurelion-runtime.js", "vargul-art.js", "vargul-melee-art.js", "vargul-data.js", "vargul-runtime.js", "sovereign-art.js", "sovereign-data.js", "sovereign-runtime.js", "item-art.js", "item-runtime.js", "pixel-ui-art.js", "boss-ui-art.js", "enemy-ui-art.js", "pixel-ui.js", "game.js"]   # 순서 중요: motion.js(엔진) 먼저


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
        return f"<script>\n{code}\n</script>"

    html = re.sub(r'<script\s+src=([\"\'])([^\"\']+)\1\s*>\s*</script>', inline_script, html)
    # Streamlit uses its own page selector; relative navigation cannot escape srcdoc.
    html = html.replace('<a id="referenceLabLink" href="sprite-lab.html">원본 스프라이트 검수 ↗</a>', '')
    return html


def build_reference_html() -> str:
    """Bundle the reference viewer for Streamlit without HTTP/fetch dependencies."""
    catalog_path = "data/reference-catalog.json"
    catalog = json.loads((ROOT / catalog_path).read_text(encoding="utf-8"))
    documents = {catalog_path: catalog}
    images = {s["image"] for s in catalog["sources"]}
    documents[catalog["effects"]] = json.loads((ROOT / catalog["effects"]).read_text(encoding="utf-8"))
    for sample in documents[catalog["effects"]]["samples"]:
        images.update((sample["image"], sample["original"]))
    for char in catalog["characters"]:
        for key in ("animations", "skills", "enemy"):
            path = char[key]
            documents[path] = json.loads((ROOT / path).read_text(encoding="utf-8"))
        for anim in documents[char["animations"]]["animations"].values():
            if anim.get("panel"):
                images.add(anim["panel"])
            for frame in anim["frames"]:
                images.update((frame["image"], frame["original"]))
    payload = {"json": documents, "images": {
        path: "data:image/png;base64," + base64.b64encode((ROOT / path).read_bytes()).decode("ascii")
        for path in sorted(images)
    }}
    # Escape '<' to keep all source strings inside the script element.
    data = json.dumps(payload, ensure_ascii=False).replace("<", "\\u003c")
    html = (ROOT / "sprite-lab.html").read_text(encoding="utf-8")
    html = html.replace('<a href="index.html">게임으로 돌아가기 ↗</a>', '')
    html = html.replace('<link rel="stylesheet" href="src/animation/lab.css">',
                        '<style>' + (ROOT / "src/animation/lab.css").read_text(encoding="utf-8") + '</style>')
    html = html.replace('<script src="src/animation/player.js"></script>',
                        '<script>window.REFERENCE_BUNDLE=' + data + ';</script>\n<script src="src/animation/player.js"></script>')
    for name in ("src/animation/player.js", "src/combat/reference-combat.js", "src/animation/lab.js"):
        html = html.replace(f'<script src="{name}"></script>',
                            '<script>' + (ROOT / name).read_text(encoding="utf-8") + '</script>')
    return html


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


def prepare_streamlit_component(review: bool = False) -> Path:
    """Publish only required files; JS/images stay out of Streamlit's WebSocket messages."""
    identity = hashlib.sha256(str(ROOT).encode("utf-8")).hexdigest()[:16]
    destination = Path(tempfile.gettempdir()) / f"bmk-component-{identity}" / ("review" if review else "game")
    destination.mkdir(parents=True, exist_ok=True)
    entry = "sprite-lab.html" if review else "index.html"
    html = (ROOT / entry).read_text(encoding="utf-8")
    if review:
        catalog_name = "data/reference-catalog.json"
        catalog = json.loads((ROOT / catalog_name).read_text(encoding="utf-8"))
        files = {catalog_name, catalog["effects"], "src/animation/lab.css",
                 "src/animation/player.js", "src/combat/reference-combat.js", "src/animation/lab.js"}
        files.update(s["image"] for s in catalog["sources"])
        effects = json.loads((ROOT / catalog["effects"]).read_text(encoding="utf-8"))
        for sample in effects["samples"]:
            files.update((sample["image"], sample["original"]))
        for character in catalog["characters"]:
            files.update(character[key] for key in ("animations", "skills", "enemy"))
            animations = json.loads((ROOT / character["animations"]).read_text(encoding="utf-8"))
            for animation in animations["animations"].values():
                if animation.get("panel"):
                    files.add(animation["panel"])
                for frame in animation["frames"]:
                    files.update((frame["image"], frame["original"]))
        html = html.replace('<a href="index.html">게임으로 돌아가기 ↗</a>', '')
    else:
        files = set(re.findall(r'<script\s+src=[\"\']([^\"\']+)[\"\']', html))
        html = embed_boss_bgm(html)
        html = html.replace('<a id="referenceLabLink" href="sprite-lab.html">원본 스프라이트 검수 ↗</a>', '')
    files.add("streamlit-bridge.js")
    for name in sorted(files):
        _copy_component_file(name, destination)
    html = html.replace("<head>", '<head>\n<script src="streamlit-bridge.js"></script>', 1)
    target = destination / "index.html"
    if not target.is_file() or target.read_text(encoding="utf-8") != html:
        target.write_text(html, encoding="utf-8")
    return destination


def run_streamlit():
    import streamlit as st

    st.set_page_config(page_title="흑월의 기사 - BLACK MOON KNIGHT", page_icon="🌑", layout="wide")
    # 좌우 여백 최소화: 기본 block-container 의 max-width / 좌우 padding 제거
    st.markdown(
        "<style>.block-container,.stMainBlockContainer{padding:1rem .5rem .5rem;max-width:100%}</style>",
        unsafe_allow_html=True,
    )
    review = st.radio("화면", ["게임", "원본 스프라이트 검수"], horizontal=True) == "원본 스프라이트 검수"
    if not review:
        st.caption("게임 화면을 한 번 클릭한 뒤 조작하세요. (WASD 이동 · Space 점프 · J 공격 · U/H/O/P 전투 기술 · L 붉은 파동 · K 필살기 · I 뇌격 · ESC 일시정지)")
        # iframe 을 브라우저 크기에 맞춰 16:9 로 확대한다. 너비는 가로폭과 (화면 높이 - 상단 UI) 중 작은 쪽.
        # 캔버스 내부 해상도(960x540)는 그대로이고, index.html 의 #wrap 이 CSS 로만 늘어나므로 판정 좌표는 변하지 않는다.
        st.markdown(
            "<style>.block-container iframe,.stMainBlockContainer iframe{display:block;margin:0 auto;"
            "width:min(100%,calc((100vh - 130px)*16/9))!important;height:auto!important;aspect-ratio:16/9}</style>",
            unsafe_allow_html=True,
        )
    # Component files are streamed via HTTP, rather than serializing ~177 MB of HTML.
    import streamlit.components.v1 as components

    directory = prepare_streamlit_component(review)
    height = 1000 if review else 680
    component = components.declare_component("black_moon_reference" if review else "black_moon_game", path=str(directory))
    component(height=height, key="reference" if review else "game", default=None)
    st.caption("v1.41 · 비에사 · 필살기 흑월 난사")


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        # 개발 중 수정사항이 바로 반영되도록 캐시 비활성화
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def bind_server() -> socketserver.TCPServer:
    # Windows 에서는 SO_REUSEADDR 가 "이미 사용 중인 포트에도 바인딩"을 허용해 버리므로 끈다
    socketserver.TCPServer.allow_reuse_address = os.name != "nt"
    last_error = None
    for port in range(START_PORT, START_PORT + PORT_TRIES):
        try:
            return socketserver.TCPServer(("127.0.0.1", port), Handler)
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
