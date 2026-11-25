extends SceneTree

func _initialize() -> void:
	call_deferred("run")

func run() -> void:
	var failures: Array[String] = []
	for id: String in ["player_panel","portrait_frame","hp_fill","sp_track","sp_fill","scroll_icon_empty","skill_keycap","boss_bar_frame","boss_hp_fill","boss_phase_pip","pause_frame"]:
		if BmkHudDesign.compact_texture(id) == null: failures.append("missing " + id)
	for id: String in ["enemy_health_frame","enemy_health_fill","enemy_name_plate"]:
		if BmkHudDesign.compact_texture(id,true) == null: failures.append("missing " + id)
	for pair: Array in [["gorath","gorath2"],["boss2","boss2_p2"],["boss3","boss3_p2"],["boss4","boss4_p2"],["boss5","boss5_p2"]]:
		var a := BmkHudDesign.face(pair[0])
		var b := BmkHudDesign.face(pair[1])
		if a.is_empty() or b.is_empty() or a[0] == b[0]: failures.append("%s phase portraits" % pair[0])
	var game := load("res://phase4/game.tscn").instantiate() as BmkMenuGame
	root.add_child(game)
	game.capture_mode = true
	game.set_physics_process(false)
	game.save_store.checkpoint_path = "res://build/hud-v4-checkpoint.json"
	game.save_store.records_path = "res://build/hud-v4-records.json"
	game.preferences.storage_path = "res://build/hud-v4-settings.json"
	game.start_new()
	game.session.player.hp = 72
	game.session.player.sp = 0
	game.session.player.mg = 2
	game.session.player.skill_cd["slam"] = 2400
	game.present()
	await process_frame
	game.start_new("viesa")
	game.present()
	await process_frame
	if not game.session.player.is_viesa(): failures.append("Viesa start")
	var normal := game.pause_button.texture_normal as AtlasTexture
	var pressed := game.pause_button.texture_pressed as AtlasTexture
	if normal == null or pressed == null or normal.atlas != BmkHudDesign.compact_texture("pause_frame") or normal.region != Rect2(0,0,26,26) or pressed.region != Rect2(26,0,26,26):
		failures.append("pause sheet frames")
	if Rect2(game.pause_button.position,game.pause_button.size) != BmkHudDesign.PAUSE: failures.append("pause position")
	game.pause_button.pressed.emit()
	if not game.clock.paused: failures.append("pause action")
	for problem: String in failures: push_error(problem)
	print("Compact HUD verification: %d failures" % failures.size())
	game.queue_free()
	quit(1 if failures.size() else 0)
