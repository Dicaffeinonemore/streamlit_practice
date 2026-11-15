class_name BmkGrabState
extends RefCounted
var owner_ref: WeakRef
var owner: BmkStageActor:
	get: return owner_ref.get_ref() as BmkStageActor if owner_ref != null else null
var kind: String = ""
var presses: int = 0
var t: int = 0
var squeezes: int = 0
var hold: float = 0.0

