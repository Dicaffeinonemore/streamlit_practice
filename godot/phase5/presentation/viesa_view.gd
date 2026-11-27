class_name BmkViesaView
extends Node2D
## drawViesaProjectiles() and the over-player parts of drawViesaPlayer() (viesa-runtime.js).
## Source frames marked additive use the 'lighter' composite, so they draw on an ADD layer.
var session: BmkStageSimulation
var bank: BmkAssetBank
var art: BmkViesaData
var normal: Layer
var additive: Layer
var band: int = BmkEffectView.ALL_LANES

class Layer:
	extends Node2D
	var commands: Array = []
	## drawViesaChargePips(): [centre, filled] diamonds.
	var pips: Array = []
	func _draw() -> void:
		for c: Array in commands:
			draw_set_transform(c[1] as Vector2, float(c[2]), c[3] as Vector2)
			var size: Vector2 = c[4] as Vector2
			draw_texture_rect(c[0] as Texture2D, Rect2(-size / 2.0, size), false, Color(1,1,1,float(c[5])))
		draw_set_transform(Vector2.ZERO)
		for pip: Array in pips:
			var c: Vector2 = pip[0] as Vector2
			var filled: bool = bool(pip[1])
			var points: PackedVector2Array = [c + Vector2(0,-5), c + Vector2(4,0), c + Vector2(0,5), c + Vector2(-4,0)]
			draw_colored_polygon(points, Color("#ffd36b") if filled else Color(30 / 255.0, 18 / 255.0, 28 / 255.0, 0.75))
			points.append(points[0])
			draw_polyline(points, Color("#fff4c8") if filled else Color("#8a6a58"), 1.0)

func _ready() -> void:
	art = BmkViesaData.shared()
	normal = Layer.new()
	add_child(normal)
	additive = Layer.new()
	var material_: CanvasItemMaterial = CanvasItemMaterial.new()
	material_.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD
	additive.material = material_
	add_child(additive)

## drawViesaFx(name, frame, x, y, h, width, height, face, alpha) with an optional pivot rotation.
func fx(name_: String, frame: int, x: float, y: float, h: float, width: float, height: float, face: int = 1, alpha: float = 1.0, rotation_: float = 0.0) -> void:
	var asset: BmkAnimationAsset = bank.animation("viesa_art.fx_" + name_)
	if asset == null or alpha <= 0.0: return
	var count: int = asset.sprite_frames.get_frame_count(&"source")
	var index: int = mini(count - 1, maxi(0, frame))
	var texture: Texture2D = asset.sprite_frames.get_frame_texture(&"source", index)
	var source_frame: Dictionary = asset.source_frames[index].get("source", {})
	var layer: Layer = additive if bool(source_frame.get("additive", false)) else normal
	layer.commands.append([texture, Vector2(x, y - h), rotation_, Vector2(face, 1), Vector2(width, height), alpha])

func present(s: BmkStageSimulation) -> void:
	session = s
	normal.commands.clear()
	normal.pips.clear()
	additive.commands.clear()
	visible = s != null and s.player.is_viesa()
	if visible:
		draw_player_overlay(s)
		draw_projectiles(s)
	normal.queue_redraw()
	additive.queue_redraw()

func draw_player_overlay(s: BmkStageSimulation) -> void:
	var p: BmkActorState = s.player
	var a: BmkViesaAction = p.viesa_action
	if p.st != "skill" or a == null or not BmkEffectView.lane_ok(band,s,p.y): return
	var controller: BmkViesaController = s.player_controller as BmkViesaController
	var pose: Array = controller.pose(s)
	var tip: Variant = art.tip(str(pose[0]), int(pose[1]))
	var tip_x: float = p.x + p.face * (float(tip[0]) if tip != null else 42.0) * art.scale()
	var tip_h: float = p.z + (float(tip[1]) if tip != null else 80.0) * art.scale()
	if a.phase == "snipe_draw" and p.t >= 12: fx("charge_glow", (p.t / 4) % 6, tip_x, p.y, tip_h, 40 + 12 * a.charge, 40 + 12 * a.charge, p.face)
	if a.phase == "snipe_draw":
		var head: Vector2 = Vector2(p.x, p.y - p.z - art.world_height() - 12.0)
		for i: int in range(BmkViesaController.CHARGE_MAX): normal.pips.append([head + Vector2((i - 1) * 11, 0), i < a.charge])
	if a.phase == "dash_slash" and p.t < 16: fx("dash_streak", mini(4, p.t / 5), p.x - p.face * 28, p.y, 28, 100, 38, p.face)

func draw_projectiles(s: BmkStageSimulation) -> void:
	var length: float = art.world_height() * 0.45
	for z: BmkViesaWorld.Arrow in s.viesa.arrows:
		if z.dead or not BmkEffectView.lane_ok(band,s,z.y): continue
		var grow: float = 1.0 + 0.15 * z.charge
		var height: float = 18.0 * grow if z.snipe else 12.0
		var arrow_length: float = length * grow if z.snipe else length
		if z.fading:
			fx("arrow_fade", z.fade_age / 3, z.x, z.y, z.h, arrow_length, height, z.dir, 1.0 - z.fade_age / 15.0)
			continue
		if z.snipe:
			fx("snipe_arrow", floori(z.age / s.MS / 2.0) % 4, z.x, z.y, z.h, arrow_length, height, z.dir)
		else:
			var angle: float = -atan2(z.vh, absf(z.speed)) * z.dir if z.vh != 0.0 else 0.0
			var trail: Vector2 = Vector2(z.x, z.y - z.h) + Vector2(-z.dir * length * 0.6, 0).rotated(angle)
			fx("arrow_trail", floori(z.age / s.MS / 2.0) % 3, trail.x, trail.y, 0, length, 14, z.dir, 0.8, angle)
			fx("arrow", 0, z.x, z.y, z.h, length, 10, z.dir, 1.0, angle)
	for f: BmkViesaWorld.Effect in s.viesa.effects:
		if not BmkEffectView.lane_ok(band,s,f.y): continue
		var count: int = art.clip_length("fx_" + f.name)
		fx(f.name, floori(float(f.age) / f.life * maxi(1, count)), f.x, f.y, f.h, f.width, f.height, f.face, 1.0 - float(f.age) / f.life * 0.65)
	for z: BmkViesaWorld.UltObject in s.viesa.ult:
		if not BmkEffectView.lane_ok(band,s,z.y): continue
		var size: float = art.world_height() * (1.5 if z.kind == "giant" else (0.8 if z.kind == "volley" else 0.35))
		var angle: float = atan2((z.ty - z.th) - (z.sy - z.sh), z.tx - z.sx) - (PI if z.face < 0 else 0.0)
		var name_: String = "giant_arrow" if z.kind == "giant" else ("volley" if z.kind == "volley" else "phantom_arrow")
		fx(name_, z.variant if z.kind == "phantom" else (z.age / 2) % 4, z.x, z.y, z.h, size, 35.0 if z.kind == "volley" else size * 0.25, z.face, 1.0, angle)

## The moon sigil sits behind Viesa's body (drawn before paintViesa in drawViesaPlayer).
class Sigil:
	extends Node2D
	var texture: Texture2D
	var size: float = 0.0
	var face: int = 1
	var alpha: float = 1.0
	var at: Vector2 = Vector2.ZERO
	func _draw() -> void:
		if texture == null: return
		draw_set_transform(at, 0.0, Vector2(face, 1))
		draw_texture_rect(texture, Rect2(-size / 2.0, -size / 2.0, size, size), false, Color(1,1,1,alpha))
		draw_set_transform(Vector2.ZERO)

static func make_sigil() -> Sigil:
	var sigil: Sigil = Sigil.new()
	var material_: CanvasItemMaterial = CanvasItemMaterial.new()
	material_.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD
	sigil.material = material_
	return sigil

static func present_sigil(sigil: Sigil, s: BmkSimulation, bank: BmkAssetBank) -> void:
	var p: BmkActorState = s.player
	var a: BmkViesaAction = p.viesa_action
	sigil.visible = p.is_viesa() and p.st == "special" and a != null and a.phase != "ult_leap"
	if sigil.visible:
		var art: BmkViesaData = BmkViesaData.shared()
		var fading: bool = a.phase == "ult_final" and p.t >= 8
		var frame: int = 5 if fading else (p.t / 4 if a.phase == "ult_summon" and p.t < 8 else 2 + (a.clock / 4) % 3)
		var asset: BmkAnimationAsset = bank.animation("viesa_art.fx_moon_sigil")
		sigil.texture = asset.sprite_frames.get_frame_texture(&"source", mini(frame, asset.sprite_frames.get_frame_count(&"source") - 1))
		sigil.size = art.world_height() * 1.6
		sigil.face = p.face
		sigil.alpha = clampf(1.0 - (p.t - 8) / 12.0, 0.0, 1.0) if fading else 1.0
		sigil.at = Vector2(-p.face * 24, -(p.z + art.world_height() * 0.55))
	sigil.queue_redraw()
