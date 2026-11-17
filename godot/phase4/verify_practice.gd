extends SceneTree
var game: BmkMenuGame
var failures: Array[String] = []
var checks: int = 0

func _initialize() -> void:
	call_deferred("run")

func check(value: bool, label: String) -> void:
	checks += 1
	if not value: failures.append(label)

func key(code: Key, down: bool) -> void:
	var event: InputEventKey = InputEventKey.new()
	event.keycode = code
	event.physical_keycode = code
	event.pressed = down
	game._unhandled_input(event)

func ticks(count: int) -> void:
	for i: int in range(count): game._physics_process(1.0 / 60.0)

func run() -> void:
	game = load("res://phase4/game.tscn").instantiate() as BmkMenuGame
	root.add_child(game)
	game.capture_mode = true
	game.set_physics_process(false)
	game.save_store.checkpoint_path = "res://phase4/practice_test_checkpoint.json"
	game.save_store.records_path = "res://phase4/practice_test_records.json"
	game.preferences.storage_path = "res://phase4/practice_test_settings.json"
	game.preferences.use_preset("arcade")
	game.apply_preferences()
	game.save_store.save_checkpoint(BmkCheckpoint.new())
	var original: String = FileAccess.get_file_as_string(game.save_store.checkpoint_path)
	game.start_practice()
	key(KEY_RIGHT,true)
	ticks(20)
	key(KEY_RIGHT,false)
	check(game.practice_done.has("move"),"Movement task")
	key(KEY_X,true)
	ticks(10)
	key(KEY_X,false)
	check(game.practice_done.has("jump"),"Jump task")
	ticks(80)
	key(KEY_SHIFT,true)
	ticks(2)
	key(KEY_SHIFT,false)
	check(game.practice_done.has("dash"),"Dash task")
	ticks(80)
	var s: BmkStageSimulation = game.session as BmkStageSimulation
	s.enemies[0].x = s.player.x + 35
	s.enemies[0].y = s.player.y
	s.player.face = 1
	key(KEY_Z,true)
	ticks(30)
	key(KEY_Z,false)
	check(game.practice_done.has("attack"),"Attack task")
	ticks(80)
	s.enemies[0].x = s.player.x + 35
	s.enemies[0].y = s.player.y
	s.player.face = 1
	key(KEY_S,true)
	ticks(45)
	key(KEY_S,false)
	check(game.practice_done.has("skill"),"Skill task")
	s.enemies[0].st = "dead"
	ticks(2)
	check(s.enemies.size() == 1 and s.enemies[0].training and s.enemies[0].st != "dead","Training enemy respawns")
	check(FileAccess.get_file_as_string(game.save_store.checkpoint_path) == original,"Practice preserves checkpoint")
	check(not FileAccess.file_exists(game.save_store.records_path),"Practice does not record a score")
	DirAccess.remove_absolute(ProjectSettings.globalize_path(game.save_store.checkpoint_path))
	print("PRACTICE: %d checks; %d failures" % [checks,failures.size()])
	for failure: String in failures: push_error(failure)
	game.queue_free()
	await process_frame
	quit(0 if failures.is_empty() else 1)
