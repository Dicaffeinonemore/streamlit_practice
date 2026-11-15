class_name BmkFireHazard
extends RefCounted
var type: String = "fire"
var x: float = 0
var y: float = 0
var h: float = 0
var x0: float = 0
var y0: float = 0
var h0: float = 0
var tx: float = 0
var ty: float = 0
var age: float = 0
var life: float = 0
var duration: float = 0
var arc: float = 0
var dead: bool = false
var hits: Dictionary[int, int] = {}

func scale_at(ms: float) -> float:
	var left: float = 150 * ms - age
	return clampf(minf(1,age / (6 * ms)),0.3,1) * (maxf(0.05,left / (30 * ms)) if left < 30 * ms else 1.0)

