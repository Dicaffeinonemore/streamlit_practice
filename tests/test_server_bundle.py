"""Streamlit 번들: 실제 HTML 연결, 누락 파일, 실행 디렉터리 검사."""
import importlib.util
import os
from pathlib import Path
import re
import tempfile
import unittest
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("game_server", ROOT / "server.py")
server = importlib.util.module_from_spec(spec)
spec.loader.exec_module(server)


class StreamlitBundleTests(unittest.TestCase):
    def test_real_game_bundle_from_another_directory(self):
        previous = Path.cwd()
        with tempfile.TemporaryDirectory() as directory:
            try:
                os.chdir(directory)
                html = server.build_single_html()
            finally:
                os.chdir(previous)
        self.assertIsNone(re.search(r'<script\s+src=', html))
        self.assertIn("function drawEnemy", html)
        self.assertNotIn("asset-loader.js", html)

    def test_html_order_ignores_stale_script_list(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "index.html").write_text(
                '<script src="second.js"></script><script src=\'first.js\'></script>',
                encoding="utf-8",
            )
            (root / "first.js").write_text("const first = 1;", encoding="utf-8")
            (root / "second.js").write_text("const second = 2;", encoding="utf-8")
            with patch.object(server, "ROOT", root), patch.object(server, "SCRIPTS", ["asset-loader.js"]):
                html = server.build_single_html()
            self.assertLess(html.index("const second"), html.index("const first"))

    def test_missing_referenced_script_is_reported(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "index.html").write_text('<script src="missing.js"></script>', encoding="utf-8")
            with patch.object(server, "ROOT", root):
                with self.assertRaisesRegex(FileNotFoundError, "index.html.*missing.js"):
                    server.build_single_html()


if __name__ == "__main__":
    unittest.main()
