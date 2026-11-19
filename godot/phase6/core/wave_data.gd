class_name BmkWaveData
extends Resource
## Stage 2 source values (STAGES[1], legacy ET, Morgra timing/projectiles) from phase6_capture.cjs.
@export var source: Dictionary = {}

const PATH: String = "res://phase6/generated/stage2.res"
const PATHS: Dictionary = {1:"res://phase6/generated/stage2.res",2:"res://phase7/generated/stage3.res",3:"res://phase8/generated/stage4.res",4:"res://phase9/generated/stage5.res"}
static var _cache: Dictionary = {}

static func shared() -> BmkWaveData:
	return for_stage(1)

## Wave stage data by stage index (1 = Stage 2, 2 = Stage 3).
static func for_stage(index: int) -> BmkWaveData:
	if not _cache.has(index): _cache[index] = load(PATHS[index]) as BmkWaveData
	return _cache[index]

func move(id: String) -> Dictionary:
	return source["MORGRA_MOVES"].get(id,{})

func projectile(kind: String) -> Dictionary:
	return source["MORGRA"]["projectiles"].get(kind,{})

func morgra_scale() -> float:
	return float(source["MORGRA"]["scale"]) * float(source["BOSS_VISUAL_SCALE"])
