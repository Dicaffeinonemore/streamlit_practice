"""Register the reviewed second-hit cels without altering image pixels."""
import hashlib
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
folder = ROOT / "assets/aseprite/barel-combo1-10"
digest = "64992ab767aa8cf941172ed5499912252c55c5937a5626fdec15f2010b16cb26"
assert hashlib.sha256((folder / "source/original.png").read_bytes()).hexdigest() == digest
audit = json.loads((folder / "separation.json").read_text())
boxes = [Image.open(folder / f"F{i:02}.png").getbbox() for i in range(1, 11)]
origin = audit["anchor"]
neutral_height = boxes[8][3] - boxes[8][1]
metadata = {
    "schemaVersion": 1, "character": "barel", "attackId": "combo1",
    "clip": "basic-attack-2",
    "sprite": "../exports/barel-combo1-10/barel-combo1-10.json",
    "anchor": origin,
    "frameOffsets": [[0, origin[1]-box[3]] for box in boxes],
    "renderScale": 142 / neutral_height,
    "expectedDurationsMs": [70, 35, 35, 30, 30, 20, 20, 20, 25, 25],
    "combat": {"durationMs": 310, "activeStartMs": 105,
               "activeEndMs": 200, "comboLinkMs": 233},
    "source": {"file": "source/original.png", "sha256": digest,
               "resampled": False, "redrawn": False,
               "pixelCloneRepair": "F8 rear shin: supplied F5 pixels only; exact mappings in separation.json"},
    "alignment": {"referenceLegacyHeight": 142, "newNeutralHeight": neutral_height,
                  "neutralFrame": 9, "canvasGround": origin[1], "worldOffsetsApplied": False,
                  "note": "Shared display scale; intrinsic crouch/stance retained; only sole corrections."},
    "phases": {"preparationFrames": [1, 1], "risingStartupFrames": [2, 2],
               "primaryStrikeFrames": [3, 4], "activeFollowThroughFrames": [5, 5], "recoveryFrames": [6, 10]},
}
(folder / "barel-combo1-10.animation.json").write_text(
    json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print("Saved combo1 metadata: 310ms, active [105,200), combo2 link 233ms")
