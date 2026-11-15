class_name BmkGorathController
extends RefCounted
var actions: BmkGorathActions = BmkGorathActions.new()

func boss(s: BmkStageSimulation) -> BmkStageActor:
	for actor: BmkActorState in s.enemies:
		if (actor as BmkStageActor).boss: return actor as BmkStageActor
	return null

func prepare(s: BmkStageSimulation) -> BmkStageActor:
	var e: BmkStageActor = s.spawn("boss1",s.cam_x + 640 * 0.27,428) as BmkStageActor
	e.st = "intro"
	e.g2.st = "intro"
	e.face = 1
	e.g2.clip = "intro_chop"
	s.player.x = s.cam_x + 666
	s.player.y = 434
	s.player.face = -1
	return e

func begin_intro(s: BmkStageSimulation) -> void:
	var e: BmkStageActor = boss(s)
	if e == null: e = prepare(s)
	if s.boss_phase_debug == 2 or s.boss_ult_debug:
		s.music_requested.emit("boss")
		s.player.x = s.cam_x + 448
		phase_two(s,e)
		if s.boss_ult_debug: e.g2.ult_queue = 1
		return
	s.mode = "bossintro"
	s.intro_ms = 0
	e.g2.intro_i = -1

func tick_fx(s: BmkStageSimulation) -> void:
	s.boss_red += clampf(s.boss_red_to - s.boss_red,-0.03,0.03)
	s.boss_dim += clampf(s.boss_dim_to - s.boss_dim,-0.08,0.08)
	s.boss_white = maxi(0,s.boss_white - 1)
	s.boss_title = maxi(0,s.boss_title - 1)

func intro(s: BmkStageSimulation) -> void:
	var e: BmkStageActor = boss(s)
	var g: BmkGorathState = e.g2
	s.intro_ms += s.MS
	var n: int = int(floor(s.intro_ms / s.MS + 0.000001))
	var timeline: Array = s.stage_data.source["G2_INTRO"]["tl"]
	g.age += 1
	var p: BmkStageActor = s.player as BmkStageActor
	var tx: float = s.cam_x + 448
	if p.x > tx:
		p.x = maxf(tx,p.x - 1.3)
		p.walk = true
		p.face = -1
		p.walk_time += s.MS
	else: p.walk = false
	while g.intro_i + 1 < timeline.size() and int(timeline[g.intro_i + 1]["at"]) <= n:
		g.intro_i += 1
		var step_: Dictionary = timeline[g.intro_i]
		match str(step_.get("ev","")):
			"hush": s.music_requested.emit("stop")
			"chop":
				s.sound("g2chop")
				s.shake = maxf(s.shake,1)
			"smash":
				s.sound("slam")
				s.shake = maxf(s.shake,10)
			"roar":
				s.sound("g2roar")
				s.music_requested.emit("boss")
				g.card_t = 1
	g.clip = str(timeline[maxi(0,g.intro_i)]["clip"])
	g.fi = int(timeline[maxi(0,g.intro_i)]["fi"])
	if g.card_t > 0: g.card_t += 1
	tick_fx(s)
	if s.shake > 0: s.shake *= 0.85
	if s.flash_t > 0: s.flash_t -= s.MS
	if s.intro_ms + 0.001 >= float(s.stage_data.source["G2_INTRO"]["total"]) * s.MS:
		s.mode = "play"
		e.st = "chase"
		e.attack_cd = 40
		p.inv = maxi(p.inv,18)
		p.quiet_inv_until = s.tick + p.inv

func step(s: BmkStageSimulation, e: BmkStageActor) -> void:
	var g: BmkGorathState = e.g2
	var d: BmkStageData = s.stage_data
	e.t += 1
	g.age += 1
	if e.flash > 0: e.flash -= 1
	if e.inv > 0: e.inv -= 1
	if e.attack_cd > 0: e.attack_cd -= 1
	e.hr += s.MS
	e.walk = false
	e.z = 0
	e.vz = 0
	e.vx = 0
	g.jitter = 0
	if g.bar_blink > 0: g.bar_blink -= 1
	if g.card_t > 0: g.card_t += 1
	if e.st not in ["stun","dead"]:
		if e.gr_t > 0: e.gr_t -= 1
		elif e.gr > 0: e.gr = maxf(0,e.gr - 0.2)
	tick_fx(s)
	if e.st != g.st:
		if g.st == "pat" or g.hook != null or g.grabbing: cancel(s,e)
		if e.st == "chase" and g.st != "hurt": g.tail = 0
	match e.st:
		"chase": chase(s,e)
		"pat": actions.step(s,e)
		"hurt":
			var duration: int = int(d.g2("hurt",g.phase - 1))
			g.clip = ("p2_hit_low" if e.hit_low else "p2_hit_high") if g.phase == 2 else "p1_hit"
			g.fi = mini(2 if g.phase == 2 else 5,int(floor(float(e.t) / duration * (3 if g.phase == 2 else 6))))
			if e.t > duration:
				e.st = "chase"
				e.t = 0
				g.tail = 0 if g.phase == 2 else 4
		"down":
			g.clip = pre(g) + "knockdown"
			g.fi = mini(d.clip_length(g.clip) - 1,int(floor((e.t - 1) / d.g2("kdTpf"))))
			if e.t == (d.mark(g.clip,"land") - 1) * int(d.g2("kdTpf")) + 1:
				s.shake = maxf(s.shake,8)
				s.sound("land")
			if e.t > d.clip_length(g.clip) * d.g2("kdTpf") + (30 if g.pending_t else d.g2("lying",g.phase - 1)):
				e.st = "rec"
				e.t = 0
				e.invulnerable = true
		"rec":
			g.clip = pre(g) + "getup"
			var tpf: float = d.g2("getupTpf",g.phase - 1)
			g.fi = mini(d.clip_length(g.clip) - 1,int(floor((e.t - 1) / tpf)))
			e.invulnerable = true
			if e.t > d.clip_length(g.clip) * tpf:
				if g.pending_t:
					g.pending_t = false
					start_transform(s,e)
				else:
					e.invulnerable = false
					e.st = "chase"
					e.t = 0
					e.attack_cd = s.js_round(s.random_between(15,35))
		"stun":
			g.clip = "p2_hit_high" if g.phase == 2 else "p1_hit"
			g.fi = 2
			if e.t >= 300:
				e.st = "chase"
				e.t = 0
				e.gr = 0
				e.gr_t = 0
				e.attack_cd = s.js_round(s.random_between(30,60))
		"dead": dead_step(s,e)
	actions.tick_hook(s,e)
	actions.tick_meats(s,e)
	g.st = e.st
	e.x = clampf(e.x,s.cam_x + 34,s.cam_x + 606)
	e.y = clampf(e.y,s.walk_top + 10,500)

func pre(g: BmkGorathState) -> String:
	return "p2_" if g.phase == 2 else "p1_"

func idle(s: BmkStageSimulation, e: BmkStageActor) -> void:
	var g: BmkGorathState = e.g2
	if g.tail > 0:
		g.clip = "p1_hit"
		g.fi = 10 - g.tail
		g.tail -= 1
	elif e.walk:
		g.walk_t += s.stage_data.g2("walkRate",g.phase - 1)
		g.clip = pre(g) + "walk"
		g.fi = int(floor(g.walk_t / 6)) % s.stage_data.clip_length(g.clip)
	else:
		g.clip = pre(g) + "idle"
		g.fi = int(floor(g.age / 8.0)) % s.stage_data.clip_length(g.clip)

func chase(s: BmkStageSimulation, e: BmkStageActor) -> void:
	var p: BmkActorState = s.player
	var g: BmkGorathState = e.g2
	var dx: float = p.x - e.x
	var dy: float = p.y - e.y
	var adx: float = absf(dx)
	if p.st == "dead":
		idle(s,e)
		return
	e.face = 1 if dx >= 0 else -1
	if g.phase == 2 and g.breath <= 0:
		var ratio: float = e.hp / e.max_hp
		var k: int = 0 if not g.ult[0] and ratio <= 0.5 else (1 if not g.ult[1] and ratio <= 0.35 else -1)
		if k >= 0 or g.ult_queue > 0:
			if k >= 0: g.ult[k] = true
			else: g.ult_queue -= 1
			actions.start_ult(s,e)
			return
	if g.breath > 0:
		g.breath -= 1
		idle(s,e)
		return
	var stop: float = maxf(60,float(s.stage_data.move(g.want)["range"]) * 0.8) if not g.want.is_empty() else 72.0
	var mx: float = p.x - e.face * stop - e.x if adx > stop + 6 else 0.0
	var my: float = dy if absf(dy) > 6 else 0.0
	var distance: float = sqrt(mx * mx + my * my)
	if distance > 5:
		var speed: float = s.stage_data.g2("spd",g.phase - 1)
		e.x += mx / distance * speed
		e.y += my / distance * speed * 0.8
		e.walk = true
	idle(s,e)
	if e.attack_cd > 0 or p.st == "down": return
	if g.want.is_empty():
		var band: String = "near" if adx < 115 else ("mid" if adx < 250 else "far")
		var choices: Array = []
		var sum: float = 0
		for pair: Array in s.stage_data.source["G2_PICK"][g.phase - 1][band]:
			if pair[0] != g.last:
				choices.append(pair)
				sum += float(pair[1])
		var r: float = s.random_between(0,1) * sum
		var pick: String = str(choices[0][0])
		for pair: Array in choices:
			r -= float(pair[1])
			if r < 0:
				pick = str(pair[0])
				break
		if pick == "walk":
			e.attack_cd = 40
			g.last = "walk"
			return
		g.want = pick
		g.want_t = 0
	if adx <= float(s.stage_data.move(g.want)["range"]) and absf(dy) <= 34: start_move(s,e,g.want)
	else:
		g.want_t += 1
		if g.want_t > 70:
			g.want = ""
			e.attack_cd = 8

func start_move(s: BmkStageSimulation, e: BmkStageActor, id: String, linked: bool = false) -> void:
	var g: BmkGorathState = e.g2
	g.act = BmkGorathAction.new()
	g.act.id = id
	g.act.linked = linked
	g.want = ""
	g.want_t = 0
	if not linked: g.last = id
	e.st = "pat"
	e.pat = id
	e.t = 0
	g.st = "pat"
	if not linked:
		e.face = 1 if s.player.x >= e.x else -1
		s.sound("bwind")

func cancel(s: BmkStageSimulation, e: BmkStageActor) -> void:
	var p: BmkStageActor = s.player as BmkStageActor
	if p.grab != null and p.grab.kind == "gorath" and p.grab.owner == e: release_grab(s,"cancel")
	e.g2.hook = null
	e.g2.grabbing = false
	e.g2.act = null
	e.g2.want = ""
	e.g2.want_t = 0
	e.pat = ""

func end_act(s: BmkStageSimulation, e: BmkStageActor) -> void:
	var gap: Array = s.stage_data.source["G2"]["gap"][e.g2.phase - 1]
	e.g2.act = null
	e.g2.hook = null
	e.g2.grabbing = false
	e.pat = ""
	e.st = "chase"
	e.t = 0
	e.attack_cd = s.js_round(s.random_between(float(gap[0]),float(gap[1])))

func start_transform(s: BmkStageSimulation, e: BmkStageActor) -> void:
	e.st = "pat"
	e.g2.st = "pat"
	e.pat = "transform"
	e.t = 0
	e.invulnerable = true
	e.hp = 0
	e.max_hp = s.stage_data.g2("hp",1)
	e.g2.act = BmkGorathAction.new()
	e.g2.act.kind = "transform"

func phase_two(s: BmkStageSimulation, e: BmkStageActor) -> void:
	var g: BmkGorathState = e.g2
	g.phase = 2
	g.act = null
	g.hook = null
	g.grabbing = false
	g.pending_t = false
	g.tail = 0
	g.last = ""
	g.want = ""
	e.max_hp = s.stage_data.g2("hp",1)
	e.hp = e.max_hp
	reset_stagger(e)
	s.boss_red_to = 1
	e.invulnerable = false
	e.pat = ""
	e.st = "chase"
	g.st = "chase"
	e.t = 0
	e.attack_cd = 30

func reset_stagger(e: BmkStageActor) -> void:
	e.gr = 0
	e.gr_t = 0
	e.next_kd = e.max_hp * 0.75
	e.hr = 9999
	e.flash = 0

func damage(s: BmkStageSimulation, e: BmkStageActor, value: float, kd: bool, kind: int, fixed_damage: bool, attack: String) -> void:
	var g: BmkGorathState = e.g2
	if g.guard or e.st == "intro":
		if g.guard and s.tick - g.block_t > 5:
			g.block_t = s.tick
			s.sound("g2block")
		return
	if e.st == "dead" or e.invulnerable: return
	var stunned: bool = e.st == "stun"
	var damage_: float = value
	if stunned and not fixed_damage: damage_ = s.js_round(damage_ * 1.5)
	if not fixed_damage: damage_ = s.js_round(damage_ * (1 + minf(0.5,0.05 * s.chain_n)))
	var threshold: int = -1
	if g.phase == 2 and damage_ > 0:
		for i: int in range(2):
			if not g.ult[i] and e.hp - damage_ <= e.max_hp * s.stage_data.g2("ult",i):
				threshold = i
				damage_ = maxf(0,e.hp - e.max_hp * s.stage_data.g2("ult",i))
				break
	s.chain_n += 1
	s.chain_t = 1700
	s.chain_max = maxi(s.chain_max,s.chain_n)
	var tier: BmkGradeData = s.data.grade(attack,kd,kind)
	e.hp -= damage_
	if damage_ > 0: s.sound("hurt")
	e.flash = tier.flash
	var move: BmkAttackData = s.data.attack(attack)
	s.hit_stop = maxi(s.hit_stop,maxi(tier.hitstop,move.hitstop if move != null else (s.data.dash_attack_stop if attack == "dashAttack" else 0)))
	s.shake = maxf(s.shake,tier.shake)
	var dir: int = 1 if s.player.x <= e.x else -1
	e.hr = 0
	e.hit_direction = dir
	s.last_hit_id = e.id
	s.last_tier = tier.id
	e.hit_low = not (s.player.z > 20 or s.player.st == "special") and (attack == "c2" or s.player.st == "dash" or s.player.st == "skill" and s.player.skill == "thrust")
	s.impact(e.x - dir * e.hw * 0.6,e.y,70,kind)
	if s.player.st != "special": s.sound("swordHit",kind)
	if threshold >= 0:
		g.ult[threshold] = true
		cancel(s,e)
		e.gr = 0
		e.gr_t = 0
		e.invulnerable = false
		e.z = 0
		e.vx = 0
		e.vz = 0
		g.breath = 0
		g.tail = 0
		actions.start_ult(s,e)
		return
	if e.hp <= 0:
		if g.phase == 1:
			var down: bool = e.st == "down" and g.st == "down"
			cancel(s,e)
			e.hp = 0
			e.invulnerable = true
			e.flash = 6
			s.hit_stop = maxi(s.hit_stop,12)
			s.shake = maxf(s.shake,8)
			g.bar_blink = 30
			if down: g.pending_t = true
			else: start_transform(s,e)
		else:
			e.hp = 0
			e.st = "dead"
			e.t = 0
			e.pat = ""
			s.player.score += e.d.score
			s.item_controller.enemy_drop(s,e)
			cancel(s,e)
			g.meats.clear()
			g.guard = false
			g.st = "dead"
			g.dark = 0
			e.invulnerable = false
			e.vx = 0
			e.vz = 0
			s.slow_request = 30 * s.MS / 0.3
			s.boss_white = 2
			s.boss_dim_to = 0
			s.boss_red_to = 0
			s.shake = maxf(s.shake,12)
			s.fire_hazards.clear()
			s.sound("bossdie")
		return
	if stunned: return
	e.gr = minf(e.gr_max,e.gr + damage_ * 0.9)
	e.gr_t = 150
	if e.gr >= e.gr_max:
		e.pat = ""
		e.invulnerable = false
		e.st = "stun"
		e.t = 0
		e.vx = 0
		e.z = 0
		e.vz = 0
		s.shake = 16
		s.hit_stop = 10
		s.sound("groggy")
	elif e.hp <= e.next_kd:
		e.next_kd -= e.max_hp * 0.25
		e.pat = ""
		e.invulnerable = false
		e.st = "down"
		e.t = 0
		e.vz = 5
		e.vx = dir * 3
	elif e.st in ["chase","rec"]:
		e.st = "hurt"
		e.t = 0
		e.vx = dir

func dead_step(s: BmkStageSimulation, e: BmkStageActor) -> void:
	var d: BmkStageData = s.stage_data
	e.g2.clip = "death"
	e.g2.fi = mini(d.clip_length("death") - 1,int(floor((e.t - 1) / 5.0)))
	e.flash = 0
	if e.t == (d.mark("death","land") - 1) * 5 + 1:
		s.shake = maxf(s.shake,8)
		s.sound("land")
	var after: int = e.t - d.clip_length("death") * 5
	e.g2.dark = clampf(after / 60.0,0,1) * 0.3
	if after >= 60:
		s.sound("g2crowd")
		s.remains.append(e)
		e.remove = true

func grab_step(s: BmkStageSimulation) -> void:
	actions.grab_step(s)

func release_grab(s: BmkStageSimulation, result: String) -> void:
	actions.release_grab(s,result)
