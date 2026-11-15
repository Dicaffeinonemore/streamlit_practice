class_name BmkVerticalSlice
extends Node2D
var session: BmkSimulation
var clock: BmkSimulationClock
var section: BmkStreetSection
var bank: BmkAssetBank
var selector: BmkFrameSelector
var physical: BmkPhysicalInput = BmkPhysicalInput.new()
var world: Node2D
var street_view: BmkStreetView
var actors: Node2D
var player_view: BmkActorView
var enemy_views: Dictionary[int, BmkActorView] = {}
var effects: BmkEffectView
var special_dim: BmkSpecialDim
var debug_view: BmkDebugView
var hud: BmkGameHud
var audio: BmkGameAudio
var source: Dictionary
var capture_mode: bool = false
var visual_rng: RandomNumberGenerator = RandomNumberGenerator.new()

func _ready() -> void:
	get_window().content_scale_size = Vector2i(960,540)
	bank = BmkAssetBank.new()
	selector = make_selector()
	source = BmkSourceJson.combat_source()
	visual_rng.randomize()
	physical.configure()
	world = Node2D.new()
	world.scale = Vector2(1.5,1.5)
	add_child(world)
	street_view = make_street_view()
	street_view.bank = bank
	world.add_child(street_view)
	actors = Node2D.new()
	actors.y_sort_enabled = true
	world.add_child(actors)
	player_view = make_actor_view()
	actors.add_child(player_view)
	special_dim = BmkSpecialDim.new()
	special_dim.z_index = 1
	world.add_child(special_dim)
	effects = BmkEffectView.new()
	effects.z_index = 3
	effects.bank = bank
	world.add_child(effects)
	debug_view = BmkDebugView.new()
	debug_view.z_index = 4
	debug_view.visible = "--hitbox=1" in OS.get_cmdline_user_args()
	world.add_child(debug_view)
	var layer: CanvasLayer = CanvasLayer.new()
	add_child(layer)
	hud = make_hud()
	hud.game = self
	layer.add_child(hud)
	audio = BmkGameAudio.new()
	add_child(audio)
	restart()
	for arg: String in OS.get_cmdline_user_args():
		if arg == "--keys=wasd":
			physical.configure("wasd")
		if arg == "--capture":
			capture_mode = true
		if arg == "--debug=1":
			debug_view.visible = true
		if arg.begins_with("--section=") and not accepts_section(arg):
			push_warning("Phase 2 contains section 1 only. Later sections require the full Stage 1 phase.")
	present()

func restart() -> void:
	for view: BmkActorView in enemy_views.values():
		view.queue_free()
	enemy_views.clear()
	session = BmkSimulation.new(load("res://phase2/generated/combat.res") as BmkCombatData)
	clock = BmkSimulationClock.new(session)
	section = BmkStreetSection.new(session,source)
	street_view.session = session
	street_view.section = section
	effects.session = session
	special_dim.session = session
	effects.impacts.clear()
	debug_view.session = session
	session.sound_requested.connect(audio.play)
	session.impact_requested.connect(effects.impact)
	session.step_completed.connect(effects.advance)
	audio.pause_audio(false)

func _physics_process(_delta: float) -> void:
	if not section.complete and not session.game_over:
		clock.advance(BmkSimulation.MS)
	present()

func present() -> void:
	world.position = Vector2(-session.cam_x * 1.5,-146.0 * 1.5)
	# Cosmetic shake uses its own RNG; it cannot perturb combat spawn randomness.
	if session.shake > 0.5 and not clock.paused and not capture_mode:
		world.position += Vector2(visual_rng.randf_range(-1,1),visual_rng.randf_range(-1,1)) * session.shake * 0.6
	var pose: Dictionary = selector.player(session)
	player_view.present(session,session.player,bank.animation("barel_rika.sheet." + str(pose["clip"])),int(pose["index"]),true)
	player_view.z_index = 2 if session.player.st == "special" else 0
	var alive: Dictionary[int, bool] = {}
	for e: BmkActorState in session.enemies:
		alive[e.id] = true
		if not enemy_views.has(e.id):
			var view: BmkActorView = make_actor_view()
			actors.add_child(view)
			enemy_views[e.id] = view
		var selected: Dictionary = selector.enemy(session,e,bank.catalogs["STAGE1_ENEMY_ART"].get(e.species,{}))
		enemy_views[e.id].present(session,e,bank.animation(actor_animation_id(e,selected)),int(selected["index"]))
	for id: int in enemy_views.keys():
		if not alive.has(id):
			enemy_views[id].queue_free()
			enemy_views.erase(id)
	# Canvas stable sorting puts the source player after enemies at equal depth.
	actors.move_child(player_view,actors.get_child_count() - 1)
	street_view.queue_redraw()
	effects.queue_redraw()
	special_dim.queue_redraw()
	debug_view.queue_redraw()
	hud.queue_redraw()

func pause_game(value: bool) -> void:
	clock.paused = value
	physical.clear(session)
	audio.pause_audio(value)

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.is_pressed() and not (event as InputEventKey).echo:
		match (event as InputEventKey).keycode:
			KEY_ESCAPE:
				pause_game(not clock.paused)
				return
			KEY_F9:
				debug_view.visible = not debug_view.visible
				return
			KEY_F1:
				physical.clear(session)
				physical.configure("wasd" if physical.preset == "arcade" else "arcade")
				return
			KEY_F2:
				if debug_view.visible:
					session.player.sp = 100
					session.player.mg = 3
				return
			KEY_R:
				restart()
				return
			KEY_M:
				audio.toggle()
				return
	if not clock.paused:
		physical.handle(event,session)

func _notification(what: int) -> void:
	if what == NOTIFICATION_APPLICATION_FOCUS_OUT and clock != null and not capture_mode:
		pause_game(true)

func make_selector() -> BmkFrameSelector:
	return BmkFrameSelector.new(bank.catalogs["barel_timelines"])

func make_street_view() -> BmkStreetView:
	return BmkStreetView.new()

func make_actor_view() -> BmkActorView:
	return BmkActorView.new()

func make_hud() -> BmkGameHud:
	return BmkGameHud.new()

func actor_animation_id(e: BmkActorState, selected: Dictionary) -> String:
	return "stage1_presented_%s_%s" % [e.species,selected["clip"]]

func accepts_section(arg: String) -> bool:
	return arg == "--section=1"
