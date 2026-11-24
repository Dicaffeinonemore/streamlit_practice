extends Control
## Menu design 1 (dark iron): the framed panel behind the pause and options menus, and the framed
## rows inside it. Mirrors index.html .menu-panel / .menu-row.

const INK := Color("eadbd0")
const FRAME := Color("a68b7d")
const INNER := Color("5a464a")
const ORNAMENT := Color("b8998a")
const MOON := Color("dcc6b0")
const PANEL_TOP := Color("221a1ef5")
const PANEL_BOTTOM := Color("0d090cf8")
const PAD_TOP := 24
const PAD_SIDE := 15
const PAD_BOTTOM := 22

var column := VBoxContainer.new()
var serif: Font
var sans: Font
var row_height := 38
var row_gap := 8
var font_size := 16

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	column.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	column.offset_left = PAD_SIDE
	column.offset_right = -PAD_SIDE
	column.offset_top = PAD_TOP
	column.offset_bottom = -PAD_BOTTOM
	add_child(column)

## page: "pause", "settings" or "controls"; rows: how many rows the page shows (sets the height).
func show_scroll(scroll: ScrollContainer, page: String, rows: int = 0) -> void:
	set_anchors_and_offsets_preset(Control.PRESET_TOP_LEFT)
	match page:
		"pause":
			row_height = 40
			row_gap = 9
			font_size = 17
			size = Vector2(312, content_height(rows) + PAD_TOP + PAD_BOTTOM)
			position = Vector2(14, 521 - size.y)
		"controls":
			row_height = 36
			row_gap = 8
			font_size = 16
			position = Vector2(28, 26)
			size = Vector2(904, 488)
		_:
			row_height = 37
			row_gap = 8
			font_size = 16
			size = Vector2(392, minf(content_height(rows) + PAD_TOP + PAD_BOTTOM, 480))
			position = Vector2(553, round((540 - size.y) / 2))
	column.add_theme_constant_override("separation", row_gap)
	if scroll.get_parent() != column:
		scroll.reparent(column, false)
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	queue_redraw()
	show()

func content_height(rows: int) -> float:
	return rows * row_height + maxi(rows - 1, 0) * row_gap

## One framed row: an uppercase serif label, optionally "| 한국어" beside it, and a value area on the
## right. captions lists every name a test or tool may look the row up by.
func row(parent: Container, label: String, sub: String = "", callback: Callable = Callable(), nav := false, captions: Array = []) -> Button:
	var button := Button.new()
	button.custom_minimum_size.y = row_height
	button.focus_mode = Control.FOCUS_ALL
	decorate(button)
	var line := HBoxContainer.new()
	line.name = "Line"
	line.mouse_filter = Control.MOUSE_FILTER_IGNORE
	line.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	line.offset_left = 36
	line.offset_right = -30 if nav else -12
	line.add_theme_constant_override("separation", 10)
	button.add_child(line)
	var name_label := text_label(label.to_upper() if is_latin(label) else label, serif if is_latin(label) else sans, font_size)
	name_label.name = "Label"
	name_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL if sub.is_empty() else Control.SIZE_SHRINK_BEGIN
	line.add_child(name_label)
	if not sub.is_empty():
		var rule := ColorRect.new()
		rule.color = Color("9c8580")
		rule.custom_minimum_size = Vector2(1, 16)
		rule.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		rule.mouse_filter = Control.MOUSE_FILTER_IGNORE
		line.add_child(rule)
		var sub_label := text_label(sub, sans, font_size - 3)
		sub_label.add_theme_color_override("font_color", Color("e2d2c8"))
		sub_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		sub_label.clip_text = true
		line.add_child(sub_label)
	var names: Array = [label, label.to_upper(), sub]
	names.append_array(captions)
	button.set_meta("captions", names)
	button.mouse_entered.connect(func() -> void:
		if not button.disabled: button.grab_focus())
	button.focus_entered.connect(button.queue_redraw)
	button.focus_exited.connect(button.queue_redraw)
	button.draw.connect(draw_row_marks.bind(button, nav))
	if callback.is_valid(): button.pressed.connect(callback)
	parent.add_child(button)
	return button

## The value area of a row (sliders, ◀ value ▶, ON/OFF), right aligned.
func value_area(button: Button) -> HBoxContainer:
	var line: HBoxContainer = button.get_node("Line")
	var area := HBoxContainer.new()
	area.mouse_filter = Control.MOUSE_FILTER_IGNORE
	area.alignment = BoxContainer.ALIGNMENT_END
	area.add_theme_constant_override("separation", 7)
	line.add_child(area)
	return area

func text_label(text: String, font: Font, font_size_: int) -> Label:
	var label := Label.new()
	label.text = text
	label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	label.size_flags_vertical = Control.SIZE_FILL
	label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	if font != null: label.add_theme_font_override("font", font)
	label.add_theme_font_size_override("font_size", font_size_)
	label.add_theme_color_override("font_color", INK)
	label.add_theme_color_override("font_shadow_color", Color("000000aa"))
	label.add_theme_constant_override("shadow_offset_y", 1)
	return label

static func is_latin(text: String) -> bool:
	for i: int in range(text.length()):
		if text.unicode_at(i) >= 0x1100: return false
	return true

## A boxed value such as "English" or "ON".
func value_box(text: String, width: float, on := false) -> Label:
	var label := text_label(text, serif, font_size - 2)
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	label.custom_minimum_size = Vector2(width, row_height - 12)
	label.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	set_box_state(label, on)
	return label

func set_box_state(label: Label, on: bool) -> void:
	var box := StyleBoxFlat.new()
	box.bg_color = Color("8a1f31") if on else Color("0d090b")
	box.border_color = Color("e2a99a") if on else Color("77605f")
	box.set_border_width_all(1)
	box.set_corner_radius_all(2)
	label.add_theme_stylebox_override("normal", box)
	label.add_theme_color_override("font_color", Color("fff4ea") if on else Color("f4e5da"))

## The ◀ / ▶ around a value; they step it on click.
func arrow(text: String, callback: Callable) -> Button:
	var button := Button.new()
	button.text = text
	button.flat = true
	button.focus_mode = Control.FOCUS_NONE
	button.custom_minimum_size = Vector2(16, 0)
	button.add_theme_font_size_override("font_size", 12)
	button.add_theme_color_override("font_color", Color("f4e5da"))
	button.add_theme_color_override("font_hover_color", Color.WHITE)
	button.pressed.connect(callback)
	return button

## A crimson track with a pale diamond grabber (index.html input[type=range]).
func slider(value: float, max_value: float) -> HSlider:
	var bar := HSlider.new()
	bar.max_value = max_value
	bar.step = 1
	bar.value = value
	bar.focus_mode = Control.FOCUS_NONE
	bar.custom_minimum_size = Vector2(104, 18)
	bar.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	var track := StyleBoxFlat.new()
	track.bg_color = Color("3b3236")
	track.set_corner_radius_all(3)
	track.content_margin_top = 3
	track.content_margin_bottom = 3
	var fill := StyleBoxFlat.new()
	fill.bg_color = Color("c42a42")
	fill.set_corner_radius_all(3)
	bar.add_theme_stylebox_override("slider", track)
	bar.add_theme_stylebox_override("grabber_area", fill)
	bar.add_theme_stylebox_override("grabber_area_highlight", fill)
	var grabber := diamond_texture()
	bar.add_theme_icon_override("grabber", grabber)
	bar.add_theme_icon_override("grabber_highlight", grabber)
	return bar

static var diamond: ImageTexture
static func diamond_texture() -> ImageTexture:
	if diamond != null: return diamond
	var image := Image.create(16, 16, false, Image.FORMAT_RGBA8)
	for y: int in range(16):
		for x: int in range(16):
			var d: float = absf(x - 7.5) + absf(y - 7.5)
			if d <= 4.2: image.set_pixel(x, y, Color("7d6e6a"))
			elif d <= 7.0: image.set_pixel(x, y, Color("d9cfc8"))
			elif d <= 8.0: image.set_pixel(x, y, Color("201a1c"))
	diamond = ImageTexture.create_from_image(image)
	return diamond

func decorate(button: Button, _primary := false) -> void:
	var box := StyleBoxFlat.new()
	box.bg_color = Color("1a1417")
	box.border_color = Color("5d4b4e")
	box.set_border_width_all(1)
	box.set_corner_radius_all(3)
	box.content_margin_left = 36
	box.content_margin_right = 12
	box.shadow_color = Color("00000077")
	box.shadow_size = 3
	box.shadow_offset = Vector2(0, 2)
	button.add_theme_stylebox_override("normal", box)
	button.add_theme_stylebox_override("disabled", box)
	var selected: StyleBoxFlat = box.duplicate()
	selected.bg_color = Color("5a1525")
	selected.border_color = Color("c4907e")
	selected.shadow_color = Color("a51f3355")
	selected.shadow_size = 7
	selected.shadow_offset = Vector2.ZERO
	for state: String in ["hover", "focus", "pressed", "hover_pressed"]:
		button.add_theme_stylebox_override(state, selected)
	button.add_theme_color_override("font_color", INK)
	button.add_theme_color_override("font_hover_color", Color.WHITE)
	button.add_theme_color_override("font_focus_color", Color.WHITE)

## Four-point star on the left (outlined, or lit crimson on the focused row), › on navigation rows,
## and the inner bevel line.
func draw_row_marks(button: Button, nav: bool) -> void:
	var lit := button.has_focus()
	var h := button.size.y
	button.draw_rect(Rect2(Vector2(1.5, 1.5), button.size - Vector2(3, 3)), Color("8f3a43") if lit else Color("2b2125"), false, 1.0)
	var c := Vector2(18, h / 2)
	var star := func(r: float, w: float) -> PackedVector2Array:
		return PackedVector2Array([c + Vector2(0, -r), c + Vector2(w, -w), c + Vector2(r, 0), c + Vector2(w, w), c + Vector2(0, r), c + Vector2(-w, w), c + Vector2(-r, 0), c + Vector2(-w, -w)])
	if lit:
		button.draw_circle(c, 9, Color("ff5a5a33"))
		button.draw_colored_polygon(star.call(9.0, 2.4), Color("ff6b6b"))
		button.draw_colored_polygon(star.call(5.5, 1.4), Color("fff3e6"))
	else:
		var points: PackedVector2Array = star.call(8.0, 2.2)
		points.append(points[0])
		button.draw_polyline(points, Color("a3918a"), 1.0, true)
	if nav:
		var x := button.size.x - 17
		button.draw_polyline(PackedVector2Array([Vector2(x - 4, h / 2 - 5), Vector2(x + 1, h / 2), Vector2(x - 4, h / 2 + 5)]), Color("e8d6ca"), 2.0, true)

func _draw() -> void:
	var mid := PANEL_TOP.lerp(PANEL_BOTTOM, 0.5)
	draw_polygon(PackedVector2Array([Vector2.ZERO, Vector2(size.x, 0), size, Vector2(0, size.y)]), PackedColorArray([PANEL_TOP, mid, PANEL_BOTTOM, mid]))
	draw_rect(Rect2(Vector2.ZERO, size), FRAME, false, 1.0)
	draw_rect(Rect2(Vector2(4.5, 4.5), size - Vector2(9, 9)), INNER, false, 1.0)
	# Corner brackets.
	for corner: Vector2 in [Vector2(8, 8), Vector2(size.x - 8, 8), Vector2(8, size.y - 8), Vector2(size.x - 8, size.y - 8)]:
		var sx := 1.0 if corner.x < size.x / 2 else -1.0
		var sy := 1.0 if corner.y < size.y / 2 else -1.0
		draw_polyline(PackedVector2Array([corner + Vector2(13 * sx, 0), corner, corner + Vector2(0, 13 * sy)]), ORNAMENT, 1.0)
	# Crescent with flourishes on the top edge.
	var top := Vector2(size.x / 2, 0)
	var backing := Color("140d11")
	draw_rect(Rect2(top + Vector2(-34, -4), Vector2(68, 8)), backing)
	for side: float in [-1.0, 1.0]:
		var curl := PackedVector2Array()
		for i: int in range(9):
			var t := i / 8.0
			curl.append(top + Vector2(side * (62 - 26 * t), 3 - sin(t * PI) * 6))
		draw_polyline(PackedVector2Array([top + Vector2(side * 96, 3), top + Vector2(side * 62, 3)]), ORNAMENT, 1.2, true)
		draw_polyline(curl, ORNAMENT, 1.2, true)
		draw_polyline(PackedVector2Array([top + Vector2(side * 36, 3), top + Vector2(side * 20, 3)]), ORNAMENT, 1.2, true)
	draw_circle(top + Vector2(0, -2), 13, backing)
	draw_circle(top + Vector2(0, -2), 11, MOON)
	draw_circle(top + Vector2(5, -6), 10, backing)
	# Small diamond on the bottom edge.
	var bottom := Vector2(size.x / 2, size.y)
	draw_rect(Rect2(bottom + Vector2(-12, -3), Vector2(24, 6)), backing)
	draw_line(bottom + Vector2(-56, 0), bottom + Vector2(-12, 0), Color("9c8378"), 1.0)
	draw_line(bottom + Vector2(12, 0), bottom + Vector2(56, 0), Color("9c8378"), 1.0)
	draw_colored_polygon(PackedVector2Array([bottom + Vector2(0, -7), bottom + Vector2(7, 0), bottom + Vector2(0, 7), bottom + Vector2(-7, 0)]), Color("cdb6a2"))
