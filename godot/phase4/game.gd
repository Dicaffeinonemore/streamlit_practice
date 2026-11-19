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

func _ready() -> void:
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
	layer.add_child(menu)
	menu.new_game.connect(start_new)
	menu.continue_game.connect(restore_checkpoint)
	menu.practice_game.connect(start_practice)
	menu.challenge_game.connect(start_challenge)
	menu.resume_game.connect(resume_from_menu)
	menu.retry_game.connect(retry_current)
	menu.next_stage.connect(continue_next_stage)
	menu.quit_game.connect(request_close)
	menu.settings_changed.connect(apply_preferences)
	# index.html #playPause: the pixel-UI pause button, shown while playing.
	var pause_layer: CanvasLayer = CanvasLayer.new()
	pause_layer.layer = 5
	add_child(pause_layer)
	pause_button = TextureButton.new()
	var pause_art: AtlasTexture = AtlasTexture.new()
	pause_art.atlas = load("res://port_assets/images/pixel_ui_source__1d6b42ef373a.png") as Texture2D
	pause_art.region = Rect2(1510,388,150,135)
	pause_button.texture_normal = pause_art
	pause_button.ignore_texture_size = true
	pause_button.stretch_mode = TextureButton.STRETCH_SCALE
	pause_button.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	pause_button.position = Vector2(960 * (1 - 0.005 - 0.055),540 * 0.005)
	pause_button.size = Vector2(960 * 0.055,540 * 0.09)
	pause_button.tooltip_text = "일시정지"
	pause_button.visible = false
	pause_button.pressed.connect(func() -> void:
		pause_game(true)
		menu.show_pause())
	pause_layer.add_child(pause_button)
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

func present() -> void:
	super.present()
	sync_pause_button()

## #playPause is hidden unless the scene is play, intro or bossintro.
func sync_pause_button() -> void:
	if pause_button == null: return
	var s: BmkStageSimulation = session as BmkStageSimulation
	pause_button.visible = menu != null and not menu.visible and not clock.paused and s != null and s.mode in ["play","intro","bossintro"] and not touch.editing

## clearInput() also forgets touch pointers (UX.clearTouch()).
func pause_game(value: bool) -> void:
	super.pause_game(value)
	if touch != null: touch.clear_touch()

func start_new(character: String = "barel") -> void:
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
	super._physics_process(delta)
	var s: BmkStageSimulation = session as BmkStageSimulation
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

func _unhandled_input(event: InputEvent) -> void:
	if menu == null:
		super._unhandled_input(event)
		return
	if touch != null and touch.editing:
		if event is InputEventKey and event.is_pressed() and not (event as InputEventKey).echo and (event as InputEventKey).keycode == KEY_ESCAPE: touch.end_edit()
		return
	if menu.visible:
		if event is InputEventKey and event.is_pressed() and not (event as InputEventKey).echo and (event as InputEventKey).keycode == KEY_ESCAPE and menu.mode == "pause": resume_from_menu()
		return
	if event is InputEventKey and event.is_pressed() and not (event as InputEventKey).echo and (event as InputEventKey).keycode == KEY_ESCAPE:
		pause_game(true)
		menu.show_pause()
		return
	if event is InputEventKey and event.is_pressed() and not (event as InputEventKey).echo and (event as InputEventKey).keycode == KEY_R:
		retry_current()
		return
	super._unhandled_input(event)

func _notification(what: int) -> void:
	super._notification(what)
	if what == NOTIFICATION_APPLICATION_FOCUS_OUT and menu != null and not menu.visible and not capture_mode:
		menu.show_pause()
