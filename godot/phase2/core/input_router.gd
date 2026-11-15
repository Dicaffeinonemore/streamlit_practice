class_name BmkInputRouter
extends RefCounted
const MS: float = 1000.0 / 60.0
var held: Dictionary[String, bool] = {}
var pressed: Dictionary[String, float] = {}
var last_tap_direction: int = 0
var last_tap_tick: int = -99
var dash_request: int = 0
var buffer_ms: float = 220.0

func clear() -> void:
	held.clear()
	pressed.clear()
	last_tap_direction = 0
	last_tap_tick = -99
	dash_request = 0

func press(code: String, tick: int) -> void:
	if held.get(code, false):
		return
	pressed[code] = buffer_ms
	var direction: int = -1 if code in ["ArrowLeft", "KeyA"] else (1 if code in ["ArrowRight", "KeyD"] else 0)
	if direction != 0:
		if last_tap_direction == direction and tick - last_tap_tick <= 15:
			dash_request = direction
			last_tap_direction = 0
			last_tap_tick = -99
		else:
			last_tap_direction = direction
			last_tap_tick = tick
	held[code] = true

func release(code: String) -> void:
	held[code] = false

func down(codes: Array[String]) -> bool:
	for code: String in codes:
		if held.get(code, false):
			return true
	return false

func hit(codes: Array[String]) -> bool:
	var found: bool = false
	for code: String in codes:
		if pressed.get(code, 0.0) > 0.0:
			found = true
	if found:
		for code: String in codes:
			pressed.erase(code)
	return found

func age_processed_step() -> void:
	for code: String in pressed.keys():
		pressed[code] -= MS
		if pressed[code] <= 0.0:
			pressed.erase(code)
