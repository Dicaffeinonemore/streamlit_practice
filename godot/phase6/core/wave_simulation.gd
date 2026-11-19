class_name BmkWaveSimulation
extends BmkStageSimulation
## Stage 2: game.js update() for wave stages (camera locks, spawnWave, boss intro, clear),
## startStage(1), mkEnemy() scaling and the shared hazards array.
var wave_data: BmkWaveData
var morgra: BmkMorgraController
var aurelion: BmkAurelionController
var vargul: BmkVargulController
## vargulRemains: Vargul's body stays on the floor after death ([x, y, face]).
var vargul_remains: Array[PackedFloat64Array] = []
var sovereign: BmkSovereignController
## sovereignRemains: [x, y, face, fist0 x, y, face, fist1 x, y, face].
var sovereign_remains: Array[PackedFloat64Array] = []
## game.js arena: {kind, time, next, cycle} while a fire/frost/abyss wave is locked, else empty.
var arena: Dictionary = {}
var legacy_hazards: Array[BmkLegacyHazard] = []
var stage_index: int = 1
var stage: Dictionary = {}
var view_width: float = 640.0
var ground_top: float = 340.0
var ground_bottom: float = 500.0
var cam_lock: bool = false
var lock_at: float = 0.0
var wave_idx: int = 0
var go_t: int = 0
var banner_t: int = 0
var intro_t: float = 0.0
var intro_boss: BmkLegacyActor
var _hazard_loop: Array = []
var _hazard_loop_open: bool = false

func _init(config: BmkStageData = null, waves: BmkWaveData = null, index: int = 1) -> void:
	super(config)
	if config == null: return
	stage_index = index
	wave_data = waves if waves != null else BmkWaveData.for_stage(index)
	morgra = BmkMorgraController.new(wave_data)
	if wave_data.source.has("AURELION"): aurelion = BmkAurelionController.new(wave_data)
	if wave_data.source.has("VARGUL"): vargul = BmkVargulController.new(wave_data)
	if wave_data.source.has("SOVEREIGN"): sovereign = BmkSovereignController.new(wave_data)
	combat = BmkWaveCombat.new()
	enemy_controller = BmkLegacyEnemies.new()
	var viesa_data: BmkViesaData = BmkViesaData.shared()
	view_width = viesa_data.view_width()
	ground_top = viesa_data.ground_top()
	ground_bottom = viesa_data.ground_bottom()
	stage = wave_data.source["STAGE"]

func rnd() -> float:
	return 0.5 if fixed_random else randf()

## game.js startStage(i, restored).
func start_stage(restored: bool = false) -> void:
	hit_stop = 0
	shake = 0
	cam_x = 0
	cam_lock = false
	wave_idx = 0
	clear_t = 0
	go_t = 0
	flash_t = 0
	enemies.clear()
	items.clear()
	hazards.clear()
	legacy_hazards.clear()
	vargul_remains.clear()
	sovereign_remains.clear()
	arena = {}
	fire_hazards.clear()
	viesa.reset()
	chain_n = 0
	chain_t = 0
	chain_max = 0
	stat_ticks = 0
	stat_kills = 0
	stat_damage = 0
	stat_deaths = 0
	slow_request = 0
	intro_boss = null
	stage_length = float(stage["len"])
	walk_top = ground_top
	barrels.clear()
	for bx: Variant in stage["barrels"]:
		var b: BmkWorldItem = BmkWorldItem.new()
		b.barrel = true
		b.id = -1 - barrels.size()
		b.x = float(bx)
		b.y = random_between(ground_top + 30,ground_bottom - 10)
		b.hw = 16
		b.hp = 2
		barrels.append(b)
	var p: BmkStageActor = player as BmkStageActor
	p.x = 80
	p.y = 420
	p.z = 0
	p.vx = 0
	p.vz = 0
	p.face = 1
	p.st = "free"
	p.t = 0
	p.inv = 90
	p.grab = null
	p.skill = ""
	if p.is_viesa(): BmkViesaController.clear_viesa(p)
	for id: String in p.skill_cd: p.skill_cd[id] = 0.0
	p.combo = 0
	p.combo_t = 0
	p.buf = 0
	p.atk = ""
	p.dash_cd = 0
	p.dash_grace = 0
	p.sp_target = null
	p.hurt_kind = "hurt_high"
	p.hurt_duration = data.hurt_ticks
	p.hurt_ends.clear()
	p.hp = minf(p.max_hp,p.hp + (40.0 if not restored and stage_index > 0 else 0.0))
	mode = "intro"
	banner_t = 160

## game.js beginBossChallenge(i): the original boss arena, skipping the approach waves.
func begin_boss_challenge() -> void:
	var waves: Array = stage["waves"]
	var wave: Dictionary = {}
	for w: Dictionary in waves:
		if bool(w.get("boss",false)): wave = w
	cam_x = float(wave["at"])
	lock_at = cam_x
	cam_lock = true
	wave_idx = waves.size()
	player.x = cam_x + view_width * 0.28
	player.x0 = player.x
	barrels.clear()
	banner_t = 0
	var only_boss: Dictionary = wave.duplicate()
	only_boss["e"] = [[str(stage["boss"]),1]]
	spawn_wave(only_boss)

## game.js mkEnemy(type, x, y) with the per-stage soldier scaling.
func spawn(species: String, x: float, y: float) -> BmkActorState:
	var base: Dictionary = wave_data.source["ET"][species]
	var d: Dictionary = base.duplicate()
	if species == "boss3":
		d["hp"] = 1800
		d["h"] = 240 * float(wave_data.source["AURELION"]["K"])
	if species == "boss4":
		d["name"] = "바르굴, 얼어붙은 묘지왕"
		d["en"] = "VARGUL, THE FROZEN GRAVELORD"
		d["hp"] = 2000
		d["h"] = float(wave_data.source["VARGUL"]["worldHeight"])
		d["hw"] = 19
	if species == "boss5":
		var rules: Dictionary = wave_data.source["SOVEREIGN"]["RULES"]
		d["name"] = "흑월의 군주, 소버린"
		d["en"] = "THE BLACK MOON SOVEREIGN"
		d["hp"] = float(rules["hp"][0])
		d["h"] = float(wave_data.source["SOVEREIGN"]["ART"]["bodyHeight"])
		d["hw"] = float(rules["hw"])
	if not bool(base.get("boss",false)):
		d["hp"] = js_round(float(base["hp"]) * (1.2 + stage_index * 0.3))
		d["dmg"] = js_round(float(base["dmg"]) * (1.1 + stage_index * 0.2))
		d["spd"] = float(base["spd"]) * (1 + stage_index * 0.05)
		d["name"] = ["처형군","까마귀 군단","황금 왕실","서리 망자","심연 군단"][stage_index] + " " + str({"grunt":"보병","rogue":"창병","archer":"궁병","brute":"중기사"}.get(species,base.get("name","")))
	var e: BmkLegacyActor = BmkLegacyActor.new()
	e.id = next_id
	next_id += 1
	e.type = species
	e.species = species
	e.stats = d
	var stats: BmkEnemyStats = BmkEnemyStats.new()
	stats.id = species
	stats.hp = float(d["hp"])
	stats.speed = float(d["spd"])
	stats.damage = float(d.get("dmg",0))
	stats.reach = float(d["range"])
	stats.knockback = float(d.get("kb",0))
	stats.score = int(d["score"])
	stats.height = float(d.get("h",96))
	stats.half_width = float(d["hw"])
	e.d = stats
	e.x = x
	e.y = y
	e.face = -1
	e.hw = stats.half_width
	e.hp = stats.hp
	e.max_hp = e.hp
	e.st = "chase"
	e.wait = random_between(0,40)
	e.attack_cd = random_between(20,60)
	e.boss = bool(d.get("boss",false))
	e.next_kd = e.hp * 0.75
	e.gr = 0
	e.gr_max = 120.0 if species == "boss2" else (150.0 if e.hp >= 500 else 120.0)
	e.gr_t = 0
	e.recovery_t = int(d.get("rec",30))
	e.hr = 9999
	e.alpha = 1
	enemies.append(e)
	if species == "boss3": aurelion.state(e)
	if species == "boss4": vargul.state(e)
	return e

## game.js spawnAdds(types): one from each side of the screen.
func spawn_adds(types: Array) -> void:
	for i: int in range(2):
		var side: int = [1,-1][i]
		var x: float = cam_x + view_width + 40 if side > 0 else cam_x - 40
		spawn(str(types[i]),x,random_between(ground_top + 20,ground_bottom))

func strike_orbs(reach: float, behind: float, hit_set: Dictionary, key_prefix: String = "", options: Dictionary = {}) -> bool:
	return vargul.strike_orbs(self,reach,behind,hit_set,key_prefix,options) if vargul != null else false

func strike_fists(reach: float, behind: float, hit_set: Dictionary, key_prefix: String = "", options: Dictionary = {}) -> bool:
	return sovereign.strike_fists(self,reach,behind,hit_set,key_prefix,options) if sovereign != null else false

func is_sovereign(e: BmkActorState) -> bool:
	return BmkSovereignController.is_sovereign(e)

## game.js playerHitSfx(kind, sound): only presentation, no simulation effect.
func hit_sound(kind: int, hit: String = "") -> void:
	if hit == "none": return
	var p: BmkActorState = player
	if p.is_viesa():
		if BmkViesaController.default_hit_sound(p): sound("hit",kind)
		return
	var skill_sound: String = str({"redwave":"barelWave","slam":"barelSlam","leap":"barelSlam"}.get(p.skill,"")) if p.st == "skill" else ""
	sound(hit if not hit.is_empty() else (skill_sound if not skill_sound.is_empty() else "swordHit"),kind)

func react_attack() -> void:
	if aurelion != null: aurelion.react(self)

func add_hazard(type: String, x: float, y: float, h: float) -> BmkLegacyHazard:
	var z: BmkLegacyHazard = BmkLegacyHazard.new()
	z.type = type
	z.x = x
	z.y = y
	z.h = h
	z.seq = next_hazard_seq()
	legacy_hazards.append(z)
	if _hazard_loop_open: _hazard_loop.append(z)
	return z

## Boss death / revival: hazards = hazards.filter(z => z.type === 'pwave').
func clear_boss_hazards() -> void:
	legacy_hazards.clear()
	viesa.arrows.clear()
	_hazard_loop_open = false

## hurtPlayer(): source.damageScale, or 1.5 for Morgra's own phase-two attacks.
func source_scale(e: BmkLegacyActor) -> float:
	return (1.5 if e.type == "boss2" else 1.3) if e.boss and e.p2shown else 1.0

func strike_crows(reach: float, behind: float, x: float, y: float, z: float, face: int) -> void:
	morgra.strike_crows(self,reach,behind,x,y,z,face)

func step() -> bool:
	if mode == "clear" or game_over: return false
	tick += 1
	if mode == "intro":
		banner_t -= 1
		if banner_t <= 0: mode = "play"
		return false
	if mode == "bossintro":
		update_intro()
		return false
	stat_ticks += 1
	if flash_t > 0: flash_t -= MS
	if hit_stop > 0:
		hit_stop -= 1
		return false
	if chain_t > 0:
		chain_t -= MS
		if chain_t <= 0: chain_n = 0
	if shake > 0: shake *= 0.85
	player_controller.step(self)
	observe_jump()
	if game_over: return true
	if progression_enabled: update_waves()
	var i: int = 0
	while i < enemies.size():
		enemy_controller.step(self,enemies[i])
		i += 1
	enemies = enemies.filter(func(e: BmkActorState) -> bool: return not e.remove)
	update_arena()
	update_hazards()
	if clear_t == 0 and wave_idx >= (stage["waves"] as Array).size() and not cam_lock and enemies.is_empty():
		clear_t = 1
		sound("victory")
		# AUDIO.victoryMusic(i, final): the last stage plays the ending score.
		music_requested.emit("ending" if stage_index + 1 >= int(wave_data.source["STAGE_COUNT"]) else "victory")
	if clear_t > 0:
		clear_t += 1
		if clear_t > 200:
			mode = "clear"
			player.score += int(player.hp * 10)
	item_controller.step(self)
	viesa.update_effects()
	input.age_processed_step()
	step_completed.emit()
	return true

func update_waves() -> void:
	var waves: Array = stage["waves"]
	var limit: float = lock_at if cam_lock else (float(waves[wave_idx]["at"]) if wave_idx < waves.size() else stage_length - view_width)
	var goal: float = player.x - view_width * 0.4
	if goal > cam_x: cam_x = minf(goal,limit)
	if not cam_lock and wave_idx < waves.size() and cam_x >= float(waves[wave_idx]["at"]) - 0.5:
		cam_lock = true
		lock_at = float(waves[wave_idx]["at"])
		spawn_wave(waves[wave_idx])
		wave_idx += 1
	if cam_lock and enemies.all(func(e: BmkActorState) -> bool: return e.st == "dead"):
		cam_lock = false
		arena = {}
		legacy_hazards = legacy_hazards.filter(func(z: BmkLegacyHazard) -> bool: return not z.arena)
		if wave_idx < waves.size(): go_t = 300

func spawn_wave(w: Dictionary) -> void:
	arena = {"kind":str(w["arena"]),"time":0.0,"next":1800.0,"cycle":0} if w.has("arena") else {}
	for entry: Array in w["e"]:
		var type: String = str(entry[0])
		var side: int = int(entry[1])
		if bool(wave_data.source["ET"][type].get("boss",false)):
			var b: BmkLegacyActor = spawn(type,cam_x + view_width * 0.72,clampf(player.y,ground_top + 40,ground_bottom - 30)) as BmkLegacyActor
			b.st = "intro"
			b.z = 360 if type == "boss3" else 0
			b.face = -1
			intro_boss = b
			intro_t = 0
			mode = "bossintro"
			music_requested.emit("boss")
			continue
		var x: float = cam_x + view_width + random_between(30,110) if side > 0 else cam_x - random_between(30,110)
		spawn(type,x,random_between(ground_top + 20,ground_bottom))

## game.js updIntro() for Morgra (INTRO_MS).
func update_intro() -> void:
	var b: BmkLegacyActor = intro_boss
	intro_t += MS
	var duration: float = intro_duration(b)
	if b.type == "boss4": vargul.update_intro(self,b)
	if b.type == "boss5": sovereign.update_intro(self,b)
	if b.type == "boss3": aurelion.update_intro(self,b)
	b.z = 0
	if shake > 0: shake *= 0.85
	if flash_t > 0: flash_t -= MS
	viesa.update_effects()
	if intro_t + 0.001 >= duration:
		mode = "play"
		b.st = "chase"
		b.attack_cd = 40
		player.inv = maxi(player.inv,18)
		(player as BmkStageActor).quiet_inv_until = tick + player.inv

## bossIntroDuration(e).
func intro_duration(b: BmkLegacyActor) -> float:
	if b.type == "boss3": return aurelion.intro_duration()
	if b.type == "boss4": return vargul.intro_duration()
	if b.type == "boss5": return sovereign.intro_duration()
	return float(wave_data.source["INTRO_MS"])

## game.js updArena(): while a fire/frost/abyss wave is locked, rifts cross the screen every
## 5 s (first after 1.8 s): fire and frost mark the player's lane, abyss all but the safe lane.
func update_arena() -> void:
	if arena.is_empty() or not cam_lock or player.st == "dead" or enemies.all(func(e: BmkActorState) -> bool: return e.st == "dead"): return
	arena["time"] = float(arena["time"]) + MS
	if float(arena["time"]) < float(arena["next"]): return
	var lanes: Array[float] = [370.0,425.0,480.0]
	var safe: int = int(arena["cycle"]) % lanes.size()
	var selected: Array[float] = []
	if str(arena["kind"]) == "abyss":
		for i: int in range(lanes.size()):
			if i != safe: selected.append(lanes[i])
	else:
		var best: float = lanes[0]
		for i: int in range(1,lanes.size()):
			if not (absf(best - player.y) < absf(lanes[i] - player.y)): best = lanes[i]
		selected.append(best)
	for y: float in selected:
		var z: BmkLegacyHazard = add_hazard("rift",cam_x,y,0)
		z.kind = str(arena["kind"])
		z.width = view_width
		z.depth = 23
		z.delay = 1200
		z.life = 350
		z.arena = true
	arena["cycle"] = int(arena["cycle"]) + 1
	arena["next"] = float(arena["next"]) + 5000

## Rift: erupts after its delay, one knockdown hit (12) per rift; frost can be jumped at z >= 24.
func update_rift(z: BmkLegacyHazard) -> void:
	var p: BmkActorState = player
	if z.age >= z.delay and not z.boom:
		z.boom = true
		sound("pillar")
	var jump_limit: float = 24.0 if z.kind == "frost" else 90.0
	if z.age >= z.delay and z.age <= z.delay + z.life and not z.hit and p.x >= z.x and p.x <= z.x + z.width and absf(p.y - z.y) < z.depth and p.z < jump_limit:
		if combat.hurt_player(self,12,-1 if p.x < z.x + z.width / 2 else 1,true): z.hit = true
	# The zone drawing (embers) fades out after the hit window.
	if z.age > z.delay + z.life + 260: z.dead = true

## updHazards(): Viesa's ultimate first, then one array in creation order.
func update_hazards() -> void:
	var viesa_controller: BmkViesaController = player_controller as BmkViesaController
	if viesa_controller != null: viesa_controller.update_ultimate_projectiles(self)
	var order: Array = []
	order.append_array(viesa.arrows)
	order.append_array(hazards)
	order.append_array(legacy_hazards)
	order.sort_custom(func(a: Object, b: Object) -> bool: return a.get("seq") < b.get("seq"))
	_hazard_loop = order
	_hazard_loop_open = true
	var i: int = 0
	while i < _hazard_loop.size():
		var z: Object = _hazard_loop[i]
		i += 1
		if z is BmkViesaWorld.Arrow:
			(z as BmkViesaWorld.Arrow).age += MS
			viesa_controller.update_arrow(self,z as BmkViesaWorld.Arrow)
		elif z is BmkProjectileState:
			(z as BmkProjectileState).age += MS
			update_wave(z as BmkProjectileState)
		else:
			var h: BmkLegacyHazard = z as BmkLegacyHazard
			h.age += MS
			if h.type == "arrow": update_arrow(h)
			elif h.type == "rift": update_rift(h)
			elif h.type == "aurelion": aurelion.update_hazard(self,h)
			elif h.type == "vargul": vargul.update_hazard(self,h)
			else: morgra.update_hazard(self,h)
	_hazard_loop_open = false
	_hazard_loop = []
	viesa.arrows = viesa.arrows.filter(func(z: BmkViesaWorld.Arrow) -> bool: return not z.dead)
	hazards = hazards.filter(func(z: BmkProjectileState) -> bool: return not z.dead)
	legacy_hazards = legacy_hazards.filter(func(z: BmkLegacyHazard) -> bool: return not z.dead)

## Archer arrow: straight along its lane.
func update_arrow(z: BmkLegacyHazard) -> void:
	var p: BmkActorState = player
	var k: float = 0.9 if p.is_viesa() else 1.0
	z.x += z.dir * 7
	if absf(z.x - p.x) < 14 * k and absf(z.y - p.y) < 18 * k and absf(z.h - (p.z + 44 * k)) < 34 * k and combat.hurt_player(self,z.damage,z.dir,false,z.h): z.dead = true
	if z.age > 2600 or z.x < cam_x - 60 or z.x > cam_x + view_width + 60: z.dead = true
