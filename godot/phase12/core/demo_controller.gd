class_name BmkDemoController
extends RefCounted
## demo-runtime.js DEMO: the tutorial demonstration. A scripted character fights a training dummy
## through the real simulation, one demo step per source tick.
##
## The source swaps the global game state out (demoSave) and back in (demoRestore). Here the demo
## runs in its own session; the live session is never stepped or changed, and the game puts its
## reference back when the tutorial closes (BmkMenuGame.close_tutorial()).
signal step_changed(index: int)
signal lights_changed

const MS: float = 1000.0 / 60.0
var on: bool = false
var paused: bool = false
## DEMO.i, DEMO.t (ms), DEMO.after (idle ms after the script), DEMO.end (last release ms).
var index: int = 0
var t: float = 0.0
var after: float = 0.0
var end: float = 0.0
## DEMO.events: {code, at, up, down, released}.
var events: Array[Dictionary] = []
## DEMO.lit: actions the script is holding (key highlighting).
var lit: Dictionary[String, bool] = {}
var character: String = "barel"
var steps: Array = []
var session: BmkWaveSimulation
var stage_config: BmkStageData
## Tests use the source's fixed Math.random (0.5).
var fixed_random: bool = false

## demoStart(from): origin is the session the tutorial was opened over (the paused run, or the
## last stage left behind at the title). Its stage and camera give the demo its backdrop.
func start(character_id: String, origin: BmkStageSimulation = null) -> BmkWaveSimulation:
	if on: stop()
	on = true
	paused = false
	character = character_id if BmkDemoSteps.STEPS.has(character_id) else "barel"
	steps = BmkDemoSteps.STEPS[character]
	if stage_config == null: stage_config = load("res://phase3/generated/stage.res") as BmkStageData
	session = make_session(origin)
	step_to(0)
	return session

## A wave-stage session for the dummy (mkEnemy('grunt') is the shared soldier code in every
## stage). Stage 1 keeps its street backdrop and section; Stages 2-5 keep their own.
func make_session(origin: BmkStageSimulation) -> BmkWaveSimulation:
	var wave_origin: BmkWaveSimulation = origin as BmkWaveSimulation
	var s: BmkWaveSimulation
	if wave_origin != null and not wave_origin.stage1_view:
		s = BmkWaveSimulation.new(stage_config,null,wave_origin.stage_index)
		s.stage_length = float(s.stage["len"])
		s.walk_top = s.ground_top
		s.cam_x = wave_origin.cam_x
		s.wave_idx = wave_origin.wave_idx
		# vargulRemains / sovereignRemains are not part of demoSave: the bodies stay in view.
		s.vargul_remains = wave_origin.vargul_remains.duplicate()
		s.sovereign_remains = wave_origin.sovereign_remains.duplicate()
	else:
		# The soldier table (ET) is the same in every stage file; index 0 = Stage 1 scaling and art.
		s = BmkWaveSimulation.new(stage_config,BmkWaveData.for_stage(1),0)
		s.stage1_view = true
		var section: int = origin.sections.idx if origin != null else 0
		if section != s.sections.idx: s.sections.enter_section(section)
		s.sections.banner = 0
		s.cam_x = origin.cam_x if origin != null else 0.0
	s.fixed_random = fixed_random
	s.tick = origin.tick if origin != null else 0
	s.mode = "play"
	s.banner_t = 0
	s.progression_enabled = false
	# demoStart(): practice = false; camLock = true; lockAt = camX.
	s.cam_lock = true
	s.lock_at = s.cam_x
	return s

## demoStop(): the caller restores its own session reference.
func stop() -> void:
	if not on: return
	on = false
	clear_keys()
	session = null

## demoKeys(): forget every held/buffered key and the highlight.
func clear_keys() -> void:
	if session != null: session.input.clear()
	lit.clear()
	lights_changed.emit()

## demoStep(i): a fresh character and dummy so cooldowns, gauges and positions match the script.
func step_to(i: int) -> void:
	var n: int = steps.size()
	index = posmod(i,n)
	var step: Dictionary = steps[index]
	t = 0.0
	after = 0.0
	clear_keys()
	events.clear()
	end = 0.0
	for entry: Array in step["script"]:
		var at: float = float(entry[2])
		var ms: float = float(entry[3]) if entry.size() > 3 else (90.0 if str(entry[0]) == "tap" else 300.0)
		events.append({"code":str(entry[1]),"at":at,"up":at + ms,"down":false,"released":false})
		end = maxf(end,at + ms)
	var s: BmkWaveSimulation = session
	var y: float = clampf(420,s.ground_top + 30,s.ground_bottom - 30)
	var x: float = s.cam_x + s.view_width * 0.22
	# newPlayer(0, DEMO.char)
	s.player = BmkStageActor.new()
	s.configure(s.data)
	s.use_character(character)
	var p: BmkActorState = s.player
	p.x = x
	p.y = y
	p.face = 1
	p.inv = 0
	var setup: Variant = step.get("setup")
	if setup is Dictionary:
		if (setup as Dictionary).has("sp"): p.sp = float(setup["sp"])
		if (setup as Dictionary).has("mg"): p.mg = int(setup["mg"])
	s.enemies.clear()
	var dummy: BmkActorState = s.spawn("grunt",x + float(step["dummy"]),y)
	dummy.training = true
	dummy.hp = 99999
	dummy.max_hp = 99999
	dummy.face = -1
	s.items.clear()
	s.barrels.clear()
	s.hazards.clear()
	s.legacy_hazards.clear()
	s.fire_hazards.clear()
	s.arena = {}
	s.hit_stop = 0
	s.shake = 0
	s.flash_t = 0
	s.slow_request = 0
	s.chain_n = 0
	s.chain_t = 0
	s.input.clear()
	# BarelJump.reset() / BarelDashFx.clear()
	s.jump_phase = ""
	s.jump_phase_ticks = 0
	s.was_airborne = false
	s.landing_tick = -1
	step_changed.emit(index)

## demoPress(code, on)
func press(code: String, down: bool) -> void:
	if down:
		session.input.held[code] = true
		session.input.pressed[code] = session.input.buffer_ms
		lit[code] = true
	else:
		session.input.held[code] = false
		lit.erase(code)
	lights_changed.emit()

## demoUpdate(): one tick in place of update(). False while stopped or paused (the frame is frozen).
func tick() -> bool:
	if not on or paused: return false
	var s: BmkWaveSimulation = session
	s.audio_log.clear()
	s.tick += 1
	t += MS
	for e: Dictionary in events:
		if not bool(e["down"]) and t >= float(e["at"]):
			e["down"] = true
			press(str(e["code"]),true)
		if bool(e["down"]) and not bool(e["released"]) and t >= float(e["up"]):
			e["released"] = true
			press(str(e["code"]),false)
	if s.flash_t > 0: s.flash_t -= MS
	if s.shake > 0: s.shake *= 0.85
	if s.chain_t > 0:
		s.chain_t -= MS
		if s.chain_t <= 0: s.chain_n = 0
	if s.hit_stop > 0: s.hit_stop -= 1
	else:
		s.player_controller.step(s)
		s.observe_jump()
		var i: int = 0
		while i < s.enemies.size():
			s.enemy_controller.step(s,s.enemies[i])
			i += 1
		s.update_hazards()
		s.viesa.update_effects()
		s.step_completed.emit()
		# The dummy never falls.
		if not s.enemies.is_empty(): s.enemies[0].hp = s.enemies[0].max_hp
	# The page loop ages the key buffer after every processed update.
	s.input.age_processed_step()
	var p: BmkActorState = s.player
	var idle: bool = p.st == "free" and p.z <= 0
	if t > end + 250 and idle: after += MS
	if after >= 700 or t >= BmkDemoSteps.MAX_MS: step_to(index + 1)
	return true

## #demoBar width in percent.
func progress() -> float:
	return minf(100.0,t / maxf(end + 1300.0,t + after + 1.0) * 100.0)

## Chip click: jump to a step and resume a paused demo.
func choose(i: int) -> void:
	step_to(i)
	paused = false

func toggle_pause() -> void:
	paused = not paused

func current() -> Dictionary:
	return steps[index] if not steps.is_empty() else {}
