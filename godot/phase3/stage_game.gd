class_name BmkStageGame
extends BmkVerticalSlice
var stage_config: BmkStageData
var start_section: int = 0
var phase_debug: int = 1
var ult_debug: bool = false
var top_view: BmkStageTopView
var item_views: Dictionary[BmkWorldItem, BmkItemView] = {}

func _ready() -> void:
	for arg: String in OS.get_cmdline_user_args():
		if arg == "--boss1=old":
			push_error("This scene implements the Gorath remake. The legacy boss debug variant is not available.")
			get_tree().quit(2)
			return
		if arg.begins_with("--section="): start_section = clampi(int(arg.get_slice("=",1)) - 1,0,4)
		if arg == "--boss-phase=2": phase_debug = 2
		if arg == "--boss-ult=1": ult_debug = true
	super._ready()
	get_tree().auto_accept_quit = false
	top_view = BmkStageTopView.new()
	top_view.bank = bank
	top_view.z_index = 3
	world.add_child(top_view)
	present()

func restart() -> void:
	for view: BmkActorView in enemy_views.values(): view.queue_free()
	enemy_views.clear()
	for view: BmkItemView in item_views.values(): view.queue_free()
	item_views.clear()
	if stage_config == null: stage_config = load("res://phase3/generated/stage.res") as BmkStageData
	var s: BmkStageSimulation = BmkStageSimulation.new(stage_config)
	s.boss_phase_debug = phase_debug
	s.boss_ult_debug = ult_debug
	if start_section > 0: s.sections.enter_section(start_section)
	session = s
	clock = BmkSimulationClock.new(s)
	section = s.sections
	street_view.session = s
	street_view.section = section
	effects.session = s
	effects.impacts.clear()
	special_dim.session = s
	debug_view.session = s
	s.sound_requested.connect(audio.play)
	s.impact_requested.connect(effects.impact)
	s.step_completed.connect(effects.advance)
	s.music_requested.connect(audio.play_track)
	audio.pause_audio(false)
	audio.play_track("stage")

func present() -> void:
	super.present()
	var s: BmkStageSimulation = session as BmkStageSimulation
	(street_view as BmkFullStageView).background_id = str(s.sections.section["bg"])
	if top_view != null:
		top_view.session = s
		top_view.section = s.sections
		top_view.queue_redraw()
	var keep: Dictionary[BmkWorldItem, bool] = {}
	for item: BmkWorldItem in s.barrels + s.items:
		keep[item] = true
		if not item_views.has(item):
			var view: BmkItemView = BmkItemView.new()
			actors.add_child(view)
			item_views[item] = view
		item_views[item].present(item)
	for item: BmkWorldItem in item_views.keys():
		if not keep.has(item):
			item_views[item].queue_free()
			item_views.erase(item)
	actors.move_child(player_view,actors.get_child_count() - 1)

func make_selector() -> BmkFrameSelector:
	return BmkFullFrameSelector.new(bank.catalogs["barel_timelines"])

func make_street_view() -> BmkStreetView:
	return BmkFullStageView.new()

func make_actor_view() -> BmkActorView:
	return BmkStageActorView.new()

func make_hud() -> BmkGameHud:
	return BmkStageHud.new()

func actor_animation_id(e: BmkActorState, selected: Dictionary) -> String:
	return "gorath_remake." + str(selected["clip"]) if (e as BmkStageActor).boss else super.actor_animation_id(e,selected)

func accepts_section(_arg: String) -> bool:
	return true

func _unhandled_input(event: InputEvent) -> void:
	if debug_view != null and debug_view.visible and event is InputEventKey and event.is_pressed() and not (event as InputEventKey).echo:
		var key: Key = (event as InputEventKey).keycode
		if key >= KEY_1 and key <= KEY_5:
			start_section = int(key) - int(KEY_1)
			restart()
			return
		var s: BmkStageSimulation = session as BmkStageSimulation
		var e: BmkStageActor = s.gorath.boss(s)
		if e != null and key == KEY_F10:
			s.gorath.cancel(s,e)
			s.gorath.phase_two(s,e)
			s.mode = "play"
			return
		if e != null and key == KEY_F11:
			s.gorath.cancel(s,e)
			if e.g2.phase != 2: s.gorath.phase_two(s,e)
			s.gorath.actions.start_ult(s,e)
			s.mode = "play"
			return
	super._unhandled_input(event)

func request_close() -> void:
	set_physics_process(false)
	var tree: SceneTree = get_tree()
	# Release scene/audio resources before the engine tears down its servers.
	tree.create_timer(0.05).timeout.connect(tree.quit)
	queue_free()

func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_CLOSE_REQUEST:
		request_close()
	else:
		super._notification(what)
