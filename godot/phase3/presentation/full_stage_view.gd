class_name BmkFullStageView
extends BmkStreetView
var gate_gradient: GradientTexture2D
var gate_glow: GradientTexture2D

func _draw() -> void:
	if session == null: return
	var s: BmkStageSimulation = session as BmkStageSimulation
	var full: BmkFullStage = section as BmkFullStage
	background_id = str(full.section["bg"])
	draw_background()
	if s.boss_red > 0.01: draw_rect(Rect2(s.cam_x - 40,106,720,440),Color(0.59,0.04,0.055,0.2 * s.boss_red))
	if s.boss_dim > 0.01: draw_rect(Rect2(s.cam_x - 40,106,720,440),Color(0,0,0,0.3 * s.boss_dim))
	if s.walk_top > 340:
		draw_rect(Rect2(s.cam_x,300,640,s.walk_top - 300),Color(0.02,0.01,0.03,0.72))
		for i: int in range(int(floor(s.cam_x / 84)) - 1,int(ceil((s.cam_x + 640) / 84)) + 1):
			draw_rect(Rect2(i * 84 + 20,s.walk_top - 34,32,32),Color("4b382e"))
	if full.wall_broken:
		var hole: Dictionary = bank.catalogs["STAGE1_FX"]["wall_hole"]
		draw_asset(bank.animation("stage1_fx.wall_hole"),0,Vector2(full.wall_x,344 - float(hole["h"]) * float(hole["scale"]) / 2))
		draw_asset(bank.animation("stage1_fx.rubble_pile"),0,Vector2(full.wall_x - 30,348))
		draw_asset(bank.animation("stage1_fx.rubble_pile"),1,Vector2(full.wall_x + 32,350))
	if full.gate_t >= 0: draw_gate(s,full)
	for x: float in full.scaffolds:
		draw_scaffold(x,false)
	for z: BmkFireHazard in s.fire_hazards:
		if z.type == "firemark":
			ellipse(Vector2(z.x,z.y),70,22,Color(1,0.15,0.08,0.25),true)
			ellipse(Vector2(z.x,z.y),70,22,Color(1,0.25,0.12,0.8))
		elif z.type == "fire":
			var scale_: float = z.scale_at(s.MS)
			var id: String = "fire_burst" if z.age < 24 * s.MS else ("fire_out" if z.age > 120 * s.MS else "fire_loop")
			draw_set_transform(Vector2(z.x,z.y),0,Vector2.ONE * scale_)
			draw_asset(bank.animation("stage1_fx." + id),int(floor(z.age / s.MS / 4)),Vector2(0,19))
			draw_set_transform(Vector2.ZERO)
	for e: BmkStageActor in s.remains:
		draw_g2(s,e.g2.clip,s.stage_data.clip_length("death") - 1,Vector2(e.x,e.y),e.face,0.7)
	var boss_: BmkStageActor = s.gorath.boss(s)
	if boss_ != null:
		for m: BmkMeatState in boss_.g2.meats:
			var frame: Dictionary = m.frame()
			if m.t < 72:
				var radius: float = float(s.stage_data.source["G2_MEAT"][m.kind]["r"])
				var u: float = m.t / 72.0
				var blink: float = 0.45 if m.t >= 48 and (m.t / 3) % 2 != 0 else 1.0
				ellipse(Vector2(m.x,m.y),radius * (0.35 + 0.65 * u),radius * 0.3 * (0.35 + 0.65 * u),Color(1,0.05,0.12,(0.16 + 0.24 * u) * blink),true)
				ellipse(Vector2(m.x,m.y),radius,radius * 0.3,Color(1,0.15,0.18,0.8 * blink))
			elif not bool(frame.get("sky",false)): draw_g2(s,m.kind,int(frame["fi"]),Vector2(m.x,m.y),1,float(frame["alpha"]))
	draw_feel()

func draw_g2(_s: BmkStageSimulation, clip: String, frame: int, at: Vector2, face: int = 1, alpha: float = 1, rotation_: float = 0) -> void:
	var asset: BmkAnimationAsset = bank.animation("gorath_remake." + clip)
	var i: int = clampi(frame,0,asset.sprite_frames.get_frame_count(&"source") - 1)
	var texture: Texture2D = asset.sprite_frames.get_frame_texture(&"source",i)
	var center: Vector2 = (texture.get_size() / 2 - asset.frame_pivots[i]) * asset.frame_scales[i]
	draw_set_transform(at + Vector2(center.x * face,center.y),rotation_ * face,Vector2(face,1) * asset.frame_scales[i])
	draw_texture(texture,-texture.get_size() / 2,Color(1,1,1,alpha))
	draw_set_transform(Vector2.ZERO)

func draw_gate(s: BmkStageSimulation, full: BmkFullStage) -> void:
	var marks: Dictionary = full.background["marks"]
	var left: float = float(marks["gateLeft"])
	var right: float = float(marks["gateRight"])
	var top: float = float(marks["gateTop"])
	var h: float = 342 - top
	var u: float = s.ease(full.gate_t / 40.0)
	if gate_gradient == null:
		gate_gradient = GradientTexture2D.new()
		gate_gradient.width = 64
		gate_gradient.height = 128
		gate_gradient.fill_from = Vector2(0,0)
		gate_gradient.fill_to = Vector2(0,1)
		gate_gradient.gradient = Gradient.new()
		gate_gradient.gradient.offsets = PackedFloat32Array([0,0.55,1])
		gate_gradient.gradient.colors = PackedColorArray([Color("120403"),Color("5a1a08"),Color("c8641e")])
		gate_glow = GradientTexture2D.new()
		gate_glow.width = 256
		gate_glow.height = 256
		gate_glow.fill = GradientTexture2D.FILL_RADIAL
		gate_glow.fill_from = Vector2(0.5,0.5)
		gate_glow.fill_to = Vector2(1,0.5)
		gate_glow.gradient = Gradient.new()
		gate_glow.gradient.colors = PackedColorArray([Color("ffd68c"),Color(1,0.549,0.235,0)])
	var rect: Rect2 = Rect2(left,top,right - left,h)
	draw_texture_rect(gate_gradient,rect,false)
	var radius: float = (right - left) * 0.55
	var origin: Vector2 = Vector2((left + right) / 2 - radius,342 - radius)
	draw_texture_rect_region(gate_glow,rect,Rect2((rect.position - origin) / (radius * 2) * 256,rect.size / (radius * 2) * 256),Color(1,1,1,0.55 + 0.12 * sin(s.tick * 0.15)))
	var asset: BmkAnimationAsset = bank.animation("stage1_background.plaza.base")
	var texture: Texture2D = asset.sprite_frames.get_frame_texture(&"source",0)
	var k: float = float(full.background["scale"])
	var bg_top: float = 340 - float(full.background["floorY"]) * k
	var remaining: float = maxf(0,h - u * (h - 14))
	draw_texture_rect_region(texture,Rect2(left,top,right - left,remaining),Rect2(left / k,(top - bg_top + h - remaining) / k,(right - left) / k,remaining / k))

func draw_scaffold(x: float, front: bool) -> void:
	var fy: float = 258
	if front:
		draw_rect(Rect2(x - 41,fy - 20,82,5),Color("211611"))
		for dx: float in [-39,-21,-3,15,35]: draw_rect(Rect2(x + dx,fy - 17,4,18),Color("211611"))
		draw_rect(Rect2(x - 40,fy - 20,80,2),Color("745037"))
		for dx: float in [-38,-20,-2,16,36]: draw_rect(Rect2(x + dx,fy - 15,1,13),Color("5b3b29"))
		return
	for dx: float in [-35,26]:
		draw_rect(Rect2(x + dx,fy,9,88),Color("211611"))
		draw_rect(Rect2(x + dx + 2,fy + 5,5,83),Color("523623"))
		draw_rect(Rect2(x + dx + 3,fy + 12,1,70),Color("795136"))
	for i: int in range(9):
		draw_rect(Rect2(x - 27 + i * 6,fy + 13 + i * 6,8,6),Color("392519"))
		draw_rect(Rect2(x - 27 + i * 6,fy + 13 + i * 6,6,2),Color("6c482e"))
	draw_rect(Rect2(x - 44,fy,88,11),Color("211611"))
	draw_rect(Rect2(x - 39,fy + 11,78,3),Color("211611"))
	draw_rect(Rect2(x - 42,fy + 2,84,7),Color("674329"))
	draw_rect(Rect2(x - 42,fy + 1,84,2),Color("a17149"))
	for dx: float in [-27,-6,15,35]: draw_rect(Rect2(x + dx,fy + 3,2,5),Color("3c291d"))
