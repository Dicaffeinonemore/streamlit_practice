extends VBoxContainer

signal changed

const Copy := preload("res://phase4/menu_copy.gd")
const PRESETS := ["arcade", "wasd", "custom"]
var settings: BmkSettings
var character: String
var capture: String = ""
var keyboard := BmkKeyboardView.new()
var description := Label.new()
var status := Label.new()
var copies := HBoxContainer.new()
var tabs: Dictionary[String, Button] = {}
var assignments: Dictionary[String, Button] = {}

func _ready() -> void:
	add_theme_constant_override("separation", 8)
	var heading := Label.new()
	heading.text = Copy.text("KEYS")
	heading.add_theme_font_size_override("font_size", 19)
	add_child(heading)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 8)
	add_child(row)
	for id: String in PRESETS:
		var button := Button.new()
		button.text = Copy.text("PRESET_" + id)
		var subtitle := Label.new()
		subtitle.text = Copy.text("SUB_" + id)
		subtitle.add_theme_font_size_override("font_size",12)
		subtitle.add_theme_color_override("font_color",Color("b5a6bc"))
		subtitle.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_WIDE)
		subtitle.offset_top = -26
		subtitle.offset_left = 10
		subtitle.mouse_filter = Control.MOUSE_FILTER_IGNORE
		button.add_child(subtitle)
		if id == "arcade":
			var badge := Label.new()
			badge.text = Copy.text("RECOMMENDED")
			badge.add_theme_font_size_override("font_size",11)
			badge.add_theme_color_override("font_color",Color("221c16"))
			var gold := StyleBoxFlat.new()
			gold.bg_color = Color("ffd23f")
			gold.content_margin_left = 5
			gold.content_margin_right = 5
			badge.add_theme_stylebox_override("normal",gold)
			badge.mouse_filter = Control.MOUSE_FILTER_IGNORE
			button.add_child(badge)
			badge.set_anchors_and_offsets_preset(Control.PRESET_TOP_RIGHT)
			badge.offset_right = -6
			badge.offset_left = -6 - badge.get_minimum_size().x
		button.toggle_mode = true
		button.size_flags_horizontal = SIZE_EXPAND_FILL
		button.alignment = HORIZONTAL_ALIGNMENT_LEFT
		button.custom_minimum_size.y = 62
		var on := selected_style()
		on.content_margin_bottom = 19
		var off: StyleBoxFlat = on.duplicate()
		off.bg_color = Color("1a1322")
		off.border_color = Color("5a4a62")
		off.set_border_width_all(1)
		button.add_theme_stylebox_override("normal",off)
		button.add_theme_stylebox_override("hover",off)
		button.add_theme_stylebox_override("pressed",on)
		button.add_theme_stylebox_override("hover_pressed",on)
		button.pressed.connect(choose_preset.bind(id))
		row.add_child(button)
		tabs[id] = button
	description.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	description.add_theme_font_size_override("font_size", 14)
	add_child(description)
	keyboard.settings = settings
	keyboard.character = character
	keyboard.mouse_filter = Control.MOUSE_FILTER_PASS
	keyboard.resized.connect(keyboard.update_minimum_size)
	keyboard.key_chosen.connect(func(code: String) -> void: assign(BmkKeyNames.key_for(code)))
	add_child(keyboard)
	var legend := HBoxContainer.new()
	legend.alignment = BoxContainer.ALIGNMENT_CENTER
	legend.add_theme_constant_override("separation", 9)
	add_child(legend)
	for kind: String in ["move","attack","jump","dash","special","magic","skill","alias"]:
		var item := Label.new()
		item.text = ("◇ " if kind == "alias" else "■ ") + Copy.text("KIND_" + kind)
		item.add_theme_color_override("font_color", BmkKeyboardView.COLORS.get(kind, Color("cfc4d6")))
		item.add_theme_font_size_override("font_size", 13)
		legend.add_child(item)
	add_child(copies)
	var copy_label := Label.new()
	copy_label.text = Copy.text("KEYS_COPY")
	copies.add_child(copy_label)
	for i: int in range(2):
		var copy := Button.new()
		copy.text = Copy.text("KEYS_COPY_%d" % (i + 1))
		copy.pressed.connect(copy_preset.bind(PRESETS[i]))
		copies.add_child(copy)
	var grid := GridContainer.new()
	grid.columns = 2
	grid.add_theme_constant_override("h_separation", 24)
	add_child(grid)
	for action: String in BmkPhysicalInput.ACTIONS:
		var pair := HBoxContainer.new()
		pair.size_flags_horizontal = SIZE_EXPAND_FILL
		grid.add_child(pair)
		var stripe := ColorRect.new()
		stripe.custom_minimum_size.x = 4
		stripe.color = BmkKeyboardView.COLORS[BmkKeyNames.KIND[action]]
		pair.add_child(stripe)
		var label := Label.new()
		label.text = action_name(action)
		label.size_flags_horizontal = SIZE_EXPAND_FILL
		pair.add_child(label)
		var button := Button.new()
		button.custom_minimum_size = Vector2(88, 36)
		button.tooltip_text = label.text
		button.toggle_mode = true
		button.add_theme_stylebox_override("pressed", selected_style())
		button.pressed.connect(start_capture.bind(action))
		pair.add_child(button)
		assignments[action] = button
		for control: Control in [pair, button]:
			control.mouse_entered.connect(hover.bind(action))
			control.mouse_exited.connect(hover.bind(""))
	status.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	status.add_theme_font_size_override("font_size", 14)
	add_child(status)
	refresh()

func selected_style() -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = Color("3a2a14")
	style.border_color = Color("ffd23f")
	style.set_border_width_all(2)
	style.set_corner_radius_all(5)
	style.content_margin_left = 10
	return style

func action_name(action: String) -> String:
	if character == "viesa" and BmkKeyNames.SHORT_VIESA.has(action):
		return Copy.text("ARCHER_" + action)
	return Copy.text("ACTION_" + action)

func hover(action: String) -> void:
	var highlight := capture if not capture.is_empty() else action
	keyboard.show_keys([highlight], [])
	keyboard.use_focus = not highlight.is_empty()

func refresh() -> void:
	var custom := settings.preset == "custom"
	for id: String in tabs: tabs[id].set_pressed_no_signal(settings.preset == id)
	description.text = Copy.text("DESC_" + settings.preset)
	copies.visible = custom
	var map := BmkKeyNames.bindings(settings)
	for action: String in assignments:
		var button := assignments[action]
		button.text = BmkKeyNames.key_name(map[action])
		button.disabled = not custom
		button.set_pressed_no_signal(action == capture)
	hover("")

func choose_preset(id: String) -> void:
	settings.use_preset(id)
	finish_edit("")

func copy_preset(id: String) -> void:
	settings.copy_preset(id)
	finish_edit(Copy.text("KEYS_COPIED") % Copy.text("PRESET_" + id))

func start_capture(action: String) -> void:
	capture = action
	status.text = Copy.text("KEYS_CHOOSE") % action_name(action)
	refresh()

func assign(code: int) -> void:
	if capture.is_empty(): return
	var other: Variant = settings.bindings.find_key(code)
	var previous: int = settings.bindings[capture]
	if not settings.bind(capture, code):
		status.text = Copy.text("KEYS_INVALID")
		return
	var result := Copy.text("KEYS_SAVED")
	if other != null and other != capture:
		result = Copy.text("KEYS_SWAP") % [action_name(other), BmkKeyNames.key_name(BmkKeyNames.code_for(previous))] + " · " + result
	finish_edit(result)

func finish_edit(result: String) -> void:
	capture = ""
	var error := settings.save()
	changed.emit()
	status.text = result if error == OK else Copy.text("KEYS_FAILED") % error_string(error)
	refresh()

func _input(event: InputEvent) -> void:
	if capture.is_empty() or not is_visible_in_tree(): return
	var key := event as InputEventKey
	if key == null: return
	get_viewport().set_input_as_handled()
	if not key.pressed or key.echo: return
	if key.keycode == KEY_ESCAPE:
		capture = ""
		status.text = Copy.text("KEYS_CANCEL")
		refresh()
	elif not (key.ctrl_pressed or key.alt_pressed or key.meta_pressed):
		assign(BmkPhysicalInput.key_id(key))
