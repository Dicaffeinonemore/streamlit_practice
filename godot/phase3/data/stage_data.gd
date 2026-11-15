class_name BmkStageData
extends Resource
@export var source: Dictionary = {}
@export var combat: BmkCombatData

func g2(key: String, phase: int = -1) -> float:
	return float(source["G2"][key][phase]) if phase >= 0 else float(source["G2"][key])

func clip_length(clip: String) -> int:
	return (source["G2A"]["clips"][clip]["frames"] as Array).size()

func mark(clip: String, key: String) -> int:
	return int(source["G2A"]["marks"][clip][key])

func move(id: String) -> Dictionary:
	return source["G2_MOVES"][id]

func table(name_: String, key: String) -> float:
	return float(source[name_][key])

