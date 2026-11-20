extends SceneTree
var game: BmkStageGame
var failures: Array[String] = []
var checks: int = 0

func _initialize() -> void:
	call_deferred("run")

func check(value: bool, label: String) -> void:
	checks += 1
	if not value:
		failures.append(label)
		push_error(label)

func ticks(n: int) -> void:
	for i: int in range(n): game._physics_process(1.0 / 60.0)

func capture(id: String) -> void:
	var inv: int = game.session.player.inv
	# The test uses permanent invulnerability while setting up scenes; show the pose.
	game.session.player.inv = 0
	game.present()
	await process_frame
	await process_frame
	await RenderingServer.frame_post_draw
	check(root.get_texture().get_image().save_png("res://evidence/phase3_" + id + ".png") == OK,"Capture " + id)
	game.session.player.inv = inv

func run() -> void:
	game = load("res://phase3/stage_game.tscn").instantiate() as BmkStageGame
	root.add_child(game)
	game.set_physics_process(false)
	game.capture_mode = true
	game.audio.enable(false) # mute for capture without changing the saved preference
	await capture("street")
	for idx: int in range(1,4):
		game.start_section = idx
		game.restart()
		var s: BmkStageSimulation = game.session as BmkStageSimulation
		s.player.inv = 10000
		s.input.held["KeyD"] = true
		for i: int in range(400):
			ticks(1)
			if s.sections.locked: break
		s.input.held.clear()
		ticks(95 if idx == 1 else 45)
		check(s.sections.idx == idx and not s.enemies.is_empty(),"Section %d loads original routes and enemies" % (idx + 1))
		if idx == 1:
			check((s.enemies[0] as BmkStageActor).molotov,"Market includes molotov thrower")
			check(not s.fire_hazards.is_empty(),"Market produces real fire hazards")
		if idx == 2: check(s.walk_top == 420,"Kennel uses the source narrow lane")
		if idx == 3: check(s.sections.wall_broken,"Plaza wall breaks before heavy soldier enters")
		await capture(["street","market","kennel","plaza"][idx])
		if idx == 3:
			for actor: BmkActorState in s.enemies:
				actor.st = "dead"
				actor.hp = 0
				actor.t = 0
			ticks(45)
			for i: int in range(2):
				s.player.x = float(s.sections.background["marks"]["gateLeft"]) - 40
				ticks(1)
			check(s.sections.gate_t == 40,"Plaza gate opens after the wall fight")
			await capture("gate")
	game.start_section = 4
	game.restart()
	var s: BmkStageSimulation = game.session as BmkStageSimulation
	s.fixed_random = true
	ticks(445)
	check(s.mode == "bossintro","Arena uses the table intro")
	await capture("intro")
	ticks(120)
	check(s.mode == "play","Table intro releases control")
	var e: BmkStageActor = s.gorath.boss(s)
	check(e != null and e.hp == 385,"Gorath begins with source phase 1 HP")
	s.combat.damage_enemy(s,e,1000,false,2,false,"c3")
	ticks(58)
	await capture("transform")
	ticks(90)
	check(e.g2.phase == 2 and e.max_hp == 420,"Gorath transformation refills phase 2 HP")
	s.player.inv = 10000
	s.gorath.cancel(s,e)
	s.gorath.actions.start_ult(s,e)
	ticks(125)
	check(e.g2.guard and not e.g2.meats.is_empty(),"Ultimate schedules source falling meat and guard")
	await capture("ultimate")
	ticks(60)
	await capture("meat_landing")
	ticks(440)
	check(not e.g2.guard,"Ultimate releases guard after recovery")
	e.g2.ult = [true,true]
	e.invulnerable = false
	s.combat.damage_enemy(s,e,10000,false,2,false,"c3")
	check(e.st == "dead","Second phase can be defeated")
	ticks(600)
	check(s.mode == "clear","Death, remains and victory reach stage completion")
	await capture("clear")
	game.start_section = 0
	game.restart()
	s = game.session as BmkStageSimulation
	s.fixed_random = true
	s.progression_enabled = false
	var b: BmkWorldItem = s.barrels[0]
	s.player.x = b.x - 75
	s.player.y = b.y
	for i: int in range(2):
		s.player_controller.start_attack(s,0)
		ticks(40)
	check(s.barrels.is_empty(),"Original two-hit barrel breaks")
	check(not s.items.is_empty(),"Barrel drops an original item")
	if not s.items.is_empty():
		var item: BmkWorldItem = s.items[0]
		s.player.x = item.x
		s.player.y = item.y
		s.player.hp = 40
		ticks(35)
		check(s.items.is_empty(),"Grounded item is collected")
	var report: FileAccess = FileAccess.open("res://evidence/phase3-integration.json",FileAccess.WRITE)
	report.store_string(JSON.stringify({"checks":checks,"failures":failures},"\t"))
	print("STAGE INTEGRATION: %d checks; %d failures" % [checks,failures.size()])
	game.queue_free()
	await process_frame
	quit(0 if failures.is_empty() else 1)
