class_name BmkPlayerController
extends RefCounted
const MS: float = 1000.0 / 60.0
const JUMP: Array[String] = ["Space", "ControlLeft", "ControlRight"]

func aim(s: BmkSimulation) -> void:
	var direction: int = int(s.input.down(["ArrowRight", "KeyD"])) - int(s.input.down(["ArrowLeft", "KeyA"]))
	if direction != 0:
		s.player.face = direction

func start_attack(s: BmkSimulation, combo: int, air: bool = false) -> void:
	var p: BmkActorState = s.player
	s.lane_flash_ticks = 12
	s.lane_flash_ids.clear()
	for enemy: BmkActorState in s.enemies:
		if enemy.st not in ["dead","down","enter"] and absf(p.y - enemy.y) <= 24.0:
			s.lane_flash_ids[enemy.id] = true
	p.st = "atk"
	p.t = 0
	p.buf = 0.0
	p.hit_set.clear()
	p.x0 = p.x
	p.smash = false
	if air:
		p.atk = "air"
	else:
		p.combo = combo
		p.atk = ["c1", "c2", "c3"][combo]
	s.react_attack()
	s.sound("swordSwing", 2 if air else combo)

func start_dash(s: BmkSimulation, direction: int) -> void:
	var p: BmkActorState = s.player
	p.st = "dash"
	p.t = 0
	p.x0 = p.x
	p.face = direction
	p.combo = 0
	p.combo_t = 0
	p.buf = 0.0
	p.inv = maxi(p.inv, s.data.dash_inv)
	p.dash_cd = s.data.dash_cd
	p.dash_grace = 0
	s.sound("dash")

func start_dash_attack(s: BmkSimulation) -> void:
	var p: BmkActorState = s.player
	aim(s)
	p.st = "dash_attack"
	p.t = 0
	p.inv = 0
	p.buf = 0.0
	p.combo = 0
	p.combo_t = 0
	p.atk = ""
	p.dash_grace = 0
	p.hit_set.clear()
	p.dash_attack_hit = false
	p.dash_flash = false
	p.vx = 0.0
	p.vz = 0.0
	s.react_attack()
	s.sound("swing", 2)

func can_start_skill(s: BmkSimulation, id: String) -> bool:
	var p: BmkActorState = s.player
	if p.st == "dash_attack" and (not p.dash_attack_hit or p.t < s.data.dash_skill_cancel):
		return false
	if p.skill_cd[id] > 0.0 or p.z > 0.0 or p.st in ["dead", "down", "hurt", "special", "cast", "skill", "grabbed"]:
		return false
	if p.st == "atk":
		var a: BmkAttackData = s.data.attack(p.atk)
		if p.atk == "air" or p.t * MS < a.wind_ms + a.active_ms:
			return false
	if p.st == "dash" and p.t * MS < 110.0:
		return false
	return true

func start_skill(s: BmkSimulation, a: BmkAttackData) -> void:
	var p: BmkActorState = s.player
	p.st = "skill"
	p.skill = a.id
	p.t = 0
	p.x0 = p.x
	p.vx = 0.0
	p.vz = 0.0
	p.z = 0.0
	p.combo = 0
	p.combo_t = 0
	p.buf = 0.0
	p.skill_hits.clear()
	p.skill_cd[a.id] = a.cooldown_ms
	aim(s)
	var nearest: BmkActorState
	for e: BmkActorState in s.enemies:
		if e.st == "dead" or (e.x - p.x) * p.face < 0.0 or absf(e.y - p.y) >= 60.0 or absf(e.x - p.x) >= 320.0:
			continue
		if nearest == null or absf(e.x - p.x) < absf(nearest.x - p.x):
			nearest = e
	var distance: float = maxf(0.0, (nearest.x - p.x) * p.face - 44.0) if nearest != null else 160.0
	p.skill_dest = clampf(p.x + p.face * distance, s.cam_x + 24.0, minf(s.cam_x + 616.0, s.stage_length - 24.0))
	s.react_attack()
	s.sound("spdash" if a.id == "leap" else "swing", 2 if a.id == "slam" else 1)

func start_special(s: BmkSimulation) -> void:
	var p: BmkActorState = s.player
	aim(s)
	p.st = "special"
	p.t = 0
	p.sp = 0.0
	p.vx = 0.0
	p.combo = 0
	p.buf = 0.0
	p.sp_hits = 0
	p.sp_fin = false
	p.sp_dash = false
	s.react_attack()
	var nearest: BmkActorState
	var best: float = 1e9
	for e: BmkActorState in s.enemies:
		if e.st == "dead" or (e.x - p.x) * p.face < 0.0 or absf(e.x - p.x) > 420.0 or absf(e.y - p.y) > 120.0:
			continue
		var distance: float = absf(e.x - p.x) + absf(e.y - p.y) * 2.0
		if distance < best:
			best = distance
			nearest = e
	p.sp_target = nearest
	p.sp_x = nearest.x if nearest != null else p.x + p.face * 140.0
	p.sp_y = nearest.y if nearest != null else p.y
	p.sp_x0 = p.x
	p.sp_y0 = p.y
	s.sound("spcharge")

func step(s: BmkSimulation) -> void:
	var p: BmkActorState = s.player
	var d: BmkCombatData = s.data
	var input: BmkInputRouter = s.input
	if p.inv > 0:
		p.inv -= 1
	if p.flash > 0:
		p.flash -= 1
	if p.buff > 0:
		p.buff -= 1
	if p.buf > 0.0:
		p.buf -= MS
	if p.dash_cd > 0:
		p.dash_cd -= 1
	if p.dash_grace > 0:
		p.dash_grace -= 1
	for id: String in p.skill_cd:
		if p.skill_cd[id] > 0.0:
			p.skill_cd[id] = maxf(0.0, p.skill_cd[id] - MS)
	if p.sp >= 100.0:
		if not s.sp_full:
			s.sp_full = true
			p.flash = maxi(p.flash, 3)
			s.sound("spready")
	else:
		s.sp_full = false
	if s.lane_flash_ticks > 0:
		s.lane_flash_ticks -= 1
	if p.st == "grabbed":
		update_grab(s)
		return
	var was_walking: bool = p.walk
	p.walk = false
	for a: BmkAttackData in d.skills:
		if can_start_skill(s, a.id) and input.hit(["Key" + a.key]):
			start_skill(s, a)
			return
	var dash_cancelable: bool = p.st == "free" or p.st == "atk" or p.st == "dash_attack" and p.t >= d.dash_attack_cancel
	if p.dash_cd <= 0 and p.z == 0.0 and dash_cancelable and input.hit(["ShiftLeft"]):
		input.dash_request = p.face
	if input.dash_request != 0:
		var direction: int = input.dash_request
		input.dash_request = 0
		if p.dash_cd <= 0 and p.z == 0.0 and dash_cancelable:
			start_dash(s, direction)
	if p.z == 0.0 and (p.st == "dash" or p.st == "free" and p.dash_grace > 0) and input.hit(["KeyJ", "KeyZ"]):
		start_dash_attack(s)
		return
	# Source skills handle their own arcs by returning before this gravity section.
	if p.z > 0.0 or p.vz != 0.0:
		p.z += p.vz
		p.vz -= d.gravity
		if p.z <= 0.0:
			p.z = 0.0
			p.vz = 0.0
	match p.st:
		"free":
			var ax: int = int(input.down(["ArrowRight", "KeyD"])) - int(input.down(["ArrowLeft", "KeyA"]))
			var ay: int = int(input.down(["ArrowDown", "KeyS"])) - int(input.down(["ArrowUp", "KeyW"]))
			var speed: float = d.air_speed if p.z > 0.0 else d.ground_speed
			p.x += ax * speed
			p.y += ay * speed * d.depth_ratio
			if ax != 0:
				p.face = ax
			p.walk = ax != 0 or ay != 0
			p.walk_time = (p.walk_time + MS if was_walking else 0.0) if p.walk and p.z == 0.0 else 0.0
			p.t += 1
			if p.combo_t > 0:
				p.combo_t -= 1
			if p.z == 0.0 and input.hit(JUMP):
				p.vz = d.jump_velocity
				s.sound("jump")
			if p.sp >= 100.0 and input.hit(["KeyK", "KeyX"]):
				start_special(s)
			elif p.mg > 0 and p.z == 0.0 and input.hit(["KeyI", "KeyV"]):
				p.st = "cast"
				p.t = 0
				p.mg -= 1
				p.cast_fired = false
				p.combo = 0
				p.buf = 0.0
				p.vx = 0.0
				p.inv = maxi(p.inv, 48)
				aim(s)
				s.react_attack()
				s.sound("mcharge")
			elif input.hit(["KeyJ", "KeyZ"]):
				start_attack(s, p.combo + 1 if p.combo_t > 0 and p.combo < 2 else 0, p.z > 0.0)
		"atk":
			p.t += 1
			var a: BmkAttackData = d.attack(p.atk)
			if p.atk == "air":
				p.x += p.face * d.air_speed
				s.combat.strike(s, a)
				if p.z <= 0.0 and p.vz == 0.0:
					p.st = "free"
					p.t = 0
					p.combo_t = 0
					p.combo = 0
			else:
				var t: float = p.t * MS
				var hit_at: float = a.wind_ms + a.active_ms
				if t >= a.wind_ms and t < hit_at + MS:
					p.x = p.x0 + a.step * p.face * s.ease((t - a.wind_ms) / a.active_ms)
				if t >= a.wind_ms + a.active_ms * d.active_ratio and t < hit_at + d.active_tail:
					s.combat.strike(s, a)
				if input.hit(["KeyJ", "KeyZ"]):
					p.buf = d.buffer_ms
				if p.combo == 2 and not p.smash and t >= a.wind_ms + a.active_ms * a.smash_ratio:
					p.smash = true
					s.ground_smash(p.x + p.face * 90.0, p.y)
				if p.buf > 0.0 and p.combo < 2 and t >= hit_at + a.recovery_ms * d.cancel_ratio:
					start_attack(s, p.combo + 1)
				elif t >= hit_at + a.recovery_ms:
					p.st = "free"
					p.t = 0
					p.combo_t = s.js_round(d.link_ms / MS) if p.combo < 2 else 0
					if p.combo == 2:
						p.combo = 0
		"dash":
			p.t += 1
			var t: float = p.t * MS
			p.x = p.x0 + p.face * d.dash_distance * s.ease(minf(1.0, t / d.dash_move_ms))
			if t >= d.dash_cancel_ms and input.hit(["KeyJ", "KeyZ"]):
				start_attack(s, 0)
			elif t >= d.dash_duration:
				p.st = "free"
				p.t = 0
				p.dash_grace = d.dash_grace
		"dash_attack":
			update_dash_attack(s)
		"skill":
			p.t += 1
			update_skill(s)
		"special":
			p.t += 1
			update_special(s)
		"cast":
			p.t += 1
			if not p.cast_fired and p.t * MS >= d.magic_fire:
				fire_magic(s)
			if p.t * MS >= d.magic_duration:
				p.st = "free"
				p.t = 0
		"hurt":
			if p.hurt_ends.is_empty() or p.hurt_index() < 3:
				p.x += p.vx
				p.vx *= d.hurt_decay
			else:
				p.vx = 0.0
			p.t += 1
			if p.t >= p.hurt_duration:
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

func update_grab(_s: BmkSimulation) -> void:
	pass

func collect_items(_s: BmkSimulation) -> void:
	pass

func update_dash_attack(s: BmkSimulation) -> void:
	var p: BmkActorState = s.player
	var d: BmkCombatData = s.data
	for segment: PackedFloat64Array in d.dash_attack_segments:
		if p.t >= segment[0] and p.t < segment[1]:
			p.x += p.face * d.dash_body_height * segment[2]
			break
	if p.t == d.dash_attack_from and not p.dash_flash:
		p.dash_flash = true
		s.shake = maxf(s.shake, 3.0)
		s.impact(p.x + p.face * d.dash_reach, p.y, d.dash_tip_height, 1)
	if p.t >= d.dash_attack_from and p.t < d.dash_attack_to:
		s.strike_crows(d.dash_reach, -d.dash_front, p.x, p.y, p.z, p.face)
		s.strike_orbs(d.dash_reach, -d.dash_front, p.hit_set, "", {"depth":d.dash_depth,"damage":s.js_round(d.attack("c1").damage * d.dash_damage_ratio * (1.5 if p.buff > 0 else 1.0))})
		var blocked: bool = s.strike_fists(d.dash_reach, -d.dash_front, p.hit_set, "", {"depth":d.dash_depth,"damage":s.js_round(d.attack("c1").damage * d.dash_damage_ratio * (1.5 if p.buff > 0 else 1.0)),"kd":true})
		for e: BmkActorState in s.enemies:
			var dx: float = (e.x - p.x) * p.face
			if not s.combat.can_hit(e) or p.hit_set.has(e.id) or blocked and s.is_sovereign(e) or dx + e.hw < d.dash_front or dx - e.hw > d.dash_reach or absf(e.y - p.y) >= d.dash_depth or e.z > d.dash_top or e.z + e.d.height < d.dash_bottom:
				continue
			var hp: float = e.hp
			p.hit_set[e.id] = true
			s.combat.damage_enemy(s, e, s.js_round(d.attack("c1").damage * d.dash_damage_ratio * (1.5 if p.buff > 0 else 1.0)), true, 2, false, "dashAttack")
			if e.hp < hp:
				p.dash_attack_hit = true
				p.sp = minf(100.0, p.sp + d.dash_sp)
	if s.input.hit(["KeyJ", "KeyZ"]):
		p.buf = d.buffer_ms
	if p.t >= d.dash_attack_cancel:
		if s.input.hit(JUMP):
			p.st = "free"
			p.t = 0
			p.vz = d.jump_velocity
			return
		if p.buf > 0.0:
			start_attack(s, 0)
			return
	p.t += 1
	if p.t >= d.dash_attack_ends[-1]:
		p.st = "free"
		p.t = 0

func update_skill(s: BmkSimulation) -> void:
	var p: BmkActorState = s.player
	var a: BmkAttackData = s.data.skill(p.skill)
	var t: float = p.t * MS
	var previous: float = (p.t - 1) * MS
	match a.id:
		"thrust":
			if t >= a.strikes[0] and t < a.strikes[1]:
				s.combat.skill_strike(s, 0, a)
		"slam":
			if previous < a.strikes[0] and t >= a.strikes[0]:
				s.combat.skill_strike(s, 0, a)
				s.ground_smash(p.x + p.face * 84.0, p.y)
		"whirl":
			if t >= a.inv_from and t < a.inv_to:
				p.inv = maxi(p.inv, 4)
			for i: int in range(a.strikes.size()):
				if previous < a.strikes[i] and t >= a.strikes[i]:
					s.combat.skill_strike(s, i, a)
		"redwave":
			if previous < a.strikes[0] and t >= a.strikes[0]:
				var wave: BmkProjectileState = BmkProjectileState.new()
				wave.seq = s.next_hazard_seq()
				wave.x = p.x + p.face * 32.0
				wave.y = p.y
				wave.direction = p.face
				wave.damage = s.js_round(a.damage * (1.5 if p.buff > 0 else 1.0))
				s.hazards.append(wave)
				s.sound("barelWave")
		"leap":
			if t >= a.travel_from and t < a.travel_to:
				var u: float = (t - a.travel_from) / (a.travel_to - a.travel_from)
				p.x = lerpf(p.x0, p.skill_dest, s.ease(u))
				p.z = sin(PI * u) * a.height
				p.inv = maxi(p.inv, 4)
			if previous < a.strikes[0] and t >= a.strikes[0]:
				p.z = 0.0
				s.combat.skill_strike(s, 0, a)
				s.ground_smash(p.x + p.face * 34.0, p.y)
	if t >= a.duration_ms:
		p.st = "free"
		p.t = 0
		p.z = 0.0
		p.skill = ""
		p.inv = maxi(p.inv, s.data.skill_end_inv)

func update_special(s: BmkSimulation) -> void:
	var p: BmkActorState = s.player
	var d: BmkCombatData = s.data
	var t: float = p.t * MS
	if p.sp_target != null and p.sp_target.st != "dead" and t < 1580.0 and (p.sp_target.x - p.sp_x0) * p.face >= 0.0:
		p.sp_x = p.sp_target.x
		p.sp_y = p.sp_target.y
	if t >= 450.0 and not p.sp_dash:
		p.sp_dash = true
		s.sound("spdash")
	if t >= 450.0 and t < 620.0:
		var u: float = s.ease((t - 450.0) / 150.0)
		p.x = lerpf(p.sp_x0, p.sp_x0 + p.face * maxf(0.0, (p.sp_x - p.sp_x0) * p.face - 52.0), u)
		p.y = lerpf(p.sp_y0, p.sp_y, u)
	for i: int in range(d.special_hits.size()):
		var start: float = d.special_from + i * d.special_interval
		if t >= start + d.special_hits[i] - 40.0 and t < start + d.special_hits[i] + 40.0:
			p.x += p.face * 3.0 * 2.0 * MS / 80.0
		if t >= start + d.special_hits[i] and p.sp_hits <= i:
			p.sp_hits = i + 1
			special_hit(s, false)
	if t >= d.special_finish_ms and not p.sp_fin:
		p.sp_fin = true
		special_hit(s, true)
	if t >= d.special_duration:
		p.st = "free"
		p.inv = 24
		p.combo_t = 0
		p.combo = 0
		p.sp_target = null

func special_hit(s: BmkSimulation, last: bool) -> void:
	var p: BmkActorState = s.player
	if not last and p.sp_hits == 1:
		s.sound("barelCombo")
	var damage: float = s.js_round((s.data.special_finisher if last else s.data.special_slash) * (1.5 if p.buff > 0 else 1.0))
	var rx: float = 110.0 if last else 80.0
	var ry: float = 60.0 if last else 44.0
	s.strike_orbs(rx, rx, {}, "", {"x":p.sp_x,"y":p.sp_y,"h":0.0,"depth":ry,"damage":damage,"hitSound":"barelFinalHit" if last else "none"})
	var blocked: bool = s.strike_fists(rx, rx, {}, "", {"x":p.sp_x,"y":p.sp_y,"h":0.0,"depth":ry,"damage":damage,"kd":true,"hitSound":"barelFinalHit" if last else "none"})
	for e: BmkActorState in s.enemies:
		if s.combat.can_hit(e) and not (blocked and s.is_sovereign(e)) and absf(e.x - p.sp_x) < rx + e.hw and absf(e.y - p.sp_y) < ry:
			s.combat.damage_enemy(s, e, damage, last, 2 if last else 1, false, "special" if last else "specialSlash")
	if last:
		s.flash_t = 240.0
		s.shake = maxf(s.shake, 18.0)
		s.sound("barelFinalHit")
	else:
		s.shake = maxf(s.shake, 6.0)

func fire_magic(s: BmkSimulation) -> void:
	var p: BmkActorState = s.player
	s.sound("bolt")
	p.cast_fired = true
	s.flash_t = 200.0
	s.shake = maxf(s.shake, 22.0)
	s.hit_stop = maxi(s.hit_stop, 4)
	s.strike_orbs(0.0, 0.0, {}, "", {"global":true,"damage":s.data.magic_damage})
	s.strike_fists(0.0, 0.0, {}, "", {"global":true,"damage":s.data.magic_damage})
	for e: BmkActorState in s.enemies:
		if e.st in ["dead", "intro"] or e.x < s.cam_x - 20.0 or e.x > s.cam_x + 660.0:
			continue
		e.bolted = true
		e.inv = 0
		s.combat.damage_enemy(s, e, s.data.magic_damage, true, 2, true, "magic")
