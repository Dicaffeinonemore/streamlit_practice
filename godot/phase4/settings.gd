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

static func read(path: String = PATH) -> BmkSettings:
	var result: BmkSettings = BmkSettings.new()
	if not FileAccess.file_exists(path): return result
	var raw: Variant = JSON.parse_string(FileAccess.get_file_as_string(path))
	if raw is not Dictionary: return result
	if raw.get("preset") in ["arcade","wasd","custom"]: result.preset = raw["preset"]
	for key: String in ["music_volume","sfx_volume"]:
		var value: Variant = raw.get(key)
		if (value is int or value is float) and is_finite(float(value)) and float(value) >= 0 and float(value) <= 1: result.set(key,float(value))
	for key: String in ["shake","flash","danger_zones"]:
		if raw.get(key) is bool: result.set(key,raw[key])
	if raw.get("bindings") is Dictionary:
		var used: Dictionary[int,bool] = {}
		for action: String in BmkPhysicalInput.ACTIONS:
			var code: Variant = raw["bindings"].get(action)
			if (code is float or code is int) and float(code) == floor(float(code)) and int(code) > 0 and not used.has(int(code)):
				result.bindings[action] = int(code)
				used[int(code)] = true
	if result.preset == "custom" and result.bindings.size() != BmkPhysicalInput.ACTIONS.size():
		result.preset = "arcade"
		result.bindings.clear()
	return result

func save(path: String = PATH) -> Error:
	var file: FileAccess = FileAccess.open(path,FileAccess.WRITE)
	if file == null: return FileAccess.get_open_error()
	file.store_string(JSON.stringify({"preset":preset,"bindings":bindings,"music_volume":music_volume,"sfx_volume":sfx_volume,"shake":shake,"flash":flash,"danger_zones":danger_zones}))
	return file.get_error()

func bind(action: String, code: int) -> bool:
	if action not in BmkPhysicalInput.ACTIONS or code <= 0 or code in [KEY_ESCAPE,KEY_F1,KEY_F2,KEY_F9,KEY_F10,KEY_F11,KEY_M,KEY_R]: return false
	for other: String in bindings:
		if other != action and bindings[other] == code: return false
	bindings[action] = code
	preset = "custom"
	return true
