class_name BmkEnemyController
extends RefCounted
const MS: float = 1000.0 / 60.0

func begin_move(s: BmkSimulation, e: BmkActorState, clip: String) -> void:
	e.mv = s.data.enemy_move(e.species, clip)
	e.mv_t = 0
	e.mv_f = 0
	e.mv_hit = false
	e.mv_used.clear()
	e.face = 1 if s.player.x >= e.x else -1
	e.st = "wind" if e.mv.warning_frames > 0 else "act"
	e.t = 0
	e.pat = "swing"
	e.hit_set.clear()
	s.sound("bwind" if e.st == "wind" else "swing")

func zone(s: BmkSimulation, e: BmkActorState, hit: int) -> BmkHitZone:
	var result: BmkHitZone = BmkHitZone.new()
	result.ex = e.x
	result.face = e.face
	result.reach = e.mv.hit_reach[hit] + s.player.hw
	result.y = e.y
	result.ez = e.z
	# feel-runtime.js reachZone: depth and height scale with playerHurtScale() (Viesa .9).
	var k: float = 0.9 if s.player.is_viesa() else 1.0
	result.depth = s.data.enemy_depth * k
	result.max_height = s.data.enemy_height * k
	result.knockdown = e.mv.hit_knockdown[hit] != 0
	var start: int = e.mv.frame_start(e.mv.hit_from[hit])
	result.active = e.mv_f + 1 >= e.mv.hit_from[hit]
	result.progress = 1.0 if result.active else clampf(float(e.mv_t) / (start + 1), 0.0, 1.0)
	result.hit_in = 0 if result.active else start + 1 - e.mv_t
	result.active_age = e.mv_t - start if result.active else -1
	result.warning = e.mv.warning_frames > 0
	if not result.active and e.mv.dash_from >= 0:
		var from: int = e.mv.frame_start(e.mv.dash_from)
		var to: int = e.mv.frame_start(e.mv.dash_to + 1)
		result.reach += maxf(0.0, to - maxi(e.mv_t, from)) * e.mv.dash_ratio * 102.24
	return result

func attack_zone(s: BmkSimulation, e: BmkActorState) -> BmkHitZone:
	if e.mv == null or e.st not in ["wind", "act"]:
		return null
	for i: int in range(e.mv.hit_from.size()):
		if e.mv_f + 1 <= e.mv.hit_to[i]:
			return zone(s, e, i)
	return null

func run_move(s: BmkSimulation, e: BmkActorState) -> void:
	e.mv_t += 1
	var accumulated: int = 0
	var f: int = 0
	while f < e.mv.lengths.size() and e.mv_t > accumulated + e.mv.lengths[f]:
		accumulated += e.mv.lengths[f]
		f += 1
	if f >= e.mv.lengths.size():
		if e.mv.next_clip != "" and e.mv_hit:
			begin_move(s, e, e.mv.next_clip)
			e.st = "act"
			return
		e.mv = null
		e.st = "chase"
		e.t = 0
		e.pat = ""
		e.attack_cd = s.js_round(s.random_between(15.0, 45.0))
		return
	e.mv_f = f
	var fn: int = f + 1
	e.st = "wind" if fn <= e.mv.warning_frames else "act"
	if e.mv.dash_from >= 0 and fn >= e.mv.dash_from and fn <= e.mv.dash_to and (s.player.x - e.x) * e.face > 34.0:
		e.x += e.face * e.mv.dash_ratio * 102.24
	for i: int in range(e.mv.hit_from.size()):
		if fn < e.mv.hit_from[i] or fn > e.mv.hit_to[i] or e.mv_used.has(i):
			continue
		if zone(s, e, i).contains(s.player) and s.combat.hurt_player(s, e.mv.hit_damage[i], e.face, e.mv.hit_knockdown[i] != 0):
			e.mv_used[i] = true
			e.mv_hit = true

func start_getup(s: BmkSimulation, e: BmkActorState) -> void:
	var length: int = 0
	for ticks: int in s.data.getup_lengths:
		length += ticks
	e.st = "rec"
	e.t = 0
	e.inv = maxi(45, length)
	e.recovery_t = length + s.data.after_getup
	e.getup = true
	e.z = 0.0
	e.vz = 0.0

func step(s: BmkSimulation, e: BmkActorState) -> void:
	if e.training:
		if e.st != "dead":
			e.st = "chase"
			e.z = 0.0
			e.inv = 0
			e.flash = maxi(0, e.flash - 1)
		return
	e.t += 1
	if e.flash > 0:
		e.flash -= 1
	if e.inv > 0:
		e.inv -= 1
	if e.attack_cd > 0.0:
		e.attack_cd -= 1.0
	e.hr += MS
	e.walk = false
	if e.red_flash > 0:
		e.red_flash -= 1
	var handled: bool = stage_override(s,e)
	if not handled and e.mv != null and e.st in ["wind", "act"]:
		run_move(s, e)
		handled = true
	elif not handled and e.st not in ["wind", "act"]:
		e.mv = null
	if e.st == "down" and not handled:
		e.x += e.vx
		e.z += e.vz
		e.vz -= 0.5
		e.vx *= 0.97
		if e.z <= 0.0:
			e.z = 0.0
			e.vz = 0.0
			e.vx *= 0.7
		if e.t > 60 and e.z == 0.0:
			start_getup(s, e)
		handled = true
	if e.st == "chase":
		e.getup = false
	if not handled:
		match e.st:
			"enter":
				e.walk = true
				e.alpha = minf(1.0, e.alpha + 0.05)
				e.y += e.enter_speed
				if e.y >= e.enter_to:
					e.st = "chase"
					e.t = 0
					e.alpha = 1.0
					e.invulnerable = false
					e.wait = 8.0
			"dead":
				e.x += e.vx
				e.z += e.vz
				e.vz -= 0.5
				e.vx *= 0.97
				if e.z <= 0.0:
					e.z = 0.0
					e.vz = 0.0
					e.vx *= 0.7
				if e.t > 65:
					e.remove = true
			"hurt":
				e.x += e.vx
				e.vx *= 0.85
				if e.t > (e.hurt_t if e.hurt_t != 0 else s.data.enemy_hurt_ticks):
					e.st = "chase"
					e.t = 0
					e.wait = s.random_between(0.0, 12.0)
					e.chain_n = 0
			"rec":
				if e.t > e.recovery_t:
					e.st = "chase"
					e.t = 0
					e.attack_cd = s.random_between(20.0, 55.0)
			"chase":
				chase(s, e)
	s.combat.enemy_collision(s, e)
	if e.st in ["chase", "rec"]:
		for other: BmkActorState in s.enemies:
			if other == e or other.st in ["dead", "down"]:
				continue
			var ox: float = e.x - other.x
			var oy: float = e.y - other.y
			if absf(ox) < 30.0 and absf(oy) < 12.0:
				e.x += (signf(ox) if ox != 0.0 else 1.0) * 0.6
				e.y += (signf(oy) if oy != 0.0 else 1.0) * 0.4
	e.x = clampf(e.x, s.cam_x - 70.0, s.cam_x + 710.0)
	if e.st != "enter":
		e.y = clampf(e.y, s.walk_top + 10.0, 500.0)

func chase(s: BmkSimulation, e: BmkActorState) -> void:
	var p: BmkActorState = s.player
	var dx: float = p.x - e.x
	var dy: float = p.y - e.y
	if p.st == "dead":
		return
	if e.wait > 0.0:
		e.wait -= 1.0
		return
	e.face = 1 if dx >= 0.0 else -1
	var attackers: int = 0
	for other: BmkActorState in s.enemies:
		if other != e and other.st in ["wind", "act", "pat"]:
			attackers += 1
	var can: bool = attackers < 2 and p.st != "down" and e.attack_cd <= 0.0
	var side: int = 1 if dx >= 0.0 else -1
	var tx: float = p.x - side * (e.d.reach - 14.0) if can else p.x - side * (150.0 + (e.id % 3) * 35.0)
	var ty: float = p.y if can else p.y + (34.0 if e.id % 2 != 0 else -34.0)
	var mx: float = tx - e.x
	var my: float = ty - e.y
	var distance: float = sqrt(mx * mx + my * my)
	if distance > 4.0:
		e.x += mx / distance * e.d.speed
		e.y += my / distance * e.d.speed * 0.8
		e.walk = true
	if can and absf(dx) < e.d.reach and absf(dy) < 14.0:
		begin_move(s, e, "atk1" if e.species == "blade" else "attack")

func stage_override(_s: BmkSimulation, _e: BmkActorState) -> bool:
	return false
