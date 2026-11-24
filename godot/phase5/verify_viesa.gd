extends SceneTree
## Phase 5 rendered integration: real mouse/keyboard input through the F5 game with Viesa.
var game: BmkMenuGame
var failures: Array[String] = []
var checks: int = 0

func _initialize() -> void:
	call_deferred("run")

func check(value: bool, label: String) -> void:
	checks += 1
	if not value: failures.append(label)

func click_button(label: String) -> void:
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

func key(code: Key, pressed: bool) -> void:
	var event: InputEventKey = InputEventKey.new()
	event.keycode = code
	event.physical_keycode = code
	event.pressed = pressed
	root.push_input(event)
	await process_frame

func tap(code: Key) -> void:
	await key(code,true)
	await key(code,false)

func ticks(n: int) -> void:
	for i: int in range(n): game._physics_process(BmkSimulation.MS / 1000.0)
	game.present()
	await process_frame

## Hitstop pauses the simulation, so wait on state rather than a fixed tick count.
func until_free(limit: int) -> void:
	for i: int in range(limit):
		if session().player.st == "free" and session().player.z == 0.0: break
		game._physics_process(BmkSimulation.MS / 1000.0)
	game.present()
	await process_frame

func capture(name_: String) -> void:
	game.present()
	await process_frame
	await RenderingServer.frame_post_draw
	check(root.get_texture().get_image().save_png("res://evidence/%s.png" % name_) == OK,"Capture " + name_)

func session() -> BmkStageSimulation:
	return game.session as BmkStageSimulation

func passive_enemy(kind: String, dx: float, dy: float = 0.0) -> BmkActorState:
	var s: BmkStageSimulation = session()
	var e: BmkActorState = s.spawn(kind,s.player.x + dx,s.player.y + dy)
	e.wait = 100000
	e.attack_cd = 100000
	return e

## Same setup and inputs as tools/oracle/phase5_source_capture.cjs, for side-by-side review.
func compare_with_source() -> void:
	var scenes: Dictionary = {
		"shot":[["axe",350,430]],"snipe":[["axe",350,430]],"hover":[["axe",520,430]],"ultimate":[["axe",350,430],["club",380,460]]}
	for name_: String in scenes:
		game.start_new("viesa")
		var s: BmkStageSimulation = session()
		s.progression_enabled = false
		s.enemies.clear()
		s.barrels.clear()
		s.fixed_random = true
		s.player.x = 200
		s.player.y = 430
		s.player.inv = 0
		for spec: Array in scenes[name_]:
			var e: BmkActorState = s.spawn(str(spec[0]),float(spec[1]),float(spec[2]))
			e.wait = 100000
			e.attack_cd = 100000
		var steps: Array = []
		match name_:
			"shot": steps = [["tap","KeyJ"],["run",14]]
			"snipe": steps = [["down","KeyL"],["run",36]]
			"hover": steps = [["tap","Space"],["run",10],["tap","KeyP"],["run",54]]
			"ultimate":
				s.player.sp = 100
				steps = [["tap","KeyK"],["run",60]]
		for step: Array in steps:
			if step[0] == "run":
				for i: int in range(int(step[1])): s.step()
			else:
				s.input.press(str(step[1]),s.tick)
				if step[0] == "tap": s.input.release(str(step[1]))
		await capture("phase5_viesa_compare_" + name_)

func run() -> void:
	game = load("res://phase4/game.tscn").instantiate() as BmkMenuGame
	root.add_child(game)
	game.capture_mode = true
	game.set_physics_process(false)
	game.save_store.checkpoint_path = "res://phase5/viesa_test_checkpoint.json"
	game.save_store.records_path = "res://phase5/viesa_test_records.json"
	game.preferences.storage_path = "res://phase5/viesa_test_settings.json"
	game.preferences.use_preset("arcade")
	game.apply_preferences()
	game.save_store.write_json(game.save_store.checkpoint_path,null)
	game.save_store.write_json(game.save_store.records_path,{"bestScore":0,"stages":[]})
	check(game.audio.streams.has("viesaArrow") and game.audio.streams.has("viesaSnipe") and game.audio.streams.has("viesaUltimate"),"Viesa samples loaded")
	check(not game.audio.offsets.has("viesaArrow"),"Viesa samples start at 0 like playViesaSkill")
	game.menu.show_title()
	await process_frame
	await click_button(game.menu.title_image.caption("New Game"))
	check(game.menu.mode == "characters","Mouse opens character selection")
	await capture("phase5_select")
	await click_button("비에사로 시작")
	# Phase 12: the character opens the tutorial; 게임 시작 plays the opening, skipped here.
	check(game.menu.mode == "tutorial" and game.demo.on,"The character opens the tutorial")
	game.menu.tutorial.start_button.pressed.emit()
	check(game.menu.mode == "opening","게임 시작 opens the opening")
	game.menu.opening.finish()
	await process_frame
	var p: BmkActorState = session().player
	check(not game.menu.visible and not game.clock.paused,"Mouse starts Viesa")
	check(p.is_viesa() and session().player_controller is BmkViesaController,"Viesa controller active")
	check(p.hp == 80 and p.max_hp == 80 and is_equal_approx(p.hw,14.4) and is_equal_approx(p.w,23.4),"Viesa HP 80 and .9 body")
	var entry: BmkCheckpoint = game.save_store.checkpoint()
	check(entry != null and entry.character_id == "viesa" and entry.hp == 80,"Stage entry saves Viesa")
	await ticks(30)
	# Bow: Z (KeyJ) fires one arrow on frame 4.
	var target: BmkActorState = passive_enemy("axe",150)
	var hp: float = target.hp
	await tap(KEY_Z)
	await ticks(14)
	check(session().viesa.arrows.size() == 1,"Arrow fired by keyboard")
	await capture("phase5_viesa_shot")
	await ticks(30)
	check(target.hp < hp,"Arrow damages the enemy")
	# Snipe: hold E (KeyL); release fires the piercing arrow.
	await ticks(40)
	await key(KEY_E,true)
	await ticks(36)
	check(p.st == "skill" and p.viesa_action != null and p.viesa_action.phase == "snipe_draw","Held snipe draws")
	await capture("phase5_viesa_snipe")
	await key(KEY_E,false)
	await ticks(10)
	var sniped: bool = false
	for z: BmkViesaWorld.Arrow in session().viesa.arrows: sniped = sniped or z.snipe
	check(sniped,"Released snipe fires")
	await ticks(60)
	# Rapid fire: S (KeyU) six shots.
	await tap(KEY_S)
	await ticks(40)
	check(p.st == "skill" and p.viesa_action != null and p.viesa_action.id == "thrust","Rapid fire started")
	await ticks(80)
	check(p.skill_cd["thrust"] > 0,"Rapid fire cooldown")
	# Ground backflip: Q (KeyO).
	passive_enemy("blade",70)
	await tap(KEY_Q)
	await ticks(10)
	check(p.viesa_action != null and p.viesa_action.phase == "dash_slash","Ground backflip dash")
	await ticks(90)
	# Air backflip: X jump then W (KeyP), Z during the hover.
	await tap(KEY_X)
	await ticks(10)
	await tap(KEY_W)
	await ticks(54)
	check(p.viesa_action != null and p.viesa_action.phase == "hover","Air backflip hovers")
	await capture("phase5_viesa_hover")
	await tap(KEY_Z)
	await ticks(2)
	check(p.st == "atk" and p.viesa_clip == "jump_shot","Hover air shot")
	await ticks(120)
	# Ultimate: C (KeyK) at full SP.
	for e: BmkActorState in session().enemies: e.hp = maxf(e.hp,60)
	passive_enemy("club",180,30)
	p.sp = 100
	await ticks(2)
	await tap(KEY_C)
	await ticks(60)
	check(p.st == "special" and session().viesa.ult.size() > 0,"Ultimate barrage")
	await capture("phase5_viesa_ultimate")
	await ticks(100)
	check(p.st == "free" and p.z == 0.0,"Ultimate lands")
	session().last_hit_id = session().enemies[0].id if not session().enemies.is_empty() else 0
	await capture("phase5_viesa_hud")
	# Retry keeps the stage entry character.
	await tap(KEY_R)
	check(session().player.is_viesa() and session().player.hp == 80,"Retry restores Viesa entry")
	# Clear: next-stage checkpoint heals 40 up to Viesa's 80.
	session().player.hp = 50
	session().mode = "clear"
	game._physics_process(BmkSimulation.MS / 1000.0)
	entry = game.save_store.checkpoint()
	check(entry != null and entry.stage == 1 and entry.character_id == "viesa" and entry.hp == 80,"Clear checkpoint is Viesa capped at HP 80")
	# Continue: a Viesa stage-entry snapshot restores her.
	var saved: BmkCheckpoint = BmkCheckpoint.new()
	saved.character_id = "viesa"
	saved.hp = 55
	saved.sp = 30
	game.save_store.save_checkpoint(saved)
	game.menu.show_title()
	await process_frame
	await click_button(game.menu.title_image.caption("Continue"))
	check(session().player.is_viesa() and session().player.hp == 55 and session().player.sp == 30,"Continue restores Viesa")
	var bad: BmkCheckpoint = BmkCheckpoint.decode({"version":1,"characterId":"viesa","stage":0,"score":0,"hp":100,"lives":3,"sp":0,"mg":0,"buff":0})
	check(bad == null,"Viesa save above HP 80 is rejected")
	# Practice keeps the selected character and completes with her skills.
	game.start_practice()
	p = session().player
	check(p.is_viesa(),"Practice uses Viesa")
	await key(KEY_RIGHT,true)
	await ticks(60)
	await key(KEY_RIGHT,false)
	await tap(KEY_Z)
	await ticks(40)
	await tap(KEY_S)
	await ticks(120)
	await until_free(400)
	await tap(KEY_X)
	await ticks(50)
	await until_free(200)
	await tap(KEY_SHIFT)
	await ticks(30)
	check(game.practice_done.size() == 5,"Practice tasks with Viesa: %s" % str(game.practice_done.keys()))
	session().last_hit_id = session().enemies[0].id if not session().enemies.is_empty() else 0
	await capture("phase5_viesa_enemy_hud")
	# Boss challenge chooses its character first.
	game.save_store.record(0,100,"A",100)
	game.pause_game(true)
	game.menu.show_title()
	await process_frame
	await click_button(game.menu.title_image.caption("MENU_CHALLENGE"))
	await click_button("스테이지 1 / 도살자 고라스")
	check(game.menu.mode == "characters" and game.menu.character_challenge,"Challenge opens character selection")
	await click_button("비에사로 시작")
	check(game.game_mode == "challenge" and session().player.is_viesa() and session().player.sp == 100,"Viesa boss challenge")
	await ticks(120)
	await capture("phase5_viesa_boss")
	await compare_with_source()
	for path: String in [game.save_store.checkpoint_path,game.save_store.records_path,game.preferences.storage_path]:
		DirAccess.remove_absolute(ProjectSettings.globalize_path(path))
	print("VIESA RENDERED: %d checks; %d failures" % [checks,failures.size()])
	for failure: String in failures: push_error(failure)
	game.queue_free()
	await process_frame
	quit(0 if failures.is_empty() else 1)
