extends TextureRect

signal chosen(key: String)

const KEYS := ["New Game", "Continue", "Options", "Credits", "Exit"]
const CENTERS := [394, 460, 521, 582, 642]
const SOURCE_SIZE := Vector2(1672, 941)
const Copy := preload("res://phase4/menu_copy.gd")

var controls := Control.new()
var marker := TextureRect.new()
var choices: Array[Button] = []
var lettering: Array[TextureRect] = []
var locale: String = "en"

func caption(key: String) -> String:
	return Copy.text(key, locale)

func _ready() -> void:
	texture = preload("res://phase4/title_art/menu.webp")
	texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
	expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	controls.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(controls)
	marker.texture = preload("res://phase4/title_art/selection.png")
	marker.mouse_filter = Control.MOUSE_FILTER_IGNORE
	controls.add_child(marker)
	var font := SystemFont.new()
	font.font_names = PackedStringArray(["Georgia", "Times New Roman", "Batang", "Noto Serif CJK KR"])
	var style := StyleBoxEmpty.new()
	style.content_margin_left = 123
	for i: int in range(KEYS.size()):
		var button := Button.new()
		button.position = Vector2(50, CENTERS[i] - 30)
		button.size = Vector2(402, 60)
		button.alignment = HORIZONTAL_ALIGNMENT_LEFT
		button.add_theme_font_override("font", font)
		button.add_theme_font_size_override("font_size", 30)
		for state: String in ["normal", "hover", "pressed", "disabled", "focus", "hover_pressed"]:
			button.add_theme_stylebox_override(state, style)
		button.mouse_entered.connect(func() -> void:
			if not button.disabled: button.grab_focus())
		button.focus_entered.connect(func() -> void: select(i))
		button.pressed.connect(func() -> void: chosen.emit(KEYS[i]))
		controls.add_child(button)
		choices.append(button)
		var region := AtlasTexture.new()
		region.atlas = preload("res://phase4/title_art/lettering.png")
		region.region = Rect2(0, i * 40, 144, 40)
		var ink := TextureRect.new()
		ink.texture = region
		ink.position = Vector2(119, 10)
		ink.mouse_filter = Control.MOUSE_FILTER_IGNORE
		button.add_child(ink)
		lettering.append(ink)
	resized.connect(fit_controls)
	fit_controls()

func fit_controls() -> void:
	var factor: float = minf(size.x / SOURCE_SIZE.x, size.y / SOURCE_SIZE.y)
	controls.position = (size - SOURCE_SIZE * factor) * 0.5
	controls.scale = Vector2.ONE * factor

func open(language: String, can_continue: bool) -> void:
	locale = language
	controls.show()
	choices[1].disabled = not can_continue
	var enabled: Array[Button] = []
	for i: int in range(choices.size()):
		choices[i].text = caption(KEYS[i])
		lettering[i].visible = choices[i].text == KEYS[i]
		if not choices[i].disabled: enabled.append(choices[i])
	for i: int in range(enabled.size()):
		var previous := enabled[i].get_path_to(enabled[posmod(i - 1, enabled.size())])
		var next := enabled[i].get_path_to(enabled[(i + 1) % enabled.size()])
		enabled[i].focus_neighbor_top = previous
		enabled[i].focus_previous = previous
		enabled[i].focus_neighbor_bottom = next
		enabled[i].focus_next = next
	choices[0].grab_focus()
	select(0)

func select(index: int) -> void:
	if choices[index].disabled: return
	marker.position = Vector2(44, CENTERS[index] - 40)
	for i: int in range(choices.size()):
		var color := Color("fff0dc") if i == index else Color("9d887a")
		lettering[i].modulate = color
		if lettering[i].visible: color = Color.TRANSPARENT
		for state: String in ["font_color", "font_focus_color", "font_hover_color", "font_pressed_color", "font_disabled_color"]:
			choices[i].add_theme_color_override(state, color)
