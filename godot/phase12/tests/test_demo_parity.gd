extends "res://phase2/tests/support/parity_assertions.gd"
## Tutorial demonstration against the original page (tools/oracle/phase12_traces.cjs).

const PCOMMON: Dictionary = {"x":"x","y":"y","z":"z","vx":"vx","vz":"vz","face":"face","hp":"hp","max":"max_hp","st":"st","t":"t","inv":"inv","flash":"flash","sp":"sp","mg":"mg","combo":"combo","comboT":"combo_t","buf":"buf","skill":"skill","walk":"walk","dashCd":"dash_cd","dashGrace":"dash_grace","atk":"atk","running":"running","castFired":"cast_fired"}
const PBAREL: Dictionary = {"spHits":"sp_hits","spFin":"sp_fin","skillDest":"skill_dest"}
const PVIESA: Dictionary = {"viesaClip":"viesa_clip","viesaFired":"viesa_fired","viesaShotQueued":"viesa_shot_queued","viesaHoverGrace":"viesa_hover_grace","viesaAirPUsed":"viesa_air_p_used","viesaLanding":"viesa_landing","jumpTime":"jump_time"}

var fixture: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://phase12/fixtures/traces.json")) as Dictionary

## The live run the oracle builds before toTutorial('pause'): Stage 3, Viesa, camera 640.
func origin_for(spec: Dictionary) -> BmkStageSimulation:
	var config: BmkStageData = load("res://phase3/generated/stage.res") as BmkStageData
	if str(spec["from"]) != "pause":
		return null
	var s: BmkWaveSimulation = BmkWaveSimulation.new(config,null,int(spec["stage"]))
	s.fixed_random = true
	s.use_character(str(spec["char"]))
	s.start_stage(true)
	s.cam_x = float(spec["camX"])
	s.tick = 0
	return s

func state(demo: BmkDemoController) -> Dictionary:
	var s: BmkWaveSimulation = demo.session
	var p: BmkStageActor = s.player as BmkStageActor
	var player: Dictionary = {}
	for key: String in PCOMMON: player[key] = p.get(PCOMMON[key])
	var extra: Dictionary = PVIESA if p.is_viesa() else PBAREL
	for key: String in extra: player[key] = p.get(extra[key])
	# Patch 1.71 (web only, after the Phase 11 baseline) gives Viesa Barel's post-dash grace for her
	# new dash attack. The native port keeps the 1.69 rule (no grace); see PHASE12_REPORT.md.
	if p.is_viesa(): player.erase("dashGrace")
	player["characterId"] = p.character_id
	player["skillCd"] = p.skill_cd.duplicate()
	var a: BmkViesaAction = p.viesa_action
	player["action"] = {"phase":a.phase,"id":a.id,"held":a.held,"shots":a.shots,"released":a.released,"charge":a.charge,"landed":a.landed} if a != null else null
	var enemies: Array[Dictionary] = []
	for actor: BmkActorState in s.enemies:
		var e: BmkLegacyActor = actor as BmkLegacyActor
		enemies.append({"x":e.x,"y":e.y,"z":e.z,"vx":e.vx,"vz":e.vz,"face":e.face,"hp":e.hp,"max":e.max_hp,"st":e.st,"t":e.t,"inv":e.inv,"flash":e.flash,"walk":e.walk,"hr":e.hr,"type":e.type,"training":e.training})
	var pwaves: Array[Dictionary] = []
	for z: BmkProjectileState in s.hazards: pwaves.append({"x":z.x,"y":z.y,"h":z.height,"age":z.age,"dead":z.dead})
	var arrows: Array[Dictionary] = []
	for z: BmkViesaWorld.Arrow in s.viesa.arrows: arrows.append({"x":z.x,"y":z.y,"h":z.h,"age":z.age,"travel":z.travel,"damage":z.damage,"dead":z.dead})
	var events: Array = []
	for e: Dictionary in demo.events: events.append([e["code"],e["at"],e["up"],e["down"],e["released"]])
	var lit: Array = demo.lit.keys()
	lit.sort()
	return {"audio":s.take_audio(),"tick":s.tick,"camX":s.cam_x,"hitStop":s.hit_stop,"shake":s.shake,"flashT":s.flash_t,"chain":{"n":s.chain_n,"t":s.chain_t},
		"demo":{"i":demo.index,"t":demo.t,"after":demo.after,"end":demo.end,"lit":lit,"paused":demo.paused,"bar":demo.progress(),"events":events},
		"player":player,"enemies":enemies,"pwaves":pwaves,"arrows":arrows,"ult":s.viesa.ult.size()}

func test_demo_steps_match_source() -> void:
	for character: String in ["barel","viesa"]:
		var expected: Array = fixture["steps"][character]
		var actual: Array = BmkDemoSteps.STEPS[character]
		assert_eq(actual.size(),expected.size(),"%s step count" % character)
		for i: int in range(expected.size()):
			compare_value(actual[i],expected[i],"%s step %d" % [character,i])
	assert_eq(BmkDemoSteps.MAX_MS,float(fixture["meta"]["maxMs"]),"DEMO_MAX_MS")
	assert_eq(mismatch_count,0,"DEMO_STEPS equal the source")

func test_demo_source_traces() -> void:
	var total: int = 0
	var per_scenario: Array[Dictionary] = []
	for trace: Dictionary in fixture["traces"]:
		mismatch_lines.clear()
		var spec: Dictionary = trace["spec"]
		var demo: BmkDemoController = BmkDemoController.new()
		demo.fixed_random = true
		var origin: BmkStageSimulation = origin_for(spec)
		var before_origin: String = JSON.stringify([origin.tick,origin.cam_x,origin.player.x,origin.player.hp,origin.enemies.size()]) if origin != null else ""
		demo.start(str(spec["char"]),origin)
		var before: int = mismatch_count
		var start: Dictionary = state(demo)
		start.erase("audio")
		var expected_start: Dictionary = (trace["start"] as Dictionary).duplicate(true)
		if str(expected_start["player"]["characterId"]) == "viesa": (expected_start["player"] as Dictionary).erase("dashGrace")
		compare_value(start,expected_start,"%s start" % spec["id"])
		for frame: int in range((trace["frames"] as Array).size()):
			demo.tick()
			var expected: Dictionary = (trace["frames"][frame] as Dictionary).duplicate(true)
			if str(expected["player"]["characterId"]) == "viesa": (expected["player"] as Dictionary).erase("dashGrace")
			compare_value(state(demo),expected,"%s step %d" % [spec["id"],frame])
			total += 1
		if origin != null:
			assert_eq(JSON.stringify([origin.tick,origin.cam_x,origin.player.x,origin.player.hp,origin.enemies.size()]),before_origin,"%s: the live session is untouched" % spec["id"])
		per_scenario.append({"id":spec["id"],"steps":(trace["frames"] as Array).size(),"mismatches":mismatch_count - before,"examples":mismatch_lines.duplicate()})
		if mismatch_count > before:
			gut.p("%s: %d mismatches" % [spec["id"],mismatch_count - before])
			for i: int in range(mini(8,mismatch_lines.size())): gut.p(mismatch_lines[i])
	var report: FileAccess = FileAccess.open("res://evidence/phase12-parity.json",FileAccess.WRITE)
	report.store_string(JSON.stringify({"source_steps":total,"comparisons":comparisons,"mismatches":mismatch_count,"scenarios":per_scenario},"\t"))
	assert_eq(mismatch_count,0,"Phase 12 demo source trace parity")

func test_controls() -> void:
	var demo: BmkDemoController = BmkDemoController.new()
	demo.fixed_random = true
	demo.start("barel")
	demo.step_to(-1)
	assert_eq(demo.index,11,"Previous from the first step wraps to the last")
	demo.step_to(12)
	assert_eq(demo.index,0,"Next from the last step wraps to the first")
	demo.toggle_pause()
	var frozen: int = demo.session.tick
	assert_false(demo.tick(),"A paused demo does not tick")
	assert_eq(demo.session.tick,frozen,"Paused: the session is frozen")
	demo.choose(4)
	assert_false(demo.paused,"Choosing a step resumes the demo")
	assert_eq(demo.index,4,"Chosen step")
	assert_eq(demo.session.enemies.size(),1,"One dummy")
	assert_true(demo.session.enemies[0].training,"The dummy is a training target")
	demo.stop()
	assert_false(demo.on,"Stopped")
	assert_null(demo.session,"The demo session is dropped")
