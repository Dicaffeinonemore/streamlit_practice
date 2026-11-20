class_name BmkGrabController
extends RefCounted

func begin(s: BmkStageSimulation, e: BmkStageActor, kind: String) -> void:
	var p: BmkStageActor = s.player as BmkStageActor
	e.st = "grabbing"
	e.t = 0
	e.mv = null
	e.dive = null
	e.pat = ""
	e.bite = kind == "bite"
	if e.bite: e.z = 4
	p.st = "grabbed"
	p.t = 0
	p.grab = BmkGrabState.new()
	p.grab.owner_ref = weakref(e)
	p.grab.kind = kind
	p.vx = 0
	p.vz = 0
	p.skill = ""
	p.combo = 0
	p.combo_t = 0
	p.buf = 0
	p.walk = false
	s.input.clear()
	s.sound("hit",1)
	s.impact(p.x,p.y,40 if e.bite else 70,1)

func step(s: BmkStageSimulation) -> void:
	var p: BmkStageActor = s.player as BmkStageActor
	var g: BmkGrabState = p.grab
	if g != null and g.kind == "gorath":
		s.gorath.grab_step(s)
		return
	if g != null and g.kind == "sovereign":
		(s as BmkWaveSimulation).sovereign.grab_step(s as BmkWaveSimulation)
		return
	var e: BmkStageActor = g.owner if g != null else null
	if g == null or e == null or not s.enemies.has(e) or e.st != "grabbing":
		release(s,"cancel")
		return
	p.t += 1
	p.walk = false
	p.vx = 0
	p.vz = 0
	s.input.dash_request = 0
	for code: String in s.stage_data.source["GORATH_ESCAPE_KEYS"]:
		if s.input.hit([code]): g.presses += 1
	s.input.pressed.clear()
	var bite: bool = g.kind == "bite"
	if g.presses >= (2 if bite else 4):
		release(s,"escape")
		return
	var art: Dictionary = s.stage_data.source["STAGE1_ENEMY_ART"]["hound" if bite else "heavy"]
	var clip: String = "dive" if bite else "choke"
	var hand: Array = art["frames"][int(art["clips"][clip][4])]["hand"]
	if bite:
		e.x = p.x - e.face * float(hand[0])
		e.y = p.y - 1
		p.z = 0
	else:
		p.x = e.x + e.face * float(hand[0])
		p.y = e.y + 1
		p.z = maxf(0,float(hand[1]) - 0.8 * 102.24)
		p.face = -e.face
	g.t += 1
	if g.t % (30 if bite else 40) == 0:
		var damage: int = 2 if bite else 3
		s.stat_damage += minf(p.hp,damage)
		p.hp -= damage
		p.flash = 5
		s.sound("hurt")
		s.shake = maxf(s.shake,3)
		if p.hp <= 0:
			release(s,"cancel")
			kill_player(s,0)
			return
		g.squeezes += 1
	if (bite and g.t >= 90) or (not bite and g.squeezes >= 3): release(s,"end" if bite else "throw")

func kill_player(s: BmkStageSimulation, direction: int) -> void:
	var p: BmkActorState = s.player
	p.hp = 0
	p.lives -= 1
	s.stat_deaths += 1
	p.st = "dead"
	p.t = 0
	p.vz = 6
	p.vx = direction * 4
	s.sound("pdie")

func release(s: BmkStageSimulation, result: String) -> void:
	var p: BmkStageActor = s.player as BmkStageActor
	var g: BmkGrabState = p.grab
	if g == null: return
	if g.kind == "gorath":
		s.gorath.release_grab(s,result)
		return
	var e: BmkStageActor = g.owner
	p.grab = null
	p.st = "free"
	p.t = 0
	p.z = 0
	p.vx = 0
	p.vz = 0
	s.input.clear()
	if e != null and e.st == "grabbing":
		e.st = "chase"
		e.t = 0
		e.attack_cd = 40
	if g.kind == "bite" and e != null and s.enemies.has(e) and e.st != "dead":
		e.bite = false
		e.st = "hurt"
		e.t = 0
		e.hurt_t = 24
		e.vx = -e.face * 4
		e.z = 0
		e.vz = 0
		e.hr = 0
		e.dive_cd = s.js_round(s.random_between(150,200))
	if result == "escape":
		p.inv = maxi(p.inv,30)
		if e != null and g.kind != "bite":
			e.st = "hurt"
			e.t = 0
			e.hurt_t = 30
			e.vx = 0
			e.hr = 0
			s.impact(e.x,e.y,70,1)
			s.sound("hit")
	elif result == "throw":
		p.inv = 0
		s.combat.hurt_player(s,6,e.face if e != null else 1,true)
		p.inv = maxi(p.inv,30)
	elif result != "hit": p.inv = maxi(p.inv,30)

