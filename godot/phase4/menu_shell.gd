class_name BmkMenuShell
extends Control
signal new_game
signal continue_game
signal practice_game
signal challenge_game
signal resume_game
signal retry_game
signal quit_game
signal settings_changed

var panel: PanelContainer
var title: Label
var buttons: VBoxContainer
var settings: BmkSettings
var store: BmkSaveStore
var mode: String = "title"
var settings_origin: String = "title"
var message: Label
var capture_action: String = ""
var title_image: TextureRect

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	var korean_font: SystemFont = SystemFont.new()
	korean_font.font_names = PackedStringArray(["Malgun Gothic", "Noto Sans CJK KR", "Arial"])
	add_theme_font_override("font",korean_font)
	title_image = TextureRect.new()
	var title_asset: BmkAnimationAsset = load("res://port_assets/resources/title_original_gif.tres") as BmkAnimationAsset
	title_image.texture = title_asset.sprite_frames.get_frame_texture(&"source",0)
	title_image.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	title_image.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	title_image.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(title_image)
	var backdrop: ColorRect = ColorRect.new()
	backdrop.color = Color(0.025,0.015,0.035,0.72)
	backdrop.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(backdrop)
	panel = PanelContainer.new()
	panel.position = Vector2(250,35)
	panel.size = Vector2(460,470)
	add_child(panel)
	var scroll: ScrollContainer = ScrollContainer.new()
	scroll.custom_minimum_size = Vector2(460,470)
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

func add_button(label: String, callback: Callable, disabled: bool = false) -> void:
	var button: Button = Button.new()
	button.text = label
	button.disabled = disabled
	button.custom_minimum_size = Vector2(410,34)
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

func show_characters() -> void:
	mode = "characters"
	clear_buttons()
	title.text = "캐릭터 선택"
	message.text = "바렐 / 흑기사"
	add_button("바렐로 시작",func() -> void: new_game.emit())
	add_button("비에사 - 추후 추가",func() -> void: pass,true)
	add_button("뒤로",show_title)

func show_challenges() -> void:
	mode = "challenge"
	clear_buttons()
	title.text = "보스 도전"
	message.text = "본편의 스테이지를 클리어하면 해금됩니다."
	var records_: Array = store.records()["stages"]
	var unlocked: bool = records_.size() > 0 and records_[0] != null
	add_button("스테이지 1 / 도살자 고라스",func() -> void: challenge_game.emit(),not unlocked)
	for i: int in range(2,6): add_button("스테이지 %d / 추후 추가" % i,func() -> void: pass,true)
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

func show_result(value: String, challenge: bool) -> void:
	mode = "result"
	visible = true
	title_image.visible = false
	clear_buttons()
	title.text = "고라스 격파!" if challenge else "스테이지 1 클리어!"
	message.text = value
	add_button("다시 시작",func() -> void: retry_game.emit())
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
	add_button("뒤로",show_pause if settings_origin == "pause" else show_title)

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
