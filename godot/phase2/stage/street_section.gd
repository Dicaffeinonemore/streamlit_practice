class_name BmkStreetSection
extends RefCounted
## First section only; source event order and camera limits are retained.
var session_ref: WeakRef
var session: BmkSimulation:
	get:
		return session_ref.get_ref() as BmkSimulation
var section: Dictionary
var background: Dictionary
var event_index: int = 0
var locked: bool = false
var lock_id: int = 0
var spawn_queue: Array[Array] = []
var max_alive: int = 0
var delay: int = 0
var section_ticks: int = 0
var go_ticks: int = 0
var complete: bool = false

func _init(s: BmkSimulation, source: Dictionary) -> void:
	session_ref = weakref(s)
	section = source["stage_sections"][0]
	background = source["background"]
	s.stage_length = float(background["len"])
	s.player.x = 80.0
	s.player.inv = 90
	s.stage_driver = step

func step() -> void:
	section_ticks += 1
	go_ticks = maxi(0,go_ticks - 1)
	if locked:
		update_lock()
	var events: Array = section["events"]
	var event: Dictionary = events[event_index] if event_index < events.size() else {}
	var limit: float = session.cam_x if locked else (clampf(float(event["at"]) * session.stage_length - 320.0,0.0,session.stage_length - 640.0) if not event.is_empty() else session.stage_length - 640.0)
	var goal: float = session.player.x - 256.0
	if goal > session.cam_x:
		session.cam_x = minf(goal,limit)
	if not locked and not event.is_empty() and session.cam_x >= limit - 0.5:
		locked = true
		lock_id += 1
		max_alive = int(event["max"])
		delay = 0
		spawn_queue.clear()
		for spec: Array in event["spawns"]:
			spawn_queue.append(spec)
	if not locked and event.is_empty() and session.player.st != "dead" and session.player.x >= session.stage_length - 60.0:
		complete = true

func update_lock() -> void:
	var alive: int = 0
	for e: BmkActorState in session.enemies:
		if e.lock_id == lock_id and e.st != "dead":
			alive += 1
	if delay > 0:
		delay -= 1
	while not spawn_queue.is_empty() and alive < max_alive and delay <= 0:
		spawn_enemy(spawn_queue.pop_front())
		alive += 1
		delay = int(spawn_queue[0][2]) if not spawn_queue.is_empty() and spawn_queue[0].size() > 2 else 0
	if not spawn_queue.is_empty():
		return
	for e: BmkActorState in session.enemies:
		if e.st != "dead":
			return
	locked = false
	event_index += 1
	go_ticks = 300

func spawn_enemy(spec: Array) -> void:
	var path: PackedStringArray = str(spec[1]).split("@")
	var y: float = session.random_between(360.0,500.0)
	var x: float = 0.0
	match path[0]:
		"right": x = session.cam_x + 640.0 + session.random_between(30.0,110.0)
		"left": x = session.cam_x - session.random_between(30.0,110.0)
		_: x = float(background["marks"][path[1]]) + session.random_between(-6.0,6.0)
	var e: BmkActorState = session.spawn(str(spec[0]),x,y)
	e.lock_id = lock_id
	if path[0] == "door":
		e.st = "enter"
		e.y = 343.0
		e.enter_to = 380.0
		e.invulnerable = true
		e.enter_speed = 1.0
		e.alpha = 0.0
		e.face = 1 if session.player.x >= e.x else -1
