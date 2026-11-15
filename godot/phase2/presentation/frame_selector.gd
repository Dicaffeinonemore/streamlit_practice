class_name BmkFrameSelector
extends RefCounted
## Rendering reads completed simulation state and never advances an actor.
var timelines: Dictionary

func _init(source_timelines: Dictionary = {}) -> void:
	timelines = source_timelines

func on_timeline(clip: String, timeline: Array, ms: float) -> Dictionary:
	for pair: Array in timeline:
		if ms < float(pair[1]):
			return {"clip":clip,"index":int(pair[0])}
	return {"clip":clip,"index":int(timeline[-1][0])}

func player(s: BmkSimulation) -> Dictionary:
	var p: BmkActorState = s.player
	var ms: float = p.t * s.MS
	match p.st:
		"atk":
			var clip: String = {"c1":"combo0","c2":"combo1","c3":"combo2","air":"air"}.get(p.atk,"combo0")
			return on_timeline(clip,timelines[clip],ms)
		"dash_attack":
			var index: int = 9
			for i: int in range(s.data.dash_attack_ends.size()):
				if p.t < s.data.dash_attack_ends[i]:
					index = i
					break
			return {"clip":"thrust","index":[2,3,4,5,6,7,7,8,9,9][index]}
		"skill":
			return on_timeline("special4" if p.skill == "redwave" else p.skill,timelines["skill"][p.skill],ms)
		"special":
			var end: float = s.data.special_from + s.data.special_interval * s.data.special_hits.size()
			if ms < s.data.special_from:
				return on_timeline("special1",timelines["special1"],ms)
			if ms < end:
				var k: int = int(floor((ms - s.data.special_from) / s.data.special_interval))
				var u: float = (ms - s.data.special_from - k * s.data.special_interval) / s.data.special_interval
				return {"clip":"special%d" % (k + 2),"index":2 + mini(7,int(floor(u * 8.0)))}
			return on_timeline("special5",timelines["special5"],ms)
		"cast", "dash":
			return on_timeline(p.st,timelines[p.st],ms)
		"hurt":
			return {"clip":"hurt","index":1 + int(floor(clampf(float(p.t) / p.hurt_duration,0.0,0.999) * 11.0))}
		"down":
			var index: int = (1 if p.t < 3 else (2 if p.t < 6 else (3 if p.vz > 0.0 else 4))) if p.z > 0.0 else (5 if p.t < 22 else (6 if p.t < 36 else (7 if p.t < 44 else (8 if p.t < 50 else 9))))
			return {"clip":"down","index":index}
		"dead":
			return {"clip":"down","index":1 + mini(6,int(floor(ms / 1000.0 * 7.0)))}
	var legacy: int = 0
	if p.z > 0.0 or p.vz > 0.0:
		match s.jump_phase:
			"prejump": legacy = 1
			"riseFast": legacy = 2 if s.jump_phase_ticks < 4 else 3
			"riseSlow": legacy = 4
			"apex": legacy = 5 if s.jump_phase_ticks < 5 else 6
			_: legacy = 8 if p.vz < -5.0 else 7
	elif s.landing_tick >= 0:
		legacy = 9 if p.t - s.landing_tick < 4 else 10
	if legacy > 0:
		return {"clip":"jump","index":[3,3,4,5,5,6,6,7,7,8,9][legacy]}
	return {"clip":"walk","index":1 + int(floor(fmod(p.walk_time,900.0) / 900.0 * 11.0))} if p.walk else {"clip":"idle","index":int(floor(s.tick * s.MS / 130.0)) % 10}

static func anim_index(lengths: PackedInt32Array, ticks: int) -> int:
	var accumulated: int = 0
	for i: int in range(lengths.size()):
		accumulated += lengths[i]
		if ticks < accumulated:
			return i
	return lengths.size() - 1

func enemy(s: BmkSimulation, e: BmkActorState, art: Dictionary) -> Dictionary:
	var clip: String = "idle"
	var index: int = 0
	match e.st:
		"dead", "down":
			clip = "knockdown"
			index = clampi(int(floor(float(e.t) / (25.0 if e.st == "dead" else 40.0) * (art["clips"][clip] as Array).size())),0,(art["clips"][clip] as Array).size() - 1)
		"hurt":
			clip = "hurt"
			index = clampi(int(floor(minf(1.0,float(e.t) / ((e.hurt_t if e.hurt_t != 0 else s.data.enemy_hurt_ticks) * 0.7)) * 0.5 * (art["clips"][clip] as Array).size())),0,4) + (5 if e.hit_low else 0)
		_:
			if e.st == "rec" and e.getup:
				clip = "getup"
				index = anim_index(s.data.getup_lengths,e.t)
			elif e.mv != null:
				clip = e.mv.clip
				index = e.mv_f
			else:
				clip = "walk" if e.walk else "idle"
				index = int(floor(float(s.tick) / (5.0 if e.walk else 8.0) + e.id * 3.0)) % (art["clips"][clip] as Array).size()
	return {"clip":clip,"index":index}
