extends SceneTree
## Phase 7 rendered integration: Stage 3 through the F5 game with real menu input.
var game: BmkMenuGame
var failures: Array[String] = []
var checks: int = 0

func _initialize() -> void:
	call_deferred("run")

func check(value: bool, label: String) -> void:
	checks += 1
	if not value: failures.append(label)

func click_button(label: String) -> void:
	await process_frame
	for child: Node in game.menu.find_children("*","Button",true,false):
		if (child as Button).is_visible_in_tree() and ((child as Button).text == label or (child as Button).get_meta("captions", []).has(label)):
			var point: Vector2 = (child as Button).get_global_rect().get_center()
			for pressed: bool in [true,false]:
				var event: InputEventMouseButton = InputEventMouseButton.new()
				event.button_index = MOUSE_BUTTON_LEFT
				event.position = point
				event.pressed = pressed
				root.push_input(event)
			await process_frame
			return
	failures.append("Missing button: " + label)

func capture(name_: String) -> void:
	game.present()
	await process_frame
	await RenderingServer.frame_post_draw
	check(root.get_texture().get_image().save_png("res://evidence/%s.png" % name_) == OK,"Capture " + name_)

func wave() -> BmkWaveSimulation:
	return game.session as BmkWaveSimulation

func tick(n: int) -> void:
	for i: int in range(n): game._physics_process(BmkSimulation.MS / 1000.0)

func boss() -> BmkLegacyActor:
	for e: BmkActorState in wave().enemies:
		if e.boss: return e as BmkLegacyActor
	return null

func run() -> void:
	game = load("res://phase4/game.tscn").instantiate() as BmkMenuGame
	root.add_child(game)
	game.capture_mode = true
	game.set_physics_process(false)
	game.save_store.checkpoint_path = "res://phase7/stage3_test_checkpoint.json"
	game.save_store.records_path = "res://phase7/stage3_test_records.json"
	game.preferences.storage_path = "res://phase7/stage3_test_settings.json"
	game.preferences.use_preset("arcade")
	game.preferences.menu_language = "ko"   # English is the default; these checks read the Korean copy
	game.apply_preferences()
	game.save_store.write_json(game.save_store.checkpoint_path,null)
	game.save_store.write_json(game.save_store.records_path,{"bestScore":0,"stages":[]})
	# Stage 2 clear offers Stage 3; its entry carries the +40 healing.
	var seed: BmkCheckpoint = BmkCheckpoint.new()
	seed.stage = 1
	game.save_store.save_checkpoint(seed)
	game.restore_checkpoint()
	game.session.player.hp = 30
	(game.session as BmkStageSimulation).mode = "clear"
	game._physics_process(BmkSimulation.MS / 1000.0)
	check(game.menu.mode == "result","Stage 2 result shown")
	var entry: BmkCheckpoint = game.save_store.checkpoint()
	check(entry != null and entry.stage == 2 and entry.hp == 70,"Stage 2 clear saves the Stage 3 entry")
	await click_button("다음 스테이지")
	check(wave() != null and game.stage_index == 2 and wave().stage_index == 2 and wave().player.hp == 70,"Next stage starts Stage 3 with the entry")
	check(wave().mode == "intro" and str(wave().stage["name"]) == "STAGE 3","Stage 3 banner")
	check(game.audio.track_id == "stage" and game.audio.stage_number == 3,"Stage 3 music")
	tick(40)
	await capture("phase7_banner")
	# Continue from a saved Stage 3 entry (Viesa).
	var saved: BmkCheckpoint = BmkCheckpoint.new()
	saved.character_id = "viesa"
	saved.stage = 2
	saved.hp = 61
	game.save_store.save_checkpoint(saved)
	game.pause_game(true)
	game.menu.show_title()
	await process_frame
	await click_button(game.menu.title_image.caption("Continue"))
	check(wave() != null and wave().stage_index == 2 and wave().player.is_viesa() and wave().player.hp == 61,"Continue restores a Stage 3 Viesa entry")
	var s: BmkWaveSimulation = wave()
	var guard: int = 0
	while s.mode != "bossintro" and guard < 5000:
		s.player.inv = 10000
		if s.cam_lock and guard % 90 == 0:
			for e: BmkActorState in s.enemies:
				if not e.boss:
					e.st = "dead"
					e.t = 0
					e.hp = 0
		if not s.cam_lock and s.mode == "play": s.player.x = minf(s.player.x + 6,s.stage_length - 50)
		tick(1)
		guard += 1
		if guard == 600: await capture("phase7_field")
	check(s.mode == "bossintro" and boss() != null and boss().type == "boss3","Waves reach Aurelion's intro")
	tick(80)
	await capture("phase7_intro")
	tick(80)
	check(s.mode == "play" and boss().st == "chase","Intro hands over to play")
	# Phase one -> transformation -> phase two.
	s.combat.damage_enemy(s,boss(),5000,false,0,false,"c1")
	check(boss().p2shown and boss().hp == 2200 and boss().phase_t == 242,"Phase one defeat refills HP 2200 and transforms")
	tick(250)
	check(boss().phase_t == 0 and boss().aurelion.halo,"Transformation ends with the royal halo")
	await capture("phase7_phase2")
	# Quarter-HP knockdown summons two spearmen.
	boss().gr = -10000
	s.combat.damage_enemy(s,boss(),600,false,0,false,"c1")
	var adds: int = 0
	for e: BmkActorState in s.enemies: if (e as BmkLegacyActor).type == "rogue": adds += 1
	check(boss().st == "down" and adds == 2,"Knockdown summons two spearmen")
	tick(80)
	s.player.inv = 0
	s.combat.damage_enemy(s,boss(),9000,false,0,false,"c1")
	check(boss() != null and boss().st == "dead" and s.slow_request >= 1100,"Phase two death")
	for e: BmkActorState in s.enemies:
		if not e.boss: s.combat.damage_enemy(s,e,5000,false,0,false,"c1")
	var waited: int = 0
	while s.mode != "clear" and waited < 700:
		tick(1)
		waited += 1
	check(game.menu.mode == "result","Stage 3 result shown")
	entry = game.save_store.checkpoint()
	check(entry != null and entry.stage == 3 and entry.character_id == "viesa","Stage 3 clear saves the Stage 4 entry")
	var records: Array = game.save_store.records()["stages"]
	check(records.size() > 2 and records[2] != null,"Stage 3 record unlocks its challenge")
	game.menu.show_title()
	await process_frame
	await click_button(game.menu.title_image.caption("MENU_CHALLENGE"))
	await click_button("스테이지 3 / 황금왕 아우렐리온")
	check(game.menu.mode == "characters" and game.menu.challenge_stage == 2,"Aurelion challenge opens character selection")
	await click_button("바렐로 시작")
	check(game.game_mode == "challenge" and wave() != null and wave().stage_index == 2 and wave().mode == "bossintro" and wave().player.sp == 100 and wave().cam_x == 3040,"Aurelion challenge starts in his arena")
	await compare_with_source()
	for path: String in [game.save_store.checkpoint_path,game.save_store.records_path,game.preferences.storage_path]:
		DirAccess.remove_absolute(ProjectSettings.globalize_path(path))
	print("STAGE 3 RENDERED: %d checks; %d failures" % [checks,failures.size()])
	for failure: String in failures: push_error(failure)
	game.queue_free()
	await process_frame
	quit(0 if failures.is_empty() else 1)

## Same setup and steps as tools/oracle/phase7_source_capture.cjs (phase7/fixtures/capture_scenes.json).
func compare_with_source() -> void:
	var scenes: Array = JSON.parse_string(FileAccess.get_file_as_string("res://phase7/fixtures/capture_scenes.json"))
	for spec: Dictionary in scenes:
		game.game_mode = "story"
		game.character_id = str(spec["character"])
		game.stage_index = 2
		game.stage_restored = false
		game.boss_challenge = false
		game.restart()
		game.pause_game(false)
		game.menu.visible = false
		var s: BmkWaveSimulation = wave()
		s.fixed_random = true
		s.mode = "play"
		s.tick = 0
		s.next_id = 1
		s.barrels.clear()
		s.player.x = float(spec["px"])
		s.player.y = 430
		s.player.inv = 0
		s.wave_idx = (s.stage["waves"] as Array).size()
		s.cam_lock = true
		s.lock_at = 0
		if bool(spec.get("intro",false)):
			s.cam_lock = false
			s.spawn_wave((s.stage["waves"] as Array)[-1])
		for o: Dictionary in spec["enemies"]:
			var e: BmkLegacyActor = s.spawn(str(o["kind"]),float(o["x"]),float(o["y"])) as BmkLegacyActor
			if bool(o.get("passive",false)):
				e.wait = 100000
				e.attack_cd = 100000
			if int(o.get("phase",1)) == 2:
				e.p2shown = true
				e.hp = float(s.wave_data.source["AURELION_P2_HP"])
				e.max_hp = e.hp
				e.next_kd = e.max_hp * 0.75
				s.aurelion.state(e).halo = true
		if spec.has("pat"): s.enemy_controller.start_pat(s,s.enemies[0],str(spec["pat"]))
		for i: int in range(int(spec["steps"])):
			s.player.inv = maxi(s.player.inv,100 if bool(spec.get("safe",false)) else 0)
			s.step()
		game.wave_backdrop.blend = 1.0
		await capture("phase7_compare_" + str(spec["id"]))
