extends Control
## F6 preview for extracted assets. Gameplay remains the separately approved phase.
var entries: Array = []
var current: Resource
var frame_index: int = 0
var elapsed_ms: float = 0.0
var playing: bool = true
var sprite: Sprite2D
var list: ItemList
var info: Label
var search: LineEdit
var audio_player: AudioStreamPlayer

func _ready() -> void:
	get_window().content_scale_size = Vector2i(1280, 720)
	var font: SystemFont = SystemFont.new()
	font.font_names = PackedStringArray(["Malgun Gothic", "sans-serif"])
	add_theme_font_override("font", font)
	var title: Label = Label.new()
	title.text = "BLACK MOON KNIGHT / ORIGINAL ASSET REVIEW"
	title.position = Vector2(24, 12)
	add_child(title)
	search = LineEdit.new()
	search.placeholder_text = "Filter: barel_rika, gorath_remake, stage1_enemy, viesa, rle..."
	search.position = Vector2(24, 50)
	search.size = Vector2(600, 36)
	search.text_changed.connect(filter_entries)
	add_child(search)
	list = ItemList.new()
	list.position = Vector2(24, 98)
	list.size = Vector2(420, 560)
	list.item_selected.connect(select_entry)
	add_child(list)
	sprite = Sprite2D.new()
	sprite.centered = false
	sprite.position = Vector2(850, 540)
	sprite.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	add_child(sprite)
	info = Label.new()
	info.position = Vector2(470, 90)
	info.size = Vector2(780, 180)
	info.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	add_child(info)
	var toggle: Button = Button.new()
	toggle.text = "Play / Pause [Space]"
	toggle.position = Vector2(470, 625)
	toggle.pressed.connect(func() -> void: playing = not playing)
	add_child(toggle)
	var next: Button = Button.new()
	next.text = "Next frame [Right]"
	next.position = Vector2(680, 625)
	next.pressed.connect(next_frame)
	add_child(next)
	var music: Button = Button.new()
	music.text = "Stage 1 OGG / Stop"
	music.position = Vector2(890, 625)
	music.pressed.connect(toggle_audio)
	add_child(music)
	audio_player = AudioStreamPlayer.new()
	audio_player.volume_db = -8.0
	add_child(audio_player)
	if FileAccess.file_exists("res://port_assets/resources/index.json"):
		var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string("res://port_assets/resources/index.json"))
		if parsed is Array:
			entries = parsed
	filter_entries("")
	if list.item_count > 0:
		list.select(0)
		select_entry(0)
	queue_redraw()

func filter_entries(query: String) -> void:
	list.clear()
	for entry: Dictionary in entries:
		if query.is_empty() or query.to_lower() in str(entry["id"]).to_lower():
			list.add_item(str(entry["id"]))
			list.set_item_metadata(list.item_count - 1, entry["path"])

func select_entry(index: int) -> void:
	current = load(str(list.get_item_metadata(index)))
	frame_index = 0
	elapsed_ms = 0.0
	show_frame()

func show_frame() -> void:
	if current == null:
		return
	var frames: SpriteFrames = current.get("sprite_frames") as SpriteFrames
	if frames.get_frame_count(&"source") == 0:
		return
	frame_index = frame_index % frames.get_frame_count(&"source")
	var pivots: PackedVector2Array = current.get("frame_pivots")
	var scales: PackedFloat64Array = current.get("frame_scales")
	var authoritative: PackedByteArray = current.get("authoritative_duration")
	sprite.texture = frames.get_frame_texture(&"source", frame_index)
	var metadata: Dictionary = current.get("metadata")
	sprite.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR if bool(metadata.get("smooth", false)) else CanvasItem.TEXTURE_FILTER_NEAREST
	var scale_value: float = scales[frame_index] * 1.5
	sprite.scale = Vector2.ONE * scale_value
	sprite.offset = -pivots[frame_index]
	info.text = "%s\nFrame %d / %d   |   Original world scale %.6f × source camera zoom 1.5\nPivot %s   |   %s\nFoot anchor is fixed at the cross. Preview looping does not change source gameplay timing." % [str(current.get("source_id")), frame_index + 1, frames.get_frame_count(&"source"), scales[frame_index], str(pivots[frame_index]), "Source frame duration" if authoritative[frame_index] else "Preview-only 100 ms: state-driven source timing retained in catalog"]

func next_frame() -> void:
	playing = false
	frame_index += 1
	show_frame()

func toggle_audio() -> void:
	if audio_player.playing:
		audio_player.stop()
	else:
		var stream: AudioStreamOggVorbis = load("res://port_assets/audio/music/stage_1_loop.ogg") as AudioStreamOggVorbis
		if stream != null:
			stream.loop = true
			audio_player.stream = stream
			audio_player.play()

func _process(delta: float) -> void:
	if not playing or current == null:
		return
	var durations: PackedFloat64Array = current.get("duration_ms")
	if durations.is_empty():
		return
	elapsed_ms += delta * 1000.0
	while elapsed_ms >= durations[frame_index]:
		elapsed_ms -= durations[frame_index]
		frame_index = (frame_index + 1) % durations.size()
	show_frame()

func _unhandled_key_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo:
		if event.keycode == KEY_SPACE:
			playing = not playing
		elif event.keycode == KEY_RIGHT:
			next_frame()

func _draw() -> void:
	draw_line(Vector2(465, 540), Vector2(1240, 540), Color("655b51"), 1.0)
	draw_line(Vector2(850, 523), Vector2(850, 557), Color("d4b879"), 1.0)
