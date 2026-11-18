class_name BmkViesaData
extends Resource
## Source values captured from viesa-art.js / viesa-runtime.js / game.js (phase5_capture.cjs).
@export var source: Dictionary = {}

const PATH: String = "res://phase5/generated/viesa.res"
static var _shared: BmkViesaData

static func shared() -> BmkViesaData:
	if _shared == null: _shared = load(PATH) as BmkViesaData
	return _shared

func scale() -> float:
	return float(source["VIESA"]["scale"])

func world_height() -> float:
	return float(source["VIESA"]["worldHeight"])

func clip_length(name_: String) -> int:
	var clips: Dictionary = source["VIESA"]["clips"]
	return (clips[name_] as Array).size() if clips.has(name_) else 0

## viesaFrame(): index is floored and clamped into the clip.
func frame_index(name_: String, index: float) -> int:
	return mini(clip_length(name_) - 1, maxi(0, floori(index)))

func tip(name_: String, index: int) -> Variant:
	var clips: Dictionary = source["VIESA"]["clips"]
	if not clips.has(name_) or index < 0: return null
	return (clips[name_] as Array)[index]["tip"]

func skill_cooldown(id: String) -> float:
	return float(source["SKILLS"][id]["cd"])

func skill_name(id: String) -> String:
	return str(source["VIESA_SKILLS"][id]["name"]) if source["VIESA_SKILLS"].has(id) else ""

func player_value(key: String) -> float:
	return float(source["PLAYER"][key])

func view_width() -> float:
	return float(source["VW"])

func ground_top() -> float:
	return float(source["GTOP"])

func ground_bottom() -> float:
	return float(source["GBOT"])
