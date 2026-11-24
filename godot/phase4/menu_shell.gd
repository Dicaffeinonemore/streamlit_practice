class_name BmkMenuShell
extends Control
signal new_game(character: String)
signal continue_game
signal practice_game
signal challenge_game(character: String)
signal resume_game
signal retry_game
signal next_stage
## Story continue: CONTINUE? answered (이어서 싸우기) or declined / timed out (game over).
signal continue_fight
signal give_up
signal quit_game
signal settings_changed
signal touch_edit
## Phase 12: toTutorial(from) asks the game to start the demonstration; leaving the screen stops it.
signal tutorial_requested(origin: String)
signal tutorial_left

var panel: PanelContainer
var title: Label
var buttons: VBoxContainer
var settings: BmkSettings
var store: BmkSaveStore
## audio.js AUDIO: silence on the title/boss list, the select click, mute and the boss file.
var audio: BmkGameAudio
var boss_dialog: FileDialog
var web_picker: BmkWebFilePicker
var mode: String = "title"
var settings_origin: String = "title"
## Options page (index.html #settings .settings-page): main, bgm, display, mobile or controls.
var settings_page: String = "main"
## Row focused after a rebuild of the same options page.
var settings_focus: int = 0
var character_challenge: bool = false
## Stage index of the boss chosen in the challenge list (0 = Gorath, 1 = Morgra).
var challenge_stage: int = 0
var message: Label
const Copy := preload("res://phase4/menu_copy.gd")
const KeySettings := preload("res://phase4/key_settings.gd")
const WebDialog := preload("res://phase4/web_dialog.gd")
var dialog := WebDialog.new()
var key_settings: KeySettings
var paused_challenge := false
var paused_character := "barel"
var pause_reason := "PAUSE_REASON"
const TitleMenu := preload("res://phase4/title_art/title_menu.gd")
var title_image: TitleMenu
var title_backing: ColorRect
var backdrop: ColorRect
var scroll: ScrollContainer
var button_size: Vector2 = Vector2(410,34)
## game.js selectedCharacterId (story start, tutorial, practice).
var selected_character: String = "barel"
## index.html #tutorial and the release.js opening.
var tutorial: BmkTutorialScreen
var opening: BmkOpeningScreen

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	var korean_font: SystemFont = SystemFont.new()
	korean_font.font_names = PackedStringArray(["Malgun Gothic", "Noto Sans CJK KR", "Arial"])
	add_theme_font_override("font",korean_font)
	title_backing = ColorRect.new()
	title_backing.color = Color8(7,5,9)
	title_backing.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(title_backing)
	title_image = TitleMenu.new()
	title_image.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	title_image.chosen.connect(title_choice)
	add_child(title_image)
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
	tutorial = BmkTutorialScreen.new()
	tutorial.settings = settings
	tutorial.visible = false
	add_child(tutorial)
	tutorial.back_pressed.connect(tutorial_back)
	tutorial.start_pressed.connect(show_opening)
	tutorial.practice_pressed.connect(func() -> void: practice_game.emit())
	opening = BmkOpeningScreen.new()
	add_child(opening)
	opening.finished.connect(func() -> void:
		if mode == "opening": new_game.emit(selected_character))
	dialog.theme = tutorial.theme.duplicate()
	dialog.theme.default_font = tutorial.font
	var bold: SystemFont = tutorial.font.duplicate()
	bold.font_weight = 700
	dialog.theme.set_font("font","Button",bold)
	var row_serif := SystemFont.new()
	row_serif.font_names = PackedStringArray(["Georgia", "Times New Roman", "Batang"])
	dialog.serif = row_serif
	dialog.sans = tutorial.font
	add_child(dialog)
	show_title()

func clear_buttons() -> void:
	for child: Node in buttons.get_children():
		if child != title and child != message:
			buttons.remove_child(child)
			child.queue_free()
	key_settings = null
	apply_layout()

func apply_layout() -> void:
	var art_title: bool = mode == "title"
	var overlay: bool = mode in ["tutorial","opening"]
	var web := mode in ["settings","pause"]
	title_backing.visible = title_image.visible
	title_image.controls.visible = art_title
	# Design 1: the pause menu barely dims the game; the options show the title art undimmed.
	backdrop.visible = not art_title and not overlay and mode != "settings"
	backdrop.color.a = 0.28 if mode == "pause" else 0.72
	panel.visible = not overlay and not art_title and not web
	# showScreen(id !== 'tutorial') -> demoStop()
	if tutorial != null and tutorial.visible and mode != "tutorial":
		tutorial.visible = false
		tutorial_left.emit()
	if opening != null and opening.running and mode != "opening":
		opening.running = false
		opening.visible = false
	dialog.visible = web
	buttons.alignment = BoxContainer.ALIGNMENT_BEGIN
	buttons.size_flags_vertical = Control.SIZE_SHRINK_BEGIN
	buttons.add_theme_constant_override("separation",5)
	message.remove_theme_stylebox_override("normal")
	message.visible = not web
	title.visible = not art_title and mode not in ["settings", "pause"]
	title.remove_theme_font_override("font")
	title.add_theme_font_size_override("font_size",29 if web else 26)
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	scroll.follow_focus = true
	if web:
		scroll.custom_minimum_size = Vector2.ZERO
		dialog.show_scroll(scroll, dialog_page())
		title.add_theme_font_override("font", tutorial.serif)
		title.add_theme_color_override("font_color",Color("e6d6d0"))
		button_size = Vector2(0,34)
		return
	if scroll.get_parent() != panel: scroll.reparent(panel, false)
	title.remove_theme_color_override("font_color")
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

func dialog_page() -> String:
	if mode == "pause": return "pause"
	return "controls" if settings_page == "controls" else "settings"

## Sizes the framed panel to its rows, as the web panel wraps its content.
func fit_dialog() -> void:
	var rows: int = 0
	for child: Node in buttons.get_children():
		if child is Button and (child as Button).visible: rows += 1
		elif child is Label and (child as Label).visible and child != title: rows += 1
	dialog.show_scroll(scroll, dialog_page(), rows)

## Shows a save or file error above the option rows.
func notice(text: String) -> void:
	message.text = text
	message.visible = not text.is_empty()
	if mode == "settings": fit_dialog()

func show_title() -> void:
	mode = "title"
	visible = true
	# game.js toTitle(): AUDIO.silence(); AUDIO.pause(false)
	if audio != null:
		audio.silence()
		audio.pause_audio(false)
	title_image.visible = true
	clear_buttons()
	title_image.open(settings.menu_language if settings != null else "en", store != null and store.checkpoint() != null)
	title.text = title_image.caption("GAME_NAME")
	message.text = ""

func title_choice(key: String) -> void:
	match key:
		"New Game": show_characters()
		"Continue": continue_game.emit()
		"MENU_CHALLENGE": show_challenges()
		"Options": show_settings()
		"Credits": show_title_info(key, "MENU_CREDIT_LINE")
		"Exit":
			if BmkPlatform.can_quit(): quit_game.emit()
			else: show_title_info(key, "MENU_EXIT_WEB")

func show_title_info(heading: String, body: String) -> void:
	mode = "title_info"
	clear_buttons()
	title.text = title_image.caption(heading)
	message.text = title_image.caption(body)
	add_button(title_image.caption("MENU_BACK"), show_title)
	(buttons.get_child(-1) as Button).grab_focus()

## game.js openCharacterSelect(challengeStage): story start, or the character for a boss challenge.
func show_characters(challenge: bool = false) -> void:
	mode = "characters"
	character_challenge = challenge
	if audio != null: audio.play("click")
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
	for texture: Texture2D in [barel_idle.sprite_frames.get_frame_texture(&"source",0),load("res://port_assets/images/viesa_art.selection_portrait__420d43302e16.png") as Texture2D]:
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
			selected_character = id
			if character_challenge: challenge_game.emit(id)
			else: show_tutorial("characterSelect")
		add_button("%s로 시작" % hero["name"] if bool(hero["available"]) else "곧 추가",pick,not bool(hero["available"]))
	add_button("보스 목록" if challenge else "뒤로",show_challenges if challenge else show_title)

func show_challenges() -> void:
	mode = "challenge"
	# game.js openBossChallenge(): AUDIO.silence(); AUDIO.pause(false)
	if audio != null:
		audio.silence()
		audio.pause_audio(false)
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
	var language: String = settings.menu_language if settings != null else "en"
	title.text = Copy.text("PAUSE_TITLE", language)
	message.text = Copy.text(pause_reason, language)
	# Design 1: bilingual rows, English in serif capitals and Korean after a rule.
	var resume_button := pause_row("ROW_RESUME", "PAUSE_RESUME", func() -> void: resume_game.emit())
	if paused_challenge: pause_row("ROW_BOSSES", "PAUSE_BOSSES", show_challenges)
	pause_row("ROW_CONTROLS", "PAUSE_HELP", show_tutorial.bind("pause"))
	pause_row("ROW_OPTIONS", "Options", show_settings)
	pause_row("ROW_RESTART", "PAUSE_RESTART", func() -> void: retry_game.emit())
	var title_button := pause_row("ROW_MAIN_MENU", "PAUSE_TITLE_BACK", show_title)
	title_button.tooltip_text = Copy.text("PAUSE_TIP", language)
	if can_toggle_fullscreen():
		var fullscreen := DisplayServer.window_get_mode() in [DisplayServer.WINDOW_MODE_FULLSCREEN,DisplayServer.WINDOW_MODE_EXCLUSIVE_FULLSCREEN]
		var key: String = "FULL_OFF" if fullscreen else "FULL_ON"
		dialog.row(buttons, Copy.text(key, "en"), Copy.text(key, "ko"), func() -> void:
			DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_WINDOWED if fullscreen else DisplayServer.WINDOW_MODE_FULLSCREEN)
			show_pause())
	fit_dialog()
	resume_button.grab_focus()

## One pause row; old_key keeps the previous caption ("계속하기", "설정") findable.
func pause_row(key: String, old_key: String, callback: Callable) -> Button:
	return dialog.row(buttons, Copy.text(key, "en"), Copy.text(key, "ko"), callback, false, [Copy.text(old_key, "en"), Copy.text(old_key, "ko")])

func can_toggle_fullscreen() -> bool:
	if not (DisplayServer.is_touchscreen_available() or settings.touch): return false
	if OS.has_feature("web"):
		return bool(JavaScriptBridge.eval("!!(document.fullscreenEnabled || document.webkitFullscreenEnabled)"))
	return DisplayServer.has_feature(DisplayServer.FEATURE_SUBWINDOWS)

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

## game.js offerContinue(): CONTINUE? with a 10 s countdown (story mode, last life lost). The world
## stays frozen behind it. Enter / 이어서 싸우기 continues on the spot; Esc / 포기 or 0 is game over.
const CONTINUE_SECONDS: int = 10
const TICKS_PER_SECOND: int = 60
var continue_ticks: int = 0

func show_continue() -> void:
	mode = "continue"
	visible = true
	title_image.visible = false
	clear_buttons()
	continue_ticks = CONTINUE_SECONDS * TICKS_PER_SECOND
	title.text = continue_title(CONTINUE_SECONDS)
	message.text = "쓰러진 자리에서 라이프 3개로 다시 일어납니다.
점수는 0이 됩니다."
	add_button("이어서 싸우기 (Enter)",answer_continue.bind(true))
	add_button("포기 (Esc)",answer_continue.bind(false))

static func continue_title(seconds: int) -> String:
	return "CONTINUE?  %d" % seconds

func answer_continue(fight: bool) -> void:
	if mode != "continue" or not visible: return
	if fight: continue_fight.emit()
	else: give_up.emit()

## updateContinue(): one 60 Hz tick, counted in whole ticks; a click on each new second; at 0, give up.
func step_continue() -> void:
	if mode != "continue" or not visible: return
	continue_ticks -= 1
	var left: int = maxi(0,ceili(continue_ticks / float(TICKS_PER_SECOND)))
	if title.text != continue_title(left):
		title.text = continue_title(left)
		if left > 0 and audio != null: audio.play("click")
	if continue_ticks <= 0: answer_continue(false)

func _physics_process(_delta: float) -> void:
	step_continue()

## index.html #over (game.js gameOver()): the stage and score, 다시 도전 / 타이틀로, and 보스 목록 in
## a boss challenge.
func show_game_over(info: String, challenge: bool) -> void:
	mode = "over"
	visible = true
	title_image.visible = false
	clear_buttons()
	title.text = "GAME OVER"
	message.text = info
	if challenge: add_button("보스 목록",show_challenges)
	add_button("다시 도전",func() -> void: retry_game.emit())
	add_button("타이틀로",show_title)

## game.js toTutorial(from): the demonstration screen, from character select or pause.
func show_tutorial(origin: String) -> void:
	mode = "tutorial"
	visible = true
	title_image.visible = false
	clear_buttons()
	title.text = "조작 안내"
	message.text = ""
	# The game resumes the sound first (except from pause), then sfx('click').
	tutorial_requested.emit(origin)
	if audio != null: audio.play("click")

## btnHelpBack / Esc: back to where the tutorial was opened.
func tutorial_back() -> void:
	match tutorial.origin:
		"pause": show_pause()
		"characterSelect": show_characters(false)
		_: show_title()

## release.js startOpening(): AUDIO.silence(), then 18 s of opening panels.
func show_opening() -> void:
	mode = "opening"
	visible = true
	title_image.visible = false
	clear_buttons()
	if audio != null: audio.silence()
	opening.start(settings == null or settings.shake)

## onKeyOnce() while the tutorial is shown: Enter starts the game (not from pause), Esc goes back.
func tutorial_key(key: Key) -> bool:
	if mode == "title_info" and key == KEY_ESCAPE:
		show_title()
		return true
	if mode != "tutorial": return false
	if key in [KEY_ENTER,KEY_KP_ENTER] and tutorial.origin != "pause":
		show_opening()
		return true
	if key == KEY_ESCAPE:
		tutorial_back()
		return true
	return false

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
	var previous_scroll := scroll.scroll_vertical if mode == "settings" else 0
	if mode != "settings":
		settings_origin = mode
		settings_page = "main"
		settings_focus = 0
	mode = "settings"
	title_image.visible = true
	clear_buttons()
	message.text = ""
	match settings_page:
		"bgm": build_bgm_page()
		"display": build_display_page()
		"mobile": build_mobile_page()
		"controls": build_controls_page()
		_: build_main_page()
	fit_dialog()
	scroll.set_deferred("scroll_vertical", previous_scroll)
	var rows: Array[Button] = []
	for child: Node in buttons.get_children():
		if child is Button: rows.append(child as Button)
	if settings_page == "controls" and key_settings != null and settings_focus == 0:
		key_settings.tabs[settings.preset].grab_focus()
	elif not rows.is_empty():
		rows[clampi(settings_focus, 0, rows.size() - 1)].grab_focus()

func opt(key: String) -> String:
	return Copy.text(key, settings.menu_language)

## Every caption a row is known by: this language, the other one, and older labels.
func opt_captions(key: String, extra: Array = []) -> Array:
	var names: Array = [Copy.text(key, "en"), Copy.text(key, "ko")]
	names.append_array(extra)
	return names

func open_settings_page(page: String) -> void:
	if mode != "settings": show_settings()
	settings_page = page
	settings_focus = 0
	show_settings()

func show_controls() -> void:
	open_settings_page("controls")

func nav_row(key: String, page: String, extra: Array = []) -> Button:
	return dialog.row(buttons, opt(key), "", open_settings_page.bind(page), true, opt_captions(key, extra))

func back_row() -> Button:
	return dialog.row(buttons, opt("OPT_BACK"), "", back_from_settings, true, opt_captions("OPT_BACK", ["뒤로", Copy.text("KEYS_BACK")]))

## Left / Right on a focused row run step(-1 or 1).
func arrows_step(button: Button, step: Callable) -> void:
	button.gui_input.connect(func(event: InputEvent) -> void:
		for direction: int in [-1, 1]:
			if event.is_action_pressed("ui_left" if direction < 0 else "ui_right"):
				step.call(direction)
				button.accept_event())

## The design's first five rows plus the sub-pages the web options have.
func build_main_page() -> void:
	var language := dialog.row(buttons, opt("OPT_LANGUAGE"), "", toggle_menu_language, false, opt_captions("OPT_LANGUAGE", [title_image.caption("MENU_LANGUAGE")]))
	var area := dialog.value_area(language)
	area.add_child(dialog.arrow("◀", toggle_menu_language))
	area.add_child(dialog.value_box("English" if settings.menu_language == "en" else "한국어", 112))
	area.add_child(dialog.arrow("▶", toggle_menu_language))
	arrows_step(language, func(_d: int) -> void: toggle_menu_language())
	slider_row("OPT_MUSIC", roundi(settings.music_volume * 100), 0, 100, func(v: int) -> void: settings.music_volume = v / 100.0)
	slider_row("OPT_SOUND", roundi(settings.sfx_volume * 100), 0, 100, func(v: int) -> void: settings.sfx_volume = v / 100.0)
	if audio != null: nav_row("OPT_BOSS_BGM", "bgm")
	nav_row("OPT_DISPLAY", "display")
	nav_row("OPT_MOBILE", "mobile")
	nav_row("OPT_CONTROLS", "controls", [Copy.text("KEYS")])
	back_row()

## game-ui.js showBgm(): custom file > game default mp3 > synthesized score; the clear row is only
## enabled for a custom file.
func build_bgm_page() -> void:
	var status := dialog.text_label("%s · %s" % [opt("OPT_BOSS_BGM"), boss_status()], dialog.sans, 13)
	status.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	status.add_theme_color_override("font_color", Color("cbb9b0"))
	buttons.add_child(status)
	dialog.row(buttons, opt("OPT_BGM_PICK"), "", choose_boss_file, false, opt_captions("OPT_BGM_PICK"))
	var clear := dialog.row(buttons, opt("OPT_BGM_CLEAR"), "", func() -> void:
		audio.clear_boss_file()
		show_settings(), false, opt_captions("OPT_BGM_CLEAR", ["보스전 음악 기본값으로"]))
	clear.disabled = audio.boss_info()["source"] != "custom"
	back_row()

func build_display_page() -> void:
	toggle_row("OPT_SHAKE", "shake")
	toggle_row("OPT_FLASH", "flash")
	toggle_row("OPT_DANGER", "danger_zones")
	back_row()

## Touch controls (index.html settings: touchEnabled, touchAlpha, touchScale, layout edit / reset).
func build_mobile_page() -> void:
	toggle_row("OPT_TOUCH", "touch")
	slider_row("OPT_TOUCH_ALPHA", roundi((1 - float(settings.touch_layout["alpha"])) * 100), 0, 90, func(v: int) -> void: settings.touch_layout["alpha"] = 1 - v / 100.0)
	slider_row("OPT_TOUCH_SCALE", roundi(float(settings.touch_layout["scale"]) * 100), 60, 160, func(v: int) -> void: settings.touch_layout["scale"] = v / 100.0)
	dialog.row(buttons, opt("OPT_TOUCH_EDIT"), "", func() -> void: touch_edit.emit(), true, opt_captions("OPT_TOUCH_EDIT", ["모바일 키 배치 편집"]))
	dialog.row(buttons, opt("OPT_TOUCH_RESET"), "", reset_touch_layout, false, opt_captions("OPT_TOUCH_RESET", ["모바일 키 초기화"]))
	back_row()

func build_controls_page() -> void:
	key_settings = KeySettings.new()
	key_settings.settings = settings
	key_settings.character = paused_character if settings_origin == "pause" else selected_character
	key_settings.changed.connect(func() -> void: settings_changed.emit())
	buttons.add_child(key_settings)
	dialog.row(buttons, opt("OPT_RESET_KEYS"), "", func() -> void: change_preset("arcade"), false, opt_captions("OPT_RESET_KEYS", [Copy.text("KEYS_RESET")]))
	back_row()

## ON / OFF row; Enter, a click or Left / Right flips it in place.
func toggle_row(key: String, option: String) -> Button:
	var button := dialog.row(buttons, opt(key), "", Callable(), false, opt_captions(key))
	var box := dialog.value_box("", 58)
	dialog.value_area(button).add_child(box)
	var paint := func() -> void:
		var on := bool(settings.get(option))
		box.text = "ON" if on else "OFF"
		dialog.set_box_state(box, on)
		button.set_meta("value", on)
	paint.call()
	var flip := func() -> void:
		settings.set(option, not bool(settings.get(option)))
		paint.call()
		persist()
	button.pressed.connect(flip)
	arrows_step(button, func(_d: int) -> void: flip.call())
	return button

## Slider row with a percentage. A click steps 10 and wraps like the old option buttons; Left / Right
## step 10 within the range; dragging the track sets any value.
func slider_row(key: String, value: int, low: int, high: int, apply: Callable) -> Button:
	var button := dialog.row(buttons, opt(key), "", Callable(), false, opt_captions(key))
	var area := dialog.value_area(button)
	var bar := dialog.slider(value, high)
	bar.min_value = low
	bar.value = value
	var percent := dialog.text_label("%d%%" % value, dialog.serif, 14)
	percent.custom_minimum_size.x = 42
	percent.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	area.add_child(bar)
	area.add_child(percent)
	button.set_meta("slider", bar)
	bar.value_changed.connect(func(v: float) -> void:
		percent.text = "%d%%" % roundi(v)
		apply.call(roundi(v))
		persist())
	button.pressed.connect(func() -> void:
		bar.value = low if roundi(bar.value) + 10 > high else roundi(bar.value) + 10)
	arrows_step(button, func(d: int) -> void: bar.value = clampi(roundi(bar.value) + d * 10, low, high))
	return button

## Saves without rebuilding the page, so the focused row and a dragged slider stay put.
func persist() -> void:
	var error: Error = settings.save()
	settings_changed.emit()
	if error != OK: notice("설정을 저장하지 못했습니다: " + error_string(error))

func back_from_settings() -> void:
	if settings_page != "main":
		var from := settings_page
		settings_page = "main"
		settings_focus = ["bgm", "display", "mobile", "controls"].find(from) + (3 if audio != null else 2)
		show_settings()
		return
	if settings_origin == "pause": show_pause()
	else: show_title()


func toggle_menu_language() -> void:
	settings.menu_language = "ko" if settings.menu_language == "en" else "en"
	title_image.locale = settings.menu_language
	var error := settings.save()
	settings_focus = 0
	show_settings()
	if error != OK: notice(error_string(error))

func boss_status() -> String:
	var info: Dictionary = audio.boss_info()
	return "내 파일: %s" % info["name"] if info["source"] == "custom" else ("게임 기본 mp3" if info["source"] == "default" else "기본 합성 BGM")

## index.html #bossBgmFile: pick an audio file (mp3, ogg or wav, at most 30 MB).
func choose_boss_file() -> void:
	if BmkPlatform.uses_browser_file_picker():
		choose_boss_file_in_browser()
		return
	if boss_dialog == null:
		boss_dialog = FileDialog.new()
		boss_dialog.file_mode = FileDialog.FILE_MODE_OPEN_FILE
		boss_dialog.access = FileDialog.ACCESS_FILESYSTEM
		boss_dialog.use_native_dialog = true
		boss_dialog.filters = PackedStringArray(["*.mp3, *.ogg, *.wav ; 오디오 파일"])
		boss_dialog.title = "보스전 음악 파일"
		boss_dialog.file_selected.connect(func(path: String) -> void:
			var result: Dictionary = audio.set_boss_file(path)
			show_settings()
			if not bool(result["ok"]): notice(str(result["message"]))
			elif not bool(result.get("saved",true)): notice("내 파일: %s (저장 불가 · 이번 실행에만 적용)" % audio.boss_name))
		add_child(boss_dialog)
	boss_dialog.popup_centered(Vector2i(720,480))

## Phase 13 Web export: the page's own file chooser, with the same messages as the FileDialog path.
func choose_boss_file_in_browser() -> void:
	if web_picker == null:
		web_picker = BmkWebFilePicker.new()
		web_picker.picked.connect(func(file_name: String, bytes: PackedByteArray) -> void:
			var result: Dictionary = audio.set_boss_bytes(file_name,bytes)
			if mode == "settings": show_settings()
			if not bool(result["ok"]): notice(str(result["message"]))
			elif not bool(result.get("saved",true)): notice("내 파일: %s (저장 불가 · 이번 실행에만 적용)" % audio.boss_name))
		web_picker.failed.connect(func(reason: String, _file_name: String) -> void:
			notice("30MB 이하의 파일만 쓸 수 있습니다." if reason == "big" else "파일을 열 수 없습니다."))
	web_picker.open(".mp3,.ogg,.wav,audio/mpeg,audio/ogg,audio/wav",BmkGameAudio.BOSS_MAX_BYTES)

func reset_touch_layout() -> void:
	settings.touch_layout = BmkTouchLayout.defaults()
	save_settings()

func save_settings() -> void:
	var error: Error = settings.save()
	settings_changed.emit()
	show_settings()
	if error != OK: notice("설정을 저장하지 못했습니다: " + error_string(error))

func change_preset(id: String) -> void:
	if key_settings == null: show_controls()
	key_settings.choose_preset(id)
