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
	title.text = "BLACK MOON KNIGHT"
	var records_: Dictionary = store.records() if store != null else {"bestScore":0}
	message.text = "BEST SCORE  %d" % int(records_["bestScore"])
	add_button("NEW GAME",show_characters)
	add_button("CONTINUE",func() -> void: continue_game.emit(),store == null or store.checkpoint() == null)
	add_button("PRACTICE",func() -> void: practice_game.emit())
	add_button("BOSS CHALLENGE",show_challenges)
	add_button("SETTINGS",show_settings)
	add_button("QUIT",func() -> void: quit_game.emit())

func show_characters() -> void:
	mode = "characters"
	clear_buttons()
	title.text = "SELECT CHARACTER"
	message.text = "BAREL  /  BLACK KNIGHT"
	add_button("BAREL - START",func() -> void: new_game.emit())
	add_button("VIESA - COMING IN PHASE 5",func() -> void: pass,true)
	add_button("BACK",show_title)

func show_challenges() -> void:
	mode = "challenge"
	clear_buttons()
	title.text = "BOSS CHALLENGE"
	message.text = "Clear a stage to unlock its boss."
	var records_: Array = store.records()["stages"]
	var unlocked: bool = records_.size() > 0 and records_[0] != null
	add_button("STAGE 1 / GORATH",func() -> void: challenge_game.emit(),not unlocked)
	for i: int in range(2,6): add_button("STAGE %d / UNAVAILABLE" % i,func() -> void: pass,true)
	add_button("BACK",show_title)

func show_pause() -> void:
	mode = "pause"
	visible = true
	title_image.visible = false
	clear_buttons()
	title.text = "PAUSED"
	message.text = ""
	add_button("RESUME",func() -> void: resume_game.emit())
	add_button("RETRY STAGE",func() -> void: retry_game.emit())
	add_button("SETTINGS",show_settings)
	add_button("TITLE",show_title)

func show_result(value: String, challenge: bool) -> void:
	mode = "result"
	visible = true
	title_image.visible = false
	clear_buttons()
	title.text = "GORATH DEFEATED" if challenge else "STAGE 1 CLEAR"
	message.text = value
	add_button("RETRY",func() -> void: retry_game.emit())
	add_button("TITLE",show_title)

func show_settings() -> void:
	if mode != "settings" and mode != "bindings": settings_origin = mode
	mode = "settings"
	capture_action = ""
	clear_buttons()
	title.text = "SETTINGS"
	message.text = "KEYS: " + settings.preset.to_upper()
	add_button("ARCADE",func() -> void: change_preset("arcade"))
	add_button("WASD",func() -> void: change_preset("wasd"))
	add_button("CUSTOM KEYS",show_bindings)
	add_button("MUSIC: %d%%" % roundi(settings.music_volume * 100),func() -> void: change_volume("music_volume"))
	add_button("SOUND: %d%%" % roundi(settings.sfx_volume * 100),func() -> void: change_volume("sfx_volume"))
	for option: String in ["shake","flash","danger_zones"]:
		add_button("%s: %s" % [option.to_upper(),"ON" if settings.get(option) else "OFF"],func() -> void: change_toggle(option))
	add_button("BACK",show_pause if settings_origin == "pause" else show_title)

func change_preset(id: String) -> void:
	settings.use_preset(id)
	settings.save()
	settings_changed.emit()
	show_settings()

func change_volume(option: String) -> void:
	var value: int = roundi(float(settings.get(option)) * 10)
	settings.set(option, float((value + 1) % 11) / 10.0)
	settings.save()
	settings_changed.emit()
	show_settings()

func change_toggle(option: String) -> void:
	settings.set(option,not bool(settings.get(option)))
	settings.save()
	settings_changed.emit()
	show_settings()

func show_bindings() -> void:
	if settings.bindings.size() != BmkPhysicalInput.ACTIONS.size(): settings.use_preset(settings.preset)
	mode = "bindings"
	clear_buttons()
	title.text = "CUSTOM KEYS"
	message.text = "Select an action, then press a key. ESC cancels."
	var labels: Array[String] = ["LEFT","RIGHT","UP","DOWN","JUMP","ATTACK","DASH","SPECIAL","MAGIC","THRUST","SLAM","WHIRL","LEAP","RED WAVE"]
	for i: int in range(BmkPhysicalInput.ACTIONS.size()):
		var action: String = BmkPhysicalInput.ACTIONS[i]
		add_button("%s: %s" % [labels[i],OS.get_keycode_string(settings.bindings[action])],func() -> void: capture_action = action; message.text = "PRESS A KEY FOR " + action)
	add_button("BACK",show_settings)

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
		message.text = "KEY IS RESERVED OR ALREADY ASSIGNED"
		return
	settings.save()
	settings_changed.emit()
	capture_action = ""
	show_bindings()
