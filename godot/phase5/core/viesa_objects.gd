class_name BmkViesaWorld
extends RefCounted
## Viesa-owned world objects: hazards of type viesa_arrow, viesaUltObjects and viesaEffects.

class Arrow:
	extends RefCounted
	var x: float = 0.0
	var y: float = 0.0
	var h: float = 0.0
	var dir: int = 1
	var age: float = 0.0
	var speed: float = 0.0
	var vh: float = 0.0
	var range_: float = 0.0
	var travel: float = 0.0
	var depth: float = 0.0
	var aim_y: float = 0.0
	var start_y: float = 0.0
	var damage: float = 0.0
	var snipe: bool = false
	var rapid: bool = false
	var paid_special: bool = false
	var charge: int = 0
	var fading: bool = false
	var fade_age: int = 0
	var dead: bool = false
	var hits: Dictionary[int, bool] = {}
	var aux_hits: Dictionary = {}
	var seq: int = 0

class UltObject:
	extends RefCounted
	var kind: String = "phantom"
	var cast: BmkViesaAction
	var sx: float = 0.0
	var sy: float = 0.0
	var sh: float = 0.0
	var x: float = 0.0
	var y: float = 0.0
	var h: float = 0.0
	var tx: float = 0.0
	var ty: float = 0.0
	var th: float = 0.0
	var face: int = 1
	var age: int = 0
	var life: int = 3
	var variant: int = 0
	var impact: bool = false
	var damage: float = 0.0

class Effect:
	extends RefCounted
	var name: String = ""
	var x: float = 0.0
	var y: float = 0.0
	var h: float = 0.0
	var age: int = 0
	var life: int = 18
	var face: int = 1
	var width: float = 44.0
	var height: float = 44.0

var arrows: Array[Arrow] = []
var ult: Array[UltObject] = []
var effects: Array[Effect] = []

func reset() -> void:
	arrows.clear()
	ult.clear()
	effects.clear()

## viesaEffect(): capped at 128 live effects.
func effect(name_: String, x: float, y: float, h: float, face: int, width: float = 44.0, height: float = 44.0, life: int = 18) -> void:
	if effects.size() >= 128: return
	var f: Effect = Effect.new()
	f.name = name_
	f.x = x
	f.y = y
	f.h = h
	f.face = face
	f.width = width
	f.height = height
	f.life = life
	effects.append(f)

func update_effects() -> void:
	var kept: Array[Effect] = []
	for f: Effect in effects:
		f.age += 1
		if f.age < f.life: kept.append(f)
	effects = kept
