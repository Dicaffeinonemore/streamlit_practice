extends SceneTree
var game: BmkMenuGame
var checks: int = 0
var failures: Array[String] = []

func _initialize() -> void:
	call_deferred("run")

func check(value: bool, label: String) -> void:
	checks += 1
	if not value: failures.append(label)

func run() -> void:
	game = load("res://phase4/game.tscn").instantiate() as BmkMenuGame
	root.add_child(game)
	game.capture_mode = true
	game.set_physics_process(false)
	game.save_store.checkpoint_path = "res://phase4/challenge_test_checkpoint.json"
	game.save_store.records_path = "res://phase4/challenge_test_records.json"
	game.save_store.save_checkpoint(BmkCheckpoint.new())
	game.save_store.record(0,1234,"A",120)
	var checkpoint_before: String = FileAccess.get_file_as_string(game.save_store.checkpoint_path)
	var records_before: String = FileAccess.get_file_as_string(game.save_store.records_path)
	game.start_challenge()
	var s: BmkStageSimulation = game.session as BmkStageSimulation
	for i: int in range(1800):
		game._physics_process(1.0 / 60.0)
		if s.mode == "play" and s.sections.event_index > 0 and s.gorath.boss(s) != null and s.gorath.boss(s).st != "intro": break
	var boss_: BmkStageActor = s.gorath.boss(s)
	check(boss_ != null and boss_.st != "intro" and s.mode == "play","Boss encounter starts after intro")
	if boss_ != null:
		s.gorath.phase_two(s,boss_)
		boss_.g2.ult[0] = true
		boss_.g2.ult[1] = true
		boss_.g2.guard = false
		boss_.invulnerable = false
		boss_.st = "chase"
		s.gorath.damage(s,boss_,boss_.max_hp * 2,false,2,true,"c1")
		check(boss_.st == "dead","Controlled lethal hit starts boss death")
		for i: int in range(2000):
			game._physics_process(1.0 / 60.0)
			if game.menu.visible and game.menu.mode == "result": break
		check(game.menu.visible and game.menu.mode == "result" and game.recorded,"Boss death reaches challenge results")
	check(FileAccess.get_file_as_string(game.save_store.checkpoint_path) == checkpoint_before,"Challenge preserves checkpoint")
	check(FileAccess.get_file_as_string(game.save_store.records_path) == records_before,"Challenge preserves story records")
	for path: String in [game.save_store.checkpoint_path,game.save_store.records_path]: DirAccess.remove_absolute(ProjectSettings.globalize_path(path))
	print("CHALLENGE: %d checks; %d failures" % [checks,failures.size()])
	for failure: String in failures: push_error(failure)
	game.queue_free()
	await process_frame
	quit(0 if failures.is_empty() else 1)
