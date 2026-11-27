class_name BmkEffectView
extends Node2D
var session: BmkSimulation
var bank: BmkAssetBank
var impacts: Array[Dictionary] = []
## game.js fxDepth(): BEHIND keeps effects on lanes behind the player (drawn under it), IN_FRONT keeps
## effects on the player's lane or in front of it (drawn over it). ALL_LANES draws every effect.
const ALL_LANES: int = 0
const BEHIND: int = 1
const IN_FRONT: int = 2
var band: int = ALL_LANES
## The IN_FRONT copy reads the hit sparks of the view that owns them (signals feed only that one).
var primary: BmkEffectView

static func lane_ok(band_: int, s: BmkSimulation, y: float) -> bool:
	if band_ == ALL_LANES or s == null: return true
	return (band_ == BEHIND) == (y < s.player.y)

func _ready() -> void:
	var additive: CanvasItemMaterial = CanvasItemMaterial.new()
	additive.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD
	material = additive

func impact(x: float, y: float, height: float, kind: int) -> void:
	impacts.append({"x":x,"y":y,"height":height,"kind":kind,"age":0})

func advance() -> void:
	for item: Dictionary in impacts:
		item["age"] = int(item["age"]) + 1
	for i: int in range(impacts.size() - 1,-1,-1):
		if int(impacts[i]["age"]) >= 10:
			impacts.remove_at(i)

func asset_frame(id: String, index: int, at: Vector2, face: int = 1, size_override: Vector2 = Vector2.ZERO) -> void:
	var asset: BmkAnimationAsset = bank.animation(id)
	var frame: int = clampi(index,0,asset.sprite_frames.get_frame_count(&"source") - 1)
	var texture: Texture2D = asset.sprite_frames.get_frame_texture(&"source",frame)
	var size_value: Vector2 = texture.get_size() * asset.frame_scales[frame] if size_override == Vector2.ZERO else size_override
	var offset: Vector2 = -asset.frame_pivots[frame] * asset.frame_scales[frame] if size_override == Vector2.ZERO else Vector2(-size_value.x / 2,-size_value.y)
	draw_set_transform(at,0,Vector2(face,1))
	draw_texture_rect(texture,Rect2(offset,size_value),false)
	draw_set_transform(Vector2.ZERO)

func barel_effect(id: String, progress: float, at: Vector2, size_value: Vector2, face: int) -> void:
	var asset: BmkAnimationAsset = bank.animation("barel_art." + id)
	var index: int = clampi(int(floor(clampf(progress,0,0.99999) * asset.sprite_frames.get_frame_count(&"source"))),0,asset.sprite_frames.get_frame_count(&"source") - 1)
	asset_frame("barel_art." + id,index,at,-face if id == "moon" else face,size_value)

func _draw() -> void:
	if session == null:
		return
	var p: BmkActorState = session.player
	var t: float = p.t * session.MS
	# game.js drawPlayer(): drawViesaPlayer() returns first, so Barel's body effects never draw for Viesa.
	if p.is_viesa(): p = null
	# The player's own move effects sit on its lane: they draw over the body.
	if p != null and not lane_ok(band,session,p.y): p = null
	if p == null: pass
	elif p.st == "atk":
		var row: int = 0 if p.atk == "air" else int(p.atk.substr(1)) - 1
		var index: int = -1
		if p.atk == "air" and p.z > 0 and t < 240:
			index = mini(5,int(floor(t / 240.0 * 6)))
		elif p.atk != "air":
			var a: BmkAttackData = session.data.attack(p.atk)
			var peak: float = a.wind_ms + a.active_ms * 0.35
			var end: float = a.wind_ms + a.active_ms + 70
			if t >= a.wind_ms and t < end:
				index = mini(1,int(floor((t - a.wind_ms) / (peak - a.wind_ms) * 2))) if t < peak else mini(5,2 + int(floor((t - peak) / (end - peak) * 4)))
		if index >= 0:
			asset_frame("barel_combo_fx.row_%d" % row,index,Vector2(p.x + p.face * 48,p.y - p.z - (50 if row == 2 else 55)),-p.face if row == 2 else p.face)
	if p != null and p.st == "dash_attack" and p.t >= 3 and p.t < 14:
		barel_effect("dust",(p.t - 3) / 11.0,Vector2(p.x - p.face * 24,p.y + 2),Vector2(120,30),p.face)
	if p != null and p.st == "skill":
		var start: float = {"thrust":220,"slam":330,"whirl":150,"leap":560,"redwave":220}[p.skill]
		var u: float = (t - start) / (session.data.skill(p.skill).duration_ms - start)
		if u >= 0 and u < 1:
			var id: String = {"thrust":"slash","slam":"impact","whirl":"moon","leap":"impact","redwave":"wave"}[p.skill]
			var dx: float = 0 if p.skill == "whirl" else (100 if p.skill == "thrust" else 65)
			barel_effect(id,u,Vector2(p.x + p.face * dx,p.y - p.z),Vector2(270 if p.skill == "whirl" else 240,190),p.face)
	if p != null and p.st == "cast" and t > 180:
		barel_effect("lightning",(t - 180) / (session.data.magic_duration - 180),Vector2(p.x,p.y - p.z),Vector2(210,270),p.face)
	if p != null and p.st == "special":
		var id: String = "moon" if t < 620 else ("slash" if t < 1260 else "impact")
		var u: float = t / 620.0 if t < 620 else (fmod(t - 620,session.data.special_interval) / session.data.special_interval if t < 1260 else (t - 1260) / 740.0)
		var size_value: Vector2 = Vector2(270,240) if t < 620 else (Vector2(300,220) if t < 1260 else Vector2(330,270))
		barel_effect(id,u,Vector2(p.x + p.face * (0 if t < 620 else (80 if t < 1260 else 50)),p.y + size_value.y * 0.3),size_value,p.face)
	for z: BmkProjectileState in session.hazards:
		if not lane_ok(band,session,z.y): continue
		barel_effect("wave",fmod(z.age,360.0) / 360.0,Vector2(z.x,z.y - z.height + 60),Vector2(180,150),z.direction)
	for item: Dictionary in (primary.impacts if primary != null else impacts):
		if not lane_ok(band,session,float(item["y"])): continue
		var age: float = float(item["age"])
		var at: Vector2 = Vector2(float(item["x"]),float(item["y"]) - float(item["height"]))
		var color: Color = Color(1,0.8,0.65,1.0 - age / 10.0)
		var radius: float = 8 + age * (3 if int(item["kind"]) >= 2 else 2)
		draw_arc(at,radius,0,TAU,16,color,1.5)
		for k: int in range(6):
			var axis: Vector2 = Vector2.from_angle(k * TAU / 6.0 + 0.3)
			draw_line(at + axis * radius * 0.4,at + axis * radius * 1.4,color,2)
