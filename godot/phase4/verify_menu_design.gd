extends SceneTree
## Menu design 1 (dark iron): pause lower left, options on the right over the title art, Boss
## Challenge on the title. --capture-ui saves screenshots to artifacts/menu-implementation.

var failures: Array[String] = []
var capture := false

func _initialize() -> void:
	call_deferred("run")

func shot(file: String) -> void:
	if not capture: return
	await RenderingServer.frame_post_draw
	var out: String = ProjectSettings.globalize_path("res://../artifacts/menu-implementation/" + file)
	if root.get_texture().get_image().save_png(out) != OK: failures.append(file)

func row_buttons(game: BmkMenuGame) -> Array[Button]:
	var rows: Array[Button] = []
	for child: Node in game.menu.buttons.get_children():
		if child is Button and (child as Button).visible: rows.append(child as Button)
	return rows

func captions(button: Button) -> Array:
	return button.get_meta("captions", [])

func run() -> void:
	capture = OS.get_cmdline_user_args().has("--capture-ui")
	var game := load("res://phase4/game.tscn").instantiate() as BmkMenuGame
	root.add_child(game)
	game.set_physics_process(false)
	game.preferences.storage_path = "res://phase4/design_test_settings.json"
	game.preferences.menu_language = "en"
	game.menu.show_title()
	await process_frame
	var keys: Array = game.menu.title_image.KEYS
	if keys.find("MENU_CHALLENGE") != 2: failures.append("Boss Challenge must be the third title item")
	var challenge: Button = game.menu.title_image.choices[2]
	if challenge.text != "Boss Challenge" or not challenge.is_visible_in_tree(): failures.append("title shows Boss Challenge")
	await shot("godot-title.png")
	challenge.pressed.emit()
	if game.menu.mode != "challenge": failures.append("Boss Challenge opens the boss list")
	game.menu.visible = false
	game.present()
	await process_frame
	game.menu.show_pause()
	game.present()
	await process_frame
	await process_frame
	var dialog: Control = game.menu.dialog
	await shot("godot-pause.png")
	if dialog.position.x > 60 or dialog.position.y < 150 or dialog.size.x > 360 or dialog.position.y + dialog.size.y > 530:
		failures.append("pause menu must be lower left: %s %s" % [dialog.position, dialog.size])
	var pause_rows := row_buttons(game)
	if pause_rows.size() != 5 or not captions(pause_rows[0]).has("게임 계속하기") or not captions(pause_rows[4]).has("메인 메뉴"):
		failures.append("pause rows: RESUME, CONTROLS, OPTIONS, RESTART, MAIN MENU")
	if not pause_rows[0].has_focus(): failures.append("resume starts focused")
	game.menu.show_settings()
	await process_frame
	await process_frame
	await shot("godot-settings.png")
	if not game.menu.title_image.visible or game.menu.backdrop.visible: failures.append("options show the undimmed title art")
	if dialog.position.x < 500 or dialog.size.x > 420: failures.append("options panel must be on the right")
	var main_rows := row_buttons(game)
	var labels: Array = main_rows.map(func(b: Button) -> String: return str(captions(b)[0]))
	if labels != ["Language", "Music", "Sound", "Boss BGM", "Display", "Mobile", "Controls", "Back"]:
		failures.append("options rows: %s" % [labels])
	if labels.has("Boss Challenge"): failures.append("Boss Challenge left the options")
	for b: Button in main_rows:
		if b.global_position.y + b.size.y > dialog.global_position.y + dialog.size.y - 10:
			failures.append("options rows fit inside the panel")
			break
	if not main_rows[0].has_focus(): failures.append("language starts focused")
	var music: HSlider = main_rows[1].get_meta("slider")
	var before := music.value
	main_rows[1].pressed.emit()
	if not is_equal_approx(game.preferences.music_volume, minf(before + 10, 100) / 100.0) and before + 10 <= 100:
		failures.append("music row steps the volume")
	main_rows[6].pressed.emit()
	await process_frame
	if game.menu.settings_page != "controls" or game.menu.key_settings == null: failures.append("controls page shows the key editor")
	await process_frame
	await shot("godot-controls.png")
	game.menu.back_from_settings()
	if game.menu.mode != "settings" or game.menu.settings_page != "main": failures.append("back returns to the main options page")
	game.menu.back_from_settings()
	if game.menu.mode != "pause": failures.append("options return to pause")
	DirAccess.remove_absolute(ProjectSettings.globalize_path(game.preferences.storage_path))
	for failure: String in failures: push_error(failure)
	print("menu design: ", failures.size(), " failures")
	quit(1 if failures.size() else 0)
