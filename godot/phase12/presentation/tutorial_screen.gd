class_name BmkTutorialScreen
extends Control
## index.html #tutorial (조작 안내): the demonstration view with its caption, keys and progress bar,
## the step description, keyboard picture, prev / play / next, the step list, tips and actions.
## demo-runtime.js demoCaption / demoLights / demoList / demoPlayButton.
signal practice_pressed
signal start_pressed
signal back_pressed

const TIPS: String = "🏹 [color=#9cc3ff]궁수[/color]는 같은 줄에서 활을 당긴 뒤 화살을 쏩니다 — 위아래로 줄을 바꾸거나 점프해서 피하세요\n🐟 생선 = HP +30 · 🍖 고기 = HP +60  ·  📜 두루마리 = 뇌격 +1  ·  🧪 엘릭서 = SP +25  ·  ⭐ 파워업 = 공격력 UP  ·  📦 상자를 부수면 아이템\n🪙 동전 = 500점 · 동전 주머니 = 1,000점 · 금괴 = 2,000점\n연속으로 때리면 [color=#ffe27a]HIT[/color] 가 쌓이고, 이어질수록 보스에게 주는 피해가 커집니다\n보스는 맞을수록 [color=#ffb300]그로기 게이지[/color]가 차고, 가득 차면 5초간 기절  ·  적 머리 위 [color=#ff5252]![/color] · 바닥의 붉은 표식 = 공격 예고 (충격파는 점프로 넘기)  ·  화면의 [color=#ffd23f]GO →[/color] 가 뜨면 오른쪽으로 전진\n랭크는 누적 피해·사망·시간·최대 콤보로 결정됩니다."
const FOOT: String = "키 배치는 설정에서 1 오락실 / 2 WASD / 3 사용자 설정 중에 고를 수 있습니다 · [b]ESC[/b] 일시정지 · [b]M[/b] 소리 켜기/끄기 · 연습장에서는 피해를 받지 않습니다."

var demo: BmkDemoController
var settings: BmkSettings
## helpFrom: 'characterSelect', 'pause' or 'title'.
var origin: String = "characterSelect"
var heading: Label
var preset_label: Label
var view: TextureRect
var caption_step: Label
var caption_title: Label
var caption_keys: HBoxContainer
var bar: ColorRect
var desc: Label
var keyboard: BmkKeyboardView
var prev_button: Button
var play_button: Button
var next_button: Button
var chips: HFlowContainer
var tips_toggle: Button
var tips: RichTextLabel
var practice_button: Button
var start_button: Button
var back_button: Button
var scroll: ScrollContainer
## lightCaps(code, on): the player's own key presses light matching caps.
var user_lit: Dictionary[String, bool] = {}
var font: SystemFont
var serif: SystemFont

class Cap:
	extends Control
	## .cap: a keycap with a thick bottom edge; .on is the pressed yellow.
	var action: String = ""
	var text: String = ""
	var on: bool = false
	var font_size: int = 13
	var font: Font
	func _init(f: Font, a: String, t: String, size_: int, w: float, h: float) -> void:
		font = f
		action = a
		text = t
		font_size = size_
		var tw: float = f.get_string_size(t,HORIZONTAL_ALIGNMENT_LEFT,-1,size_).x
		custom_minimum_size = Vector2(maxf(w,tw + 9),h)
		mouse_filter = Control.MOUSE_FILTER_IGNORE
	func set_on(value: bool) -> void:
		if value == on: return
		on = value
		queue_redraw()
	func _draw() -> void:
		var r: Rect2 = Rect2(Vector2.ZERO,size)
		var bottom: float = 2.0 if on else 3.0
		if on: r.position.y += 2
		var box: StyleBoxFlat = StyleBoxFlat.new()
		box.bg_color = Color("ffd23f") if on else Color("2b2d4a")
		box.border_color = Color("6b6fb0")
		box.set_border_width_all(1)
		box.border_width_bottom = int(bottom)
		box.set_corner_radius_all(4)
		draw_style_box(box,Rect2(r.position,Vector2(r.size.x,r.size.y - (2 if on else 0))))
		draw_string(font,Vector2(0,r.position.y + (r.size.y - bottom) / 2 + font_size * 0.36),text,HORIZONTAL_ALIGNMENT_CENTER,r.size.x,font_size,Color("222222") if on else Color.WHITE)

class Chip:
	extends PanelContainer
	## .demo-chip: a step button with its title and keycaps.
	signal chosen(index: int)
	var index: int = 0
	var caps: Array[Cap] = []
	var box_off: StyleBoxFlat
	var box_on: StyleBoxFlat
	var title: Label
	func _init() -> void:
		box_off = StyleBoxFlat.new()
		box_off.bg_color = Color("17121e")
		box_off.border_color = Color("4a4256")
		box_off.set_border_width_all(1)
		box_off.set_corner_radius_all(4)
		box_off.content_margin_left = 6
		box_off.content_margin_right = 6
		box_off.content_margin_top = 3
		box_off.content_margin_bottom = 3
		box_on = box_off.duplicate()
		box_on.bg_color = Color("3a2a14")
		box_on.border_color = Color("ffd23f")
		add_theme_stylebox_override("panel",box_off)
		mouse_filter = Control.MOUSE_FILTER_STOP
		mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	func set_on(value: bool) -> void:
		add_theme_stylebox_override("panel",box_on if value else box_off)
		title.add_theme_color_override("font_color",Color.WHITE if value else Color("d9cfe0"))
	func _gui_input(event: InputEvent) -> void:
		if event is InputEventMouseButton and (event as InputEventMouseButton).pressed and (event as InputEventMouseButton).button_index == MOUSE_BUTTON_LEFT:
			chosen.emit(index)
			accept_event()

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	font = SystemFont.new()
	font.font_names = PackedStringArray(["Malgun Gothic","Noto Sans CJK KR","Arial"])
	serif = SystemFont.new()
	serif.font_names = PackedStringArray(["Batang","Georgia","Malgun Gothic"])
	add_theme_font_override("font",font)
	theme = make_theme()
	var root: VBoxContainer = VBoxContainer.new()
	root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	root.offset_left = 19
	root.offset_right = -19
	root.offset_top = 14
	root.offset_bottom = -14
	root.add_theme_constant_override("separation",10)
	add_child(root)
	var head: HBoxContainer = HBoxContainer.new()
	head.alignment = BoxContainer.ALIGNMENT_CENTER
	head.add_theme_constant_override("separation",10)
	root.add_child(head)
	heading = Label.new()
	heading.text = "조작 안내"
	heading.add_theme_font_override("font",serif)
	heading.add_theme_font_size_override("font_size",29)
	heading.add_theme_color_override("font_color",Color("e6d6d0"))
	head.add_child(heading)
	preset_label = Label.new()
	preset_label.add_theme_font_override("font",serif)
	preset_label.add_theme_font_size_override("font_size",18)
	preset_label.add_theme_color_override("font_color",Color("e6d6d0"))
	head.add_child(preset_label)
	scroll = ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	root.add_child(scroll)
	var body: VBoxContainer = VBoxContainer.new()
	body.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	body.add_theme_constant_override("separation",8)
	scroll.add_child(body)
	# .demo-wrap: 2fr view | 1fr side, gap 1.4cqw.
	var wrap: HBoxContainer = HBoxContainer.new()
	wrap.add_theme_constant_override("separation",13)
	body.add_child(wrap)
	var frame: PanelContainer = PanelContainer.new()
	var frame_box: StyleBoxFlat = StyleBoxFlat.new()
	frame_box.bg_color = Color.BLACK
	frame_box.border_color = Color("62505e")
	frame_box.set_border_width_all(1)
	frame.add_theme_stylebox_override("panel",frame_box)
	frame.custom_minimum_size = Vector2(588,331)
	frame.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	frame.size_flags_stretch_ratio = 2
	wrap.add_child(frame)
	var stack: Control = Control.new()
	stack.clip_contents = true
	frame.add_child(stack)
	view = TextureRect.new()
	view.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	view.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	view.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	view.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	view.mouse_filter = Control.MOUSE_FILTER_IGNORE
	stack.add_child(view)
	# .demo-caption: gradient strip along the bottom with step / title / keys.
	var shade: TextureRect = TextureRect.new()
	var g: Gradient = Gradient.new()
	g.offsets = PackedFloat32Array([0.0,0.4,1.0])
	g.colors = PackedColorArray([Color(0,0,0,0),Color(0,0,0,0.8),Color(0,0,0,0.8)])
	var gt: GradientTexture2D = GradientTexture2D.new()
	gt.gradient = g
	gt.fill_from = Vector2(0,0)
	gt.fill_to = Vector2(0,1)
	shade.texture = gt
	shade.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	shade.stretch_mode = TextureRect.STRETCH_SCALE
	shade.anchor_left = 0
	shade.anchor_right = 1
	shade.anchor_top = 1
	shade.anchor_bottom = 1
	shade.offset_top = -48
	shade.offset_bottom = -4
	shade.mouse_filter = Control.MOUSE_FILTER_IGNORE
	stack.add_child(shade)
	var caption: HBoxContainer = HBoxContainer.new()
	caption.anchor_left = 0
	caption.anchor_right = 1
	caption.anchor_top = 1
	caption.anchor_bottom = 1
	caption.offset_left = 10
	caption.offset_right = -10
	caption.offset_top = -42
	caption.offset_bottom = -8
	caption.add_theme_constant_override("separation",8)
	caption.mouse_filter = Control.MOUSE_FILTER_IGNORE
	stack.add_child(caption)
	caption_step = label(11,Color("b9a9c4"),true)
	caption.add_child(caption_step)
	caption_title = label(21,Color("ffe27a"),true)
	caption.add_child(caption_title)
	var spacer: Control = Control.new()
	spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	spacer.mouse_filter = Control.MOUSE_FILTER_IGNORE
	caption.add_child(spacer)
	caption_keys = HBoxContainer.new()
	caption_keys.add_theme_constant_override("separation",4)
	caption_keys.alignment = BoxContainer.ALIGNMENT_END
	caption.add_child(caption_keys)
	var track: ColorRect = ColorRect.new()
	track.color = Color(1,1,1,0x22 / 255.0)
	track.anchor_left = 0
	track.anchor_right = 1
	track.anchor_top = 1
	track.anchor_bottom = 1
	track.offset_top = -4
	track.mouse_filter = Control.MOUSE_FILTER_IGNORE
	stack.add_child(track)
	bar = ColorRect.new()
	bar.color = Color("ffd23f")
	bar.anchor_top = 1
	bar.anchor_bottom = 1
	bar.offset_top = -4
	bar.mouse_filter = Control.MOUSE_FILTER_IGNORE
	stack.add_child(bar)
	var side: VBoxContainer = VBoxContainer.new()
	side.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	side.size_flags_stretch_ratio = 1
	side.add_theme_constant_override("separation",6)
	wrap.add_child(side)
	desc = label(14,Color("e9dfe6"))
	desc.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	desc.custom_minimum_size = Vector2(0,96)
	desc.add_theme_constant_override("line_spacing",6)
	side.add_child(desc)
	keyboard = BmkKeyboardView.new()
	keyboard.custom_minimum_size = Vector2(0,94)
	side.add_child(keyboard)
	var nav: HBoxContainer = HBoxContainer.new()
	nav.alignment = BoxContainer.ALIGNMENT_CENTER
	nav.add_theme_constant_override("separation",6)
	side.add_child(nav)
	prev_button = small_button("◀ 이전","이전 동작",func() -> void:
		demo.step_to(demo.index - 1))
	nav.add_child(prev_button)
	play_button = small_button("❚❚ 멈춤","시범 플레이 멈춤",func() -> void:
		demo.toggle_pause()
		refresh_play_button())
	nav.add_child(play_button)
	next_button = small_button("다음 ▶","다음 동작",func() -> void:
		demo.step_to(demo.index + 1))
	nav.add_child(next_button)
	chips = HFlowContainer.new()
	chips.add_theme_constant_override("h_separation",5)
	chips.add_theme_constant_override("v_separation",5)
	body.add_child(chips)
	# details.demo-tips: collapsed "아이템 · 전투 팁".
	tips_toggle = Button.new()
	tips_toggle.flat = true
	tips_toggle.alignment = HORIZONTAL_ALIGNMENT_LEFT
	tips_toggle.add_theme_color_override("font_color",Color("ffe27a"))
	tips_toggle.add_theme_color_override("font_hover_color",Color("ffe27a"))
	tips_toggle.add_theme_font_size_override("font_size",14)
	tips_toggle.text = "▶ 아이템 · 전투 팁"
	tips_toggle.pressed.connect(func() -> void:
		tips.visible = not tips.visible
		tips_toggle.text = ("▼" if tips.visible else "▶") + " 아이템 · 전투 팁")
	body.add_child(tips_toggle)
	tips = rich(TIPS)
	tips.visible = false
	body.add_child(tips)
	body.add_child(rich(FOOT))
	var actions: HBoxContainer = HBoxContainer.new()
	actions.alignment = BoxContainer.ALIGNMENT_CENTER
	actions.add_theme_constant_override("separation",12)
	root.add_child(actions)
	practice_button = action_button("직접 연습",func() -> void: practice_pressed.emit())
	actions.add_child(practice_button)
	start_button = action_button("게임 시작",func() -> void: start_pressed.emit())
	actions.add_child(start_button)
	back_button = action_button("돌아가기",func() -> void: back_pressed.emit())
	actions.add_child(back_button)

func make_theme() -> Theme:
	# .btn: dark wine gradient, #86727b border, #eee0da text, #63263a on hover.
	var t: Theme = Theme.new()
	var normal: StyleBoxFlat = StyleBoxFlat.new()
	normal.bg_color = Color("281820")
	normal.border_color = Color("86727b")
	normal.set_border_width_all(1)
	normal.set_corner_radius_all(2)
	normal.content_margin_left = 14
	normal.content_margin_right = 14
	normal.content_margin_top = 5
	normal.content_margin_bottom = 5
	var hover: StyleBoxFlat = normal.duplicate()
	hover.bg_color = Color("63263a")
	var focus: StyleBoxFlat = normal.duplicate()
	focus.draw_center = false
	focus.border_color = Color("e4b8c1")
	t.set_stylebox("normal","Button",normal)
	t.set_stylebox("hover","Button",hover)
	t.set_stylebox("pressed","Button",hover)
	t.set_stylebox("focus","Button",focus)
	t.set_color("font_color","Button",Color("eee0da"))
	t.set_color("font_hover_color","Button",Color.WHITE)
	t.set_color("font_focus_color","Button",Color("eee0da"))
	t.set_color("font_pressed_color","Button",Color.WHITE)
	return t

func label(size_: int, color: Color, bold: bool = false) -> Label:
	var l: Label = Label.new()
	l.add_theme_font_size_override("font_size",size_)
	l.add_theme_color_override("font_color",color)
	if bold:
		var f: SystemFont = font.duplicate() as SystemFont
		f.font_weight = 700
		l.add_theme_font_override("font",f)
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return l

func rich(text: String) -> RichTextLabel:
	var r: RichTextLabel = RichTextLabel.new()
	r.bbcode_enabled = true
	r.fit_content = true
	r.scroll_active = false
	r.text = text
	r.add_theme_font_size_override("normal_font_size",13)
	r.add_theme_font_size_override("bold_font_size",13)
	r.add_theme_color_override("default_color",Color("e9dfe6"))
	r.add_theme_constant_override("line_separation",5)
	return r

func small_button(text: String, tip: String, callback: Callable) -> Button:
	var b: Button = Button.new()
	b.text = text
	b.tooltip_text = tip
	b.add_theme_font_size_override("font_size",13)
	b.pressed.connect(callback)
	return b

func action_button(text: String, callback: Callable) -> Button:
	var b: Button = Button.new()
	b.text = text
	b.custom_minimum_size = Vector2(150,34)
	b.add_theme_font_size_override("font_size",16)
	b.pressed.connect(callback)
	return b

## toTutorial(from) + demoStart(): bind the running demo and show the origin's actions.
func open(controller: BmkDemoController, texture: Texture2D, from: String) -> void:
	if demo != null:
		if demo.step_changed.is_connected(refresh): demo.step_changed.disconnect(refresh)
		if demo.lights_changed.is_connected(refresh_lights): demo.lights_changed.disconnect(refresh_lights)
	demo = controller
	origin = from
	view.texture = texture
	demo.step_changed.connect(refresh)
	demo.lights_changed.connect(refresh_lights)
	user_lit.clear()
	keyboard.settings = settings
	keyboard.character = demo.character
	preset_label.text = BmkKeyNames.preset_name(settings)
	# btnHelpBack only from pause / character select; practice and start are hidden from pause.
	back_button.visible = from in ["pause","characterSelect"]
	back_button.text = "캐릭터 선택" if from == "characterSelect" else "돌아가기"
	practice_button.visible = from != "pause"
	start_button.visible = from != "pause"
	tips.visible = false
	tips_toggle.text = "▶ 아이템 · 전투 팁"
	scroll.scroll_vertical = 0
	build_chips()
	refresh(demo.index)
	refresh_play_button()
	visible = true
	if start_button.visible: start_button.grab_focus.call_deferred()
	elif get_viewport() != null and get_viewport().gui_get_focus_owner() != null: get_viewport().gui_get_focus_owner().release_focus()

func caps_for(actions: Array, size_: int, w: float, h: float) -> Array[Cap]:
	var out: Array[Cap] = []
	for a: Variant in actions:
		out.append(Cap.new(font_bold(),str(a),BmkKeyNames.action_key(settings,str(a)),size_,w,h))
	return out

func font_bold() -> SystemFont:
	var f: SystemFont = font.duplicate() as SystemFont
	f.font_weight = 700
	return f

## demoList()
func build_chips() -> void:
	for child: Node in chips.get_children():
		chips.remove_child(child)
		child.queue_free()
	for i: int in range(demo.steps.size()):
		var step: Dictionary = demo.steps[i]
		var chip: Chip = Chip.new()
		chip.index = i
		chip.tooltip_text = str(step["title"])
		var row: HBoxContainer = HBoxContainer.new()
		row.add_theme_constant_override("separation",3)
		row.mouse_filter = Control.MOUSE_FILTER_IGNORE
		chip.add_child(row)
		chip.title = label(13,Color("d9cfe0"))
		chip.title.text = str(step["title"])
		row.add_child(chip.title)
		for cap: Cap in caps_for(step["keys"],12,20,22):
			chip.caps.append(cap)
			row.add_child(cap)
		chip.chosen.connect(func(index: int) -> void:
			demo.choose(index)
			refresh_play_button())
		chips.add_child(chip)

## demoCaption()
func refresh(_index: int = 0) -> void:
	if demo == null or demo.steps.is_empty(): return
	var step: Dictionary = demo.current()
	caption_step.text = "%d / %d" % [demo.index + 1,demo.steps.size()]
	caption_title.text = str(step["title"])
	desc.text = str(step["desc"])
	for child: Node in caption_keys.get_children():
		caption_keys.remove_child(child)
		child.queue_free()
	var keys: Array = step["keys"]
	for i: int in range(keys.size()):
		if i > 0 and keys.size() == 2 and keys[0] != keys[1]:
			var plus: Label = label(12,Color("e9dfe6"))
			plus.text = "+"
			caption_keys.add_child(plus)
		for cap: Cap in caps_for([keys[i]],13,25,26): caption_keys.add_child(cap)
	for chip: Node in chips.get_children():
		var c: Chip = chip as Chip
		c.set_on(c.index == demo.index)
		if c.index == demo.index and is_inside_tree(): reveal.call_deferred(c)
	refresh_lights()

## scrollIntoView({block: 'nearest'}) for the current chip, if it is still in the list.
func reveal(c: Control) -> void:
	if is_instance_valid(c) and c.is_inside_tree() and scroll.is_ancestor_of(c): scroll.ensure_control_visible(c)

## demoLights() + lightCaps(): the script's held keys, plus the player's own presses.
func refresh_lights() -> void:
	if demo == null: return
	for child: Node in caption_keys.get_children():
		if child is Cap: (child as Cap).set_on(demo.lit.has((child as Cap).action) or user_lit.has((child as Cap).action))
	for chip: Node in chips.get_children():
		for cap: Cap in (chip as Chip).caps: cap.set_on(user_lit.has(cap.action))
	keyboard.show_keys(demo.current().get("keys",[]),demo.lit.keys())

## demoPlayButton()
func refresh_play_button() -> void:
	play_button.text = "▶ 재생" if demo.paused else "❚❚ 멈춤"
	play_button.tooltip_text = "시범 플레이 재생" if demo.paused else "시범 플레이 멈춤"

func _process(_delta: float) -> void:
	if not visible or demo == null: return
	bar.offset_right = 0
	bar.anchor_left = 0
	bar.anchor_right = demo.progress() / 100.0

## inputDown/inputUp in scene 'tutorial': only lightCaps(code, on); the game gets no input.
func _input(event: InputEvent) -> void:
	if not visible or event is not InputEventKey or (event as InputEventKey).echo: return
	for action: String in BmkPhysicalInput.ACTIONS:
		if event.is_action("bmk_" + action):
			if event.is_pressed(): user_lit[action] = true
			else: user_lit.erase(action)
			refresh_lights()
	# The page does not move button focus with the arrow keys (they are the arcade movement keys),
	# so Enter keeps pressing the focused 게임 시작.
	for nav: String in ["ui_left","ui_right","ui_up","ui_down"]:
		if event.is_action(nav):
			get_viewport().set_input_as_handled()
			return

func _draw() -> void:
	# .dialog: linear-gradient(135deg, #19131cf5, #08070bf8).
	var top: Color = Color("19131cf5")
	var bottom: Color = Color("08070bf8")
	draw_polygon(PackedVector2Array([Vector2.ZERO,Vector2(size.x,0),size,Vector2(0,size.y)]),PackedColorArray([top,top.lerp(bottom,0.5),bottom,top.lerp(bottom,0.5)]))
	draw_rect(Rect2(Vector2.ZERO,size),Color("62505e"),false,1.0)
