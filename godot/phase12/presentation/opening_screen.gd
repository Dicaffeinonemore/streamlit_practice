class_name BmkOpeningScreen
extends Control
## release.js startOpening / drawOpening / finishOpening: six 3-second panels of the original
## opening art with their lines, 18 s in all. Enter, Space, Esc or 건너뛰기 skip it.
signal finished

const MS: float = 1000.0 / 60.0
const DURATION: float = 18000.0
const LINES: Array[String] = ["붉은 월식이 다섯 왕국을 삼켰다.","무너진 왕좌 너머, 검은 성채가 깨어난다.","잿더미에서 한 기사가 일어섰다.","다섯 군주가 밤의 문을 지킨다.","대검을 들어, 끝나지 않는 밤을 가르라.","Lunatic Nights"]
const IMAGES: Array[String] = ["release_art.opening0__88bf332616b7.png","release_art.opening1__5d336676bd2f.png","release_art.opening2__e7e5e60d281d.png","release_art.opening3__be9495493866.png","release_art.opening4__9e061837a03c.png","release_art.opening5__bd77ca4fb7f1.png"]
## openingTime (ms), advanced once per simulation tick.
var time: float = 0.0
var running: bool = false
## UX.options.shake: the slow zoom.
var zoom_enabled: bool = true
var textures: Array[Texture2D] = []
var skip_button: Button
var font: SystemFont

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	for file: String in IMAGES: textures.append(load("res://port_assets/images/" + file) as Texture2D)
	font = SystemFont.new()
	font.font_names = PackedStringArray(["Malgun Gothic","Apple SD Gothic Neo","Noto Sans CJK KR","Arial"])
	font.font_weight = 700
	# #openingSkip: right 3%, bottom 4%.
	skip_button = Button.new()
	skip_button.text = "건너뛰기 · Enter / Space"
	skip_button.add_theme_font_size_override("font_size",13)
	skip_button.focus_mode = Control.FOCUS_NONE
	var box: StyleBoxFlat = StyleBoxFlat.new()
	box.bg_color = Color("281820")
	box.border_color = Color("86727b")
	box.set_border_width_all(1)
	box.set_corner_radius_all(2)
	box.content_margin_left = 12
	box.content_margin_right = 12
	box.content_margin_top = 4
	box.content_margin_bottom = 4
	var hover: StyleBoxFlat = box.duplicate()
	hover.bg_color = Color("63263a")
	skip_button.add_theme_stylebox_override("normal",box)
	skip_button.add_theme_stylebox_override("hover",hover)
	skip_button.add_theme_stylebox_override("pressed",hover)
	skip_button.add_theme_color_override("font_color",Color("eee0da"))
	skip_button.pressed.connect(finish)
	add_child(skip_button)
	visible = false

func start(zoom: bool = true) -> void:
	time = 0.0
	zoom_enabled = zoom
	running = true
	visible = true
	skip_button.visible = true
	queue_redraw()

func finish() -> void:
	if not running: return
	running = false
	visible = false
	finished.emit()

## update(): openingTime += MS; finish at 18 s.
func advance() -> void:
	if not running: return
	time += MS
	if time >= DURATION: finish()
	queue_redraw()

func _physics_process(_delta: float) -> void:
	advance()

func _process(_delta: float) -> void:
	if skip_button == null: return
	var s: Vector2 = skip_button.get_combined_minimum_size()
	skip_button.size = s
	skip_button.position = Vector2(size.x * 0.97 - s.x,size.y * 0.96 - s.y)

func _input(event: InputEvent) -> void:
	if not running or event is not InputEventKey: return
	var key: InputEventKey = event as InputEventKey
	if not key.pressed or key.echo: return
	if key.keycode in [KEY_ENTER,KEY_KP_ENTER,KEY_SPACE,KEY_ESCAPE]:
		get_viewport().set_input_as_handled()
		finish()

func panel() -> int:
	return mini(5,floori(time / 3000.0))

func _draw() -> void:
	var w: float = size.x
	var h: float = size.y
	var n: int = panel()
	var t: float = fmod(time,3000.0) / 3000.0
	draw_rect(Rect2(0,0,w,h),Color("060409"))
	var alpha: float = minf(1.0,minf(t * 6.0,(1.0 - t) * 6.0))
	var im: Texture2D = textures[n]
	if im != null:
		var zoom: float = 1.0 + t * 0.035 if zoom_enabled else 1.0
		var scale: float = maxf(w / im.get_width(),h / im.get_height()) * zoom
		var dw: float = im.get_width() * scale
		var dh: float = im.get_height() * scale
		draw_texture_rect(im,Rect2((w - dw) / 2,(h - dh) / 2,dw,dh),false,Color(1,1,1,alpha))
	draw_rect(Rect2(0,h - 104,w,104),Color(6 / 255.0,4 / 255.0,9 / 255.0,(0xbb / 255.0) * alpha))
	# krText(): bold, 4 px black stroke under the fill, alphabetic baseline at H - 64.
	var size_: int = 32 if n == 5 else 20
	var pos: Vector2 = Vector2(0,h - 64)
	draw_string_outline(font,pos,LINES[n],HORIZONTAL_ALIGNMENT_CENTER,w,size_,4,Color(0,0,0,alpha))
	draw_string(font,pos,LINES[n],HORIZONTAL_ALIGNMENT_CENTER,w,size_,Color(0xf0 / 255.0,0xdc / 255.0,0xe0 / 255.0,alpha))
