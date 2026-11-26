class_name BmkStageGame
extends BmkVerticalSlice
var stage_config: BmkStageData
var start_section: int = 0
var phase_debug: int = 1
var ult_debug: bool = false
var top_view: BmkStageTopView
## Arena fence and front scaffolds: drawn after the characters (game.js drawStage1Front()).
var top_front: BmkStageTopView
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
var aurelion_back: BmkAurelionView
var aurelion_view: BmkAurelionView
var vargul_ground: BmkVargulView
var vargul_view: BmkVargulView
var sovereign_ground: BmkSovereignView
var sovereign_view: BmkSovereignView
var rift_view: BmkRiftView

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
	top_view.z_index = EFFECT_Z
	world.add_child(top_view)
	top_front = BmkStageTopView.new()
	top_front.bank = bank
	top_front.foreground = true
	top_front.z_index = 5
	world.add_child(top_front)
	viesa_view = BmkViesaView.new()
	viesa_view.bank = bank
	viesa_view.z_index = EFFECT_Z
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
	morgra_view.z_index = EFFECT_Z
	world.add_child(morgra_view)
	legacy_presenter = BmkLegacyPresenter.new(bank)
	aurelion_back = BmkAurelionView.new()
	aurelion_back.bank = bank
	aurelion_back.back = true
	world.add_child(aurelion_back)
	world.move_child(aurelion_back,morgra_ground.get_index() + 1)
	vargul_ground = BmkVargulView.new()
	vargul_ground.bank = bank
	vargul_ground.ground = true
	world.add_child(vargul_ground)
	world.move_child(vargul_ground,aurelion_back.get_index() + 1)
	sovereign_ground = BmkSovereignView.new()
	sovereign_ground.bank = bank
	sovereign_ground.ground = true
	world.add_child(sovereign_ground)
	world.move_child(sovereign_ground,vargul_ground.get_index() + 1)
	rift_view = BmkRiftView.new()
	rift_view.bank = bank
	world.add_child(rift_view)
	world.move_child(rift_view,sovereign_ground.get_index() + 1)
	sovereign_view = BmkSovereignView.new()
	sovereign_view.bank = bank
	sovereign_view.z_index = EFFECT_Z
	world.add_child(sovereign_view)
	vargul_view = BmkVargulView.new()
	vargul_view.bank = bank
	vargul_view.z_index = EFFECT_Z
	world.add_child(vargul_view)
	aurelion_view = BmkAurelionView.new()
	aurelion_view.bank = bank
	aurelion_view.z_index = EFFECT_Z
	world.add_child(aurelion_view)
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
	if stage_index >= 1:
		var wave: BmkWaveSimulation = BmkWaveSimulation.new(stage_config,null,stage_index)
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

## Phase 12: point every view at another session without touching either simulation (the
## tutorial demo session, then the live run again). Signals are connected by the caller.
func use_session(s: BmkStageSimulation, c: BmkSimulationClock) -> void:
	for view: BmkActorView in enemy_views.values(): view.queue_free()
	enemy_views.clear()
	for view: BmkItemView in item_views.values(): view.queue_free()
	item_views.clear()
	session = s
	clock = c
	section = s.sections
	street_view.session = s
	street_view.section = section
	effects.session = s
	special_dim.session = s
	debug_view.session = s

func present() -> void:
	super.present()
	var s: BmkStageSimulation = session as BmkStageSimulation
	(street_view as BmkFullStageView).background_id = str(s.sections.section["bg"])
	for view: BmkStageTopView in [top_view,top_front]:
		if view == null: continue
		view.session = s
		view.section = s.sections
		view.queue_redraw()
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
	# The Stage 1 tutorial demo is a wave session drawn with the Stage 1 street.
	if wave != null and wave.stage1_view: wave = null
	street_view.visible = wave == null
	if top_view != null: top_view.visible = wave == null
	if top_front != null: top_front.visible = wave == null
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
		for view: BmkAurelionView in [aurelion_back,aurelion_view]:
			view.visible = wave != null
			view.session = wave
			view.queue_redraw()
		for view: BmkVargulView in [vargul_ground,vargul_view]:
			view.visible = wave != null
			view.session = wave
			view.refresh()
		for view: BmkSovereignView in [sovereign_ground,sovereign_view]:
			view.visible = wave != null
			view.session = wave
			view.refresh()
		sovereign_view.sync_fists(actors)
		rift_view.visible = wave != null
		rift_view.session = wave
		rift_view.sync(actors)
	if viesa_view != null:
		viesa_view.present(s)
		viesa_dim.session = s
		viesa_dim.queue_redraw()
		BmkViesaView.present_sigil(viesa_sigil,s,bank)
		# paintViesa(): drawLit brightens the whole body while flashing, including hurt.
		if s.player.is_viesa() and s.player.flash > 0 and show_flash: player_view.body.modulate = Color(1.8,1.8,1.8,player_view.body.modulate.a)
	# Items, Sovereign fists and rift eruptions joined the actor layer above.
	layer_actors()

func is_effect_node(node: Node2D) -> bool:
	return node is BmkRiftView.Eruption

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
	# drawSovereign() lights the body with gain 1.8 (drawLit), other bosses flash white.
	view.body.modulate = Color.WHITE * (1.8 if (e as BmkLegacyActor).type == "boss5" else 2.0) if e.flash > 0 and show_flash else (pose.get("tint",Color.WHITE) as Color if show_flash else Color.WHITE)
	view.body.modulate.a = float(pose["alpha"])
	var legacy: BmkLegacyActor = e as BmkLegacyActor
	if legacy.type == "boss4": vargul_view.attach(view,legacy)
	if legacy.type == "boss5": sovereign_view.attach(view,legacy)
	if legacy.boss:
		# drawEnemyOverlay(): the boss warning '!' above the head.
		var wave: BmkWaveSimulation = session as BmkWaveSimulation
		var warn: bool = false
		if legacy.type == "boss3" and legacy.st == "pat" and legacy.aurelion != null and not legacy.aurelion.current.is_empty() and legacy.aurelion.guard != "guard":
			var tele: Variant = wave.aurelion.moves[legacy.aurelion.move].get("telegraph")
			warn = tele != null and tele.get("warning_icon_frames") != null and BmkAurelionController.within([tele["warning_icon_frames"]],float(legacy.aurelion.current["source"])) and floori(legacy.pt / 110.0) % 2 == 0
		elif legacy.type == "boss4":
			warn = legacy.st == "pat" and bool(legacy.vargul.current.get("warning",false)) and floori(legacy.pt / 110.0) % 2 == 0
		elif legacy.type == "boss5":
			warn = wave.sovereign.warning(legacy) and floori(wave.tick * BmkSimulation.MS / 110.0) % 2 == 0
		elif legacy.type == "boss2":
			var startup: Variant = wave.morgra.data.move(legacy.morgra_move).get("phases",{}).get("startup")
			var tele_ms: float = (float(startup[1]) + 1) * BmkSimulation.MS if startup != null else 0.0
			warn = legacy.st == "wind" and legacy.t > 2 or legacy.st == "pat" and legacy.pt < tele_ms and floori(legacy.pt / 110.0) % 2 == 0
		var height: float = float(legacy.stats.get("h",legacy.d.height))
		view.alert.visible = warn and legacy.st != "dead"
		view.alert.text = "!"
		view.alert.position.y = -legacy.z - height - 24 - 30
		view.alert.add_theme_color_override("font_color",Color("ff3d3d"))
		view.alert.add_theme_font_size_override("font_size",26)

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
		if s is BmkWaveSimulation and (s as BmkWaveSimulation).vargul != null:
			# vargulDebugKey(): F10 = phase two (F3), F11 = 35% HP for the ultimate (F4).
			for actor: BmkActorState in s.enemies:
				var v: BmkLegacyActor = actor as BmkLegacyActor
				if v.type != "boss4": continue
				var w: BmkWaveSimulation = s as BmkWaveSimulation
				if key == KEY_F10:
					w.enemy_controller.reset_boss_fx(v,w)
					w.vargul.clear_hazards(w,v)
					v.phase_t = 0
					v.p2shown = true
					v.max_hp = 2500
					v.hp = 2500
					v.next_kd = 1875
					v.invulnerable = false
					v.inv = 0
					v.gr = 0
					v.gr_t = 0
					v.st = "chase"
					v.attack_cd = 20
					w.mode = "play"
					v.vargul.ultimate_used = false
					return
				if key == KEY_F11 and v.p2shown:
					v.hp = v.max_hp * 0.35
					v.attack_cd = 0
					v.vargul.cooldowns["ultimate"] = 0
					return
		if s is BmkWaveSimulation and (s as BmkWaveSimulation).sovereign != null:
			# Debug: F10 = phase two, F11 = 35% HP so the ultimate is due (like Vargul's F3/F4).
			var w: BmkWaveSimulation = s as BmkWaveSimulation
			for actor: BmkActorState in s.enemies:
				if not BmkSovereignController.is_sovereign(actor): continue
				var v: BmkLegacyActor = actor as BmkLegacyActor
				if key == KEY_F10 and not v.p2shown and v.st != "intro" and v.phase_t == 0:
					w.mode = "play"
					w.sovereign.begin_transition(w,v)
					return
				if key == KEY_F11 and v.p2shown:
					v.hp = v.max_hp * 0.35
					v.attack_cd = 0
					w.sovereign.state(v).cooldowns["ultimate"] = 0
					return
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
