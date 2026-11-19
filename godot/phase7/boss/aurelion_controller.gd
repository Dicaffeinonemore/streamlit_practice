class_name BmkAurelionController
extends RefCounted
## aurelion-runtime.js: timelines, guard/parry/break, pressure, patterns, hazards and the
## phase-two transition, line by line. State lives in BmkAurelionState (e.aurelion).
const MS: float = 1000.0 / 60.0
var data: BmkWaveData
var art: Dictionary
var moves: Dictionary
var rules: Dictionary
var k: float

func _init(source: BmkWaveData) -> void:
	data = source
	art = data.source["AURELION"]
	moves = art["timing"]
	rules = art["boss"]
	k = float(art["K"])

func state(e: BmkLegacyActor) -> BmkAurelionState:
	if e.aurelion == null: e.aurelion = BmkAurelionState.new()
	return e.aurelion

static func within(ranges: Variant, f: float) -> bool:
	if ranges == null: return false
	for r: Array in ranges:
		if f >= float(r[0]) and f <= float(r[1]): return true
	return false

func drawing(id: String, f: float) -> Dictionary:
	var m: Dictionary = moves[id]
	if bool(m.get("loop",false)): f = fmod(f,float(m["total_frames"]))
	for d: Dictionary in m["drawings"]:
		if f < float(d["start"]) + float(d["duration"]): return d
	return m["drawings"][-1]

## Each entry is one game tick; source-frame intervals preserve crossed events.
func timeline(id: String, indices: Array, p2: bool, compress: bool = true, duration_override: float = -1) -> Array:
	var m: Dictionary = moves[id]
	var result: Array = []
	var occurrences: Dictionary = {}
	for instance: int in range(indices.size()):
		var index: int = int(indices[instance])
		var d: Dictionary = m["drawings"][index - 1]
		var repeat: int = int(occurrences.get(index,0))
		occurrences[index] = repeat + 1
		var dur: float = float(d["duration"])
		var duration: float = duration_override if duration_override >= 0 else (float(m["repeat_windup"]) if id == "sword_wave" and index == 1 and repeat != 0 else dur)
		var speed: float = 1.0 / float(rules["phases"][1]["telegraph_mult"]) if p2 and str(d.get("phase","")) == "S" and compress else 1.0
		var ticks: int = maxi(1,ceili(duration / speed))
		var previous: int = -1
		for t: int in range(ticks):
			var local: int = int(dur) - 1 if t == ticks - 1 else mini(int(dur) - 1,floori(t * dur / ticks))
			var events: Array = []
			for ev: Dictionary in m.get("events",[]):
				var frame: float = float(ev["frame"])
				var start: float = float(d["start"])
				if frame >= start and frame < start + dur and frame - start > previous and frame - start <= local: events.append(ev)
			result.append({"id":id,"index":index,"d":d,"source":float(d["start"]) + local,"instance":instance,"repeat":repeat,"events":events})
			previous = local
	return result

func sequence(s: BmkWaveSimulation, e: BmkLegacyActor, id: String, mode: String) -> Array:
	var m: Dictionary = moves[id]
	var p2: bool = e.p2shown
	match id:
		"combo":
			var probabilities: Dictionary = rules["rules"]["combo_stops"]["phase2" if p2 else "phase1"]
			var r: float = s.rnd()
			if mode.is_empty(): mode = "stop1" if r < float(probabilities["stop1"]) else ("stop2" if r < float(probabilities["stop1"]) + float(probabilities["stop2"]) else "full")
			return m["sequences"][mode]
		"sword_wave":
			return m["sequences"]["phase2" if p2 else "phase1"]
		"whirl":
			var result: Array = [1]
			for c: int in range(int(m["run_loop"]["max_cycles"])): result.append_array([2,3,4,5])
			result.append_array([6,7,8,9])
			return result
		"charge":
			var result: Array = [1,2]
			for c: int in range(int(m["run_loop"]["max_cycles"])): result.append_array(m["run_loop"]["drawings"])
			result.append_array([5,6,7,8])
			return result
		"guard":
			return m["sequences"]["guard" if mode.is_empty() else mode]
	var all: Array = []
	for d: Dictionary in m["drawings"]: all.append(int(d["index"]))
	return all

func set_timeline(s: BmkWaveSimulation, e: BmkLegacyActor, id: String, mode: String = "") -> void:
	var a: BmkAurelionState = state(e)
	a.move = id
	a.guard = ("guard" if mode.is_empty() else mode) if id == "guard" else ""
	var line: Array = timeline(id,sequence(s,e,id,mode),e.p2shown,id != "guard",float(moves["guard"]["timeout_punish"]) if mode == "timeout" else -1.0)
	if id == "guard" and a.guard == "guard": line = timeline(id,[1,2,1,2,1],false).slice(0,int(moves["guard"]["guard_frames"]))
	a.timeline = line
	a.cursor = 0
	a.processed = -1
	a.current = line[0]
	a.hit_instances.clear()
	a.token += 1
	a.whirl_landed = false
	e.pt = 0
	e.invulnerable = false

func init_pattern(s: BmkWaveSimulation, e: BmkLegacyActor) -> void:
	var a: BmkAurelionState = state(e)
	var resolved: String = str({"slash3":"combo","pillars":"judgment"}.get(e.pat,e.pat))
	if not moves.has(resolved): return
	e.pat = resolved
	a.repeats = a.repeats + 1 if a.last_move == resolved else 1
	a.last_move = resolved
	a.cooldowns[resolved] = int(rules["rules"]["cooldowns"].get(resolved,0))
	if resolved == "guard":
		a.force_guard = false
		a.pressure = 0
	a.marks.clear()
	set_timeline(s,e,resolved)

func reset_pattern(s: BmkWaveSimulation, e: BmkLegacyActor) -> void:
	var a: BmkAurelionState = state(e)
	for z: BmkLegacyHazard in s.legacy_hazards:
		if z.type == "aurelion" and z.owner == e and z.kind == "judge_mark": z.dead = true
	a.move = ""
	a.guard = ""
	a.current = {}
	a.marks.clear()

func attack_gap(s: BmkWaveSimulation, e: BmkLegacyActor) -> int:
	var gap: Array = rules["rules"]["attack_gap"]["phase2" if e.p2shown else "phase1"]
	return s.js_round(float(gap[0]) + s.rnd() * (float(gap[1]) - float(gap[0])))

func pick(s: BmkWaveSimulation, e: BmkLegacyActor, dx: float, dy: float) -> String:
	var a: BmkAurelionState = state(e)
	if a.force_guard: return "guard"
	if a.taunt_pending and a.cooldowns.get("taunt",0) == 0:
		a.taunt_pending = false
		return "taunt"
	var bands: Dictionary = rules["distance_bands"]
	var band: String = "near" if dx < float(bands["near"][1]) * k else ("mid" if dx < float(bands["mid"][1]) * k else "far")
	var phase: int = 1 if e.p2shown else 0
	var weights: Dictionary = rules["phases"][phase]["weights"][band]
	var choices: Array = []
	var total: float = 0
	for id: String in data.source["AURELION_WEIGHT_ORDER"][phase][band]:
		if a.cooldowns.get(id,0) != 0 or id == a.last_move and a.repeats >= int(rules["rules"]["same_move_max_in_row"]): continue
		choices.append(id)
		total += float(weights[id])
	if choices.is_empty(): return ""
	var r: float = s.rnd() * total
	var picked: String = str(choices[-1])
	for id: String in choices:
		r -= float(weights[id])
		if r < 0:
			picked = id
			break
	if picked == "approach" or picked == "back_off":
		a.locomotion = picked
		a.locomotion_ticks = 24
		return ""
	var depth: float = float(bands["align"]["ranged_dz"] if picked in ["sword_wave","judgment"] else bands["align"]["melee_dz"])
	if dy > depth: return ""
	return picked

func chase(s: BmkWaveSimulation, e: BmkLegacyActor) -> void:
	var a: BmkAurelionState = state(e)
	var p: BmkActorState = s.player
	var dx: float = p.x - e.x
	var dy: float = p.y - e.y
	if p.st == "dead": return
	if a.turn_ticks <= 0:
		e.face = 1 if dx >= 0 else -1
		a.turn_ticks = 4
	else: a.turn_ticks -= 1
	var speed: Array = rules["phases"][1]["walk_speed"] if e.p2shown else rules["stats"]["walk_speed"]
	var away: bool = a.locomotion == "back_off" and a.locomotion_ticks > 0
	if a.locomotion_ticks > 0: a.locomotion_ticks -= 1
	var target: float = e.x - e.face * 40 if away else p.x - e.face * 50
	e.x += clampf(target - e.x,-float(speed[0]) * k,float(speed[0]) * k)
	e.y += clampf(dy,-float(speed[1]) * k,float(speed[1]) * k)
	e.walk = absf(target - e.x) > 2 or absf(dy) > 2
	if s.enemy_controller.attackers(s,e) >= 3 or p.st == "down" or e.attack_cd > 0 or a.locomotion_ticks > 0: return
	var pat: String = pick(s,e,absf(dx),absf(dy))
	if not pat.is_empty(): s.enemy_controller.start_pat(s,e,pat)
	else: e.attack_cd = 6

## reactAurelionAttack(): the player starting an attack nearby may be answered with a guard.
func react(s: BmkWaveSimulation) -> void:
	var p: BmkActorState = s.player
	for actor: BmkActorState in s.enemies:
		var e: BmkLegacyActor = actor as BmkLegacyActor
		if e.type != "boss3" or e.st != "chase" or e.phase_t != 0 or p.st == "down": continue
		var a: BmkAurelionState = state(e)
		if a.cooldowns.get("guard",0) == 0 and absf(e.x - p.x) < 170 * k and absf(e.y - p.y) < 20 and s.rnd() < float(rules["guard"]["reactive_chance"]["phase2" if e.p2shown else "phase1"]) and s.enemy_controller.attackers(s,e) < 3:
			s.enemy_controller.start_pat(s,e,"guard")

func punishable(e: BmkLegacyActor) -> bool:
	var a: BmkAurelionState = state(e)
	var m: Dictionary = moves.get(a.move,{})
	return a.guard == "broken" or a.guard == "timeout" or a.move == "taunt" or m.has("punish_window") and not a.current.is_empty() and within([m["punish_window"]["frames"]],float(a.current["source"]))

## interceptAurelionDamage(): true when the hit is parried (no damage).
func intercept(s: BmkWaveSimulation, e: BmkLegacyActor, kd: bool, fixed_damage: bool) -> bool:
	var a: BmkAurelionState = state(e)
	var p: BmkActorState = s.player
	if e.invulnerable or e.phase_t > 0 or e.st == "dead": return false
	if e.st == "pat" and a.guard == "guard":
		var heavy: bool = kd or fixed_damage or p.st == "special" or p.st == "cast" or p.atk == "air" and p.st == "atk" or p.st == "atk" and p.combo == 2 or p.st == "skill" and p.skill in ["thrust","slam","leap"]
		if heavy:
			set_timeline(s,e,"guard","broken")
			e.gr = minf(e.gr_max,e.gr + 30)
			e.gr_t = 150
			return false
		set_timeline(s,e,"guard","parry")
		if p.st not in ["special","dead","down"]:
			if not p.is_viesa(): s.combat.begin_barel_hurt(s,p.z + 56,17)
			p.st = "hurt"
			p.t = 0
			p.vx = 0
			p.skill = ""
			p.buf = 0
		return true
	if not punishable(e):
		a.pressure += 1
		if a.pressure >= (2 if e.p2shown else 3): a.force_guard = true
	return false

func armored(e: BmkLegacyActor) -> bool:
	var a: BmkAurelionState = e.aurelion
	return e.type == "boss3" and e.st == "pat" and a != null and not a.current.is_empty() and within(moves.get(a.move,{}).get("super_armor"),float(a.current["source"]))

func box_hit(s: BmkWaveSimulation, box: Array, depth: float, x: float, y: float, face: int = 1, h: float = 0.0, old_x: float = INF) -> bool:
	if old_x == INF: old_x = x
	var p: BmkActorState = s.player
	var bx: float = float(box[0])
	var by: float = float(box[1])
	var bw: float = float(box[2])
	var bh: float = float(box[3])
	var left: float = minf(x,old_x) + minf(bx * face,(bx + bw) * face) * k
	var right: float = maxf(x,old_x) + maxf(bx * face,(bx + bw) * face) * k
	var scale_: float = 0.9 if p.is_viesa() else 1.0
	return p.x + 12 * scale_ >= left and p.x - 12 * scale_ <= right and absf(p.y - y) < depth * scale_ and p.z + s.player_body_height() >= h + by * k and p.z <= h + (by + bh) * k

func hurt(s: BmkWaveSimulation, e: BmkLegacyActor, attack: Dictionary, face: int, damage_scale: float, hit_height: float) -> bool:
	var stun: float = float(attack.get("hitstunTicks",attack.get("hitstun",-1)))
	var hit: bool = s.combat.hurt_player(s,float(attack["damage"]) * damage_scale,face,bool(attack.get("knockdown",false)),hit_height,stun)
	if hit:
		s.hit_stop = maxi(s.hit_stop,int(attack.get("hitstop",0)))
		if s.player.st == "down" and s.rnd() < float(rules["phases"][1 if e.p2shown else 0]["taunt"]["chance"]): state(e).taunt_pending = true
	return hit

func spawn_fx(s: BmkWaveSimulation, e: BmkLegacyActor, id: String, x: float, y: float, h: float) -> BmkLegacyHazard:
	var def: Dictionary = art["projectiles"].get(id,{})
	var fx: String = str(def.get("use",id))
	var fx_def: Dictionary = art["effects"].get(fx,{})
	var z: BmkLegacyHazard = s.add_hazard("aurelion",x,y,h)
	z.kind = id
	z.fx = fx
	z.owner = e
	z.face = e.face
	var step: float = float(def.get("frame_duration",fx_def.get("frame_duration",5)))
	if step == 0: step = 5
	z.life = step * float(fx_def.get("frames",4))
	z.visual = bool(def.get("visual_only",false))
	z.damage_scale = 1.3 if e.p2shown else 1.0
	return z

func spawn_event(s: BmkWaveSimulation, e: BmkLegacyActor, event: Dictionary) -> void:
	var a: BmkAurelionState = state(e)
	var id: String = str(event.get("id",""))
	var type: String = str(event["type"])
	match type:
		"sfx":
			s.sound(str(art["SFX"].get(id,"bwind")))
			return
		"shake":
			s.shake = maxf(s.shake,float(event["strength"]))
			return
		"slowmo":
			s.slow_request = maxf(s.slow_request,float(event["frames"]) * MS)
			return
	if type != "spawn": return
	var offset: Array = event.get("offset",[0,0])
	var x: float = e.x + e.face * float(offset[0]) * k
	var h: float = float(offset[1]) * k
	if id == "royal_halo" or id == "gold_aura":
		a.halo = true
		return
	if id == "gold_shock":
		var def: Dictionary = art["projectiles"]["gold_shock"]
		for dir: int in ([1,-1] if e.p2shown else [1]):
			for i: int in range(4 if dir == 1 else 3):
				var z: BmkLegacyHazard = spawn_fx(s,e,id,x + e.face * i * float(def["step"]) * k if dir == 1 else e.x - e.face * (i + 1) * float(def["step"]) * k,e.y,0)
				z.delay = i * float(def["interval"])
				z.visual = false
	elif id == "judge_mark":
		var placement: Array = art["projectiles"]["judge_mark"]["placement"]["phase2" if e.p2shown else "phase1"]
		a.marks.clear()
		for offset_: Array in placement:
			a.marks.append(PackedFloat64Array([clampf(s.player.x + float(offset_[0]) * k,s.cam_x + 20,s.cam_x + s.view_width - 20),clampf(s.player.y + float(offset_[1]) * 0.75,s.ground_top + 10,s.ground_bottom)]))
		for mark: PackedFloat64Array in a.marks:
			var z: BmkLegacyHazard = spawn_fx(s,e,id,mark[0],mark[1],0)
			z.life = 9999
			z.cast_token = a.token
	elif id == "judge_pillar":
		for mark: PackedFloat64Array in a.marks:
			var z: BmkLegacyHazard = spawn_fx(s,e,id,mark[0],mark[1],0)
			z.visual = false
		for z: BmkLegacyHazard in s.legacy_hazards:
			if z.owner == e and z.kind == "judge_mark": z.dead = true
	else: spawn_fx(s,e,id,x,e.y,h)

func run_pattern(s: BmkWaveSimulation, e: BmkLegacyActor) -> void:
	var a: BmkAurelionState = state(e)
	if a.move.is_empty(): init_pattern(s,e)
	if a.timeline.is_empty():
		s.enemy_controller.end_pat(s,e)
		return
	var p: BmkActorState = s.player
	var target: int = floori(e.pt / MS + 1e-6) - 1
	while a.processed < target and e.st == "pat":
		a.processed += 1
		if a.cursor >= a.timeline.size():
			if a.move == "guard" and a.guard == "guard":
				set_timeline(s,e,"guard","timeout")
				return
			s.enemy_controller.end_pat(s,e)
			return
		var entry: Dictionary = a.timeline[a.cursor]
		a.current = entry
		var m: Dictionary = moves[a.move]
		var token: int = a.token
		e.invulnerable = within(m.get("invulnerable"),float(entry["source"]))
		for event: Dictionary in entry["events"]: spawn_event(s,e,event)
		var speed: float = float(m.get("move",{}).get("per_drawing",{}).get(str(entry["index"]),0))
		e.x = clampf(e.x + e.face * speed * k,s.cam_x - 60,s.cam_x + s.view_width + 60)
		if not a.hit_instances.has(int(entry["instance"])):
			for hb: Dictionary in entry["d"].get("hitboxes",[]):
				var attack: Dictionary = (m.get("attack",{}) as Dictionary).duplicate()
				var extra: Variant = m.get("body_attack") if str(hb.get("kind","")) == "body" else m.get("hit_attacks",{}).get(str(entry["index"]))
				if extra != null: attack.merge(extra,true)
				if a.move == "whirl" and not a.whirl_landed:
					attack["damage"] = 16
					attack["knockdown"] = true
				var box: Array = hb["box"]
				if box_hit(s,box,float(hb["depth"]),e.x,e.y,e.face) and hurt(s,e,attack,e.face,s.source_scale(e),s.player_impact_height(float(box[1]) * k,(float(box[1]) + float(box[3])) * k)):
					if a.move == "whirl": a.whirl_landed = true
					a.hit_instances[int(entry["instance"])] = true
					break
		if a.token != token: return
		a.cursor += 1
		if a.move == "charge" and int(entry["index"]) == 4 and a.cursor < a.timeline.size() and int(a.timeline[a.cursor]["index"]) == 3 and absf(p.x - e.x) < 130 * k:
			while a.cursor < a.timeline.size() and int(a.timeline[a.cursor]["index"]) != 5: a.cursor += 1
		if a.cursor >= a.timeline.size():
			if a.move == "guard" and a.guard == "guard": set_timeline(s,e,"guard","timeout")
			else: s.enemy_controller.end_pat(s,e)
			return

func update_intro(s: BmkWaveSimulation, e: BmkLegacyActor) -> void:
	var a: BmkAurelionState = state(e)
	var to: int = mini(141,floori(s.intro_t / MS))
	for ev: Dictionary in moves["intro"]["events"]:
		if float(ev["frame"]) > a.intro_frame and float(ev["frame"]) <= to: spawn_event(s,e,ev)
	a.intro_frame = to

func intro_duration() -> float:
	return float(moves["intro"]["total_frames"]) * MS

func begin_transition(e: BmkLegacyActor) -> void:
	var a: BmkAurelionState = state(e)
	e.phase_t = 242
	a.transition_age = 0
	a.halo = false

## updateAurelionState(): true while dead (the generic update is skipped).
func update_state(s: BmkWaveSimulation, e: BmkLegacyActor) -> bool:
	var a: BmkAurelionState = state(e)
	for id: String in a.cooldowns:
		if a.cooldowns[id] > 0: a.cooldowns[id] -= 1
	if e.phase_t > 0:
		var age: int = a.transition_age
		var id: String = "knockdown" if age < 100 else "awaken"
		var f: int = age if age < 100 else age - 100
		for ev: Dictionary in moves[id]["events"]:
			if int(ev["frame"]) == f: spawn_event(s,e,ev)
		a.transition_age = age + 1
	if e.st == "dead":
		e.t += 1
		if e.flash > 0: e.flash -= 1
		for ev: Dictionary in moves["death"]["events"]:
			if int(ev["frame"]) == e.t - 1: spawn_event(s,e,ev)
		if e.t >= int(moves["death"]["total_frames"]) + 50: e.remove = true
		return true
	var pose_: Array = pose(s,e)
	var d: Dictionary = drawing(str(pose_[0]),float(pose_[1]))
	var boxes: Array = d.get("hurtboxes",[])
	if not boxes.is_empty():
		var right: float = -INF
		var left: float = INF
		for b: Array in boxes:
			right = maxf(right,float(b[0]) + float(b[2]))
			left = minf(left,float(b[0]))
		e.hw = (right - left) * k / 2
	if e.phase_t == 0: e.invulnerable = e.st != "stun" and within(moves[str(pose_[0])].get("invulnerable"),float(pose_[1]))
	return false

## aurelionPose(e): [clip id, source frame].
func pose(s: BmkWaveSimulation, e: BmkLegacyActor) -> Array:
	var a: BmkAurelionState = state(e)
	if e.phase_t > 0: return ["knockdown",float(a.transition_age)] if a.transition_age < 100 else ["awaken",float(a.transition_age - 100)]
	if e.st == "intro": return ["intro",s.intro_t / MS]
	if e.st == "dead": return ["death",minf(120,e.t)]
	if e.st == "down": return ["knockdown",minf(99,e.t / 60.0 * 100)]
	if e.st == "stun": return ["hurt",0.0]
	if e.st == "hurt": return ["hurt",(20.0 if e.hheavy else 0.0) + minf(19,e.t * 2)]
	if e.st == "pat" and not a.current.is_empty(): return [a.move,float(a.current["source"])]
	return ["walk" if e.walk else "idle",float(s.tick)]

func update_hazard(s: BmkWaveSimulation, z: BmkLegacyHazard) -> void:
	var e: BmkLegacyActor = z.owner
	var f: float = z.age / MS - z.delay
	var def: Dictionary = art["projectiles"].get(z.kind,{})
	if e != null and (e.st == "dead" or e.phase_t > 0):
		z.dead = true
		return
	if f < 0: return
	if z.kind == "judge_mark":
		if e.st != "pat" or state(e).move != "judgment" or state(e).token != z.cast_token: z.dead = true
		return
	if not z.visual and def.has("hitbox"):
		var old: float = z.x
		if z.kind == "gold_wave": z.x += z.face * float(def["speed"]["phase2" if e.p2shown else "phase1"]) * k
		var active: bool = not def.has("active_frames") or within([def["active_frames"]],f)
		var box: Array = def["hitbox"]
		if active and not z.hit and box_hit(s,box,float(def["depth"]),z.x,z.y,z.face,z.h,old) and hurt(s,e,def,z.face,z.damage_scale,s.player_impact_height(z.h + float(box[1]) * k,z.h + (float(box[1]) + float(box[3])) * k)): z.hit = true
		if z.kind == "gold_wave" and z.hit: z.dead = true
	if f >= float(def.get("lifetime",z.life)) or z.x < s.cam_x - 180 or z.x > s.cam_x + s.view_width + 180: z.dead = true
