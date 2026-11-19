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
var cast_token: int = 0
# Vargul hazards (sword/cross marks, orbs, shards, ultimate, ice waves, fx).
var wait: float = 0.0
var active: float = 0.0
var boom: bool = false
var hp: float = 0.0
var max_hp: float = 0.0
var inv: int = 0
var flash: int = 0
var vh: float = 0.0
var ai: String = ""
var shot_cooldown: float = 0.0
var shot_pending: bool = false
var index: int = 0
var caster_index: int = 0
var stage: String = ""
var impact_age: int = 0
var waves_emitted: int = 0
var wave_radius: float = 0.0
var wave_ticks: int = 0
var pulse: int = 0
var width: float = 0.0
var height: float = 0.0
var born_elapsed: int = 0
# Arena rifts (game.js updArena): lane half depth and the arena flag.
var depth: float = 0.0
var arena: bool = false
