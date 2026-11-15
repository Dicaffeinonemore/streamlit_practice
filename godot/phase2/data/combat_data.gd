class_name BmkCombatData
extends Resource
## All exported balance values are generated from the source oracle capture.
@export var source_hash: String = ""
@export var ground_speed: float = 0.0
@export var air_speed: float = 0.0
@export var depth_ratio: float = 0.0
@export var jump_velocity: float = 0.0
@export var gravity: float = 0.0
@export var buffer_ms: float = 0.0
@export var link_ms: float = 0.0
@export var active_ratio: float = 0.0
@export var active_tail: float = 0.0
@export var cancel_ratio: float = 0.0
@export var hurt_ticks: int = 0
@export var hurt_inv: int = 0
@export var hurt_speed: float = 0.0
@export var hurt_decay: float = 0.0
@export var hurt_stop: int = 0
@export var down_velocity: float = 0.0
@export var down_speed: float = 0.0
@export var down_decay: float = 0.0
@export var down_ticks: int = 0
@export var down_inv: int = 0
@export var down_stop: int = 0
@export var dash_distance: float = 0.0
@export var dash_duration: float = 0.0
@export var dash_move_ms: float = 0.0
@export var dash_cancel_ms: float = 0.0
@export var dash_inv: int = 0
@export var dash_cd: int = 0
@export var dash_attack_ends: PackedInt32Array = PackedInt32Array()
@export var dash_attack_segments: Array[PackedFloat64Array] = []
@export var dash_attack_from: int = 0
@export var dash_attack_to: int = 0
@export var dash_attack_cancel: int = 0
@export var dash_skill_cancel: int = 0
@export var dash_grace: int = 0
@export var dash_damage_ratio: float = 0.0
@export var dash_sp: float = 0.0
@export var dash_attack_stop: int = 0
@export var dash_body_height: float = 0.0
@export var dash_box: Rect2 = Rect2()
@export var dash_front: float = 0.0
@export var dash_reach: float = 0.0
@export var dash_bottom: float = 0.0
@export var dash_top: float = 0.0
@export var dash_depth: float = 0.0
@export var dash_tip_height: float = 0.0
@export var skill_end_inv: int = 0
@export var attacks: Array[BmkAttackData] = []
@export var skills: Array[BmkAttackData] = []
@export var grades: Array[BmkGradeData] = []
@export var enemy_stats: Array[BmkEnemyStats] = []
@export var enemy_moves: Array[BmkEnemyMove] = []
@export var tier_by_attack: Dictionary[String, String] = {}
@export var chain_cap: int = 0
@export var knockdown_speed: float = 0.0
@export var bump_min: float = 0.0
@export var bump_damage: float = 0.0
@export var bump_knockback: float = 0.0
@export var bump_dx: float = 0.0
@export var bump_dy: float = 0.0
@export var enemy_hurt_ticks: int = 0
@export var enemy_depth: float = 0.0
@export var enemy_height: float = 0.0
@export var getup_lengths: PackedInt32Array = PackedInt32Array()
@export var after_getup: int = 0
@export var special_duration: float = 0.0
@export var special_slash: float = 0.0
@export var special_finisher: float = 0.0
@export var special_from: float = 0.0
@export var special_interval: float = 0.0
@export var special_hits: PackedFloat64Array = PackedFloat64Array()
@export var special_finish_ms: float = 0.0
@export var magic_duration: float = 0.0
@export var magic_fire: float = 0.0
@export var magic_damage: float = 0.0
@export var hurt_high_weights: PackedFloat64Array = PackedFloat64Array()
@export var hurt_low_weights: PackedFloat64Array = PackedFloat64Array()

func attack(id: String) -> BmkAttackData:
	for value: BmkAttackData in attacks:
		if value.id == id:
			return value
	return null

func skill(id: String) -> BmkAttackData:
	for value: BmkAttackData in skills:
		if value.id == id:
			return value
	return null

func stats(id: String) -> BmkEnemyStats:
	for value: BmkEnemyStats in enemy_stats:
		if value.id == id:
			return value
	return null

func enemy_move(id: String, clip: String) -> BmkEnemyMove:
	for value: BmkEnemyMove in enemy_moves:
		if value.species == id and value.clip == clip:
			return value
	return null

func grade(id: String, kd: bool, kind: int) -> BmkGradeData:
	var name_: String = tier_by_attack.get(id, "heavy" if kd or kind >= 2 else "light")
	for value: BmkGradeData in grades:
		if value.id == name_:
			return value
	return grades[0]
