extends SceneTree
var game: BmkMenuGame
var failures: Array[String] = []
var checks: int = 0

func _initialize() -> void:
	call_deferred("run")

func check(value: bool, label: String) -> void:
	checks += 1
	if not value: failures.append(label)

func click_button(label: String) -> void:
	for child: Node in game.menu.buttons.get_children():
		if child is Button and (child as Button).text == label:
			var button: Button = child as Button
			var point: Vector2 = button.get_global_rect().get_center()
			var press: InputEventMouseButton = InputEventMouseButton.new()
			press.button_index = MOUSE_BUTTON_LEFT
			press.position = point
			press.pressed = true
			root.push_input(press)
			var release: InputEventMouseButton = InputEventMouseButton.new()
			release.button_index = MOUSE_BUTTON_LEFT
			release.position = point
			release.pressed = false
			root.push_input(release)
			await process_frame
			return
	failures.append("Missing button: " + label)

func key(code: Key) -> void:
	var event: InputEventKey = InputEventKey.new()
	event.keycode = code
	event.physical_keycode = code
	event.pressed = true
	root.push_input(event)
	await process_frame

func run() -> void:
	game = load("res://phase4/game.tscn").instantiate() as BmkMenuGame
	root.add_child(game)
	game.capture_mode = true
	game.set_physics_process(false)
	game.save_store.checkpoint_path = "res://phase4/render_test_checkpoint.json"
	game.save_store.records_path = "res://phase4/render_test_records.json"
	game.preferences.storage_path = "res://phase4/render_test_settings.json"
	game.preferences.use_preset("arcade")
	game.apply_preferences()
	game.save_store.write_json(game.save_store.checkpoint_path,null)
	game.save_store.write_json(game.save_store.records_path,{"bestScore":0,"stages":[]})
	game.menu.show_title()
	await process_frame
	await RenderingServer.frame_post_draw
	check(root.get_texture().get_image().save_png("res://evidence/phase4_title.png") == OK,"Capture title")
	await click_button("새 게임")
	check(game.menu.mode == "characters","Mouse opens character selection")
	await click_button("바렐로 시작")
	# Phase 12: the character opens the tutorial; 게임 시작 plays the opening, skipped here.
	check(game.menu.mode == "tutorial" and game.demo.on,"The character opens the tutorial")
	game.menu.tutorial.start_button.pressed.emit()
	check(game.menu.mode == "opening","게임 시작 opens the opening")
	game.menu.opening.finish()
	await process_frame
	check(not game.menu.visible and not game.clock.paused,"Mouse starts game")
	game.present()
	await process_frame
	await RenderingServer.frame_post_draw
	check(root.get_texture().get_image().save_png("res://evidence/phase4_hud.png") == OK,"Capture HUD")
	await key(KEY_ESCAPE)
	check(game.menu.mode == "pause" and game.clock.paused,"Escape opens pause")
	await click_button("설정")
	check(game.menu.mode == "settings","Mouse opens settings")
	await click_button("키 직접 설정")
	check(game.menu.mode == "bindings","Mouse opens bindings")
	await click_button("왼쪽: Left")
	await key(KEY_F)
	check(game.preferences.preset == "custom" and game.preferences.bindings.get("KeyA") == KEY_F,"Keyboard binds selected action")
	game.save_store.record(0,100,"A",100)
	game.start_challenge()
	game.present()
	await process_frame
	await RenderingServer.frame_post_draw
	check(root.get_texture().get_image().save_png("res://evidence/phase4_boss_hud.png") == OK,"Capture boss HUD")
	game.start_practice()
	var s: BmkStageSimulation = game.session as BmkStageSimulation
	s.last_hit_id = s.enemies[0].id
	game.present()
	await process_frame
	await RenderingServer.frame_post_draw
	check(root.get_texture().get_image().save_png("res://evidence/phase4_enemy_hud.png") == OK,"Capture enemy HUD")
	for path: String in [game.save_store.checkpoint_path,game.save_store.records_path,game.preferences.storage_path]:
		DirAccess.remove_absolute(ProjectSettings.globalize_path(path))
	print("RENDERED MENU: %d checks; %d failures" % [checks,failures.size()])
	for failure: String in failures: push_error(failure)
	game.queue_free()
	await process_frame
	quit(0 if failures.is_empty() else 1)
