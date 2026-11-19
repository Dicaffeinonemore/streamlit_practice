class_name BmkVargulView
extends Node2D
## vargul-runtime.js drawVargulHazards(ground), drawVargulRemains(), the frost aura / mask,
## the cross-fade into phase two and drawVargulMeleeEffect(). paintVargulFx() uses 'lighter',
## so each pass has a normal and an additive layer. ground = true draws before the actors.
const MS: float = 1000.0 / 60.0
var session: BmkWaveSimulation
var bank: BmkAssetBank
var ground: bool = false
var normal: Layer
var additive: Layer
static var melee_frames: Dictionary = {}
var cross_views: Dictionary = {}

class Layer:
	extends Node2D
	var painter: Callable
	func _draw() -> void:
		if painter.is_valid(): painter.call(self)

func _ready() -> void:
	normal = Layer.new()
	normal.painter = paint_normal
	add_child(normal)
	additive = Layer.new()
	additive.painter = paint_additive
	var m: CanvasItemMaterial = CanvasItemMaterial.new()
	m.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD
	additive.material = m
	add_child(additive)

func refresh() -> void:
	normal.queue_redraw()
	additive.queue_redraw()

func asset(id: String) -> BmkAnimationAsset:
	return bank.animation("vargul_art." + id) if ResourceLoader.exists("res://port_assets/resources/vargul_art.%s.tres" % id) else null

## paintVargulFx(id, progress, x, y, width, height, alpha, face): bottom-centred at (x, y).
func fx(c: CanvasItem, id: String, progress: float, x: float, y: float, width: float, height: float, alpha: float = 1.0, face: int = 1, rows: Vector2 = Vector2(-INF,INF)) -> void:
	var a: BmkAnimationAsset = asset("fx_%s_add" % id)
	if a == null or alpha <= 0: return
	var count: int = a.sprite_frames.get_frame_count(&"source")
	var tex: Texture2D = a.sprite_frames.get_frame_texture(&"source",mini(count - 1,maxi(0,floori(progress * count))))
	var top: float = y - height
	var y0: float = maxf(top,rows.x)
	var y1: float = minf(y,rows.y)
	if y1 <= y0: return
	var src: Rect2 = Rect2(0,(y0 - top) / height * tex.get_height(),tex.get_width(),(y1 - y0) / height * tex.get_height())
	c.draw_set_transform(Vector2(x,0),0,Vector2(face,1))
	c.draw_texture_rect_region(tex,Rect2(-width / 2,y0,width,y1 - y0),src,Color(1,1,1,alpha))
	c.draw_set_transform(Vector2.ZERO)

func paint(c: CanvasItem, a: BmkAnimationAsset, index: int, x: float, y: float, face: int, alpha: float = 1.0, factor: float = 1.0) -> void:
	if a == null or alpha <= 0: return
	var i: int = mini(a.sprite_frames.get_frame_count(&"source") - 1,maxi(0,index))
	var scale_: float = a.frame_scales[i] * factor
	c.draw_set_transform(Vector2(x,y),0,Vector2(face * scale_,scale_))
	c.draw_texture(a.sprite_frames.get_frame_texture(&"source",i),-a.frame_pivots[i],Color(1,1,1,alpha))
	c.draw_set_transform(Vector2.ZERO)

func visual_scale(clip: String, drawing: int) -> float:
	var scales: Dictionary = session.wave_data.source["VARGUL"]["VISUAL_SCALES"]
	if not scales.has(clip): return 1.0
	var list: Array = scales[clip]
	return float(list[drawing - 1]) if drawing >= 1 and drawing <= list.size() else 1.0

func bosses() -> Array[BmkLegacyActor]:
	var result: Array[BmkLegacyActor] = []
	if session == null or session.vargul == null: return result
	for e: BmkActorState in session.enemies:
		if (e as BmkLegacyActor).type == "boss4": result.append(e as BmkLegacyActor)
	return result

func aura_visible(e: BmkLegacyActor) -> bool:
	return e.p2shown and e.phase_t == 0 and e.st not in ["down","stun","dead","intro"] and not bool(e.vargul.current.get("hidden",false))

## Melee images: the browser cuts eight drawings per sheet and trims faint/dark pixels.
static func melee_texture(bank_: BmkAssetBank, kind: String, n: int) -> Texture2D:
	if not melee_frames.has(kind):
		var frames: Array = []
		var source: Texture2D = bank_.source_image(str(bank_.catalogs["VARGUL_MELEE_SOURCES"][kind]))
		var image: Image = source.get_image()
		image.convert(Image.FORMAT_RGBA8)
		var top: int = 170 if kind == "slash" else 245
		var bottom: int = 452 if kind == "slash" else 402
		var cuts: Array = [0,208,400,610,808,1022,1230,1442,1672] if kind == "slash" else [20,185,365,565,780,995,1225,1470,1650]
		var k: float = image.get_width() / 1672.0
		for i: int in range(8):
			var cell: Image = image.get_region(Rect2i(roundi(cuts[i] * k),roundi(top * k),roundi((cuts[i + 1] - cuts[i]) * k),roundi((bottom - top) * k)))
			var x0: int = cell.get_width()
			var y0: int = cell.get_height()
			var x1: int = -1
			var y1: int = -1
			for y: int in range(cell.get_height()):
				for x: int in range(cell.get_width()):
					var px: Color = cell.get_pixel(x,y)
					if px.a8 < 32 or maxi(px.r8,maxi(px.g8,px.b8)) < 40: cell.set_pixel(x,y,Color(0,0,0,0))
					else:
						x0 = mini(x0,x)
						x1 = maxi(x1,x)
						y0 = mini(y0,y)
						y1 = maxi(y1,y)
			frames.append(ImageTexture.create_from_image(cell.get_region(Rect2i(x0,y0,x1 - x0 + 1,y1 - y0 + 1))) if x1 >= 0 else null)
		melee_frames[kind] = frames
	return melee_frames[kind][n]

## vargulComboEffectData() / vargulMeleeEffectData(): [effect, active].
func melee_effect(e: BmkLegacyActor) -> Array:
	var a: BmkVargulState = e.vargul
	if e.st != "pat" or a.current.is_empty(): return [{},false]
	var index: int = a.cursor - 1
	if a.move == "combo":
		var active: bool = a.current.has("attack") and str(a.current["attack"]["id"]).begins_with("combo")
		if active: return [session.vargul.melee_effect(e,index),true]
		if str(a.current.get("phase","")) != "S": return [{},false]
		for i: int in range(a.cursor,mini(a.cursor + 8,a.timeline.size())):
			var f: Dictionary = a.timeline[i]
			if f.has("attack") and str(f["attack"]["id"]).begins_with("combo"): return [session.vargul.melee_effect(e,i),false]
		return [{},false]
	var effect: Dictionary = session.vargul.melee_effect(e,index)
	return [effect,not effect.is_empty()]

func paint_normal(c: CanvasItem) -> void:
	if session == null or session.vargul == null: return
	var s: BmkWaveSimulation = session
	var rules: Dictionary = s.vargul.rules
	if ground:
		var death: BmkAnimationAsset = asset("death")
		for r: PackedFloat64Array in s.vargul_remains: paint(c,death,death.sprite_frames.get_frame_count(&"source") - 1,r[0],r[1],int(r[2]))
		for e: BmkLegacyActor in bosses():
			var m: Array = melee_effect(e)
			var effect: Dictionary = m[0]
			if effect.is_empty(): continue
			var box: Array = effect["box"]
			var x: float = e.x + (float(box[0]) if e.face > 0 else -(float(box[0]) + float(box[2])))
			c.draw_rect(Rect2(x,e.y - float(effect["depth"]),float(box[2]),float(effect["depth"]) * 2),Color(0.553,0.875,1,0.12 if bool(m[1]) else 0.07))
		for z: BmkLegacyHazard in s.legacy_hazards:
			if z.type != "vargul" or z.dead or z.kind != "cross" or z.boom: continue
			var t: float = maxf(0,z.age / MS)
			var d: Dictionary = rules["cross"]
			var fast: bool = z.wait - t < 20
			var alpha: float = (0.55 + 0.4 * (0.5 + 0.5 * sin(t * (1.2 if fast else 0.3)))) * 0.58
			c.draw_rect(Rect2(s.cam_x,z.y - float(d["depth"]),s.view_width,float(d["depth"]) * 2),Color(0.96,0.24,0.31,alpha))
			c.draw_rect(Rect2(z.x - float(d["column"]),s.ground_top,float(d["column"]) * 2,s.ground_bottom - s.ground_top),Color(0.96,0.24,0.31,alpha))
		return
	for z: BmkLegacyHazard in s.legacy_hazards:
		if z.type != "vargul" or z.dead or z.kind != "orb": continue
		var size: float = 42.0
		var x: float = z.x
		var y: float = z.y - z.h - size / 2 - 7
		var bar: float = size + 4
		c.draw_rect(Rect2(x - bar / 2,y,bar,4),Color("182532"))
		c.draw_rect(Rect2(x - bar / 2 + 1,y + 1,(bar - 2) * clampf(z.hp / maxf(1,z.max_hp),0,1),2),Color("89dcff"))
	for z: BmkLegacyHazard in s.legacy_hazards:
		if z.type == "vargul" and not z.dead and z.kind == "cross" and z.boom: cross_eruption(c,z,maxf(0,z.age / MS) - z.wait)

func paint_additive(c: CanvasItem) -> void:
	if session == null or session.vargul == null: return
	var s: BmkWaveSimulation = session
	var rules: Dictionary = s.vargul.rules
	for z: BmkLegacyHazard in s.legacy_hazards:
		if z.type != "vargul" or z.dead: continue
		var t: float = maxf(0,z.age / MS)
		var floor_: bool = z.kind in ["sword","cross","ultimate"]
		var waiting: bool = z.kind == "ice_wave" or floor_ and not z.boom and z.stage != "impact"
		if ground != waiting: continue
		match z.kind:
			"fx":
				var h: float = z.height if z.height != 0 else 80.0
				fx(c,z.fx,t / z.life,z.x,z.y - z.h + h / 2,z.width if z.width != 0 else 100.0,h,1 - t / z.life * 0.65,z.face)
			"sword":
				var d: Dictionary = rules["sword"]
				if not z.boom:
					var fast: bool = z.wait - t < 20
					fx(c,"sword_warning",fmod(t,30) / 30,z.x,z.y + float(d["depth"]),float(d["radius"]) * 2,float(d["depth"]) * 2,0.55 + 0.4 * (0.5 + 0.5 * sin(t * (1.2 if fast else 0.3))))
				else: fx(c,"sword_fall",(t - z.wait) / 6,z.x,z.y + 12,76,155)
			"cross":
				if not z.boom:
					var depth: float = float(rules["cross"]["depth"])
					var height: float = 480 * 0.5112 * 0.35
					var fast: bool = z.wait - t < 20
					var alpha: float = 0.55 + 0.4 * (0.5 + 0.5 * sin(t * (1.2 if fast else 0.3)))
					var progress: float = fmod(t,26) / 26
					fx(c,"cross_warning",progress,s.cam_x + s.view_width / 2,z.y + height / 2,s.view_width,height,alpha,1,Vector2(z.y - depth,z.y + depth))
					fx(c,"cross_warning",progress,z.x,z.y + height / 2,480 * 0.5112,height,alpha,1,Vector2(z.y - height / 2,z.y - depth))
					fx(c,"cross_warning",progress,z.x,z.y + height / 2,480 * 0.5112,height,alpha,1,Vector2(z.y + depth,z.y + height / 2))
			"orb":
				fx(c,"ice_orb",fmod(t,52) / 52,z.x,z.y - z.h + 21,42,42,0.45 if z.inv > 0 else 1.0)
			"shard":
				fx(c,"ice_shard",fmod(t,22) / 22,z.x,z.y - z.h + 9,24,18,1,1 if z.vx >= 0 else -1)
			"ultimate":
				var u: Dictionary = rules["ultimate"]
				if z.stage != "impact":
					var alpha: float = 0.5 + 0.4 * pow(sin(t * (0.22 if z.stage == "tracking" else 1.0)),2)
					fx(c,"ultimate_warning",fmod(t,33) / 33,z.x,z.y + float(u["ry"]),float(u["rx"]) * 2,float(u["ry"]) * 2,alpha)
				elif t - z.impact_age < 24: fx(c,"glacier_impact",(t - z.impact_age) / 24.0,z.x,z.y + 40,float(u["outerX"]) * 2,180)
			"ice_wave":
				ice_wave(c,z,t)

func ice_wave(c: CanvasItem, z: BmkLegacyHazard, t: float) -> void:
	var u: Dictionary = session.vargul.rules["ultimate"]
	var band: Dictionary = session.vargul.wave_band(floori(t + 1e-6),z)
	var ratio: float = float(u["outerY"]) / float(u["outerX"])
	var alpha: float = 1 - t / z.wave_ticks * 0.4
	var fill: Color = Color(111 / 255.0,218 / 255.0,1,0.32 * alpha)
	var segments: int = 48
	for i: int in range(segments):
		var a0: float = i * TAU / segments
		var a1: float = (i + 1) * TAU / segments
		var o: float = float(band["outer"])
		var n: float = float(band["inner"])
		c.draw_colored_polygon(PackedVector2Array([Vector2(z.x + cos(a0) * o,z.y + sin(a0) * o * ratio),Vector2(z.x + cos(a1) * o,z.y + sin(a1) * o * ratio),
			Vector2(z.x + cos(a1) * n,z.y + sin(a1) * n * ratio),Vector2(z.x + cos(a0) * n,z.y + sin(a0) * n * ratio)]),fill)
	var radius: float = float(band["radius"])
	c.draw_set_transform(Vector2(z.x,z.y),0,Vector2(radius,radius * ratio))
	c.draw_arc(Vector2.ZERO,1,0,TAU,64,Color(0.7,0.95,1,alpha),3.0 / maxf(1,radius * ratio))
	c.draw_set_transform(Vector2.ZERO)
	for i: int in range(16):
		var angle: float = i / 16.0 * TAU
		var px: float = z.x + cos(angle) * radius
		var py: float = z.y + sin(angle) * radius * ratio
		c.draw_polyline(PackedVector2Array([Vector2(px - 2,py),Vector2(px,py - 5),Vector2(px + 2,py)]),Color(0.7,0.95,1,alpha),2)

## paintVargulCrossEruption(): frost zone tiles travelling along both arms of the cross.
func cross_eruption(c: CanvasItem, z: BmkLegacyHazard, age: float) -> void:
	var s: BmkWaveSimulation = session
	var d: Dictionary = s.vargul.rules["cross"]
	var cfx: Dictionary = s.wave_data.source["VARGUL"]["CROSS_FX"]
	if age < z.active:
		var col: Color = Color(91 / 255.0,193 / 255.0,231 / 255.0,0.22 * (1 - age / z.active))
		c.draw_rect(Rect2(s.cam_x,z.y - float(d["depth"]),s.view_width,float(d["depth"]) * 2),col)
		c.draw_rect(Rect2(z.x - float(d["column"]),s.ground_top,float(d["column"]) * 2,s.ground_bottom - s.ground_top),col)
	var art: Dictionary = bank.catalogs["ZONE_ART"]["frost"]
	var tiles_asset: BmkAnimationAsset = bank.animation("zone.frost")
	if not cross_views.has(z): cross_views[z] = Vector2(s.cam_x,s.view_width)
	var view: Vector2 = cross_views[z]
	var scale_: float = float(cfx["scale"])
	var w: float = float(art["fw"]) * scale_
	var h: float = float(art["h"]) * scale_
	var step: float = (float(art["fw"]) - float(art["feather"])) * scale_
	var spread: float = float(cfx["spread"])
	var frame_ticks: float = float(cfx["frameTicks"])
	var horizontal: float = maxf(step,maxf(absf(z.x - view.x),absf(view.x + view.y - z.x)))
	var vertical: float = maxf(20,maxf(absf(z.y - s.ground_top),absf(s.ground_bottom - z.y)))
	var tiles: Array = []
	for i: int in range(floori((s.cam_x - z.x - w / 2) / step),ceili((s.cam_x + s.view_width - z.x + w / 2) / step) + 1):
		tiles.append([z.x + i * step,z.y + 5,minf(1,absf(i * step) / horizontal) * spread,i < 0])
	for i: int in range(floori((s.ground_top - z.y) / 20),ceili((s.ground_bottom - z.y) / 20) + 1):
		var y: float = z.y + i * 20
		if i == 0 or y < s.ground_top or y > s.ground_bottom: continue
		tiles.append([z.x,y,absf(i * 20) / vertical * spread,i < 0])
	tiles.sort_custom(func(a: Array, b: Array) -> bool: return float(a[1]) < float(b[1]))
	for tile: Array in tiles:
		var local: float = age - float(tile[2])
		if local < 0 or local >= 20 * frame_ticks: continue
		var frame: int = 4 + mini(19,floori(local / frame_ticks))
		var alpha: float = minf(1,minf((local + 1) / 2,(20 * frame_ticks - local) / 5))
		var tex: Texture2D = tiles_asset.sprite_frames.get_frame_texture(&"source",mini(frame,tiles_asset.sprite_frames.get_frame_count(&"source") - 1))
		var top: float = float(tile[1]) - float(art["ground"]) * scale_
		c.draw_set_transform(Vector2(float(tile[0]),0),0,Vector2(-1 if bool(tile[3]) else 1,1))
		c.draw_texture_rect(tex,Rect2(-w / 2,top,w,h),false,Color(1,1,1,alpha))
		c.draw_set_transform(Vector2.ZERO)

## Per-actor parts of drawVargul(), drawn with the boss in depth order: the frost aura behind
## the body; the phase-two cross-fade, the melee effect and the glowing mask in front of it.
class Attach:
	extends Node2D
	var view: BmkVargulView
	var actor: BmkLegacyActor
	var back: bool = false
	var glow: bool = false
	func _ready() -> void:
		if glow:
			var m: CanvasItemMaterial = CanvasItemMaterial.new()
			m.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD
			material = m
	func _draw() -> void:
		if actor == null or view == null or view.session == null: return
		position = -Vector2(actor.x,actor.y)
		view.paint_actor(self,actor,back,glow)

func paint_actor(c: CanvasItem, e: BmkLegacyActor, back: bool, glow: bool) -> void:
	var s: BmkWaveSimulation = session
	var rules: Dictionary = s.vargul.rules
	var a: BmkVargulState = e.vargul
	if back:
		if glow and aura_visible(e): fx(c,"frost_aura",(s.tick % 96) / 96.0,e.x,e.y - e.z,150,170,0.38)
		return
	if glow:
		if not aura_visible(e): return
		var pose: Array = s.vargul.pose(s,e)
		var drawing: int = int(pose[1])
		# Masks are extracted at the base scale, so they take the pose's visual scale here.
		var mask: BmkAnimationAsset = asset("mask_" + str(pose[0]))
		if mask != null: paint(c,mask,drawing - 1,e.x,e.y - e.z,e.face,0.2 + 0.65 * (0.5 + 0.5 * sin(s.tick * PI * 2 / 90.0)),visual_scale(str(pose[0]),drawing))
		return
	if e.phase_t > 0 and a.transition_age >= int(rules["down"]) + int(rules["awaken"]):
		var u: float = (a.transition_age - float(rules["down"]) - float(rules["awaken"])) / 8.0
		paint(c,asset("p2_idle"),0,e.x,e.y,e.face,u)
	var m: Array = melee_effect(e)
	var effect: Dictionary = m[0]
	if effect.is_empty() or not bool(m[1]): return
	var box: Array = effect["box"]
	var w: float = float(box[2])
	var h: float = float(box[3])
	var x: float = e.x + (float(box[0]) if e.face > 0 else -(float(box[0]) + w))
	var tex: Texture2D = melee_texture(bank,str(effect["kind"]),mini(7,floori(float(effect["progress"]) * 8)))
	if tex == null: return
	c.draw_set_transform(Vector2(x + w / 2,e.y - e.z - float(box[1]) - h / 2),0,Vector2(e.face * (-1 if bool(effect["reverse"]) else 1),1))
	c.draw_texture_rect(tex,Rect2(-w / 2,-h / 2,w,h),false)
	c.draw_set_transform(Vector2.ZERO)

## Adds (once) and refreshes the three attachments on Vargul's actor view.
func attach(view_node: BmkActorView, e: BmkLegacyActor) -> void:
	if not view_node.has_meta("vargul_attach"):
		var parts: Array = []
		for spec: Array in [[true,true],[false,false],[false,true]]:
			var part: Attach = Attach.new()
			part.view = self
			part.back = spec[0]
			part.glow = spec[1]
			view_node.add_child(part)
			if part.back: view_node.move_child(part,0)
			parts.append(part)
		view_node.set_meta("vargul_attach",parts)
	for part: Attach in view_node.get_meta("vargul_attach"):
		part.actor = e
		part.queue_redraw()
