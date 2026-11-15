class_name BmkGorathActions
extends RefCounted

func step(s: BmkStageSimulation, e: BmkStageActor) -> void:
	var a: BmkGorathAction = e.g2.act
	if a == null:
		s.gorath.end_act(s,e)
		return
	match a.kind:
		"move": move_step(s,e,a)
		"hookFly":
			e.g2.fi = s.stage_data.clip_length(e.g2.clip) - 1
			if e.g2.hook == null: s.gorath.end_act(s,e)
		"hookPull": pull_step(s,e,a)
		"transform": transform(s,e,a)
		"ult": ultimate(s,e,a)

func move_step(s: BmkStageSimulation, e: BmkStageActor, a: BmkGorathAction) -> void:
	var m: Dictionary = s.stage_data.move(a.id)
	var g: BmkGorathState = e.g2
	var p: BmkActorState = s.player
	a.t += 1
	var accumulated: int = 0
	var i: int = 0
	var lengths: Array = m["len"]
	while i < lengths.size() and a.t > accumulated + int(lengths[i]):
		accumulated += int(lengths[i])
		i += 1
	if i >= lengths.size():
		if bool(m.get("hook",false)) and g.hook != null: a.kind = "hookFly"
		else: s.gorath.end_act(s,e)
		return
	var fn: int = i + 1
	var first: bool = a.f != fn or a.t == 1
	a.f = fn
	g.clip = str(m["clip"])
	g.fi = i
	if fn <= int(m["warnTo"]) and not a.linked: e.y += clampf(p.y - e.y,-1.3,1.3)
	if m.has("step"):
		var step_: Dictionary = m["step"]
		if fn >= int(step_["f"][0]) and fn <= int(step_["f"][1]):
			var ticks: int = 0
			for f: int in range(int(step_["f"][0]) - 1,int(step_["f"][1])): ticks += int(lengths[f])
			if first and fn == int(step_["f"][0]): s.sound(str(m.get("sound","bcharge" if bool(m.get("dust",false)) else "bswing")))
			e.x += e.face * float(step_["px"]) / ticks
	if bool(m.get("hook",false)) and fn == s.stage_data.mark(g.clip,"release") and not a.thrown:
		a.thrown = true
		var hand_: PackedFloat64Array = hand(s,e)
		g.hook = BmkGorathHook.new()
		g.hook.x = hand_[0]
		g.hook.x0 = hand_[0]
		g.hook.y = e.y
		g.hook.h = hand_[1]
		g.hook.dir = e.face
		s.sound("g2hook")
	var hits: Array = m.get("hits",[])
	for k: int in range(hits.size()):
		var hit: Dictionary = hits[k]
		var box: Dictionary = s.stage_data.source["G2A"]["hits"][g.clip][k]
		if fn < int(box["f"][0]) or fn > int(box["f"][1]): continue
		var sound_key: String = "s%d" % k
		if not a.used.has(sound_key):
			a.used[sound_key] = true
			if not m.has("step"): s.sound("bswing")
			if hit.has("slam"):
				s.shake = maxf(s.shake,float(hit["slam"]))
				s.sound("slam")
		if a.used.has(str(k)): continue
		var gr: BmkGrabState = (p as BmkStageActor).grab
		if a.linked and gr != null and gr.kind == "gorath" and gr.owner == e:
			a.used[str(k)] = true
			linked_hit(s,e,m,hit,k)
			continue
		var dx: float = (p.x - e.x) * e.face
		var radial: bool = bool(hit.get("radial",false))
		var inside: bool = dx > float(box["back"]) - 14 and dx < float(box["reach"]) + 14 if radial else dx > -8 and dx < float(box["reach"]) + p.hw
		if inside and absf(p.y - e.y) < 26 and p.z < 70 and s.combat.hurt_player(s,s.js_round(float(hit["dmg"])),int(signf(p.x - e.x)) if radial and p.x != e.x else e.face,bool(hit.get("kd",false))):
			a.used[str(k)] = true

func linked_hit(s: BmkStageSimulation, e: BmkStageActor, m: Dictionary, hit: Dictionary, k: int) -> void:
	var damage: int = s.js_round(20 * float(hit["link"]))
	if k == (m["hits"] as Array).size() - 1:
		release_grab(s,"hit")
		s.player.inv = 0
		s.combat.hurt_player(s,damage,e.face,true)
		s.player.inv = maxi(s.player.inv,30)
		return
	s.stat_damage += minf(s.player.hp,damage)
	s.player.hp -= damage
	s.player.flash = 5
	s.chain_n = 0
	s.shake = maxf(s.shake,7)
	s.sound("hurt")
	if s.player.hp <= 0:
		release_grab(s,"cancel")
		s.grabs.kill_player(s,e.face)

func hand(s: BmkStageSimulation, e: BmkStageActor) -> PackedFloat64Array:
	var frames: Array = s.stage_data.source["G2A"]["clips"][e.g2.clip]["frames"]
	var raw: Array = (frames[clampi(e.g2.fi,0,frames.size() - 1)] as Dictionary).get("hand",[58,62])
	return PackedFloat64Array([e.x + e.face * float(raw[0]),float(raw[1])])

func tick_hook(s: BmkStageSimulation, e: BmkStageActor) -> void:
	var g: BmkGorathState = e.g2
	var k: BmkGorathHook = g.hook
	var p: BmkStageActor = s.player as BmkStageActor
	if k == null or k.ult: return
	if k.st == "out":
		var old: float = k.x
		k.x += k.dir * 8
		if p.inv <= 0 and p.st not in ["dead","down","special","grabbed"] and p.z < 32 and p.x >= minf(old,k.x) - 18 and p.x <= maxf(old,k.x) + 18 and absf(k.y - p.y) < 14:
			p.st = "grabbed"
			p.t = 0
			p.grab = BmkGrabState.new()
			p.grab.owner_ref = weakref(e)
			p.grab.kind = "gorath"
			p.vx = 0
			p.vz = 0
			p.z = 0
			p.skill = ""
			p.combo = 0
			p.combo_t = 0
			p.buf = 0
			p.walk = false
			s.input.clear()
			k.st = "held"
			k.x = p.x
			k.h = 58
			g.grabbing = true
			var id: String = g.act.id if g.act != null else ("hook2" if g.phase == 2 else "hook")
			g.act = BmkGorathAction.new()
			g.act.kind = "hookPull"
			g.act.id = id
			s.sound("hit",1)
			return
		if absf(k.x - k.x0) >= 640 * 0.55 or k.x < s.cam_x - 10 or k.x > s.cam_x + 650:
			k.st = "back"
			var id: String = g.act.id if g.act != null else ("hook2" if g.phase == 2 else "hook")
			g.act = BmkGorathAction.new()
			g.act.kind = "hookPull"
			g.act.miss = true
			g.act.id = id
	elif k.st == "back":
		var target: PackedFloat64Array = hand(s,e)
		var dx: float = target[0] - k.x
		k.h += clampf(target[1] - k.h,-3,3)
		if absf(dx) <= 14: g.hook = null
		else: k.x += signf(dx) * 14

func pull_step(s: BmkStageSimulation, e: BmkStageActor, a: BmkGorathAction) -> void:
	var m: Dictionary = s.stage_data.move(a.id)
	var g: BmkGorathState = e.g2
	var n: int = s.stage_data.clip_length(str(m["pull"]))
	a.t += 1
	g.clip = str(m["pull"])
	g.fi = mini(n - 1,int(floor((a.t - 1) / float(m["pullTpf"])))) if a.miss else int(floor((a.t - 1) / float(m["pullTpf"]))) % n
	if a.miss:
		if g.hook == null and a.t > n * int(m["pullTpf"]): s.gorath.end_act(s,e)
		return
	if not g.grabbing or g.hook == null:
		s.gorath.end_act(s,e)
		return
	var tx: float = clampf(e.x + e.face * 54,s.cam_x + 20,s.cam_x + 620)
	g.hook.x += clampf(tx - g.hook.x,-6,6)
	if absf(tx - g.hook.x) <= 1 or a.t > 80:
		g.hook.hidden = true
		s.gorath.start_move(s,e,str(m["link"]),true)

func grab_step(s: BmkStageSimulation) -> void:
	var p: BmkStageActor = s.player as BmkStageActor
	var gr: BmkGrabState = p.grab
	var e: BmkStageActor = gr.owner if gr != null else null
	if e == null or not s.enemies.has(e) or e.st != "pat" or not e.g2.grabbing:
		release_grab(s,"cancel")
		return
	p.t += 1
	p.walk = false
	p.z = 0
	p.vz = 0
	p.vx = 0
	s.input.dash_request = 0
	for code: String in s.stage_data.source["GORATH_ESCAPE_KEYS"]:
		if s.input.hit([code]): gr.presses += 1
	s.input.pressed.clear()
	if gr.presses >= 4:
		release_grab(s,"escape")
		return
	var g: BmkGorathState = e.g2
	if g.hook != null and not g.hook.hidden: p.x = clampf(g.hook.x,s.cam_x + 20,s.cam_x + 620)
	p.y += clampf(e.y - p.y,-2,2)
	p.face = -e.face
	if g.act != null and g.act.kind == "hookPull": gr.hold = minf(25,g.act.t * 0.6)
	elif g.act != null and g.act.kind == "move":
		var m: Dictionary = s.stage_data.move(g.act.id)
		var hits: Array = s.stage_data.source["G2A"]["hits"][m["clip"]]
		var end: int = 0
		for i: int in range(int(hits[-1]["f"][0]) - 1): end += int(m["len"][i])
		gr.hold = 50 * (0.5 + 0.5 * minf(1,float(g.act.t) / end))

func release_grab(s: BmkStageSimulation, result: String) -> void:
	var p: BmkStageActor = s.player as BmkStageActor
	var gr: BmkGrabState = p.grab
	if gr == null or gr.kind != "gorath":
		if p.st == "grabbed" and gr == null:
			p.st = "free"
			p.t = 0
		return
	var e: BmkStageActor = gr.owner
	p.grab = null
	p.st = "free"
	p.t = 0
	p.vx = 0
	p.vz = 0
	s.input.clear()
	if e != null:
		e.g2.grabbing = false
		e.g2.hook = null
	if result == "hit": return
	p.inv = maxi(p.inv,30)
	if result == "escape" and e != null:
		e.g2.act = null
		e.pat = ""
		e.gr = minf(e.gr_max,e.gr + 40)
		e.gr_t = 150
		e.t = 0
		e.hr = 0
		e.st = "stun" if e.gr >= e.gr_max else "hurt"
		e.g2.st = e.st
		e.attack_cd = 45
		s.sound("groggy" if e.st == "stun" else "hit")

func transform(s: BmkStageSimulation, e: BmkStageActor, a: BmkGorathAction) -> void:
	var t: Dictionary = s.stage_data.source["G2_TRANSFORM"]
	var step_: int = int(floor(float(a.t) / float(t["tpf"])))
	a.t += 1
	e.invulnerable = true
	e.flash = 0
	var sequence: Array = t["seq"]
	if step_ >= sequence.size():
		s.gorath.phase_two(s,e)
		return
	e.g2.clip = "transform"
	e.g2.fi = int(sequence[step_]) - 1
	var rep: int = int(floor((step_ - int(t["repeatFrom"])) / 2.0)) if step_ >= int(t["repeatFrom"]) and step_ < int(t["burst"]) else -1
	if rep >= 0:
		e.g2.jitter = (1 if s.tick % 2 else -1) * (2 if rep > 0 else 1)
		e.hp = minf(e.max_hp,e.max_hp * (a.t - int(t["repeatFrom"]) * int(t["tpf"])) / ((int(t["burst"]) - int(t["repeatFrom"])) * int(t["tpf"])))
	if step_ != a.step:
		a.step = step_
		if rep >= 0 and (step_ - int(t["repeatFrom"])) % 2 == 0: s.shake = maxf(s.shake,float(t["repeatShake"][rep]))
		if step_ == int(t["burst"]):
			s.shake = maxf(s.shake,14)
			s.boss_white = 2
			e.hp = e.max_hp
			s.gorath.reset_stagger(e)
			s.sound("g2block")
		if step_ == int(t["roar"]):
			s.sound("g2roar")
			s.boss_red_to = 1

func start_ult(s: BmkStageSimulation, e: BmkStageActor) -> void:
	e.st = "pat"
	e.g2.st = "pat"
	e.pat = "ult"
	e.t = 0
	e.face = 1 if s.player.x >= e.x else -1
	e.g2.act = BmkGorathAction.new()
	e.g2.act.kind = "ult"
	e.g2.guard = true
	e.g2.want = ""
	s.boss_dim_to = 1
	s.boss_title = 120
	s.sound("g2roar")

func ultimate(s: BmkStageSimulation, e: BmkStageActor, a: BmkGorathAction) -> void:
	var d: BmkStageData = s.stage_data
	var g: BmkGorathState = e.g2
	a.t += 1
	e.flash = 0
	var n: int = d.clip_length("p2_ult_cast")
	if a.phase == "cast":
		g.clip = "p2_ult_cast"
		g.fi = mini(n - 1,int(floor((a.t - 1) / d.g2("castTpf"))))
		if a.t > n * d.g2("castTpf"):
			a.phase = "fly"
			a.t = 0
			g.hook = BmkGorathHook.new()
			g.hook.ult = true
			s.sound("bwave")
	elif a.phase == "fly":
		g.clip = "p2_ult_cast"
		g.fi = n - 1
		g.hook.u = a.t / d.g2("hookFly")
		if a.t >= d.g2("hookFly"):
			g.hook.u = 1
			a.phase = "shake"
			a.t = 0
			s.shake = maxf(s.shake,8)
			s.sound("slam")
	elif a.phase == "shake":
		var count: int = d.clip_length("p2_ult_shake")
		var f: int = int(floor((a.t - 1) / d.g2("shakeTpf"))) % count
		g.clip = "p2_ult_shake"
		g.fi = f
		if (a.t - 1) % int(d.g2("shakeTpf")) == 0 and f + 1 in PackedInt32Array(d.source["G2A"]["marks"]["p2_ult_shake"]["pull"]):
			a.pulls += 1
			s.shake = maxf(s.shake,5)
			s.sound("g2thud")
			for i: int in range(2):
				if a.pulls % 3 == 0 and i == 0: drop_meat(s,e,"meat_carcass",true)
				else: drop_meat(s,e,"meat_bundle" if s.random_between(0,1) < 0.5 else "meat_bone",s.random_between(0,1) < 0.5)
		if a.t >= count * d.g2("shakeTpf") * d.g2("shakeLoops"):
			a.phase = "recover"
			a.t = 0
			drop_meat(s,e,"meat_carcass",true)
	else:
		var end: int = d.mark("p2_ult_cast","recoverEnd")
		var rel: int = a.t - 6
		g.clip = "p2_ult_cast"
		g.fi = n - 1 if rel <= 0 else maxi(end - 1,n - 1 - int(floor((rel - 1) / d.g2("castTpf"))))
		if g.hook != null:
			g.hook.u = 1 - a.t / (6 + d.g2("castTpf"))
			if g.hook.u <= 0: g.hook = null
		if rel > (n - end + 1) * d.g2("castTpf"):
			g.guard = false
			g.hook = null
			s.boss_dim_to = 0
			g.breath = int(d.g2("breath"))
			g.act = null
			e.pat = ""
			e.st = "chase"
			g.st = "chase"
			e.t = 0
			e.attack_cd = 0

func drop_meat(s: BmkStageSimulation, e: BmkStageActor, kind: String, aimed: bool) -> void:
	var live: Array[BmkMeatState] = e.g2.meats.filter(func(m: BmkMeatState) -> bool: return m.t < 72)
	if live.size() >= 6: return
	var x: float = clampf(s.player.x,s.cam_x + 40,s.cam_x + 600)
	var y: float = clampf(s.player.y,s.walk_top + 10,500)
	if not (aimed and (kind == "meat_carcass" or clear_at(live,x,y))):
		for trial: int in range(10):
			x = s.random_between(s.cam_x + 50,s.cam_x + 590)
			y = s.random_between(s.walk_top + 15,495)
			if clear_at(live,x,y): break
	var meat: BmkMeatState = BmkMeatState.new()
	meat.kind = kind
	meat.x = x
	meat.y = y
	meat.land = s.stage_data.mark(kind,"land")
	meat.start = 72 - (meat.land - 1) * 3
	meat.n = s.stage_data.clip_length(kind)
	meat.spin = 1 if s.random_between(0,1) < 0.5 else -1
	e.g2.meats.append(meat)

func clear_at(live: Array[BmkMeatState], x: float, y: float) -> bool:
	for m: BmkMeatState in live:
		if sqrt(pow(m.x - x,2) + pow(m.y - y,2)) < 80: return false
	return true

func tick_meats(s: BmkStageSimulation, e: BmkStageActor) -> void:
	for m: BmkMeatState in e.g2.meats:
		m.t += 1
		if m.t != 72: continue
		var data: Dictionary = s.stage_data.source["G2_MEAT"][m.kind]
		var radius: float = float(data["r"])
		s.shake = maxf(s.shake,float(data["shake"]))
		s.sound("g2thud")
		if pow((s.player.x - m.x) / radius,2) + pow((s.player.y - m.y) / (radius * 0.35),2) <= 1 and s.player.z <= 60:
			s.combat.hurt_player(s,float(data["dmg"]),1 if s.player.x >= m.x else -1,true)
	e.g2.meats = e.g2.meats.filter(func(m: BmkMeatState) -> bool: return not bool(m.frame().get("dead",false)))
