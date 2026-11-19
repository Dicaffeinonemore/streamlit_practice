extends "res://phase2/tests/support/parity_assertions.gd"
## Viesa against original browser traces (tools/oracle/phase5_traces.cjs).

func make_session(spec: Dictionary) -> BmkStageSimulation:
	var s: BmkStageSimulation = BmkStageSimulation.new(load("res://phase3/generated/stage.res") as BmkStageData)
	s.fixed_random = true
	s.barrels.clear()
	s.progression_enabled = false
	s.use_character("viesa")
	s.player.x = 350
	s.player.y = 430
	s.player.inv = 0
	var values: Dictionary = spec.get("player",{})
	if values.has("sp"): s.player.sp = float(values["sp"])
	if values.has("mg"): s.player.mg = int(values["mg"])
	if values.has("hp"): s.player.hp = float(values["hp"])
	for o: Dictionary in spec["enemies"]:
		var e: BmkStageActor = s.spawn(str(o["kind"]),float(o["x"]),float(o["y"])) as BmkStageActor
		e.wait = 20
		e.attack_cd = 40
		if e.species == "heavy": e.grab_cd = 60
		if e.species == "molotov":
			e.molotov = true
			e.attack_cd = 50
			e.lane_y = e.y
		if e.species == "hound":
			e.dive_cd = 80
			e.angle = fmod(e.id * 2.39,TAU)
			e.radius = 270
		if o.has("wait"): e.wait = float(o["wait"])
		if o.has("atkCd"): e.attack_cd = float(o["atkCd"])
		if o.has("move"): s.enemy_controller.begin_move(s,e,str(o["move"]))
		if o.has("grab"): s.grabs.begin(s,e,str(o["grab"]))
	if spec.has("item"): s.item_controller.drop(s,str(spec["item"]),350,430)
	if bool(spec.get("barrel",false)):
		var b: BmkWorldItem = BmkWorldItem.new()
		b.barrel = true
		b.id = -1
		b.x = 450
		b.y = 430
		b.hp = 2
		s.barrels.append(b)
	return s

func state(s: BmkStageSimulation) -> Dictionary:
	var p: BmkStageActor = s.player as BmkStageActor
	var controller: BmkViesaController = s.player_controller as BmkViesaController
	var a: BmkViesaAction = p.viesa_action
	var pose: Array = controller.pose(s)
	var player: Dictionary = {"x":p.x,"y":p.y,"z":p.z,"vx":p.vx,"vz":p.vz,"face":p.face,"hp":p.hp,"max":p.max_hp,"lives":p.lives,"st":p.st,"t":p.t,"inv":p.inv,"flash":p.flash,"sp":p.sp,"mg":p.mg,"buff":p.buff,"score":p.score,"combo":p.combo,"comboT":p.combo_t,"buf":p.buf,"skill":p.skill,"walk":p.walk,"walkTime":p.walk_time,"dashCd":p.dash_cd,"dashGrace":p.dash_grace,"castFired":p.cast_fired,"atk":p.atk,"x0":p.x0,"w":p.w,"hw":p.hw,
		"viesaClip":p.viesa_clip,"viesaFired":p.viesa_fired,"viesaShotQueued":p.viesa_shot_queued,"viesaHoverGrace":p.viesa_hover_grace,"viesaAirPUsed":p.viesa_air_p_used,"viesaLanding":p.viesa_landing,"jumpTime":p.jump_time,"running":p.running,
		"grab":{"kind":p.grab.kind,"presses":p.grab.presses,"t":p.grab.t} if p.grab != null else null,
		"skillCd":p.skill_cd.duplicate(),
		"action":{"phase":a.phase,"id":a.id,"held":a.held,"shots":a.shots,"x0":a.x0,"face":a.face,"high":a.high,"h0":a.h0,"released":a.released,"charge":a.charge,"clock":a.clock,"arrows":a.arrows,"finalFired":a.final_fired,"landed":a.landed} if a != null else null,
		"pose":{"clip":pose[0],"index":pose[1]}}
	var enemies: Array[Dictionary] = []
	for actor: BmkActorState in s.enemies:
		var e: BmkStageActor = actor as BmkStageActor
		enemies.append({"x":e.x,"y":e.y,"z":e.z,"vx":e.vx,"vz":e.vz,"face":e.face,"hp":e.hp,"st":e.st,"t":e.t,"inv":e.inv,"flash":e.flash,"walk":e.walk,"wait":e.wait,"atkCd":e.attack_cd,"hurtT":e.hurt_t,"chainN":e.chain_n,"getup":e.getup,"grabCd":e.grab_cd,"nextKd":e.next_kd,"species":e.species})
	var barrels_: Array[Dictionary] = []
	for b: BmkWorldItem in s.barrels: barrels_.append({"x":b.x,"y":b.y,"hp":b.hp,"flash":b.flash})
	var items_: Array[Dictionary] = []
	for item: BmkWorldItem in s.items: items_.append({"type":item.type,"x":item.x,"y":item.y,"z":item.z,"t":item.t,"life":item.life})
	var arrows: Array[Dictionary] = []
	for z: BmkViesaWorld.Arrow in s.viesa.arrows:
		arrows.append({"x":z.x,"y":z.y,"h":z.h,"dir":z.dir,"age":z.age,"speed":z.speed,"vh":z.vh,"range":z.range_,"travel":z.travel,"depth":z.depth,"aimY":z.aim_y,"startY":z.start_y,"damage":z.damage,"snipe":z.snipe,"rapid":z.rapid,"paidSpecial":z.paid_special,"fading":z.fading,"fadeAge":z.fade_age,"dead":z.dead,"hits":z.hits.size()})
	var ult: Array[Dictionary] = []
	for z: BmkViesaWorld.UltObject in s.viesa.ult:
		ult.append({"kind":z.kind,"x":z.x,"y":z.y,"h":z.h,"sx":z.sx,"sy":z.sy,"sh":z.sh,"tx":z.tx,"ty":z.ty,"th":z.th,"face":z.face,"age":z.age,"life":z.life,"variant":z.variant,"impact":z.impact,"damage":z.damage})
	var effects: Array[Dictionary] = []
	for f: BmkViesaWorld.Effect in s.viesa.effects:
		effects.append({"name":f.name,"x":f.x,"y":f.y,"h":f.h,"age":f.age,"life":f.life,"width":f.width,"height":f.height,"face":f.face})
	return {"tick":s.tick,"mode":s.mode,"hitStop":s.hit_stop,"shake":s.shake,"flashT":s.flash_t,"stat":{"ticks":s.stat_ticks,"damage":s.stat_damage,"deaths":s.stat_deaths,"kills":s.stat_kills},"chain":{"n":s.chain_n,"t":s.chain_t,"max":s.chain_max},
		"player":player,"enemies":enemies,"barrels":barrels_,"items":items_,"arrows":arrows,"ult":ult,"effects":effects}

func test_viesa_source_traces() -> void:
	var fixture: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://phase5/fixtures/traces.json")) as Dictionary
	var total: int = 0
	var per_scenario: Array[Dictionary] = []
	for trace: Dictionary in fixture["traces"]:
		mismatch_lines.clear()
		var spec: Dictionary = trace["spec"]
		var s: BmkStageSimulation = make_session(spec)
		var before: int = mismatch_count
		for frame: int in range((trace["frames"] as Array).size()):
			for event: Dictionary in spec["events"]:
				if int(event["frame"]) == frame:
					if not bool(event.get("up",false)): s.input.press(str(event["key"]),s.tick)
					if not bool(event.get("down",false)): s.input.release(str(event["key"]))
			for command: Dictionary in spec["commands"]:
				if int(command["frame"]) == frame and command.has("hurt"):
					var hurt: Dictionary = command["hurt"]
					s.combat.hurt_player(s,float(hurt["dmg"]),int(hurt["dir"]),bool(hurt["kd"]))
			s.step()
			compare_value(state(s),trace["frames"][frame],"%s step %d" % [spec["id"],frame])
			total += 1
		per_scenario.append({"id":spec["id"],"mismatches":mismatch_count - before,"examples":mismatch_lines.duplicate()})
		if mismatch_count > before:
			gut.p("%s: %d mismatches" % [spec["id"],mismatch_count - before])
			for i: int in range(mini(6,mismatch_lines.size())): gut.p(mismatch_lines[i])
	var report: FileAccess = FileAccess.open("res://evidence/phase5-parity.json",FileAccess.WRITE)
	report.store_string(JSON.stringify({"source_steps":total,"comparisons":comparisons,"mismatches":mismatch_count,"scenarios":per_scenario},"\t"))
	assert_eq(mismatch_count,0,"Phase 5 Viesa source trace parity")
