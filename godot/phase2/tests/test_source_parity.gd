extends "res://phase2/tests/support/parity_assertions.gd"
func test_all_source_frame_traces() -> void:
	var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string("res://phase2/fixtures/traces.json"))
	var fixture: Dictionary = parsed as Dictionary
	var count: int = 0
	for trace: Dictionary in fixture["traces"]:
		var scenario: Dictionary = trace["scenario"]
		var s: BmkSimulation = setup_scenario(scenario)
		s.take_audio() # the oracle clears its AUDIO log after scenario setup
		var before: int = mismatch_count
		for i: int in range(trace["frames"].size()):
			commands(s, scenario, i)
			s.step()
			compare_value(snapshot(s), trace["frames"][i], "%s tick %d" % [scenario["id"],i])
			count += 1
		if mismatch_count > before:
			gut.p("Mismatch: %s (%d fields)" % [scenario["id"], mismatch_count - before])
	for line: String in mismatch_lines:
		gut.p(line)
	assert_eq(mismatch_count, 0, "%d original source steps; %d field comparisons" % [count,comparisons])
	var file: FileAccess = FileAccess.open("res://evidence/phase2-parity.json", FileAccess.WRITE)
	file.store_string(JSON.stringify({"source_steps":count,"comparisons":comparisons,"mismatches":mismatch_count,"examples":mismatch_lines},"\t"))

func test_clock_render_rate_independence() -> void:
	for hz: int in [30,60,144]:
		var s: BmkSimulation = BmkSimulation.new(load(DATA_PATH) as BmkCombatData)
		var clock: BmkSimulationClock = BmkSimulationClock.new(s)
		for frame: int in range(hz * 3):
			clock.advance(1000.0 / hz)
		assert_between(s.tick,179,180,"Same 60 Hz simulation budget at %d Hz render cadence" % hz)
