extends SceneTree
var game: BmkVerticalSlice
var failures: Array[String] = []
var checks: int = 0

func _initialize() -> void:
	call_deferred("run")

func check(condition: bool, label: String) -> void:
	checks += 1
	if not condition:
		failures.append(label)
		push_error(label)

func key(code: Key, pressed: bool = true) -> void:
	var event: InputEventKey = InputEventKey.new()
	event.keycode = code
	event.physical_keycode = code
	event.pressed = pressed
	game._unhandled_input(event)

func ticks(count: int) -> void:
	for i: int in range(count):
		game._physics_process(1.0 / 60.0)

func capture(name_: String) -> void:
	game.present()
	await process_frame
	await process_frame
	await RenderingServer.frame_post_draw
	var result: Error = root.get_texture().get_image().save_png("res://evidence/phase2_" + name_ + ".png")
	check(result == OK,"Capture " + name_)

func run() -> void:
	game = load("res://phase2/vertical_slice.tscn").instantiate() as BmkVerticalSlice
	root.add_child(game)
	game.capture_mode = true
	game.set_physics_process(false)
	game.audio.toggle()
	await capture("street")
	key(KEY_RIGHT)
	ticks(10)
	key(KEY_RIGHT,false)
	check(absf(game.session.player.x - 111.0) < 0.000001,"Default physical arrows move Barel")
	key(KEY_Z)
	ticks(1)
	key(KEY_Z,false)
	check(game.session.player.st == "atk","Default physical Z attacks")
	key(KEY_ESCAPE)
	var paused_tick: int = game.session.tick
	ticks(10)
	check(game.session.tick == paused_tick,"Escape pauses simulation")
	key(KEY_ESCAPE)
	ticks(40)
	key(KEY_X)
	ticks(1)
	key(KEY_X,false)
	check(game.session.player.vz > 0,"Default physical X jumps")
	key(KEY_R)
	check(game.session.tick == 0 and game.session.player.x == 80,"R restarts the first section")
	key(KEY_F1)
	key(KEY_D)
	ticks(10)
	key(KEY_D,false)
	check(game.physical.preset == "wasd" and game.session.player.x > 80,"F1 uses the original WASD preset")
	key(KEY_F1)
	key(KEY_R)
	game.session.stage_driver = Callable()
	game.session.player.x = 300
	game.session.player.inv = 0
	var axe: BmkActorState = game.session.spawn("axe",365,430)
	var club: BmkActorState = game.session.spawn("club",510,448)
	var blade: BmkActorState = game.session.spawn("blade",180,415)
	for e: BmkActorState in [axe,club,blade]:
		game.session.enemy_controller.begin_move(game.session,e,"atk1" if e.species == "blade" else "attack")
	ticks(12)
	key(KEY_F9)
	check(game.debug_view.visible,"F9 toggles collision debug")
	await capture("telegraphs")
	key(KEY_F2)
	check(game.session.player.sp == 100 and game.session.player.mg == 3,"Visible debug allows special and magic verification")
	key(KEY_C)
	ticks(1)
	key(KEY_C,false)
	check(game.session.player.st == "special","Default physical C starts a full-SP special")
	ticks(50)
	await capture("special")
	key(KEY_R)
	game.session.stage_driver = Callable()
	game.session.player.x = 280
	game.session.player.inv = 0
	var target: BmkActorState = game.session.spawn("axe",342,430)
	target.training = true
	key(KEY_Z)
	ticks(10)
	key(KEY_Z,false)
	check(target.hp < target.max_hp,"Native scene attack reaches the original collision resolver")
	await capture("combo")
	var skill_keys: Array[Key] = [KEY_S,KEY_D,KEY_Q,KEY_W,KEY_E]
	var skill_ids: Array[String] = ["thrust","slam","whirl","leap","redwave"]
	for i: int in range(skill_keys.size()):
		game.restart()
		game.session.stage_driver = Callable()
		key(skill_keys[i])
		ticks(1)
		key(skill_keys[i],false)
		check(game.session.player.st == "skill" and game.session.player.skill == skill_ids[i],"Default physical skill " + skill_ids[i])
	game.restart()
	game.session.player.mg = 1
	key(KEY_A)
	ticks(1)
	key(KEY_A,false)
	check(game.session.player.st == "cast","Default physical A casts stocked magic")
	game.restart()
	key(KEY_SHIFT)
	ticks(8)
	key(KEY_SHIFT,false)
	check(game.session.player.st == "dash","Default physical Shift dashes")
	key(KEY_Z)
	ticks(1)
	key(KEY_Z,false)
	check(game.session.player.st == "dash_attack","Default physical Z links into dash attack")
	game.restart()
	game.session.player.lives = 1
	game.session.player.inv = 0
	game.session.combat.hurt_player(game.session,200,1,true)
	ticks(150)
	check(game.session.game_over,"Final life reaches game over")
	game.restart()
	for i: int in range(750):
		for e: BmkActorState in game.session.enemies:
			if e.st != "dead":
				e.st = "dead"
				e.hp = 0
				e.t = 0
		game.session.player.inv = 10000
		game.session.input.held["KeyD"] = true
		ticks(1)
	check(game.section.event_index == 2 and game.section.complete,"Two source wave queues reach the section boundary")
	var report: FileAccess = FileAccess.open("res://evidence/phase2-integration.json",FileAccess.WRITE)
	report.store_string(JSON.stringify({"checks":checks,"failures":failures},"\t"))
	print("INTEGRATION: %d checks; %d failures" % [checks,failures.size()])
	game.queue_free()
	await process_frame
	quit(0 if failures.is_empty() else 1)
