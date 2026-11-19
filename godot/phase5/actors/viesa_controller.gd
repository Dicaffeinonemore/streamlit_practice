class_name BmkViesaController
extends BmkStagePlayer
## Viesa: game.js updPlayer() Viesa branches plus viesa-runtime.js, ported line by line.
## Shared player rules (timers, grabs, cast, hurt/down/dead, clamping, items) follow game.js.

const MELEE: Array[String] = ["slash1","slash2","kick"]
const SKILL_KEYS: Dictionary[String, String] = {"KeyU":"thrust","KeyH":"slam","KeyO":"whirl","KeyP":"leap","KeyL":"redwave"}
const SKILL_CLIPS: Dictionary[String, String] = {"thrust":"rapid_start","slam":"slash1","whirl":"dash_slash","leap":"dash_slash","redwave":"snipe_draw"}
const RAPID_SHOTS: Array[int] = [0,9,18,27,36,45]
## VIESA_CHARGE (모아 쏘기): draw frames 1-7, then hold frame 7; +4 damage per level, max 3.
const CHARGE_DRAW: int = 21
const CHARGE_LEVEL: int = 20
const CHARGE_MAX: int = 3
const CHARGE_BONUS: float = 4.0
const CHARGE_HOLD: int = 45
const MELEE_ACTIVE: Dictionary[String, Vector2i] = {"slash1":Vector2i(2,3),"slash2":Vector2i(3,5),"kick":Vector2i(1,4)}
var art: BmkViesaData

func _init(data: BmkViesaData = null) -> void:
	art = data if data != null else BmkViesaData.shared()

## newPlayer(score,'viesa'): body scale .9, HP 80.
static func configure_player(p: BmkActorState, data: BmkViesaData) -> void:
	p.character_id = "viesa"
	p.w = data.player_value("w")
	p.hw = data.player_value("hw")
	p.max_hp = data.player_value("max")
	p.hp = minf(p.hp, p.max_hp)
	clear_viesa(p)

static func clear_viesa(p: BmkActorState) -> void:
	p.viesa_action = null
	p.viesa_clip = ""
	p.viesa_fired = false
	p.viesa_shot_queued = false
	p.viesa_hover_grace = 0
	p.viesa_air_p_used = false
	p.viesa_landing = ""
	p.running = false
	p.jump_time = 0

func world(s: BmkSimulation) -> BmkViesaWorld:
	return (s as BmkStageSimulation).viesa

func rnd(s: BmkSimulation) -> float:
	return 0.5 if s.fixed_random else randf()

func c1(s: BmkSimulation) -> BmkAttackData:
	return s.data.attack("c1")

func step(sim: BmkSimulation) -> void:
	var s: BmkStageSimulation = sim as BmkStageSimulation
	var p: BmkActorState = s.player
	var d: BmkCombatData = s.data
	var input: BmkInputRouter = s.input
	if p.inv > 0: p.inv -= 1
	if p.flash > 0: p.flash -= 1
	if p.buff > 0: p.buff -= 1
	if p.buf > 0.0: p.buf -= MS
	if p.dash_cd > 0: p.dash_cd -= 1
	if p.dash_grace > 0: p.dash_grace -= 1
	for id: String in p.skill_cd:
		if p.skill_cd[id] > 0.0: p.skill_cd[id] = maxf(0.0, p.skill_cd[id] - MS)
	if p.sp >= 100.0:
		if not s.sp_full:
			s.sp_full = true
			p.flash = maxi(p.flash, 3)
			s.sound("spready")
	else:
		s.sp_full = false
	if s.lane_flash_ticks > 0: s.lane_flash_ticks -= 1
	if p.st == "grabbed":
		update_grab(s)
		return
	var was_walking: bool = p.walk
	p.walk = false
	if viesa_input(s): return
	var dash_cancelable: bool = p.st == "free" or p.st == "atk"
	if p.dash_cd <= 0 and p.z == 0.0 and dash_cancelable and input.hit(["ShiftLeft"]):
		input.dash_request = p.face
	if input.dash_request != 0:
		var direction: int = input.dash_request
		input.dash_request = 0
		if p.dash_cd <= 0 and p.z == 0.0 and dash_cancelable: start_dash(s, direction)
	# Gravity. Air shots and the post-shot hover grace fall slowly.
	if not controls_height(p) and (p.z > 0.0 or p.vz != 0.0):
		p.jump_time += 1
		var air_shooting: bool = p.st == "atk" and p.viesa_clip == "jump_shot" or p.st == "free" and p.viesa_hover_grace > 0
		p.z += p.vz
		p.vz = maxf(-1.6, p.vz - 0.08) if air_shooting else p.vz - d.gravity
		if p.z <= 0.0:
			p.z = 0.0
			p.vz = 0.0
			p.jump_time = 0
			viesa_landing(s)
	if p.st != "free" and p.st != "dash": p.running = false
	match p.st:
		"free":
			var ax: int = int(input.down(["ArrowRight", "KeyD"])) - int(input.down(["ArrowLeft", "KeyA"]))
			var ay: int = int(input.down(["ArrowDown", "KeyS"])) - int(input.down(["ArrowUp", "KeyW"]))
			if p.running and (p.z > 0.0 or ax != p.face): p.running = false
			var speed: float = (d.air_speed if p.z > 0.0 else d.ground_speed) * 1.1 * (RUN_SPEED if p.running else 1.0)
			p.x += ax * speed
			p.y += ay * speed * d.depth_ratio
			if ax != 0: p.face = ax
			p.walk = ax != 0 or ay != 0
			p.walk_time = (p.walk_time + MS if was_walking else 0.0) if p.walk and p.z == 0.0 else 0.0
			p.t += 1
			if p.combo_t > 0: p.combo_t -= 1
			if p.z == 0.0 and input.hit(JUMP):
				p.vz = d.jump_velocity
				s.sound("jump")
			if p.mg > 0 and p.z == 0.0 and input.hit(["KeyI", "KeyV"]):
				start_cast(s)
			elif input.hit(["KeyJ"]):
				start_viesa_attack(s, p.z > 0.0)
		"atk":
			p.t += 1
			update_viesa_attack(s)
		"dash":
			p.t += 1
			var t: float = p.t * MS
			p.x = p.x0 + p.face * d.dash_distance * 1.15 * s.ease(minf(1.0, t / d.dash_move_ms))
			p.inv = maxi(p.inv, 2)
			if t >= d.dash_cancel_ms and input.hit(["KeyJ"]):
				start_viesa_attack(s, false)
			elif t >= d.dash_duration:
				p.st = "free"
				p.t = 0
				p.dash_grace = 0
				p.running = int(input.down(["ArrowRight", "KeyD"])) - int(input.down(["ArrowLeft", "KeyA"])) == p.face
		"special":
			p.t += 1
			update_ultimate(s)
		"skill":
			p.t += 1
			update_action(s)
		"cast":
			p.t += 1
			if not p.cast_fired and p.t * MS >= d.magic_fire: fire_magic(s)
			if p.t * MS >= d.magic_duration:
				p.st = "free"
				p.t = 0
		"hurt":
			p.x += p.vx
			p.vx *= d.hurt_decay
			p.t += 1
			if p.t >= d.hurt_ticks:
				p.st = "free"
				p.t = 0
		"down":
			p.t += 1
			p.x += p.vx
			p.vx *= d.down_decay
			if p.t > d.down_ticks and p.z == 0.0:
				p.st = "free"
				p.t = 0
				p.inv = d.down_inv
		"dead":
			p.t += 1
			p.x += p.vx
			p.vx *= 0.96
			if p.t > 100:
				if p.lives > 0:
					p.st = "free"
					p.t = 0
					p.hp = p.max_hp
					p.inv = 150
					p.z = 0.0
					p.vz = 0.0
					p.x = s.cam_x + 100.0
					p.y = 420.0
				else:
					s.game_over = true
	p.x = clampf(p.x, s.cam_x + 20.0, minf(s.cam_x + 620.0, s.stage_length - 20.0))
	p.y = clampf(p.y, s.walk_top + 10.0, 500.0)
	collect_items(s)

func start_cast(s: BmkSimulation) -> void:
	var p: BmkActorState = s.player
	aim(s)
	p.st = "cast"
	p.t = 0
	p.mg -= 1
	p.cast_fired = false
	p.combo = 0
	p.buf = 0.0
	p.vx = 0.0
	p.inv = maxi(p.inv, 48)
	s.react_attack()
	s.sound("mcharge")

# ------------------------------------------------------------------ input and skills
func viesa_input(s: BmkSimulation) -> bool:
	var p: BmkActorState = s.player
	if p.z == 0.0 and p.st != "skill": p.viesa_air_p_used = false
	if p.st == "free" and p.viesa_hover_grace > 0: p.viesa_hover_grace -= 1
	if p.st == "free" and p.z == 0.0 and p.sp >= 100.0 and s.input.hit(["KeyK"]): return begin_special(s)
	for code: String in ["KeyU","KeyL","KeyO","KeyP"]:
		var id: String = SKILL_KEYS[code]
		if can_start_skill(s, id) and s.input.hit([code]): return start_skill_id(s, id)
	if p.z == 0.0 and not (p.st == "atk" and p.viesa_clip in MELEE) and can_start_skill(s, "slam") and s.input.hit(["KeyH"]):
		return start_skill_id(s, "slam")
	return false

func can_start_skill(s: BmkSimulation, id: String) -> bool:
	var p: BmkActorState = s.player
	if not SKILL_CLIPS.has(id) or id != "slam" and p.skill_cd.get(id, 0.0) > 0.0 or (s as BmkStageSimulation).mode != "play": return false
	if p.z > 0.0 and (id != "leap" or p.viesa_air_p_used): return false
	if id == "slam" and p.st == "atk" and p.viesa_clip in MELEE: return true
	return p.st == "free" or p.st == "dash" and p.t * MS >= 110.0 or p.st == "atk" and p.t >= 16 or id == "leap" and p.st == "skill" and p.viesa_action != null and p.viesa_action.phase == "hover"

func begin_action(s: BmkSimulation, phase: String, id: String = "", high: bool = false) -> void:
	var p: BmkActorState = s.player
	aim(s)
	p.st = "skill"
	p.t = 0
	p.vx = 0.0
	p.skill = id
	p.combo = 0
	p.combo_t = 0
	p.buf = 0.0
	p.hit_set.clear()
	p.viesa_hover_grace = 0
	var a: BmkViesaAction = BmkViesaAction.new()
	a.phase = phase
	a.id = id
	a.x0 = p.x
	a.face = p.face
	a.high = high
	a.h0 = p.z
	p.viesa_action = a
	s.react_attack()

func begin_special(s: BmkSimulation) -> bool:
	var p: BmkActorState = s.player
	if p.st != "free" or p.z > 0.0 or p.sp < 100.0: return false
	begin_action(s, "ult_leap")
	p.st = "special"
	p.sp = 0.0
	p.vz = 0.0
	s.sound("viesaUltimate")
	return true

func start_skill_id(s: BmkSimulation, id: String) -> bool:
	var p: BmkActorState = s.player
	if not can_start_skill(s, id): return false
	if id == "slam":
		if p.st == "atk" and p.viesa_clip in MELEE: p.buf = s.data.buffer_ms
		else: start_melee(s, p.combo + 1 if p.combo_t > 0 and p.combo < 2 else 0)
		return true
	var phase: String = SKILL_CLIPS[id]
	begin_action(s, phase, id, id == "leap")
	p.skill_cd[id] = art.skill_cooldown(id)
	p.vz = 0.0
	if id == "leap": p.viesa_air_p_used = true
	if phase == "dash_slash": p.inv = maxi(p.inv, 2)
	return true

func next_phase(p: BmkActorState, phase: String) -> void:
	p.viesa_action.phase = phase
	p.viesa_action.x0 = p.x
	p.viesa_action.h0 = p.z
	p.t = 0

func finish(p: BmkActorState) -> void:
	p.st = "free"
	p.t = 0
	p.skill = ""
	p.viesa_action = null
	p.combo_t = 0
	p.vz = 0.0

func controls_height(p: BmkActorState) -> bool:
	return p.st == "special" or p.st == "skill" and p.viesa_action != null and p.viesa_action.phase in ["dash_slash","backflip","hover"]

# ------------------------------------------------------------------ bow and melee
func start_viesa_attack(s: BmkSimulation, air: bool) -> void:
	var p: BmkActorState = s.player
	p.st = "atk"
	p.t = 0
	p.buf = 0.0
	p.hit_set.clear()
	p.x0 = p.x
	p.viesa_fired = false
	p.viesa_shot_queued = false
	p.viesa_action = null
	p.combo = 0
	p.combo_t = 0
	p.viesa_hover_grace = 0
	p.viesa_clip = "jump_shot" if air else "shot"
	p.atk = "air" if air else "c1"
	# Repeated air shots keep falling instead of restarting a hover each shot.
	if air: p.vz = clampf(p.vz, -1.6, -0.25)
	s.react_attack()

func start_melee(s: BmkSimulation, n: int) -> void:
	var p: BmkActorState = s.player
	start_viesa_attack(s, false)
	p.combo = n
	p.viesa_clip = MELEE[n]
	p.atk = ["c1","c2","c3"][n]
	s.sound("swing", n)

func update_viesa_attack(s: BmkSimulation) -> void:
	var p: BmkActorState = s.player
	if p.viesa_clip == "jump_shot" and p.z <= 0.0:
		p.st = "free"
		p.t = 0
		p.viesa_shot_queued = false
		viesa_landing(s)
		return
	var name_: String = p.viesa_clip
	var frame: int = p.t / 4 + 1
	# The ten-frame jump shot plays frames 4-10 in 20 ticks (pose()).
	var duration: int = 20 if name_ == "jump_shot" else art.clip_length(name_) * 4
	var shooting: bool = name_ == "shot" or name_ == "jump_shot"
	var queue_key: Array[String] = ["KeyH"]
	if shooting: queue_key = ["KeyJ"]
	if s.input.hit(queue_key):
		if shooting: p.viesa_shot_queued = true
		else: p.buf = s.data.buffer_ms
	if shooting:
		if frame >= 4 and not p.viesa_fired:
			p.viesa_fired = true
			fire_arrow(s, name_ == "jump_shot")
		if p.viesa_shot_queued and frame >= 5:
			start_viesa_attack(s, name_ == "jump_shot")
			return
	else:
		var window: Vector2i = MELEE_ACTIVE[name_]
		var active: bool = frame >= window.x and frame <= window.y
		if active:
			var ratio: float = {"slash1":0.9,"slash2":1.0,"kick":1.2}[name_]
			player_strike(s, s.js_round(c1(s).damage * ratio), c1(s).reach, name_ == "kick", 2 if name_ == "kick" else 1, 1.3 if name_ == "kick" else 1.0, "viesaMelee")
		if p.buf > 0.0 and p.combo < 2 and p.t >= 16:
			start_melee(s, p.combo + 1)
			return
	if p.t >= duration:
		var combo: bool = name_ in MELEE
		p.st = "free"
		p.t = 0
		p.combo_t = s.js_round(s.data.link_ms / MS) if combo and p.combo < 2 else 0
		if p.buf > 0.0 and combo and p.combo < 2: start_melee(s, p.combo + 1)
		elif p.viesa_shot_queued and shooting: start_viesa_attack(s, name_ == "jump_shot")
		elif p.combo == 2: p.combo = 0
		if name_ == "jump_shot" and p.st == "free": p.viesa_hover_grace = 6

## game.js playerStrike() with Viesa's push scale.
func player_strike(sim: BmkSimulation, damage: float, reach: float, kd: bool, fx: int, push_scale: float, id: String) -> void:
	var s: BmkStageSimulation = sim as BmkStageSimulation
	var p: BmkActorState = s.player
	var mul: float = 1.5 if p.buff > 0 else 1.0
	s.strike_crows(reach, 0.0, p.x, p.y, p.z, p.face)
	s.strike_orbs(reach, 8.0, p.hit_set, "", {"damage":s.js_round(damage * mul)})
	var blocked: bool = s.strike_fists(reach, 8.0, p.hit_set, "", {"damage":s.js_round(damage * mul),"kd":kd})
	for e: BmkActorState in s.enemies:
		if not s.combat.can_hit(e) or p.hit_set.has(e.id) or blocked and s.is_sovereign(e): continue
		if s.combat.in_reach(p, e, reach, 24.0, 55.0):
			p.hit_set[e.id] = true
			s.combat.damage_enemy(s, e, s.js_round(damage * mul), kd, fx, false, id)
			if push_scale != 1.0 and not (e as BmkStageActor).boss and e.hp > 0.0: e.vx *= push_scale
			p.sp = minf(100.0, p.sp + (8.0 if kd else 5.0))
	for b: BmkWorldItem in s.barrels:
		if b.gone or p.hit_set.has(b.id): continue
		if s.combat.in_reach(p, b, reach, 24.0, 55.0):
			p.hit_set[b.id] = true
			s.item_controller.damage_barrel(s, b)

func fire_arrow(sim: BmkSimulation, air: bool = false, snipe: bool = false, rapid: bool = false, paid_special: bool = false, lane_offset: float = 0.0, charge: int = 0) -> void:
	var s: BmkStageSimulation = sim as BmkStageSimulation
	var p: BmkActorState = s.player
	var vw: float = art.view_width()
	var range_: float = vw * 2.0 if snipe else vw / 3.0
	var speed: float = vw / 5.0 if snipe else range_ / 24.0
	var depth: float = 24 * 1.3
	var target: BmkActorState
	for e: BmkActorState in s.enemies:
		var ahead: float = (e.x - p.x) * p.face
		if not s.combat.can_hit(e) or ahead <= 0.0 or ahead > range_ or absf(e.y - p.y) > depth * 2.0: continue
		if target == null or absf(e.x - p.x) < absf(target.x - p.x): target = e
	var y: float = clampf(p.y + lane_offset, art.ground_top() + 1.0, art.ground_bottom())
	var mul: float = 1.5 if p.buff > 0 else 1.0
	var z: BmkViesaWorld.Arrow = BmkViesaWorld.Arrow.new()
	z.x = p.x + p.face * 26
	z.y = y
	z.h = p.z + art.world_height() * 0.6
	z.dir = p.face
	z.speed = speed
	z.vh = -speed * tan(PI / 6.0) if air else 0.0
	z.range_ = range_
	z.depth = depth
	z.aim_y = target.y if target != null and lane_offset == 0.0 else y
	z.start_y = y
	z.damage = s.js_round((c1(s).damage * 2.5 + CHARGE_BONUS * charge if snipe else (10.0 if rapid else 8.0)) * mul)
	z.snipe = snipe
	z.charge = charge
	z.rapid = rapid
	z.paid_special = paid_special
	z.seq = s.next_hazard_seq()
	world(s).arrows.append(z)
	s.sound("viesaSnipe" if snipe else "viesaArrow")

## updHazards(): Viesa's ultimate projectiles first, then her arrows (age += MS before each update).
func update_projectiles(s: BmkStageSimulation) -> void:
	update_ultimate_projectiles(s)
	var w: BmkViesaWorld = world(s)
	for z: BmkViesaWorld.Arrow in w.arrows:
		z.age += MS
		update_arrow(s, z)
	w.arrows = w.arrows.filter(func(z: BmkViesaWorld.Arrow) -> bool: return not z.dead)

func update_arrow(s: BmkStageSimulation, z: BmkViesaWorld.Arrow) -> void:
	if z.fading:
		z.fade_age += 1
		if z.fade_age >= 15: z.dead = true
		return
	var vw: float = art.view_width()
	if z.snipe and (z.x < s.cam_x or z.x > s.cam_x + vw):
		z.dead = true
		return
	var p: BmkActorState = s.player
	var from: float = z.x
	var remaining: float = maxf(0.0, minf(z.speed, s.cam_x + vw - z.x if z.dir > 0 else z.x - s.cam_x)) if z.snipe else minf(z.speed, z.range_ - z.travel)
	z.x += z.dir * remaining
	z.travel += remaining
	z.h += z.vh
	var age: int = floori(z.age / MS)
	if age <= 8: z.y = lerpf(z.start_y, z.aim_y, minf(1.0, age / 8.0))
	var previous: int = z.aux_hits.size()
	s.strike_orbs(absf(z.x - from), 0.0, z.aux_hits, "", {"x":from,"y":z.y,"h":z.h - 44.0,"face":z.dir,"depth":z.depth,"damage":z.damage,"kd":z.snipe})
	var blocked: bool = s.strike_fists(absf(z.x - from), 0.0, z.aux_hits, "", {"x":from,"y":z.y,"h":z.h - 44.0,"face":z.dir,"depth":z.depth,"damage":z.damage,"kd":z.snipe})
	s.strike_crows(absf(z.x - from), 0.0, from, z.y, z.h - 44.0, z.dir)
	if not z.snipe and (blocked or z.aux_hits.size() > previous):
		z.dead = true
		world(s).effect("hit_spark", z.x, z.y, z.h, p.face)
		return
	var low: float = minf(from, z.x) - 4.0
	var high: float = maxf(from, z.x) + 4.0
	var contacts: Array[BmkActorState] = []
	for e: BmkActorState in s.enemies:
		if s.combat.can_hit(e) and not z.hits.has(e.id) and not (blocked and s.is_sovereign(e)) and absf(e.y - z.y) < z.depth and z.h >= e.z - 5.0 and z.h <= e.z + maxf(80.0, e.d.height) and e.x + e.hw >= low and e.x - e.hw <= high:
			contacts.append(e)
	for b: BmkWorldItem in s.barrels:
		if not b.gone and not z.hits.has(b.id) and absf(b.y - z.y) < z.depth and z.h < 80.0 and b.x + b.hw >= low and b.x - b.hw <= high:
			contacts.append(b)
	stable_sort_by_distance(contacts, from)
	for e: BmkActorState in contacts:
		z.hits[e.id] = true
		if e is BmkWorldItem: s.item_controller.damage_barrel(s, e as BmkWorldItem)
		else:
			s.combat.damage_enemy(s, e, z.damage, z.snipe, 2 if z.snipe else 1, false, "viesaSkill" if z.snipe or z.rapid else "viesaArrow")
			if not z.paid_special: p.sp = minf(100.0, p.sp + 4.0)
		world(s).effect("hit_spark", e.x, z.y, z.h, p.face, 48, 48)
		if not z.snipe:
			z.x = e.x
			z.dead = true
			break
	if z.h < 0.0 or not z.snipe and z.travel >= z.range_: fade_arrow(z)
	if z.snipe and (z.x <= s.cam_x or z.x >= s.cam_x + vw) or z.age > 3500.0: z.dead = true

func fade_arrow(z: BmkViesaWorld.Arrow) -> void:
	if not z.fading:
		z.fading = true
		z.fade_age = 0

## Array.prototype.sort is stable; GDScript's sort_custom is not.
static func stable_sort_by_distance(list: Array[BmkActorState], from: float) -> void:
	for i: int in range(1, list.size()):
		var item: BmkActorState = list[i]
		var j: int = i - 1
		while j >= 0 and absf(list[j].x - from) > absf(item.x - from):
			list[j + 1] = list[j]
			j -= 1
		list[j + 1] = item

## Sweep the whole movement segment; each target takes dash damage only once.
func dash_strike(s: BmkSimulation, from: float, hits: Dictionary[int, bool]) -> void:
	var p: BmkActorState = s.player
	var reach: float = absf(p.x - from) + 20.0
	var damage: float = s.js_round(20 * (1.5 if p.buff > 0 else 1.0))
	s.strike_crows(reach, 20.0, from, p.y, p.z, p.face)
	s.strike_orbs(reach, 20.0, hits, "", {"x":from,"y":p.y,"h":p.z,"face":p.face,"depth":24.0,"damage":damage})
	var blocked: bool = s.strike_fists(reach, 20.0, hits, "", {"x":from,"y":p.y,"h":p.z,"face":p.face,"depth":24.0,"damage":damage,"kd":false})
	for e: BmkActorState in s.enemies:
		if not s.combat.can_hit(e) or hits.has(e.id) or blocked and s.is_sovereign(e): continue
		var dx: float = (e.x - from) * p.face
		if dx < -20.0 - e.hw or dx > reach + e.hw or absf(e.y - p.y) >= 24.0 or absf(e.z - p.z) >= 55.0: continue
		hits[e.id] = true
		s.combat.damage_enemy(s, e, damage, false, 1, false, "viesaSkill")
		p.sp = minf(100.0, p.sp + 5.0)

func update_action(s: BmkSimulation) -> void:
	var p: BmkActorState = s.player
	var a: BmkViesaAction = p.viesa_action
	if a == null:
		finish(p)
		return
	var vw: float = art.view_width()
	var phase: String = a.phase
	if a.id == "whirl": s.input.hit(["KeyJ"]) # O never queues a shot during its grounded sequence.
	match phase:
		"snipe_draw":
			a.held += 1
			if not s.input.down(["KeyL"]): a.released = true
			var level: int = mini(CHARGE_MAX, maxi(0, floori(float(a.held - CHARGE_DRAW) / CHARGE_LEVEL)))
			if level > a.charge:
				a.charge = level
				var bow: PackedFloat64Array = bow_position(s)
				world(s).effect("hit_spark", bow[0], bow[1], bow[2], p.face, 30 + 12 * level, 30 + 12 * level, 12)
			if a.held >= CHARGE_DRAW and (a.released or a.held >= CHARGE_DRAW + CHARGE_LEVEL * CHARGE_MAX + CHARGE_HOLD): next_phase(p, "snipe_release")
		"snipe_release":
			if p.t >= 6 and a.shots == 0:
				a.shots += 1
				fire_arrow(s, false, true, false, false, 0.0, a.charge)
			if p.t >= 24: finish(p)
		"rapid_start":
			if p.t >= 16: next_phase(p, "rapid_loop")
		"rapid_loop":
			if (p.t - 1) in RAPID_SHOTS and a.shots < 6:
				var lane: int = int(s.input.down(["ArrowDown","KeyS"])) - int(s.input.down(["ArrowUp","KeyW"]))
				fire_arrow(s, false, false, true, false, lane * 24 * 1.3)
				a.shots += 1
			if p.t >= 54: next_phase(p, "rapid_end")
		"rapid_end":
			if p.t >= 16: finish(p)
		"dash_slash":
			var previous_x: float = p.x
			p.x = a.x0 + a.face * (vw / 4.0) * minf(1.0, p.t / 16.0)
			p.z = a.h0
			p.vz = 0.0
			if p.t <= 16:
				p.inv = maxi(p.inv, 2)
				dash_strike(s, previous_x, a.dash_hits)
			var frame: int = p.t / 4 + 1
			if frame >= 5 and frame <= 6:
				player_strike(s, s.js_round(c1(s).damage * 1.6), c1(s).reach, true, 2, 1.0, "viesaSkill")
			if p.t >= 28:
				next_phase(p, "backflip")
				if a.high and a.h0 > 0.0:
					p.t = 4
					p.inv = maxi(p.inv, 1)
		"backflip":
			var frame: int = p.t / 4 + 1
			var u: float = clampf((p.t - 4) / 20.0 if a.high and a.h0 > 0.0 else p.t / 24.0, 0.0, 1.0)
			var height: float = art.world_height()
			p.x = a.x0 - a.face * (vw / 4.0 if a.high else vw / 3.0) * u
			p.vz = 0.0
			if a.high: p.z = a.h0 + height * 0.3 * sin(u * PI / 2.0) if a.h0 > 0.0 else height * sin(u * PI / 2.0)
			else: p.z = height * 0.5 * sin(PI * u)
			if frame >= 2 and frame <= 6: p.inv = maxi(p.inv, 1)
			if p.t >= 24:
				if a.high:
					next_phase(p, "hover")
					p.viesa_landing = "backflip"
				else:
					p.z = 0.0
					next_phase(p, "land_backflip")
					landing_dust(s)
		"hover":
			p.z += p.vz
			p.vz -= 0.55 * 0.25
			if p.z <= 0.0:
				p.z = 0.0
				p.vz = 0.0
				viesa_landing(s)
			elif s.input.hit(["KeyJ"]):
				start_viesa_attack(s, true)
			elif p.t >= 40:
				var falling: float = p.vz
				p.viesa_landing = "backflip"
				finish(p)
				p.vz = falling
		"land_backflip", "land_jump":
			if p.t >= 8:
				p.viesa_air_p_used = false
				p.viesa_landing = ""
				finish(p)

func landing_dust(s: BmkSimulation) -> void:
	world(s).effect("land_dust", s.player.x, s.player.y, 3, s.player.face, 65, 25, 20)

func viesa_landing(s: BmkSimulation) -> void:
	var p: BmkActorState = s.player
	p.viesa_air_p_used = false
	p.viesa_hover_grace = 0
	if p.st not in ["free","skill"]: return
	begin_action(s, "land_backflip" if p.viesa_landing == "backflip" else "land_jump")
	landing_dust(s)

# ------------------------------------------------------------------ ultimate: 흑월 난사
## viesaBowPosition() as [x, y, h] in doubles (Vector3 would round to 32-bit floats).
func bow_position(s: BmkSimulation) -> PackedFloat64Array:
	var p: BmkActorState = s.player
	var pose: Array = pose(s)
	var tip: Variant = art.tip(str(pose[0]), int(pose[1]))
	var tx: float = float(tip[0]) if tip != null else 40.0
	var th: float = float(tip[1]) if tip != null else 70.0
	return PackedFloat64Array([p.x + p.face * tx * art.scale(), p.y, p.z + th * art.scale()])

## V8 Math.hypot: scaled by the largest magnitude with compensated summation.
static func js_hypot(values: Array[float]) -> float:
	var largest: float = 0.0
	for v: float in values: largest = maxf(largest, absf(v))
	if largest == 0.0: return 0.0
	var sum: float = 0.0
	var compensation: float = 0.0
	for v: float in values:
		var n: float = absf(v) / largest
		var summand: float = n * n - compensation
		var preliminary: float = sum + summand
		compensation = (preliminary - sum) - summand
		sum = preliminary
	return sqrt(sum) * largest

func ult_projectile(sim: BmkSimulation, kind: String, cast: BmkViesaAction) -> void:
	var s: BmkStageSimulation = sim as BmkStageSimulation
	var p: BmkActorState = s.player
	var vw: float = art.view_width()
	var start: PackedFloat64Array = bow_position(s)
	var edge: float = s.cam_x + vw - 12.0 if p.face > 0 else s.cam_x + 12.0
	var living: Array[BmkActorState] = []
	for e: BmkActorState in s.enemies:
		if e.st != "dead" and not e.invulnerable and (e.x - p.x) * p.face >= 0.0 and e.x >= s.cam_x and e.x <= s.cam_x + vw: living.append(e)
	var tx: float = lerpf(p.x, edge, rnd(s))
	var ty: float = art.ground_top() + rnd(s) * (art.ground_bottom() - art.ground_top())
	var th: float = 15.0 + rnd(s) * (55.0 - 15.0)
	var giant: bool = kind == "giant"
	var target: BmkActorState
	if giant:
		var best: float = INF
		for e: BmkActorState in living:
			var distance: float = js_hypot([e.x - p.x, e.y - p.y])
			if distance < best:
				best = distance
				target = e
	elif rnd(s) < 0.6:
		var index: int = floori(rnd(s) * living.size())
		if index < living.size(): target = living[index]
	if target != null:
		tx = target.x + (0.0 if giant else -12.0 + rnd(s) * 24.0)
		ty = target.y
		th = 0.0 if giant else target.z + 40.0
	if giant and target == null:
		tx = clampf(p.x + p.face * vw * 0.4, s.cam_x + 12.0, s.cam_x + vw - 12.0)
		ty = p.y
		th = 0.0
	var z: BmkViesaWorld.UltObject = BmkViesaWorld.UltObject.new()
	z.kind = kind
	z.cast = cast
	z.sx = start[0]
	z.sy = start[1]
	z.sh = start[2]
	z.x = start[0]
	z.y = start[1]
	z.h = start[2]
	z.tx = tx
	z.ty = ty
	z.th = th
	z.face = p.face
	z.life = maxi(3, ceili(js_hypot([tx - start[0], ty - start[1], th - start[2]]) / (55.0 if giant else 75.0)))
	z.variant = floori(rnd(s) * 4)
	z.impact = kind == "phantom" and cast.arrows % 3 == 0
	z.damage = (160.0 if giant else 4.0) * (1.5 if p.buff > 0 else 1.0)
	world(s).ult.append(z)

func update_ultimate(s: BmkSimulation) -> void:
	var p: BmkActorState = s.player
	var a: BmkViesaAction = p.viesa_action
	if a == null:
		finish(p)
		return
	a.clock += 1
	p.vz = 0.0
	var height: float = art.world_height()
	match a.phase:
		"ult_leap":
			p.z = height * 1.2 * clampf((p.t - 12) / 12.0, 0.0, 1.0)
			if p.t >= 24: next_phase(p, "ult_summon")
		"ult_summon":
			if p.t >= 16: next_phase(p, "ult_barrage")
		"ult_barrage":
			for i: int in range(4):
				a.arrows += 1
				ult_projectile(s, "phantom", a)
			if p.t % 4 == 0: ult_projectile(s, "volley", a)
			if p.t >= 50: next_phase(p, "ult_final")
		"ult_final":
			if p.t >= 8 and not a.final_fired:
				a.final_fired = true
				ult_projectile(s, "giant", a)
				s.sound("bwave")
			if p.t >= 12: p.z = height * 1.2 * (1.0 - clampf((p.t - 12) / 4.0, 0.0, 1.0))
			if p.t >= 16 and not a.landed:
				a.landed = true
				landing_dust(s)
			if p.t >= 24:
				p.z = 0.0
				p.viesa_air_p_used = false
				finish(p)

func update_ultimate_projectiles(s: BmkStageSimulation) -> void:
	var w: BmkViesaWorld = world(s)
	var kept: Array[BmkViesaWorld.UltObject] = []
	var radius: float = art.world_height() * 1.2
	for z: BmkViesaWorld.UltObject in w.ult:
		z.age += 1
		var u: float = clampf(float(z.age) / z.life, 0.0, 1.0)
		z.x = lerpf(z.sx, z.tx, u)
		z.y = lerpf(z.sy, z.ty, u)
		z.h = lerpf(z.sh, z.th, u)
		if u < 1.0:
			kept.append(z)
			continue
		var giant: bool = z.kind == "giant"
		var blocked: bool = false
		if giant:
			w.effect("ult_explosion", z.tx, z.ty, 35, s.player.face, art.world_height() * 2.5, art.world_height() * 1.5, 28)
			s.shake = maxf(s.shake, 18.0)
			s.sound("moon")
			s.strike_orbs(radius, radius, {}, "", {"x":z.tx,"y":z.ty,"h":0.0,"face":1,"depth":radius,"damage":z.damage,"kd":true})
			blocked = s.strike_fists(radius, radius, {}, "", {"x":z.tx,"y":z.ty,"h":0.0,"face":1,"depth":radius,"damage":z.damage,"kd":true})
		elif z.impact:
			w.effect("ult_impact", z.tx, z.ty, z.th, s.player.face, 44, 44, 12)
		if z.kind != "volley":
			for e: BmkActorState in s.enemies:
				if e.st == "dead" or e.invulnerable or e.inv > 0 or e.st == "intro" or e is BmkLegacyActor and (e as BmkLegacyActor).phase_t > 0 or blocked and s.is_sovereign(e): continue
				var inside: bool = js_hypot([e.x - z.tx, e.y - z.ty]) <= radius + e.hw if giant else absf(e.x - z.tx) <= e.hw + 12.0 and absf(e.y - z.ty) <= 24 * 1.3 and absf(e.z + 40.0 - z.th) < 65.0
				if not inside or not giant and z.cast.hit_times.has(e.id) and s.tick - z.cast.hit_times[e.id] < 3: continue
				z.cast.hit_times[e.id] = s.tick
				var stop: int = s.hit_stop
				s.combat.damage_enemy(s, e, z.damage, giant, 2 if giant else 0, false, "special" if giant else "viesaArrow")
				if not giant and e.st != "dead": s.hit_stop = stop
		if giant:
			for b: BmkWorldItem in s.barrels:
				if not b.gone and js_hypot([b.x - z.tx, b.y - z.ty]) <= radius: s.item_controller.damage_barrel(s, b)
		z.cast = null
	w.ult = kept

# ------------------------------------------------------------------ presentation pose (viesaPose)
## Returns [clip, index] exactly as viesaPose() selects VIESA_ART frames.
func pose(s: BmkSimulation) -> Array:
	var p: BmkActorState = s.player
	var a: BmkViesaAction = p.viesa_action
	var clip: String
	var index: float
	if p.st == "dead":
		clip = "death"; index = floori(p.t / 4.0)
	elif p.st == "down":
		if p.t < 32: clip = "knockdown"; index = floori(p.t * 7 / 32.0)
		else: clip = "getup"; index = floori((p.t - 32) / 3.0)
	elif p.st == "hurt":
		# Ten hurt frames span the default hitstun; a grab holds the recoil (frame 5).
		clip = "hurt"; index = floori(p.t * 10.0 / s.data.hurt_ticks)
	elif p.st == "grabbed":
		clip = "hurt"; index = mini(4, floori(p.t / 4.0))
	elif p.st == "atk":
		clip = p.viesa_clip; index = 3 + floori(p.t / 3.0) if p.viesa_clip == "jump_shot" else floori(p.t / 4.0)
	elif p.st == "cast":
		var ms: float = p.t * MS
		var fire: float = s.data.magic_fire
		var duration: float = s.data.magic_duration
		clip = "scroll_cast"
		index = mini(6, floori(ms / fire * 7)) if ms < fire else 7 + mini(2, floori((ms - fire) / (duration - fire) * 3))
	elif p.st == "special" and a != null:
		clip = a.phase; index = floori(p.t / 3.0) % 7 if a.phase == "ult_barrage" else floori(p.t / 4.0)
	elif p.st == "skill" and a != null:
		match a.phase:
			"snipe_draw":
				clip = "snipe_draw"; index = floori(p.t / 3.0) if p.t < CHARGE_DRAW else 6
			"snipe_release":
				clip = "snipe_release"; index = floori(p.t / 2.0) if p.t < 6 else (3 if p.t < 14 else 4)
			"rapid_loop":
				var local: int = posmod(p.t - 1, 9)
				clip = "rapid_loop"; index = 0 if p.t < 1 else (3 if local < 3 else (1 if local < 6 else 2))
			"rapid_end":
				clip = "rapid_end"; index = floori(p.t / 8.0)
			"dash_slash":
				clip = "dash"; index = floori(p.t * 3 / 16.0) if p.t < 16 else 3 + floori((p.t - 16) / 2.0)
			"backflip":
				clip = "backflip"; index = floori(p.t / 5.0)
			"hover":
				clip = "backflip"; index = 5
			"land_backflip":
				clip = "backflip"; index = 6 + floori(p.t / 3.0)
			"land_jump":
				clip = "jump"; index = 12 + floori(p.t / 3.0)
			_:
				clip = a.phase; index = floori(p.t / 4.0)
	elif p.st == "dash":
		clip = "dash"; index = floori(p.t * 5 / 6.0)
	elif p.z > 0.0:
		clip = "jump"
		if p.vz > 0.0: index = 3 + mini(5, floori(p.jump_time / 4.0))
		else: index = 9 if p.vz > -2.0 else (10 if p.vz > -5.0 else 11)
	elif p.walk and p.running:
		clip = "run"; index = floori(p.walk_time / 60.0) % 10
	elif p.walk:
		clip = "walk"; index = floori(p.walk_time / 50.0) % 16
	else:
		clip = "idle"; index = floori(s.tick / 5.0) % 16
	return [clip, art.frame_index(clip, index)]

## game.js playerAttackHasDefaultSound(): Viesa's bow and skills supply their own sounds.
static func default_hit_sound(p: BmkActorState) -> bool:
	return p.st == "cast" or p.st == "special" or p.st == "atk" and p.viesa_clip in MELEE
