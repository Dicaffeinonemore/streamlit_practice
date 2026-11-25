class_name BmkMenuGame
extends BmkStageGame
var save_store: BmkSaveStore = BmkSaveStore.new()
var preferences: BmkSettings
var menu: BmkMenuShell
var recorded: bool = false
var game_mode: String = "story"
var practice_origin: float = 80
var practice_done: Dictionary[String, bool] = {}
var practice_chain: int = 0
var story_entry: BmkCheckpoint
var touch: BmkTouchControls
var pause_button: TextureButton
## Phase 12 tutorial demonstration (demo-runtime.js). While it runs, the world and HUD render into
## demo_port (the #demoView copy) and every view points at the demo session; demo_saved keeps the
## live session, clock and in-flight impacts, which are put back untouched when it closes.
var demo: BmkDemoController = BmkDemoController.new()
var demo_saved: Dictionary = {}
var demo_port: SubViewport
## #practiceGuide buttons: 실전 시작 (btnPracticeGo) and 조작 안내 (btnPracticeHelp).
var practice_buttons: HBoxContainer
const EXPORT_PROBE: String = "res://phase13/export_probe.gd"
const WEB_PROBE: String = "res://phase13/web_probe.gd"

func _ready() -> void:
	BmkPlatform.install_web_fonts()
	BmkPlatform.watch_window(get_tree().root)
	preferences = BmkSettings.read()
	super._ready()
	if preferences.preset == "custom": physical.configure_custom(preferences.bindings)
	else: physical.configure(preferences.preset)
	var layer: CanvasLayer = CanvasLayer.new()
	layer.layer = 10
	add_child(layer)
	menu = BmkMenuShell.new()
	menu.settings = preferences
	menu.store = save_store
	menu.audio = audio
	layer.add_child(menu)
	menu.new_game.connect(start_new)
	menu.continue_game.connect(restore_checkpoint)
	menu.practice_game.connect(start_practice)
	menu.challenge_game.connect(start_challenge)
	menu.resume_game.connect(resume_from_menu)
	menu.retry_game.connect(retry_current)
	menu.next_stage.connect(continue_next_stage)
	menu.continue_fight.connect(continue_fight)
	menu.give_up.connect(game_over_now)
	menu.quit_game.connect(request_close)
	menu.settings_changed.connect(apply_preferences)
	menu.tutorial_requested.connect(open_tutorial)
	menu.tutorial_left.connect(close_tutorial)
	demo_port = SubViewport.new()
	demo_port.size = Vector2i(960,540)
	demo_port.disable_3d = true
	demo_port.canvas_item_default_texture_filter = Viewport.DEFAULT_CANVAS_ITEM_TEXTURE_FILTER_NEAREST
	demo_port.render_target_update_mode = SubViewport.UPDATE_DISABLED
	add_child(demo_port)
	# index.html #playPause: the pixel-UI pause button, shown while playing.
	var pause_layer: CanvasLayer = CanvasLayer.new()
	pause_layer.layer = 5
	add_child(pause_layer)
	pause_button = TextureButton.new()
	# The pause button of the HUD design (top right).
	pause_button.texture_normal = BmkHudDesign.sheet_frame("pause_frame",0,BmkHudDesign.PAUSE.size)
	pause_button.texture_pressed = BmkHudDesign.sheet_frame("pause_frame",1,BmkHudDesign.PAUSE.size)
	pause_button.ignore_texture_size = true
	pause_button.stretch_mode = TextureButton.STRETCH_SCALE
	pause_button.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	pause_button.position = BmkHudDesign.PAUSE.position
	pause_button.size = BmkHudDesign.PAUSE.size
	pause_button.tooltip_text = "일시정지"
	pause_button.visible = false
	pause_button.pressed.connect(func() -> void:
		open_pause())
	pause_layer.add_child(pause_button)
	practice_buttons = HBoxContainer.new()
	practice_buttons.theme = menu.tutorial.theme
	practice_buttons.alignment = BoxContainer.ALIGNMENT_CENTER
	practice_buttons.add_theme_constant_override("separation",8)
	practice_buttons.position = Vector2(0,120)
	practice_buttons.size = Vector2(960,34)
	practice_buttons.mouse_filter = Control.MOUSE_FILTER_IGNORE
	practice_buttons.visible = false
	for spec: Array in [["실전 시작",practice_go],["조작 안내",practice_help]]:
		var b: Button = Button.new()
		b.text = spec[0]
		b.focus_mode = Control.FOCUS_NONE
		b.add_theme_font_size_override("font_size",15)
		b.pressed.connect(spec[1])
		practice_buttons.add_child(b)
	pause_layer.add_child(practice_buttons)
	# game-ui.js touch controls, above the menu so the layout editor can cover it.
	var touch_layer: CanvasLayer = CanvasLayer.new()
	touch_layer.layer = 11
	add_child(touch_layer)
	touch = BmkTouchControls.new()
	touch.game = self
	touch.settings = preferences
	touch_layer.add_child(touch)
	touch.edit_finished.connect(func() -> void:
		menu.visible = true
		menu.show_settings())
	menu.touch_edit.connect(func() -> void:
		menu.visible = false
		touch.start_edit())
	apply_preferences()
	pause_game(true)
	# Phase 13: export templates ignore --script, so the exported-build probes are attached here. Each
	# is in one pack only (Windows / Web) and loaded by path, so other exports never reference it.
	for arg: String in OS.get_cmdline_user_args():
		if arg.begins_with("--export-probe=") and ResourceLoader.exists(EXPORT_PROBE):
			add_child.call_deferred((load(EXPORT_PROBE) as GDScript).new())
			break
	# The Web counterpart (Web pack only): reports buttons and state to the page for verify_web.cjs.
	if BmkPlatform.is_web() and ResourceLoader.exists(WEB_PROBE) and str(JavaScriptBridge.eval("location.search")).contains("bmk_probe=1"):
		add_child.call_deferred((load(WEB_PROBE) as GDScript).new())

func present() -> void:
	super.present()
	sync_pause_button()

## #playPause is hidden unless the scene is play, intro or bossintro.
func sync_pause_button() -> void:
	if pause_button == null: return
	var s: BmkStageSimulation = session as BmkStageSimulation
	pause_button.visible = menu != null and not menu.visible and not clock.paused and s != null and s.mode in ["play","intro","bossintro"] and not touch.editing
	# $('practiceGuide').hidden = !practice || scene !== 'play'
	practice_buttons.visible = game_mode == "practice" and menu != null and not menu.visible and not clock.paused and s != null and s.mode == "play" and not touch.editing

## btnPracticeGo: beginGame(true) - the opening, then the story with the practised character.
func practice_go() -> void:
	pause_game(true)
	menu.show_opening()

## btnPracticeHelp: pauseGame(); toTutorial('pause').
func practice_help() -> void:
	open_pause()
	menu.show_tutorial("pause")

## clearInput() also forgets touch pointers (UX.clearTouch()).
func open_pause(reason: String = "PAUSE_REASON") -> void:
	pause_game(true)
	menu.paused_challenge = game_mode == "challenge"
	menu.paused_character = session.player.character_id
	menu.pause_reason = reason
	menu.show_pause()

func pause_game(value: bool) -> void:
	super.pause_game(value)
	if touch != null: touch.clear_touch()

## toTutorial(from) -> demoStart(from): the paused run's character from pause, else the selection.
## The demo's backdrop is the session left in place (the paused stage, or the last stage played;
## at launch Stage 1, section 1, as the browser's fresh STAGES[0]).
func open_tutorial(origin: String) -> void:
	close_tutorial()
	var live: BmkStageSimulation = session as BmkStageSimulation
	var character: String = live.player.character_id if origin == "pause" else menu.selected_character
	# The title leaves the AudioContext running (AUDIO.pause(false)); from pause it stays suspended.
	if origin != "pause": audio.pause_audio(false)
	demo_saved = {"session":session,"clock":clock,"impacts":effects.impacts.duplicate(true)}
	demo.stage_config = stage_config
	var s: BmkWaveSimulation = demo.start(character,live)
	# Never advanced (demo.tick() steps the demo); unpaused so the view shows no pause overlay and
	# keeps the screen shake, as the browser renders the demo frame.
	var demo_clock: BmkSimulationClock = BmkSimulationClock.new(s)
	s.sound_requested.connect(audio.play)
	s.impact_requested.connect(effects.impact)
	s.step_completed.connect(effects.advance)
	effects.impacts.clear()
	use_session(s,demo_clock)
	world.reparent(demo_port,false)
	hud.get_parent().reparent(demo_port,false)
	demo_port.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	present()
	menu.tutorial.open(demo,demo_port.get_texture(),origin)

## demoStop(): put the live session, its views and the in-flight effects back.
func close_tutorial() -> void:
	if not demo.on: return
	demo.stop()
	world.reparent(self,false)
	move_child(world,0)
	hud.get_parent().reparent(self,false)
	demo_port.render_target_update_mode = SubViewport.UPDATE_DISABLED
	use_session(demo_saved["session"],demo_saved["clock"])
	effects.impacts = demo_saved["impacts"]
	demo_saved = {}
	if menu != null: menu.tutorial.visible = false
	present()

func start_new(character: String = "barel") -> void:
	close_tutorial()
	game_mode = "story"
	character_id = character
	stage_index = 0
	stage_restored = true
	boss_challenge = false
	start_section = 0
	phase_debug = 1
	ult_debug = false
	restart()
	recorded = false
	var entry: BmkCheckpoint = BmkCheckpoint.new()
	entry.character_id = character_id
	entry.hp = int(session.player.hp)
	var error: Error = save_store.save_checkpoint(entry)
	if error != OK:
		menu.message.text = "저장하지 못했습니다: %s" % error_string(error)
		return
	story_entry = entry
	menu.visible = false
	pause_game(false)

func restore_checkpoint() -> void:
	var entry: BmkCheckpoint = save_store.checkpoint()
	if entry == null:
		menu.message.text = "사용할 수 있는 저장 기록이 없습니다."
		return
	if entry.stage > 4:
		menu.message.text = "이 스테이지는 아직 준비 중입니다."
		return
	game_mode = "story"
	load_story_entry(entry)

func load_story_entry(entry: BmkCheckpoint) -> void:
	close_tutorial()
	story_entry = entry
	character_id = entry.character_id
	stage_index = entry.stage
	stage_restored = true
	boss_challenge = false
	start_section = 0
	restart()
	var p: BmkActorState = session.player
	p.hp = entry.hp
	p.lives = entry.lives
	p.score = entry.score
	p.sp = entry.sp
	p.mg = entry.mg
	p.buff = entry.buff
	recorded = false
	menu.visible = false
	pause_game(false)

## Stage clear -> btnNext: the saved next-stage entry already carries the +40 healing.
func continue_next_stage() -> void:
	var entry: BmkCheckpoint = save_store.checkpoint()
	if entry == null or entry.stage > 4:
		menu.message.text = "다음 스테이지는 아직 준비 중입니다."
		return
	game_mode = "story"
	load_story_entry(entry)

func start_practice() -> void:
	close_tutorial()
	character_id = menu.selected_character if menu != null else character_id
	game_mode = "practice"
	stage_index = 0
	boss_challenge = false
	start_section = 0
	restart()
	var s: BmkStageSimulation = session as BmkStageSimulation
	s.progression_enabled = false
	s.barrels.clear()
	s.player.inv = 0
	practice_origin = s.player.x
	practice_done.clear()
	practice_chain = 0
	spawn_training(s,350,420)
	menu.visible = false
	pause_game(false)

func spawn_training(s: BmkStageSimulation, x: float, y: float) -> void:
	var enemy: BmkActorState = s.spawn("axe",x,y)
	enemy.training = true

func start_challenge(character: String = "") -> void:
	var stage: int = menu.challenge_stage if menu != null else 0
	var stages: Array = save_store.records()["stages"]
	if stages.size() <= stage or stages[stage] == null: return
	if not character.is_empty(): character_id = character
	close_tutorial()
	game_mode = "challenge"
	stage_index = stage
	stage_restored = true
	boss_challenge = stage >= 1
	start_section = 4 if stage == 0 else 0
	restart()
	var s: BmkStageSimulation = session as BmkStageSimulation
	s.barrels.clear()
	s.player.sp = 100
	s.player.mg = 3
	recorded = false
	menu.visible = false
	pause_game(false)

func retry_current() -> void:
	if game_mode == "practice": start_practice()
	elif game_mode == "challenge": start_challenge()
	elif story_entry != null: load_story_entry(story_entry)

func apply_preferences() -> void:
	if preferences.preset == "custom": physical.configure_custom(preferences.bindings)
	else: physical.configure(preferences.preset)
	audio.set_levels(preferences.music_volume, preferences.sfx_volume)
	show_shake = preferences.shake
	show_flash = preferences.flash
	show_danger_zones = preferences.danger_zones
	street_view.show_danger_zones = preferences.danger_zones
	if wave_backdrop != null: wave_backdrop.show_danger_zones = preferences.danger_zones

func resume_from_menu() -> void:
	menu.visible = false
	pause_game(false)

func _physics_process(delta: float) -> void:
	# scene 'tutorial': update() is demoUpdate(); the live run does not advance.
	if demo.on:
		demo.tick()
		present()
		return
	# Only the story offers CONTINUE? (game.js: !bossChallenge && !practice).
	session.continue_offer = game_mode == "story"
	super._physics_process(delta)
	var s: BmkStageSimulation = session as BmkStageSimulation
	if s.continue_pending and not (menu.visible and menu.mode == "continue"): offer_continue()
	elif s.game_over and not menu.visible: show_game_over()
	if game_mode == "practice" and not clock.paused:
		var p: BmkActorState = s.player
		if absf(p.x - practice_origin) > 40: practice_done["move"] = true
		if p.z > 20: practice_done["jump"] = true
		if p.st == "dash": practice_done["dash"] = true
		if s.chain_n > practice_chain:
			practice_done["skill" if p.st == "skill" else "attack"] = true
		practice_chain = s.chain_n
		if s.enemies.is_empty() or s.enemies[0].st == "dead":
			s.enemies.clear()
			spawn_training(s,clampf(p.x + 110,100,550),p.y)
	if s.mode == "clear" and not recorded:
		recorded = true
		var seconds: int = s.js_round(s.stat_ticks / 60.0)
		var rank: String = BmkRankCalculator.calculate(seconds,s.stat_damage,s.stat_deaths,s.chain_max)
		var report: String = "랭크 %s   시간 %d:%02d\n최대 연속 공격 %d   누적 피해 %d   사망 %d\n점수 %d" % [rank,seconds / 60,seconds % 60,s.chain_max,s.stat_damage,s.stat_deaths,s.player.score]
		if game_mode == "story":
			var error: Error = save_store.record(stage_index,s.player.score,rank,seconds)
			if error != OK: report += "\n기록 저장에 실패했습니다."
			# The final stage clears the checkpoint: UX.saveCheckpoint(null).
			var entry: BmkCheckpoint = BmkCheckpoint.new() if stage_index + 1 < 5 else null
			if entry != null:
				entry.stage = stage_index + 1
				entry.character_id = character_id
				entry.score = int(s.player.score)
				entry.hp = mini(int(s.player.max_hp),int(s.player.hp) + 40)
				entry.lives = int(s.player.lives)
				entry.sp = int(s.player.sp)
				entry.mg = int(s.player.mg)
				entry.buff = int(s.player.buff)
			if save_store.save_checkpoint(entry) != OK: report += "\n이어하기 저장에 실패했습니다."
		pause_game(true)
		if game_mode == "story" and stage_index >= 4: menu.show_ending(report)
		else: menu.show_result(report,game_mode == "challenge",stage_index,game_mode == "story" and stage_index < 4)

# ------------------------------------------------------------------ continue (story)
## game.js offerContinue(): the run is frozen (the simulation stops on continue_pending) and the music
## keeps playing, as in the page, while the menu counts down from 10.
func offer_continue() -> void:
	clock.paused = true
	physical.clear(session)
	if touch != null: touch.clear_touch()
	menu.show_continue()

## game.js continueFight(): up where the player fell, as a normal respawn (cam + 100, 420, 150 ticks of
## invulnerability), with newPlayer()'s 3 lives, full HP and the score reset to 0.
func continue_fight() -> void:
	var s: BmkSimulation = session
	if not s.continue_pending: return
	var p: BmkActorState = s.player
	p.score = 0
	p.lives = BmkActorState.new().lives
	p.st = "free"
	p.t = 0
	p.hp = p.max_hp
	p.inv = 150
	p.z = 0.0
	p.vz = 0.0
	p.vx = 0.0
	p.x = s.cam_x + 100.0
	p.y = 420.0
	s.continue_pending = false
	menu.visible = false
	physical.clear(session)
	clock.paused = false
	audio.play("click")

## game.js gameOver(): declined or timed out (or a boss challenge's last life): AUDIO.stop(0.3),
## sfx('defeat') and the GAME OVER screen.
func game_over_now() -> void:
	var s: BmkSimulation = session
	if s.continue_pending:
		s.continue_pending = false
		s.game_over = true
		s.music("stop",0.3)
		s.sound("defeat")
	show_game_over()

func show_game_over() -> void:
	clock.paused = true
	physical.clear(session)
	if touch != null: touch.clear_touch()
	var stage: Dictionary = (bank.catalogs["STAGES"] as Array)[clampi(stage_index,0,4)]
	menu.show_game_over("%s %s — 점수 %d" % [stage["name"],stage["title"],int(session.player.score)],game_mode == "challenge")

## Phase 13: Android's back button (application/config/quit_on_go_back is off). On the title it
## leaves the app; everywhere else it is Esc, so it pauses, goes back a menu or ends layout editing.
func go_back() -> void:
	if menu != null and menu.visible and menu.mode == "title" and not (touch != null and touch.editing):
		request_close()
		return
	for pressed: bool in [true,false]:
		var key: InputEventKey = InputEventKey.new()
		key.keycode = KEY_ESCAPE
		key.physical_keycode = KEY_ESCAPE
		key.pressed = pressed
		Input.parse_input_event(key)

func _unhandled_input(event: InputEvent) -> void:
	# game.js keydown: M toggles sound on every screen (AUDIO.toggle()).
	if event is InputEventKey and event.is_pressed() and not (event as InputEventKey).echo and (event as InputEventKey).keycode == KEY_M and not (touch != null and touch.editing):
		audio.toggle()
		if menu != null and menu.visible and menu.mode == "settings": menu.show_settings()
		return
	if menu == null:
		super._unhandled_input(event)
		return
	if touch != null and touch.editing:
		if event is InputEventKey and event.is_pressed() and not (event as InputEventKey).echo and (event as InputEventKey).keycode == KEY_ESCAPE: touch.end_edit()
		return
	if menu.visible:
		if event is InputEventKey and event.is_pressed() and not (event as InputEventKey).echo and menu.tutorial_key((event as InputEventKey).keycode): return
		if event is InputEventKey and event.is_pressed() and not (event as InputEventKey).echo and (event as InputEventKey).keycode == KEY_ESCAPE:
			if menu.mode == "pause": resume_from_menu()
			elif menu.mode == "settings": menu.back_from_settings()
			elif menu.mode == "continue": menu.answer_continue(false)
		# onKeyOnce Enter: continue, or 다시 도전 on GAME OVER.
		if event is InputEventKey and event.is_pressed() and not (event as InputEventKey).echo and (event as InputEventKey).keycode in [KEY_ENTER,KEY_KP_ENTER]:
			if menu.mode == "continue": menu.answer_continue(true)
			elif menu.mode == "over": retry_current()
		return
	if event is InputEventKey and event.is_pressed() and not (event as InputEventKey).echo and (event as InputEventKey).keycode == KEY_ESCAPE:
		open_pause()
		return
	# A custom physical R belongs to the selected action, including on key release.
	if event is InputEventKey and BmkPhysicalInput.key_id(event) == KEY_R and physical.by_key.has(KEY_R):
		physical.handle(event, session)
		return
	if event is InputEventKey and (event as InputEventKey).keycode == KEY_F1:
		if event.is_pressed() and not (event as InputEventKey).echo:
			physical.clear(session)
			preferences.use_preset("wasd" if preferences.preset == "arcade" else "arcade")
			apply_preferences()
		return
	if event is InputEventKey and event.is_pressed() and not (event as InputEventKey).echo and (event as InputEventKey).keycode == KEY_R:
		retry_current()
		return
	super._unhandled_input(event)

func _notification(what: int) -> void:
	super._notification(what)
	if what == NOTIFICATION_WM_GO_BACK_REQUEST: go_back()
	if what == NOTIFICATION_APPLICATION_FOCUS_OUT and menu != null and not menu.visible and not capture_mode:
		open_pause("PAUSE_BLUR")
