class_name BmkSimulation
extends RefCounted
signal sound_requested(key: String, variant: int)
signal impact_requested(x: float, y: float, height: float, kind: int)
signal step_completed
## AUDIO.music / bossMusic / victoryMusic ('stage', 'boss', 'victory', 'ending') or AUDIO.stop(fade) as 'stop'.
signal music_requested(track: String, fade: float)
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
## Phase 11: sound and music requests in source order, as the oracles log AUDIO calls:
## ['sfx', key, variant], ['music', track], ['stop', fade]. The clock clears it before each step.
var audio_log: Array = []
var lane_flash_ids: Dictionary[int, bool] = {}
var sp_full: bool = false
var fixed_random: bool = false
var game_over: bool = false
## Story continue (game.js offerContinue): when the owner allows it, losing the last life stops the
## run with continue_pending instead of game_over, and the game asks CONTINUE? for 10 s.
var continue_offer: bool = false
var continue_pending: bool = false
var stage_driver: Callable
var jump_phase: String = ""
var jump_phase_ticks: int = 0
var was_airborne: bool = false
var landing_tick: int = -1
var hazard_seq: int = 0

func next_hazard_seq() -> int:
	hazard_seq += 1
	return hazard_seq

## aurelion-runtime.js reactAurelionAttack(): called when the player starts an attack.
func react_attack() -> void:
	pass

## vargul-runtime.js strikeVargulOrbs(reach, behind, hitSet, options); only Stage 4 has orbs.
## hit_set keys are ints (-100000 - orb seq) or key_prefix + seq for String-keyed sets.
func strike_orbs(_reach: float, _behind: float, _hit_set: Dictionary, _key_prefix: String = "", _options: Dictionary = {}) -> bool:
	return false

## sovereign-runtime.js strikeSovereignFists(reach, behind, hitSet, options); only Stage 5 has fists.
## true = a fist in front of the body (or the iron wall) took the strike; the body is skipped.
func strike_fists(_reach: float, _behind: float, _hit_set: Dictionary, _key_prefix: String = "", _options: Dictionary = {}) -> bool:
	return false

## isSovereign(e): strikes blocked by a fist skip the Sovereign's body.
func is_sovereign(_e: BmkActorState) -> bool:
	return false

## morgra-runtime.js strikeMorgraCrows(reach, behind, origin); only Stage 2 has crows.
func strike_crows(_reach: float, _behind: float, _x: float, _y: float, _z: float, _face: int) -> void:
	pass

## game.js playerBodyHeight(): Viesa 81; Barel 90, or the low-hurt box while crouched.
func player_body_height() -> float:
	var p: BmkActorState = player
	if p.is_viesa(): return 90.0 * 0.9
	if p.st != "hurt" or p.hurt_kind != "hurt_low" or p.hurt_ends.is_empty(): return 90.0
	return 84.919114 if [7,8,9,10,11,12][p.hurt_index()] <= 10 else 90.0

func player_impact_height(low: float, high: float) -> float:
	return (maxf(player.z,low) + minf(player.z + player_body_height(),high)) / 2.0

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
	audio_log.append(["sfx", key, variant])
	sound_requested.emit(key, variant)

## game.js playerHitSfx(kind, sound): 'none' is silent. Viesa plays 'hit' only where her
## attack has no sound of its own; Barel plays the given sound, his skill sample or swordHit.
func player_hit_sound(kind: int, hit: String = "") -> void:
	if hit == "none": return
	var p: BmkActorState = player
	if p.is_viesa():
		if BmkViesaController.default_hit_sound(p): sound("hit", kind)
		return
	var skill_sound: String = str({"redwave":"barelWave","slam":"barelSlam","leap":"barelSlam"}.get(p.skill, "")) if p.st == "skill" else ""
	sound(hit if not hit.is_empty() else (skill_sound if not skill_sound.is_empty() else "swordHit"), kind)

## AUDIO.music(i) = 'stage', bossMusic = 'boss', victoryMusic = 'victory' / 'ending', AUDIO.stop(fade) = 'stop'.
func music(track: String, fade: float = 0.0) -> void:
	audio_log.append(["stop", fade] if track == "stop" else ["music", track])
	music_requested.emit(track, fade)

## Returns and clears the requests logged since the last call (parity tests).
func take_audio() -> Array:
	var out: Array = audio_log
	audio_log = []
	return out

func impact(x: float, y: float, height: float, kind: int = 0) -> void:
	impact_requested.emit(x, y, height, kind)

func ground_smash(x: float, y: float) -> void:
	shake = maxf(shake, 10.0)
	impact(x, y, 8.0, 2)
	player_hit_sound(2)

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
		update_wave(z)
	for i: int in range(hazards.size() - 1, -1, -1):
		if hazards[i].dead:
			hazards.remove_at(i)

## One Barel red wave (game.js 'pwave' hazard) after its age has advanced.
func update_wave(z: BmkProjectileState) -> void:
		strike_orbs(23.0, 23.0, z.orb_hits, "", {"x":z.x,"y":z.y,"h":z.height - 44.0,"face":z.direction,"depth":26.0,"damage":z.damage,"hitSound":"barelWave"})
		var blocked: bool = strike_fists(23.0, 23.0, z.orb_hits, "", {"x":z.x,"y":z.y,"h":z.height - 44.0,"face":z.direction,"depth":26.0,"damage":z.damage,"hitSound":"barelWave"})
		var from: float = z.x
		var distance: float = minf(9.0, 520.0 - z.travel)
		z.x += z.direction * distance
		z.travel += distance
		for e: BmkActorState in enemies:
			if not combat.can_hit(e) or z.hits.has(e.id) or blocked and is_sovereign(e) or absf(e.y - z.y) >= 26.0 or absf(e.z + 44.0 - z.height) >= 38.0 or e.x + e.hw < minf(from, z.x) - 14.0 or e.x - e.hw > maxf(from, z.x) + 14.0:
				continue
			z.hits[e.id] = true
			# game.js: damageEnemy(e, z.damage, false, 1, false, 'redwave', 'barelWave'), also after the skill ends.
			combat.damage_enemy(self, e, z.damage, false, 1, false, "redwave", "barelWave")
			player.sp = minf(100.0, player.sp + 4.0)
		if z.travel >= 520.0:
			z.dead = true
