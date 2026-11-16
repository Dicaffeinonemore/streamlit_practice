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
	menu.quit_game.connect(request_close)
	menu.settings_changed.connect(apply_preferences)
	apply_preferences()
	pause_game(true)

func start_new() -> void:
	game_mode = "story"
	start_section = 0
	phase_debug = 1
	ult_debug = false
	restart()
	recorded = false
	var entry: BmkCheckpoint = BmkCheckpoint.new()
	var error: Error = save_store.save_checkpoint(entry)
	if error != OK:
		menu.message.text = "SAVE FAILED: %s" % error_string(error)
		return
	story_entry = entry
	menu.visible = false
	pause_game(false)

func restore_checkpoint() -> void:
	var entry: BmkCheckpoint = save_store.checkpoint()
	if entry == null:
		menu.message.text = "NO VALID CHECKPOINT"
		return
	if entry.stage != 0 or entry.character_id != "barel":
		menu.message.text = "THIS CHARACTER OR STAGE IS NOT AVAILABLE YET"
		return
	game_mode = "story"
	load_story_entry(entry)

func load_story_entry(entry: BmkCheckpoint) -> void:
	story_entry = entry
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

func start_practice() -> void:
	game_mode = "practice"
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

func start_challenge() -> void:
	var stages: Array = save_store.records()["stages"]
	if stages.is_empty() or stages[0] == null: return
	game_mode = "challenge"
	start_section = 4
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
		var report: String = "RANK %s   TIME %d:%02d\nMAX CHAIN %d   DAMAGE %d   DEATHS %d\nSCORE %d" % [rank,seconds / 60,seconds % 60,s.chain_max,s.stat_damage,s.stat_deaths,s.player.score]
		if game_mode == "story":
			var error: Error = save_store.record(0,s.player.score,rank,seconds)
			if error != OK: report += "\nRECORD SAVE FAILED"
			var entry: BmkCheckpoint = BmkCheckpoint.new()
			entry.stage = 1
			entry.score = int(s.player.score)
			entry.hp = mini(100,int(s.player.hp) + 40)
			entry.lives = int(s.player.lives)
			entry.sp = int(s.player.sp)
			entry.mg = int(s.player.mg)
			entry.buff = int(s.player.buff)
			if save_store.save_checkpoint(entry) != OK: report += "\nCHECKPOINT SAVE FAILED"
		pause_game(true)
		menu.show_result(report,game_mode == "challenge")

func _unhandled_input(event: InputEvent) -> void:
	if menu == null:
		super._unhandled_input(event)
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
