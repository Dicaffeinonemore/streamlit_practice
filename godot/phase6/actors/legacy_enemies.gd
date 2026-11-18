class_name BmkLegacyEnemies
extends BmkStageEnemies
## game.js updEnemy() for the wave stages: generic soldiers (swing / archer shoot) and the
## shared boss state machine (chase, pattern, groggy stun, knockdown, death) used by Morgra.

func s_of(sim: BmkSimulation) -> BmkWaveSimulation:
	return sim as BmkWaveSimulation

func stat(e: BmkLegacyActor, key: String) -> float:
	return float(e.stats.get(key,0))

func step(sim: BmkSimulation, actor: BmkActorState) -> void:
	var s: BmkWaveSimulation = s_of(sim)
	var e: BmkLegacyActor = actor as BmkLegacyActor
	var p: BmkActorState = s.player
	if e.st == "reviving":
		s.morgra.update_revival(s,e)
		return
	if e.morgra_cooldown > 0: e.morgra_cooldown -= 1
	if e.phase_t > 0 and e.st != "dead":
		e.phase_t -= 1
		e.walk = false
		e.flash = 0
		if e.phase_t == 0:
			e.invulnerable = false
			e.st = "rec"
			e.t = 0
			e.recovery_t = 36
		return
	if e.training:
		if e.st != "dead":
			e.st = "chase"
			e.z = 0
			e.inv = 0
			e.flash = maxi(0,e.flash - 1)
		return
	e.t += 1
	if e.flash > 0: e.flash -= 1
	if e.inv > 0: e.inv -= 1
	if e.attack_cd > 0: e.attack_cd -= 1
	e.hr += MS
	e.walk = false
	if e.boss and e.st != "stun":
		if e.gr_t > 0: e.gr_t -= 1
		elif e.gr > 0: e.gr = maxf(0,e.gr - 0.2)
	if e.st == "pat":
		e.pt += MS
		run_pat(s,e)
		e.x = clampf(e.x,s.cam_x - 70,s.cam_x + s.view_width + 70)
		e.y = clampf(e.y,s.ground_top + 10,s.ground_bottom)
		return
	if e.boss and e.st == "dead":
		if e.t > 120: e.remove = true
		return
	var dx: float = p.x - e.x
	var dy: float = p.y - e.y
	match e.st:
		"down", "dead":
			e.x += e.vx
			e.z += e.vz
			e.vz -= 0.5
			e.vx *= 0.97
			if e.z <= 0:
				e.z = 0
				e.vz = 0
				e.vx *= 0.7
			if e.st == "dead":
				if e.t > 65: e.remove = true
			elif e.t > 60 and e.z == 0:
				e.st = "rec"
				e.t = 0
				e.inv = 45
				e.recovery_t = 20
		"hurt":
			e.x += e.vx
			e.vx *= 0.85
			if e.t > (10 if e.boss else (e.hurt_t if e.hurt_t != 0 else int(s.wave_data.source["ENEMIES"]["default"]["hurtTicks"]))):
				e.st = "chase"
				e.t = 0
				e.wait = s.random_between(0,12)
				e.chain_n = 0
		"stun":
			if e.t >= int(s.wave_data.source["GROGGY_TICKS"]):
				e.st = "rec"
				e.t = 0
				e.recovery_t = 30
				e.gr = 0
				e.gr_t = 0
				e.attack_cd = s.random_between(30,60)
		"rec":
			if e.t > e.recovery_t:
				e.st = "chase"
				e.t = 0
				e.attack_cd = s.random_between(20,55)
		"wind":
			if e.pat == "swing" or e.pat == "shoot":
				if e.pat == "shoot":
					e.face = 1 if dx >= 0 else -1
					e.y += clampf(dy,-0.6,0.6)
				if e.t >= stat(e,"wind"):
					e.st = "act"
					e.t = 0
					e.hit_player = false
		"act":
			if e.pat == "swing":
				if e.t <= stat(e,"act") and not e.hit_player and swing_zone(s,e).contains(p):
					if s.combat.hurt_player(s,stat(e,"dmg"),e.face,bool(e.stats.get("kd",false))): e.hit_player = true
				if e.t > stat(e,"act") + int(s.wave_data.source["ENEMIES"]["hit"]["activeGraceTicks"]):
					e.st = "rec"
					e.t = 0
					e.recovery_t = int(stat(e,"rec"))
					e.attack_cd = s.random_between(15,45)
			elif e.pat == "shoot":
				if e.t == 1:
					var z: BmkLegacyHazard = s.add_hazard("arrow",e.x + e.face * 40,e.y,50)
					z.dir = e.face
					z.damage = stat(e,"dmg")
					s.sound("swing",0)
				if e.t > stat(e,"act"):
					e.st = "rec"
					e.t = 0
					e.recovery_t = int(stat(e,"rec"))
					e.attack_cd = s.random_between(60,110)
		"chase":
			if e.boss: boss_chase(s,e)
			elif bool(e.stats.get("ranged",false)): archer_chase(s,e)
			else: soldier_chase(s,e,dx,dy)
	s.combat.enemy_collision(s,e)
	if e.st == "chase" or e.st == "rec":
		for other: BmkActorState in s.enemies:
			if other == e or other.st in ["dead","down"]: continue
			var ox: float = e.x - other.x
			var oy: float = e.y - other.y
			if absf(ox) < 30 and absf(oy) < 12:
				e.x += (signf(ox) if ox != 0 else 1.0) * 0.6
				e.y += (signf(oy) if oy != 0 else 1.0) * 0.4
	e.x = clampf(e.x,s.cam_x - 70,s.cam_x + s.view_width + 70)
	if e.st != "enter": e.y = clampf(e.y,s.walk_top + 10,s.ground_bottom)

func attackers(s: BmkSimulation, e: BmkActorState) -> int:
	var n: int = 0
	for other: BmkActorState in s.enemies:
		if other != e and other.st in ["wind","act","pat"]: n += 1
	return n

func soldier_chase(s: BmkWaveSimulation, e: BmkLegacyActor, dx: float, dy: float) -> void:
	var p: BmkActorState = s.player
	if p.st == "dead": return
	if e.wait > 0:
		e.wait -= 1
		return
	e.face = 1 if dx >= 0 else -1
	var can: bool = attackers(s,e) < 2 and p.st != "down" and e.attack_cd <= 0
	var side: int = 1 if dx >= 0 else -1
	var range_: float = stat(e,"range")
	var tx: float = p.x - side * (range_ - 14) if can else p.x - side * (150 + (e.id % 3) * 35)
	var ty: float = p.y if can else p.y + (34.0 if e.id % 2 != 0 else -34.0)
	walk_to(e,tx,ty,stat(e,"spd"))
	if can and absf(dx) < range_ and absf(dy) < 14: start_attack(s,e,"swing")

func walk_to(e: BmkLegacyActor, tx: float, ty: float, speed: float) -> void:
	var mx: float = tx - e.x
	var my: float = ty - e.y
	var dist: float = BmkViesaController.js_hypot([mx,my])
	if dist > 4:
		e.x += mx / dist * speed
		e.y += my / dist * speed * 0.8
		e.walk = true

func archer_chase(s: BmkWaveSimulation, e: BmkLegacyActor) -> void:
	var p: BmkActorState = s.player
	var dx: float = p.x - e.x
	var dy: float = p.y - e.y
	var adx: float = absf(dx)
	if p.st == "dead": return
	if e.wait > 0:
		e.wait -= 1
		return
	e.face = 1 if dx >= 0 else -1
	var mx: int = 0
	if adx < 190: mx = -e.face
	elif adx > 330: mx = e.face
	var my: float = clampf(dy,-1,1)
	if mx != 0 or absf(dy) > 2:
		e.x += mx * stat(e,"spd")
		e.y += my * stat(e,"spd") * 0.8
		e.walk = true
	e.x = clampf(e.x,s.cam_x + 24,s.cam_x + s.view_width - 24)
	var archers: int = 0
	for other: BmkActorState in s.enemies:
		if other != e and bool((other as BmkLegacyActor).stats.get("ranged",false)) and other.st in ["wind","act"]: archers += 1
	if e.attack_cd <= 0 and archers < 2 and adx > 150 and adx < 360 and absf(dy) < 18 and p.st != "down": start_attack(s,e,"shoot")

func start_attack(s: BmkWaveSimulation, e: BmkLegacyActor, pat: String) -> void:
	e.pat = pat
	e.st = "wind"
	e.t = 0
	e.hit_player = false
	e.face = 1 if s.player.x >= e.x else -1
	e.form = "heavy" if e.type == "brute" and s.rnd() < 0.4 else "atk"
	s.sound("bwind")

## feel-runtime.js swingZone(): reachZone(e, 'rect', range + pad, depth, height).
func swing_zone(s: BmkWaveSimulation, e: BmkLegacyActor) -> BmkHitZone:
	var hit: Dictionary = s.wave_data.source["ENEMIES"]["hit"]
	var k: float = 0.9 if s.player.is_viesa() else 1.0
	var zone: BmkHitZone = BmkHitZone.new()
	zone.ex = e.x
	zone.face = e.face if e.face != 0 else 1
	zone.back = -8
	zone.reach = stat(e,"range") + float(hit["reachPadPx"]) + s.player.hw
	zone.y = e.y
	zone.ez = e.z
	zone.depth = float(hit["depthPx"]) * k
	zone.max_height = float(hit["heightPx"]) * k
	zone.relative_height = true
	zone.knockdown = bool(e.stats.get("kd",false))
	zone.active = e.st == "act"
	zone.progress = 1.0 if zone.active else clampf(e.t / stat(e,"wind"),0,1)
	zone.hit_in = 0 if zone.active else int(stat(e,"wind")) - e.t
	return zone

func attack_zone(sim: BmkSimulation, actor: BmkActorState) -> BmkHitZone:
	var e: BmkLegacyActor = actor as BmkLegacyActor
	if e == null or e.boss or e.pat != "swing" or e.st not in ["wind","act"]: return null
	return swing_zone(s_of(sim),e)

# ------------------------------------------------------------------ boss state (game.js)
func reset_boss_fx(e: BmkLegacyActor) -> void:
	e.pat = ""
	e.alpha = 1
	e.invulnerable = false

func start_pat(s: BmkWaveSimulation, e: BmkLegacyActor, pat: String) -> void:
	reset_boss_fx(e)
	e.st = "pat"
	e.pat = pat
	e.pt = 0
	e.marks.clear()
	e.last = pat
	e.face = 1 if s.player.x >= e.x else -1
	if e.type == "boss2": s.morgra.init_pattern(e)
	s.sound("bwind")

func end_pat(sim: BmkSimulation, actor: BmkActorState, next: String = "") -> void:
	var s: BmkWaveSimulation = s_of(sim)
	var e: BmkLegacyActor = actor as BmkLegacyActor
	reset_boss_fx(e)
	e.st = "chase"
	e.t = 0
	e.wait = 0
	e.attack_cd = s.js_round((700 + s.rnd() * 600) * (0.8 if e.type == "boss2" and e.p2shown else 1.0) / MS)
	if not next.is_empty(): start_pat(s,e,next)

func run_pat(s: BmkWaveSimulation, e: BmkLegacyActor) -> void:
	var count: int = s.legacy_hazards.size()
	if e.type == "boss2": s.morgra.run_pattern(s,e)
	for i: int in range(count,s.legacy_hazards.size()):
		var z: BmkLegacyHazard = s.legacy_hazards[i]
		if z.owner == null: z.owner = e
		if z.damage_scale == 0.0: z.damage_scale = (1.5 if e.type == "boss2" else 1.3) if e.p2shown else 1.0

func boss_chase(s: BmkWaveSimulation, e: BmkLegacyActor) -> void:
	var p: BmkActorState = s.player
	var dx: float = p.x - e.x
	var dy: float = p.y - e.y
	var adx: float = absf(dx)
	e.face = 1 if dx >= 0 else -1
	if p.st == "dead": return
	var can: bool = attackers(s,e) < 3 and p.st != "down" and e.attack_cd <= 0
	var tx: float
	var ty: float = p.y
	var range_: float = stat(e,"range")
	if bool(e.stats.get("keepAway",false)): tx = e.x - e.face * 60 if adx < 120 else (p.x - e.face * 170 if adx > 200 else e.x)
	elif can or adx < 220: tx = p.x - e.face * (range_ - 14)
	else:
		tx = p.x - e.face * (150 + (e.id % 3) * 35)
		ty = p.y + (34.0 if e.id % 2 != 0 else -34.0)
	walk_to(e,tx,ty,stat(e,"spd"))
	if can:
		var pat: String = s.morgra.pick(s,e,adx,absf(dy)) if e.type == "boss2" else ""
		if not pat.is_empty(): start_pat(s,e,pat)
		else: e.attack_cd = 12
