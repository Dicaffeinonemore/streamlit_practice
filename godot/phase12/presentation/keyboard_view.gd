class_name BmkKeyboardView
extends Control
## game-ui.js UX.drawKeyboard(box, {focus, pressed}): the keyboard picture with each bound key
## coloured by action kind, unfocused keys dimmed and pressed keys lit.
signal key_chosen(code: String)

const KB_W: float = 15.75
const KB_H: float = 5.0
const COLORS: Dictionary = {"move":Color("3a74d8"),"jump":Color("2f9e5b"),"attack":Color("c8323c"),"dash":Color("1d9fa6"),"special":Color("d9a514"),"magic":Color("8352d8"),"skill":Color("d9661c"),"system":Color("5d5668")}
var keys: Array = []
var settings: BmkSettings
var character: String = "barel"
## Actions to keep bright (null = all) and actions shown pressed.
var focus: Array = []
var use_focus: bool = false
var pressed: Dictionary = {}
var font: SystemFont

func _init() -> void:
	keys.append(["Escape","ESC",0.0,0.0,1.0])
	for i: int in range(10): keys.append(["Digit" + "1234567890"[i],"1234567890"[i],1.1 + i,0.0,1.0])
	keys.append(["Tab","TAB",0.0,1.0,1.5])
	for i: int in range(10): keys.append(["Key" + "QWERTYUIOP"[i],"QWERTYUIOP"[i],1.5 + i,1.0,1.0])
	keys.append(["CapsLock","CAPS",0.0,2.0,1.75])
	for i: int in range(9): keys.append(["Key" + "ASDFGHJKL"[i],"ASDFGHJKL"[i],1.75 + i,2.0,1.0])
	keys.append(["Enter","ENTER",10.75,2.0,1.75])
	keys.append(["ShiftLeft","SHIFT",0.0,3.0,2.25])
	for i: int in range(7): keys.append(["Key" + "ZXCVBNM"[i],"ZXCVBNM"[i],2.25 + i,3.0,1.0])
	keys.append(["ShiftRight","SHIFT",9.25,3.0,2.5])
	keys.append(["ControlLeft","CTRL",0.0,4.0,1.5])
	keys.append(["Space","SPACE",3.0,4.0,6.0])
	keys.append(["ControlRight","CTRL",9.75,4.0,1.5])
	keys.append(["ArrowUp","↑",13.75,3.0,1.0])
	keys.append(["ArrowLeft","←",12.75,4.0,1.0])
	keys.append(["ArrowDown","↓",13.75,4.0,1.0])
	keys.append(["ArrowRight","→",14.75,4.0,1.0])
	font = SystemFont.new()
	font.font_names = PackedStringArray(["Malgun Gothic","Noto Sans CJK KR","Arial"])
	font.font_weight = 700
	mouse_filter = Control.MOUSE_FILTER_IGNORE

func show_keys(focus_actions: Array, pressed_actions: Array) -> void:
	focus = focus_actions
	use_focus = true
	pressed.clear()
	for a: Variant in pressed_actions: pressed[str(a)] = true
	queue_redraw()

func _get_minimum_size() -> Vector2:
	return Vector2(0,size.x * KB_H / KB_W)

## The aria-label text: "Z 공격, X 점프, ..." for the focused bound keys.
func label() -> String:
	var parts: PackedStringArray = []
	var map: Dictionary = BmkKeyNames.bindings(settings)
	for k: Array in keys:
		var action: String = action_for(map,str(k[0]))
		if not action.is_empty() and (not use_focus or focus.has(action)): parts.append("%s %s" % [BmkKeyNames.key_name(str(k[0])),BmkKeyNames.short_name(action,character)])
	return "키보드 배치: " + ", ".join(parts)

func action_for(map: Dictionary, code: String) -> String:
	for action: String in BmkPhysicalInput.ACTIONS:
		if map.get(action) == code: return action
	return ""

func alias_for(map: Dictionary, code: String) -> String:
	if settings == null or settings.preset == "arcade" or map.values().has(code): return ""
	return BmkPhysicalInput.ALIASES.get(BmkKeyNames.key_for(code), "")

func key_rect(k: Array) -> Rect2:
	var unit := size.x / KB_W
	return Rect2(float(k[2])*unit, float(k[3])*unit, (float(k[4])-0.12)*unit, 0.88*unit)

func _gui_input(event: InputEvent) -> void:
	var click := event as InputEventMouseButton
	if click == null or click.button_index != MOUSE_BUTTON_LEFT or not click.pressed: return
	for k: Array in keys:
		if key_rect(k).has_point(click.position):
			key_chosen.emit(str(k[0]))
			accept_event()
			return

func _draw() -> void:
	var w: float = size.x
	var cqi: float = w / 100.0
	var cap := StyleBoxFlat.new()
	cap.set_corner_radius_all(maxi(2,roundi(0.9 * cqi)))
	var map: Dictionary = BmkKeyNames.bindings(settings)
	for k: Array in keys:
		var code: String = str(k[0])
		var action: String = action_for(map,code)
		var alias := alias_for(map,code)
		if action.is_empty(): action = alias
		var kind: String = str(BmkKeyNames.KIND[action]) if not action.is_empty() else ("system" if BmkKeyNames.SYSTEM.has(code) else "")
		var text: String = BmkKeyNames.short_name(action,character) if not action.is_empty() else str(BmkKeyNames.SYSTEM.get(code,""))
		var dim: bool = use_focus and not (not action.is_empty() and focus.has(action))
		var on: bool = not action.is_empty() and pressed.has(action)
		var r: Rect2 = key_rect(k)
		if on: r.position.y += 0.4 * cqi
		var kc: Color = COLORS.get(kind,Color("4a4256"))
		var bg: Color = Color("1b1722")
		var border: Color = Color("4a4256")
		var fg: Color = Color("8f8699")
		var act_color: Color = Color.WHITE
		if not kind.is_empty():
			bg = kc.lerp(Color("120e16"),0.45)
			border = kc
			fg = Color("f1ecf4")
		if on:
			bg = Color("ffd23f")
			fg = Color("222211")
			act_color = fg
		var alpha: float = 0.28 if dim else 1.0
		var bottom: float = (0.2 if on else 0.6) * cqi
		cap.bg_color = Color(bg,alpha)
		cap.border_color = Color(border,alpha)
		cap.set_border_width_all(1)
		cap.border_width_bottom = maxi(1,roundi(bottom))
		draw_style_box(cap,r)
		if not alias.is_empty() and not on:
			draw_rect(r, Color("1b1722"))
			var corners := [r.position,Vector2(r.end.x,r.position.y),r.end,Vector2(r.position.x,r.end.y)]
			for edge: int in range(4):
				draw_dashed_line(corners[edge],corners[(edge+1)%4],Color(kc,alpha),1.0,3.0)
		var cap_size: int = maxi(7,roundi(1.5 * cqi))
		draw_string(font,r.position + Vector2(0.6 * cqi + 1,cap_size + 0.5 * cqi),str(k[1]),HORIZONTAL_ALIGNMENT_LEFT,-1,cap_size,Color(fg,alpha))
		if text.is_empty(): continue
		var act_size: int = maxi(6,roundi(1.35 * cqi))
		var lines: PackedStringArray = [text]
		if font.get_string_size(text,HORIZONTAL_ALIGNMENT_LEFT,-1,act_size).x > r.size.x - 2 and text.contains(" "): lines = text.split(" ")
		var y: float = r.end.y - bottom - 2 - (lines.size() - 1) * (act_size + 1)
		for line: String in lines:
			draw_string(font,Vector2(r.position.x,y),line,HORIZONTAL_ALIGNMENT_CENTER,r.size.x,act_size,Color(act_color if kind != "" else fg,alpha))
			y += act_size + 1
