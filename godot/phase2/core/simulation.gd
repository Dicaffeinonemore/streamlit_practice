class_name BmkSimulation
extends RefCounted
signal sound_requested(key: String, variant: int)
signal impact_requested(x: float, y: float, height: float, kind: int)
signal step_completed
const MS: float = 1000.0 / 60.0
var data: BmkCombatData
var input: BmkInputRouter = BmkInputRouter.new()
var player: BmkActorState = BmkActorState.new()
var enemies: Array[BmkActorState] = []
var hazards: Array[BmkProjectileState] = []
var combat: BmkCombatResolver = BmkCombatResolver.new()
var player_controller: BmkPlayerController = BmkPlayerController.new()
var enemy_controller: BmkEnemyController = BmkEnemyController.new()
var tick: int = 0
var hit_stop: int = 0
var shake: float = 0.0
var flash_t: float = 0.0
var chain_n: int = 0
var chain_t: float = 0.0
var chain_max: int = 0
var stat_ticks: int = 0
var stat_damage: float = 0.0
var stat_deaths: int = 0
var stat_kills: int = 0
var cam_x: float = 0.0
var stage_length: float = 1518.0
var walk_top: float = 340.0
var slow_request: float = 0.0
var next_id: int = 1
var last_hit_id: int = 0
var last_tier: String = ""
var lane_flash_ticks: int = 0
var lane_flash_ids: Dictionary[int, bool] = {}
var sp_full: bool = false
var fixed_random: bool = false
var game_over: bool = false
var stage_driver: Callable
var jump_phase: String = ""
var jump_phase_ticks: int = 0
var was_airborne: bool = false
var landing_tick: int = -1

func _init(config: BmkCombatData = null) -> void:
	if config != null:
		configure(config)

func configure(config: BmkCombatData) -> void:
	data = config
	input.buffer_ms = data.buffer_ms
	player.hurt_duration = data.hurt_ticks
	for skill: BmkAttackData in data.skills:
		player.skill_cd[skill.id] = 0.0

func random_between(a: float, b: float) -> float:
	return (a + b) * 0.5 if fixed_random else randf_range(a, b)

static func js_round(value: float) -> int:
	return int(floor(value + 0.5))

static func ease(value: float) -> float:
	var u: float = clampf(value, 0.0, 1.0)
	return u * u * (3.0 - 2.0 * u)

func spawn(species: String, x: float, y: float) -> BmkActorState:
	var e: BmkActorState = BmkActorState.new()
	e.id = next_id
	next_id += 1
	e.species = species
	e.d = data.stats(species)
	e.x = x
	e.y = y
	e.face = -1
	e.hw = e.d.half_width
	e.hp = e.d.hp
	e.max_hp = e.hp
	e.st = "chase"
	e.wait = random_between(0.0, 40.0)
	e.attack_cd = random_between(20.0, 60.0)
	enemies.append(e)
	return e

func sound(key: String, variant: int = 0) -> void:
	sound_requested.emit(key, variant)

func impact(x: float, y: float, height: float, kind: int = 0) -> void:
	impact_requested.emit(x, y, height, kind)

func ground_smash(x: float, y: float) -> void:
	shake = maxf(shake, 10.0)
	impact(x, y, 8.0, 2)
	sound("swordHit", 2)

func step() -> bool:
	# Source update(): statistics and screen flash advance even during hitstop.
	tick += 1
	stat_ticks += 1
	if flash_t > 0.0:
		flash_t -= MS
	if hit_stop > 0:
		hit_stop -= 1
		return false
	if chain_t > 0.0:
		chain_t -= MS
		if chain_t <= 0.0:
			chain_n = 0
	if shake > 0.0:
		shake *= 0.85
	player_controller.step(self)
	observe_jump()
	if stage_driver.is_valid():
		stage_driver.call()
	for e: BmkActorState in enemies:
		enemy_controller.step(self, e)
	for i: int in range(enemies.size() - 1, -1, -1):
		if enemies[i].remove:
			enemies.remove_at(i)
	update_hazards()
	input.age_processed_step()
	step_completed.emit()
	return true

func observe_jump() -> void:
	var ordinary: bool = player.st == "free" or player.st == "atk" and player.atk == "air"
	if not ordinary:
		jump_phase = ""
		jump_phase_ticks = 0
		was_airborne = false
		landing_tick = -1
		return
	var airborne: bool = player.z > 0.0 or player.vz > 0.0
	if airborne:
		var phase: String = "prejump" if player.z == 0.0 and player.vz > 0.0 else ("riseFast" if player.vz > 4.0 else ("riseSlow" if player.vz > 1.0 else ("apex" if player.vz >= -2.0 else "fall")))
		jump_phase_ticks = jump_phase_ticks + 1 if phase == jump_phase else 0
		jump_phase = phase
		landing_tick = -1
	else:
		jump_phase = ""
		jump_phase_ticks = 0
		if was_airborne:
			landing_tick = player.t
		elif landing_tick >= 0 and (player.t < landing_tick or player.t - landing_tick >= 6):
			landing_tick = -1
	was_airborne = airborne

func update_hazards() -> void:
	for z: BmkProjectileState in hazards:
		z.age += MS
		var from: float = z.x
		var distance: float = minf(9.0, 520.0 - z.travel)
		z.x += z.direction * distance
		z.travel += distance
		for e: BmkActorState in enemies:
			if not combat.can_hit(e) or z.hits.has(e.id) or absf(e.y - z.y) >= 26.0 or absf(e.z + 44.0 - z.height) >= 38.0 or e.x + e.hw < minf(from, z.x) - 14.0 or e.x - e.hw > maxf(from, z.x) + 14.0:
				continue
			z.hits[e.id] = true
			combat.damage_enemy(self, e, z.damage, false, 1, false, "redwave")
			player.sp = minf(100.0, player.sp + 4.0)
		if z.travel >= 520.0:
			z.dead = true
	for i: int in range(hazards.size() - 1, -1, -1):
		if hazards[i].dead:
			hazards.remove_at(i)
