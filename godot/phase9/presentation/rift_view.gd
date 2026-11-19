class_name BmkRiftView
extends Node2D
## Arena rifts (fire / frost / abyss waves of Stages 3-5): game.js drawGroundFx() marks on the
## floor (fill, outline, stripes; blinking while warning) and zone-runtime.js drawZoneEruption()
## tiles, depth sorted with the actors at the rift lane (24 frames: sigil, eruption, embers).
const SC: float = 2.0
const ZONE_SCALE: float = 0.6
const ZONE_FADE: float = 260.0
const ZONE_SIGIL_MS: float = 110.0
var session: BmkWaveSimulation
var bank: BmkAssetBank
var eruptions: Dictionary = {}

func _draw() -> void:
	if session == null: return
	for z: BmkLegacyHazard in session.legacy_hazards:
		if z.type != "rift" or z.dead: continue
		var active: bool = z.age >= z.delay
		if active and z.age > z.delay + z.life: continue
		var c: Color = Color("7ad8ff") if z.kind == "frost" else (Color("ce8cff") if z.kind == "abyss" else Color("ff965c"))
		var warning: float = warning_alpha(z)
		var x: float = z.x
		var y: float = z.y - z.depth
		var w: float = z.width
		var h: float = z.depth * 2
		draw_rect(Rect2(x,y,w,h),Color(c,0.3 if active else 0.38 * warning))
		for line: Array in [[Vector2(x,y),Vector2(x + w,y)],[Vector2(x,y + h),Vector2(x + w,y + h)],[Vector2(x,y),Vector2(x,y + h)],[Vector2(x + w,y),Vector2(x + w,y + h)]]:
			draw_line(line[0],line[1],Color(c,warning),2 * SC)
		var dx: float = 5 * SC
		while dx < w:
			draw_line(Vector2(x + dx,y + 2 * SC),Vector2(x + minf(w,dx + 8 * SC),y + h - 2 * SC),Color(c,0.65 * warning),SC)
			dx += 16 * SC

## riftWarningAlpha(z): blinks every 150 ms until the rift erupts.
static func warning_alpha(z: BmkLegacyHazard) -> float:
	if z.age >= z.delay: return 1.0
	return 0.95 if floori(z.age / 150) % 2 == 0 else 0.24

static func hash_(n: float) -> float:
	var s: float = sin(n * 127.1 + 311.7) * 43758.5453
	return s - floorf(s)

## Keeps one y-sorted eruption node per visible rift in the actors layer.
func sync(actors: Node2D) -> void:
	var keep: Dictionary = {}
	if session != null:
		for z: BmkLegacyHazard in session.legacy_hazards:
			if z.type != "rift" or z.dead or z.age > z.delay + z.life + ZONE_FADE: continue
			keep[z] = true
			if not eruptions.has(z):
				var node: Eruption = Eruption.new()
				node.view = self
				node.rift = z
				node.setup()
				actors.add_child(node)
				eruptions[z] = node
			(eruptions[z] as Eruption).refresh()
	for z: Variant in eruptions.keys():
		if not keep.has(z):
			(eruptions[z] as Node).queue_free()
			eruptions.erase(z)
	queue_redraw()

class Eruption:
	extends Node2D
	var view: BmkRiftView
	var rift: BmkLegacyHazard
	var normal: Node2D
	var flash: Node2D
	func setup() -> void:
		normal = Painter.new()
		normal.set("draw_fn",func(c: CanvasItem) -> void: view.paint_eruption(c,rift,false))
		normal.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
		add_child(normal)
		flash = Painter.new()
		flash.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
		flash.set("draw_fn",func(c: CanvasItem) -> void: view.paint_eruption(c,rift,true))
		var m: CanvasItemMaterial = CanvasItemMaterial.new()
		m.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD
		flash.material = m
		add_child(flash)
	func refresh() -> void:
		position = Vector2(0,rift.y)
		for child: Node2D in [normal,flash]:
			child.position = Vector2(0,-rift.y)
			child.queue_redraw()

class Painter:
	extends Node2D
	var draw_fn: Callable
	func _draw() -> void:
		if draw_fn.is_valid(): draw_fn.call(self)

func paint_eruption(c: CanvasItem, z: BmkLegacyHazard, flash: bool) -> void:
	var catalogs: Dictionary = bank.catalogs.get("ZONE_ART",{})
	if not catalogs.has(z.kind): return
	var art: Dictionary = catalogs[z.kind]
	var tiles: BmkAnimationAsset = bank.animation("zone." + z.kind)
	var t: float = z.age - z.delay
	var base: int
	if t < 0: base = floori(z.age / ZONE_SIGIL_MS) % 4
	elif t <= z.life: base = 4 + mini(9,floori(t / z.life * 10))
	else: base = 14 + mini(9,floori((t - z.life) / ZONE_FADE * 10))
	if flash and not (t >= 0 and t < 160): return
	var fw: float = float(art["fw"])
	var w: float = fw * ZONE_SCALE
	var h: float = float(art["h"]) * ZONE_SCALE
	var step: float = (fw - float(art["feather"])) * ZONE_SCALE
	var n: int = maxi(1,roundi(z.width / step))
	var span: float = (n - 1) * step + w
	var x0: float = z.x + (z.width - span) / 2
	var rows: int = ceili(z.depth * 2 / 34) if z.depth > 40 else 1
	var alpha: float = 0.55 + 0.45 * warning_alpha(z) if t < 0 else (1.0 if t <= z.life else 1 - maxf(0,(t - z.life) / ZONE_FADE - 0.6) / 0.4)
	var lo: int = 0 if t < 0 else (4 if t <= z.life else 14)
	var hi: int = 3 if t < 0 else (13 if t <= z.life else 23)
	if flash: alpha *= 0.45 * (1 - t / 160)
	for r: int in range(rows):
		var gy: float = z.y if rows == 1 else z.y - z.depth + (r + 0.5) * (z.depth * 2 / rows)
		var top: float = gy - float(art["ground"]) * ZONE_SCALE
		for i: int in range(n):
			# Each tile gets its own mirroring and a +-1 frame offset so the strip does not repeat.
			var seed: float = hash_(i * 7.3 + r * 13.1 + z.y * 0.37 + floorf(z.x) * 0.013)
			var x: float = x0 + i * step
			var f: int = clampi(base + (0 if t < 0 else floori(seed * 3) - 1),lo,hi)
			var tex: Texture2D = tiles.sprite_frames.get_frame_texture(&"source",mini(f,tiles.sprite_frames.get_frame_count(&"source") - 1))
			c.draw_set_transform(Vector2(x + w / 2,0),0,Vector2(-1 if seed > 0.5 else 1,1))
			c.draw_texture_rect(tex,Rect2(-w / 2,top,w,h),false,Color(1,1,1,alpha))
			c.draw_set_transform(Vector2.ZERO)
