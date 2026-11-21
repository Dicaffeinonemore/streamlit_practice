class_name BmkKeyNames
extends RefCounted
## game-ui.js key naming for the tutorial: UX.keyName(UX.options.bindings[action]), PRESET_INFO
## names and the keyboard drawing's short action names (SHORT / SHORT_VIESA / SYSTEM / KIND).

const PRESET_NAMES: Dictionary = {"arcade":"1 · 오락실 아케이드","wasd":"2 · PC 액션 (WASD)","custom":"3 · 사용자 설정"}
const KIND: Dictionary = {"KeyA":"move","KeyD":"move","KeyW":"move","KeyS":"move","Space":"jump","KeyJ":"attack","ShiftLeft":"dash","KeyK":"special","KeyI":"magic",
	"KeyU":"skill","KeyH":"skill","KeyO":"skill","KeyP":"skill","KeyL":"skill"}
const SHORT: Dictionary = {"KeyA":"◀이동","KeyD":"▶이동","KeyW":"▲이동","KeyS":"▼이동","Space":"점프","KeyJ":"공격","ShiftLeft":"대시","KeyK":"필살기","KeyI":"뇌격",
	"KeyU":"찌르기","KeyH":"내려 찍기","KeyO":"회전 베기","KeyP":"점프 강하","KeyL":"붉은 파동"}
const SHORT_VIESA: Dictionary = {"KeyJ":"화살","KeyH":"근접","KeyU":"연사","KeyL":"저격","KeyO":"지상 플립","KeyP":"공중 플립","KeyK":"흑월 난사"}
const SYSTEM: Dictionary = {"Escape":"일시 정지","Enter":"확인","KeyM":"소리"}
const ARROWS: Dictionary = {"ArrowLeft":"←","ArrowRight":"→","ArrowUp":"↑","ArrowDown":"↓"}

## The browser code (KeyboardEvent.code) for a native physical key.
static func code_for(key: int) -> String:
	if key >= KEY_A and key <= KEY_Z: return "Key" + String.chr(key)
	if key >= KEY_0 and key <= KEY_9: return "Digit" + String.chr(key)
	match key:
		KEY_LEFT: return "ArrowLeft"
		KEY_RIGHT: return "ArrowRight"
		KEY_UP: return "ArrowUp"
		KEY_DOWN: return "ArrowDown"
		KEY_SPACE: return "Space"
		KEY_SHIFT: return "ShiftLeft"
		KEY_ESCAPE: return "Escape"
		KEY_ENTER: return "Enter"
	return ""

## UX.keyName(code)
static func key_name(code: String) -> String:
	if ARROWS.has(code): return ARROWS[code]
	return code.trim_prefix("Key").trim_prefix("Digit").replace("Space","SPACE").replace("ShiftLeft","L SHIFT").replace("ShiftRight","R SHIFT")

## action -> browser code under the current preset or custom bindings.
static func bindings(settings: BmkSettings) -> Dictionary:
	var out: Dictionary = {}
	var codes: Array[int] = BmkPhysicalInput.WASD if settings != null and settings.preset == "wasd" else BmkPhysicalInput.ARCADE
	for i: int in range(BmkPhysicalInput.ACTIONS.size()):
		var action: String = BmkPhysicalInput.ACTIONS[i]
		var key: int = codes[i]
		if settings != null and settings.preset == "custom" and settings.bindings.has(action): key = settings.bindings[action]
		out[action] = code_for(key)
	return out

static func action_key(settings: BmkSettings, action: String) -> String:
	return key_name(str(bindings(settings).get(action,action)))

static func short_name(action: String, character: String) -> String:
	if character == "viesa" and SHORT_VIESA.has(action): return SHORT_VIESA[action]
	return str(SHORT.get(action,""))

static func preset_name(settings: BmkSettings) -> String:
	return str(PRESET_NAMES.get(settings.preset if settings != null else "arcade",PRESET_NAMES["arcade"]))
