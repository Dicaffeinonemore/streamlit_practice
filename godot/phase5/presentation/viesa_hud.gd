class_name BmkViesaHud
extends RefCounted
## viesa-ui.js drawViesaUI() and the Viesa skill tiles. drawViesaEnemyBar() is never called
## by the browser game (enemies keep the shared bar), so it is intentionally not ported.
## Coordinates use the supplied 1672 x 941 design, as the browser does.
const DESIGN_WIDTH: float = 1672.0
static var atlas: Texture2D

static func ui_atlas() -> Texture2D:
	if atlas == null: atlas = load("res://port_assets/images/viesa_ui_source__e4aea0a8df43.png") as Texture2D
	return atlas

## Source rectangle in design units -> texture pixels (the PNG is 1671 wide).
static func src(rect: Rect2) -> Rect2:
	var k: float = ui_atlas().get_width() / DESIGN_WIDTH
	return Rect2(rect.position.x * k, rect.position.y, rect.size.x * k, rect.size.y)

static func draw_player(hud: BmkGameHud, p: BmkActorState) -> void:
	var tex: Texture2D = ui_atlas()
	var scale_: float = 390.0 / DESIGN_WIDTH
	var origin: Vector2 = Vector2(3, 20)
	var at: Callable = func(x: float, y: float) -> Vector2: return origin + Vector2(x, y - 80.0) * scale_
	hud.draw_texture_rect_region(tex, Rect2(at.call(0.0, 80.0), Vector2(1672, 550) * scale_), src(Rect2(0, 80, 1672, 550)))
	hud.draw_texture_rect_region(tex, Rect2(at.call(0.0, 630.0), Vector2(910, 90) * scale_), src(Rect2(0, 630, 910, 90)))
	for row: Array in [[314.0, 48.0, p.hp / p.max_hp, Color("290508"), 500.0], [400.0, 48.0, p.sp / 100.0, Color("031329"), 270.0]]:
		var y: float = row[0]
		var h: float = row[1]
		var amount: float = 695.0 * clampf(float(row[2]), 0.0, 1.0)
		hud.draw_rect(Rect2(at.call(425.0, y), Vector2(695, h) * scale_), row[3])
		if amount > 0.0: hud.draw_texture_rect_region(tex, Rect2(at.call(425.0, y), Vector2(amount, h) * scale_), src(Rect2(445, y, float(row[4]), h)))
	for i: int in range(3):
		if i >= p.mg: hud.draw_rect(Rect2(at.call(1176.0 + i * 123, 323.0), Vector2(113, 128) * scale_), Color(5 / 255.0, 9 / 255.0, 16 / 255.0, 0.87))
		if i >= p.lives: hud.draw_circle(at.call(480.0 + i * 142, 600.0), 48.0 * scale_, Color(5 / 255.0, 9 / 255.0, 16 / 255.0, 0.92))
	if p.buff > 0:
		hud.draw_rect(Rect2(at.call(110.0, 510.0), Vector2(180, 7) * scale_), Color("132813"))
		hud.draw_rect(Rect2(at.call(110.0, 510.0), Vector2(180 * clampf(p.buff / 900.0, 0.0, 1.0), 7) * scale_), Color("b7ec89"))
	hud.text(Vector2(6, 14), "SCORE %d" % p.score, Color("ffe1a0"), 11)

## The five vine-framed icons (atlas 932 + i*140, 635, 148 x 260) with a dark key plate.
static func draw_skills(hud: BmkGameHud, p: BmkActorState, s: BmkSimulation) -> void:
	var tex: Texture2D = ui_atlas()
	var actions: Array[String] = ["KeyU","KeyH","KeyO","KeyP","KeyL"]
	var ids: Array[String] = ["thrust","slam","whirl","leap","redwave"]
	var art: BmkViesaData = BmkViesaData.shared()
	var size: Vector2 = Vector2(29, 51)
	var k: float = size.x / 148.0
	for i: int in range(5):
		var at: Vector2 = Vector2(915, 145 + i * 50)
		hud.draw_texture_rect_region(tex, Rect2(at, size), src(Rect2(932 + i * 140, 635, 148, 260)))
		hud.draw_rect(Rect2(at + Vector2(20, 66) * k, Vector2(45, 37) * k), Color("05111e"))
		var events: Array[InputEvent] = InputMap.action_get_events("bmk_" + actions[i])
		if not events.is_empty(): hud.text(at + Vector2(4, 20), OS.get_keycode_string((events[0] as InputEventKey).physical_keycode), Color("ffe1a0"), 8)
		var id: String = ids[i]
		# game.js: the melee combo has no cooldown shade for Viesa.
		var ratio: float = 0.0 if id == "slam" else clampf(p.skill_cd.get(id, 0.0) / art.skill_cooldown(id), 0.0, 1.0)
		if ratio > 0.0: hud.draw_rect(Rect2(at, Vector2(size.x, size.y * ratio)), Color(0, 0, 0, 0.7))
		var holding: bool = id == "redwave" and p.st == "skill" and p.viesa_action != null and p.viesa_action.phase == "snipe_draw"
		if holding: hud.draw_rect(Rect2(at, size), Color("9ce7ff"), false, 2.0)
