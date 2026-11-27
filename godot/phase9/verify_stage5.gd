extends SceneTree
## Phase 9 rendered integration: Stage 5 and the ending through the F5 game with real menu input.
var game: BmkMenuGame
var failures: Array[String] = []
var checks: int = 0

func _initialize() -> void:
	call_deferred("run")

func check(value: bool, label: String) -> void:
	checks += 1
	if not value: failures.append(label)

## Card selector (phase4/character_select): focus the hero's card, then press its start button.
func pick_hero(id: String) -> void:
	var selector: BmkCharacterSelect = game.menu.character_selector
	if selector == null or not selector.is_visible_in_tree():
		failures.append("Character selector not open for " + id)
		return
	for card: BmkSelectCard in selector.cards:
		if card.data["id"] == id: selector.select(card.index)
	await process_frame
	await click_button(BmkCopy.text("SELECT_START") % BmkCopy.text("HERO_" + id))

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
	game.save_store.checkpoint_path = "res://phase9/stage5_test_checkpoint.json"
	game.save_store.records_path = "res://phase9/stage5_test_records.json"
	game.preferences.storage_path = "res://phase9/stage5_test_settings.json"
	game.preferences.use_preset("arcade")
	game.preferences.menu_language = "ko"   # English is the default; these checks read the Korean copy
	game.apply_preferences()
	game.save_store.write_json(game.save_store.checkpoint_path,null)
	game.save_store.write_json(game.save_store.records_path,{"bestScore":0,"stages":[]})
	# Stage 4 clear offers Stage 5; its entry carries the +40 healing.
	var seed: BmkCheckpoint = BmkCheckpoint.new()
	seed.stage = 3
	game.save_store.save_checkpoint(seed)
	game.restore_checkpoint()
	game.session.player.hp = 30
	(game.session as BmkStageSimulation).mode = "clear"
	game._physics_process(BmkSimulation.MS / 1000.0)
	check(game.menu.mode == "result","Stage 4 result shown")
	var entry: BmkCheckpoint = game.save_store.checkpoint()
	check(entry != null and entry.stage == 4 and entry.hp == 70,"Stage 4 clear saves the Stage 5 entry")
	await click_button("다음 스테이지")
	check(wave() != null and game.stage_index == 4 and wave().stage_index == 4 and wave().player.hp == 70,"Next stage starts Stage 5 with the entry")
	check(wave().mode == "intro" and str(wave().stage["name"]) == "STAGE 5","Stage 5 banner")
	check(game.audio.track_id == "stage" and game.audio.stage_number == 5,"Stage 5 music")
	tick(40)
	await capture("phase9_banner")
	var saved: BmkCheckpoint = BmkCheckpoint.new()
	saved.character_id = "viesa"
	saved.stage = 4
	saved.hp = 61
	game.save_store.save_checkpoint(saved)
	game.pause_game(true)
	game.menu.show_title()
	await process_frame
	await click_button(game.menu.title_image.caption("Continue"))
	check(wave() != null and wave().stage_index == 4 and wave().player.is_viesa() and wave().player.hp == 61,"Continue restores a Stage 5 Viesa entry")
	var s: BmkWaveSimulation = wave()
	var guard: int = 0
	var saw_arena: bool = false
	var saw_rift: bool = false
	while s.mode != "bossintro" and guard < 6000:
		s.player.inv = 10000
		# Abyss waves: hold the lock long enough for the first rifts to cross the screen.
		var hold: int = 260 if not s.arena.is_empty() else 90
		if not s.arena.is_empty(): saw_arena = true
		for z: BmkLegacyHazard in s.legacy_hazards:
			if z.type == "rift" and z.kind == "abyss": saw_rift = true
		if s.cam_lock and guard % hold == 0 and guard > 0:
			for e: BmkActorState in s.enemies:
				if not e.boss:
					e.st = "dead"
					e.t = 0
					e.hp = 0
		if not s.cam_lock and s.mode == "play": s.player.x = minf(s.player.x + 6,s.stage_length - 50)
		tick(1)
		guard += 1
		if saw_rift and not has_meta("field_captured"):
			for z: BmkLegacyHazard in s.legacy_hazards:
				if z.type == "rift" and z.age >= z.delay + 60:
					set_meta("field_captured",true)
					await capture("phase9_field")
					break
	check(saw_arena and saw_rift,"Abyss waves send rifts across two lanes")
	check(s.mode == "bossintro" and boss() != null and boss().type == "boss5","Waves reach the Sovereign's intro")
	tick(160)
	await capture("phase9_intro")
	tick(60)
	check(s.mode == "play" and boss().st == "chase","Intro hands over to play")
	var sd: BmkSovereignState = boss().sovereign
	check(sd != null and sd.fists[0].st == "home" and sd.fists[1].st == "home","Both fists land home after the intro")
	# Phase one -> kneel and awaken (250 ticks) -> phase two at HP 3000 with 180 HP fists.
	s.combat.damage_enemy(s,boss(),5000,false,0,false,"c1")
	check(boss().phase_t == 250,"Phase one defeat starts the transition")
	tick(150)
	await capture("phase9_transition")
	tick(110)
	check(boss().p2shown and boss().hp == 3000 and boss().phase_t == 0,"Phase two at HP 3000")
	tick(40)
	check(sd.fists[0].max_hp == 180 and sd.fists[0].st == "home","Phase-two fists reform with 180 HP")
	await capture("phase9_phase2")
	# A broken fist falls and drops nothing in the fixed test; both broken -> groggy.
	s.player.inv = 10000
	s.sovereign.damage_fist(s,boss(),sd.fists[0],500,false)
	check(sd.fists[0].st == "fallen" and sd.fists[0].broken,"A fist breaks and falls")
	s.sovereign.damage_fist(s,boss(),sd.fists[1],500,false)
	check(boss().st == "stun","Both fists broken: groggy")
	tick(320)
	boss().attack_cd = 0
	tick(5)
	# Ultimate due at 35% HP.
	boss().hp = boss().max_hp * 0.35
	boss().attack_cd = 0
	sd.cooldowns.clear()
	var waited: int = 0
	while not sd.jobs.any(func(j: BmkSovereignState.Job) -> bool: return j.id == "ultimate") and waited < 600:
		tick(1)
		waited += 1
	check(sd.ultimate_used,"Ultimate starts at 35% HP")
	tick(95)
	await capture("phase9_ultimate")
	s.player.inv = 0
	s.combat.damage_enemy(s,boss(),9000,false,0,false,"c1")
	check(boss() != null and boss().st == "dead","Phase two death")
	for e: BmkActorState in s.enemies:
		if not e.boss: s.combat.damage_enemy(s,e,5000,false,0,false,"c1")
	waited = 0
	while s.mode != "clear" and waited < 800:
		tick(1)
		waited += 1
		if waited == 120: await capture("phase9_death")
	check(s.sovereign_remains.size() == 1,"The Sovereign's remains stay on the floor")
	check(game.audio.track_id == "ending","Final clear plays the ending score")
	check(game.menu.mode == "ending" and game.menu.title.text == BmkCopy.text("ALL_CLEAR"),"Final clear shows the ending")
	await capture("phase9_ending")
	check(game.save_store.checkpoint() == null,"Final clear clears the checkpoint")
	var records: Array = game.save_store.records()["stages"]
	check(records.size() > 4 and records[4] != null,"Stage 5 record unlocks its challenge")
	await click_button("타이틀로")
	check(game.menu.mode == "title","Ending returns to the title")
	await click_button(game.menu.title_image.caption("MENU_CHALLENGE"))
	await click_button("스테이지 5 / 흑월의 군주, 소버린")
	check(game.menu.mode == "characters" and game.menu.challenge_stage == 4,"Sovereign challenge opens character selection")
	await pick_hero("barel")
	check(game.game_mode == "challenge" and wave() != null and wave().stage_index == 4 and wave().mode == "bossintro" and wave().player.sp == 100 and wave().cam_x == 3640,"Sovereign challenge starts in his arena")
	await compare_with_source()
	for path: String in [game.save_store.checkpoint_path,game.save_store.records_path,game.preferences.storage_path]:
		DirAccess.remove_absolute(ProjectSettings.globalize_path(path))
	print("STAGE 5 RENDERED: %d checks; %d failures" % [checks,failures.size()])
	for failure: String in failures: push_error(failure)
	game.queue_free()
	await process_frame
	quit(0 if failures.is_empty() else 1)

## Same setup and steps as tools/oracle/phase9_source_capture.cjs (phase9/fixtures/capture_scenes.json).
func compare_with_source() -> void:
	var scenes: Array = JSON.parse_string(FileAccess.get_file_as_string("res://phase9/fixtures/capture_scenes.json"))
	for spec: Dictionary in scenes:
		game.game_mode = "story"
		game.character_id = str(spec["character"])
		game.stage_index = 4
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
		s.player.y = float(spec.get("py",430))
		s.player.inv = 0
		s.wave_idx = (s.stage["waves"] as Array).size()
		s.cam_lock = true
		s.lock_at = 0
		if bool(spec.get("intro",false)):
			s.cam_lock = false
			s.spawn_wave((s.stage["waves"] as Array)[-1])
		if bool(spec.get("arena",false)):
			for w: Dictionary in s.stage["waves"]:
				if w.has("arena"):
					s.spawn_wave(w)
					break
			for e: BmkActorState in s.enemies:
				e.wait = 100000
				e.attack_cd = 100000
		for o: Dictionary in spec["enemies"]:
			var e: BmkLegacyActor = s.spawn(str(o["kind"]),float(o["x"]),float(o["y"])) as BmkLegacyActor
			if bool(o.get("passive",false)):
				e.wait = 100000
				e.attack_cd = 100000
			var rules: Dictionary = s.wave_data.source["SOVEREIGN"]["RULES"]
			if int(o.get("phase",1)) == 2:
				e.p2shown = true
				e.hp = float(rules["hp"][1])
				e.max_hp = e.hp
				e.next_kd = e.max_hp * 0.75
			if bool(o.get("ready",false)):
				var sd: BmkSovereignState = s.sovereign.state(e)
				for f: BmkSovereignState.Fist in sd.fists:
					var home: Array[float] = s.sovereign.home(e,f,sd)
					f.x = home[0]
					f.y = home[1]
					f.h = home[2]
					f.st = "home"
					if int(o.get("phase",1)) == 2:
						f.hp = float(rules["fistHp"][1])
						f.max_hp = f.hp
		if spec.has("job"):
			var e: BmkLegacyActor = s.enemies[-1] as BmkLegacyActor
			s.sovereign.start_job(s,e,s.sovereign.state(e),str(spec["job"]))
		for i: int in range(int(spec["steps"])):
			s.player.inv = maxi(s.player.inv,100 if bool(spec.get("safe",false)) else 0)
			s.step()
		game.wave_backdrop.blend = 1.0
		await capture("phase9_compare_" + str(spec["id"]))
