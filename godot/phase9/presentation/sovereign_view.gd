class_name BmkSovereignView
extends Node2D
## sovereign-runtime.js drawing: drawSovereignGround() (remains, slam marks, ground waves, the
## beam lane), drawSovereignTop() (cannon hands and lasers, the helm beam, effects), the
## depth-sorted fists (sovereignDrawList / drawSovFist) and the body add-ons of drawSovereign()
## (ghost trail, phase-two mask, helm charge glow). 'lighter' passes use an additive layer;
## CSS filters (sepia/saturate/hue-rotate, brightness) use a colour-matrix shader.
const MS: float = 1000.0 / 60.0
const HAND_SOURCE: String = "assets/runtime/2d766e59244fb5309e870ce7.png"
const LASER_SOURCE: String = "assets/runtime/cb05d55301793a95df46dce9.png"
const GHOST_FILTER: Array = [0.4,0.7,260.0]
const CRACK_FILTER: Array = [1.0,8.0,-45.0]
var session: BmkWaveSimulation
var bank: BmkAssetBank
var ground: bool = false
var normal: Layer
var additive: Layer
var fist_nodes: Dictionary = {}
static var glow_textures: Dictionary = {}
static var filter_shader: Shader

class Layer:
	extends Node2D
	var painter: Callable
	func _draw() -> void:
		if painter.is_valid(): painter.call(self)

static func add_material() -> CanvasItemMaterial:
	var m: CanvasItemMaterial = CanvasItemMaterial.new()
	m.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD
	return m

## CSS sepia(a) saturate(s) hue-rotate(deg) as one sRGB colour matrix (Filter Effects spec).
static func filter_material(spec: Array) -> ShaderMaterial:
	if filter_shader == null:
		filter_shader = Shader.new()
		filter_shader.code = "shader_type canvas_item;\nuniform mat3 matrix;\nvoid fragment() {\n\tCOLOR.rgb = clamp(matrix * COLOR.rgb, 0.0, 1.0);\n}\n"
	var a: float = 1.0 - float(spec[0])
	var sepia: Basis = rows([0.393 + 0.607 * a,0.769 - 0.769 * a,0.189 - 0.189 * a],[0.349 - 0.349 * a,0.686 + 0.314 * a,0.168 - 0.168 * a],[0.272 - 0.272 * a,0.534 - 0.534 * a,0.131 + 0.869 * a])
	var s: float = float(spec[1])
	var saturate: Basis = rows([0.213 + 0.787 * s,0.715 - 0.715 * s,0.072 - 0.072 * s],[0.213 - 0.213 * s,0.715 + 0.285 * s,0.072 - 0.072 * s],[0.213 - 0.213 * s,0.715 - 0.715 * s,0.072 + 0.928 * s])
	var th: float = deg_to_rad(float(spec[2]))
	var c: float = cos(th)
	var n: float = sin(th)
	var hue: Basis = rows([0.213 + c * 0.787 - n * 0.213,0.715 - c * 0.715 - n * 0.715,0.072 - c * 0.072 + n * 0.928],[0.213 - c * 0.213 + n * 0.143,0.715 + c * 0.285 + n * 0.140,0.072 - c * 0.072 - n * 0.283],[0.213 - c * 0.213 - n * 0.787,0.715 - c * 0.715 + n * 0.715,0.072 + c * 0.928 + n * 0.072])
	var m: ShaderMaterial = ShaderMaterial.new()
	m.shader = filter_shader
	m.set_shader_parameter("matrix",hue * saturate * sepia)
	return m

## Basis from matrix rows (Basis stores columns).
static func rows(r0: Array, r1: Array, r2: Array) -> Basis:
	return Basis(Vector3(r0[0],r1[0],r2[0]),Vector3(r0[1],r1[1],r2[1]),Vector3(r0[2],r1[2],r2[2]))

func _ready() -> void:
	normal = Layer.new()
	normal.painter = paint_normal
	add_child(normal)
	additive = Layer.new()
	additive.painter = paint_additive
	additive.material = add_material()
	add_child(additive)

func refresh() -> void:
	normal.queue_redraw()
	additive.queue_redraw()

func asset(id: String) -> BmkAnimationAsset:
	return bank.animation("sovereign_art." + id) if ResourceLoader.exists("res://port_assets/resources/sovereign_art.%s.tres" % id) else null

func bosses() -> Array[BmkLegacyActor]:
	var result: Array[BmkLegacyActor] = []
	if session == null or session.sovereign == null: return result
	for e: BmkActorState in session.enemies:
		if BmkSovereignController.is_sovereign(e) and (e as BmkLegacyActor).sovereign != null: result.append(e as BmkLegacyActor)
	return result

## sovPaint(frame, x, y, {face, angle, alpha, scale}): translate, mirror, rotate, then the frame
## at its anchor and 1/ppw scale.
static func paint(c: CanvasItem, a: BmkAnimationAsset, index: int, x: float, y: float, face: int, angle: float = 0.0, color: Color = Color.WHITE) -> void:
	if a == null or color.a <= 0: return
	var i: int = clampi(index,0,a.sprite_frames.get_frame_count(&"source") - 1)
	var k: float = a.frame_scales[i]
	var m: Transform2D = Transform2D(0,Vector2(x,y)) * Transform2D().scaled(Vector2(face,1)) * Transform2D(angle,Vector2.ZERO) * Transform2D().scaled(Vector2(k,k))
	c.draw_set_transform_matrix(m)
	c.draw_texture(a.sprite_frames.get_frame_texture(&"source",i),-a.frame_pivots[i],color)
	c.draw_set_transform_matrix(Transform2D.IDENTITY)

## sovFxDraw(id, u, x, y, w, h, {index, alpha, face, angle}): stretched to w x h around the anchor.
func fx(c: CanvasItem, id: String, u: float, x: float, y: float, w: float, h: float, alpha: float = 1.0, face: int = 1, index: int = -1, angle: float = 0.0) -> void:
	var a: BmkAnimationAsset = asset("fx_" + id)
	if a == null or alpha <= 0: return
	var n: int = a.sprite_frames.get_frame_count(&"source")
	var i: int = index if index >= 0 else mini(n - 1,maxi(0,floori(u * n)))
	var tex: Texture2D = a.sprite_frames.get_frame_texture(&"source",i)
	var kx: float = w / tex.get_width()
	var ky: float = h / tex.get_height()
	var pivot: Vector2 = a.frame_pivots[i]
	c.draw_set_transform_matrix(Transform2D(0,Vector2(x,y)) * Transform2D().scaled(Vector2(face,1)) * Transform2D(angle,Vector2.ZERO))
	c.draw_texture_rect(tex,Rect2(-pivot.x * kx,-pivot.y * ky,tex.get_width() * kx,tex.get_height() * ky),false,Color(1,1,1,alpha))
	c.draw_set_transform_matrix(Transform2D.IDENTITY)

func paint_normal(c: CanvasItem) -> void:
	var s: BmkWaveSimulation = session
	if s == null or s.sovereign == null: return
	var R: Dictionary = s.sovereign.R
	if ground:
		var death: BmkAnimationAsset = asset("death")
		var fallen: BmkAnimationAsset = asset("fallen_p2")
		for r: PackedFloat64Array in s.sovereign_remains:
			paint(c,death,death.sprite_frames.get_frame_count(&"source") - 1,r[0],r[1],int(r[2]))
			for i: int in range(2): paint(c,fallen,1,r[3 + i * 3],r[4 + i * 3],int(r[5 + i * 3]))
		for e: BmkLegacyActor in bosses():
			var sd: BmkSovereignState = e.sovereign
			for w: BmkSovereignState.Wave in sd.waves:
				c.draw_rect(Rect2(w.x - 5,s.ground_top - 6,10,s.ground_bottom - s.ground_top + 12),Color(1,73 / 255.0,141 / 255.0,0.16))
			for j: BmkSovereignState.Job in sd.jobs:
				if j.id == "beam" and j.lane != null and j.stage == "charge":
					var depth: float = float(R["beam"]["depth"])
					var x1: float = s.cam_x + s.view_width if e.face > 0 else s.cam_x
					c.draw_rect(Rect2(minf(e.x,x1),float(j.lane) - depth,absf(x1 - e.x),depth * 2),Color(1,73 / 255.0,141 / 255.0,0.18 + 0.14 * (floori(sd.now / 4.0) % 2)))
					break
		return
	# Cannon telegraph lines and hands (normal blend); lasers go to the additive layer.
	for e: BmkLegacyActor in bosses():
		for j: BmkSovereignState.Job in e.sovereign.jobs:
			if j.id == "ultimate": cannon(c,j,false)

func paint_additive(c: CanvasItem) -> void:
	var s: BmkWaveSimulation = session
	if s == null or s.sovereign == null: return
	var R: Dictionary = s.sovereign.R
	var flash: bool = game_flash()
	for e: BmkLegacyActor in bosses():
		var sd: BmkSovereignState = e.sovereign
		if ground:
			for m: BmkSovereignState.Mark in sd.marks:
				var alpha: float = 0.35 + 0.65 * (floori(sd.now / 3.0) % 2) if m.blink and flash else 0.75
				fx(c,"slam_mark",(sd.now % 40) / 40.0,m.x,m.y,m.rx * 2.5,m.ry * 2.8,alpha)
			for w: BmkSovereignState.Wave in sd.waves:
				for y: float in [s.ground_top + 12,(s.ground_top + s.ground_bottom) / 2,s.ground_bottom - 2]:
					fx(c,"ground_wave",(w.age % 20) / 20.0,w.x,y,64,44,1.0,w.dir)
			continue
		for j: BmkSovereignState.Job in sd.jobs:
			if j.id == "ultimate": cannon(c,j,true)
		for j: BmkSovereignState.Job in sd.jobs:
			if j.id != "beam" or j.stage != "fire": continue
			# helm_beam: drawings 1-3 open, 4-8 loop, 9-10 close.
			var fire: int = int(R["beam"]["fire"][j.p2])
			var st: int = j.st
			var index: int = floori(st / 2.0) if st < 6 else (8 + mini(1,floori((4 - (fire - st)) / 2.0)) if fire - st <= 4 else 3 + floori(st / 3.0) % 5)
			var x0: float = e.x + e.face * 14
			var y: float = float(j.lane) - (88.0 if e.p2shown else 118.0)
			var length: float = s.cam_x + s.view_width + 20 - x0 if e.face > 0 else x0 - s.cam_x + 20
			fx(c,"helm_beam",0,x0,y,length,52,1.0,e.face,index)
			break
		for f: BmkSovereignState.Fx in sd.fx:
			var u: float = float(f.age) / f.life
			fx(c,f.id,u,f.x,f.y - f.h,f.w,f.hgt,1 - u * 0.4,f.face)

func game_flash() -> bool:
	var node: Node = get_parent()
	while node != null and node is not BmkVerticalSlice: node = node.get_parent()
	return node == null or (node as BmkVerticalSlice).show_flash

## sovDrawCannon(job): hand frames (4 x 5 sheet) and, while firing, the laser ring + stretched beam.
func cannon(c: CanvasItem, job: BmkSovereignState.Job, laser_pass: bool) -> void:
	if job.hands == null: return
	var s: BmkWaveSimulation = session
	var C: Dictionary = s.sovereign.R["ultimate"]
	var fade_ms: float = float(C["fadeMs"])
	var tele_ms: float = float(C["telegraphMs"])
	var fire_at: float = fade_ms + tele_ms + float(C["chargedMs"])
	var laser_ms: float = 20000.0 / float(C["laserFps"])
	var hand: Texture2D = bank.source_image(HAND_SOURCE)
	var laser: Texture2D = bank.source_image(LASER_SOURCE)
	var k: float = float(C["handScale"])
	for h: BmkSovereignState.Hand in job.hands:
		var age: float = h.age_ms
		var shot: float = age - fire_at
		var length: float = s.cam_x + s.view_width - h.x if h.dir > 0 else h.x - s.cam_x
		var alpha: float = age / fade_ms if age < fade_ms else (maxf(0,1 - (shot - laser_ms) / fade_ms) if shot > laser_ms else 1.0)
		if not laser_pass:
			if age >= fade_ms and shot < 0:
				var blink: bool = age >= fade_ms + tele_ms and floori(age / 100) % 2 == 0
				c.draw_rect(Rect2(minf(h.x,h.x + h.dir * length),h.y - 1,absf(length),2),Color(1,36 / 255.0,94 / 255.0,0.65 if blink else 0.32))
			var frame: int
			if age < fade_ms: frame = 0
			elif age < fade_ms + tele_ms: frame = mini(7,floori((age - fade_ms) / tele_ms * 8))
			elif shot < 0: frame = 8 + mini(3,floori((age - fade_ms - tele_ms) / float(C["chargedMs"]) * 4))
			else: frame = 12 + mini(7,floori(maxf(0,shot) / laser_ms * 8))
			if hand == null: continue
			var row: int = floori(frame / 4.0)
			var y0: int = floori(row * hand.get_height() / 5.0)
			var y1: int = floori((row + 1) * hand.get_height() / 5.0)
			var w: float = hand.get_width() / 4.0
			c.draw_set_transform_matrix(Transform2D(0,Vector2(h.x,h.y)) * Transform2D().scaled(Vector2(h.dir,1)))
			c.draw_texture_rect_region(hand,Rect2(-float(C["handOrigin"][0]) * k,-float(C["handOrigin"][1]) * k,w * k,(y1 - y0) * k),Rect2(frame % 4 * w,y0,w,y1 - y0),Color(1,1,1,alpha))
			c.draw_set_transform_matrix(Transform2D.IDENTITY)
		elif shot >= 0 and shot < laser_ms and laser != null:
			var n: int = mini(19,floori(shot * float(C["laserFps"]) / 1000))
			var row: int = floori(n / 4.0)
			var w: float = laser.get_width() / 4.0
			var y0: int = floori(row * laser.get_height() / 5.0)
			var y1: int = floori((row + 1) * laser.get_height() / 5.0)
			var height: float = y1 - y0
			var origin_x: float = float(C["laserOrigins"][n][0])
			var origin_y: float = float(C["laserOrigins"][n][1])
			var scale_: float = float(C["laserHeight"]) / height
			var split: float = minf(w - 1,origin_x + 28)
			var end: float = minf(w,float(C["laserEnds"][n]))
			# Keep the ring at native aspect; stretch only the beam beyond the ring ('screen' -> additive).
			c.draw_set_transform_matrix(Transform2D(0,Vector2(h.x,h.y)) * Transform2D().scaled(Vector2(h.dir,1)))
			c.draw_texture_rect_region(laser,Rect2(-origin_x * scale_,-origin_y * scale_,split * scale_,float(C["laserHeight"])),Rect2(n % 4 * w,y0,split,height))
			c.draw_texture_rect_region(laser,Rect2((split - origin_x) * scale_,-origin_y * scale_,maxf(0.01,length - (split - origin_x) * scale_),float(C["laserHeight"])),Rect2(n % 4 * w + split,y0,end - split,height))
			c.draw_set_transform_matrix(Transform2D.IDENTITY)

# ------------------------------------------------------------------ body add-ons (on the actor view)
## Attachments drawn with the body: ghosts behind it, the phase-two mask and helm glow over it.
class Attach:
	extends Node2D
	var view: BmkSovereignView
	var actor: BmkLegacyActor
	var kind: String = ""
	func _draw() -> void:
		if actor == null or view == null or view.session == null or actor.sovereign == null: return
		position = -Vector2(actor.x,actor.y)
		view.paint_attach(self,actor,kind)

func paint_attach(c: CanvasItem, e: BmkLegacyActor, kind: String) -> void:
	var s: BmkWaveSimulation = session
	var sd: BmkSovereignState = e.sovereign
	if kind == "ghosts":
		ghosts(c,sd.afterimages,sd.now)
		return
	var pose: Array = s.sovereign.pose(s,e)
	if kind == "mask":
		# Phase two: moon in the empty helm and the magenta cracks breathe (~90 ticks).
		var mask: BmkAnimationAsset = asset("mask_" + str(pose[0]))
		if mask != null and (e.p2shown or str(pose[0]) == "awaken"):
			var pulse: float = 0.2 + 0.65 * (0.5 + 0.5 * sin(s.tick * PI * 2 / 90.0))
			paint(c,mask,int(pose[1]) - 1,e.x,e.y - e.z,e.face,0.0,Color(1,1,1,pulse))
		# Helm slit brightens before the beam.
		for j: BmkSovereignState.Job in sd.jobs:
			if j.id == "beam" and j.stage == "charge":
				var u: float = minf(1,j.st / float(s.sovereign.R["beam"]["charge"]))
				var r: float = 6 + 18 * u
				var at: Vector2 = Vector2(e.x + e.face * 8,e.y - e.z - (88.0 if e.p2shown else 118.0))
				glow(c,at,r,[Color(1,235 / 255.0,245 / 255.0,0.9 * u),Color(1,73 / 255.0,141 / 255.0,0.7 * u),Color(1,73 / 255.0,141 / 255.0,0)],[0.0,0.4,1.0])
				break

## sovDrawAfterimages(o, s): ghosts fade over their life (filtered by the parent's material).
func ghosts(c: CanvasItem, list: Array[BmkSovereignState.Ghost], now: int) -> void:
	var A: Dictionary = session.sovereign.R["afterimage"]
	for g: BmkSovereignState.Ghost in list:
		var fade: float = maxf(0,1 - (now - g.at) / float(A["life"]))
		if fade > 0: paint(c,asset(g.clip),g.drawing - 1,g.x,g.y,g.face,g.angle,Color(1,1,1,float(A["alpha"]) * fade))

## A radial gradient spot, cached per colour set.
func glow(c: CanvasItem, at: Vector2, r: float, colors: Array, offsets: Array) -> void:
	var key: String = str(colors) + str(offsets)
	if not glow_textures.has(key):
		var gradient: Gradient = Gradient.new()
		gradient.offsets = PackedFloat32Array(offsets)
		gradient.colors = PackedColorArray(colors)
		var tex: GradientTexture2D = GradientTexture2D.new()
		tex.gradient = gradient
		tex.fill = GradientTexture2D.FILL_RADIAL
		tex.fill_from = Vector2(0.5,0.5)
		tex.fill_to = Vector2(1,0.5)
		tex.width = 64
		tex.height = 64
		glow_textures[key] = tex
	c.draw_texture_rect(glow_textures[key],Rect2(at - Vector2(r,r),Vector2(r * 2,r * 2)),false)

func attach(view_node: BmkActorView, e: BmkLegacyActor) -> void:
	if not view_node.has_meta("sovereign_attach"):
		var ghost: Attach = Attach.new()
		ghost.view = self
		ghost.kind = "ghosts"
		ghost.material = filter_material(GHOST_FILTER)
		view_node.add_child(ghost)
		view_node.move_child(ghost,0)
		var mask: Attach = Attach.new()
		mask.view = self
		mask.kind = "mask"
		mask.material = add_material()
		view_node.add_child(mask)
		view_node.set_meta("sovereign_attach",[ghost,mask])
	for part: Attach in view_node.get_meta("sovereign_attach"):
		part.actor = e
		part.queue_redraw()

# ------------------------------------------------------------------ fists (depth sorted with actors)
## drawSovFist(): one y-sorted node per fist; its layers keep the source paint order.
class FistNode:
	extends Node2D
	var view: BmkSovereignView
	var actor: BmkLegacyActor
	var index: int = 0
	var layers: Array[Layer] = []
	func setup() -> void:
		for spec: Array in [["ghosts",BmkSovereignView.filter_material(BmkSovereignView.GHOST_FILTER)],["shadow",null],["trail",BmkSovereignView.add_material()],["body",null],["crack",BmkSovereignView.filter_material(BmkSovereignView.CRACK_FILTER)],["glow",BmkSovereignView.add_material()],["bar",null]]:
			var layer: Layer = Layer.new()
			var which: String = spec[0]
			layer.painter = func(c: CanvasItem) -> void: view.paint_fist(c,actor,index,which)
			if spec[1] != null: layer.material = spec[1]
			add_child(layer)
			layers.append(layer)
	func refresh() -> void:
		var f: BmkSovereignState.Fist = actor.sovereign.fists[index]
		var behind: bool = f.i == 1 and f.st in ["home","return","rise","intro"]
		position = Vector2(0,f.y + (-0.5 if behind else 0.5))
		visible = f.st != "reserve"
		for layer: Layer in layers:
			layer.position = Vector2(0,-position.y)
			layer.queue_redraw()

func sync_fists(actors: Node2D) -> void:
	var keep: Dictionary = {}
	for e: BmkLegacyActor in bosses():
		for i: int in range(2):
			var key: String = "%d:%d" % [e.id,i]
			keep[key] = true
			if not fist_nodes.has(key):
				var node: FistNode = FistNode.new()
				node.view = self
				node.actor = e
				node.index = i
				node.setup()
				actors.add_child(node)
				fist_nodes[key] = node
			(fist_nodes[key] as FistNode).actor = e
			(fist_nodes[key] as FistNode).refresh()
	for key: String in fist_nodes.keys():
		if not keep.has(key):
			(fist_nodes[key] as Node).queue_free()
			fist_nodes.erase(key)

func paint_fist(c: CanvasItem, e: BmkLegacyActor, i: int, layer: String) -> void:
	var s: BmkWaveSimulation = session
	if s == null or e == null or e.sovereign == null: return
	var sd: BmkSovereignState = e.sovereign
	var f: BmkSovereignState.Fist = sd.fists[i]
	var set_: BmkAnimationAsset = asset("fist_p2" if e.p2shown else "fist_p1")
	var ratio: float = f.hp / f.max_hp if f.max_hp != 0 else 0.0
	var stage: int = 0 if ratio > 0.66 else (1 if ratio > 0.33 else 2)
	var lying: bool = f.st in ["dropped","fallen","dead"] or f.st == "rise" and f.wake < 0.5
	var fist_h: float = s.sovereign.fist_h
	if lying:
		if layer != "body": return
		if e.p2shown:
			var k: int = (2 if f.wake < 0.25 else 3) if f.st == "rise" else (1 if f.broken else 0)
			paint(c,asset("fallen_p2"),k,f.x,f.y - f.h,f.face)
		else:
			# No phase-1 fallen drawing: side fist laid down, wrist core dimmed, brightening as it wakes.
			var k: int = 2 if f.broken else stage
			var y: float = f.y - f.h - fist_h * 0.5 + 3
			paint(c,asset("fallen_p1"),k,f.x,y,f.face,0.1)
			if f.wake > 0: paint(c,set_,[4,5,6][k] - 1,f.x,y,f.face,0.1,Color(1,1,1,f.wake))
		return
	var pose: int = [5,6,7][stage] if f.pose == 1 else f.pose
	match layer:
		"ghosts": ghosts(c,f.afterimages,sd.now)
		"shadow":
			if f.h > 14 and f.h < 400:
				c.draw_set_transform(Vector2(f.x,f.y),0,Vector2(s.sovereign.fist_len * 0.4 * (1 - minf(f.h,220) / 400.0),6))
				c.draw_circle(Vector2.ZERO,1,Color(0,0,0,0.28))
				c.draw_set_transform(Vector2.ZERO)
		"trail":
			if f.trail: fx(c,"punch_trail",(s.tick % 16) / 16.0,f.x - f.face * s.sovereign.fist_len * 0.7,f.y - f.h,74,30,0.9,f.face)
		"body":
			var back: bool = f.i == 1 and f.st in ["home","return","rise"]
			var blink: bool = f.glow != "" and floori(s.tick / 5.0) % 2 == 0 and game_flash()
			var gain: float = 2.0 if f.flash > 0 else (1.5 if blink else 1.0)
			var alpha: float = minf(1,(f.wake - 0.5) * 2 + 0.3) if f.st == "rise" else 1.0
			# brightness(.75) for the resting back fist; drawLit gain otherwise.
			var tone: float = 0.75 if gain == 1 and back else gain
			paint(c,set_,pose - 1,f.x,f.y - f.h,f.face,f.angle,Color(tone,tone,tone,alpha))
		"crack":
			if stage == 2 and f.pose != 1 and floori(s.tick / 8.0) % 2 == 0: paint(c,set_,pose - 1,f.x,f.y - f.h,f.face,f.angle,Color(1,1,1,0.45))
		"glow":
			var cores: Array = s.wave_data.source["SOVEREIGN"]["ART"]["cores"]["fist_p2" if e.p2shown else "fist_p1"]
			var core: Variant = cores[pose - 1] if pose - 1 < cores.size() else null
			if f.glow != "" and core != null:
				var k: float = 1 / float(s.wave_data.source["SOVEREIGN"]["ART"]["ppw"])
				var co: float = cos(f.angle)
				var sn: float = sin(f.angle)
				var cx: float = float(core[0]) * k
				var cy: float = float(core[1]) * k
				var at: Vector2 = Vector2(f.x + f.face * (cx * co - cy * sn),f.y - f.h + (cx * sn + cy * co))
				var rgb: Color = Color(1,40 / 255.0,60 / 255.0) if f.glow == "red" else Color(1,240 / 255.0,250 / 255.0)
				glow(c,at,12 + 3 * sin(s.tick * 0.5),[Color(rgb,0.95),Color(rgb,0.45),Color(rgb,0)],[0.0,0.45,1.0])
		"bar":
			if f.hp < f.max_hp and BmkSovereignController.active(f):
				var y: float = f.y - f.h - fist_h * 0.5 - 9
				c.draw_rect(Rect2(f.x - 16,y,32,4),Color("1d1220"))
				c.draw_rect(Rect2(f.x - 15,y + 1,30 * clampf(ratio,0,1),2),Color("ff4d6d") if stage == 2 else Color("ff9bd0"))
