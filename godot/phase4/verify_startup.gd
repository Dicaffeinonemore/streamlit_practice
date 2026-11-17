extends SceneTree

func _initialize() -> void:
	call_deferred("run")

func run() -> void:
	var main: String = str(ProjectSettings.get_setting("application/run/main_scene"))
	if main != "res://phase4/game.tscn":
		push_error("Incorrect F5 main scene")
		quit(1)
		return
	var game: BmkMenuGame = load(main).instantiate() as BmkMenuGame
	root.add_child(game)
	game.capture_mode = true
	await process_frame
	if game.menu == null or not game.menu.visible or game.menu.mode != "title" or not game.clock.paused:
		push_error("F5 title did not initialize")
		quit(1)
		return
	print("STARTUP: F5 title displayed and game paused")
	game.queue_free()
	await process_frame
	quit(0)
