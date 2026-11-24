extends SceneTree
## Story continue after the last life (game.js offerContinue / continueFight / gameOver), rendered:
## CONTINUE? 10 → Enter continues on the spot (3 lives, full HP, score 0); dying again asks again;
## 10 s, Esc or 포기 → GAME OVER (다시 도전 / 타이틀로); a boss challenge goes straight to GAME OVER.
## Covers Barel in Stage 1 (stage simulation) and Viesa in Stage 2 (wave simulation).
var game: BmkMenuGame
var failures: Array[String] = []
var checks: int = 0
const CHECKPOINT: String = "res://phase4/continue_test_checkpoint.json"
const RECORDS: String = "res://phase4/continue_test_records.json"
const SETTINGS: String = "res://phase4/continue_test_settings.json"

func _initialize() -> void:
	call_deferred("run")

func check(value: bool, label: String) -> void:
	checks += 1
	if not value:
		failures.append(label)
		print("FAIL: " + label)

func key(code: Key) -> void:
	for pressed: bool in [true,false]:
		var event: InputEventKey = InputEventKey.new()
		event.keycode = code
		event.physical_keycode = code
		event.pressed = pressed
		root.push_input(event)
	await process_frame

func click_button(label: String) -> void:
	await process_frame
	for child: Node in game.menu.buttons.find_children("*","Button",true,false):
		var b: Button = child as Button
		if b.text == label and b.is_visible_in_tree():
			for pressed: bool in [true,false]:
				var event: InputEventMouseButton = InputEventMouseButton.new()
				event.button_index = MOUSE_BUTTON_LEFT
				event.position = b.get_global_rect().get_center()
				event.global_position = event.position
				event.pressed = pressed
				root.push_input(event)
			await process_frame
			return
	check(false,"Missing button: " + label)

func tick(n: int) -> void:
	for i: int in range(n): game._physics_process(BmkSimulation.MS / 1000.0)

func countdown(n: int) -> void:
	for i: int in range(n): game.menu.step_continue()

## The last life is gone and the 100-tick fall has finished: one tick runs the dead branch.
func kill(score: int = -1) -> void:
	var p: BmkActorState = game.session.player
	if score >= 0: p.score = score
	p.lives = 0
	p.hp = 0
	p.st = "dead"
	p.t = 101
	tick(1)

func capture(name_: String) -> void:
	await process_frame
	await process_frame
	await RenderingServer.frame_post_draw
	check(root.get_texture().get_image().save_png("res://evidence/%s.png" % name_) == OK,"Capture " + name_)

func run() -> void:
	game = load("res://phase4/game.tscn").instantiate() as BmkMenuGame
	root.add_child(game)
	game.capture_mode = true
	game.set_physics_process(false)
	game.menu.set_physics_process(false)   # the countdown is stepped by hand
	game.save_store.checkpoint_path = CHECKPOINT
	game.save_store.records_path = RECORDS
	game.preferences.storage_path = SETTINGS
	game.preferences.use_preset("arcade")
	game.preferences.touch = false
	game.preferences.menu_language = "ko"   # English is the default; these checks read the Korean copy
	game.apply_preferences()
	game.save_store.write_json(RECORDS,{"bestScore":0,"stages":[{"rank":"A","seconds":100}]})
	await process_frame

	# ---- Barel, Stage 1 (stage simulation)
	game.start_new("barel")
	tick(5)
	var s: BmkSimulation = game.session
	kill(4321)
	check(s.continue_pending and not s.game_over,"Story: the last life asks CONTINUE? instead of game over")
	check(game.menu.visible and game.menu.mode == "continue" and game.clock.paused,"CONTINUE? is shown over the frozen run")
	check(game.menu.title.text == BmkCopy.text("CONTINUE_COUNT") % 10,"The countdown starts at 10")
	var frozen: int = s.tick
	tick(30)
	check(s.tick == frozen,"The run does not advance while asking")
	countdown(120)
	check(game.menu.title.text == BmkCopy.text("CONTINUE_COUNT") % 8,"2 s later it shows 8")
	await capture("continue_prompt")
	var cam: float = s.cam_x
	await key(KEY_ENTER)
	var p: BmkActorState = s.player
	check(not game.menu.visible and not game.clock.paused and not s.continue_pending,"Enter continues the run")
	check(p.lives == 3 and p.hp == p.max_hp and p.score == 0 and p.st == "free" and p.inv == 150,"3 lives, full HP, score 0, invulnerable")
	check(is_equal_approx(p.x,cam + 100.0) and is_equal_approx(p.y,420.0) and p.z == 0.0,"Up where the player fell (normal respawn spot)")
	tick(10)
	check(s.tick > frozen,"The run advances again")

	# ---- Unlimited, then the countdown runs out
	kill()
	check(game.menu.mode == "continue","Dying again asks again")
	s.take_audio()
	countdown(599)
	check(game.menu.mode == "continue" and not s.game_over,"Still asking at 9.98 s")
	countdown(1)
	check(game.menu.mode == "over" and s.game_over and not s.continue_pending,"At 10 s: GAME OVER")
	var log: Array = s.take_audio()
	check(log.has(["stop",0.3]) and log.has(["sfx","defeat",0]),"Game over stops the music and plays defeat")
	check(game.menu.title.text == "게임 오버" and game.menu.message.text == "스테이지 1 도살자들의 거리 — 점수 0","GAME OVER names the stage and the score after the continue")
	await capture("continue_game_over")
	tick(5)
	check(game.menu.mode == "over","GAME OVER stays until chosen")
	await key(KEY_ENTER)
	check(not game.menu.visible and game.session != s and not game.session.game_over and game.session.player.lives == 3,"Enter on GAME OVER retries the stage")

	# ---- Esc and the two buttons
	kill()
	await key(KEY_ESCAPE)
	check(game.menu.mode == "over" and game.session.game_over,"Esc gives up")
	await click_button("다시 도전")
	check(not game.menu.visible and not game.session.game_over,"다시 도전 retries")
	kill()
	await click_button("이어서 싸우기 (Enter)")
	check(not game.menu.visible and game.session.player.lives == 3,"이어서 싸우기 continues")
	kill()
	await click_button("포기 (Esc)")
	check(game.menu.mode == "over","포기 gives up")
	await click_button("타이틀로")
	check(game.menu.mode == "title","타이틀로 returns to the title")
	tick(5)
	check(game.menu.mode == "title","The title stays (no second GAME OVER)")

	# ---- Viesa, Stage 2 (wave simulation)
	var entry: BmkCheckpoint = BmkCheckpoint.new()
	entry.stage = 1
	entry.character_id = "viesa"
	entry.score = 900
	game.game_mode = "story"
	game.load_story_entry(entry)
	game.menu.visible = false
	game.pause_game(false)
	for i: int in range(600):
		if (game.session as BmkStageSimulation).mode == "play": break
		tick(1)
	check(game.session.player.character_id == "viesa" and game.stage_index == 1 and (game.session as BmkStageSimulation).mode == "play","Viesa in Stage 2, past the stage banner")
	kill()
	check(game.menu.mode == "continue" and game.session.continue_pending,"Viesa: CONTINUE? in Stage 2")
	await key(KEY_ENTER)
	p = game.session.player
	check(p.lives == 3 and p.hp == p.max_hp and p.max_hp == 80 and p.score == 0,"Viesa continues with her 80 HP")
	kill()
	await key(KEY_ESCAPE)
	check(game.menu.message.text == "스테이지 2 까마귀 마녀의 성역 — 점수 0","Stage 2 GAME OVER text")

	# ---- Boss challenge: no continue
	game.menu.challenge_stage = 0
	game.start_challenge("barel")
	check(game.game_mode == "challenge","Boss challenge started")
	kill()
	check(not game.session.continue_pending and game.session.game_over and game.menu.mode == "over","Boss challenge: straight to GAME OVER")
	var labels: Array = []
	for child: Node in game.menu.buttons.find_children("*","Button",true,false): if (child as Button).is_visible_in_tree(): labels.append((child as Button).text)
	check(labels == ["보스 목록","다시 도전","타이틀로"],"Challenge GAME OVER offers 보스 목록 (%s)" % str(labels))

	for path: String in [CHECKPOINT,RECORDS,SETTINGS]: DirAccess.remove_absolute(ProjectSettings.globalize_path(path))
	print("CONTINUE: %d checks; %d failures" % [checks,failures.size()])
	quit(0 if failures.is_empty() else 1)
