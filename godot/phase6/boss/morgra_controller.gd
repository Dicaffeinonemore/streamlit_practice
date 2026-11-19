class_name BmkMorgraController
extends RefCounted
## morgra-runtime.js: patterns, events, projectiles, crows, revival and hover, line by line.
const MS: float = 1000.0 / 60.0
var data: BmkWaveData

func _init(source: BmkWaveData = null) -> void:
	data = source if source != null else BmkWaveData.shared()

func revive_value(key: String) -> float:
	return float(data.source["MORGRA_REVIVE"][key])

## morgraDrawing(id, f): the drawing active at frame f (looping clips wrap).
func drawing(id: String, f: float) -> Dictionary:
	var d: Dictionary = data.move(id)
	if bool(d.get("loop",false)): f = fmod(f,float(d["total_frames"]))
	var drawings: Array = d["drawings"]
	for a: Dictionary in drawings:
		if f < float(a["start"]) + float(a["duration"]): return a
	return drawings[-1]

func resolve(e: BmkLegacyActor, pat: String) -> String:
	var table: Dictionary = {"orbs":"p2_bolt","ravens":"p2_summon","feather":"p2_curtain","staff":"aerial_slash","soul":"moon","teleport":"p2_teleport"} if e.p2shown else {"orbs":"magic_bolt","ravens":"summon","feather":"curtain","staff":"staff_swing","soul":"magic_bolt"}
	return str(table.get(pat,pat))

func init_pattern(e: BmkLegacyActor) -> void:
	e.morgra_move = resolve(e,e.pat)
	e.morgra_x = e.x
	e.morgra_lane = e.y
	e.morgra_hit = false
	if e.morgra_move == "moon":
		e.moon_used = true
		e.morgra_cooldown = 600

func pick(s: BmkWaveSimulation, e: BmkLegacyActor, dx: float, dy: float) -> String:
	if e.p2shown and (not e.moon_used or e.morgra_cooldown == 0): return "moon"
	var choices: Array
	if e.p2shown: choices = ["aerial_slash","aerial_slash","p2_teleport","p2_bolt"] if dx < 115 and dy < 25 else ["crow_rush","p2_bolt","p2_curtain","p2_summon"]
	else: choices = ["staff_swing","staff_swing","teleport"] if dx < 110 and dy < 25 else ["magic_bolt","magic_bolt","curtain","summon"]
	var fresh: Array = choices.filter(func(x: String) -> bool: return x != e.last)
	return str(fresh[floori(s.rnd() * fresh.size())])

func hover(e: BmkLegacyActor) -> float:
	if not e.p2shown or e.st in ["dead","down","stun","reviving"]: return 0.0
	if e.st == "pat" and e.morgra_move == "aerial_slash" and e.pt / MS >= 22 and e.pt / MS < 53: return 0.0
	return 18.0

func armored(e: BmkLegacyActor) -> bool:
	if e.type != "boss2" or e.st != "pat": return false
	for range_: Array in data.move(e.morgra_move).get("super_armor",[]):
		if e.pt / MS >= float(range_[0]) and e.pt / MS <= float(range_[1]): return true
	return false

func fx(s: BmkWaveSimulation, id: String, x: float, y: float, h: float, owner: BmkLegacyActor, life: float) -> BmkLegacyHazard:
	var z: BmkLegacyHazard = s.add_hazard("morgra",x,y,h)
	z.fx = id
	z.life = life
	z.visual = true
	z.owner = owner
	z.face = owner.face if owner != null else 1
	return z

func spawn_event(s: BmkWaveSimulation, e: BmkLegacyActor, event: Dictionary) -> void:
	var scale: float = data.morgra_scale()
	var p: BmkActorState = s.player
	var id: String = str(event["id"])
	var offset: Array = event.get("offset",[0,0])
	var x: float = e.x + e.face * float(offset[0]) * scale
	var y: float = e.y
	var h: float = float(offset[1]) * scale
	var vw: float = s.view_width
	match id:
		"bolt", "feather_shot":
			for dy: Variant in event.get("dz",[0]):
				push(s,e,id,e.x + e.face * 42,e.y + float(dy),55)
			s.sound("orb")
		"crow":
			var cap: int = 5 if e.p2shown else 3
			var alive: int = 0
			for z: BmkLegacyHazard in s.legacy_hazards:
				if z.owner == e and z.kind == "crow" and not z.dead: alive += 1
			var count: int = int(event.get("count",0))
			for i: int in range(mini(count if count != 0 else cap,cap - alive)):
				push(s,e,"crow",e.x + e.face * (30 + i * 18),e.y + (i - 1) * 16,95 + i * 8)
			s.sound("raven")
		"warning_circle":
			for dy: int in ([-30,0,30] if e.p2shown else [0]):
				var z: BmkLegacyHazard = push(s,e,"pillar",p.x,clampf(p.y + dy,s.ground_top + 10,s.ground_bottom),0)
				z.delay = 36 if e.p2shown else 45
		"giant_raven":
			push(s,e,id,e.x + e.face * 35,e.morgra_lane,55)
			s.sound("raven")
		"safe_zone":
			var left_half: bool = p.x < s.cam_x + vw / 2
			e.morgra_safe = [PackedFloat64Array([clampf(p.x + (150 if left_half else -150),s.cam_x + 55,s.cam_x + vw - 55),clampf(p.y,s.ground_top + 22,s.ground_bottom - 22)]),
				PackedFloat64Array([s.cam_x + vw - 65 if left_half else s.cam_x + 65,clampf(p.y + 50,s.ground_top + 22,s.ground_bottom - 22)])]
			var z: BmkLegacyHazard = push(s,e,"moon_field",s.cam_x + vw / 2,p.y,0)
			z.safe = e.morgra_safe
			z.delay = 96
			z.life = 120
		"moon_beam":
			s.sound("pillar")
			s.shake = maxf(s.shake,12)
		"moon":
			fx(s,"moon",s.cam_x + vw / 2,s.ground_top,105,e,162)
		_:
			fx(s,id,x,y,h,e,12 if id == "staff_arc" else 24)

func push(s: BmkWaveSimulation, e: BmkLegacyActor, kind: String, x: float, y: float, h: float) -> BmkLegacyHazard:
	var z: BmkLegacyHazard = s.add_hazard("morgra",x,y,h)
	z.kind = kind
	z.owner = e
	z.face = e.face
	z.damage_scale = 1.5 if e.p2shown else 1.0
	return z

func run_pattern(s: BmkWaveSimulation, e: BmkLegacyActor) -> void:
	if e.morgra_move.is_empty(): init_pattern(e)
	var id: String = e.morgra_move
	var m: Dictionary = data.move(id)
	var f: float = e.pt / MS
	var p: BmkActorState = s.player
	if m.is_empty():
		s.enemy_controller.end_pat(s,e)
		return
	var d: Dictionary = drawing(id,f)
	e.invulnerable = false
	for range_: Array in m.get("invulnerable",[]):
		if f >= float(range_[0]) and f <= float(range_[1]): e.invulnerable = true
	e.alpha = 0.0 if str(d.get("clip","")) == "hidden" or id == "crow_rush" and f >= 30 and f < 36 else 1.0
	var events: Array = m.get("events",[])
	for i: int in range(events.size()):
		var event: Dictionary = events[i]
		if f < float(event["frame"]) or e.marks.has("event%d" % i): continue
		e.marks["event%d" % i] = true
		var type: String = str(event["type"])
		if type == "spawn": spawn_event(s,e,event)
		if type == "align": e.morgra_lane = p.y
		if type == "move" and str(event["id"]) in ["teleport","reappear_180px_past_player"]:
			fx(s,"teleport_burst",e.x,e.y,0,e,24)
			var left_half: bool = p.x < s.cam_x + s.view_width / 2
			e.x = clampf(p.x + (1 if left_half else -1) * (180 if e.p2shown else 240),s.cam_x + 35,s.cam_x + s.view_width - 35)
			e.y = clampf(p.y + (0 if e.p2shown else 30),s.ground_top + 10,s.ground_bottom)
			e.face = 1 if p.x >= e.x else -1
			fx(s,"teleport_burst",e.x,e.y,0,e,24)
	if id == "aerial_slash" and f >= 22 and f < 37:
		var speed: float = float(m["move"]["per_drawing"].get(str(int(d["index"])),0))
		e.x += e.face * speed * data.morgra_scale()
	if not e.morgra_hit:
		for hb: Dictionary in d.get("hitboxes",[]):
			var box: Array = hb["box"]
			var k: float = data.morgra_scale()
			var dx: float = (p.x - e.x) * e.face
			var lift: float = hover(e)
			var scale_: float = 0.9 if p.is_viesa() else 1.0
			var half: float = 12 * scale_
			var body: float = s.player_body_height()
			var bx: float = float(box[0])
			var by: float = float(box[1])
			var bw: float = float(box[2])
			var bh: float = float(box[3])
			if dx + half >= bx * k and dx - half <= (bx + bw) * k and absf(p.y - e.y) < float(hb["depth"]) * scale_ and p.z + body >= lift + by * k and p.z <= lift + (by + bh) * k:
				var attack: Dictionary = m["attack"]
				var stun: float = float(attack.get("hitstunTicks",attack.get("hitstun",-1)))
				if s.combat.hurt_player(s,float(attack["damage"]) * s.source_scale(e),e.face,bool(attack.get("knockdown",false)),s.player_impact_height(lift + by * k,lift + (by + bh) * k),stun):
					e.morgra_hit = true
					s.hit_stop = maxi(s.hit_stop,int(attack.get("hitstop",0)))
	if f >= float(m["total_frames"]):
		e.morgra_move = ""
		s.enemy_controller.end_pat(s,e,"cackle" if id == "teleport" and s.rnd() < 0.5 else "")

func update_hazard(s: BmkWaveSimulation, z: BmkLegacyHazard) -> void:
	var f: float = z.age / MS
	var p: BmkActorState = s.player
	var k: float = data.morgra_scale()
	var def: Dictionary = data.projectile(z.kind)
	if z.visual:
		if f >= z.life: z.dead = true
		return
	if z.owner != null and z.owner.st in ["dead","reviving"]:
		z.dead = true
		return
	var scale_: float = 0.9 if p.is_viesa() else 1.0
	if z.kind == "pillar":
		var a: float = f - z.delay
		if a >= 6 and a < 24 and not z.hit and absf(p.x - z.x) < 76 * k and absf(p.y - z.y) < 20 and p.z < 100:
			if s.combat.hurt_player(s,14 * z.damage_scale,int(signf(p.x - z.x)) if p.x != z.x else 1,true,z.h): z.hit = true
		if a >= 30: z.dead = true
		return
	if z.kind == "moon_field":
		var safe: bool = false
		for spot: PackedFloat64Array in z.safe:
			if pow((p.x - spot[0]) / 42,2) + pow((p.y - spot[1]) / 22,2) <= 1: safe = true
		var a: float = f - z.delay
		if a >= 6 and a < 18 and not safe and not z.hit and s.combat.hurt_player(s,22 * z.damage_scale,1,true,z.h): z.hit = true
		if f >= z.life: z.dead = true
		return
	if def.is_empty():
		z.dead = true
		return
	var old_x: float = z.x
	if z.kind == "crow":
		if not z.diving and absf(z.x - p.x) < 120 * k:
			z.diving = true
			var dist: float = maxf(1.0,BmkViesaController.js_hypot([p.x - z.x,p.y - z.y]))
			z.vx = (p.x - z.x) / dist * 3.5
			z.vy = (p.y - z.y) / dist * 3.5
		if z.diving:
			z.x += z.vx
			z.y += z.vy
			z.h = maxf(45,z.h - 4)
		else:
			z.x += signf(p.x - z.x) * float(def["speed"]) * k
			z.y += clampf(p.y - z.y,-0.6,0.6)
	else: z.x += z.face * float(def["speed"]) * k
	var box: Array = def["hitbox"]
	var bx: float = float(box[0])
	var by: float = float(box[1])
	var bw: float = float(box[2])
	var bh: float = float(box[3])
	var left: float = minf(old_x,z.x) + minf(bx * z.face,(bx + bw) * z.face) * k
	var right: float = maxf(old_x,z.x) + maxf(bx * z.face,(bx + bw) * z.face) * k
	if p.x + 10 * scale_ >= left and p.x - 10 * scale_ <= right and absf(p.y - z.y) < float(def["depth"]) * scale_ and p.z + minf(85 * scale_,s.player_body_height()) >= z.h + by * k and p.z <= z.h + (by + bh) * k:
		var stun: float = float(def.get("hitstunTicks",def.get("hitstun",-1)))
		if s.combat.hurt_player(s,float(def["damage"]) * z.damage_scale,z.face,bool(def.get("knockdown",false)),s.player_impact_height(z.h + by * k,z.h + (by + bh) * k),stun):
			z.dead = true
			fx(s,"bolt_hit",z.x,z.y,z.h,z.owner,18)
	if f > float(def.get("lifetime",160)) or z.x < s.cam_x - 150 or z.x > s.cam_x + s.view_width + 150: z.dead = true

func strike_crows(s: BmkWaveSimulation, reach: float, behind: float, ox: float, oy: float, oz: float, face: int) -> void:
	var i: int = 0
	while i < s.legacy_hazards.size():
		var h: BmkLegacyHazard = s.legacy_hazards[i]
		i += 1
		var dx: float = (h.x - ox) * face
		if h.kind == "crow" and not h.dead and dx >= -behind - 15 and dx <= reach + 15 and absf(h.y - oy) < 26 and absf(h.h - (oz + 55)) < 55:
			h.dead = true
			h.owner.gr = minf(h.owner.gr_max,h.owner.gr + 8)
			h.owner.gr_t = 150
			s.sound("hurt")
			fx(s,"bolt_hit",h.x,h.y,h.h,h.owner,18)

func begin_revival(s: BmkWaveSimulation, e: BmkLegacyActor) -> void:
	s.enemy_controller.reset_boss_fx(e,s)
	e.hp = 0
	e.gr = 0
	e.gr_t = 0
	e.st = "reviving"
	e.t = 0
	e.invulnerable = true
	e.remove = false
	e.z = 0
	e.vz = 0
	e.vx = 0
	s.clear_boss_hazards()
	s.sound("bossdie")
	s.hit_stop = maxi(s.hit_stop,8)

func update_revival(s: BmkWaveSimulation, e: BmkLegacyActor) -> void:
	e.t += 1
	e.walk = false
	e.flash = 0
	var rise_at: int = int(revive_value("death") + revive_value("wait"))
	if e.t == rise_at + 62:
		s.sound("phase2")
		s.shake = maxf(s.shake,10)
	if e.t < rise_at + int(revive_value("rise")): return
	e.p2shown = true
	e.hp = revive_value("hp")
	e.max_hp = e.hp
	e.gr = 0
	e.gr_max = revive_value("groggy")
	e.gr_t = 0
	e.next_kd = e.max_hp * 0.75
	e.invulnerable = false
	e.inv = 0
	e.st = "rec"
	e.t = 0
	e.recovery_t = 45
	e.morgra_move = ""
	e.moon_used = false
	e.morgra_cooldown = 0
	e.z = 0
	s.player.inv = maxi(s.player.inv,45)
