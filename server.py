"""벨트스크롤 게임 실행 파일.

두 가지 방식으로 모두 실행됩니다.
  1) 로컬 서버:      python server.py          -> 브라우저가 자동으로 열립니다.
  2) Streamlit:      streamlit run server.py   (Streamlit Cloud 배포 포함)

Streamlit 환경에서는 소켓 서버를 열 수 없으므로(포트 바인딩 오류),
HTML/JS 파일을 하나로 합쳐 st.components.v1.html 로 화면에 직접 넣습니다.
"""
import http.server
import base64
import json
import os
import socketserver
import threading
import webbrowser
from pathlib import Path

ROOT = Path(__file__).parent
START_PORT = 8000
PORT_TRIES = 30            # 포트가 사용 중이면 8000, 8001, ... 순서로 빈 포트를 찾는다
SCRIPTS = ["motion.js", "sprites.js", "backgrounds.js", "score.js", "audio.js", "hd_sprites.js", "legion_sprites.js", "game-ui.js", "release-art.js", "release.js", "named-art.js", "named-runtime.js", "floor-art.js", "floor-runtime.js", "game.js"]   # 순서 중요: motion.js(엔진) 먼저


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


def build_single_html() -> str:
    """index.html 의 <script src=...> 를 실제 코드로 치환해 파일 하나짜리 HTML 로 만든다."""
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    for name in SCRIPTS:
        code = (ROOT / name).read_text(encoding="utf-8")
        html = html.replace(f'<script src="{name}"></script>', f"<script>\n{code}\n</script>")
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


def run_streamlit():
    import streamlit as st

    st.set_page_config(page_title="흑월의 기사 - BLACK MOON KNIGHT", page_icon="🌑", layout="wide")
    st.markdown(
        "<style>.block-container{padding-top:1rem;max-width:1200px}</style>",
        unsafe_allow_html=True,
    )
    review = st.radio("화면", ["게임", "원본 스프라이트 검수"], horizontal=True) == "원본 스프라이트 검수"
    if not review:
        st.caption("게임 화면을 한 번 클릭한 뒤 조작하세요. (WASD 이동 · Space 점프 · J 공격 · U/H/O/P 전투 기술 · L 붉은 파동 · K 필살기 · I 뇌격 · ESC 일시정지)")
    html = build_reference_html() if review else build_single_html()
    height = 1000 if review else 680
    if hasattr(st, "iframe"):          # 최신 Streamlit (components.v1.html 은 제거 예정)
        st.iframe(html, height=height)
    else:                              # 구버전 호환
        import streamlit.components.v1 as components

        components.html(html, height=height, scrolling=review)


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
