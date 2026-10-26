"""Write terminal third-hit registration; never modifies image pixels."""
import hashlib
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
folder = ROOT / "assets/aseprite/barel-combo2-10"
digest = "59d5dfc5b25d690aac31c2aefb4a6581b0610734a66bb2561cbcdbe36c47f43d"
assert hashlib.sha256((folder / "source/original.png").read_bytes()).hexdigest() == digest
audit = json.loads((folder / "separation.json").read_text())
boxes = [Image.open(folder / f"F{i:02}.png").getbbox() for i in range(1,11)]
origin = audit["anchor"]
neutral_height = boxes[9][3]-boxes[9][1]
metadata = {
    "schemaVersion": 1, "character": "barel", "attackId": "combo2", "terminalAttack": True,
    "clip": "basic-attack-3", "sprite": "../exports/barel-combo2-10/barel-combo2-10.json",
    "anchor": origin, "frameOffsets": [[0,origin[1]-box[3]] for box in boxes],
    "renderScale": 142/neutral_height,
    "expectedDurationsMs": [70,60,70,20,29,91,30,90,90,130],
    "combat": {"durationMs":680,"activeStartMs":249,"activeEndMs":370,"comboLinkMs":None,
               "waveMs":284,"groundSmashMs":319},
    "source": {"file":"source/original.png","sha256":digest,"resampled":False,"redrawn":False,"pixelClones":False},
    "alignment": {"referenceLegacyHeight":142,"newNeutralHeight":neutral_height,"neutralFrame":10,
                  "canvasGround":origin[1],"worldOffsetsApplied":False},
    "phases": {"windupFrames":[1,3],"downswingFrames":[4,5],"impactFrame":6,
               "activeFollowThroughFrame":7,"recoveryFrames":[8,10]},
}
(folder/"barel-combo2-10.animation.json").write_text(json.dumps(metadata,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print("Saved terminal combo2 metadata: 680ms, active [249,370), no next combo")
