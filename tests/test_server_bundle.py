"""Streamlit 번들: 실제 HTML 연결, 누락 파일, 실행 디렉터리 검사."""
import importlib.util
import base64
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
    def test_component_embeds_mp3_bytes_before_audio_engine(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "index.html").write_text('<head></head><script src="audio.js"></script>', encoding="utf-8")
            (root / "audio.js").write_text("// audio", encoding="utf-8")
            (root / "streamlit-bridge.js").write_text("// bridge", encoding="utf-8")
            mp3 = root / "assets/bgm/boss.mp3"
            mp3.parent.mkdir(parents=True)
            with patch.object(server, "ROOT", root), patch.object(server.tempfile, "gettempdir", return_value=directory):
                for payload in (b"ID3 original audio", b"ID3 updated audio"):
                    mp3.write_bytes(payload)
                    output = server.prepare_streamlit_component()
                    html = (output / "index.html").read_text(encoding="utf-8")
                    encoded = re.search(r'data:audio/mpeg;base64,([^"<]+)', html).group(1)
                    self.assertEqual(base64.b64decode(encoded), payload)
                    self.assertLess(html.index("window.BOSS_BGM_URL"), html.index('src="audio.js"'))
                    self.assertFalse((output / "assets/bgm/boss.mp3").exists())

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

    def test_component_keeps_scripts_separate_and_exposes_only_game_files(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = '<head></head><script src="large.js"></script>'
            (root / "index.html").write_text(source, encoding="utf-8")
            script = b"// game\n" * 300000
            (root / "large.js").write_bytes(script)
            (root / "streamlit-bridge.js").write_text("// bridge", encoding="utf-8")
            (root / "private.txt").write_text("not a game file", encoding="utf-8")
            with patch.object(server, "ROOT", root), patch.object(server.tempfile, "gettempdir", return_value=directory):
                output = server.prepare_streamlit_component()
                first_mtime = (output / "large.js").stat().st_mtime_ns
                server.prepare_streamlit_component()
                self.assertEqual(first_mtime, (output / "large.js").stat().st_mtime_ns)
                self.assertEqual((output / "large.js").read_bytes(), script)
                html = (output / "index.html").read_text(encoding="utf-8")
                self.assertIn('<script src="large.js">', html)
                self.assertIn('streamlit-bridge.js', html)
                self.assertLess(len(html), 1000)
                self.assertFalse((output / "private.txt").exists())


class ActualStreamlitTests(unittest.TestCase):
    def test_game_and_reference_have_small_component_messages(self):
        try:
            from streamlit.testing.v1 import AppTest
        except ImportError:
            self.skipTest("Install requirements.txt for the real Streamlit test")
        app = AppTest.from_file(str(ROOT / "server.py"), default_timeout=90).run()
        self.assertEqual(len(app.exception), 0)
        components = app.get("component_instance")
        self.assertEqual(len(components), 1)
        self.assertLess(components[0].proto.ByteSize(), 10000)
        app.radio[0].set_value("원본 스프라이트 검수").run()
        self.assertEqual(len(app.exception), 0)
        components = app.get("component_instance")
        self.assertEqual(len(components), 1)
        self.assertLess(components[0].proto.ByteSize(), 10000)


if __name__ == "__main__":
    unittest.main()
