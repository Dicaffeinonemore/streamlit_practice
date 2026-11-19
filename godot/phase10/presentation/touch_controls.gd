class_name BmkTouchControls
extends Control
## game-ui.js touch controls (index.html #touchControls): the 8-way movement lever and the
## action pad feed the same canonical action codes as the keyboard (inputDown / inputUp),
## multi-touch safe (a code is released only when no finger still holds it). The layout editor
## moves, resizes and hides each control in --u units and persists it with the settings.
## Geometry follows the CSS: --u = clamp(40px, 12.5vmin, 64px) x size, safe-area margins,
## and the approved iPhone mini insets. Everything is drawn inside the 960 x 540 game area.
signal edit_finished
const NO_POINTER: int = -999999
const MOUSE_POINTER: int = -1000
const SKILL_KEYS: Dictionary = {"KeyU":"thrust","KeyH":"slam","KeyO":"whirl","KeyP":"leap","KeyL":"redwave"}
## [code, kind, x, y, s, label] in DOM order (later ones are on top).
const BUTTONS: Array = [
	["KeyJ","attack",1.0,1.0,1.6,"공격"],["Space","jump",2.87,0.67,1.15,"점프"],["ShiftLeft","dash",2.68,1.89,0.9,"대시"],
	["KeyI","magic",1.95,2.65,0.9,"뇌격"],["KeyK","special",0.93,2.90,0.9,"필살기 흑월참"],
	["KeyU","skill",1.42,4.02,0.9,"견제 찌르기"],["KeyH","skill",2.57,3.61,0.9,"내려찍기"],["KeyO","skill",3.47,2.79,0.9,"회전 베기"],
	["KeyP","skill",3.97,1.69,0.9,"점프 강하"],["KeyL","skill",4.00,0.47,0.9,"붉은 파동"]]
const VIESA_LABELS: Dictionary = {"KeyJ":"화살 / 공중 체공 사격","KeyH":"근접 콤보","KeyU":"화살 연사","KeyL":"모아 쏘기 (유지: 최대 3단)","KeyO":"대시 → 지상 백플립","KeyP":"대시 → 공중 백플립","KeyK":"필살기 흑월 난사"}
const ICON_EFFECTS: Dictionary = {"thrust":"slash","slam":"impact","whirl":"moon","leap":"lightning","redwave":"wave"}
const SKILL_SYMBOLS: String = "assets/runtime/d878bfe05a598bfba82323c9.png"
const MOON: PackedFloat32Array = [15.5,2.5,14.04,2.31,12.57,2.35,11.12,2.61,9.74,3.1,8.44,3.79,7.26,4.68,6.24,5.73,5.39,6.93,4.74,8.25,4.3,9.65,4.08,11.11,4.08,12.58,4.32,14.03,4.77,15.43,5.44,16.74,6.3,17.93,7.33,18.98,8.52,19.85,9.82,20.53,11.21,21.01,12.66,21.26,14.13,21.28,15.59,21.08,17.0,20.65,18.32,20.01,19.53,19.18,20.6,18.16,21.5,17.0,20.03,17.45,18.5,17.6,16.97,17.44,15.49,17.0,14.14,16.27,12.95,15.3,11.97,14.11,11.25,12.75,10.8,11.28,10.65,9.75,10.81,8.22,11.25,6.74,11.98,5.39,12.95,4.2,14.14,3.22]
const CURVE: PackedFloat32Array = [8.0,18.2,8.45,17.64,8.92,17.15,9.4,16.74,9.89,16.4,10.39,16.14,10.91,15.95,11.45,15.84,12.0,15.8,12.55,15.84,13.09,15.95,13.61,16.14,14.11,16.4,14.6,16.74,15.08,17.15,15.55,17.64,16.0,18.2]
var game: BmkMenuGame
var settings: BmkSettings
var editing: bool = false
var selected: String = ""
var drag: Dictionary = {}
## pointer id -> action code held by that finger.
var touches: Dictionary = {}
var stick_id: int = NO_POINTER
var stick_dirs: Dictionary = {}
var knob: Vector2 = Vector2.ZERO
var shown: bool = false
## Test hooks: window size and safe-area insets in device pixels.
var test_window: Vector2 = Vector2.ZERO
var test_insets: Dictionary = {}
var edit_bar: PanelContainer
var edit_name: Label
var edit_hide: Button
var edit_need: Array[Button] = []
var font: Font
var icons: Dictionary = {}
static var gradients: Dictionary = {}

func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	size = Vector2(960,540)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	var system_font: SystemFont = SystemFont.new()
	system_font.font_names = PackedStringArray(["Malgun Gothic","Noto Sans CJK KR","Arial"])
	system_font.font_weight = 700
	font = system_font
	build_edit_bar()
	visible = false

func build_edit_bar() -> void:
	edit_bar = PanelContainer.new()
	var style: StyleBoxFlat = StyleBoxFlat.new()
	style.bg_color = Color("140f1ef2")
	style.border_color = Color("82738e")
	style.set_border_width_all(1)
	style.set_corner_radius_all(10)
	style.set_content_margin_all(6)
	edit_bar.add_theme_stylebox_override("panel",style)
	var row: HBoxContainer = HBoxContainer.new()
	row.add_theme_constant_override("separation",6)
	edit_bar.add_child(row)
	edit_name = Label.new()
	edit_name.custom_minimum_size = Vector2(110,0)
	edit_name.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	edit_name.add_theme_color_override("font_color",Color("ffe27a"))
	edit_name.add_theme_font_override("font",font)
	edit_name.add_theme_font_size_override("font_size",13)
	row.add_child(edit_name)
	for spec: Array in [["smaller","−",true],["bigger","+",true],["hide","숨기기",true],["reset","원위치",true],["resetAll","전체 원위치",false],["done","완료",false]]:
		var button: Button = Button.new()
		button.text = str(spec[1])
		button.custom_minimum_size = Vector2(40,38)
		button.add_theme_font_override("font",font)
		button.add_theme_font_size_override("font_size",14)
		# #touchEditBar button: #292139 with a #82738e border; the done button is #63263a.
		for state: String in ["normal","hover","pressed","disabled","focus"]:
			var box: StyleBoxFlat = StyleBoxFlat.new()
			box.bg_color = Color("63263a") if spec[0] == "done" else Color("292139")
			if state == "pressed": box.bg_color = box.bg_color.lightened(0.15)
			if state == "focus": box.draw_center = false
			box.border_color = Color("82738e")
			box.set_border_width_all(1)
			box.set_corner_radius_all(6)
			box.content_margin_left = 10
			box.content_margin_right = 10
			button.add_theme_stylebox_override(state,box)
		button.add_theme_color_override("font_color",Color.WHITE)
		button.add_theme_color_override("font_disabled_color",Color(1,1,1,0.4))
		var action: String = spec[0]
		button.pressed.connect(func() -> void: edit_action(action))
		row.add_child(button)
		if bool(spec[2]): edit_need.append(button)
		if action == "hide": edit_hide = button
	edit_bar.visible = false
	add_child(edit_bar)

# ------------------------------------------------------------------ geometry
func window_size() -> Vector2:
	if test_window != Vector2.ZERO: return test_window
	var w: Vector2 = Vector2(get_window().size) if get_window() != null else Vector2.ZERO
	return w if w.x > 0 and w.y > 0 else Vector2(960,540)

## Device pixels per game unit (canvas_items stretch, integer scale when it fits).
func stretch() -> float:
	var w: Vector2 = window_size()
	var k: float = minf(w.x / 960.0,w.y / 540.0)
	if str(ProjectSettings.get_setting("display/window/stretch/scale_mode","fractional")) == "integer" and k >= 1: k = floorf(k)
	return maxf(0.01,k)

## Device pixels per CSS pixel.
func css_scale() -> float:
	if test_window != Vector2.ZERO: return 1.0
	if OS.get_name() == "Android": return maxf(1.0,DisplayServer.screen_get_dpi() / 160.0)
	return maxf(1.0,DisplayServer.screen_get_scale())

## Game units per CSS pixel.
func css() -> float:
	return css_scale() / stretch()

## --u = clamp(40px, 12.5vmin, 64px) * --ui-scale, in game units.
func unit() -> float:
	var w: Vector2 = window_size()
	var vmin: float = minf(w.x,w.y) / css_scale()
	return clampf(0.125 * vmin,40,64) * float(settings.touch_layout.get("scale",1.0)) * css()

## --game-safe-*: env(safe-area-inset-*), or the mini profile's insets in landscape; in game units
## measured from the 960 x 540 area (letterbox bars already cover part of an inset).
func insets() -> Dictionary:
	var w: Vector2 = window_size()
	var px: Dictionary = {"left":0.0,"right":0.0,"top":0.0,"bottom":0.0}
	if not test_insets.is_empty(): px = test_insets.duplicate()
	elif OS.get_name() in ["Android","iOS"]:
		var safe: Rect2i = DisplayServer.get_display_safe_area()
		var screen: Vector2i = DisplayServer.screen_get_size()
		px = {"left":float(safe.position.x),"top":float(safe.position.y),"right":float(screen.x - safe.end.x),"bottom":float(screen.y - safe.end.y)}
	if BmkTouchLayout.mini_matches() and w.x > w.y:
		for side: String in px: px[side] = maxf(float(px[side]),float(BmkTouchLayout.MINI["insets"][side]) * css_scale())
	var k: float = stretch()
	var bar: Vector2 = (w - Vector2(960,540) * k) / 2
	return {"left":maxf(0,float(px["left"]) - bar.x) / k,"right":maxf(0,float(px["right"]) - bar.x) / k,"top":maxf(0,float(px["top"]) - bar.y) / k,"bottom":maxf(0,float(px["bottom"]) - bar.y) / k}

func item(id: String) -> Dictionary:
	return settings.touch_layout["items"].get(id,{"dx":0.0,"dy":0.0,"k":1.0,"hide":false})

func item_ref(id: String) -> Dictionary:
	var items: Dictionary = settings.touch_layout["items"]
	if not items.has(id): items[id] = {"dx":0.0,"dy":0.0,"k":1.0,"hide":false}
	return items[id]

func spec(code: String) -> Array:
	for b: Array in BUTTONS:
		if b[0] == code: return b
	return []

## [center, radius] of a control, including its offset and size factor.
func geometry(id: String) -> Array:
	var u: float = unit()
	var ins: Dictionary = insets()
	var it: Dictionary = item(id)
	var offset: Vector2 = Vector2(float(it["dx"]),float(it["dy"])) * u
	if id == "stick":
		var side: float = u * 2.9
		var left: float = maxf(18 * css(),float(ins["left"]))
		var bottom: float = maxf(18 * css(),float(ins["bottom"]))
		return [Vector2(left + side / 2,540 - bottom - side / 2) + offset,side / 2 * float(it["k"])]
	var b: Array = spec(id)
	var right: float = maxf(14 * css(),float(ins["right"]))
	var bottom_: float = maxf(14 * css(),float(ins["bottom"]))
	return [Vector2(960 - right - float(b[2]) * u,540 - bottom_ - float(b[3]) * u) + offset,float(b[4]) * u / 2 * float(it["k"])]

func viesa() -> bool:
	return game != null and game.session != null and game.session.player.is_viesa()

## Controls in DOM order; Viesa's pad has no magic button (it is display:none, even when editing).
func controls() -> Array[String]:
	var list: Array[String] = ["stick"]
	for b: Array in BUTTONS:
		if b[0] == "KeyI" and viesa(): continue
		list.append(b[0])
	return list

func label(id: String) -> String:
	if id == "stick": return "이동 레버"
	if viesa() and VIESA_LABELS.has(id): return VIESA_LABELS[id]
	return str(spec(id)[5])

## Topmost control under a point (edit mode also hits hidden ones and the selection first).
func hit_test(at: Vector2) -> String:
	var order: Array[String] = controls()
	order.reverse()
	if editing and not selected.is_empty():
		order.erase(selected)
		order.push_front(selected)
	for id: String in order:
		if bool(item(id)["hide"]) and not editing: continue
		var g: Array = geometry(id)
		if at.distance_to(g[0]) <= float(g[1]): return id
	return ""

# ------------------------------------------------------------------ visibility and input
func playing() -> bool:
	if game == null or game.session == null or game.menu == null: return false
	var s: BmkStageSimulation = game.session as BmkStageSimulation
	return not game.menu.visible and not game.clock.paused and s != null and s.mode == "play"

func _process(_delta: float) -> void:
	if settings == null: return
	var show: bool = editing or settings.touch and playing()
	if show != shown:
		# Hiding releases captured pointers (lostpointercapture -> inputUp).
		if not show: release_all()
		shown = show
		visible = show
	if visible:
		layout_edit_bar()
		queue_redraw()

func press(code: String) -> void:
	game.session.input.press(code,game.session.tick)

func release(code: String) -> void:
	game.session.input.release(code)

## UX.clearTouch(): forget fingers without releasing (clearInput already cleared the keys).
func clear_touch() -> void:
	touches.clear()
	reset_stick(false)

func release_all() -> void:
	for pointer: int in touches.keys().duplicate(): pointer_up(pointer)
	if stick_id != NO_POINTER: reset_stick(true)

func _input(event: InputEvent) -> void:
	if not visible: return
	var pointer: int
	var at: Vector2
	var kind: String = ""
	if event is InputEventScreenTouch:
		var t: InputEventScreenTouch = event as InputEventScreenTouch
		pointer = t.index
		at = t.position
		kind = "down" if t.pressed and not t.canceled else "up"
	elif event is InputEventScreenDrag:
		pointer = (event as InputEventScreenDrag).index
		at = (event as InputEventScreenDrag).position
		kind = "move"
	elif event is InputEventMouseButton and (event as InputEventMouseButton).button_index == MOUSE_BUTTON_LEFT and event.device != InputEvent.DEVICE_ID_EMULATION:
		pointer = MOUSE_POINTER
		at = (event as InputEventMouseButton).position
		kind = "down" if (event as InputEventMouseButton).pressed else "up"
	elif event is InputEventMouseMotion and event.device != InputEvent.DEVICE_ID_EMULATION:
		pointer = MOUSE_POINTER
		at = (event as InputEventMouseMotion).position
		kind = "move"
	else: return
	if editing:
		if edit_bar.visible and edit_bar.get_global_rect().has_point(at): return
		get_viewport().set_input_as_handled()
		edit_pointer(kind,pointer,at)
		return
	if kind == "down":
		if pointer_down(pointer,at): get_viewport().set_input_as_handled()
	elif kind == "up": pointer_up(pointer)
	elif pointer == stick_id: move_stick(at)

func pointer_down(pointer: int, at: Vector2) -> bool:
	var id: String = hit_test(at)
	if id.is_empty(): return false
	if not playing(): return true
	if id == "stick":
		if stick_id != NO_POINTER: return true
		stick_id = pointer
		move_stick(at)
		return true
	touches[pointer] = id
	press(id)
	return true

func pointer_up(pointer: int) -> void:
	if pointer == stick_id: reset_stick(true)
	if touches.has(pointer):
		var code: String = touches[pointer]
		touches.erase(pointer)
		if code not in touches.values(): release(code)

## moveStick(): 8 directions with a 22% dead zone and a 0.41 diagonal ratio; knob limited to 55%.
func move_stick(at: Vector2) -> void:
	var g: Array = geometry("stick")
	var r: float = float(g[1])
	var d: Vector2 = at - (g[0] as Vector2)
	var length: float = d.length()
	var limit: float = r * 0.55
	var dirs: Dictionary = {}
	if length > r * 0.22:
		if absf(d.x) > absf(d.y) * 0.41: dirs["KeyA" if d.x < 0 else "KeyD"] = true
		if absf(d.y) > absf(d.x) * 0.41: dirs["KeyW" if d.y < 0 else "KeyS"] = true
	if length > limit: d *= limit / length
	knob = d
	set_stick(dirs)

func set_stick(dirs: Dictionary) -> void:
	for code: String in ["KeyA","KeyD","KeyW","KeyS"]:
		if dirs.has(code) and not stick_dirs.has(code):
			stick_dirs[code] = true
			press(code)
		elif not dirs.has(code) and stick_dirs.has(code):
			stick_dirs.erase(code)
			release(code)

func reset_stick(release_keys: bool) -> void:
	if release_keys: set_stick({})
	else: stick_dirs.clear()
	stick_id = NO_POINTER
	knob = Vector2.ZERO

# ------------------------------------------------------------------ layout editor
func start_edit() -> void:
	editing = true
	selected = ""
	drag = {}
	if game != null: game.physical.clear(game.session)
	clear_touch()
	edit_bar.visible = true
	shown = true
	visible = true
	refresh_edit_bar()

func end_edit() -> void:
	if not editing: return
	editing = false
	selected = ""
	drag = {}
	settings.save()
	edit_bar.visible = false
	edit_finished.emit()

func edit_pointer(kind: String, pointer: int, at: Vector2) -> void:
	if kind == "down":
		var id: String = hit_test(at)
		selected = id
		refresh_edit_bar()
		if id.is_empty(): return
		var it: Dictionary = item_ref(id)
		drag = {"pointer":pointer,"id":id,"at":at,"dx":float(it["dx"]),"dy":float(it["dy"])}
	elif kind == "move":
		if drag.is_empty() or int(drag["pointer"]) != pointer: return
		var it: Dictionary = item_ref(str(drag["id"]))
		var u: float = unit()
		it["dx"] = float(drag["dx"]) + (at.x - (drag["at"] as Vector2).x) / u
		it["dy"] = float(drag["dy"]) + (at.y - (drag["at"] as Vector2).y) / u
		keep_on_screen(str(drag["id"]))
	elif not drag.is_empty() and int(drag["pointer"]) == pointer: drag = {}

## keepOnScreen(): pulls the offset back so the control stays inside the game area.
func keep_on_screen(id: String) -> void:
	var it: Dictionary = item_ref(id)
	var g: Array = geometry(id)
	var c: Vector2 = g[0]
	var r: float = float(g[1])
	var u: float = unit()
	if c.x - r < 0: it["dx"] = float(it["dx"]) - (c.x - r) / u
	elif c.x + r > 960: it["dx"] = float(it["dx"]) - (c.x + r - 960) / u
	if c.y - r < 0: it["dy"] = float(it["dy"]) - (c.y - r) / u
	elif c.y + r > 540: it["dy"] = float(it["dy"]) - (c.y + r - 540) / u
	refresh_edit_bar()

func edit_action(action: String) -> void:
	if action == "done":
		end_edit()
		return
	if action == "resetAll":
		settings.touch_layout["items"] = {}
		refresh_edit_bar()
		return
	if selected.is_empty(): return
	var it: Dictionary = item_ref(selected)
	if action == "bigger": it["k"] = minf(2,roundf((float(it["k"]) + 0.1) * 10) / 10)
	if action == "smaller": it["k"] = maxf(0.5,roundf((float(it["k"]) - 0.1) * 10) / 10)
	if action == "hide": it["hide"] = not bool(it["hide"])
	if action == "reset":
		it["dx"] = 0.0
		it["dy"] = 0.0
		it["k"] = 1.0
		it["hide"] = false
	keep_on_screen(selected)

func refresh_edit_bar() -> void:
	edit_name.text = label(selected) if not selected.is_empty() else "키를 끌어서 옮기세요"
	edit_hide.text = "보이기" if not selected.is_empty() and bool(item(selected)["hide"]) else "숨기기"
	for button: Button in edit_need: button.disabled = selected.is_empty()

func layout_edit_bar() -> void:
	if not edit_bar.visible: return
	edit_bar.reset_size()
	edit_bar.position = Vector2((960 - edit_bar.size.x) / 2,maxf(10 * css(),float(insets()["top"])))

# ------------------------------------------------------------------ drawing
func radial(stops: Array, from: Vector2 = Vector2(0.5,0.5), radius: float = 0.70710678) -> GradientTexture2D:
	var key: String = str(stops) + str(from) + str(radius)
	if not gradients.has(key):
		var g: Gradient = Gradient.new()
		var offsets: PackedFloat32Array = []
		var colors: PackedColorArray = []
		for s: Array in stops:
			offsets.append(float(s[0]))
			colors.append(Color(str(s[1])))
		g.offsets = offsets
		g.colors = colors
		var tex: GradientTexture2D = GradientTexture2D.new()
		tex.gradient = g
		tex.fill = GradientTexture2D.FILL_RADIAL
		tex.fill_from = from
		tex.fill_to = from + Vector2(radius,0)
		tex.width = 128
		tex.height = 128
		gradients[key] = tex
	return gradients[key]

func circle_points(c: Vector2, r: float, n: int = 48) -> PackedVector2Array:
	var points: PackedVector2Array = []
	for i: int in range(n): points.append(c + Vector2(cos(TAU * i / n),sin(TAU * i / n)) * r)
	return points

## A textured disc (border-radius: 50% with overflow: hidden).
func disc(c: Vector2, r: float, tex: Texture2D, modulate_: Color) -> void:
	var points: PackedVector2Array = circle_points(c,r)
	var uvs: PackedVector2Array = []
	for i: int in range(points.size()): uvs.append(Vector2(0.5,0.5) + Vector2(cos(TAU * i / points.size()),sin(TAU * i / points.size())) * 0.5)
	draw_polygon(points,PackedColorArray([modulate_]),uvs,tex)

func ring(c: Vector2, r: float, width: float, color: Color) -> void:
	draw_arc(c,maxf(0,r - width / 2),0,TAU,64,color,width,true)

func svg(c: Vector2, box: float, flat: PackedFloat32Array, scale_: float = 24.0) -> PackedVector2Array:
	var points: PackedVector2Array = []
	for i: int in range(0,flat.size(),2): points.append(c + (Vector2(flat[i],flat[i + 1]) - Vector2(scale_ / 2,scale_ / 2)) / scale_ * box)
	return points

func skill_icon(id: String) -> Texture2D:
	if icons.has(id): return icons[id]
	var image: Image = Image.create(96,96,false,Image.FORMAT_RGBA8)
	var source: Texture2D
	var region: Rect2
	if id == "thrust" or id == "redwave":
		source = game.bank.source_image(SKILL_SYMBOLS)
		var w: float = source.get_width() / 2.0
		region = Rect2(0 if id == "thrust" else w,0,w,source.get_height())
	else:
		var a: BmkAnimationAsset = game.bank.animation("barel_art." + str(ICON_EFFECTS[id]))
		var n: int = a.sprite_frames.get_frame_count(&"source")
		source = a.sprite_frames.get_frame_texture(&"source",mini(n - 1,floori(0.4 * n)))
		region = Rect2(Vector2.ZERO,source.get_size())
	var picture: Image = source.get_image()
	if picture != null:
		if picture.is_compressed(): picture.decompress()
		picture.convert(Image.FORMAT_RGBA8)
		picture = picture.get_region(Rect2i(region))
		picture.resize(96,96,Image.INTERPOLATE_BILINEAR)
		image = picture
	icons[id] = ImageTexture.create_from_image(image)
	return icons[id]

func _draw() -> void:
	if settings == null or game == null or game.session == null: return
	if editing: draw_rect(Rect2(0,0,960,540),Color("05030acc"))
	var alpha: float = float(settings.touch_layout.get("alpha",0.55))
	var u: float = unit()
	var line: float = 2 * css()
	for id: String in controls():
		var it: Dictionary = item(id)
		var hidden: bool = bool(it["hide"])
		if hidden and not editing: continue
		var g: Array = geometry(id)
		var c: Vector2 = g[0]
		var k: float = float(it["k"])
		var active: bool = id == "stick" and stick_id != NO_POINTER or id in touches.values()
		var opacity: float
		if id == "stick": opacity = alpha + (0.3 if active else 0.0)
		else: opacity = alpha + (0.35 if active else 0.0)
		if editing and hidden: opacity = 0.2
		if editing and id == selected: opacity = 0.95
		opacity = minf(1,opacity)
		if id == "stick": draw_stick(c,float(g[1]),k,u,line,opacity)
		else: draw_button(id,c,float(g[1]),k,u,line,opacity,active)
		if editing and id == selected: ring(c,float(g[1]) + 3 * css() + 1.5 * css(),3 * css(),Color("ffd36b"))

func draw_stick(c: Vector2, r: float, k: float, u: float, line: float, opacity: float) -> void:
	disc(c,r,radial([[0,"#1a1424"],[0.34,"#1a1424"],[0.35,"#2a2136"],[0.62,"#2a2136"],[0.63,"#120e19"],[1,"#120e19"]]),Color(1,1,1,opacity))
	ring(c,r,line * k,Color("8d7c99",opacity))
	var side: float = r * 2
	for tri: PackedFloat32Array in [PackedFloat32Array([50,5,57,14,43,14]),PackedFloat32Array([50,95,57,86,43,86]),PackedFloat32Array([5,50,14,43,14,57]),PackedFloat32Array([95,50,86,43,86,57])]:
		draw_colored_polygon(svg(c,side,tri,100.0),Color("cdbfd6",0.55 * opacity))
	# Knob offsets live inside the scaled element, so they move k times as far (source quirk).
	var tip: Vector2 = c + knob * k
	if knob.length() > 0.01:
		draw_line(c,tip,Color("7a7083",opacity),u * 0.28 * k)
		draw_circle(tip,u * 0.14 * k,Color("7a7083",opacity))
		draw_circle(c,u * 0.14 * k,Color("7a7083",opacity))
	var kr: float = u * 1.15 / 2 * k
	draw_circle(tip + Vector2(0,u * 0.06 * k),kr,Color(0,0,0,0.5 * opacity))
	disc(tip,kr,radial([[0,"#ff9a9a"],[0.45,"#c1203a"],[1,"#5a0716"]],Vector2(0.35,0.3),0.955),Color(1,1,1,opacity))

func draw_button(id: String, c: Vector2, r: float, k: float, u: float, line: float, opacity: float, active: bool) -> void:
	var b: Array = spec(id)
	var kind: String = b[1]
	var s: BmkSimulation = game.session
	var p: BmkActorState = s.player
	var visual: float = r * (0.94 if active else 1.0)
	var background: Array = [[0,"#2c2238"],[1,"#0c0912"]]
	var border: Color = Color("a493ad")
	if kind == "attack":
		background = [[0,"#6b1a2a"],[1,"#250810"]]
		border = Color("e0a0ac")
	elif kind == "jump":
		background = [[0,"#1c3a5c"],[1,"#080f1c"]]
		border = Color("9cc8f0")
	var cooldown_ratio: float = 0.0
	var cooldown_text: String = ""
	if SKILL_KEYS.has(id):
		var skill: String = SKILL_KEYS[id]
		var cd: float = float(p.skill_cd.get(skill,0.0))
		var holding: bool = viesa() and skill == "redwave" and p.st == "skill" and p.viesa_action != null and p.viesa_action.phase == "snipe_draw"
		var disabled: bool = not holding and not s.player_controller.can_start_skill(s,skill)
		var base: float = 1.0
		for a: BmkAttackData in s.data.skills:
			if a.id == skill: base = a.cooldown_ms
		cooldown_ratio = 0.0 if viesa() and skill == "slam" else clampf(cd / base,0,1)
		cooldown_text = str(ceili(cd / 1000)) if cd > 0 else ""
		border = Color("4d4456") if disabled else Color("93d6ff")
	if active: border = Color("ffd36b")
	var special_ready: bool = kind == "special" and p.sp >= 100
	if special_ready and not active:
		border = Color("ffe14d")
		draw_circle(c,visual + 6 * css(),Color(1,0.88,0.3,0.25 * opacity))
	var inner: float = visual - line * k
	disc(c,visual,radial(background),Color(1,1,1,opacity))
	var box: float = visual * 2 * 0.64
	var ink: Color = Color("f4ecf6",opacity)
	match kind:
		"skill": disc(c,inner,skill_icon(SKILL_KEYS[id]),Color(1,1,1,opacity))
		"attack":
			draw_colored_polygon(svg(c,box,PackedFloat32Array([20.5,2.5,21.5,3.5,20,8.5,10.2,18.3,5.7,13.8,15.5,4])),ink)
			draw_colored_polygon(svg(c,box,PackedFloat32Array([4.2,12.3,5.6,10.9,13.1,18.4,11.7,19.8])),ink)
			draw_colored_polygon(svg(c,box,PackedFloat32Array([6.6,16.8,7.7,17.9,4.1,21.5,2.5,19.9])),ink)
		"jump":
			var w: float = box / 24 * 2.2
			draw_polyline(svg(c,box,PackedFloat32Array([12,15,12,3])),ink,w,true)
			draw_polyline(svg(c,box,PackedFloat32Array([6.5,8.5,12,3,17.5,8.5])),ink,w,true)
			draw_polyline(svg(c,box,PackedFloat32Array([4,21,20,21])),Color(ink,0.8 * opacity),w,true)
			draw_polyline(svg(c,box,CURVE),Color(ink,0.6 * opacity),w,true)
		"dash":
			var w: float = box / 24 * 2.4
			draw_polyline(svg(c,box,PackedFloat32Array([5,6,11,12,5,18])),ink,w,true)
			draw_polyline(svg(c,box,PackedFloat32Array([13,6,19,12,13,18])),ink,w,true)
		"magic":
			var bolt: PackedVector2Array = svg(c,box,PackedFloat32Array([13.5,2,4.5,13.5,10.5,13.5,8.5,22,17.5,10.5,11.5,10.5]))
			draw_colored_polygon(bolt,Color("9cc3ff",opacity))
			bolt.append(bolt[0])
			draw_polyline(bolt,Color("e8f3ff",opacity),box / 24 * 0.8,true)
		"special":
			draw_colored_polygon(svg(c,box,MOON),Color("ffd23f",opacity))
			draw_colored_polygon(svg(c,box,PackedFloat32Array([8,7,17,16,15.5,17.5,6.5,8.5])),Color("b0101e",opacity))
	if cooldown_ratio > 0: draw_cooldown(c,inner,cooldown_ratio,opacity)
	ring(c,visual,line * k,Color(border,opacity))
	if not cooldown_text.is_empty():
		var size_: int = maxi(8,roundi(u * 0.34))
		draw_string(font,c + Vector2(-visual,size_ * 0.36 + 2),cooldown_text,HORIZONTAL_ALIGNMENT_CENTER,visual * 2,size_,Color(0,0,0,opacity))
		draw_string(font,c + Vector2(-visual,size_ * 0.36),cooldown_text,HORIZONTAL_ALIGNMENT_CENTER,visual * 2,size_,Color(1,1,1,opacity))
	if kind == "magic":
		var size_: int = maxi(7,roundi(u * 0.26))
		draw_string(font,c + Vector2(visual * 0.15,visual * 0.88),str(p.mg),HORIZONTAL_ALIGNMENT_LEFT,-1,size_,Color("9cc3ff",opacity))

## .cool: a dark band rising from the bottom (scaleY(--cool)), clipped by the round button.
func draw_cooldown(c: Vector2, r: float, ratio: float, opacity: float) -> void:
	var color: Color = Color(4 / 255.0,2 / 255.0,9 / 255.0,0.76 * opacity)
	if ratio >= 1:
		draw_circle(c,r,color)
		return
	var s0: float = clampf((r - 2 * r * ratio) / r,-1,1)
	var a0: float = asin(s0)
	var points: PackedVector2Array = []
	var n: int = 32
	for i: int in range(n + 1):
		var a: float = lerpf(a0,PI - a0,float(i) / n)
		points.append(c + Vector2(cos(a),sin(a)) * r)
	if points.size() >= 3: draw_colored_polygon(points,color)
