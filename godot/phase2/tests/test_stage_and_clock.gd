extends "res://phase2/tests/support/parity_assertions.gd"

func test_source_street_progression() -> void:
	mismatch_count = 0
	comparisons = 0
	mismatch_lines.clear()
	var fixture: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://phase2/fixtures/core_extras.json")) as Dictionary
	var s: BmkSimulation = BmkSimulation.new(load(DATA_PATH) as BmkCombatData)
	s.fixed_random = true
	var street: BmkStreetSection = BmkStreetSection.new(s,BmkSourceJson.combat_source())
	s.player.inv = 10000
	s.input.press("KeyD",0)
	var frames: Array = fixture["street"]
	for frame: int in range(frames.size()):
		if frame in [200,440,490]:
			for e: BmkActorState in s.enemies:
				e.st = "dead"
				e.t = 0
				e.mv = null
				e.vx = 0
				e.vz = 0
				e.hp = 0
		s.step()
		var entities: Array[Dictionary] = []
		for e: BmkActorState in s.enemies:
			entities.append({"id":e.id,"species":e.species,"x":e.x,"y":e.y,"st":e.st,"t":e.t,"invulnerable":e.invulnerable,"alpha":e.alpha,"lockId":e.lock_id,"hp":e.hp})
		var queue: Array = street.spawn_queue if street.locked else []
		var actual: Dictionary = {"camX":s.cam_x,"event":street.event_index,"locked":street.locked,"lockId":street.lock_id,"queue":queue,"secTicks":street.section_ticks,"player":{"x":s.player.x,"y":s.player.y,"st":s.player.st,"inv":s.player.inv},"enemies":entities}
		compare_value(actual,frames[frame],"street step %d" % frame)
	for line: String in mismatch_lines:
		gut.p(line)
	assert_eq(mismatch_count,0,"Source street camera, wave caps, queue and door entry")
	var report: FileAccess = FileAccess.open("res://evidence/phase2-street.json",FileAccess.WRITE)
	report.store_string(JSON.stringify({"steps":frames.size(),"comparisons":comparisons,"mismatches":mismatch_count,"examples":mismatch_lines},"\t"))
	s.stage_driver = Callable()

func test_source_strict_zone_boundaries() -> void:
	var fixture: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://phase2/fixtures/core_extras.json")) as Dictionary
	for point: Dictionary in fixture["boundaries"]:
		var zone: BmkHitZone = BmkHitZone.new()
		zone.ex = 100
		zone.y = 430
		zone.ez = 10
		zone.face = int(point["face"])
		zone.reach = 120
		var actor: BmkActorState = BmkActorState.new()
		actor.x = 100 + zone.face * float(point["dx"])
		actor.y = 430 + float(point["dy"])
		actor.z = float(point["height"])
		assert_eq(zone.contains(actor),bool(point["inside"]),"Source strict x/y/z boundary %s" % str(point))

func test_original_loop_slow_pause_and_elapsed_cap() -> void:
	var fixture: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://phase2/fixtures/core_extras.json")) as Dictionary
	for test: Dictionary in fixture["clocks"]:
		var s: BmkSimulation = BmkSimulation.new(load(DATA_PATH) as BmkCombatData)
		var timer: BmkSimulationClock = BmkSimulationClock.new(s)
		timer.slow_t = 1100
		for frame: Dictionary in test["frames"]:
			timer.paused = bool(frame["paused"])
			timer.advance(str(frame["real_bits"]).hex_decode().decode_double(0))
			assert_eq(s.tick,int(frame["ticks"]),"Original accumulator ticks at %d Hz" % test["hz"])
			assert_almost_eq(timer.accumulator,float(frame["accumulator"]),0.0000001)
			assert_almost_eq(timer.slow_t,float(frame["slowT"]),0.0000001)
