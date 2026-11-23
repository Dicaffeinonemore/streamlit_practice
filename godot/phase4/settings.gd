class_name BmkSettings
extends Resource
const PATH: String = "user://bmk_settings.json"
@export var menu_language: String = "en"
@export var preset: String = "arcade"
@export var bindings: Dictionary[String, int] = {}
@export var custom_bindings: Dictionary[String, int] = {}
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
	if raw.get("menu_language") == "ko": result.menu_language = "ko"
	if raw.get("preset") in ["arcade","wasd","custom"]: result.preset = raw["preset"]
	for key: String in ["music_volume","sfx_volume"]:
		var value: Variant = raw.get(key)
		if (value is int or value is float) and is_finite(float(value)) and float(value) >= 0 and float(value) <= 1: result.set(key,float(value))
	for key: String in ["shake","flash","danger_zones","touch"]:
		if raw.get(key) is bool: result.set(key,raw[key])
	result.touch_layout = BmkTouchLayout.validate(raw.get("touch_layout"))
	result.custom_bindings = read_bindings(raw.get("custom_bindings"))
	if result.preset == "custom" and result.custom_bindings.is_empty():
		result.custom_bindings = read_bindings(raw.get("bindings"))
	if result.preset == "custom" and result.custom_bindings.is_empty(): result.preset = "arcade"
	result.use_preset(result.preset)
	return result

static func read_bindings(raw: Variant) -> Dictionary[String, int]:
	var out: Dictionary[String, int] = {}
	if raw is not Dictionary: return out
	for action: String in BmkPhysicalInput.ACTIONS:
		var code: Variant = raw.get(action)
		if not (code is int or code is float) or float(code) != floor(float(code)) or not valid_key(int(code)) or out.values().has(int(code)):
			out.clear()
			return out
		out[action] = int(code)
	return out

func save(path: String = "") -> Error:
	var target: String = storage_path if path.is_empty() else path
	var store: BmkSaveStore = BmkSaveStore.new()
	return store.write_json(target,{"menu_language":menu_language,"preset":preset,"bindings":bindings,"custom_bindings":custom_bindings,"music_volume":music_volume,"sfx_volume":sfx_volume,"shake":shake,"flash":flash,"danger_zones":danger_zones,"touch":touch,"touch_layout":touch_layout})

func bind(action: String, code: int) -> bool:
	if action not in BmkPhysicalInput.ACTIONS or not valid_key(code): return false
	if preset != "custom": use_preset("custom")
	var other: Variant = bindings.find_key(code)
	if other != null: bindings[other] = bindings[action]
	bindings[action] = code
	custom_bindings = bindings.duplicate()
	return true

static func valid_key(code: int) -> bool:
	if code == KEY_M: return false
	return code >= KEY_A and code <= KEY_Z or code >= KEY_0 and code <= KEY_9 or code in [KEY_LEFT,KEY_RIGHT,KEY_UP,KEY_DOWN,KEY_SPACE,KEY_SHIFT,BmkPhysicalInput.RIGHT_SHIFT]

func use_preset(id: String) -> void:
	if id == "custom":
		if custom_bindings.is_empty():
			custom_bindings = BmkPhysicalInput.preset_bindings(preset)
		bindings = custom_bindings.duplicate()
	else:
		bindings = BmkPhysicalInput.preset_bindings(id)
	preset = id

func copy_preset(id: String) -> void:
	custom_bindings = BmkPhysicalInput.preset_bindings(id)
	use_preset("custom")
