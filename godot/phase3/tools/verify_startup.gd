extends SceneTree
var game: BmkStageGame

func _initialize() -> void:
	call_deferred("run")

func run() -> void:
	var main: String = str(ProjectSettings.get_setting("application/run/main_scene"))
	if main != "res://phase3/stage_game.tscn":
		push_error("F5 main scene is not Stage 1")
		quit(1)
		return
	game = load(main).instantiate() as BmkStageGame
	root.add_child(game)
	game.capture_mode = true
	for i: int in range(12): await physics_frame
	var s: BmkStageSimulation = game.session as BmkStageSimulation
	var expected: int = 4 if "--section=5" in OS.get_cmdline_user_args() else 0
	if s.sections.idx != expected or s.tick <= 0:
		push_error("Main scene did not process the requested section")
		quit(1)
		return
	print("STARTUP: configured F5 scene processed section %d; orderly window-close path" % (s.sections.idx + 1))
	game.request_close()
