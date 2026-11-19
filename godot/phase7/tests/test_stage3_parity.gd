extends "res://phase2/tests/support/parity_assertions.gd"
## Stage 3 against original browser traces (tools/oracle/phase7_traces.cjs).

func make_session(spec: Dictionary) -> BmkWaveSimulation:
	var s: BmkWaveSimulation = BmkWaveSimulation.new(load("res://phase3/generated/stage.res") as BmkStageData,null,2)
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
			"sp": s.player.sp = float(values[key])
			"inv": s.player.inv = int(values[key])
			"hp": s.player.hp = float(values[key])
	if bool(spec.get("intro",false)):
		s.cam_lock = false
		s.spawn_wave((s.stage["waves"] as Array)[-1])
	for o: Dictionary in spec["enemies"]:
		var e: BmkLegacyActor = s.spawn(str(o["kind"]),float(o["x"]),float(o["y"])) as BmkLegacyActor
		if o.has("wait"): e.wait = float(o["wait"])
		if o.has("atkCd"): e.attack_cd = float(o["atkCd"])
		if int(o.get("phase",1)) == 2:
			e.p2shown = true
			e.hp = float(s.wave_data.source["AURELION_P2_HP"])
			e.max_hp = e.hp
			e.next_kd = e.max_hp * 0.75
			s.aurelion.state(e).halo = true
	return s

func aurelion_entry(e: BmkLegacyActor) -> Variant:
	var a: BmkAurelionState = e.aurelion
	if a == null: return null
	var cooldowns: Array = []
	for id: String in a.cooldowns:
		if a.cooldowns[id] > 0: cooldowns.append("%s:%d" % [id,a.cooldowns[id]])
	cooldowns.sort()
	var marks: Array = []
	for m: PackedFloat64Array in a.marks: marks.append([m[0],m[1]])
	return {"move":a.move,"guard":a.guard,"cursor":a.cursor,"processed":a.processed,"token":a.token,"pressure":a.pressure,"forceGuard":a.force_guard,"lastMove":a.last_move,"repeats":a.repeats,"halo":a.halo,
		"tauntPending":a.taunt_pending,"locomotion":a.locomotion,"locomotionTicks":a.locomotion_ticks,"turnTicks":a.turn_ticks,"transitionAge":a.transition_age,"whirlLanded":a.whirl_landed,
		"cooldowns":",".join(cooldowns),"current":{"index":a.current["index"],"source":a.current["source"],"instance":a.current["instance"]} if not a.current.is_empty() else null,"timeline":a.timeline.size(),"marks":marks}

func hazard_entry(z: Object) -> Dictionary:
	var entry: Dictionary = {"type":"","kind":"","fx":"","x":0.0,"y":0.0,"h":0.0,"age":0.0,"dead":false,"dir":0,"delay":0.0,"life":0.0,"hit":false,"visual":false,"face":0,"damageScale":0.0,"damage":0.0,"castToken":0}
	if z is BmkViesaWorld.Arrow:
		var a: BmkViesaWorld.Arrow = z as BmkViesaWorld.Arrow
		entry.merge({"type":"viesa_arrow","x":a.x,"y":a.y,"h":a.h,"age":a.age,"dead":a.dead,"dir":a.dir,"damage":a.damage},true)
	elif z is BmkProjectileState:
		var w: BmkProjectileState = z as BmkProjectileState
		entry.merge({"type":"pwave","x":w.x,"y":w.y,"h":w.height,"age":w.age,"dead":w.dead,"dir":w.direction,"damage":w.damage},true)
	else:
		var h: BmkLegacyHazard = z as BmkLegacyHazard
		entry.merge({"type":h.type,"kind":h.kind,"fx":h.fx,"x":h.x,"y":h.y,"h":h.h,"age":h.age,"dead":h.dead,"dir":h.dir,"delay":h.delay,"life":h.life,"hit":h.hit,"visual":h.visual,"face":h.face,"damageScale":h.damage_scale,"damage":h.damage,"castToken":h.cast_token},true)
	return entry

func state(s: BmkWaveSimulation) -> Dictionary:
	var p: BmkStageActor = s.player as BmkStageActor
	var player: Dictionary = {"x":p.x,"y":p.y,"z":p.z,"vx":p.vx,"vz":p.vz,"face":p.face,"hp":p.hp,"max":p.max_hp,"lives":p.lives,"st":p.st,"t":p.t,"inv":p.inv,"flash":p.flash,"sp":p.sp,"mg":p.mg,"buff":p.buff,"score":p.score,"combo":p.combo,"comboT":p.combo_t,"buf":p.buf,"skill":p.skill,"atk":p.atk,"hurtKind":p.hurt_kind,"hurtDuration":p.hurt_duration,"viesaClip":p.viesa_clip}
	var enemies: Array[Dictionary] = []
	for actor: BmkActorState in s.enemies:
		var e: BmkLegacyActor = actor as BmkLegacyActor
		var marks: Array = e.marks.keys()
		marks.sort()
		enemies.append({"x":e.x,"y":e.y,"z":e.z,"vx":e.vx,"vz":e.vz,"face":e.face,"hp":e.hp,"max":e.max_hp,"st":e.st,"t":e.t,"inv":e.inv,"flash":e.flash,"walk":e.walk,"wait":e.wait,"atkCd":e.attack_cd,"recT":e.recovery_t,"hurtT":e.hurt_t,"chainN":e.chain_n,"pat":e.pat,"pt":e.pt,"last":e.last,"invuln":e.invulnerable,"alpha":e.alpha,"gr":e.gr,"grMax":e.gr_max,"grT":e.gr_t,"nextKd":e.next_kd,"p2shown":e.p2shown,"morgraMove":e.morgra_move,"morgraLane":e.morgra_lane,"morgraHit":e.morgra_hit,"moonUsed":e.moon_used,"morgraCooldown":e.morgra_cooldown,"phaseT":e.phase_t,"remove":e.remove,"form":e.form,"type":e.type,"hw":e.hw,"hheavy":e.hheavy,"marks":",".join(marks),"aurelion":aurelion_entry(e)})
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
	return {"tick":s.tick,"mode":s.mode,"hitStop":s.hit_stop,"shake":s.shake,"flashT":s.flash_t,"slowT":s.slow_request,"camX":s.cam_x,"camLock":s.cam_lock,"waveIdx":s.wave_idx,"clearT":s.clear_t,"introT":s.intro_t if s.mode == "bossintro" else null,"bannerT":s.banner_t,
		"stat":{"ticks":s.stat_ticks,"damage":s.stat_damage,"deaths":s.stat_deaths,"kills":s.stat_kills},"chain":{"n":s.chain_n,"t":s.chain_t,"max":s.chain_max},
		"player":player,"enemies":enemies,"hazards":hazards,"barrels":barrels_,"items":items_}

func test_stage3_source_traces() -> void:
	var fixture: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://phase7/fixtures/traces.json")) as Dictionary
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
				if c.has("pat"): s.enemy_controller.start_pat(s,s.enemies[0],str(c["pat"]))
				if c.has("damage"): s.combat.damage_enemy(s,s.enemies[0],float(c["damage"]),bool(c.get("kd",false)),0,false,"c1")
				if c.has("atkCd"): s.enemies[0].attack_cd = float(c["atkCd"])
				if c.has("set"):
					for key: String in c["set"]: if key == "gr": (s.enemies[0] as BmkLegacyActor).gr = float(c["set"][key])
				if c.has("hurt"): s.combat.hurt_player(s,float(c["hurt"]["dmg"]),int(c["hurt"]["dir"]),bool(c["hurt"]["kd"]))
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
	var report: FileAccess = FileAccess.open("res://evidence/phase7-parity.json",FileAccess.WRITE)
	report.store_string(JSON.stringify({"source_steps":total,"comparisons":comparisons,"mismatches":mismatch_count,"scenarios":per_scenario},"\t"))
	assert_eq(mismatch_count,0,"Phase 7 Stage 3 source trace parity")
