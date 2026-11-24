class_name BmkHudDesign
extends RefCounted
## Player / boss HUD design (pixel-ui.js): the supplied 1672 x 941 overlay, built by
## tools/build-hud-ui.py with the live text and fills removed. Layout coordinates are in the
## design's 1672-wide space and drawn at 960 / 1672.

const ATLAS_PATH := "res://port_assets/images/hud_ui_source__92e93cec0567.png"
const K := 960.0 / 1672.0
const HP := Rect2(152, 99, 432, 23)
const SP := Rect2(56, 147, 507, 21)
const BOSS := Rect2(475, 850, 1142, 24)
# Original fills kept in the atlas by the build script.
const HP_STRIP := Rect2(100, 400, 431, 21)
const SP_STRIP := Rect2(100, 440, 505, 21)
const BOSS_STRIP := Rect2(100, 480, 1045, 22)
const BOSS_LOW_STRIP := Rect2(100, 520, 94, 22)
const SCROLLS: Array[Rect2] = [Rect2(603, 92, 47, 74), Rect2(650, 92, 47, 74), Rect2(697, 92, 47, 74)]
const PLAYER_PORTRAIT := Rect2(50, 42, 73, 79)
const BOSS_PORTRAIT := Rect2(45, 814, 80, 84)
const PAUSE := Rect2(1524, 21, 116, 115)
## Five icon tiles under the bars (x 38-474, y 180-294).
const SKILL_TILE := Vector2(87.2, 114)
const SKILL_ORIGIN := Vector2(38, 180)
const WHITE := Color("f4f2f0")
const GOLD := Color("ffcf3a")

static var atlas: Texture2D
static var lettering_font: SystemFont
static var key_font: SystemFont
static var faces: Dictionary = {}

static func texture() -> Texture2D:
	if atlas == null: atlas = load(ATLAS_PATH) as Texture2D
	return atlas

## The design's lettering: heavy rounded type with a thick black outline.
static func lettering() -> Font:
	if lettering_font == null:
		lettering_font = SystemFont.new()
		lettering_font.font_names = PackedStringArray(["Arial Rounded MT Bold", "Malgun Gothic", "Noto Sans CJK KR", "Arial"])
		lettering_font.font_weight = 800
	return lettering_font

static func screen(r: Rect2) -> Rect2:
	return Rect2(r.position * K, r.size * K)

static func region(hud: CanvasItem, dest: Rect2, src: Rect2, modulate: Color = Color.WHITE) -> void:
	hud.draw_texture_rect_region(texture(), screen(dest), src, modulate)

## at: the baseline in design coordinates; size: the design's pixel size.
static func text(hud: CanvasItem, value: String, at: Vector2, size: float, color: Color, align: int = HORIZONTAL_ALIGNMENT_LEFT, max_width: float = 0.0) -> void:
	var font := lettering()
	var px: int = roundi(size * K)
	var width: float = font.get_string_size(value, HORIZONTAL_ALIGNMENT_LEFT, -1, px).x
	# Too long (e.g. "바르굴, 얼어붙은 묘지왕"): squeeze horizontally, keep the height (web: ctx.scale(s, 1)).
	var squeeze: float = minf(1.0, max_width * K / width) if max_width > 0 and width > 0 else 1.0
	var x: float = at.x * K
	if align == HORIZONTAL_ALIGNMENT_RIGHT: x -= width * squeeze
	elif align == HORIZONTAL_ALIGNMENT_CENTER: x -= width * squeeze / 2
	hud.draw_set_transform(Vector2(x, at.y * K), 0, Vector2(squeeze, 1))
	hud.draw_string_outline(font, Vector2.ZERO, value, HORIZONTAL_ALIGNMENT_LEFT, -1, px, maxi(3, roundi(px * 0.24)), Color.BLACK)
	hud.draw_string(font, Vector2.ZERO, value, HORIZONTAL_ALIGNMENT_LEFT, -1, px, color)
	hud.draw_set_transform(Vector2.ZERO, 0, Vector2.ONE)

## A bar interior filled from its strip; the strip is cropped (not squeezed) as the value drops.
static func bar(hud: CanvasItem, r: Rect2, strip: Rect2, ratio: float, lag: float, lag_color: Color) -> void:
	if lag > ratio: hud.draw_rect(screen(Rect2(r.position, Vector2(r.size.x * clampf(lag, 0, 1), r.size.y))), lag_color)
	var amount: float = r.size.x * clampf(ratio, 0, 1)
	if amount > 0:
		region(hud, Rect2(r.position + Vector2(1, 1), Vector2(amount, r.size.y - 2)), Rect2(strip.position, Vector2(minf(strip.size.x, amount * strip.size.x / r.size.x), strip.size.y)))

static func draw_player(hud: CanvasItem, p: BmkActorState, stage: int, hp_lag: float) -> void:
	region(hud, Rect2(0, 0, 800, 300), Rect2(0, 0, 800, 300))
	bar(hud, HP, HP_STRIP, p.hp / p.max_hp, hp_lag / p.max_hp, Color("f3d6c6"))
	bar(hud, SP, SP_STRIP, p.sp / 100.0, 0, Color.TRANSPARENT)
	if p.sp >= 100:   # SP 가득: 마나 게이지 반짝임
		hud.draw_rect(screen(SP), Color(1, 1, 1, 0.12 + 0.1 * sin(Time.get_ticks_msec() / 110.0)))
	# Spent scroll charges become dark silhouettes.
	for i: int in range(3):
		if i >= p.mg: region(hud, SCROLLS[i], SCROLLS[i], Color(0.13, 0.1, 0.11))
	if p.buff > 0:   # 파워업: 초상화 테두리가 금빛으로 깜빡인다
		var frame := screen(PLAYER_PORTRAIT.grow(3))
		hud.draw_rect(frame, Color("ffe14d") if (Time.get_ticks_msec() / 100) % 2 else Color("c9a24a"), false, 3.0)
		var strip := Rect2(PLAYER_PORTRAIT.position + Vector2(0, PLAYER_PORTRAIT.size.y - 6), Vector2(PLAYER_PORTRAIT.size.x, 6))
		hud.draw_rect(screen(strip), Color("36240c"))
		hud.draw_rect(screen(Rect2(strip.position, Vector2(strip.size.x * clampf(p.buff / 900.0, 0, 1), 6))), Color("ffdd63"))
	text(hud, "viesa" if p.is_viesa() else "varel", Vector2(142, 70), 54, WHITE)
	text(hud, "1P×%d" % maxi(0, p.lives), Vector2(297, 70), 54, GOLD)
	text(hud, str(p.score), Vector2(621, 70), 54, WHITE, HORIZONTAL_ALIGNMENT_RIGHT, 320)
	text(hud, "level %d" % stage, Vector2(645, 70), 54, WHITE)

## Key labels and the cooldown sweep over the five icons drawn by draw_player (index.html #skillbar).
static func draw_skills(hud: CanvasItem, p: BmkActorState, s: BmkSimulation, font: Font) -> void:
	var actions: Array[String] = ["KeyU", "KeyH", "KeyO", "KeyP", "KeyL"]
	for i: int in range(mini(5, s.data.skills.size())):
		var tile := Rect2(SKILL_ORIGIN + Vector2(SKILL_TILE.x * i, 0), SKILL_TILE)
		var inner := screen(Rect2(tile.position + tile.size * Vector2(0.15, 0.21), tile.size * Vector2(0.7, 0.58)))
		var skill: BmkAttackData = s.data.skills[i]
		var remaining: float = p.skill_cd[skill.id]
		var ratio: float = clampf(remaining / skill.cooldown_ms, 0, 1)
		if ratio > 0:
			hud.draw_rect(Rect2(inner.position.x, inner.end.y - inner.size.y * ratio, inner.size.x, inner.size.y * ratio), Color(0.016, 0.008, 0.035, 0.76))
			var seconds := "%.1f" % (remaining / 1000.0)
			hud.draw_string_outline(font, Vector2(inner.position.x, inner.get_center().y + 5), seconds, HORIZONTAL_ALIGNMENT_CENTER, inner.size.x, 12, 3, Color.BLACK)
			hud.draw_string(font, Vector2(inner.position.x, inner.get_center().y + 5), seconds, HORIZONTAL_ALIGNMENT_CENTER, inner.size.x, 12, Color.WHITE)
		var events: Array[InputEvent] = InputMap.action_get_events("bmk_" + actions[i])
		if not events.is_empty():
			var key := OS.get_keycode_string((events[0] as InputEventKey).physical_keycode)
			var at: Vector2 = (tile.position + tile.size * Vector2(0.19, 0.35)) * K
			hud.draw_string_outline(font, at, key, HORIZONTAL_ALIGNMENT_LEFT, -1, 7, 2, Color.BLACK)
			hud.draw_string(font, at, key, HORIZONTAL_ALIGNMENT_LEFT, -1, 7, Color("ffda43"))

## The boss frame's face: the design shows Aurelion (boss3); the others are cut from their idle art.
static func face(kind: String) -> Array:
	if faces.has(kind): return faces[kind]
	var picks: Dictionary = {
		"gorath": ["gorath_remake.p1_idle", "gorath"], "boss2": ["morgra_art.idle", "box"],
		"boss4": ["vargul_art.p1_idle", "vargul"], "boss5": ["sovereign_art.idle", "sovereign"]}
	var result: Array = []
	if picks.has(kind):
		var asset := load("res://port_assets/resources/%s.tres" % picks[kind][0]) as BmkAnimationAsset
		if asset != null and asset.sprite_frames != null:
			var tex: Texture2D = asset.sprite_frames.get_frame_texture(&"source", 0)
			var w: float = tex.get_width()
			var h: float = tex.get_height()
			var src: Rect2
			match str(picks[kind][1]):
				"gorath": src = Rect2(w * 0.56 - w * 0.2, 0, w * 0.4, w * 0.4)
				"vargul": src = Rect2(w * 0.2, h * 0.1, w * 0.55, h * 0.35)
				"sovereign":
					var pivot: float = asset.frame_pivots[0].x if not asset.frame_pivots.is_empty() else w * 0.5
					src = Rect2(pivot - h * 0.3 * 0.42, h * 0.03, h * 0.3, h * 0.3)
				_: src = Rect2(w * 0.15, 0, w * 0.7, h * 0.55)
			# Cover the frame window: keep the face centred, trim the excess from the top.
			var aspect: float = BOSS_PORTRAIT.size.x / BOSS_PORTRAIT.size.y
			if src.size.x / src.size.y > aspect:
				var nw: float = src.size.y * aspect
				src = Rect2(src.position.x + (src.size.x - nw) / 2, src.position.y, nw, src.size.y)
			else:
				var nh: float = src.size.x / aspect
				src = Rect2(src.position.x, src.end.y - nh, src.size.x, nh)
			result = [tex, src.intersection(Rect2(0, 0, w, h))]
	faces[kind] = result
	return result

## Boss bar (bottom of the design): portrait, gold name on the plate, green over red, orange trail.
static func draw_boss(hud: CanvasItem, kind: String, label: String, ratio: float, lag: float, groggy: float, tag: String = "") -> void:
	region(hud, Rect2(0, 790, 1672, 130), Rect2(0, 790, 1672, 130))
	var picked := face(kind)
	if not picked.is_empty():
		var window := screen(BOSS_PORTRAIT)
		hud.draw_rect(window, Color("2c0c0f"))
		hud.draw_texture_rect_region(picked[0], window, picked[1])
	var x: float = 0.0
	while x < BOSS.size.x:
		var w: float = minf(BOSS_LOW_STRIP.size.x, BOSS.size.x - x)
		region(hud, Rect2(BOSS.position + Vector2(x, 1), Vector2(w, BOSS.size.y - 2)), Rect2(BOSS_LOW_STRIP.position, Vector2(w, BOSS_LOW_STRIP.size.y)))
		x += w
	ratio = clampf(ratio, 0, 1)
	if lag > ratio: hud.draw_rect(screen(Rect2(BOSS.position + Vector2(0, 1), Vector2(BOSS.size.x * clampf(lag, 0, 1), BOSS.size.y - 2))), Color("ffc96b"))
	if ratio > 0: region(hud, Rect2(BOSS.position + Vector2(1, 1), Vector2(BOSS.size.x * ratio, BOSS.size.y - 2)), Rect2(BOSS_STRIP.position, Vector2(BOSS_STRIP.size.x * ratio, BOSS_STRIP.size.y)))
	# Groggy gauge: a thin gold line riding just above the bar frame.
	if groggy > 0:
		var g: float = (BOSS.size.x - 8) * clampf(groggy, 0, 1)
		hud.draw_rect(screen(Rect2(BOSS.position.x + 4, 834, g + 2, 7)), Color.BLACK)
		hud.draw_rect(screen(Rect2(BOSS.position.x + 5, 835, g, 5)), Color("f0c870"))
	text(hud, label, Vector2(300, 872), 44, GOLD, HORIZONTAL_ALIGNMENT_CENTER, 300)
	if not tag.is_empty(): text(hud, tag, Vector2(BOSS.end.x, 830), 26, Color("ff8a80"), HORIZONTAL_ALIGNMENT_RIGHT)
