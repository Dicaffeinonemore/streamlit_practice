"""Independent provenance checks. Run with Python + Pillow after extraction."""
import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
def read(path): return json.loads((ROOT/path).read_text(encoding="utf-8"))
catalog = read("data/reference-catalog.json")
sources = {}
for source in catalog["sources"]:
    path = ROOT/source["image"]
    assert hashlib.sha256(path.read_bytes()).hexdigest() == source["sha256"]
    sources[source["id"]] = Image.open(path).convert("RGB")
    assert sources[source["id"]].size == (1672,941)

frames = 0
for char in catalog["characters"]:
    data = read(char["animations"])
    for clip in data["animations"].values():
        source = sources[clip["source"]]
        assert clip["gameReady"] is False, "Unreviewed output must not replace production sprites"
        if clip.get("panel"):
            panel = Image.open(ROOT/clip["panel"])
            assert panel.tobytes() == source.crop(clip["sourceRect"]).tobytes()
        for i,f in enumerate(clip["frames"]):
            frames += 1
            assert f["index"] == i
            rect = f["sourceRect"]
            assert 0 <= rect[0] < rect[2] <= 1672 and 0 <= rect[1] < rect[3] <= 941
            original = Image.open(ROOT/f["original"]).convert("RGB")
            assert original.tobytes() == source.crop(rect).tobytes(), "Source RGB must be lossless"
            candidate = Image.open(ROOT/f["image"])
            assert candidate.mode == "RGBA" and list(candidate.size) == clip["canvas"]
            ox,oy = f["offset"]
            region = candidate.crop((ox,oy,ox+original.width,oy+original.height))
            assert region.convert("RGB").tobytes() == original.tobytes(), "No recoloring, inpainting or quantization"
            assert f["origin"] == clip["origin"]
            assert [f["sourceAnchor"][0]-rect[0]+ox,f["sourceAnchor"][1]-rect[1]+oy] == f["origin"]
            assert set(region.getchannel("A").tobytes()) <= {0,255}, "No invented semi-transparent glow"
            rgb, alpha = original.tobytes(), region.getchannel("A").tobytes()
            for p,a in enumerate(alpha):
                if rgb[p*3:p*3+3] == b'\x00\x00\x00':
                    assert a == 255, "Black armor must not be color-keyed away"
        if clip["status"] in ("missing","blocked"): assert not clip["frames"]
    for s in read(char["skills"])["skills"].values():
        assert not s["enabled"] and s["activeFrames"] == []
        assert s["animation"] in data["animations"]
        assert s["name"] == data["animations"][s["animation"]]["name"]

assert frames == catalog["candidateFrames"] == 139
effects = read(catalog["effects"])["samples"]
assert len(effects) == 10
for effect in effects:
    original = Image.open(ROOT/effect["original"]).convert("RGB")
    candidate = Image.open(ROOT/effect["image"])
    assert original.tobytes() == sources[effect["source"]].crop(effect["sourceRect"]).tobytes()
    assert candidate.convert("RGB").tobytes() == original.tobytes()
    assert not effect["gameReady"] and not effect["animated"]
for char in ("infantry","spearman","archer"):
    a=read(f"data/animations/{char}.json")["animations"]
    assert len(a["idle"]["frames"]) == 6 and len(a["walk"]["frames"]) == 8
    assert a["death"]["declaredFrames"] == 5 and len(a["death"]["frames"]) == 4
assert len(read("data/animations/archer.json")["animations"]["attack"]["frames"]) == 5
assert read("data/animations/knight.json")["animations"]["idle"]["printedLabels"] == [1,2,4,3,5,6]
for char,names in {
    "aurelion":["3단 검기 선풍","황금의 엄벌","황금중파참"],
    "frozen_graveblord":["삼중 빙환참","절대영도","빙옥의 감옥"],
    "black_moon_emperor":["흑월 연참","종언의 월식","허무의 처형식"],
}.items():
    a=read(f"data/animations/{char}.json")["animations"]
    assert [a[f"skill{i}"]["name"] for i in (1,2,3)] == names
    assert a["hurt"]["status"] == "missing"
print(f"PASS: 5 source hashes, {frames} lossless frame crops, 10 effect samples, pixel provenance, anchors, black armor, missing-frame gates and skill names")
