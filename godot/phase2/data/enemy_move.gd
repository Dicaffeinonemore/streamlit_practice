class_name BmkEnemyMove
extends Resource
@export var species: String = ""
@export var clip: String = ""
@export var lengths: PackedInt32Array = PackedInt32Array()
@export var warning_frames: int = 0
@export var next_clip: String = ""
@export var dash_from: int = -1
@export var dash_to: int = -1
@export var dash_ratio: float = 0.0
@export var armor_from: int = -1
@export var armor_to: int = -1
@export var hit_from: PackedInt32Array = PackedInt32Array()
@export var hit_to: PackedInt32Array = PackedInt32Array()
@export var hit_damage: PackedFloat64Array = PackedFloat64Array()
@export var hit_reach: PackedFloat64Array = PackedFloat64Array()
@export var hit_knockdown: PackedByteArray = PackedByteArray()

func frame_start(one_based: int) -> int:
	var total: int = 0
	for i: int in range(one_based - 1):
		total += lengths[i]
	return total
