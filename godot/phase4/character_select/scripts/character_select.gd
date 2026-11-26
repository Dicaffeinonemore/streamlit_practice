class_name BmkCharacterSelect
extends Control
signal character_confirmed(id: String)
signal back_requested
signal selection_moved

const DESIGN_SIZE := Vector2(1280, 720)

const C_BG := Color("0b0808")
const C_PANEL := Color("1a1212")
const C_LINE := Color("3a2a22")
const C_LINE_2 := Color("6b5640")
const C_RED := Color("e8434b")
const C_RED_DEEP := Color("8e1a20")
const C_GOLD := Color("c9a876")
const C_TEXT := Color("ede3d3")
const C_MUTED_2 := Color("a8998a")

var fonts := {}
var cards: Array[BmkSelectCard] = []
var index := 0
var locale := ""
var content := Control.new()

var start_button: Button
var _back_btn: Button
var _toast: PanelContainer
var _toast_label: Label
var _toast_tween: Tween


func _ready() -> void:
	locale = BmkCopy.locale
	_load_fonts()
	_build()
	resized.connect(_fit_content)
	_fit_content()


func _fit_content() -> void:
	var factor := minf(size.x / DESIGN_SIZE.x, size.y / DESIGN_SIZE.y)
	content.position = (size - DESIGN_SIZE * factor) * 0.5
	content.scale = Vector2.ONE * factor


func open(initial: String, back_label: String) -> void:
	index = 0
	for i in cards.size():
		if cards[i].data["id"] == initial:
			index = i
		cards[i].set_active(false, true)
	cards[index].set_active(true, true)
	_back_btn.text = back_label
	if _toast_tween:
		_toast_tween.kill()
	_toast.modulate.a = 0.0
	_update_start()
	show()

# ---------------------------------------------------------------- 폰트 / 테마

func _load_fonts() -> void:
	var noto: FontFile = load("res://phase4/character_select/fonts/NotoSansKR.ttf")
	var nanum: FontFile = load("res://phase4/character_select/fonts/NanumMyeongjo-ExtraBold.ttf")
	var cinzel: FontFile = load("res://phase4/character_select/fonts/Cinzel.ttf")
	cinzel.fallbacks = [noto]  # Cinzel 에 없는 한글은 Noto Sans KR 로
	var wght := TextServerManager.get_primary_interface().name_to_tag("wght")
	fonts.body = _variation(noto, {wght: 400})
	fonts.bold = _variation(noto, {wght: 700})
	fonts.display = _variation(nanum, {})
	fonts.display_wide = _variation(nanum, {}, 3)
	fonts.latin = _variation(cinzel, {wght: 500})
	fonts.latin_wide = _variation(cinzel, {wght: 500}, 4)
	var th := Theme.new()
	th.default_font = fonts.body
	th.default_font_size = 13
	theme = th


func _variation(base: Font, coords: Dictionary, spacing := 0) -> FontVariation:
	var f := FontVariation.new()
	f.base_font = base
	f.variation_opentype = coords
	f.spacing_glyph = spacing
	return f


# ---------------------------------------------------------------- 화면 구성

func _place(c: Control, pos: Vector2, sz: Vector2) -> Control:
	content.add_child(c)
	c.position = pos
	c.size = sz
	return c


func _build() -> void:
	var bg := ColorRect.new()
	bg.color = C_BG
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	bg.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(bg)
	content.size = DESIGN_SIZE
	content.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(content)

	# 상단
	var header := HBoxContainer.new()
	header.add_theme_constant_override("separation", 18)
	_place(header, Vector2(48, 30), Vector2(1184, 44))
	var title := BmkSelectCard.make_label(BmkCopy.text("WEB_CHOOSE_HERO"), fonts.display_wide, 30)
	header.add_child(title)
	var brand := BmkSelectCard.make_label("LUNATIC NIGHTS", fonts.latin_wide, 13, C_GOLD)
	brand.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	header.add_child(brand)
	var grow := Control.new()
	grow.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	header.add_child(grow)
	var unlocked := 0
	for c in BmkSelectCharacters.LIST:
		if not c.get("locked", false):
			unlocked += 1
	var count := BmkSelectCard.make_label(BmkCopy.text("SELECT_UNLOCKED") % [str(unlocked), str(BmkSelectCharacters.LIST.size())], fonts.body, 13, C_MUTED_2)
	count.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	header.add_child(count)
	var rule := ColorRect.new()
	rule.color = C_LINE
	rule.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_place(rule, Vector2(48, 87), Vector2(1184, 1))

	# 카드 줄
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 14)
	_place(row, Vector2(48, 112), Vector2(1184, 520))
	for i in BmkSelectCharacters.LIST.size():
		var card := BmkSelectCard.new()
		card.setup(BmkSelectCharacters.LIST[i], i, fonts)
		card.card_pressed.connect(_on_card_pressed)
		row.add_child(card)
		cards.append(card)

	# 하단
	var footer := HBoxContainer.new()
	footer.add_theme_constant_override("separation", 12)
	_place(footer, Vector2(48, 654), Vector2(1184, 48))
	var hints := BmkSelectCard.make_label(BmkCopy.text("WEB_HERO_KEYS"), fonts.body, 13, C_MUTED_2)
	hints.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	hints.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	footer.add_child(hints)
	_back_btn = _make_button("", false)
	_back_btn.pressed.connect(back)
	footer.add_child(_back_btn)
	start_button = _make_button("", true)
	start_button.pressed.connect(confirm)
	footer.add_child(start_button)

	_build_toast()


func _make_button(text: String, primary: bool) -> Button:
	var b := Button.new()
	b.text = text
	b.focus_mode = Control.FOCUS_NONE
	b.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	b.custom_minimum_size = Vector2(0, 48)
	b.add_theme_font_override("font", fonts.display)
	b.add_theme_font_size_override("font_size", 18 if primary else 17)
	var pad := 36.0 if primary else 24.0
	var looks := {
		"normal": [C_RED_DEEP if primary else Color(0, 0, 0, 0), C_GOLD if primary else C_LINE_2],
		"hover": [Color("a8232a") if primary else Color(0, 0, 0, 0), C_GOLD],
		"pressed": [C_RED if primary else C_PANEL, C_GOLD],
		"disabled": [Color("2a1c1a"), C_LINE],
	}
	for state in looks:
		var sb := StyleBoxFlat.new()
		sb.bg_color = looks[state][0]
		sb.border_color = looks[state][1]
		sb.set_border_width_all(1)
		sb.content_margin_left = pad
		sb.content_margin_right = pad
		b.add_theme_stylebox_override(state, sb)
	for key in ["font_color", "font_hover_color", "font_pressed_color"]:
		b.add_theme_color_override(key, C_TEXT)
	b.add_theme_color_override("font_disabled_color", Color(C_TEXT, 0.45))
	return b


func _build_toast() -> void:
	_toast = PanelContainer.new()
	var sb := StyleBoxFlat.new()
	sb.bg_color = C_PANEL
	sb.border_color = C_LINE_2
	sb.set_border_width_all(1)
	sb.content_margin_left = 18
	sb.content_margin_right = 18
	sb.content_margin_top = 10
	sb.content_margin_bottom = 10
	_toast.add_theme_stylebox_override("panel", sb)
	_toast.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_toast.anchor_left = 0.5
	_toast.anchor_right = 0.5
	_toast.grow_horizontal = Control.GROW_DIRECTION_BOTH
	_toast.offset_top = 104
	_toast.modulate.a = 0.0
	_toast_label = BmkSelectCard.make_label("", fonts.body, 13)
	_toast.add_child(_toast_label)
	content.add_child(_toast)


# ---------------------------------------------------------------- 입력

func _input(event: InputEvent) -> void:
	if not is_visible_in_tree():
		return
	if event.is_action_pressed("ui_left", true):
		move(-1)
	elif event.is_action_pressed("ui_right", true):
		move(1)
	elif event.is_action_pressed("ui_accept"):
		confirm()
	elif event.is_action_pressed("ui_cancel"):
		back()
	else:
		return
	get_viewport().set_input_as_handled()


func _on_card_pressed(card: BmkSelectCard) -> void:
	if card.index == index:
		confirm()
	else:
		select(card.index)


# ---------------------------------------------------------------- 동작

func select(i: int) -> void:
	if cards.is_empty():
		return
	var next := posmod(i, cards.size())
	if next == index:
		return
	cards[index].set_active(false)
	index = next
	cards[index].set_active(true)
	_update_start()
	selection_moved.emit()


func move(dir: int) -> void:
	select(index + dir)


func confirm() -> void:
	var card := cards[index]
	if card.locked:
		_show_toast(BmkCopy.text("SELECT_DENIED"))
		return
	character_confirmed.emit(card.data["id"])


func back() -> void:
	back_requested.emit()


func _update_start() -> void:
	var card := cards[index]
	start_button.disabled = card.locked
	start_button.text = BmkCopy.text("SELECT_LOCKED") if card.locked else BmkCopy.text("SELECT_START") % card.data["name"]

func _show_toast(msg: String) -> void:
	_toast_label.text = msg
	if _toast_tween:
		_toast_tween.kill()
	_toast_tween = create_tween()
	_toast_tween.tween_property(_toast, "modulate:a", 1.0, 0.2)
	_toast_tween.tween_interval(1.4)
	_toast_tween.tween_property(_toast, "modulate:a", 0.0, 0.2)
