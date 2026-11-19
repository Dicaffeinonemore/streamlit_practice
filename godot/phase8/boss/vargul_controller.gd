class_name BmkVargulController
extends RefCounted
## vargul-runtime.js: timelines, sword/cross marks, ice orbs and shards, the ultimate and its
## ice waves, the phase transition and death, line by line. State lives in e.vargul.
const MS: float = 1000.0 / 60.0
var data: BmkWaveData
var rules: Dictionary
var k: float
var _progress: Dictionary = {}

func _init(source: BmkWaveData) -> void:
	data = source
	rules = data.source["VARGUL"]["RULES"]
	k = float(rules["scale"])

func state(e: BmkLegacyActor) -> BmkVargulState:
	if e.vargul == null: e.vargul = BmkVargulState.new()
	return e.vargul

func hazards(s: BmkWaveSimulation, e: BmkLegacyActor, kind: String = "") -> Array[BmkLegacyHazard]:
	var result: Array[BmkLegacyHazard] = []
	for z: BmkLegacyHazard in s.legacy_hazards:
		if z.type == "vargul" and z.owner == e and not z.dead and (kind.is_empty() or z.kind == kind): result.append(z)
	return result

func clear_hazards(s: BmkWaveSimulation, e: BmkLegacyActor) -> void:
	for z: BmkLegacyHazard in hazards(s,e): z.dead = true

func warning_ticks(e: BmkLegacyActor, n: float) -> float:
	return roundf(n * 0.85) if e.p2shown else n

func attack_gap(s: BmkWaveSimulation, e: BmkLegacyActor) -> int:
	var gap: Array = rules["gaps"][1 if e.p2shown else 0]
	return s.js_round(float(gap[0]) + s.rnd() * (float(gap[1]) - float(gap[0])))

func punishable(e: BmkLegacyActor) -> bool:
	return e.st == "pat" and e.vargul != null and str(e.vargul.current.get("phase","")) == "R"

func armored(e: BmkLegacyActor) -> bool:
	return e.type == "boss4" and e.st == "pat" and e.vargul != null and bool(e.vargul.current.get("armor",false))

## interceptVargulDamage(): true means the hit is ignored entirely.
func intercept(e: BmkLegacyActor) -> bool:
	if e.st == "intro" or e.phase_t > 0 or e.invulnerable or e.st == "dead": return true
	var a: BmkVargulState = state(e)
	if not punishable(e) and e.st != "stun" and e.st != "down":
		a.pressure += 1
		if a.pressure >= (2 if e.p2shown else 3): a.force_sweep = true
	return false

func reset_pattern(e: BmkLegacyActor) -> void:
	var a: BmkVargulState = state(e)
	a.move = ""
	a.current = {}
	a.timeline = []
	a.timeline_key = ""
	e.z = 0

func init_pattern(s: BmkWaveSimulation, e: BmkLegacyActor) -> void:
	var a: BmkVargulState = state(e)
	var id: String = e.pat
	var defs: Dictionary = data.source["VARGUL"]["TIMELINES"][1 if e.p2shown else 0]
	if not defs.has(id):
		s.enemy_controller.end_pat(s,e)
		return
	a.move = id
	a.timeline = defs[id]["timeline"]
	a.timeline_key = "%d:%s" % [1 if e.p2shown else 0,id]
	a.cursor = 0
	a.processed = -1
	a.current = a.timeline[0]
	a.hit_ids.clear()
	a.token += 1
	a.repeats = a.repeats + 1 if a.last_move == id else 1
	a.last_move = id
	if id != "orb": a.cooldowns[id] = int(rules["cooldowns"][id])
	if id == "sweep":
		a.force_sweep = false
		a.pressure = 0
	a.travel = 0
	a.locked = false
	a.ultimate = null
	if id == "sweep" and a.sweep_face != 0:
		e.face = a.sweep_face
		a.sweep_face = 0
	e.invulnerable = false

func floor_busy(s: BmkWaveSimulation, e: BmkLegacyActor) -> bool:
	for z: BmkLegacyHazard in hazards(s,e):
		if z.kind in ["sword","cross"] and z.age / MS < z.wait + z.active: return true
	return false

func pick(s: BmkWaveSimulation, e: BmkLegacyActor, dx: float, dy: float) -> String:
	var a: BmkVargulState = state(e)
	if e.p2shown and e.hp <= e.max_hp * 0.35 and a.cooldowns.get("ultimate",0) == 0 and not a.ultimate_used: return "ultimate"
	if a.force_sweep and (a.last_move != "sweep" or a.repeats < 2): return "sweep"
	var band: String = "near" if dx < 200 * 0.5112 * 0.8 else ("mid" if dx < 200 * 0.5112 * 2 else "far")
	var phase: int = 1 if e.p2shown else 0
	var weights: Dictionary = rules["weights"][phase][band]
	var options: Array = []
	var busy: bool = floor_busy(s,e)
	var orbs: bool = not hazards(s,e,"orb").is_empty()
	for id: String in data.source["VARGUL"]["WEIGHT_ORDER"][phase][band]:
		if a.cooldowns.get(id,0) != 0 or a.last_move == id and a.repeats >= 2 or id in ["cross","sword"] and busy or id == "orb" and orbs: continue
		options.append([id,float(weights[id])])
	if e.p2shown and a.ultimate_used and a.cooldowns.get("ultimate",0) == 0 and not (a.last_move == "ultimate" and a.repeats >= 2): options.append(["ultimate",15.0])
	if options.is_empty(): return ""
	var total: float = 0
	for o: Array in options: total += float(o[1])
	var r: float = s.rnd() * total
	var id: String = str(options[-1][0])
	for o: Array in options:
		r -= float(o[1])
		if r < 0:
			id = str(o[0])
			break
	if id == "back_off" or id == "approach":
		a.locomotion = id
		a.locomotion_ticks = 24
		return ""
	if id in ["combo","sweep"] and dy > 26: return ""
	return id

func chase(s: BmkWaveSimulation, e: BmkLegacyActor) -> void:
	var a: BmkVargulState = state(e)
	var p: BmkActorState = s.player
	var dx: float = p.x - e.x
	var dy: float = p.y - e.y
	if p.st == "dead": return
	if e.attack_cd <= 0 and p.st != "down":
		var ultimate_due: bool = e.p2shown and e.hp <= e.max_hp * 0.35 and not a.ultimate_used and a.cooldowns.get("ultimate",0) == 0
		if not ultimate_due and dx * e.face < 0 and absf(dx) < 200 * 0.5112 * 0.8 and absf(dy) < 26 and a.cooldowns.get("sweep",0) == 0 and not (a.last_move == "sweep" and a.repeats >= 2):
			a.sweep_face = e.face
			s.enemy_controller.start_pat(s,e,"sweep")
			return
		var id: String = pick(s,e,absf(dx),absf(dy))
		if not id.is_empty():
			s.enemy_controller.start_pat(s,e,id)
			return
		e.attack_cd = 6
	e.face = 1 if dx >= 0 else -1
	var walk: Array = rules["walk"][1 if e.p2shown else 0]
	var away: bool = a.locomotion == "back_off" and a.locomotion_ticks > 0
	var target: float = e.x - e.face * 40 if away else p.x - e.face * 55
	e.x += clampf(target - e.x,-float(walk[0]) * 0.5112,float(walk[0]) * 0.5112)
	e.y += clampf(dy,-float(walk[1]) * 0.5112,float(walk[1]) * 0.5112)
	e.walk = absf(target - e.x) > 2 or absf(dy) > 2
	if a.locomotion_ticks > 0: a.locomotion_ticks -= 1

func spawn(s: BmkWaveSimulation, e: BmkLegacyActor, kind: String, x: float, y: float, h: float) -> BmkLegacyHazard:
	var a: BmkVargulState = state(e)
	var z: BmkLegacyHazard = s.add_hazard("vargul",x,y,h)
	z.kind = kind
	z.owner = e
	z.face = e.face
	z.age = -MS
	z.damage_scale = 1.3 if e.p2shown else 1.0
	z.born_elapsed = maxi(0,a.processed)
	z.cast_token = a.token
	if kind == "ice_wave":
		var u: Dictionary = rules["ultimate"]
		var ratio: float = float(u["outerY"]) / float(u["outerX"])
		var radius: float = -INF
		for px: float in [s.cam_x,s.cam_x + s.view_width]:
			for py: float in [s.ground_top,s.ground_bottom]:
				radius = maxf(radius,BmkViesaController.js_hypot([px - x,(py - y) / ratio]))
		z.wave_radius = radius + float(u["waveHalfWidth"])
		z.wave_ticks = ceili(z.wave_radius / (float(u["outerX"]) / float(u["waveTicks"]))) + 1
	return z

func fx(s: BmkWaveSimulation, e: BmkLegacyActor, id: String, x: float, y: float, h: float, life: float = 32, width: float = 0, height: float = 0) -> BmkLegacyHazard:
	var z: BmkLegacyHazard = spawn(s,e,"fx",x,y,h)
	z.fx = id
	z.life = life
	z.width = width
	z.height = height
	return z

func event(s: BmkWaveSimulation, e: BmkLegacyActor, ev: Dictionary) -> void:
	var a: BmkVargulState = state(e)
	var p: BmkActorState = s.player
	match str(ev["type"]):
		"sword_mark":
			var z: BmkLegacyHazard = spawn(s,e,"sword",p.x,p.y,0)
			z.wait = warning_ticks(e,45)
			z.active = 6
		"cross_mark":
			var z: BmkLegacyHazard = spawn(s,e,"cross",p.x,p.y,0)
			z.wait = warning_ticks(e,60)
			z.active = 18
		"orbs":
			if not hazards(s,e,"orb").is_empty(): return
			var r: Dictionary = rules["orb"]
			a.had_orbs = true
			for i: int in range(2):
				var z: BmkLegacyHazard = spawn(s,e,"orb",clampf(e.x + (1 if i != 0 else -1) * 40,s.cam_x + 24,s.cam_x + s.view_width - 24),e.y,float(r["height"]))
				z.index = i
				z.hp = float(r["hp"])
				z.max_hp = z.hp
				z.ai = "approach"
				z.shot_cooldown = float(r["interval"][1 if e.p2shown else 0]) * (i + 1) / 2.0
		"turn":
			e.face *= -1
			a.travel = 0
			a.locked = false
		"ultimate_mark":
			a.ultimate = spawn(s,e,"ultimate",p.x,p.y,0)
			a.ultimate.stage = "tracking"
			a.ultimate_used = true
		"ultimate_lock":
			if a.ultimate != null: a.ultimate.stage = "fixed"
		"ultimate_fall":
			if a.ultimate != null:
				a.ultimate.stage = "fall"
				e.x = a.ultimate.x
				e.y = a.ultimate.y
		"ultimate_impact":
			if a.ultimate != null:
				a.ultimate.stage = "impact"
				a.ultimate.impact_age = floori((a.ultimate.age + MS) / MS + 1e-6)
				e.x = a.ultimate.x
				e.y = a.ultimate.y
			e.z = 0
			fx(s,e,"spear_flash",e.x,e.y,12,12,38,60)
			s.shake = maxf(s.shake,24)
			s.sound("land")
		"ultimate_land":
			e.z = 0

func melee_progress(a: BmkVargulState, index: int) -> float:
	if not _progress.has(a.timeline_key):
		var groups: Dictionary = {}
		var result: PackedFloat64Array = PackedFloat64Array()
		result.resize(a.timeline.size())
		for i: int in range(a.timeline.size()):
			var frame: Dictionary = a.timeline[i]
			if frame.has("attack"):
				var key: String = str(frame["attack"]["id"])
				if not groups.has(key): groups[key] = []
				groups[key].append(i)
		for frames: Array in groups.values():
			for n: int in range(frames.size()): result[int(frames[n])] = float(n) / maxi(1,frames.size() - 1)
		_progress[a.timeline_key] = result
	return (_progress[a.timeline_key] as PackedFloat64Array)[index]

## vargulMeleeEffectData(e, t): the animated slash/thrust silhouette used as the hitbox.
func melee_effect(e: BmkLegacyActor, index: int) -> Dictionary:
	var a: BmkVargulState = state(e)
	if index < 0 or index >= a.timeline.size(): return {}
	var t: Dictionary = a.timeline[index]
	if not t.has("attack"): return {}
	var id: String = str(t["attack"]["id"])
	var kind: String = "thrust" if id.begins_with("dash") else "slash"
	if not (id.begins_with("combo") or id.begins_with("dash") or id.begins_with("sweep")): return {}
	var progress: float = melee_progress(a,index)
	var large: bool = id == "combo3" or id == "sweep_back"
	var frames: Array = data.source["VARGUL"]["MELEE"][kind]
	var frame: Dictionary = frames[mini(7,floori(progress * 8))]
	var geo: Dictionary = data.source["VARGUL"]["MEASUREMENTS"][t["clip"]][int(t["drawing"]) - 1]
	var tip: float = absf(float(geo["tip"][0]))
	var back: bool = id == "sweep_back"
	var w: float = 128.0 if kind == "thrust" else maxf(80,minf(145,tip))
	var h: float = 60.0 if kind == "thrust" else (112.0 if large else 86.0)
	return {"active":true,"id":id,"kind":kind,"frame":frame,"box":[-w - 12 if back else 12.0,12.0,w,h],"depth":float(t["attack"]["depth"]),"progress":progress,"reverse":back}

func attack_box(e: BmkLegacyActor, index: int) -> Array:
	var fx_: Dictionary = melee_effect(e,index)
	if not fx_.is_empty(): return fx_["box"]
	var t: Dictionary = state(e).timeline[index]
	var geo: Dictionary = data.source["VARGUL"]["MEASUREMENTS"][t["clip"]][int(t["drawing"]) - 1]
	return geo["body"] if bool(t["attack"].get("body",false)) else geo["attack"]

func box_hit(s: BmkWaveSimulation, e: BmkLegacyActor, box: Array, depth: float, old_x: float) -> bool:
	var p: BmkActorState = s.player
	var bx: float = float(box[0])
	var bh: float = float(box[1])
	var bw: float = float(box[2])
	var height: float = float(box[3])
	var left: float = minf(e.x,old_x) + minf(bx * e.face,(bx + bw) * e.face)
	var right: float = maxf(e.x,old_x) + maxf(bx * e.face,(bx + bw) * e.face)
	var scale_: float = 0.9 if p.is_viesa() else 1.0
	return p.x + 12 * scale_ >= left and p.x - 12 * scale_ <= right and absf(p.y - e.y) < depth * scale_ and p.z + s.player_body_height() >= e.z + bh and p.z <= e.z + bh + height

func melee_hit(s: BmkWaveSimulation, e: BmkLegacyActor, index: int, old_x: float) -> bool:
	var t: Dictionary = state(e).timeline[index]
	var fx_: Dictionary = melee_effect(e,index)
	if fx_.is_empty(): return box_hit(s,e,attack_box(e,index),float(t["attack"]["depth"]),old_x)
	if not box_hit(s,e,fx_["box"],float(fx_["depth"]),old_x): return false
	var box: Array = fx_["box"]
	var bx: float = float(box[0])
	var bh: float = float(box[1])
	var w: float = float(box[2])
	var h: float = float(box[3])
	var f: Dictionary = fx_["frame"]
	var fh: float = float(f["height"])
	var fw: float = float(f["width"])
	var p: BmkActorState = s.player
	var low: int = maxi(0,floori((e.z + bh + h - (p.z + s.player_body_height())) * fh / h))
	var high: int = mini(int(fh) - 1,floori((e.z + bh + h - p.z) * fh / h))
	var direction: int = e.face * (-1 if bool(fx_["reverse"]) else 1)
	var half: float = 12 * (0.9 if p.is_viesa() else 1.0)
	for y: int in range(low,high + 1):
		for run: Array in f["spans"][y]:
			var start: float = float(run[0])
			var end: float = float(run[1])
			var u: float = start / fw if direction > 0 else 1 - end / fw
			var v: float = end / fw if direction > 0 else 1 - start / fw
			var left: float = minf(e.x,old_x) + (bx if e.face > 0 else -(bx + w))
			var right: float = maxf(e.x,old_x) + (bx if e.face > 0 else -(bx + w))
			if p.x + half >= left + u * w and p.x - half <= right + v * w: return true
	return false

## vargulHurt(e, attack, source): contact height from the attack box, direction from the source.
func hurt(s: BmkWaveSimulation, e: BmkLegacyActor, attack: Dictionary, source: BmkLegacyHazard = null) -> bool:
	var a: BmkVargulState = state(e)
	var p: BmkActorState = s.player
	var height: float
	if source == null and a.current.has("attack"):
		var box: Array = attack_box(e,a.cursor)
		height = s.player_impact_height(e.z + float(box[1]),e.z + float(box[1]) + float(box[3]))
	else: height = source.h if source != null else p.z + 56
	var sx: float = source.x if source != null else e.x
	var dir: int = int(signf(p.x - sx)) if p.x != sx else (source.face if source != null and source.face != 0 else e.face)
	var stun: float = float(attack.get("hitstunTicks",attack.get("hitstun",-1)))
	var scale_: float = source.damage_scale if source != null else s.source_scale(e)
	return s.combat.hurt_player(s,float(attack["damage"]) * scale_,dir,bool(attack.get("knockdown",false)),height,stun)

func run_pattern(s: BmkWaveSimulation, e: BmkLegacyActor) -> void:
	var a: BmkVargulState = state(e)
	if a.timeline.is_empty(): init_pattern(s,e)
	var p: BmkActorState = s.player
	var target: int = floori(e.pt / MS + 1e-6) - 1
	while not a.timeline.is_empty() and a.processed < target and e.st == "pat":
		a.processed += 1
		if a.cursor >= a.timeline.size():
			s.enemy_controller.end_pat(s,e)
			return
		var t: Dictionary = a.timeline[a.cursor]
		a.current = t
		e.invulnerable = bool(t.get("hidden",false)) or bool(t.get("invulnerable",false))
		var old_x: float = e.x
		for ev: Dictionary in t.get("events",[]): event(s,e,ev)
		var walk: Array = rules["walk"][1 if e.p2shown else 0]
		if bool(t.get("align",false)):
			if bool(t.get("first",false)):
				a.locked = false
				a.travel = 0
			var local: int = int(t["local"])
			if local < int(t["lockAt"]): e.y += clampf(p.y - e.y,-float(walk[1]) * 0.5112,float(walk[1]) * 0.5112)
			if local == int(t["lockAt"]) - 1:
				a.locked_y = p.y
				a.locked = true
			if a.locked: e.y += (a.locked_y - e.y) / maxi(1,int(t["segmentTicks"]) - local)
		var stop_travel: bool = false
		if bool(t.get("travel",false)):
			var step: float = minf(14 * 0.5112,520 * 0.5112 - a.travel)
			var next: float = clampf(e.x + e.face * step,s.cam_x + 20,s.cam_x + s.view_width - 20)
			a.travel += absf(next - e.x)
			e.x = next
			stop_travel = a.travel >= 520 * 0.5112 - 0.001 or next == s.cam_x + 20 or next == s.cam_x + s.view_width - 20
			if int(t["local"]) % 4 == 0:
				var frost: BmkLegacyHazard = fx(s,e,"dash_frost",e.x - e.face * 25,e.y,25,14,90,48)
				frost.face = e.face
		if a.move == "ultimate":
			var height: float = float(rules["ultimate"]["riseHeight"])
			var label: String = str(t.get("label",""))
			if label == "leap": e.z = float(int(t["local"]) + 1) / int(t["segmentTicks"]) * height
			elif bool(t.get("hidden",false)): e.z = height
			elif label == "fall": e.z = height * (1 - float(int(t["local"])) / int(t["segmentTicks"]))
			elif a.cursor >= 141: e.z = 0
		if t.has("attack"):
			if bool(t.get("first",false)): s.sound("swing")
			var id: String = str(t["attack"]["id"])
			if not a.hit_ids.has(id) and melee_hit(s,e,a.cursor,old_x) and hurt(s,e,t["attack"]): a.hit_ids[id] = true
		a.cursor += 1
		if stop_travel:
			while a.cursor < a.timeline.size() and bool(a.timeline[a.cursor].get("travel",false)): a.cursor += 1
		if a.cursor >= a.timeline.size():
			s.enemy_controller.end_pat(s,e)
			return

func begin_transition(s: BmkWaveSimulation, e: BmkLegacyActor) -> void:
	var a: BmkVargulState = state(e)
	s.enemy_controller.reset_boss_fx(e,s)
	clear_hazards(s,e)
	e.hp = 0
	e.phase_t = int(rules["down"]) + int(rules["awaken"]) + int(rules["crossfade"])
	a.transition_age = 0
	e.st = "rec"
	e.t = 0
	e.z = 0
	e.vz = 0
	e.vx = 0
	e.invulnerable = true
	e.gr = 0
	e.gr_t = 0
	s.player.inv = maxi(s.player.inv,90)
	s.sound("land")

## updateVargulState(): true during the transition and while dead.
func update_state(s: BmkWaveSimulation, e: BmkLegacyActor) -> bool:
	var a: BmkVargulState = state(e)
	for id: String in a.cooldowns:
		if a.cooldowns[id] > 0: a.cooldowns[id] -= 1
	update_orbs(s,e)
	if e.phase_t > 0:
		var age: int = a.transition_age
		var awake: int = age - int(rules["down"])
		var awaken: float = float(rules["awaken"])
		e.walk = false
		e.invulnerable = true
		e.flash = 0
		if awake == ceili(3 * awaken / 8):
			fx(s,e,"frost_burst",e.x,e.y,64,36,155,130)
			for i: int in range(5): fx(s,e,"ice_shard",e.x + (i - 2) * 17,e.y,64,28,38,36)
			s.shake = maxf(s.shake,18)
			s.sound("phase2")
		if awake == ceili(7 * awaken / 8): fx(s,e,"cross_eruption",e.x,e.y,0,36,150,48)
		a.transition_age += 1
		e.phase_t -= 1
		if e.phase_t == 0:
			e.p2shown = true
			e.max_hp = float(rules["hp"][1])
			e.hp = e.max_hp
			e.next_kd = e.max_hp * 0.75
			e.gr = 0
			e.gr_t = 0
			e.invulnerable = false
			e.st = "chase"
			e.attack_cd = attack_gap(s,e)
			a.pressure = 0
			a.force_sweep = false
			a.ultimate_used = false
			a.phase_banner = 90
		return true
	if a.phase_banner > 0: a.phase_banner -= 1
	if e.st == "dead":
		e.t += 1
		e.invulnerable = true
		if e.t == 42:
			fx(s,e,"frost_burst",e.x,e.y,45,30,120,100)
			s.sound("land")
		if e.t >= int(rules["death"]) + int(rules["deathHold"]):
			if not a.remains:
				s.vargul_remains.append(PackedFloat64Array([e.x,e.y,e.face]))
				a.remains = true
			e.remove = true
		return true
	var pose_: Array = pose(s,e)
	var drawing: float = float(pose_[1])
	var clip_geo: Variant = data.source["VARGUL"]["MEASUREMENTS"].get(str(pose_[0]))
	if clip_geo != null and drawing == floorf(drawing) and drawing >= 1 and drawing <= (clip_geo as Array).size():
		var body: Variant = clip_geo[int(drawing) - 1].get("body")
		if body != null: e.hw = float(body[2]) / 2
	if e.st != "pat": e.invulnerable = false
	return false

func clip_length(clip: String) -> int:
	return int(data.source["VARGUL"]["clips"][clip])

func at(clip: String, progress: float) -> Array:
	var n: int = clip_length(clip)
	return [clip,float(mini(n,maxi(1,1 + floori(progress * n))))]

## vargulPose(e): [clip, drawing(1-based), hidden].
func pose(s: BmkWaveSimulation, e: BmkLegacyActor) -> Array:
	var a: BmkVargulState = state(e)
	var prefix: String = "p2_" if e.p2shown else "p1_"
	if e.phase_t > 0:
		var t: int = a.transition_age
		if t < int(rules["down"]): return at("p1_knockdown",float(t) / float(rules["down"]))
		return at("awaken",minf(0.999,(t - float(rules["down"])) / float(rules["awaken"])))
	if e.st == "intro": return at("p1_intro",s.intro_t / MS / float(rules["intro"]))
	if e.st == "dead": return at("death",minf(0.999,e.t / float(rules["death"])))
	if e.st == "down": return at(prefix + "knockdown",minf(0.999,e.t / 61.0))
	if e.st == "stun": return [prefix + "hurt",1.0]
	if e.st == "hurt":
		var clip: String = prefix + "hurt"
		var count: float = clip_length(clip)
		var half: float = count / 2
		return [clip,minf(count,(half if e.hheavy else 0.0) + 1 + minf(half - 1,floorf(e.t / 11.0 * half)))]
	if e.st == "pat" and not a.current.is_empty(): return [str(a.current["clip"]),float(a.current["drawing"]),bool(a.current.get("hidden",false))]
	var clip: String = prefix + ("walk" if e.walk else "idle")
	return [clip,float(1 + floori(s.tick / (6.0 if e.walk else 9.0)) % clip_length(clip))]

func intro_duration() -> float:
	return float(rules["intro"]) * MS

func update_intro(s: BmkWaveSimulation, e: BmkLegacyActor) -> void:
	var a: BmkVargulState = state(e)
	var f: int = floori(s.intro_t / MS + 1e-6)
	e.z = 0
	if f >= 120 and not a.intro_break:
		a.intro_break = true
		s.shake = maxf(s.shake,16)
		s.sound("land")
		fx(s,e,"frost_burst",e.x,e.y,22,40,135,115)
		for i: int in range(5): fx(s,e,"ice_shard",e.x + (i - 2) * 20,e.y,15 + i % 2 * 20,36,30,45)
	for z: BmkLegacyHazard in hazards(s,e): z.age += MS
	for z: BmkLegacyHazard in hazards(s,e,"fx"):
		if z.age / MS >= z.life: z.dead = true

func update_orbs(s: BmkWaveSimulation, e: BmkLegacyActor) -> void:
	var a: BmkVargulState = state(e)
	if hazards(s,e,"orb").is_empty():
		if a.had_orbs:
			a.cooldowns["orb"] = 720
			a.had_orbs = false
		return
	a.had_orbs = true
	if e.st == "dead" or e.phase_t > 0: clear_hazards(s,e)

func move_orb(s: BmkWaveSimulation, z: BmkLegacyHazard, t: int) -> void:
	var r: Dictionary = rules["orb"]
	var p: BmkActorState = s.player
	var dx: float = p.x - z.x
	var distance: float = absf(dx)
	var side: float = signf(dx) if dx != 0 else (1.0 if z.index != 0 else -1.0)
	var speed: float = float(r["speed"])
	var depth_speed: float = float(r["depthSpeed"])
	z.ai = "approach" if distance > float(r["range"]) + float(r["rangeSlack"]) else ("retreat" if distance < float(r["range"]) - float(r["rangeSlack"]) else "strafe")
	var drift: float = sin(t / float(r["driftPeriod"]) * PI * 2 + z.index * PI)
	var vx: float = side * speed if z.ai == "approach" else (-side * speed if z.ai == "retreat" else drift * speed * 0.3)
	var vy: float = clampf((p.y + (1 if z.index != 0 else -1) * 26 + drift * 16 - z.y) * 0.04,-depth_speed,depth_speed)
	for other: BmkLegacyHazard in hazards(s,z.owner,"orb"):
		if other == z: continue
		var sx: float = z.x - other.x
		var sy: float = z.y - other.y
		if absf(sx) < 38 and absf(sy) < 26:
			vx += signf(sx) if sx != 0 else (1.0 if z.index != 0 else -1.0)
			vy += (signf(sy) if sy != 0 else (1.0 if z.index != 0 else -1.0)) * 0.3
	if z.flash > 0:
		vx *= 0.25
		vy *= 0.25
	var accel: float = float(r["accel"])
	z.vx = z.vx + clampf(vx - z.vx,-accel,accel)
	z.vy = z.vy + clampf(vy - z.vy,-accel,accel)
	z.x = clampf(z.x + clampf(z.vx,-speed,speed),s.cam_x + 24,s.cam_x + s.view_width - 24)
	z.y = clampf(z.y + clampf(z.vy,-depth_speed,depth_speed),s.ground_top + 14,s.ground_bottom - 12)
	z.h = float(r["height"]) + sin(t / 24.0 + z.index * PI) * float(r["bob"])

func break_orb(s: BmkWaveSimulation, z: BmkLegacyHazard, destroyed: bool = false, hit_sound: String = "") -> void:
	if z.dead: return
	z.dead = true
	var e: BmkLegacyActor = z.owner
	fx(s,e,"frost_burst",z.x,z.y,z.h,18,45,45)
	if destroyed:
		var roll: float = s.rnd()
		var drops: Dictionary = rules["orb"]["drops"]
		var type: String = "potion" if roll < float(drops["potion"]) else ("scroll" if roll < float(drops["potion"]) + float(drops["scroll"]) else "")
		if not type.is_empty(): s.item_controller.drop(s,type,clampf(z.x,s.cam_x + 20,s.cam_x + s.view_width - 20),clampf(z.y,s.ground_top + 8,s.ground_bottom - 8))
		e.gr = minf(e.gr_max,e.gr + float(rules["orb"]["groggy"]))
		e.gr_t = 150
		s.hit_stop = maxi(s.hit_stop,3)
		s.hit_sound(0,hit_sound)
		if e.gr >= e.gr_max and e.st != "dead" and e.phase_t == 0:
			s.enemy_controller.reset_boss_fx(e,s)
			e.st = "stun"
			e.t = 0
			e.z = 0
			e.vz = 0
			e.vx = 0
			s.shake = maxf(s.shake,16)
			s.sound("groggy")
	if hazards(s,e,"orb").is_empty():
		state(e).cooldowns["orb"] = 720
		state(e).had_orbs = false

## strikeVargulOrbs(reach, behind, hitSet, options): every caller keeps its own hit set.
func strike_orbs(s: BmkWaveSimulation, reach: float, behind: float, hit_set: Dictionary, key_prefix: String, options: Dictionary) -> bool:
	var p: BmkActorState = s.player
	var hit: bool = false
	var i: int = 0
	while i < s.legacy_hazards.size():
		var z: BmkLegacyHazard = s.legacy_hazards[i]
		i += 1
		if z.type != "vargul" or z.kind != "orb" or z.dead or z.inv > 0: continue
		var key: Variant = -100000 - z.seq if key_prefix.is_empty() else key_prefix + str(z.seq)
		if hit_set.has(key): continue
		var x: float = float(options.get("x",p.x))
		var y: float = float(options.get("y",p.y))
		var h: float = float(options.get("h",p.z))
		var face: int = int(options.get("face",p.face))
		var dx: float = (z.x - x) * face
		var overlaps: bool = bool(options.get("global",false)) or dx >= -behind - 12 and dx <= reach + 12 and absf(z.y - y) < float(options.get("depth",20)) and absf(z.h - (h + 44)) < 45
		if not overlaps: continue
		var before: float = z.hp
		hit_set[key] = true
		z.hp = maxf(0,z.hp - float(options.get("damage",s.data.attack("c1").damage)))
		z.inv = int(rules["orb"]["inv"])
		hit = true
		if z.hp < before: s.sound("hurt")
		if z.hp <= 0: break_orb(s,z,true,str(options.get("hitSound","")))
		else:
			s.hit_sound(0,str(options.get("hitSound","")))
			s.hit_stop = maxi(s.hit_stop,2)
	return hit

func update_hazard(s: BmkWaveSimulation, z: BmkLegacyHazard) -> void:
	if z.dead: return
	var e: BmkLegacyActor = z.owner
	var t: int = maxi(0,floori(z.age / MS + 1e-6))
	var p: BmkActorState = s.player
	if z.kind == "fx":
		if t >= z.life: z.dead = true
		return
	if e.st == "dead" or e.phase_t > 0:
		z.dead = true
		return
	match z.kind:
		"sword", "cross":
			if t >= z.wait and not z.boom:
				z.boom = true
				s.sound("pillar")
			if t >= z.wait and t < z.wait + z.active and not z.hit:
				var d: Dictionary = rules[z.kind]
				var inside: bool
				if z.kind == "sword": inside = pow((p.x - z.x) / float(d["radius"]),2) + pow((p.y - z.y) / float(d["depth"]),2) <= 1 and p.z < 150 * 0.5112
				else: inside = (p.x >= s.cam_x and p.x <= s.cam_x + s.view_width and absf(p.y - z.y) <= float(d["depth"]) or absf(p.x - z.x) <= float(d["column"])) and p.z <= float(d["height"])
				if inside and hurt(s,e,{"damage":float(d["damage"]),"knockdown":z.kind == "cross"},z): z.hit = true
			var life: float = maxf(z.active,float(data.source["VARGUL"]["CROSS_FX"]["life"])) if z.kind == "cross" else z.active
			if t >= z.wait + life: z.dead = true
		"orb":
			var r: Dictionary = rules["orb"]
			move_orb(s,z,t)
			if z.inv > 0: z.inv -= 1
			if z.shot_cooldown > 0: z.shot_cooldown -= 1
			if z.flash > 0:
				z.flash -= 1
				if z.flash == 0 and z.shot_pending:
					z.shot_pending = false
					if p.st != "down" and p.st != "dead":
						var count: int = 2 if e.p2shown else 1
						for i: int in range(count):
							var dx: float = p.x - z.x
							var dy: float = p.y - z.y
							var dh: float = p.z + 44 - z.h
							var length: float = BmkViesaController.js_hypot([dx,dy,dh])
							if length == 0: length = 1
							var speed: float = float(rules["shard"]["speed"])
							var offset: float = (i - 0.5) * 0.10 if count == 2 else 0.0
							var cos_: float = cos(offset)
							var sin_: float = sin(offset)
							var shard: BmkLegacyHazard = spawn(s,e,"shard",z.x,z.y,z.h)
							shard.caster_index = z.index
							shard.vx = (dx * cos_ - dy * sin_) / length * speed
							shard.vy = (dx * sin_ + dy * cos_) / length * speed
							shard.vh = dh / length * speed
							shard.life = 180
						s.sound("bwave")
			if z.flash == 0 and z.shot_cooldown <= 0 and p.st != "down" and p.st != "dead":
				z.flash = int(warning_ticks(e,float(r["flash"])))
				z.shot_pending = true
				z.shot_cooldown = float(r["interval"][1 if e.p2shown else 0])
		"shard":
			var ox: float = z.x
			var oy: float = z.y
			var oh: float = z.h
			z.x += z.vx
			z.y += z.vy
			z.h += z.vh
			var dx: float = z.x - ox
			var dy: float = z.y - oy
			var dh: float = z.h - oh
			var length: float = dx * dx + dy * dy + dh * dh
			var u: float = clampf(((p.x - ox) * dx + (p.y - oy) * dy + (p.z + 44 - oh) * dh) / length,0,1) if length != 0 else 0.0
			if absf(ox + u * dx - p.x) < 14 and absf(oy + u * dy - p.y) < 14 and absf(oh + u * dh - (p.z + 44)) < 32 and hurt(s,e,{"damage":8.0},z): z.dead = true
			if t >= 180 or z.x < s.cam_x - 100 or z.x > s.cam_x + s.view_width + 100 or z.h < 0: z.dead = true
		"ultimate":
			var u: Dictionary = rules["ultimate"]
			if z.stage == "tracking":
				z.x = p.x
				z.y = p.y
			if z.stage == "impact" and t - z.impact_age < int(u["impactTicks"]) and not z.hit:
				var dx: float = p.x - z.x
				var dy: float = p.y - z.y
				if pow(dx / float(u["rx"]),2) + pow(dy / float(u["ry"]),2) <= 1 and p.z < 200 * 0.5112 and hurt(s,e,{"damage":float(u["damage"]),"knockdown":true},z): z.hit = true
			var emitted: int = z.waves_emitted
			if z.stage == "impact" and emitted < int(u["waveCount"]) and t - z.impact_age >= int(u["waveDelay"]) + emitted * int(u["waveInterval"]):
				z.waves_emitted = emitted + 1
				var wave: BmkLegacyHazard = spawn(s,e,"ice_wave",z.x,z.y,0)
				wave.pulse = emitted
			if z.stage == "impact" and t - z.impact_age >= int(u["waveDelay"]) + (int(u["waveCount"]) - 1) * int(u["waveInterval"]) + 1: z.dead = true
		"ice_wave":
			var u: Dictionary = rules["ultimate"]
			var band: Dictionary = wave_band(t,z)
			var distance: float = BmkViesaController.js_hypot([p.x - z.x,(p.y - z.y) * float(u["outerX"]) / float(u["outerY"])])
			if t < z.wave_ticks and not z.hit and distance >= float(band["inner"]) and distance <= float(band["outer"]) and p.z <= float(u["outerHeight"]) and hurt(s,e,{"damage":float(u["outerDamage"]),"knockdown":true},z): z.hit = true
			if t >= z.wave_ticks: z.dead = true

func wave_band(age: int, wave: BmkLegacyHazard) -> Dictionary:
	var u: Dictionary = rules["ultimate"]
	var ticks: int = wave.wave_ticks if wave != null else int(u["waveTicks"])
	var t: float = clampf(age,0,ticks - 1)
	var speed: float = float(u["outerX"]) / float(u["waveTicks"])
	return {"radius":speed * (t + 1),"inner":maxf(0,speed * t - float(u["waveHalfWidth"])),"outer":minf(wave.wave_radius if wave != null else float(u["outerX"]),speed * (t + 1) + float(u["waveHalfWidth"]))}
