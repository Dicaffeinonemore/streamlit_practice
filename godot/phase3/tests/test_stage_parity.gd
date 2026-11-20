extends "res://phase2/tests/support/parity_assertions.gd"

func make_session(spec: Dictionary) -> BmkStageSimulation:
	var s: BmkStageSimulation = BmkStageSimulation.new(load("res://phase3/generated/stage.res") as BmkStageData)
	s.fixed_random = true
	s.barrels.clear()
	s.player.x = 350
	s.player.inv = 0
	s.progression_enabled = bool(spec.get("progression",false))
	if bool(spec.get("intro",false)):
		s.sections.enter_section(4)
		s.gorath.begin_intro(s)
	elif s.progression_enabled:
		s.sections.enter_section(0)
		s.barrels.clear()
	elif not str(spec["kind"]).is_empty():
		var e: BmkStageActor = s.spawn(str(spec["kind"]),260,430) as BmkStageActor
		if e.boss:
			if int(spec.get("phase",1)) == 2: s.gorath.phase_two(s,e)
			if bool(spec.get("spent",false)): e.g2.ult = [true,true]
			if spec.has("move"): s.gorath.start_move(s,e,str(spec["move"]))
		else:
			if e.species == "heavy": e.grab_cd = 60
			if e.species == "molotov":
				e.molotov = true
				e.attack_cd = 50
				e.lane_y = e.y
			if e.species == "hound":
				e.dive_cd = 80
				e.angle = fmod(e.id * 2.39,TAU)
				e.radius = 270
			if spec.has("move"): s.enemy_controller.begin_move(s,e,str(spec["move"]))
			if spec.has("grab"): s.grabs.begin(s,e,str(spec["grab"]))
	if bool(spec.get("safe",false)): s.player.inv = 10000
	if spec.has("item"):
		s.player.hp = 40
		s.item_controller.drop(s,str(spec["item"]),350,430)
	if bool(spec.get("barrel",false)):
		var b: BmkWorldItem = BmkWorldItem.new()
		b.barrel = true
		b.id = -1
		b.x = 400
		b.y = 430
		b.hp = 2
		s.barrels.append(b)
	return s

func state(s: BmkStageSimulation, progression: bool) -> Dictionary:
	var p: BmkStageActor = s.player as BmkStageActor
	var entities: Array[Dictionary] = []
	var poses: Array[Dictionary] = []
	var full_selector: BmkFullFrameSelector = BmkFullFrameSelector.new(source_catalogs["barel_timelines"])
	for actor: BmkActorState in s.enemies:
		var e: BmkStageActor = actor as BmkStageActor
		var entry: Dictionary = {"x":e.x,"y":e.y,"z":e.z,"vx":e.vx,"vz":e.vz,"face":e.face,"hp":e.hp,"st":e.st,"t":e.t,"inv":e.inv,"flash":e.flash,"walk":e.walk,"wait":e.wait,"atkCd":e.attack_cd,"recT":e.recovery_t,"hurtT":e.hurt_t,"chainN":e.chain_n,"hitLow":e.hit_low,"redFlash":e.red_flash,"getup":e.getup,"pat":e.pat,"invuln":e.invulnerable,"alpha":e.alpha,"grabCd":e.grab_cd,"kickCd":e.kick_cd,"diveCd":e.dive_cd,"ang":e.angle,"rad":e.radius,"balcony":e.balcony,"molotov":e.molotov,"throws":e.throws,"throwAt":null if e.throw_at == -99999 else e.throw_at,"laneY":e.lane_y if e.molotov else null,"bite":e.bite,"armorHits":e.armor_hits,"armorT":null if e.armor_t == -999 else e.armor_t,"gr":e.gr,"grT":e.gr_t,"nextKd":e.next_kd,"species":e.species,"mv":{"clip":e.mv.clip,"t":e.mv_t,"f":e.mv_f} if e.mv != null else null,"dive":{"t":e.dive.t,"f":e.dive.f,"dir":e.dive.dir,"x0":e.dive.x0} if e.dive != null else null,"g2":null}
		if e.g2 != null:
			var g: BmkGorathState = e.g2
			var meats: Array[Dictionary] = []
			for m: BmkMeatState in g.meats: meats.append({"kind":m.kind,"x":m.x,"y":m.y,"t":m.t,"start":m.start,"land":m.land,"n":m.n,"spin":m.spin,"frame":m.frame()})
			entry["g2"] = {"phase":g.phase,"st":g.st,"clip":g.clip,"fi":g.fi,"age":g.age,"walkT":g.walk_t,"tail":g.tail,"breath":g.breath,"guard":g.guard,"pendingT":g.pending_t,"ult":g.ult,"act":{"kind":g.act.kind,"id":g.act.id,"t":g.act.t,"f":g.act.f,"ph":g.act.phase,"pulls":g.act.pulls,"step":g.act.step} if g.act != null else null,"hook":{"x":g.hook.x,"y":g.hook.y,"h":g.hook.h,"st":g.hook.st,"u":g.hook.u,"ult":g.hook.ult,"hidden":g.hook.hidden} if g.hook != null else null,"meats":meats}
		entities.append(entry)
		poses.append(full_selector.enemy(s,e,s.stage_data.source["STAGE1_ENEMY_ART"].get(e.species,{})))
	var items_: Array[Dictionary] = []
	for item: BmkWorldItem in s.items: items_.append({"type":item.type,"x":item.x,"y":item.y,"z":item.z,"vx":item.vx,"vz":item.vz,"t":item.t,"life":item.life})
	var hazards_: Array[Dictionary] = []
	var barrels_: Array[Dictionary] = []
	for b: BmkWorldItem in s.barrels: barrels_.append({"x":b.x,"y":b.y,"hp":b.hp,"flash":b.flash})
	for z: BmkFireHazard in s.fire_hazards: hazards_.append({"type":z.type,"x":z.x,"y":z.y,"h":z.h,"age":z.age,"dead":z.dead})
	return {"audio":s.take_audio(),"pose":poses,"barrels":barrels_,"tick":s.tick,"mode":s.mode,"hitStop":s.hit_stop,"shake":s.shake,"flashT":s.flash_t,"stat":{"ticks":s.stat_ticks,"damage":s.stat_damage,"deaths":s.stat_deaths,"kills":s.stat_kills},"chain":{"n":s.chain_n,"t":s.chain_t,"max":s.chain_max},"player":{"x":p.x,"y":p.y,"z":p.z,"vx":p.vx,"vz":p.vz,"hp":p.hp,"lives":p.lives,"st":p.st,"t":p.t,"inv":p.inv,"flash":p.flash,"score":p.score,"sp":p.sp,"mg":p.mg,"buff":p.buff,"grab":{"kind":p.grab.kind,"presses":p.grab.presses,"t":p.grab.t,"hold":p.grab.hold,"squeezes":p.grab.squeezes} if p.grab != null else null},"section":{"idx":s.sections.idx,"event":s.sections.event_index,"locked":s.sections.locked,"cam":s.cam_x,"fade":s.sections.fade_t,"wall":s.sections.wall_t,"broken":s.sections.wall_broken,"gate":s.sections.gate_t} if progression else null,"enemies":entities,"items":items_,"hazards":hazards_}

func test_full_stage_source_traces() -> void:
	var fixture: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://phase3/fixtures/traces.json")) as Dictionary
	var total: int = 0
	var per_scenario: Array[Dictionary] = []
	for trace: Dictionary in fixture["traces"]:
		mismatch_lines.clear()
		var spec: Dictionary = trace["spec"]
		var s: BmkStageSimulation = make_session(spec)
		s.take_audio() # the oracle clears its AUDIO log after scenario setup
		var before: int = mismatch_count
		for frame: int in range((trace["frames"] as Array).size()):
			for event: Dictionary in spec["events"]:
				if int(event["frame"]) == frame:
					s.input.press(str(event["key"]),s.tick)
					s.input.release(str(event["key"]))
			for command: Dictionary in spec["commands"]:
				if int(command["frame"]) == frame:
					if bool(command.get("barrel",false)): s.item_controller.damage_barrel(s,s.barrels[0])
					else: s.combat.damage_enemy(s,s.enemies[0],float(command["damage"]),false,0,false,"c1")
			if s.progression_enabled:
				s.player.inv = 10000
				if s.sections.locked and frame % 90 == 0:
					for e: BmkActorState in s.enemies:
						e.st = "dead"
						e.t = 0
						e.hp = 0
						e.mv = null
						(e as BmkStageActor).dive = null
				if not s.sections.locked and s.sections.fade_t < 0: s.player.x = minf(s.player.x + 6,s.stage_length - 50)
			s.step()
			compare_value(state(s,s.progression_enabled),trace["frames"][frame],"%s step %d" % [spec["id"],frame])
			total += 1
		per_scenario.append({"id":spec["id"],"mismatches":mismatch_count - before,"examples":mismatch_lines.duplicate()})
		if mismatch_count > before:
			gut.p("%s: %d mismatches" % [spec["id"],mismatch_count - before])
			for i: int in range(mini(8,mismatch_lines.size())): gut.p(mismatch_lines[i])
		s.stage_driver = Callable()
	for line: String in mismatch_lines: gut.p(line)
	var report: FileAccess = FileAccess.open("res://evidence/phase3-parity.json",FileAccess.WRITE)
	report.store_string(JSON.stringify({"source_steps":total,"comparisons":comparisons,"mismatches":mismatch_count,"scenarios":per_scenario,"examples":mismatch_lines},"\t"))
	assert_eq(mismatch_count,0,"Phase 3 real source trace parity")
