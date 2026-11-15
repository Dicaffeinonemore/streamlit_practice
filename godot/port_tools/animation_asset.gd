class_name BmkAnimationAsset
extends Resource
## Exact source metadata accompanies a SpriteFrames preview, never gameplay time.
@export var source_id: String = ""
@export var sprite_frames: SpriteFrames
@export var frame_pivots: PackedVector2Array = PackedVector2Array()
@export var frame_scales: PackedFloat64Array = PackedFloat64Array()
@export var duration_ms: PackedFloat64Array = PackedFloat64Array()
@export var authoritative_duration: PackedByteArray = PackedByteArray()
@export var metadata: Dictionary = {}
@export var source_frames: Array[Dictionary] = []
