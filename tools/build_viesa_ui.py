"""Embed the transparent Viesa HUD so local and single-HTML builds share the asset."""
import base64
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
source = ROOT / 'assets/ui/viesa-ui.png'
encoded = base64.b64encode(source.read_bytes()).decode('ascii')
(ROOT / 'viesa-ui-art.js').write_text(
    '// Viesa HUD; transparent cutout of the supplied reference.\n'
    'const VIESA_UI_SOURCE = "data:image/png;base64,' + encoded + '";\n', encoding='utf-8')
