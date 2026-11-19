class_name BmkSettings
extends Resource
const PATH: String = "user://bmk_settings.json"
@export var preset: String = "arcade"
@export var bindings: Dictionary[String, int] = {}
@export var music_volume: float = 0.7
@export var sfx_volume: float = 0.8
@export var shake: bool = true
@export var flash: bool = true
@export var danger_zones: bool = true
## game-ui.js options.touch (default: a touch screen is present) and options.touchLayout.
@export var touch: bool = false
@export var touch_layout: Dictionary = {}
var storage_path: String = PATH

func _init() -> void:
	touch = DisplayServer.is_touchscreen_available()
	touch_layout = BmkTouchLayout.defaults()

static func read(path: String = PATH) -> BmkSettings:
	var result: BmkSettings = BmkSettings.new()
	result.storage_path = path
	if not FileAccess.file_exists(path): return result
	var raw: Variant = JSON.parse_string(FileAccess.get_file_as_string(path))
	if raw is not Dictionary: return result
	if raw.get("preset") in ["arcade","wasd","custom"]: result.preset = raw["preset"]
	for key: String in ["music_volume","sfx_volume"]:
		var value: Variant = raw.get(key)
		if (value is int or value is float) and is_finite(float(value)) and float(value) >= 0 and float(value) <= 1: result.set(key,float(value))
	for key: String in ["shake","flash","danger_zones","touch"]:
		if raw.get(key) is bool: result.set(key,raw[key])
	result.touch_layout = BmkTouchLayout.validate(raw.get("touch_layout"))
	if raw.get("bindings") is Dictionary:
		var used: Dictionary[int,bool] = {}
		for action: String in BmkPhysicalInput.ACTIONS:
			var code: Variant = raw["bindings"].get(action)
			if (code is float or code is int) and float(code) == floor(float(code)) and valid_key(int(code)) and not used.has(int(code)):
				result.bindings[action] = int(code)
				used[int(code)] = true
	if result.preset == "custom" and result.bindings.size() != BmkPhysicalInput.ACTIONS.size():
		result.preset = "arcade"
		result.bindings.clear()
	return result

func save(path: String = "") -> Error:
	var target: String = storage_path if path.is_empty() else path
	var store: BmkSaveStore = BmkSaveStore.new()
	return store.write_json(target,{"preset":preset,"bindings":bindings,"music_volume":music_volume,"sfx_volume":sfx_volume,"shake":shake,"flash":flash,"danger_zones":danger_zones,"touch":touch,"touch_layout":touch_layout})

func bind(action: String, code: int) -> bool:
	if action not in BmkPhysicalInput.ACTIONS or not valid_key(code): return false
	for other: String in bindings:
		if other != action and bindings[other] == code: return false
	bindings[action] = code
	preset = "custom"
	return true

static func valid_key(code: int) -> bool:
	if code in [KEY_M,KEY_R]: return false
	return code >= KEY_A and code <= KEY_Z or code >= KEY_0 and code <= KEY_9 or code in [KEY_LEFT,KEY_RIGHT,KEY_UP,KEY_DOWN,KEY_SPACE,KEY_SHIFT]

func use_preset(id: String) -> void:
	var codes: Array[int] = BmkPhysicalInput.WASD if id == "wasd" else BmkPhysicalInput.ARCADE
	bindings.clear()
	for i: int in range(BmkPhysicalInput.ACTIONS.size()):
		bindings[BmkPhysicalInput.ACTIONS[i]] = codes[i]
	preset = id
