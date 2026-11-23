class_name BmkPhysicalInput
extends RefCounted
const ACTIONS: Array[String] = ["KeyA","KeyD","KeyW","KeyS","Space","KeyJ","ShiftLeft","KeyK","KeyI","KeyU","KeyH","KeyO","KeyP","KeyL"]
const ARCADE: Array[int] = [KEY_LEFT,KEY_RIGHT,KEY_UP,KEY_DOWN,KEY_X,KEY_Z,KEY_SHIFT,KEY_C,KEY_A,KEY_S,KEY_D,KEY_Q,KEY_W,KEY_E]
const WASD: Array[int] = [KEY_A,KEY_D,KEY_W,KEY_S,KEY_K,KEY_J,KEY_SHIFT,KEY_SPACE,KEY_L,KEY_U,KEY_I,KEY_O,KEY_P,KEY_H]
# Godot reports the same keycode for both shifts. Store the side in the binding
# so older KEY_SHIFT saves continue to mean the browser's ShiftLeft.
const RIGHT_SHIFT: int = KEY_SHIFT | KEY_MASK_SHIFT
const RIGHT_CTRL: int = KEY_CTRL | KEY_MASK_CTRL
const ALIASES := {
	KEY_LEFT:"KeyA", KEY_RIGHT:"KeyD", KEY_UP:"KeyW", KEY_DOWN:"KeyS",
	KEY_CTRL:"Space", RIGHT_CTRL:"Space", KEY_Z:"KeyJ", KEY_X:"KeyK", KEY_V:"KeyI"
}
var preset: String = "arcade"
var by_key: Dictionary[int, String] = {}
var held: Dictionary[int, String] = {}

static func key_id(event: InputEventKey) -> int:
	var key := event.physical_keycode if event.physical_keycode != KEY_NONE else event.keycode
	if event.location == KEY_LOCATION_RIGHT:
		if key == KEY_SHIFT: return RIGHT_SHIFT
		if key == KEY_CTRL: return RIGHT_CTRL
	return key

static func preset_bindings(id: String) -> Dictionary[String, int]:
	var codes := WASD if id == "wasd" else ARCADE
	var result: Dictionary[String, int] = {}
	for i: int in range(ACTIONS.size()): result[ACTIONS[i]] = codes[i]
	return result

func configure(id: String = "arcade") -> void:
	install(id, preset_bindings(id))

func configure_custom(bindings: Dictionary[String, int]) -> bool:
	if bindings.size() != ACTIONS.size(): return false
	var used: Dictionary[int, bool] = {}
	for action: String in ACTIONS:
		if not bindings.has(action) or bindings[action] <= 0 or used.has(bindings[action]): return false
		used[bindings[action]] = true
	install("custom", bindings)
	return true

func install(id: String, bindings: Dictionary[String, int]) -> void:
	preset = id
	held.clear()
	by_key.clear()
	for action: String in ACTIONS:
		var code: int = bindings[action]
		by_key[code] = action
		var name_ := StringName("bmk_" + action)
		if not InputMap.has_action(name_): InputMap.add_action(name_)
		InputMap.action_erase_events(name_)
		var event := InputEventKey.new()
		event.physical_keycode = KEY_SHIFT if code == RIGHT_SHIFT else code as Key
		if event.physical_keycode == KEY_SHIFT:
			event.location = KEY_LOCATION_RIGHT if code == RIGHT_SHIFT else KEY_LOCATION_LEFT
		InputMap.action_add_event(name_, event)
	if preset != "arcade":
		for code: int in ALIASES:
			if not by_key.has(code): by_key[code] = ALIASES[code]

func handle(event: InputEvent, session: BmkSimulation) -> void:
	var key := event as InputEventKey
	if key == null or key.echo: return
	var code := key_id(key)
	var action: String = by_key.get(code, "")
	if action.is_empty(): return
	if key.pressed:
		var first := not held.values().has(action)
		held[code] = action
		if first: session.input.press(action,session.tick)
	else:
		held.erase(code)
		if not held.values().has(action): session.input.release(action)

func clear(session: BmkSimulation) -> void:
	held.clear()
	session.input.clear()
