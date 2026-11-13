"""Serve the project's mobile layout lab locally; stop with Ctrl+C."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import server

if __name__ == '__main__':
    with server.bind_server() as httpd:
        print(f'Mobile layout lab: http://127.0.0.1:{httpd.server_address[1]}/mobile-lab.html', flush=True)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass
