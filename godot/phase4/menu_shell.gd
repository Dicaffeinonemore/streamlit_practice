class_name BmkMenuShell
extends Control
signal new_game(character: String)
signal continue_game
signal practice_game
signal challenge_game(character: String)
signal resume_game
signal retry_game
signal next_stage
signal quit_game
signal settings_changed
signal touch_edit

var panel: PanelContainer
var title: Label
var buttons: VBoxContainer
var settings: BmkSettings
var store: BmkSaveStore
var mode: String = "title"
var settings_origin: String = "title"
var character_challenge: bool = false
## Stage index of the boss chosen in the challenge list (0 = Gorath, 1 = Morgra).
var challenge_stage: int = 0
var message: Label
var capture_action: String = ""
var title_image: TextureRect
var title_backing: ColorRect
var title_shade: TextureRect
var backdrop: ColorRect
var scroll: ScrollContainer
var button_size: Vector2 = Vector2(410,34)

# Same key art as named-runtime.js TITLE_ART_SRC (assets/runtime/7b79aad0ddf5c47ddf77fa60.webp).
const TITLE_ART_PATH: String = "res://port_assets/images/runtime_unreferenced__7b79aad0ddf5.webp"

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	var korean_font: SystemFont = SystemFont.new()
	korean_font.font_names = PackedStringArray(["Malgun Gothic", "Noto Sans CJK KR", "Arial"])
	add_theme_font_override("font",korean_font)
	# index.html #title.named-title: #070509 behind an object-fit: contain image.
	title_backing = ColorRect.new()
	title_backing.color = Color8(7,5,9)
	title_backing.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(title_backing)
	title_image = TextureRect.new()
	title_image.texture = load(TITLE_ART_PATH) as Texture2D
	title_image.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
	title_image.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	title_image.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	title_image.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	title_image.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(title_image)
	# .logo::before: radial shade under the right-hand title buttons.
	var gradient: Gradient = Gradient.new()
	gradient.offsets = PackedFloat32Array([0.0,0.45,0.72])
	gradient.colors = PackedColorArray([Color8(10,5,8,0xb8),Color8(10,5,8,0x70),Color8(10,5,8,0)])
	var shade_texture: GradientTexture2D = GradientTexture2D.new()
	shade_texture.gradient = gradient
	shade_texture.fill = GradientTexture2D.FILL_RADIAL
	shade_texture.fill_from = Vector2(0.5,0.5)
	shade_texture.fill_to = Vector2(1.0,0.5)
	title_shade = TextureRect.new()
	title_shade.texture = shade_texture
	title_shade.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	title_shade.stretch_mode = TextureRect.STRETCH_SCALE
	title_shade.position = Vector2(556,214)
	title_shade.size = Vector2(450,320)
	title_shade.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(title_shade)
	backdrop = ColorRect.new()
	backdrop.color = Color(0.025,0.015,0.035,0.72)
	backdrop.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(backdrop)
	panel = PanelContainer.new()
	add_child(panel)
	scroll = ScrollContainer.new()
	panel.add_child(scroll)
	buttons = VBoxContainer.new()
	buttons.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	buttons.add_theme_constant_override("separation",5)
	scroll.add_child(buttons)
	title = Label.new()
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.add_theme_font_size_override("font_size",26)
	buttons.add_child(title)
	message = Label.new()
	message.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	message.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	buttons.add_child(message)
	show_title()

func clear_buttons() -> void:
	for child: Node in buttons.get_children():
		if child != title and child != message:
			buttons.remove_child(child)
			child.queue_free()
	apply_layout()

# The title screen follows the browser's named title: the logo is part of the
# key art and the buttons sit beneath it on the right. Sub-menus keep the
# centered panel over a darkened backdrop.
func apply_layout() -> void:
	var art_title: bool = mode == "title"
	title_backing.visible = title_image.visible
	title_shade.visible = art_title and title_image.visible
	backdrop.visible = not art_title
	title.visible = not art_title
	if art_title:
		panel.add_theme_stylebox_override("panel",StyleBoxEmpty.new())
		button_size = Vector2(320,30)
		scroll.custom_minimum_size = Vector2(330,280)
		panel.position = Vector2(614,236)
	else:
		panel.remove_theme_stylebox_override("panel")
		button_size = Vector2(410,34)
		scroll.custom_minimum_size = Vector2(460,470)
		panel.position = Vector2(250,35)
	panel.size = scroll.custom_minimum_size

func add_button(label: String, callback: Callable, disabled: bool = false) -> void:
	var button: Button = Button.new()
	button.text = label
	button.disabled = disabled
	button.custom_minimum_size = button_size
	button.pressed.connect(callback)
	buttons.add_child(button)

func show_title() -> void:
	mode = "title"
	visible = true
	title_image.visible = true
	clear_buttons()
	title.text = "BLACK MOON KNIGHTS"
	var records_: Dictionary = store.records() if store != null else {"bestScore":0}
	message.text = "최고 점수  %d" % int(records_["bestScore"])
	add_button("새 게임",show_characters)
	add_button("이어하기",func() -> void: continue_game.emit(),store == null or store.checkpoint() == null)
	add_button("연습하기",func() -> void: practice_game.emit())
	add_button("보스 도전",show_challenges)
	add_button("설정",show_settings)
	add_button("종료",func() -> void: quit_game.emit())

## game.js openCharacterSelect(challengeStage): story start, or the character for a boss challenge.
func show_characters(challenge: bool = false) -> void:
	mode = "characters"
	character_challenge = challenge
	clear_buttons()
	title.text = "캐릭터 선택"
	var roster: Dictionary = BmkViesaData.shared().source["CHARACTERS"]
	var lines: PackedStringArray = []
	for id: String in ["barel","viesa"]:
		var hero: Dictionary = roster[id]
		lines.append("%s · %s — %s" % [hero["name"],hero["job"],hero["description"]])
	message.text = "
".join(lines)
	# Character cards: Barel's idle pose and Viesa's selection portrait (index.html #characterSelect).
	var cards: HBoxContainer = HBoxContainer.new()
	cards.alignment = BoxContainer.ALIGNMENT_CENTER
	cards.add_theme_constant_override("separation",60)
	var barel_idle: BmkAnimationAsset = load("res://port_assets/resources/barel_rika.sheet.idle.tres") as BmkAnimationAsset
	for texture: Texture2D in [barel_idle.sprite_frames.get_frame_texture(&"source",0),load("res://port_assets/images/viesa_art.selection_portrait__f771d01fc40f.png") as Texture2D]:
		var card: TextureRect = TextureRect.new()
		card.texture = texture
		card.custom_minimum_size = Vector2(120,150)
		card.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		card.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		card.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
		cards.add_child(card)
	buttons.add_child(cards)
	for id: String in ["barel","viesa"]:
		var hero: Dictionary = roster[id]
		var pick: Callable = func() -> void:
			if character_challenge: challenge_game.emit(id)
			else: new_game.emit(id)
		add_button("%s로 시작" % hero["name"] if bool(hero["available"]) else "곧 추가",pick,not bool(hero["available"]))
	add_button("보스 목록" if challenge else "뒤로",show_challenges if challenge else show_title)

func show_challenges() -> void:
	mode = "challenge"
	clear_buttons()
	title.text = "보스 도전"
	message.text = "본편의 스테이지를 클리어하면 해금됩니다."
	var records_: Array = store.records()["stages"]
	var names: Array[String] = ["도살자 고라스","까마귀 마녀 모르그라","황금왕 아우렐리온","얼어붙은 묘지왕 바르굴","흑월의 군주, 소버린"]
	for i: int in range(names.size()):
		var unlocked: bool = records_.size() > i and records_[i] != null
		var stage: int = i
		add_button("스테이지 %d / %s" % [i + 1,names[i]],func() -> void:
			challenge_stage = stage
			show_characters(true),not unlocked)
	add_button("뒤로",show_title)

func show_pause() -> void:
	mode = "pause"
	visible = true
	title_image.visible = false
	clear_buttons()
	title.text = "일시정지"
	message.text = ""
	add_button("계속하기",func() -> void: resume_game.emit())
	add_button("다시 시작",func() -> void: retry_game.emit())
	add_button("설정",show_settings)
	add_button("타이틀로",show_title)

func show_result(value: String, challenge: bool, stage: int = 0, has_next: bool = false) -> void:
	mode = "result"
	visible = true
	title_image.visible = false
	clear_buttons()
	title.text = "%s 격파!" % ["고라스","모르그라","아우렐리온","바르굴","소버린"][stage] if challenge else "스테이지 %d 클리어!" % (stage + 1)
	message.text = value
	if has_next: add_button("다음 스테이지",func() -> void: next_stage.emit())
	add_button("다시 시작",func() -> void: retry_game.emit())
	add_button("타이틀로",show_title)

## index.html #ending: shown after the final stage clear of the story (finishStage()).
func show_ending(value: String) -> void:
	mode = "ending"
	visible = true
	title_image.visible = false
	clear_buttons()
	title.text = "ALL CLEAR!"
	message.text = "모든 스테이지를 클리어했습니다. 축하합니다!\n" + value
	add_button("타이틀로",show_title)

func show_settings() -> void:
	if mode != "settings" and mode != "bindings": settings_origin = mode
	mode = "settings"
	capture_action = ""
	clear_buttons()
	title.text = "설정"
	message.text = "키 배치: " + settings.preset.to_upper()
	add_button("아케이드",func() -> void: change_preset("arcade"))
	add_button("WASD",func() -> void: change_preset("wasd"))
	add_button("키 직접 설정",show_bindings)
	add_button("배경 음악: %d%%" % roundi(settings.music_volume * 100),func() -> void: change_volume("music_volume"))
	add_button("효과음: %d%%" % roundi(settings.sfx_volume * 100),func() -> void: change_volume("sfx_volume"))
	for option: String in ["shake","flash","danger_zones"]:
		var label: String = {"shake":"화면 흔들림", "flash":"화면 번쩍임", "danger_zones":"위험 구역 표시"}[option]
		add_button("%s: %s" % [label,"켜짐" if settings.get(option) else "꺼짐"],func() -> void: change_toggle(option))
	# Touch controls (index.html settings: touchEnabled, touchAlpha, touchScale, layout edit / reset).
	add_button("모바일 조작 키: %s" % ("켜짐" if settings.touch else "꺼짐"),func() -> void: change_toggle("touch"))
	add_button("모바일 키 투명도: %d%%" % roundi((1 - float(settings.touch_layout["alpha"])) * 100),change_touch_alpha)
	add_button("모바일 키 크기: %d%%" % roundi(float(settings.touch_layout["scale"]) * 100),change_touch_scale)
	add_button("모바일 키 배치 편집",func() -> void: touch_edit.emit())
	add_button("모바일 키 초기화",reset_touch_layout)
	add_button("뒤로",show_pause if settings_origin == "pause" else show_title)

## Transparency slider 0-90% (alpha = 1 - value), in 10% steps; past 90% it wraps to 0%.
func change_touch_alpha() -> void:
	var value: int = roundi((1 - float(settings.touch_layout["alpha"])) * 100) + 10
	settings.touch_layout["alpha"] = 1 - (value if value <= 90 else 0) / 100.0
	save_settings()

## Size slider 60-160%, in 10% steps.
func change_touch_scale() -> void:
	var value: int = roundi(float(settings.touch_layout["scale"]) * 10) + 1
	settings.touch_layout["scale"] = (value if value <= 16 else 6) / 10.0
	save_settings()

func reset_touch_layout() -> void:
	settings.touch_layout = BmkTouchLayout.defaults()
	save_settings()

func save_settings() -> void:
	var error: Error = settings.save()
	settings_changed.emit()
	show_settings()
	if error != OK: message.text = "설정을 저장하지 못했습니다: " + error_string(error)

func change_preset(id: String) -> void:
	settings.use_preset(id)
	var error: Error = settings.save()
	settings_changed.emit()
	show_settings()
	if error != OK: message.text = "설정을 저장하지 못했습니다: " + error_string(error)

func change_volume(option: String) -> void:
	var value: int = roundi(float(settings.get(option)) * 10)
	settings.set(option, float((value + 1) % 11) / 10.0)
	var error: Error = settings.save()
	settings_changed.emit()
	show_settings()
	if error != OK: message.text = "설정을 저장하지 못했습니다: " + error_string(error)

func change_toggle(option: String) -> void:
	settings.set(option,not bool(settings.get(option)))
	var error: Error = settings.save()
	settings_changed.emit()
	show_settings()
	if error != OK: message.text = "설정을 저장하지 못했습니다: " + error_string(error)

func show_bindings() -> void:
	if settings.bindings.size() != BmkPhysicalInput.ACTIONS.size(): settings.use_preset(settings.preset)
	mode = "bindings"
	clear_buttons()
	title.text = "키 직접 설정"
	message.text = "동작을 고른 뒤 키를 누르세요. ESC: 취소"
	var labels: Array[String] = ["왼쪽","오른쪽","위","아래","점프","공격","회피","필살기","마법","찌르기","강타","회전","강하","적월파"]
	for i: int in range(BmkPhysicalInput.ACTIONS.size()):
		var action: String = BmkPhysicalInput.ACTIONS[i]
		add_button("%s: %s" % [labels[i],OS.get_keycode_string(settings.bindings[action])],func() -> void: capture_action = action; message.text = "새 키를 누르세요: " + action)
	add_button("뒤로",show_settings)

func _input(event: InputEvent) -> void:
	if not visible or capture_action.is_empty() or event is not InputEventKey: return
	var key: InputEventKey = event as InputEventKey
	if not key.pressed or key.echo: return
	get_viewport().set_input_as_handled()
	if key.keycode == KEY_ESCAPE:
		capture_action = ""
		show_bindings()
		return
	var code: int = key.physical_keycode if key.physical_keycode != KEY_NONE else key.keycode
	if key.ctrl_pressed or key.alt_pressed or key.meta_pressed or not settings.bind(capture_action,code):
		message.text = "사용할 수 없거나 이미 지정된 키입니다."
		return
	var error: Error = settings.save()
	settings_changed.emit()
	capture_action = ""
	show_bindings()
	if error != OK: message.text = "설정을 저장하지 못했습니다: " + error_string(error)
