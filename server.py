"""벨트스크롤 게임 실행용 로컬 서버.

사용법:  python server.py   ->  브라우저가 자동으로 http://localhost:8000 을 엽니다.
"""
import http.server
import socketserver
import threading
import webbrowser
from pathlib import Path

PORT = 8000
ROOT = Path(__file__).parent


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        # 개발 중 수정사항이 바로 반영되도록 캐시 비활성화
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def main():
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("127.0.0.1", PORT), Handler) as httpd:
        url = f"http://localhost:{PORT}/index.html"
        print(f"게임 서버 실행 중: {url}  (종료: Ctrl+C)")
        threading.Timer(0.5, lambda: webbrowser.open(url)).start()
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n서버를 종료합니다.")


if __name__ == "__main__":
    main()
