class_name BmkWaveData
extends Resource
## Stage 2 source values (STAGES[1], legacy ET, Morgra timing/projectiles) from phase6_capture.cjs.
@export var source: Dictionary = {}

const PATH: String = "res://phase6/generated/stage2.res"
static var _shared: BmkWaveData

static func shared() -> BmkWaveData:
	if _shared == null: _shared = load(PATH) as BmkWaveData
	return _shared

func move(id: String) -> Dictionary:
	return source["MORGRA_MOVES"].get(id,{})

func projectile(kind: String) -> Dictionary:
	return source["MORGRA"]["projectiles"].get(kind,{})

func morgra_scale() -> float:
	return float(source["MORGRA"]["scale"]) * float(source["BOSS_VISUAL_SCALE"])
