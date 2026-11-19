extends SceneTree
## Phase 10 rendered integration: touch controls through the F5 game (menus, real touch events).
var game: BmkMenuGame
var failures: Array[String] = []
var checks: int = 0
const SETTINGS: String = "res://phase10/touch_test_settings.json"

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
	for child: Node in (container if container != null else game.menu.buttons).find_children("*","Button",true,false):
		if (child as Button).text == label:
			if container == null and game.menu.scroll != null:
				game.menu.scroll.ensure_control_visible(child as Control)
				await process_frame
				await process_frame
			await click_at((child as Button).get_global_rect().get_center())
			return
	failures.append("Missing button: " + label)

func touch(index: int, at: Vector2, pressed: bool) -> void:
	var event: InputEventScreenTouch = InputEventScreenTouch.new()
	event.index = index
	event.position = at
	event.pressed = pressed
	root.push_input(event)

func drag(index: int, at: Vector2) -> void:
	var event: InputEventScreenDrag = InputEventScreenDrag.new()
	event.index = index
	event.position = at
	root.push_input(event)

func center(id: String) -> Vector2:
	return game.touch.geometry(id)[0]

func capture(name_: String) -> void:
	game.present()
	game.touch._process(0)
	game.touch.queue_redraw()
	await process_frame
	await RenderingServer.frame_post_draw
	check(root.get_texture().get_image().save_png("res://evidence/%s.png" % name_) == OK,"Capture " + name_)

func wave() -> BmkWaveSimulation:
	return game.session as BmkWaveSimulation

func tick(n: int) -> void:
	for i: int in range(n): game._physics_process(BmkSimulation.MS / 1000.0)

## A Stage 2 arena with one passive soldier, identical for every run.
func arena(character: String = "barel") -> BmkWaveSimulation:
	game.game_mode = "story"
	game.character_id = character
	game.stage_index = 1
	game.stage_restored = false
	game.boss_challenge = false
	seed(7)
	game.restart()
	game.menu.visible = false
	game.pause_game(false)
	var s: BmkWaveSimulation = wave()
	s.fixed_random = true
	s.mode = "play"
	s.banner_t = 0
	s.tick = 0
	s.barrels.clear()
	s.enemies.clear()
	s.player.x = 300
	s.player.y = 430
	s.player.inv = 0
	s.wave_idx = (s.stage["waves"] as Array).size()
	s.cam_lock = true
	s.lock_at = 0
	var e: BmkActorState = s.spawn("grunt",420,430)
	e.wait = 100000
	e.attack_cd = 100000
	game.touch._process(0)
	return s

func snapshot(s: BmkWaveSimulation) -> String:
	var p: BmkActorState = s.player
	var enemies: Array = []
	for e: BmkActorState in s.enemies: enemies.append([e.x,e.y,e.hp,e.st,e.t])
	return JSON.stringify([s.tick,p.x,p.y,p.z,p.vx,p.vz,p.face,p.st,p.t,p.hp,p.sp,p.combo,p.skill,p.atk,p.inv,p.dash_cd,enemies])

## The browser lever/pad semantics for SCRIPT, written as the equivalent keyboard events.
const SCRIPT: Array = [
	[3,"down",1,"stick",Vector2(60,0)],[20,"move",1,"stick",Vector2(55,-45)],[30,"move",1,"stick",Vector2(-60,5)],
	[36,"down",2,"KeyJ",Vector2.ZERO],[38,"up",2],[44,"up",1],
	[50,"down",1,"stick",Vector2(60,0)],[52,"up",1],[56,"down",1,"stick",Vector2(60,0)],[58,"up",1],
	[70,"down",3,"Space",Vector2.ZERO],[72,"down",4,"Space",Vector2.ZERO],[74,"up",3],[80,"up",4],
	[90,"down",5,"KeyU",Vector2.ZERO],[92,"up",5],
	[110,"down",6,"KeyJ",Vector2.ZERO],[111,"up",6],[114,"down",6,"KeyJ",Vector2.ZERO],[115,"up",6],
	[130,"down",7,"ShiftLeft",Vector2.ZERO],[132,"up",7]]
const KEYS: Array = [
	[3,"KeyD",true],[20,"KeyW",true],[30,"KeyA",true],[30,"KeyD",false],[30,"KeyW",false],
	[36,"KeyJ",true],[38,"KeyJ",false],[44,"KeyA",false],
	[50,"KeyD",true],[52,"KeyD",false],[56,"KeyD",true],[58,"KeyD",false],
	[70,"Space",true],[80,"Space",false],[90,"KeyU",true],[92,"KeyU",false],
	[110,"KeyJ",true],[111,"KeyJ",false],[114,"KeyJ",true],[115,"KeyJ",false],[130,"ShiftLeft",true],[132,"ShiftLeft",false]]

func run_touch() -> Array[String]:
	var s: BmkWaveSimulation = arena()
	var trace: Array[String] = []
	for frame: int in range(160):
		game.touch._process(0)
		for ev: Array in SCRIPT:
			if int(ev[0]) != frame: continue
			if ev[1] == "up": touch(int(ev[2]),Vector2.ZERO,false)
			else:
				var at: Vector2 = center(str(ev[3])) + (ev[4] as Vector2)
				if ev[1] == "down": touch(int(ev[2]),at,true)
				else: drag(int(ev[2]),at)
		if frame == 74: check(s.input.held.get("Space",false),"A second finger keeps a shared button held")
		if frame == 56: check(s.input.dash_request == 1,"Two lever flicks request a dash")
		tick(1)
		trace.append(snapshot(s))
	return trace

func run_keys() -> Array[String]:
	var s: BmkWaveSimulation = arena()
	var trace: Array[String] = []
	for frame: int in range(160):
		for ev: Array in KEYS:
			if int(ev[0]) != frame: continue
			if bool(ev[2]): s.input.press(str(ev[1]),s.tick)
			else: s.input.release(str(ev[1]))
		tick(1)
		trace.append(snapshot(s))
	return trace

func run() -> void:
	game = load("res://phase4/game.tscn").instantiate() as BmkMenuGame
	root.add_child(game)
	game.capture_mode = true
	game.set_physics_process(false)
	game.save_store.checkpoint_path = "res://phase10/touch_test_checkpoint.json"
	game.save_store.records_path = "res://phase10/touch_test_records.json"
	game.preferences.storage_path = SETTINGS
	game.preferences.use_preset("arcade")
	game.preferences.touch = false
	game.preferences.touch_layout = BmkTouchLayout.defaults()
	game.apply_preferences()
	game.save_store.write_json(game.save_store.checkpoint_path,null)
	game.save_store.write_json(game.save_store.records_path,{"bestScore":0,"stages":[]})
	await process_frame
	check(not game.touch.visible,"Touch controls hidden on the title")
	# Settings: enable touch controls with the menu.
	await click_button("설정")
	await click_button("모바일 조작 키: 꺼짐")
	check(game.preferences.touch and BmkSettings.read(SETTINGS).touch,"Touch option saved")
	await click_button("모바일 키 투명도: 45%")
	check(is_equal_approx(float(game.preferences.touch_layout["alpha"]),0.45),"Transparency steps by 10%")
	for value: int in [55,65,75]: await click_button("모바일 키 투명도: %d%%" % value)
	await click_button("모바일 키 투명도: 85%")
	check(is_equal_approx(float(game.preferences.touch_layout["alpha"]),1.0),"Transparency wraps from 90% to 0%")
	await click_button("모바일 키 크기: 100%")
	check(is_equal_approx(float(game.preferences.touch_layout["scale"]),1.1),"Size steps by 10%")
	await click_button("모바일 키 초기화")
	check(is_equal_approx(float(game.preferences.touch_layout["scale"]),1.0) and (game.preferences.touch_layout["items"] as Dictionary).is_empty(),"Layout reset to defaults")
	await click_button("뒤로")
	# Story start: hidden during the stage banner, shown in play, pause button present.
	await click_button("새 게임")
	await click_button("바렐로 시작")
	await process_frame
	check(game.touch.visible == ((game.session as BmkStageSimulation).mode == "play"),"Hidden while the stage banner/intro runs")
	var guard: int = 0
	while (game.session as BmkStageSimulation).mode != "play" and guard < 400:
		tick(1)
		guard += 1
	tick(1)
	await process_frame
	check(game.touch.visible and game.pause_button.visible,"Shown in play with the pause button")
	await click_at(game.pause_button.get_global_rect().get_center())
	check(game.menu.visible and game.menu.mode == "pause" and game.clock.paused,"Pause button opens the pause menu")
	game.present()
	await process_frame
	check(not game.touch.visible and not game.pause_button.visible,"Hidden while paused")
	await click_button("계속하기")
	# Canonical inputs: the touch script and its keyboard equivalent give identical traces.
	var by_touch: Array[String] = run_touch()
	var by_keys: Array[String] = run_keys()
	var first: int = -1
	for i: int in range(by_touch.size()):
		if by_touch[i] != by_keys[i]:
			first = i
			break
	check(first == -1,"Touch trace equals keyboard trace (first difference at frame %d)" % first)
	check(by_touch.size() == 160 and by_touch[0] != by_touch[159],"Trace covers movement and actions")
	# Focus loss cancels fingers and keys; the stale finger's release changes nothing.
	var s: BmkWaveSimulation = arena()
	touch(1,center("stick") + Vector2(60,0),true)
	touch(2,center("KeyJ"),true)
	check(s.input.held.get("KeyD",false) and s.input.held.get("KeyJ",false),"Lever and attack held together")
	game.capture_mode = false
	game._notification(Node.NOTIFICATION_APPLICATION_FOCUS_OUT)
	game.capture_mode = true
	check(game.clock.paused and game.menu.visible,"Focus loss pauses")
	check(not s.input.held.get("KeyD",false) and not s.input.held.get("KeyJ",false) and game.touch.touches.is_empty() and game.touch.stick_id == BmkTouchControls.NO_POINTER,"Focus loss clears touches and keys")
	game.resume_from_menu()
	game.touch._process(0)
	touch(1,Vector2.ZERO,false)
	touch(2,Vector2.ZERO,false)
	check(s.input.held.values().all(func(v: bool) -> bool: return not v),"Stale finger release is harmless")
	touch(3,center("KeyJ"),true)
	check(s.input.held.get("KeyJ",false),"New finger works after resume")
	# Leaving play (boss intro) releases the held buttons like lostpointercapture.
	s.mode = "bossintro"
	game.touch._process(0)
	check(not game.touch.visible and not s.input.held.get("KeyJ",false),"Hiding releases held buttons")
	s.mode = "play"
	game.touch._process(0)
	touch(3,Vector2.ZERO,false)
	# Touch outside the controls passes through untouched.
	touch(9,Vector2(480,200),true)
	check(game.touch.touches.is_empty() and game.touch.stick_id == BmkTouchControls.NO_POINTER,"Touches outside the controls are ignored")
	touch(9,Vector2(480,200),false)
	await capture("phase10_play")
	# Layout editor from the pause menu settings.
	game.pause_game(true)
	game.menu.show_pause()
	await click_button("설정")
	await click_button("모바일 키 배치 편집")
	await process_frame
	check(game.touch.editing and game.touch.visible and not game.menu.visible,"Layout editor opens over the game")
	var u: float = game.touch.unit()
	var start: Vector2 = center("KeyJ")
	touch(1,start,true)
	drag(1,start + Vector2(-u,-u * 0.5))
	touch(1,Vector2.ZERO,false)
	var it: Dictionary = game.touch.item("KeyJ")
	check(is_equal_approx(float(it["dx"]),-1.0) and is_equal_approx(float(it["dy"]),-0.5),"Dragging moves a control in --u units")
	check(s.input.held.values().all(func(v: bool) -> bool: return not v),"Editing never presses actions")
	await click_button("+",game.touch.edit_bar)
	check(is_equal_approx(float(game.touch.item("KeyJ")["k"]),1.1),"+ grows the selected control")
	touch(1,center("KeyL"),true)
	touch(1,Vector2.ZERO,false)
	check(game.touch.selected == "KeyL","Tap selects a control")
	await click_button("숨기기",game.touch.edit_bar)
	check(bool(game.touch.item("KeyL")["hide"]),"Hide marks the control hidden")
	check(game.touch.edit_hide.text == "보이기","Hide button turns into show")
	var stick: Vector2 = center("stick")
	touch(1,stick,true)
	drag(1,stick + Vector2(-600,0))
	touch(1,Vector2.ZERO,false)
	var g: Array = game.touch.geometry("stick")
	check(is_equal_approx((g[0] as Vector2).x - float(g[1]),0.0),"Controls are kept on screen")
	await capture("phase10_editing")
	await click_button("완료",game.touch.edit_bar)
	check(not game.touch.editing and game.menu.visible and game.menu.mode == "settings","Done returns to the settings")
	var stored: BmkSettings = BmkSettings.read(SETTINGS)
	var stored_items: Dictionary = stored.touch_layout["items"]
	check(is_equal_approx(float(stored_items.get("KeyJ",{}).get("k",0)),1.1) and bool(stored_items.get("KeyL",{}).get("hide",false)),"Layout persisted: %s" % JSON.stringify(stored_items))
	await click_button("뒤로")
	await click_button("계속하기")
	game.touch._process(0)
	touch(4,center("KeyL"),true)
	check(not s.input.held.get("KeyL",false),"Hidden controls cannot be pressed")
	touch(4,Vector2.ZERO,false)
	# Esc also ends editing.
	game.touch.start_edit()
	game._unhandled_input(key_event(KEY_ESCAPE))
	check(not game.touch.editing,"Esc ends the layout editor")
	game.menu.visible = false
	game.pause_game(false)
	# Saved layout validation.
	game.save_store.write_json(SETTINGS,{"touch":true,"touch_layout":{"alpha":5,"scale":1.2,"items":{"KeyJ":{"dx":100,"dy":0,"k":1},"KeyU":{"dx":2,"dy":-1,"k":1.5,"hide":true},"bogus":{"dx":0,"dy":0,"k":1}}}})
	var loaded: BmkSettings = BmkSettings.read(SETTINGS)
	check(is_equal_approx(float(loaded.touch_layout["alpha"]),0.55) and is_equal_approx(float(loaded.touch_layout["scale"]),1.2),"Invalid alpha rejected, valid size kept")
	check(not (loaded.touch_layout["items"] as Dictionary).has("KeyJ") and not (loaded.touch_layout["items"] as Dictionary).has("bogus") and bool(loaded.touch_layout["items"]["KeyU"]["hide"]),"Only valid control entries are kept")
	# iPhone 12/13 mini profile: default layout and safe insets; other screens use env insets.
	game.preferences.touch_layout = BmkTouchLayout.defaults()
	BmkTouchLayout.force_mini = true
	game.touch.test_window = Vector2(812,375)
	check(BmkTouchLayout.defaults() == BmkTouchLayout.MINI["layout"],"Mini screens default to the approved layout")
	var k: float = minf(812.0 / 960,375.0 / 540)
	check(is_equal_approx(game.touch.unit(),46.875 / k),"--u from 12.5vmin on the mini screen")
	var mini_stick: Array = game.touch.geometry("stick")
	var expected_bottom: float = maxf(18 / k,21 / k)
	check(is_equal_approx((mini_stick[0] as Vector2).y,540 - expected_bottom - 1.45 * game.touch.unit()),"Mini bottom inset lifts the lever")
	game.touch.test_insets = {"left":120.0,"right":0.0,"top":0.0,"bottom":0.0}
	var bar: float = (812 - 960 * k) / 2
	check(is_equal_approx((game.touch.geometry("stick")[0] as Vector2).x - 1.45 * game.touch.unit(),(120 - bar) / k),"A larger device inset wins over the profile")
	BmkTouchLayout.force_mini = false
	game.touch.test_insets = {}
	check(BmkTouchLayout.defaults()["items"].is_empty(),"Other screens start from the plain layout")
	BmkTouchLayout.force_mini = null
	game.touch.test_window = Vector2.ZERO
	await compare_with_source()
	for path: String in [game.save_store.checkpoint_path,game.save_store.records_path,SETTINGS]:
		DirAccess.remove_absolute(ProjectSettings.globalize_path(path))
	print("TOUCH CONTROLS: %d checks; %d failures" % [checks,failures.size()])
	for failure: String in failures: push_error(failure)
	game.queue_free()
	await process_frame
	quit(0 if failures.is_empty() else 1)

func key_event(code: Key) -> InputEventKey:
	var event: InputEventKey = InputEventKey.new()
	event.keycode = code
	event.pressed = true
	return event

## Same scenes as tools/oracle/phase10_source_capture.cjs (phase10/fixtures/touch_scenes.json).
func compare_with_source() -> void:
	var scenes: Array = JSON.parse_string(FileAccess.get_file_as_string("res://phase10/fixtures/touch_scenes.json"))
	for spec: Dictionary in scenes:
		if game.touch.editing: game.touch.end_edit()
		var s: BmkWaveSimulation = arena(str(spec["character"]))
		s.enemies.clear()
		s.player.sp = float(spec["sp"])
		s.player.mg = int(spec["mg"])
		for id: String in spec.get("cooldowns",{}): s.player.skill_cd[id] = float(spec["cooldowns"][id])
		game.preferences.touch_layout = BmkTouchLayout.validate(spec.get("layout",{"alpha":0.55,"scale":1,"items":{}}))
		game.touch.clear_touch()
		game.touch._process(0)
		for t: Dictionary in spec.get("touches",[]):
			var at: Vector2 = center(str(t["id"]))
			touch(int(t["pointer"]),at,true)
			if t.has("dx") or t.has("dy"): drag(int(t["pointer"]),at + Vector2(float(t.get("dx",0)),float(t.get("dy",0))))
		if bool(spec.get("edit",false)): game.touch.start_edit()
		game.menu.visible = false
		await capture("phase10_compare_" + str(spec["id"]))
		for pointer: int in game.touch.touches.keys().duplicate(): touch(pointer,Vector2.ZERO,false)
		if game.touch.stick_id != BmkTouchControls.NO_POINTER: touch(game.touch.stick_id,Vector2.ZERO,false)
	if game.touch.editing: game.touch.end_edit()
