extends "res://phase2/tests/support/parity_assertions.gd"
## Stage 5 (and the Stage 3-5 arena rifts) against original browser traces (tools/oracle/phase9_traces.cjs).

func make_session(spec: Dictionary) -> BmkWaveSimulation:
	var index: int = int(spec.get("stage",4))
	var s: BmkWaveSimulation = BmkWaveSimulation.new(load("res://phase3/generated/stage.res") as BmkStageData,null,index)
	s.fixed_random = true
	s.use_character(str(spec["character"]))
	s.start_stage(false)
	s.tick = 0
	s.next_id = 1
	var banner: bool = bool(spec.get("banner",false))
	var progression: bool = bool(spec.get("progression",false))
	if not banner: s.mode = "play"
	if not progression and not banner:
		s.barrels.clear()
		s.player.x = 350
		s.player.y = 430
		s.player.inv = 0
		s.wave_idx = (s.stage["waves"] as Array).size()
		s.cam_lock = true
		s.lock_at = 0
	if bool(spec.get("clearReady",false)): s.cam_lock = false
	var values: Dictionary = spec.get("player",{})
	for key: String in values:
		match key:
			"x": s.player.x = float(values[key])
			"y": s.player.y = float(values[key])
			"mg": s.player.mg = int(values[key])
			"sp": s.player.sp = float(values[key])
			"inv": s.player.inv = int(values[key])
			"hp": s.player.hp = float(values[key])
	if bool(spec.get("intro",false)):
		s.cam_lock = false
		s.spawn_wave((s.stage["waves"] as Array)[-1])
	if bool(spec.get("arena",false)):
		for w: Dictionary in s.stage["waves"]:
			if w.has("arena"):
				s.spawn_wave(w)
				break
		for e: BmkActorState in s.enemies:
			e.wait = 100000
			e.attack_cd = 100000
	for o: Dictionary in spec["enemies"]:
		var e: BmkLegacyActor = s.spawn(str(o["kind"]),float(o["x"]),float(o["y"])) as BmkLegacyActor
		if o.has("wait"): e.wait = float(o["wait"])
		if o.has("atkCd"): e.attack_cd = float(o["atkCd"])
		var rules: Dictionary = s.wave_data.source["SOVEREIGN"]["RULES"]
		if int(o.get("phase",1)) == 2:
			e.p2shown = true
			e.hp = float(rules["hp"][1])
			e.max_hp = e.hp
			e.next_kd = e.max_hp * 0.75
		if o.has("hpRatio"): e.hp = e.max_hp * float(o["hpRatio"])
		if bool(o.get("ready",false)):
			var sd: BmkSovereignState = s.sovereign.state(e)
			for f: BmkSovereignState.Fist in sd.fists:
				var home: Array[float] = s.sovereign.home(e,f,sd)
				f.x = home[0]
				f.y = home[1]
				f.h = home[2]
				f.st = "home"
				if int(o.get("phase",1)) == 2:
					f.hp = float(rules["fistHp"][1])
					f.max_hp = f.hp
	return s

static func nullable(v: Variant) -> Variant:
	return v

static func glow(v: String) -> Variant:
	return null if v.is_empty() else v

func sov_entry(s: BmkWaveSimulation, e: BmkLegacyActor) -> Variant:
	var sd: BmkSovereignState = e.sovereign
	if sd == null: return null
	var cooldowns: Array = []
	for id: String in sd.cooldowns:
		if sd.cooldowns[id] > 0: cooldowns.append("%s:%d" % [id,sd.cooldowns[id]])
	cooldowns.sort()
	var jobs: Array = []
	for j: BmkSovereignState.Job in sd.jobs:
		var hits: Array = j.hits.keys()
		hits.sort()
		var fists: Array = j.fists.map(func(f: BmkSovereignState.Fist) -> String: return str(f.i))
		var hands: Variant = null
		if j.hands != null: hands = (j.hands as Array).map(func(h: BmkSovereignState.Hand) -> Array: return [h.x,h.y,h.dir,h.age_ms,h.fired,h.hit])
		jobs.append({"id":j.id,"t":j.t,"st":j.st,"stage":j.stage,"danger":j.danger,"dangerDone":j.danger_done,"warn":j.warn,"done":j.done,"p2":j.p2,"hits":",".join(hits),
			"fists":",".join(fists),"helper":j.helper.i if j.helper != null else null,"lane":j.lane,"dir":j.dir,"travel":j.travel,"k":j.k,"side":j.side,"cx":j.cx,"tx":j.tx,"start":j.start,
			"mark":[j.mark.x,j.mark.y,j.mark.blink] if j.mark != null else null,"marks":(j.marks as Array).size() if j.marks != null else null,"remaining":j.remaining,"spawned":j.spawned,
			"elapsedMs":j.elapsed_ms,"lastY":j.last_y,"hands":hands})
	var body: Variant = null
	if sd.body != null:
		var b: BmkSovereignState.Body = sd.body
		body = {"clip":b.clip,"from":b.from,"to":b.to,"ticks":b.ticks,"t":b.t,"bound":b.bound,"drawing":b.drawing,"idle":b.idle,"job":sd.jobs.find(b.job)}
	return {"now":sd.now,"pressure":sd.pressure,"pressureT":sd.pressure_t,"forceBackhand":sd.force_backhand,"lastMove":null if sd.last_move.is_empty() else sd.last_move,"repeats":sd.repeats,
		"lastDangerEnd":sd.last_danger_end,"dangerWas":sd.danger_was,"pending":[sd.pending["id"],sd.pending["until"]] if not sd.pending.is_empty() else null,"grounded":sd.grounded,"downAt":sd.down_at,
		"transAge":sd.trans_age,"ultimateUsed":sd.ultimate_used,"dead":sd.dead,"remains":sd.remains,"cooldowns":",".join(cooldowns),"body":body,"jobs":jobs,
		"marks":sd.marks.map(func(m: BmkSovereignState.Mark) -> Array: return [m.x,m.y,m.rx,m.ry,m.blink,m.done,m.k]),
		"waves":sd.waves.map(func(w: BmkSovereignState.Wave) -> Array: return [w.x,w.dir,w.age,w.hit]),
		"fx":sd.fx.map(func(f: BmkSovereignState.Fx) -> Array: return [f.id,f.x,f.y,f.h,f.w,f.hgt,f.life,f.age,f.ground]),
		"fists":sd.fists.map(func(f: BmkSovereignState.Fist) -> Dictionary: return {"x":f.x,"y":f.y,"h":f.h,"face":f.face,"st":f.st,"hp":f.hp,"max":f.max_hp,"pose":f.pose,"angle":f.angle,
			"glow":glow(f.glow),"trail":f.trail,"timer":f.timer,"wake":f.wake,"flash":f.flash,"vh":f.vh,"broken":f.broken,"job":sd.jobs.find(f.job) if f.job != null else null})}

func hazard_entry(z: Object) -> Dictionary:
	var entry: Dictionary = {"type":"","kind":"","x":0.0,"y":0.0,"h":0.0,"age":0.0,"dead":false,"dir":0,"delay":0.0,"life":0.0,"hit":false,"boom":false,"width":0.0,"depth":0.0,"arena":false,"damage":0.0}
	if z is BmkViesaWorld.Arrow:
		var a: BmkViesaWorld.Arrow = z as BmkViesaWorld.Arrow
		entry.merge({"type":"viesa_arrow","x":a.x,"y":a.y,"h":a.h,"age":a.age,"dead":a.dead,"dir":a.dir,"damage":a.damage,"depth":a.depth},true)
	elif z is BmkProjectileState:
		var w: BmkProjectileState = z as BmkProjectileState
		entry.merge({"type":"pwave","x":w.x,"y":w.y,"h":w.height,"age":w.age,"dead":w.dead,"dir":w.direction,"damage":w.damage},true)
	else:
		var h: BmkLegacyHazard = z as BmkLegacyHazard
		entry.merge({"type":h.type,"kind":h.kind,"x":h.x,"y":h.y,"h":h.h,"age":h.age,"dead":h.dead,"dir":h.dir,"delay":h.delay,"life":h.life,"hit":h.hit,"boom":h.boom,"width":h.width,"depth":h.depth,"arena":h.arena,"damage":h.damage},true)
	return entry

func state(s: BmkWaveSimulation) -> Dictionary:
	var p: BmkStageActor = s.player as BmkStageActor
	var grab: Variant = [p.grab.presses,p.grab.hold] if p.grab != null and p.grab.kind == "sovereign" else null
	var player: Dictionary = {"x":p.x,"y":p.y,"z":p.z,"vx":p.vx,"vz":p.vz,"face":p.face,"hp":p.hp,"max":p.max_hp,"lives":p.lives,"st":p.st,"t":p.t,"inv":p.inv,"flash":p.flash,"sp":p.sp,"mg":p.mg,"buff":p.buff,"score":p.score,"combo":p.combo,"comboT":p.combo_t,"buf":p.buf,"skill":p.skill,"atk":p.atk,"hurtKind":p.hurt_kind,"hurtDuration":p.hurt_duration,"viesaClip":p.viesa_clip,"grab":grab}
	var enemies: Array[Dictionary] = []
	for actor: BmkActorState in s.enemies:
		var e: BmkLegacyActor = actor as BmkLegacyActor
		enemies.append({"x":e.x,"y":e.y,"z":e.z,"vx":e.vx,"vz":e.vz,"face":e.face,"hp":e.hp,"max":e.max_hp,"st":e.st,"t":e.t,"inv":e.inv,"flash":e.flash,"walk":e.walk,"wait":e.wait,"atkCd":e.attack_cd,"recT":e.recovery_t,"hurtT":e.hurt_t,"chainN":e.chain_n,"pat":e.pat,"pt":e.pt,"last":e.last,"invuln":e.invulnerable,"alpha":e.alpha,"gr":e.gr,"grMax":e.gr_max,"grT":e.gr_t,"nextKd":e.next_kd,"p2shown":e.p2shown,"phaseT":e.phase_t,"remove":e.remove,"form":e.form,"type":e.type,"hw":e.hw,"hheavy":e.hheavy,"sov":sov_entry(s,e)})
	var order: Array = []
	order.append_array(s.viesa.arrows)
	order.append_array(s.hazards)
	order.append_array(s.legacy_hazards)
	order.sort_custom(func(a: Object, b: Object) -> bool: return a.get("seq") < b.get("seq"))
	var hazards: Array[Dictionary] = []
	for z: Object in order: hazards.append(hazard_entry(z))
	var barrels_: Array[Dictionary] = []
	for b: BmkWorldItem in s.barrels: barrels_.append({"x":b.x,"y":b.y,"hp":b.hp,"flash":b.flash})
	var items_: Array[Dictionary] = []
	for item: BmkWorldItem in s.items: items_.append({"type":item.type,"x":item.x,"y":item.y,"z":item.z,"t":item.t,"life":item.life})
	var arena: Variant = [s.arena["kind"],s.arena["time"],s.arena["next"],s.arena["cycle"]] if not s.arena.is_empty() else null
	return {"tick":s.tick,"mode":s.mode,"hitStop":s.hit_stop,"shake":s.shake,"flashT":s.flash_t,"slowT":s.slow_request,"camX":s.cam_x,"camLock":s.cam_lock,"waveIdx":s.wave_idx,"clearT":s.clear_t,"introT":s.intro_t if s.mode == "bossintro" else null,"bannerT":s.banner_t,
		"stat":{"ticks":s.stat_ticks,"damage":s.stat_damage,"deaths":s.stat_deaths,"kills":s.stat_kills},"chain":{"n":s.chain_n,"t":s.chain_t,"max":s.chain_max},
		"player":player,"remains":s.sovereign_remains.map(func(r: PackedFloat64Array) -> Array: return Array(r)) if s.sovereign != null else [],"arena":arena,"enemies":enemies,"hazards":hazards,"barrels":barrels_,"items":items_}

func test_stage5_source_traces() -> void:
	var fixture: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://phase9/fixtures/traces.json")) as Dictionary
	var total: int = 0
	var per_scenario: Array[Dictionary] = []
	var only: String = OS.get_environment("BMK_SCENARIO")
	for trace: Dictionary in fixture["traces"]:
		var spec: Dictionary = trace["spec"]
		if not only.is_empty() and str(spec["id"]) != only: continue
		mismatch_lines.clear()
		var s: BmkWaveSimulation = make_session(spec)
		var before: int = mismatch_count
		var first_bad: int = -1
		for frame: int in range((trace["frames"] as Array).size()):
			for event: Dictionary in spec["events"]:
				if int(event["frame"]) == frame:
					if not bool(event.get("up",false)): s.input.press(str(event["key"]),s.tick)
					if not bool(event.get("down",false)): s.input.release(str(event["key"]))
			for c: Dictionary in spec["commands"]:
				if int(c["frame"]) != frame: continue
				var e: BmkLegacyActor = s.enemies[-1] as BmkLegacyActor
				if c.has("job"): s.sovereign.start_job(s,e,s.sovereign.state(e),str(c["job"]))
				if c.has("damage"): s.combat.damage_enemy(s,e,float(c["damage"]),bool(c.get("kd",false)),0,false,"c1")
				if c.has("fist"): s.sovereign.damage_fist(s,e,e.sovereign.fists[int(c["fist"][0])],float(c["fist"][1]),bool(c["fist"][2]))
				if c.has("atkCd"): e.attack_cd = float(c["atkCd"])
				if c.has("set"):
					for key: String in c["set"]: if key == "gr": e.gr = float(c["set"][key])
			if bool(spec.get("progression",false)):
				s.player.inv = 10000
				if s.cam_lock and frame % 90 == 0:
					for e: BmkActorState in s.enemies:
						if e.boss: continue
						e.st = "dead"
						e.t = 0
						e.hp = 0
				if not s.cam_lock and s.mode == "play": s.player.x = minf(s.player.x + 6,s.stage_length - 50)
			s.step()
			var count: int = mismatch_count
			compare_value(state(s),trace["frames"][frame],"%s step %d" % [spec["id"],frame])
			if mismatch_count > count and first_bad < 0: first_bad = frame
			total += 1
			if mismatch_count - before > 400: break
		per_scenario.append({"id":spec["id"],"mismatches":mismatch_count - before,"first":first_bad,"examples":mismatch_lines.duplicate()})
		if mismatch_count > before:
			gut.p("%s: %d mismatches (first step %d)" % [spec["id"],mismatch_count - before,first_bad])
			for i: int in range(mini(6,mismatch_lines.size())): gut.p(mismatch_lines[i])
	var report: FileAccess = FileAccess.open("res://evidence/phase9-parity.json",FileAccess.WRITE)
	report.store_string(JSON.stringify({"source_steps":total,"comparisons":comparisons,"mismatches":mismatch_count,"scenarios":per_scenario},"\t"))
	assert_eq(mismatch_count,0,"Phase 9 Stage 5 source trace parity")
