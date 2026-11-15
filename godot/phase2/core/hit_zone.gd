class_name BmkHitZone
extends RefCounted
var ex: float = 0.0
var face: int = 1
var back: float = -8.0
var reach: float = 0.0
var y: float = 0.0
var depth: float = 20.0
var ez: float = 0.0
var max_height: float = 55.0
var relative_height: bool = true
var progress: float = 1.0
var hit_in: int = 0
var active: bool = false
var active_age: int = -1
var knockdown: bool = false
var warning: bool = true

func contains(target: BmkActorState) -> bool:
	var dx: float = (target.x - ex) * face
	if not (dx > back and dx < reach and absf(target.y - y) < depth):
		return false
	return absf(target.z - ez) < max_height if relative_height else target.z < max_height

func rectangle() -> Rect2:
	var a: float = ex + face * back
	var b: float = ex + face * reach
	return Rect2(minf(a, b), y - depth, absf(b - a), depth * 2.0)
