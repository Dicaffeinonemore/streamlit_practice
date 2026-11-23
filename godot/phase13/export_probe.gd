extends Node
## Phase 13 exported-build probe. Export templates ignore --script, so the F5 game attaches this
## node itself when started with --export-probe=… and the file is in the pack (Windows preset only;
## Web, Android and iOS exclude it). It drives the game with input events, writes a JSON report and
## leaves through the game's own quit path.
##
##   BlackMoonKnight.exe -- --export-probe=write --out=<dir>
##   BlackMoonKnight.exe -- --export-probe=read  --out=<dir>
##
## write: title → 새 게임 → 비에사로 시작 → 게임 시작 (Enter) → opening skipped → Stage 1; sound off (M).
## read (a second process): 이어하기 is offered, sound is still off, Continue restores Viesa in Stage 1.
## The caller backs up and restores the real user:// saves; this probe writes them for real.
var game: BmkMenuGame
var checks: Array = []
var mode: String = ""
var out_dir: String = ""
var root: Window
## Button centres per screen (960 x 540 space), reused by the Web check to click the same buttons.
var layout: Dictionary = {}

func _ready() -> void:
	game = get_parent() as BmkMenuGame
	root = get_tree().root
	for arg: String in OS.get_cmdline_user_args():
		if arg.begins_with("--export-probe="): mode = arg.get_slice("=",1)
		if arg.begins_with("--out="): out_dir = arg.get_slice("=",1)
	run.call_deferred()

func check(value: bool, label: String) -> void:
	checks.append({"ok":value,"label":label})
	if not value: print("FAIL: " + label)

func frames(n: int) -> void:
	for i: int in range(n): await get_tree().process_frame

func click_at(point: Vector2) -> void:
	for pressed: bool in [true,false]:
		var event: InputEventMouseButton = InputEventMouseButton.new()
		event.button_index = MOUSE_BUTTON_LEFT
		event.position = point
		event.global_position = point
		event.pressed = pressed
		root.push_input(event)
	await frames(2)

func find_button(label: String) -> Button:
	for child: Node in game.menu.find_children("*","Button",true,false):
		var b: Button = child as Button
		if b.text == label and b.is_visible_in_tree(): return b
	return null

func click_button(label: String) -> void:
	await frames(2)
	var b: Button = find_button(label)
	check(b != null,"Button exists: " + label)
	if b == null: return
	if game.menu.scroll.is_ancestor_of(b):
		game.menu.scroll.ensure_control_visible(b)
		await frames(2)
	await click_at(b.get_global_rect().get_center())

func key(code: Key) -> void:
	for pressed: bool in [true,false]:
		var event: InputEventKey = InputEventKey.new()
		event.keycode = code
		event.physical_keycode = code
		event.pressed = pressed
		root.push_input(event)
	await frames(2)

func record_layout(screen: String) -> void:
	await frames(2)
	var centres: Dictionary = {}
	for child: Node in game.menu.find_children("*","Button",true,false):
		var b: Button = child as Button
		if b.is_visible_in_tree():
			var c: Vector2 = b.get_global_rect().get_center()
			centres[b.text] = [roundi(c.x),roundi(c.y)]
	layout[screen] = centres

func capture(name_: String) -> void:
	await frames(3)
	await RenderingServer.frame_post_draw
	var image: Image = root.get_texture().get_image()
	check(image != null and image.save_png(out_dir.path_join(name_ + ".png")) == OK,"Capture " + name_)

func environment() -> Dictionary:
	return {
		"os":OS.get_name(),
		"features":["template","release","debug","web","windows","android","ios","pc","mobile"].filter(func(f: String) -> bool: return OS.has_feature(f)),
		"editor":OS.has_feature("editor"),
		"display_driver":DisplayServer.get_name(),
		"rendering_driver":RenderingServer.get_current_rendering_driver_name(),
		"audio_driver":AudioServer.get_driver_name(),
		"mix_rate":AudioServer.get_mix_rate(),
		"window":[DisplayServer.window_get_size().x,DisplayServer.window_get_size().y],
		"viewport":[root.get_visible_rect().size.x,root.get_visible_rect().size.y],
		"stretch":[ProjectSettings.get_setting("display/window/stretch/mode"),ProjectSettings.get_setting("display/window/stretch/scale_mode")],
		"texture_filter":int(ProjectSettings.get_setting("rendering/textures/canvas_textures/default_texture_filter")),
		"physics_ticks":Engine.physics_ticks_per_second,
		"user_dir":OS.get_user_data_dir(),
	}

func run() -> void:
	check(OS.has_feature("template") and not OS.has_feature("editor"),"Running in an exported template, not the editor")
	await frames(10)
	check(game.menu.visible and game.menu.mode == "title","The title screen opens")
	check(root.get_visible_rect().size == Vector2(960,540),"The game renders at 960 x 540")
	check(int(ProjectSettings.get_setting("rendering/textures/canvas_textures/default_texture_filter")) == 0,"Nearest-neighbour sampling")
	check(AudioServer.get_driver_name() != "Dummy","A real audio driver is active")
	check(find_button(game.menu.title_image.caption("Exit")) != null,"Exit is on the title")
	if mode == "write": await write_pass()
	elif mode == "read": await read_pass()
	else: check(false,"Unknown --probe mode")
	var failures: int = checks.filter(func(c: Dictionary) -> bool: return not c["ok"]).size()
	var report: FileAccess = FileAccess.open(out_dir.path_join("probe_%s.json" % mode),FileAccess.WRITE)
	report.store_string(JSON.stringify({"mode":mode,"failures":failures,"checks":checks,"layout":layout,"environment":environment()},"  "))
	report.close()
	print("PROBE %s: %d checks, %d failures" % [mode.to_upper(),checks.size(),failures])
	# Leave through the game's own path (title 종료 where it exists, otherwise request_close).
	if mode == "read" and BmkPlatform.can_quit() and find_button(game.menu.title_image.caption("Exit")) != null: await click_button(game.menu.title_image.caption("Exit"))
	else: game.request_close()

func write_pass() -> void:
	check(find_button(game.menu.title_image.caption("Continue")) != null and find_button(game.menu.title_image.caption("Continue")).disabled,"No checkpoint before the first run")
	check(game.audio.enabled,"Sound starts on")
	await capture("title")
	await record_layout("title")
	await click_button(game.menu.title_image.caption("Options"))
	await record_layout("settings")
	await click_button("돌아가기")
	check(game.menu.mode == "title","Settings → 뒤로 returns to the title")
	await click_button(game.menu.title_image.caption("New Game"))
	await record_layout("characters")
	await click_button("비에사로 시작")
	check(game.menu.mode == "tutorial" and game.demo.on and game.demo.character == "viesa","Character select opens Viesa's tutorial")
	await frames(30)
	await capture("tutorial")
	await key(KEY_ENTER)
	check(game.menu.mode == "opening","게임 시작 (Enter) plays the opening")
	await frames(20)
	await key(KEY_ESCAPE)
	await frames(10)
	check(not game.menu.visible and game.game_mode == "story" and game.session.player.character_id == "viesa","Stage 1 starts with Viesa")
	var checkpoint: Variant = JSON.parse_string(FileAccess.get_file_as_string("user://bmk_checkpoint.json"))
	check(checkpoint is Dictionary and str((checkpoint as Dictionary).get("characterId",(checkpoint as Dictionary).get("character_id",""))) == "viesa","The stage-entry checkpoint is on disk")
	var start_tick: int = game.session.tick
	var start_ms: int = Time.get_ticks_msec()
	await get_tree().create_timer(1.0).timeout
	var ticks: int = game.session.tick - start_tick
	var seconds: float = (Time.get_ticks_msec() - start_ms) / 1000.0
	check(absf(ticks / seconds - 60.0) < 6.0,"The simulation runs at 60 ticks/s (%d ticks in %.2f s)" % [ticks,seconds])
	await key(KEY_RIGHT)
	await capture("stage1")
	await key(KEY_M)
	check(not game.audio.enabled,"M turns the sound off")
	var audio_pref: Variant = JSON.parse_string(FileAccess.get_file_as_string("user://bmk_audio.json"))
	check(audio_pref is Dictionary and (audio_pref as Dictionary).get("sound") == "off","The sound preference is on disk")

func read_pass() -> void:
	var continue_button: Button = find_button(game.menu.title_image.caption("Continue"))
	check(continue_button != null and not continue_button.disabled,"이어하기 is offered after a restart")
	check(not game.audio.enabled,"The sound stays off after a restart")
	await click_button(game.menu.title_image.caption("Continue"))
	await get_tree().create_timer(1.0).timeout
	check(not game.menu.visible and game.game_mode == "story" and game.stage_index == 0 and game.session.player.character_id == "viesa","Continue restores Viesa in Stage 1")
	await capture("continue")
	await key(KEY_M)
	check(game.audio.enabled,"M turns the sound back on")
	await key(KEY_ESCAPE)
	check(game.menu.visible and game.menu.mode == "pause","Esc pauses")
	game.pause_game(true)
	game.menu.show_title()
	await frames(5)
