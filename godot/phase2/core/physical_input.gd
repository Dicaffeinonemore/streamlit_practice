class_name BmkPhysicalInput
extends RefCounted
const ACTIONS: Array[String] = ["KeyA","KeyD","KeyW","KeyS","Space","KeyJ","ShiftLeft","KeyK","KeyI","KeyU","KeyH","KeyO","KeyP","KeyL"]
const ARCADE: Array[int] = [KEY_LEFT,KEY_RIGHT,KEY_UP,KEY_DOWN,KEY_X,KEY_Z,KEY_SHIFT,KEY_C,KEY_A,KEY_S,KEY_D,KEY_Q,KEY_W,KEY_E]
const WASD: Array[int] = [KEY_A,KEY_D,KEY_W,KEY_S,KEY_K,KEY_J,KEY_SHIFT,KEY_SPACE,KEY_L,KEY_U,KEY_I,KEY_O,KEY_P,KEY_H]
var preset: String = "arcade"

func configure(id: String = "arcade") -> void:
	preset = id
	var codes: Array[int] = WASD if preset == "wasd" else ARCADE
	for i: int in range(ACTIONS.size()):
		var name_: StringName = StringName("bmk_" + ACTIONS[i])
		if not InputMap.has_action(name_):
			InputMap.add_action(name_)
		InputMap.action_erase_events(name_)
		var event: InputEventKey = InputEventKey.new()
		event.physical_keycode = codes[i] as Key
		InputMap.action_add_event(name_,event)

func handle(event: InputEvent, session: BmkSimulation) -> void:
	if event is not InputEventKey or (event as InputEventKey).echo:
		return
	for action: String in ACTIONS:
		if event.is_action("bmk_" + action):
			if event.is_pressed():
				session.input.press(action,session.tick)
			else:
				session.input.release(action)

func clear(session: BmkSimulation) -> void:
	session.input.clear()

func configure_custom(bindings: Dictionary[String, int]) -> bool:
	if bindings.size() != ACTIONS.size(): return false
	var used: Dictionary[int, bool] = {}
	for action: String in ACTIONS:
		if not bindings.has(action) or bindings[action] <= 0 or used.has(bindings[action]): return false
		used[bindings[action]] = true
	preset = "custom"
	for action: String in ACTIONS:
		var name_: StringName = StringName("bmk_" + action)
		if not InputMap.has_action(name_): InputMap.add_action(name_)
		InputMap.action_erase_events(name_)
		var event: InputEventKey = InputEventKey.new()
		event.physical_keycode = bindings[action] as Key
		InputMap.action_add_event(name_,event)
	return true
