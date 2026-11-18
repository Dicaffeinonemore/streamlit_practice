class_name BmkLegacyActor
extends BmkStageActor
## game.js mkEnemy() fields for the wave stages' soldiers and bosses.
var type: String = ""
## Scaled stats: wind/act/rec/range/dmg/spd/kb/kd/ranged/keepAway/h/hw.
var stats: Dictionary = {}
var pt: float = 0.0
var marks: Dictionary[String, bool] = {}
var last: String = ""
var form: String = ""
var hit_player: bool = false
var phase_t: int = 0
var p2shown: bool = false
var morgra_move: String = ""
var morgra_x: float = 0.0
var morgra_lane: float = 0.0
var morgra_hit: bool = false
var morgra_safe: Array[PackedFloat64Array] = []
var moon_used: bool = false
var morgra_cooldown: int = 0
