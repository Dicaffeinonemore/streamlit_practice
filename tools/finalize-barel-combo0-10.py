"""Write registration metadata without modifying any image pixels."""
import hashlib
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
folder = ROOT / "assets/aseprite/barel-combo0-10"
source = folder / "source/original.png"
digest = "abb1d1c08a8195a329e542fcc0e31de990b17a77ab70746d14225eb8ff1c1477"
assert hashlib.sha256(source.read_bytes()).hexdigest() == digest
(folder / "source").mkdir(exist_ok=True)
boxes = [Image.open(folder / f"F{i:02}.png").getbbox() for i in range(1, 11)]
metadata = {
    "schemaVersion": 1, "character": "barel", "attackId": "combo0",
    "clip": "basic-attack",
    "sprite": "../exports/barel-combo0-10/barel-combo0-10.json",
    "anchor": [160, 353],
    "frameOffsets": [[0, 353-box[3]] for box in boxes],
    "renderScale": 142 / 246,
    "expectedDurationsMs": [40, 30, 35, 25, 25, 30, 45, 25, 40, 55],
    "combat": {"durationMs": 350, "activeStartMs": 128.5,
               "activeEndMs": 230, "comboLinkMs": 267.5},
    "source": {"file": "source/original.png", "sha256": digest,
               "resampled": False, "redrawn": False},
    "alignment": {"referenceLegacyHeight": 142, "newNeutralHeight": 246,
                  "canvasGround": 353, "worldOffsetsApplied": False,
                  "note": "Shared render scale; 1-2 source-pixel sole corrections only. Local stance remains intrinsic to supplied poses."},
}
(folder / "barel-combo0-10.animation.json").write_text(
    json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

print("Saved Barel combo0 metadata and preserved original source")
