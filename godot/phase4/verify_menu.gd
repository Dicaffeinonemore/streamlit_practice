extends SceneTree
var failures: Array[String] = []
var checks: int = 0
var game: BmkMenuGame

func _initialize() -> void:
	call_deferred("run")

func check(condition: bool, label: String) -> void:
	checks += 1
	if not condition: failures.append(label)

func run() -> void:
	game = load("res://phase4/game.tscn").instantiate() as BmkMenuGame
	root.add_child(game)
	game.capture_mode = true
	game.set_physics_process(false)
	game.save_store.checkpoint_path = "res://phase4/test_checkpoint.json"
	game.save_store.records_path = "res://phase4/test_records.json"
	game.preferences.storage_path = "res://phase4/test_settings.json"
	game.save_store.write_json(game.save_store.checkpoint_path,null)
	game.save_store.write_json(game.save_store.records_path,{"bestScore":0,"stages":[]})
	game.menu.show_title()
	check(game.menu.visible and game.menu.mode == "title" and game.clock.paused,"Title pauses gameplay")
	game.start_new()
	check(not game.menu.visible and not game.clock.paused,"New game starts")
	check(game.save_store.checkpoint() != null,"New game saves stage entry")
	game.session.player.hp = 10
	game.session.player.score = 700
	game.restore_checkpoint()
	check(game.session.player.hp == 100 and game.session.player.score == 0,"Continue restores stage entry")
	game.pause_game(true)
	game.menu.show_pause()
	game.menu.show_settings()
	game.menu.change_preset("wasd")
	check(game.physical.preset == "wasd","Settings updates input preset")
	game.resume_from_menu()
	check(not game.clock.paused and not game.menu.visible,"Resume restores play")
	var s: BmkStageSimulation = game.session as BmkStageSimulation
	s.mode = "clear"
	s.player.score = 500
	s.stat_ticks = 3600
	s.stat_damage = 0
	s.stat_deaths = 0
	s.chain_max = 10
	game._physics_process(1.0 / 60.0)
	var records: Dictionary = game.save_store.records()
	check(int(records["bestScore"]) == 500 and records["stages"][0]["rank"] == "S","Stage clear records source rank")
	var next_entry: BmkCheckpoint = game.save_store.checkpoint()
	check(next_entry != null and next_entry.stage == 1 and next_entry.score == 500 and next_entry.hp == 100,"Clear stores next stage entry")
	game.retry_current()
	check(game.session.player.score == 0 and game.game_mode == "story" and not game.clock.paused,"Retry uses current stage entry")
	game.start_challenge()
	check(game.game_mode == "challenge" and game.start_section == 4 and game.session.player.sp == 100 and game.session.player.mg == 3,"Challenge starts unlocked Gorath arena")
	game.menu.show_settings()
	game.menu.show_bindings()
	check(not game.preferences.bind("KeyA",KEY_D),"Key conflicts are rejected")
	check(game.preferences.bind("KeyA",KEY_F),"Free key can be bound")
	game.apply_preferences()
	check(game.physical.preset == "custom","Custom bindings become active")
	game.save_store.write_json(game.save_store.checkpoint_path,{"version":1,"stage":99})
	game.restore_checkpoint()
	check(game.menu.message.text == "NO VALID CHECKPOINT","Invalid save is rejected")
	game.menu.show_title()
	game.start_practice()
	check(game.game_mode == "practice" and not game.clock.paused and game.session.enemies.size() == 1 and game.session.enemies[0].training,"Practice creates a training enemy")
	DirAccess.remove_absolute(ProjectSettings.globalize_path(game.save_store.checkpoint_path))
	DirAccess.remove_absolute(ProjectSettings.globalize_path(game.save_store.records_path))
	DirAccess.remove_absolute(ProjectSettings.globalize_path(game.preferences.storage_path))
	print("MENU VERIFICATION: %d checks; %d failures" % [checks,failures.size()])
	for failure: String in failures: push_error(failure)
	game.queue_free()
	await process_frame
	quit(0 if failures.is_empty() else 1)
