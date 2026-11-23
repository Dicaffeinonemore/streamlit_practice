extends Control

var column := VBoxContainer.new()
var heading := Label.new()
var footer := HBoxContainer.new()

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	column.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	column.offset_left = 55
	column.offset_right = -55
	column.offset_top = 19
	column.offset_bottom = -19
	column.add_theme_constant_override("separation", 12)
	add_child(column)
	heading.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	heading.add_theme_font_size_override("font_size", 29)
	heading.add_theme_color_override("font_color", Color("e6d6d0"))
	column.add_child(heading)
	footer.alignment = BoxContainer.ALIGNMENT_CENTER
	footer.add_theme_constant_override("separation", 10)
	column.add_child(footer)

func show_scroll(scroll: ScrollContainer, is_settings: bool) -> void:
	if scroll.get_parent() != column:
		scroll.reparent(column, false)
		column.move_child(scroll, 1)
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	heading.visible = is_settings
	footer.visible = is_settings
	show()

func action(row: Container, caption: String, callback: Callable, primary := false) -> Button:
	var button := Button.new()
	button.text = caption
	button.custom_minimum_size.y = 46
	button.add_theme_font_size_override("font_size", 16)
	var box := StyleBoxFlat.new()
	box.bg_color = Color("38222d") if primary else Color("282239")
	box.border_color = Color("86727b") if primary else Color("82738e")
	box.set_border_width_all(2)
	box.set_corner_radius_all(2)
	box.content_margin_left = 22
	box.content_margin_right = 22
	box.shadow_color = Color("00000066")
	box.shadow_size = 3
	box.shadow_offset = Vector2(0,2)
	button.add_theme_stylebox_override("normal", box)
	button.pressed.connect(callback)
	row.add_child(button)
	return button

func _draw() -> void:
	var top := Color("19131cf5")
	var bottom := Color("08070bf8")
	var mid := top.lerp(bottom, 0.5)
	draw_polygon(PackedVector2Array([Vector2.ZERO,Vector2(size.x,0),size,Vector2(0,size.y)]),PackedColorArray([top,mid,bottom,mid]))
	draw_rect(Rect2(Vector2.ZERO,size),Color("62505e"),false,1.0)
