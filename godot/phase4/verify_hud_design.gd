extends SceneTree
## Player / boss HUD design (BmkHudDesign): the Barel HUD, the pause button, and the boss bar for the
## Stage 1 Gorath and a wave boss (Vargul). Captures go to artifacts/hud-implementation (needs a
## renderer: run without --headless).

var failures: Array[String] = []
var game: BmkMenuGame

func _initialize() -> void:
	call_deferred("run")

func check(ok: bool, label: String) -> void:
	if not ok: failures.append(label)

func shot(file: String) -> void:
	game.present()
	await process_frame
	await process_frame
	await RenderingServer.frame_post_draw
	var dir: String = ProjectSettings.globalize_path("res://../artifacts/hud-implementation")
	DirAccess.make_dir_recursive_absolute(dir)
	check(root.get_texture().get_image().save_png(dir + "/" + file) == OK, "capture " + file)

func run() -> void:
	game = load("res://phase4/game.tscn").instantiate() as BmkMenuGame
	root.add_child(game)
	game.capture_mode = true
	game.set_physics_process(false)
	game.save_store.checkpoint_path = "res://phase4/hud_test_checkpoint.json"
	game.save_store.records_path = "res://phase4/hud_test_records.json"
	game.preferences.storage_path = "res://phase4/hud_test_settings.json"
	game.preferences.touch = false
	game.save_store.write_json(game.save_store.records_path, {"bestScore": 0, "stages": []})
	game.start_new()
	var hud: BmkStageHud = game.hud as BmkStageHud
	var p: BmkActorState = game.session.player
	p.hp = 72
	p.sp = 100
	p.mg = 2
	p.score = 86600
	(game.session as BmkStageSimulation).sections.locked = true
	await shot("godot-hud.png")
	check(not hud.boss_bar_visible(), "no boss bar outside a boss fight")
	var pause_rect := Rect2(game.pause_button.position, game.pause_button.size)
	check(pause_rect.position.distance_to(BmkHudDesign.PAUSE.position * BmkHudDesign.K) < 1 and (game.pause_button.texture_normal as AtlasTexture).region == BmkHudDesign.PAUSE, "pause button uses the design's art and place")
	for i: int in range(5): game.save_store.record(i, 1000, "A", 100)
	# Stage 1: Gorath (stage actor).
	game.menu.challenge_stage = 0
	game.start_challenge()
	var s1: BmkStageSimulation = game.session as BmkStageSimulation
	for i: int in range(900):
		if s1.gorath.boss(s1) != null and s1.gorath.boss(s1).g2.card_t <= 0 and s1.mode == "play": break
		s1.step()
	var gorath: BmkStageActor = s1.gorath.boss(s1)
	check(gorath != null and hud.boss_bar_visible(), "Gorath shows the boss bar")
	if gorath != null: gorath.hp = gorath.max_hp * 0.9
	s1.player.skill_cd[s1.data.skills[1].id] = 2600
	await shot("godot-boss-gorath.png")
	check(not BmkHudDesign.face("gorath").is_empty(), "Gorath has a portrait")
	# Stage 4: Vargul (wave boss).
	game.menu.challenge_stage = 3
	game.start_challenge()
	var s4: BmkWaveSimulation = game.session as BmkWaveSimulation
	for i: int in range(3000):
		var boss := hud.wave_boss(s4)
		if s4.mode == "play" and boss != null and boss.st != "intro": break
		s4.step()
	check(hud.boss_bar_visible(), "Vargul shows the boss bar")
	var vargul := hud.wave_boss(s4)
	if vargul != null: vargul.hp = vargul.max_hp * 0.6
	await shot("godot-boss-vargul.png")
	for kind: String in ["boss2", "boss4", "boss5"]:
		check(not BmkHudDesign.face(kind).is_empty(), kind + " has a portrait")
	for path: String in [game.save_store.checkpoint_path, game.save_store.records_path, game.preferences.storage_path]:
		DirAccess.remove_absolute(ProjectSettings.globalize_path(path))
	for failure: String in failures: push_error(failure)
	print("HUD design: ", failures.size(), " failures")
	quit(1 if failures.size() else 0)
