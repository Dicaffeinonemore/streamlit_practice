class_name BmkSelectCard
extends Control
## 선택창의 카드 한 장. 사선(평행사변형) 모양은 _draw 로 직접 그리고,
## 일러스트는 UV 를 계산해 같은 다각형 안에만 그려서 마스크 없이 잘라냅니다.

signal card_pressed(card: BmkSelectCard)

const SLANT := 24.0
const BORDER := 2.0
const RATIO_COLLAPSED := 1.0
const RATIO_EXPANDED := 3.2
const EXPAND_TIME := 0.42

const C_PANEL := Color("1a1212")
const C_PANEL_LOCKED := Color("140e0e")
const C_LINE := Color("3a2a22")
const C_LINE_2 := Color("6b5640")
const C_RED := Color("e8434b")
const C_RED_FILL := Color("d8323b")
const C_GOLD := Color("c9a876")
const C_TEXT := Color("ede3d3")
const C_MUTED := Color("b9aa98")
const C_MUTED_2 := Color("a8998a")
const C_TRACK := Color(0.93, 0.89, 0.83, 0.14)

var data: Dictionary
var index := 0
var active := false
var locked := false

var border_color := C_LINE:
	set(v):
		border_color = v
		queue_redraw()

var _fonts: Dictionary
var _tween: Tween
var _hover_tween: Tween
var _art: ArtLayer
var _shade: ShadeLayer
var _collapsed: Control
var _expanded: Control
var _bars: Array[StatBar] = []
var _bar_targets: Array[float] = []
var _lock_mark: Label
var _saturation := 0.4
var _brightness := 0.5


# ---------------------------------------------------------------- 내부 레이어

class ArtLayer extends Control:
	var texture: Texture2D
	var focus := Vector2(0.5, 0.0):
		set(v):
			focus = v
			queue_redraw()
	var zoom := 1.04:
		set(v):
			zoom = v
			queue_redraw()

	func _notification(what: int) -> void:
		if what == NOTIFICATION_RESIZED:
			queue_redraw()

	func _draw() -> void:
		if texture == null or size.x <= BmkSelectCard.BORDER * 2.0:
			return
		var r := Rect2(Vector2(BmkSelectCard.BORDER, BmkSelectCard.BORDER), size - Vector2.ONE * BmkSelectCard.BORDER * 2.0)
		var pts := BmkSelectCard.para(r, BmkSelectCard.SLANT - 1.0)
		var ts := texture.get_size()
		# object-fit: cover + object-position(focus) + scale(zoom)
		var sc: float = max(r.size.x / ts.x, r.size.y / ts.y) * zoom
		var vis := r.size / sc
		var off := (ts - vis) * focus
		var uvs := PackedVector2Array()
		for p in pts:
			uvs.append((off + (p - r.position) / sc) / ts)
		draw_colored_polygon(pts, Color.WHITE, uvs, texture)


class ShadeLayer extends Control:
	# 아래쪽을 어둡게 깔아 글자가 잘 읽히도록 하는 그라데이션 (35% → 78%)
	func _notification(what: int) -> void:
		if what == NOTIFICATION_RESIZED:
			queue_redraw()

	func _draw() -> void:
		var b := BmkSelectCard.BORDER
		var r := Rect2(Vector2(b, b), size - Vector2.ONE * b * 2.0)
		var clear := Color(0.043, 0.031, 0.031, 0.0)
		var dark := Color(0.043, 0.031, 0.031, 0.97)
		_band(r, 0.35, 0.78, clear, dark)
		_band(r, 0.78, 1.0, dark, dark)

	func _band(r: Rect2, t0: float, t1: float, c0: Color, c1: Color) -> void:
		var s := BmkSelectCard.SLANT - 1.0
		var y0 := r.size.y * t0
		var y1 := r.size.y * t1
		var lx := func(y: float) -> float: return r.position.x + s * (1.0 - y / r.size.y)
		var rx := func(y: float) -> float: return r.position.x + r.size.x - s * (y / r.size.y)
		var pts := PackedVector2Array([
			Vector2(lx.call(y0), r.position.y + y0), Vector2(rx.call(y0), r.position.y + y0),
			Vector2(rx.call(y1), r.position.y + y1), Vector2(lx.call(y1), r.position.y + y1)])
		draw_polygon(pts, PackedColorArray([c0, c0, c1, c1]))


class StatBar extends Control:
	var color := Color("d8323b")
	var fill := 0.0:
		set(v):
			fill = v
			queue_redraw()

	func _draw() -> void:
		draw_rect(Rect2(Vector2.ZERO, size), BmkSelectCard.C_TRACK)
		draw_rect(Rect2(Vector2.ZERO, Vector2(size.x * fill, size.y)), color)


# ---------------------------------------------------------------- 공용 도우미

static func para(r: Rect2, s: float) -> PackedVector2Array:
	return PackedVector2Array([
		Vector2(r.position.x + s, r.position.y),
		Vector2(r.end.x, r.position.y),
		Vector2(r.end.x - s, r.end.y),
		Vector2(r.position.x, r.end.y)])


static func make_label(text: String, font: Font, font_size: int, color := C_TEXT) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_override("font", font)
	l.add_theme_font_size_override("font_size", font_size)
	l.add_theme_color_override("font_color", color)
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return l


# ---------------------------------------------------------------- 구성

func setup(card_data: Dictionary, card_index: int, fonts: Dictionary) -> void:
	data = card_data.duplicate()
	index = card_index
	_fonts = fonts
	locked = data.get("locked", false)
	clip_contents = true
	size_flags_horizontal = Control.SIZE_EXPAND_FILL
	size_flags_stretch_ratio = RATIO_COLLAPSED
	mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	mouse_entered.connect(_on_hover.bind(true))
	mouse_exited.connect(_on_hover.bind(false))
	if locked:
		_build_locked()
	else:
		data["name"] = BmkCopy.text("HERO_" + data["id"])
		data["class_name"] = BmkCopy.text("HERO_JOB_" + data["id"])
		data["role"] = BmkCopy.text(data["role"])
		_build_character()
	for child: Control in find_children("*", "Control", true, false):
		child.mouse_filter = Control.MOUSE_FILTER_IGNORE


func _full(c: Control) -> Control:
	c.set_anchors_preset(Control.PRESET_FULL_RECT)
	c.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(c)
	return c


func _build_character() -> void:
	_art = _full(ArtLayer.new())
	_art.texture = load(data["art"])
	_art.focus = data["focus_collapsed"]
	var mat := ShaderMaterial.new()
	mat.shader = preload("res://phase4/character_select/shaders/card_art.gdshader")
	_art.material = mat
	_apply_art_filter()

	_shade = _full(ShadeLayer.new())
	_shade.modulate.a = 0.0

	# 접힌 상태: 세로 이름 + 번호/직업
	_collapsed = _full(Control.new())
	var chars := PackedStringArray()
	var nm: String = data["name"]
	for i in nm.length():
		chars.append(nm[i])
	var vname := make_label("\n".join(chars) if BmkCopy.locale == "ko" else nm, _fonts.display, 34)
	vname.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	vname.add_theme_constant_override("line_spacing", 2)
	vname.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.6))
	vname.add_theme_constant_override("shadow_offset_y", 2)
	vname.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	vname.grow_horizontal = Control.GROW_DIRECTION_BEGIN
	vname.offset_right = -36
	vname.offset_left = -36
	vname.offset_top = 28
	_collapsed.add_child(vname)
	var meta := VBoxContainer.new()
	meta.add_theme_constant_override("separation", 2)
	meta.set_anchors_preset(Control.PRESET_BOTTOM_LEFT)
	meta.grow_vertical = Control.GROW_DIRECTION_BEGIN
	meta.offset_left = 30
	meta.offset_bottom = -28
	meta.offset_top = -28
	meta.add_child(make_label(data["numeral"], _fonts.latin, 22, C_GOLD))
	meta.add_child(make_label(data["class_name"], _fonts.body, 13, C_MUTED))
	_collapsed.add_child(meta)

	# 펼친 상태: 이름·역할·스탯
	var box := VBoxContainer.new()
	box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	box.add_theme_constant_override("separation", 6)
	box.anchor_left = 0.0
	box.anchor_right = 1.0
	box.anchor_top = 1.0
	box.anchor_bottom = 1.0
	box.offset_left = 34
	box.offset_right = -42
	box.offset_top = -32
	box.offset_bottom = -32
	box.grow_vertical = Control.GROW_DIRECTION_BEGIN
	add_child(box)
	_expanded = box
	_expanded.modulate.a = 0.0

	box.add_child(make_label("%s · %s" % [data["numeral"], data["class_name"]], _fonts.latin_wide, 13, C_RED))
	var title := HBoxContainer.new()
	title.add_theme_constant_override("separation", 16)
	title.add_child(make_label(data["name"], _fonts.display, 52 if BmkCopy.locale == "en" else 64))
	var role := make_label(data["role"], _fonts.body, 14, C_MUTED)
	role.size_flags_vertical = Control.SIZE_SHRINK_END
	title.add_child(role)
	box.add_child(title)

	var spacer := Control.new()
	spacer.custom_minimum_size = Vector2(0, 12)
	box.add_child(spacer)

	var grid := GridContainer.new()
	grid.columns = 3
	grid.add_theme_constant_override("h_separation", 12)
	box.add_child(grid)
	for def in BmkSelectCharacters.STAT_DEFS:
		var v: int = data["stats"][def["key"]]
		var is_diff: bool = def.get("difficulty", false)
		var col := VBoxContainer.new()
		col.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		col.add_theme_constant_override("separation", 8)
		var head := HBoxContainer.new()
		var lab := make_label(BmkCopy.text(def["label"]), _fonts.body, 13, C_MUTED)
		lab.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		head.add_child(lab)
		head.add_child(make_label(BmkSelectCharacters.difficulty_label(data) if is_diff else "%d / 5" % v, _fonts.bold, 13))
		col.add_child(head)
		var bar := StatBar.new()
		bar.custom_minimum_size = Vector2(0, 4)
		bar.color = C_GOLD if is_diff else C_RED_FILL
		col.add_child(bar)
		grid.add_child(col)
		_bars.append(bar)
		_bar_targets.append(v / 5.0)


func _build_locked() -> void:
	var center := _full(CenterContainer.new())
	var v := VBoxContainer.new()
	v.alignment = BoxContainer.ALIGNMENT_CENTER
	v.add_theme_constant_override("separation", 10)
	_lock_mark = make_label("?", _fonts.latin, 64, C_LINE_2)
	_lock_mark.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(_lock_mark)
	var hint := make_label(BmkCopy.text("SELECT_UNREVEALED"), _fonts.body, 13, C_MUTED_2)
	hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(hint)
	center.add_child(v)
	var num := make_label(data.get("numeral", ""), _fonts.latin, 22, C_LINE_2)
	num.set_anchors_preset(Control.PRESET_BOTTOM_LEFT)
	num.grow_vertical = Control.GROW_DIRECTION_BEGIN
	num.offset_left = 30
	num.offset_bottom = -28
	num.offset_top = -28
	add_child(num)


# ---------------------------------------------------------------- 그리기 / 입력

func _draw() -> void:
	if size.x <= SLANT or size.y <= BORDER * 2.0:
		return
	draw_colored_polygon(para(Rect2(Vector2.ZERO, size), SLANT), border_color)
	var inner := Rect2(Vector2(BORDER, BORDER), size - Vector2.ONE * BORDER * 2.0)
	draw_colored_polygon(para(inner, SLANT - 1.0), C_PANEL_LOCKED if locked else C_PANEL)


func _notification(what: int) -> void:
	if what == NOTIFICATION_RESIZED:
		queue_redraw()


func _has_point(point: Vector2) -> bool:
	return Geometry2D.is_point_in_polygon(point, para(Rect2(Vector2.ZERO, size), SLANT))


func _gui_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		card_pressed.emit(self)
		accept_event()


func _on_hover(on: bool) -> void:
	if active:
		return
	if _hover_tween:
		_hover_tween.kill()
	_hover_tween = create_tween().set_parallel(true)
	_hover_tween.tween_property(self, "border_color", C_LINE_2 if on else C_LINE, 0.16)
	if not locked:
		_hover_tween.tween_method(_set_brightness, _brightness, 0.68 if on else 0.5, 0.2)


# ---------------------------------------------------------------- 상태 전환

func _set_saturation(v: float) -> void:
	_saturation = v
	_apply_art_filter()


func _set_brightness(v: float) -> void:
	_brightness = v
	_apply_art_filter()


func _apply_art_filter() -> void:
	if _art and _art.material:
		_art.material.set_shader_parameter("saturation", _saturation)
		_art.material.set_shader_parameter("brightness", _brightness)


func _set_lock_size(v: float) -> void:
	_lock_mark.add_theme_font_size_override("font_size", int(v))


func set_active(on: bool, instant := false) -> void:
	active = on
	if _tween:
		_tween.kill()
	if _hover_tween:
		_hover_tween.kill()
	var k := 0.0 if instant else 1.0
	var t := create_tween().set_parallel(true).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	_tween = t
	t.tween_property(self, "size_flags_stretch_ratio", RATIO_EXPANDED if on else RATIO_COLLAPSED, EXPAND_TIME * k + 0.001)
	var border_on := (C_LINE_2 if locked else C_RED) if on else C_LINE
	t.tween_property(self, "border_color", border_on, 0.24 * k + 0.001)

	if locked:
		var from: float = _lock_mark.get_theme_font_size("font_size")
		t.tween_method(_set_lock_size, from, 120.0 if on else 64.0, EXPAND_TIME * k + 0.001)
		t.tween_property(_lock_mark, "theme_override_colors/font_color", C_MUTED_2 if on else C_LINE_2, 0.3 * k + 0.001)
		return

	t.tween_method(_set_saturation, _saturation, 1.0 if on else 0.4, 0.4 * k + 0.001)
	t.tween_method(_set_brightness, _brightness, 1.0 if on else 0.5, 0.4 * k + 0.001)
	t.tween_property(_art, "focus", data["focus_expanded"] if on else data["focus_collapsed"], EXPAND_TIME * k + 0.001)
	t.tween_property(_art, "zoom", 1.0 if on else 1.04, 0.6 * k + 0.001)
	t.tween_property(_shade, "modulate:a", 1.0 if on else 0.0, 0.3 * k + 0.001)
	t.tween_property(_collapsed, "modulate:a", 0.0 if on else 1.0, 0.16 * k + 0.001)
	if on:
		t.tween_property(_expanded, "modulate:a", 1.0, 0.32 * k + 0.001).set_delay(0.16 * k)
		for i in _bars.size():
			_bars[i].fill = 0.0
			t.tween_property(_bars[i], "fill", _bar_targets[i], 0.64 * k + 0.001).set_delay((0.22 + i * 0.09) * k)
	else:
		t.tween_property(_expanded, "modulate:a", 0.0, 0.2 * k + 0.001)
		for bar in _bars:
			t.tween_property(bar, "fill", 0.0, 0.16 * k + 0.001)
