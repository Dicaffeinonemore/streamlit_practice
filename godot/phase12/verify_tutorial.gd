extends SceneTree
## Phase 12 rendered integration: the tutorial demonstration and the opening through the F5 game,
## driven by real mouse and keyboard events.
var game: BmkMenuGame
var failures: Array[String] = []
var checks: int = 0
const SETTINGS: String = "res://phase12/tutorial_test_settings.json"
const CHECKPOINT: String = "res://phase12/tutorial_test_checkpoint.json"
const RECORDS: String = "res://phase12/tutorial_test_records.json"

func _initialize() -> void:
	call_deferred("run")

func check(value: bool, label: String) -> void:
	checks += 1
	if not value:
		failures.append(label)
		print("FAIL: " + label)

func click_at(point: Vector2) -> void:
	for pressed: bool in [true,false]:
		var event: InputEventMouseButton = InputEventMouseButton.new()
		event.button_index = MOUSE_BUTTON_LEFT
		event.position = point
		event.global_position = point
		event.pressed = pressed
		root.push_input(event)
	await process_frame

func click_button(label: String, container: Node = null) -> void:
	await process_frame
	for child: Node in (container if container != null else game.menu).find_children("*","Button",true,false):
		var b: Button = child as Button
		if (b.text == label or b.get_meta("captions", []).has(label)) and b.is_visible_in_tree():
			if container == null and game.menu.scroll.is_ancestor_of(b):
				game.menu.scroll.ensure_control_visible(b)
				await process_frame
				await process_frame
			await click_at(b.get_global_rect().get_center())
			return
	failures.append("Missing button: " + label)
	print("FAIL: Missing button: " + label)

func key(code: Key, physical: Key = KEY_NONE) -> void:
	for pressed: bool in [true,false]:
		var event: InputEventKey = InputEventKey.new()
		event.keycode = code
		event.physical_keycode = physical if physical != KEY_NONE else code
		event.pressed = pressed
		root.push_input(event)
	await process_frame

func key_event(physical: Key, pressed: bool) -> void:
	var event: InputEventKey = InputEventKey.new()
	event.keycode = physical
	event.physical_keycode = physical
	event.pressed = pressed
	root.push_input(event)
	await process_frame

func tick(n: int) -> void:
	for i: int in range(n): game._physics_process(BmkSimulation.MS / 1000.0)

func capture(name_: String) -> void:
	await process_frame
	await process_frame
	await RenderingServer.frame_post_draw
	check(root.get_texture().get_image().save_png("res://evidence/%s.png" % name_) == OK,"Capture " + name_)

func files() -> String:
	return FileAccess.get_file_as_string(CHECKPOINT) + "|" + FileAccess.get_file_as_string(RECORDS)

## Everything a demo could leak into: the run itself, its statistics, input and camera.
func live_state(s: BmkStageSimulation) -> String:
	var p: BmkActorState = s.player
	var enemies: Array = []
	for e: BmkActorState in s.enemies: enemies.append([e.id,e.species,e.x,e.y,e.z,e.hp,e.st,e.t])
	var held: Array = s.input.held.keys()
	held.sort()
	return JSON.stringify([s.tick,s.mode,s.cam_x,p.character_id,p.x,p.y,p.z,p.hp,p.sp,p.mg,p.score,p.lives,p.st,p.t,p.skill_cd,s.stat_ticks,s.stat_damage,s.stat_kills,s.stat_deaths,s.chain_n,s.chain_t,s.chain_max,enemies,s.items.size(),s.barrels.size(),s.hazards.size(),held,s.hit_stop])

func run() -> void:
	game = load("res://phase4/game.tscn").instantiate() as BmkMenuGame
	root.add_child(game)
	game.capture_mode = true
	game.set_physics_process(false)
	game.save_store.checkpoint_path = CHECKPOINT
	game.save_store.records_path = RECORDS
	game.preferences.storage_path = SETTINGS
	game.preferences.use_preset("arcade")
	game.preferences.touch = false
	game.preferences.menu_language = "ko"   # English is the default; these checks read the Korean copy
	game.apply_preferences()
	game.menu.show_title()
	game.save_store.write_json(CHECKPOINT,null)
	game.save_store.write_json(RECORDS,{"bestScore":1234,"stages":[{"rank":"A","seconds":200}]})
	await process_frame
	var t: BmkTutorialScreen = game.menu.tutorial
	var startup: BmkSimulation = game.session

	# ---- Title -> character select -> tutorial (characterSelect origin)
	await click_button(game.menu.title_image.caption("New Game"))
	await click_button("바렐로 시작")
	await process_frame
	check(game.menu.mode == "tutorial" and t.visible,"Picking a character opens the tutorial")
	check(game.demo.on and game.demo.character == "barel","The Barel demonstration runs")
	check(game.session == game.demo.session and game.session != startup,"Views show the demo session")
	check(game.world.get_parent() == game.demo_port and game.hud.get_parent().get_parent() == game.demo_port,"World and HUD render into the demo view")
	check(game.demo.session.stage1_view and game.demo.session.sections.idx == 0 and game.demo.session.cam_x == 0,"Launch: Stage 1 street, first section, camera 0")
	check(t.back_button.visible and t.back_button.text == "캐릭터 선택" and t.practice_button.visible and t.start_button.visible,"Character-select actions")
	check(t.preset_label.text == "1 · 오락실 아케이드","Preset name in the heading")
	check(t.caption_step.text == "1 / 12" and t.caption_title.text == "이동","Caption for step 1")
	check(t.chips.get_child_count() == 12,"Twelve step chips")
	check(t.keyboard.label() == "키보드 배치: ↑ ▲이동, ← ◀이동, ↓ ▼이동, → ▶이동","Keyboard focus shows the arcade movement keys")
	check(not game.audio.paused,"Character select leaves the sound running")
	var demo_dummy: BmkActorState = game.demo.session.enemies[0]
	check(demo_dummy.training and demo_dummy.hp == 99999 and (demo_dummy as BmkLegacyActor).type == "grunt","Training dummy")
	tick(4)
	check(game.demo.lit.has("KeyD"),"The script holds right")
	var lit_cap: bool = false
	for child: Node in t.caption_keys.get_children():
		if child is BmkTutorialScreen.Cap and (child as BmkTutorialScreen.Cap).action == "KeyD": lit_cap = (child as BmkTutorialScreen.Cap).on
	check(lit_cap,"The held key's cap lights")
	check(t.keyboard.pressed.has("KeyD"),"The keyboard picture shows the held key")
	check(game.demo.session.player.x > game.demo.session.view_width * 0.22,"The demo character walks")
	await capture("phase12_tutorial_barel_move")
	tick(200)
	check(game.demo.index == 1 and t.caption_title.text == "점프","The demo advances to the jump step")
	# Prev / pause / next / chip
	await click_button("다음 ▶",t)
	check(game.demo.index == 2 and t.caption_title.text == "공격 3연타","Next")
	await click_button("◀ 이전",t)
	check(game.demo.index == 1,"Previous")
	await click_button("❚❚ 멈춤",t)
	check(game.demo.paused and t.play_button.text == "▶ 재생","Pause button")
	var frozen: int = game.demo.session.tick
	tick(30)
	check(game.demo.session.tick == frozen,"A paused demo is frozen")
	var chip: Control = t.chips.get_child(9) as Control
	t.scroll.ensure_control_visible(chip)
	await process_frame
	await process_frame
	await click_at(chip.get_global_rect().get_center())
	check(game.demo.index == 9 and not game.demo.paused and t.play_button.text == "❚❚ 멈춤","A chip chooses the step and resumes")
	tick(40)
	await capture("phase12_tutorial_barel_wave")
	# The player's own keys only light the caps (scene 'tutorial' ignores game input).
	var demo_held: Dictionary = game.demo.session.input.held.duplicate()
	await key_event(KEY_Z,true)
	check(t.user_lit.has("KeyJ"),"Pressing the attack key lights its caps")
	check(game.demo.session.input.held == demo_held,"Player keys do not reach the demo")
	await key_event(KEY_Z,false)
	check(not t.user_lit.has("KeyJ"),"Releasing it clears the light")
	# Focus loss does not open the pause menu over the tutorial.
	game._notification(NOTIFICATION_APPLICATION_FOCUS_OUT)
	check(game.menu.mode == "tutorial","Focus loss keeps the tutorial")
	# Esc -> character select; the launch session is back.
	await key(KEY_ESCAPE)
	check(game.menu.mode == "characters" and not game.demo.on,"Esc returns to character select")
	check(game.session == startup and game.world.get_parent() == game and game.hud.get_parent().get_parent() == game,"The previous session and views are restored")
	check(game.demo_port.render_target_update_mode == SubViewport.UPDATE_DISABLED,"The demo view stops rendering")

	# ---- Viesa tutorial -> 직접 연습
	await click_button("비에사로 시작")
	check(game.demo.on and game.demo.character == "viesa" and t.chips.get_child_count() == 12,"The Viesa demonstration runs")
	check((t.chips.get_child(2) as BmkTutorialScreen.Chip).title.text == "화살","Viesa's step list")
	game.demo.choose(2)
	await process_frame
	check(t.keyboard.label() == "키보드 배치: Z 화살","Viesa's short action names")
	await click_button("직접 연습",t)
	check(game.game_mode == "practice" and game.session.player.character_id == "viesa" and not game.demo.on,"Practice from the tutorial uses the chosen character")
	check(not game.menu.visible and game.world.get_parent() == game,"Practice is shown in the main view")
	# #practiceGuide: 조작 안내 opens the tutorial over a paused practice; 실전 시작 plays the opening.
	tick(2)
	game.present()
	check(game.practice_buttons.visible,"Practice shows 실전 시작 / 조작 안내")
	var practice_session: BmkSimulation = game.session
	await click_button("조작 안내",game.practice_buttons)
	check(game.menu.mode == "tutorial" and game.menu.tutorial.origin == "pause" and game.demo.character == "viesa" and (game.demo_saved["clock"] as BmkSimulationClock).paused,"btnPracticeHelp: pause, then the tutorial")
	await click_button("돌아가기",t)
	check(game.menu.mode == "pause" and game.session == practice_session,"Back to the paused practice")
	await click_button("계속하기")
	game.present()
	await click_button("실전 시작",game.practice_buttons)
	check(game.menu.mode == "opening" and game.menu.opening.running,"btnPracticeGo plays the opening")
	game.menu.opening.finish()
	await process_frame
	game.present()
	check(game.game_mode == "story" and game.session.player.character_id == "viesa" and not game.practice_buttons.visible,"The story starts with the practised character")

	# ---- Story: tutorial -> 게임 시작 (Enter) -> opening -> stage 1
	game.pause_game(true)
	game.menu.show_title()
	await click_button(game.menu.title_image.caption("New Game"))
	await click_button("비에사로 시작")
	var before_files: String = files()
	tick(120)
	# Arrow keys (arcade movement) light caps but do not move focus off 게임 시작.
	await key(KEY_DOWN)
	await key(KEY_LEFT)
	check(t.start_button.has_focus(),"Arrow keys keep the focus on 게임 시작")
	await key(KEY_ENTER)
	check(game.menu.mode == "opening" and game.menu.opening.running and not game.demo.on,"Enter opens the opening")
	check(files() == before_files,"The demonstration writes no checkpoint or record")
	check(game.audio.track_id == "stop","The opening silences the music (AUDIO.silence())")
	for i: int in range(270): game.menu.opening.advance()
	check(game.menu.opening.panel() == 1,"Opening panel 2 at 4.5 s")
	await capture("phase12_opening_2")
	await key(KEY_SPACE)
	check(game.game_mode == "story" and not game.menu.visible and game.session.player.character_id == "viesa","Skipping the opening starts the story with Viesa")
	check(game.save_store.checkpoint() != null and game.save_store.checkpoint().character_id == "viesa","The story start writes its own entry checkpoint")

	# ---- Opening runs out by itself after 18 s
	game.pause_game(true)
	game.menu.show_title()
	await click_button(game.menu.title_image.caption("New Game"))
	await click_button("바렐로 시작")
	await click_button("게임 시작",t)
	check(game.menu.mode == "opening","게임 시작 opens the opening")
	# Step the opening by hand only (its own _physics_process would add real-time ticks), from 0.
	# openingTime += MS reaches 17999.99999999988 after 1080 ticks in both JavaScript and GDScript,
	# so the source and the port finish on tick 1081.
	game.menu.opening.set_physics_process(false)
	game.menu.opening.time = 0.0
	for i: int in range(1080): game.menu.opening.advance()
	check(game.menu.mode == "opening","Still in the opening after 1080 ticks")
	game.menu.opening.advance()
	game.menu.opening.set_physics_process(true)
	check(game.game_mode == "story" and not game.menu.visible and game.session.player.character_id == "barel","The opening ends at 18 s (tick 1081) and starts the story")

	# ---- Pause origin, Stage 1: the live run is put back exactly
	game.pause_game(false)
	var s1: BmkStageSimulation = game.session as BmkStageSimulation
	tick(260)
	game.session.input.press("KeyD",game.session.tick)
	tick(30)
	await key(KEY_ESCAPE)
	check(game.menu.mode == "pause" and game.clock.paused,"Esc pauses the story")
	var before: String = live_state(s1)
	var before_files2: String = files()
	await click_button("조작 안내")
	check(game.menu.mode == "tutorial" and game.demo.on and game.demo.character == "barel","Pause -> 조작 안내")
	check(not t.practice_button.visible and not t.start_button.visible and t.back_button.visible and t.back_button.text == "돌아가기","Pause-origin actions")
	check(game.audio.paused,"From pause the sound stays suspended")
	check(game.demo.session.stage1_view and game.demo.session.cam_x == s1.cam_x and game.demo.session.sections.idx == s1.sections.idx,"The demo keeps the paused stage's backdrop and camera")
	tick(400)
	await key(KEY_ENTER)
	check(game.menu.mode == "tutorial","Enter does not start a game from pause")
	await click_button("돌아가기",t)
	check(game.menu.mode == "pause" and not game.demo.on,"돌아가기 returns to pause")
	check(game.session == s1 and live_state(s1) == before,"The paused run is untouched")
	check(files() == before_files2,"No checkpoint or record written")
	await click_button("계속하기")
	tick(5)
	check(not game.clock.paused and s1.tick > JSON.parse_string(before)[0],"The run resumes")

	# ---- Pause origin, Stage 3 wave stage with Viesa
	game.menu.selected_character = "viesa"
	game.character_id = "viesa"
	game.game_mode = "story"
	game.stage_index = 2
	game.stage_restored = true
	game.boss_challenge = false
	game.restart()
	game.menu.visible = false
	game.pause_game(false)
	var s3: BmkWaveSimulation = game.session as BmkWaveSimulation
	tick(200)
	s3.cam_x = 640
	s3.player.x = 840
	game.pause_game(true)
	game.menu.show_pause()
	var before3: String = live_state(s3)
	await click_button("조작 안내")
	check(game.demo.character == "viesa" and not game.demo.session.stage1_view and game.demo.session.stage_index == 2 and game.demo.session.cam_x == 640,"Stage 3: the demo uses its backdrop and camera")
	check(is_equal_approx(game.demo.session.player.x,640 + 640 * 0.22) and is_equal_approx(game.demo.session.enemies[0].x,640 + 640 * 0.22 + 430),"Character and dummy placed from the camera")
	tick(90)
	await capture("phase12_tutorial_viesa_stage3")
	await key(KEY_ESCAPE)
	check(game.menu.mode == "pause" and game.session == s3 and live_state(s3) == before3,"Esc returns to pause with Stage 3 untouched")

	# ---- Leaving through 타이틀로 / starting something else also stops the demo
	await click_button("조작 안내")
	game.menu.show_title()
	check(not game.demo.on and game.session == s3,"Leaving the tutorial screen any other way stops the demo")

	for path: String in [CHECKPOINT,RECORDS,SETTINGS]:
		DirAccess.remove_absolute(ProjectSettings.globalize_path(path))
	print("TUTORIAL: %d checks; %d failures" % [checks,failures.size()])
	for failure: String in failures: push_error(failure)
	game.queue_free()
	await process_frame
	quit(0 if failures.is_empty() else 1)
