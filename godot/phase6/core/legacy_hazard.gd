class_name BmkLegacyHazard
extends RefCounted
## Browser hazards of type 'arrow' (archers) and 'morgra' (bolts, crows, pillars, moon field, visual fx).
var type: String = ""
var kind: String = ""
var fx: String = ""
var x: float = 0.0
var y: float = 0.0
var h: float = 0.0
var age: float = 0.0
var dead: bool = false
var dir: int = 0
var delay: float = 0.0
var life: float = 0.0
var hit: bool = false
var diving: bool = false
var vx: float = 0.0
var vy: float = 0.0
var face: int = 0
var damage_scale: float = 0.0
var damage: float = 0.0
var visual: bool = false
var owner: BmkLegacyActor
var safe: Array[PackedFloat64Array] = []
var seq: int = 0
