class_name BmkActorState
extends RefCounted
## Source field names stay recognizable during the line-by-line migration.
var id: int = 0
var lock_id: int = 0
var hit_direction: int = 1
var species: String = ""
var d: BmkEnemyStats
var x: float = 200.0
var y: float = 430.0
var z: float = 0.0
var vx: float = 0.0
var vz: float = 0.0
var face: int = 1
var hw: float = 16.0
var hp: float = 100.0
var max_hp: float = 100.0
var lives: int = 3
var st: String = "free"
var t: int = 0
var atk: String = ""
var combo: int = 0
var combo_t: int = 0
var buf: float = 0.0
var x0: float = 80.0
var inv: int = 0
var flash: int = 0
var buff: int = 0
var score: int = 0
var walk: bool = false
var walk_time: float = 0.0
var sp: float = 0.0
var dash_cd: int = 0
var dash_grace: int = 0
var mg: int = 0
var cast_fired: bool = false
var skill: String = ""
var skill_cd: Dictionary[String, float] = {}
var skill_hits: Dictionary[String, bool] = {}
var skill_dest: float = 0.0
var hit_set: Dictionary[int, bool] = {}
var hurt_kind: String = "hurt_high"
var hurt_duration: int = 17
var hurt_ends: PackedFloat64Array = PackedFloat64Array()
var hurt_t: int = 0
var sp_target: BmkActorState
var sp_x: float = 0.0
var sp_y: float = 0.0
var sp_x0: float = 0.0
var sp_y0: float = 0.0
var sp_hits: int = 0
var sp_fin: bool = false
var sp_dash: bool = false
var dash_attack_hit: bool = false
var dash_flash: bool = false
var smash: bool = false
var wait: float = 20.0
var attack_cd: float = 40.0
var recovery_t: int = 30
var chain_n: int = 0
var hit_low: bool = false
var red_flash: int = 0
var getup: bool = false
var pat: String = ""
var remove: bool = false
var training: bool = false
var invulnerable: bool = false
var hr: float = 9999.0
var mv: BmkEnemyMove
var mv_t: int = 0
var mv_f: int = 0
var mv_hit: bool = false
var mv_used: Dictionary[int, bool] = {}
var bump_active: bool = false
var bump_set: Dictionary[int, bool] = {}
var bump_damage: float = 0.0
var enter_to: float = 0.0
var enter_speed: float = 1.0
var alpha: float = 1.0
var bolted: bool = false
# Player character (game.js newPlayer characterId) and viesa-runtime.js player fields.
var character_id: String = "barel"
var w: float = 26.0
var jump_time: int = 0
var viesa_action: BmkViesaAction
var viesa_clip: String = ""
var viesa_fired: bool = false
var viesa_shot_queued: bool = false
var viesa_hover_grace: int = 0
var viesa_air_p_used: bool = false
var viesa_landing: String = ""

func is_viesa() -> bool:
	return character_id == "viesa"

func hurt_index() -> int:
	for i: int in range(hurt_ends.size()):
		if t < hurt_ends[i]:
			return i
	return 5 if not hurt_ends.is_empty() else 0
