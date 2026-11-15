class_name BmkFullStage
extends BmkStreetSection
var idx: int = 0
var source: Dictionary
var fade_t: int = -1
var fade_next: int = 0
var fade_walk: bool = false
var wall_t: int = -1
var wall_x: float = 0
var wall_broken: bool = false
var gate_t: int = -1
var scaffolds: Array[float] = []
var banner: int = 0

func _init(s: BmkSimulation, data: Dictionary) -> void:
	super(s,{"stage_sections":data["STAGE1_SECTIONS"],"background":data["STAGE1_BG"]["street"]})
	source = data
	enter_section(0)
	banner = 0

func enter_section(index: int) -> void:
	var s: BmkStageSimulation = session as BmkStageSimulation
	idx = index
	section = source["STAGE1_SECTIONS"][idx]
	background = source["STAGE1_BG"][section["bg"]]
	s.stage_length = float(background["len"])
	s.walk_top = 500.0 - 160.0 * float(section.get("depth",{}).get("top",1.0))
	event_index = 0
	locked = false
	wall_t = -1
	gate_t = -1
	wall_broken = false
	scaffolds.clear()
	banner = 170
	section_ticks = 0
	go_ticks = 0
	s.cam_x = lock_cam(0.5) if bool(section.get("fixedCam",false)) else 0.0
	s.enemies.clear()
	s.items.clear()
	s.hazards.clear()
	s.fire_hazards.clear()
	s.barrels.clear()
	for x: float in section.get("barrels",[]):
		var b: BmkWorldItem = BmkWorldItem.new()
		b.id = -1 - s.barrels.size()
		b.x = x
		b.y = s.random_between(s.walk_top + 30,490)
		b.hp = 2
		b.hw = 16
		b.barrel = true
		s.barrels.append(b)
	var p: BmkActorState = s.player
	p.x = s.cam_x + 80
	p.y = clampf(430,s.walk_top + 10,500)
	p.z = 0
	p.vx = 0
	p.vz = 0
	p.face = 1
	p.inv = maxi(p.inv,60)
	if idx == 4: s.gorath.prepare(s)

func lock_cam(at: float) -> float:
	return clampf(at * session.stage_length - 320,0,session.stage_length - 640)

func step() -> void:
	var s: BmkStageSimulation = session as BmkStageSimulation
	section_ticks += 1
	if banner > 0: banner -= 1
	if go_ticks > 0: go_ticks -= 1
	if locked: update_lock()
	if wall_t >= 0 and not wall_broken:
		wall_t += 1
		if wall_t == 1 or wall_t == 21:
			s.sound("slam")
			s.shake = maxf(s.shake,3)
		if wall_t < 40: s.shake = maxf(s.shake,1.5)
		else:
			wall_broken = true
			s.shake = 14
			s.hit_stop = maxi(s.hit_stop,4)
			s.sound("barrel")
	if gate_t >= 0 and gate_t < 40:
		gate_t += 1
		if gate_t == 40:
			s.sound("slam")
			s.shake = maxf(s.shake,6)
			go_ticks = 300
	var events: Array = section["events"]
	var event: Dictionary = events[event_index] if event_index < events.size() else {}
	var fixed: bool = bool(section.get("fixedCam",false))
	var limit: float = lock_cam(0.5) if fixed else (s.cam_x if locked else (lock_cam(float(event["at"])) if not event.is_empty() else s.stage_length - 640))
	if fixed: s.cam_x = limit
	elif s.player.x - 256 > s.cam_x: s.cam_x = minf(s.player.x - 256,limit)
	if not locked and not event.is_empty() and fade_t < 0 and s.cam_x >= limit - 0.5:
		locked = true
		lock_id += 1
		spawn_queue.clear()
		delay = 0
		if event.has("boss"):
			max_alive = 1
			s.gorath.begin_intro(s)
		else:
			max_alive = int(event["max"])
			for spec: Array in event["spawns"]:
				spawn_queue.append(spec)
				if str(spec[1]).begins_with("wallbreak@"):
					wall_t = 0
					wall_x = float(background["marks"][str(spec[1]).split("@")[1]])
	if not locked and event.is_empty() and idx < 4 and s.player.st != "dead" and fade_t < 0:
		if bool(section.get("gate",false)):
			if gate_t >= 40 and s.player.x >= float(background["marks"]["gateLeft"]) + 24: begin_fade(true)
		elif s.player.x >= s.stage_length - 60: begin_fade(false)

func update_lock() -> void:
	var s: BmkStageSimulation = session as BmkStageSimulation
	var alive: int = 0
	for e: BmkActorState in s.enemies:
		if e.lock_id == lock_id and e.st != "dead": alive += 1
	if delay > 0: delay -= 1
	while not spawn_queue.is_empty() and alive < max_alive and delay <= 0:
		if str(spawn_queue[0][1]).begins_with("wallbreak@") and not wall_broken: break
		spawn_enemy(spawn_queue.pop_front())
		alive += 1
		delay = int(spawn_queue[0][2]) if not spawn_queue.is_empty() and spawn_queue[0].size() > 2 else 0
	if not spawn_queue.is_empty(): return
	for e: BmkActorState in s.enemies:
		if e.st != "dead": return
	locked = false
	event_index += 1
	s.fire_hazards = s.fire_hazards.filter(func(z: BmkFireHazard) -> bool: return z.type != "firemark")
	if bool(section.get("gate",false)) and event_index >= (section["events"] as Array).size():
		gate_t = 0
		s.sound("pillar")
		s.shake = maxf(s.shake,4)
	else: go_ticks = 300

func spawn_enemy(spec: Array) -> void:
	var s: BmkStageSimulation = session as BmkStageSimulation
	var parts: PackedStringArray = str(spec[1]).split("@")
	var path: String = parts[0]
	var arg: String = parts[1] if parts.size() > 1 else ""
	var y: float = s.random_between(s.walk_top + 20,500)
	var x: float = 0.0
	if path == "right": x = s.cam_x + 640 + s.random_between(30,110)
	elif path == "left": x = s.cam_x - s.random_between(30,110)
	elif path == "balcony": x = clampf(clampf(float(arg) * s.stage_length,float(background["marks"]["balconyFrom"]),float(background["marks"]["balconyTo"])),s.cam_x + 60,s.cam_x + 580)
	else: x = float(background["marks"][arg]) + s.random_between(-6,6)
	var e: BmkStageActor = s.spawn(str(spec[0]),x,y) as BmkStageActor
	e.lock_id = lock_id
	if e.species == "heavy":
		e.grab_cd = 60
		if path == "wallbreak":
			e.max_hp = s.js_round(e.max_hp * 1.3)
			e.hp = e.max_hp
	if e.species == "hound":
		e.dive_cd = s.js_round(s.random_between(40,120))
		e.angle = fmod(e.id * 2.39,TAU)
		e.radius = s.random_between(220,320)
	if e.species == "molotov":
		e.molotov = true
		e.attack_cd = s.random_between(30,70)
		e.lane_y = y
	if path in ["door","cage","wallbreak"]:
		e.st = "enter"
		e.y = 343
		e.enter_to = maxf(s.walk_top + 30,380)
		e.invulnerable = true
		e.enter_speed = 1.6 if path == "cage" else (0.7 if path == "wallbreak" else 1.0)
		e.alpha = 1.0 if path == "wallbreak" else 0.0
		e.face = 1 if s.player.x >= x else -1
	if path == "balcony":
		e.st = "balcony"
		e.balcony = true
		e.invulnerable = true
		e.y = 350
		e.z = 92
		scaffolds.append(e.x)

func begin_fade(walk: bool) -> void:
	fade_t = 0
	fade_walk = walk
	fade_next = idx + 1

func fading() -> bool:
	if fade_t < 0: return false
	fade_t += 1
	if fade_t <= 30 and fade_walk:
		var p: BmkActorState = session.player
		var gx: float = (float(background["marks"]["gateLeft"]) + float(background["marks"]["gateRight"])) / 2
		p.x += clampf(gx - p.x,-1.6,1.6)
		p.y += clampf(344 - p.y,-2.2,2.2)
		p.walk = true
		p.face = 1
		p.walk_time += session.MS
	if fade_t == 30: enter_section(fade_next)
	if fade_t >= 60: fade_t = -1
	return true
