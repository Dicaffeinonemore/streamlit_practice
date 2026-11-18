class_name BmkStageGame
extends BmkVerticalSlice
var stage_config: BmkStageData
var start_section: int = 0
var phase_debug: int = 1
var ult_debug: bool = false
var top_view: BmkStageTopView
var item_views: Dictionary[BmkWorldItem, BmkItemView] = {}
## game.js selectedCharacterId; restart() builds the matching player.
var character_id: String = "barel"
var viesa_view: BmkViesaView
var viesa_sigil: BmkViesaView.Sigil
var viesa_dim: ViesaDim
## 0 = Stage 1 (sections + Gorath), 1 = Stage 2 (waves + Morgra).
var stage_index: int = 0
## startStage(i, restored): restored entries do not get the +40 next-stage healing.
var stage_restored: bool = true
var boss_challenge: bool = false
var wave_backdrop: BmkWaveBackdrop
var morgra_ground: BmkMorgraView.Ground
var morgra_view: BmkMorgraView
var legacy_presenter: BmkLegacyPresenter

## Viesa's ultimate dims only the scenery: drawn after the backdrop, before the actors.
class ViesaDim:
	extends Node2D
	var session: BmkSimulation
	func _draw() -> void:
		if session == null or not session.player.is_viesa() or session.player.st != "special": return
		draw_rect(Rect2(session.cam_x - 40,146 - 40,640 + 80,360 + 80),Color(0,0,0,0.3))

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
	viesa_view = BmkViesaView.new()
	viesa_view.bank = bank
	viesa_view.z_index = 3
	world.add_child(viesa_view)
	viesa_dim = ViesaDim.new()
	world.add_child(viesa_dim)
	world.move_child(viesa_dim,street_view.get_index() + 1)
	wave_backdrop = BmkWaveBackdrop.new()
	wave_backdrop.bank = bank
	world.add_child(wave_backdrop)
	world.move_child(wave_backdrop,street_view.get_index() + 1)
	morgra_ground = BmkMorgraView.Ground.new()
	morgra_ground.bank = bank
	world.add_child(morgra_ground)
	world.move_child(morgra_ground,viesa_dim.get_index() + 1)
	morgra_view = BmkMorgraView.new()
	morgra_view.bank = bank
	morgra_view.z_index = 3
	world.add_child(morgra_view)
	legacy_presenter = BmkLegacyPresenter.new(bank)
	viesa_sigil = BmkViesaView.make_sigil()
	player_view.add_child(viesa_sigil)
	player_view.move_child(viesa_sigil,0)
	present()

func restart() -> void:
	for view: BmkActorView in enemy_views.values(): view.queue_free()
	enemy_views.clear()
	for view: BmkItemView in item_views.values(): view.queue_free()
	item_views.clear()
	if stage_config == null: stage_config = load("res://phase3/generated/stage.res") as BmkStageData
	var s: BmkStageSimulation
	if stage_index == 1:
		var wave: BmkWaveSimulation = BmkWaveSimulation.new(stage_config)
		wave.use_character(character_id)
		wave.start_stage(stage_restored)
		if boss_challenge: wave.begin_boss_challenge()
		s = wave
	else:
		s = BmkStageSimulation.new(stage_config)
		s.use_character(character_id)
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
	audio.stage_number = stage_index + 1
	audio.play_track("boss" if s.mode == "bossintro" else "stage")
	if wave_backdrop != null: wave_backdrop.reset()

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
	var wave: BmkWaveSimulation = s as BmkWaveSimulation
	street_view.visible = wave == null
	if top_view != null: top_view.visible = wave == null
	if wave_backdrop != null:
		wave_backdrop.visible = wave != null
		wave_backdrop.wave = wave
		wave_backdrop.session = wave
		wave_backdrop.queue_redraw()
		morgra_ground.visible = wave != null
		morgra_ground.session = wave
		morgra_ground.refresh()
		morgra_view.visible = wave != null
		morgra_view.session = wave
		morgra_view.queue_redraw()
	if viesa_view != null:
		viesa_view.present(s)
		viesa_dim.session = s
		viesa_dim.queue_redraw()
		BmkViesaView.present_sigil(viesa_sigil,s,bank)
		# paintViesa(): drawLit brightens the whole body while flashing, including hurt.
		if s.player.is_viesa() and s.player.flash > 0 and show_flash: player_view.body.modulate = Color(1.8,1.8,1.8,player_view.body.modulate.a)

## Stage 2 soldiers use the named stage art; Morgra uses her own clips (hover lift included).
func present_enemy(view: BmkActorView, e: BmkActorState) -> void:
	if e is not BmkLegacyActor:
		super.present_enemy(view,e)
		return
	var pose: Dictionary = legacy_presenter.pose(session as BmkWaveSimulation,e as BmkLegacyActor)
	view.visible = bool(pose.get("visible",false))
	if not pose.has("asset"):
		view.visible = false
		return
	view.present(session,e,pose["asset"] as BmkAnimationAsset,int(pose["index"]))
	view.body.scale *= float(pose["scale"])
	view.body.position.y -= float(pose["lift"])
	view.body.modulate = Color(2,2,2) if e.flash > 0 and show_flash else Color.WHITE
	view.body.modulate.a = float(pose["alpha"])

func player_pose() -> Array:
	if session.player.is_viesa():
		var pose: Array = (session.player_controller as BmkViesaController).pose(session)
		return [bank.animation("viesa_art." + str(pose[0])),int(pose[1])]
	return super.player_pose()

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
