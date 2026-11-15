class_name BmkStageEnemies
extends BmkEnemyController

func begin_move(sim: BmkSimulation, actor: BmkActorState, clip: String) -> void:
	var e: BmkStageActor = actor as BmkStageActor
	if e.species == "heavy" and clip == "attack":
		var near: bool = absf(sim.player.x - e.x) < e.d.reach and absf(sim.player.y - e.y) < 14
		var free: bool = sim.player.st != "grabbed"
		for other: BmkActorState in sim.enemies:
			if other != e and other.st == "grabbing": free = false
		clip = "grab" if near and free and e.grab_cd <= 0 and sim.random_between(0,1) < 0.4 else "spin"
	super.begin_move(sim,e,clip)
	e.grab_used = false
	if clip == "grab": e.grab_cd = 300

func stage_override(sim: BmkSimulation, actor: BmkActorState) -> bool:
	var s: BmkStageSimulation = sim as BmkStageSimulation
	var e: BmkStageActor = actor as BmkStageActor
	if e.kick_cd > 0: e.kick_cd -= 1
	if e.grab_cd > 0: e.grab_cd -= 1
	if e.dive_cd > 0: e.dive_cd -= 1
	if e.st == "grabbing": return true
	if e.species == "hound":
		if e.dive != null and e.st in ["wind","act"]:
			dive_step(s,e)
			return true
		if e.st not in ["wind","act"]: e.dive = null
		if e.st == "trip":
			if e.t >= 56: start_getup(s,e)
			return true
		if e.st == "hurt":
			e.hurt_t = maxi(e.hurt_t,24)
			if e.z > 0 or e.vz != 0:
				e.z += e.vz
				e.vz -= 0.5
				if e.z <= 0:
					e.z = 0
					e.vz = 0
		if e.st == "chase":
			e.getup = false
			hound_chase(s,e)
			return true
	if e.species == "heavy" and e.st == "chase" and e.attack_cd <= 0 and s.player.st not in ["dead","down"] and absf(s.player.x - e.x) >= e.d.reach and absf(s.player.x - e.x) <= e.d.reach * 1.5 and absf(s.player.y - e.y) <= 20 and s.random_between(0,1) <= 1.0 / 90:
		begin_move(s,e,"spin")
		return true
	if e.st == "balcony":
		e.face = 1 if s.player.x >= e.x else -1
		e.z = 92
		var others: int = 0
		for o: BmkActorState in s.enemies:
			if o != e and o.lock_id == e.lock_id and o.st != "dead": others += 1
		if s.sections.locked and s.sections.lock_id == e.lock_id: others += s.sections.spawn_queue.size()
		if e.throws >= 2 or others <= 1:
			e.st = "drop"
			e.t = 0
			e.vz = 3
			e.balcony = false
			e.drop_to = maxf(s.walk_top + 24,370)
			s.sound("jump")
		elif e.attack_cd <= 0 and s.player.st not in ["dead","down"]: start_throw(s,e)
		return true
	if e.st == "drop":
		e.z += e.vz
		e.vz -= 0.45
		e.y += clampf(e.drop_to - e.y,-2.4,2.4)
		if e.z <= 0:
			e.z = 0
			e.vz = 0
			e.st = "rec"
			e.t = 0
			e.recovery_t = 6
			e.invulnerable = false
			s.shake = maxf(s.shake,4)
			s.sound("land")
		return true
	if e.molotov:
		if e.st == "rec":
			if e.t > e.recovery_t:
				e.st = "chase"
				e.t = 0
				e.attack_cd = maxf(e.attack_cd,20)
			return true
		if e.st == "chase":
			molotov_chase(s,e)
			return true
		if e.st in ["wind","act"] and e.pat == "throw":
			if e.t >= 30: throw_bottle(s,e)
			return true
		if e.st in ["wind","act"] and e.pat == "kick":
			if e.st == "wind":
				if e.t >= 14:
					e.st = "act"
					e.t = 0
			else:
				var dx: float = (s.player.x - e.x) * e.face
				if not e.hit_set.has(0) and dx > -8 and dx < 40 + s.player.hw and absf(s.player.y - e.y) < 16 and absf(s.player.z - e.z) < 45 and s.combat.hurt_player(s,4,e.face,false): e.hit_set[0] = true
				if e.t >= 6:
					e.st = "rec"
					e.t = 0
					e.recovery_t = 20
					e.pat = ""
					e.kick_cd = 90
					e.x -= e.face * 6
			return true
	return false

func start_getup(sim: BmkSimulation, actor: BmkActorState) -> void:
	super.start_getup(sim,actor)
	if actor.species == "hound": actor.recovery_t = 50

func hound_chase(s: BmkStageSimulation, e: BmkStageActor) -> void:
	var p: BmkActorState = s.player
	var dx: float = p.x - e.x
	var dy: float = p.y - e.y
	if p.st == "dead": return
	if e.wait > 0:
		e.wait -= 1
		return
	e.face = 1 if dx >= 0 else -1
	e.angle += 0.012 * (1 if e.id % 2 else -1)
	var tx: float = p.x + cos(e.angle) * e.radius
	var ty: float = p.y + sin(e.angle) * e.radius * 0.22
	var token: bool = true
	for other: BmkActorState in s.enemies:
		if other != e and (other as BmkStageActor).dive != null: token = false
	if e.dive_cd <= 0 and token and p.st not in ["down","grabbed"] and absf(dx) >= 180 and absf(dx) <= 330:
		tx = e.x
		ty = p.y
		if absf(dy) <= 18:
			e.dive = BmkDiveState.new()
			e.dive.dir = 1 if p.x >= e.x else -1
			e.dive.x0 = e.x
			e.face = e.dive.dir
			e.st = "wind"
			e.t = 0
			e.pat = "dive"
			s.sound("bwind")
			return
	tx = clampf(tx,s.cam_x + 20,s.cam_x + 620)
	ty = clampf(ty,s.walk_top + 10,500)
	var mx: float = tx - e.x
	var my: float = ty - e.y
	var distance: float = sqrt(mx * mx + my * my)
	if distance > 3:
		e.x += mx / distance * e.d.speed
		e.y += my / distance * e.d.speed * 0.8
		e.walk = true

func dive_step(s: BmkStageSimulation, e: BmkStageActor) -> void:
	var dv: BmkDiveState = e.dive
	dv.t += 1
	dv.f = BmkFrameSelector.anim_index(PackedInt32Array(s.stage_data.source["S1_ANIM"]["dive"]),dv.t - 1)
	e.face = dv.dir
	var fn: int = dv.f + 1
	e.st = "wind" if fn <= 2 else "act"
	if fn <= 2: return
	if fn <= 5:
		if not dv.sound:
			dv.sound = true
			s.sound("jump")
		e.x += dv.dir * 160.0 / 12
		e.z = sin(PI * clampf((dv.t - 12) / 12.0,0,1)) * 40
		var art: Dictionary = s.stage_data.source["STAGE1_ENEMY_ART"]["hound"]
		var hand_: Array = art["frames"][int(art["clips"]["dive"][dv.f])]["hand"]
		var dx: float = (s.player.x - e.x) * dv.dir
		var height: float = e.z + float(hand_[1])
		if not dv.hit and dx > float(hand_[0]) - 22 and dx < float(hand_[0]) + 14 and absf(s.player.y - e.y) < 16 and height >= s.player.z - 6 and height <= s.player.z + 80 and s.player.inv <= 0 and s.player.st not in ["dead","down","special","grabbed"]:
			dv.hit = true
			s.grabs.begin(s,e,"bite")
		return
	e.z = 0
	e.dive = null
	e.st = "trip"
	e.t = 0
	e.pat = ""
	e.dive_cd = s.js_round(s.random_between(150,200))
	s.sound("land")

func molotov_chase(s: BmkStageSimulation, e: BmkStageActor) -> void:
	var dx: float = s.player.x - e.x
	var dy: float = s.player.y - e.y
	if s.player.st == "dead": return
	if e.wait > 0:
		e.wait -= 1
		return
	e.face = 1 if dx >= 0 else -1
	if e.t % 150 == 0: e.lane_y = s.random_between(s.walk_top + 15,495)
	var mx: int = -e.face if absf(dx) < 260 else (e.face if absf(dx) > 420 else 0)
	var my: float = signf(e.lane_y - e.y) if absf(e.lane_y - e.y) > 4 else 0
	if mx != 0 or my != 0:
		e.x += mx * e.d.speed
		e.y += my * e.d.speed * 0.6
		e.walk = true
	e.x = clampf(e.x,s.cam_x + 24,s.cam_x + 616)
	if absf(dx) < 70 and absf(dy) < 16 and e.kick_cd <= 0 and s.player.st != "down":
		e.st = "wind"
		e.pat = "kick"
		e.t = 0
		e.hit_set.clear()
		s.sound("bwind")
		return
	var busy: int = 0
	for other: BmkActorState in s.enemies:
		if other != e and (other as BmkStageActor).molotov and other.pat == "throw" and other.st in ["wind","act"]: busy += 1
	if e.attack_cd <= 0 and absf(dx) >= 180 and absf(dx) <= 480 and busy < 2 and s.player.st != "down": start_throw(s,e)

func start_throw(s: BmkStageSimulation, e: BmkStageActor) -> void:
	e.st = "wind"
	e.pat = "throw"
	e.t = 0
	e.face = 1 if s.player.x >= e.x else -1
	e.tx = clampf(s.player.x,s.cam_x + 20,s.cam_x + 620)
	e.ty = clampf(s.player.y,s.walk_top + 10,500)
	var z: BmkFireHazard = BmkFireHazard.new()
	z.type = "firemark"
	z.x = e.tx
	z.y = e.ty
	z.life = 70 * s.MS
	s.fire_hazards.append(z)
	s.sound("bwind")

func throw_bottle(s: BmkStageSimulation, e: BmkStageActor) -> void:
	var art: Dictionary = s.stage_data.source["STAGE1_ENEMY_ART"]["molotov"]
	var hand_: Array = art["frames"][int(art["clips"]["throw"][5])]["hand"]
	e.throw_at = s.tick
	var z: BmkFireHazard = BmkFireHazard.new()
	z.type = "molotov"
	z.x0 = e.x + e.face * float(hand_[0])
	z.y0 = e.y
	z.h0 = e.z + float(hand_[1])
	z.tx = e.tx
	z.ty = e.ty
	z.x = e.x
	z.y = e.y
	z.h = z.h0
	z.duration = 40 * s.MS
	z.arc = 24 if e.balcony else 70
	s.fire_hazards.append(z)
	s.sound("swing",1)
	e.pat = ""
	e.t = 0
	e.attack_cd = s.js_round(s.random_between(90,140))
	if e.balcony:
		e.st = "balcony"
		e.throws += 1
	else:
		e.st = "rec"
		e.recovery_t = 23

func run_move(sim: BmkSimulation, actor: BmkActorState) -> void:
	if actor.species != "heavy":
		super.run_move(sim,actor)
		return
	var s: BmkStageSimulation = sim as BmkStageSimulation
	var e: BmkStageActor = actor as BmkStageActor
	var m: Dictionary = s.stage_data.source["S1_MOVES"]["heavy"][e.mv.clip]
	e.mv_t += 1
	var accumulated: int = 0
	var i: int = 0
	while i < e.mv.lengths.size() and e.mv_t > accumulated + e.mv.lengths[i]:
		accumulated += e.mv.lengths[i]
		i += 1
	if i >= e.mv.lengths.size():
		e.mv = null
		e.st = "chase"
		e.t = 0
		e.pat = ""
		e.attack_cd = s.js_round(s.random_between(15,45))
		return
	e.mv_f = i
	var fn: int = i + 1
	e.st = "wind" if fn <= e.mv.warning_frames else "act"
	if m.has("dash") and fn >= int(m["dash"][0]) and fn <= int(m["dash"][1]) and (s.player.x - e.x) * e.face > 34: e.x += e.face * float(m["dash"][2]) * 102.24
	if m.has("grab") and fn >= int(m["grab"][0]) and fn <= int(m["grab"][1]) and not e.grab_used:
		var reach: float = measured(s,"heavy",e.mv.clip,m["grab"],"tip",true)
		var dx: float = (s.player.x - e.x) * e.face
		if dx > -8 and dx < reach + 14 and absf(s.player.y - e.y) < 14 and s.player.z < 32 and s.player.inv <= 0 and s.player.st not in ["dead","down","special","grabbed"]:
			var free: bool = true
			for other: BmkActorState in s.enemies:
				if other != e and other.st == "grabbing": free = false
			if free:
				e.grab_used = true
				s.grabs.begin(s,e,"heavy")
				return
	var hits: Array = m.get("hits",[])
	for k: int in range(hits.size()):
		var hit: Dictionary = hits[k]
		if fn < int(hit["f"][0]) or fn > int(hit["f"][1]) or e.mv_used.has(k): continue
		var reach: float = measured(s,"heavy",e.mv.clip,hit["f"],"tip",true)
		var back: float = -measured(s,"heavy",e.mv.clip,hit["f"],"back",false)
		var dx: float = (s.player.x - e.x) * e.face
		if dx > -back - 14 and dx < reach + 14 and absf(s.player.y - e.y) < 26 and s.player.z < 60 and s.combat.hurt_player(s,s.js_round(float(hit["dmg"]) * 10),int(signf(s.player.x - e.x)) if s.player.x != e.x else e.face,bool(hit.get("kd",false))):
			e.mv_used[k] = true
			e.mv_hit = true

func measured(s: BmkStageSimulation, species: String, clip: String, frames: Array, point: String, maximum: bool) -> float:
	var art: Dictionary = s.stage_data.source["STAGE1_ENEMY_ART"][species]
	var result: float = -INF if maximum else INF
	for f: int in range(int(frames[0]),int(frames[1]) + 1):
		var value: float = float(art["frames"][int(art["clips"][clip][f - 1])][point][0])
		result = maxf(result,value) if maximum else minf(result,value)
	return floor(result * 10 + 0.5) / 10.0

func attack_zone(sim: BmkSimulation, actor: BmkActorState) -> BmkHitZone:
	var s: BmkStageSimulation = sim as BmkStageSimulation
	var e: BmkStageActor = actor as BmkStageActor
	if e.boss or e.balcony or e.st not in ["wind","act"]: return null
	if e.species not in ["heavy","hound","molotov"]: return super.attack_zone(s,e)
	var z: BmkHitZone = BmkHitZone.new()
	z.ex = e.x
	z.y = e.y
	z.ez = e.z
	z.face = e.face
	if e.species == "heavy" and e.mv != null:
		var m: Dictionary = s.stage_data.source["S1_MOVES"]["heavy"][e.mv.clip]
		var target: Dictionary = {}
		if m.has("grab"): target = {"f":m["grab"]}
		else:
			for hit: Dictionary in m["hits"]:
				if e.mv_f + 1 <= int(hit["f"][1]):
					target = hit
					break
		if target.is_empty(): return null
		z.reach = measured(s,"heavy",e.mv.clip,target["f"],"tip",true) + 14
		z.relative_height = false
		z.depth = 14 if m.has("grab") else 26
		z.max_height = 32 if m.has("grab") else 60
		z.knockdown = bool(target.get("kd",false))
		z.back = -8 if m.has("grab") else measured(s,"heavy",e.mv.clip,target["f"],"back",false) - 14
		var start: int = e.mv.frame_start(int(target["f"][0]))
		z.active = e.mv_f + 1 >= int(target["f"][0])
		z.progress = 1 if z.active else clampf(float(e.mv_t) / (start + 1),0,1)
		z.hit_in = 0 if z.active else start + 1 - e.mv_t
		z.active_age = e.mv_t - start if z.active else -1
		if not z.active and m.has("dash"):
			z.reach += maxf(0,e.mv.frame_start(int(m["dash"][1]) + 1) - maxi(e.mv_t,e.mv.frame_start(int(m["dash"][0])))) * float(m["dash"][2]) * 102.24
		return z
	if e.dive != null:
		z.ex = e.dive.x0
		z.face = e.dive.dir
		z.relative_height = false
		z.max_height = 999
		z.depth = 16
		z.back = INF
		z.reach = -INF
		var art: Dictionary = s.stage_data.source["STAGE1_ENEMY_ART"]["hound"]
		for k: int in range(1,13):
			var f: int = BmkFrameSelector.anim_index(PackedInt32Array(s.stage_data.source["S1_ANIM"]["dive"]),12 + k - 1)
			var mouth: float = float(art["frames"][int(art["clips"]["dive"][f])]["hand"][0])
			z.back = minf(z.back,k * 160.0 / 12 + mouth - 22)
			z.reach = maxf(z.reach,k * 160.0 / 12 + mouth + 14)
		z.active = e.dive.t > 12
		z.progress = 1 if z.active else clampf(e.dive.t / 13.0,0,1)
		z.hit_in = 0 if z.active else 13 - e.dive.t
		z.active_age = e.dive.t - 12 if z.active else -1
		return z
	if e.pat == "kick":
		z.reach = 40 + s.player.hw
		z.depth = 16
		z.max_height = 45
		z.active = e.st == "act"
		z.progress = 1 if z.active else clampf(e.t / 14.0,0,1)
		z.hit_in = 0 if z.active else 14 - e.t
		z.active_age = e.t if z.active else -1
		return z
	return null
