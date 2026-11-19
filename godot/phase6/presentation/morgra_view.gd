class_name BmkMorgraView
extends Node2D
## morgra-runtime.js drawMorgraHazards(false) / drawMorgraIntro() / revive burst,
## judgment-runtime.js drawJudgmentMoon(), and the archers' arrows (drawTopFx).
const MS: float = 1000.0 / 60.0
var session: BmkWaveSimulation
var bank: BmkAssetBank
var moon_sheet: Texture2D

static func paint(canvas: CanvasItem, asset: BmkAnimationAsset, index: int, x: float, y: float, face: int, alpha: float = 1.0) -> void:
	if asset == null: return
	var count: int = asset.sprite_frames.get_frame_count(&"source")
	var i: int = mini(count - 1,maxi(0,index))
	var scale_: float = asset.frame_scales[i]
	canvas.draw_set_transform(Vector2(x,y),0,Vector2(face * scale_,scale_))
	canvas.draw_texture(asset.sprite_frames.get_frame_texture(&"source",i),-asset.frame_pivots[i],Color(1,1,1,alpha))
	canvas.draw_set_transform(Vector2.ZERO)

func fx_asset(id: String) -> BmkAnimationAsset:
	return bank.animation("morgra_art.fx_" + id) if ResourceLoader.exists("res://port_assets/resources/morgra_art.fx_%s.tres" % id) else null

func fx_count(id: String) -> int:
	var asset: BmkAnimationAsset = fx_asset(id)
	return asset.sprite_frames.get_frame_count(&"source") if asset != null else 1

func _draw() -> void:
	if session == null: return
	var s: BmkWaveSimulation = session
	for z: BmkLegacyHazard in s.legacy_hazards:
		if z.dead: continue
		if z.type == "arrow":
			var tip: Vector2 = Vector2(z.x,z.y - z.h)
			draw_line(tip - Vector2(z.dir * 18,0),tip,Color("5a3a24"),2)
			draw_line(tip,tip + Vector2(z.dir * 4,0),Color("c8ccd8"),2)
			continue
		if z.kind == "moon_field": continue
		var f: float = z.age / MS
		if z.kind == "pillar":
			if f < z.delay:
				paint(self,fx_asset("warning_circle"),floori(f / 15) % 3,z.x,z.y,1)
				draw_set_transform(Vector2(z.x,z.y),0,Vector2(44,22))
				draw_arc(Vector2.ZERO,1,0,TAU,32,Color("c48cff"),1.5 / 22.0)
				draw_set_transform(Vector2.ZERO)
			else: paint(self,fx_asset("dark_pillar"),floori((f - z.delay) / 6),z.x,z.y,1)
			continue
		var id: String = z.fx if not z.fx.is_empty() else (("crow_dive" if z.diving else "crow_fly") if z.kind == "crow" else z.kind)
		if id == "moon" and draw_moon(z,f): continue
		var n: int = fx_count(id)
		paint(self,fx_asset(id),floori(f / (z.life / n)) if z.visual else floori(f / 5) % n,z.x,z.y - z.h,z.face)
	for e: BmkActorState in s.enemies:
		var b: BmkLegacyActor = e as BmkLegacyActor
		if b.st == "stun":
			# drawEnemyOverlay(): four stars circling above a stunned enemy.
			var top: float = b.y - b.z - float(b.stats.get("h",b.d.height))
			for i: int in range(4):
				var a: float = s.tick * 0.12 + i * PI / 2
				draw_circle(Vector2(b.x + cos(a) * 34,top + 8 + sin(a) * 9),5,Color("ffe14d"))
		if b.type != "boss2": continue
		if b.st == "intro": draw_intro(b)
		if b.st == "reviving" and b.t >= 217 and b.t < 241: paint(self,fx_asset("teleport_burst"),floori((b.t - 217) / 6.0),b.x,b.y,1)

## Grow from crescent to full moon during the chant, then sustain the last six frames.
func draw_moon(z: BmkLegacyHazard, f: float) -> bool:
	if moon_sheet == null: moon_sheet = bank.source_image(str(bank.catalogs["JUDGMENT_ART"]["moon"]))
	if moon_sheet == null: return false
	var fade: float = clampf(minf(f / 10.0,(z.life - f) / 14.0),0,1)
	var frame: int = mini(17,floori(f / 112.0 * 18)) if f < 112 else 18 + floori((f - 112) / 3.0) % 6
	var cw: float = moon_sheet.get_width() / 6.0
	var ch: float = moon_sheet.get_height() / 4.0
	draw_texture_rect_region(moon_sheet,Rect2(z.x - 60,z.y - z.h - 60,120,120),Rect2(frame % 6 * cw,floori(frame / 6.0) * ch,cw,ch),Color(1,1,1,fade))
	return true

func draw_intro(e: BmkLegacyActor) -> void:
	var t: float = session.intro_t
	var u: float = clampf(t / float(session.wave_data.source["INTRO_MS"]),0,1)
	var rise: float = BmkSimulation.ease(clampf((u - 0.12) / 0.76,0,1))
	var offset: float = 150 * (1 - rise)
	var circle_alpha: float = minf(1,minf(u / 0.12,(1 - u) / 0.12))
	var center: Vector2 = Vector2(e.x,e.y)
	draw_set_transform(center,0,Vector2(66,23))
	draw_circle(Vector2.ZERO,1,Color(76 / 255.0,29 / 255.0,125 / 255.0,0.4 * circle_alpha))
	draw_arc(Vector2.ZERO,1,0,TAU,40,Color(0.73,0.55,1,circle_alpha),2 / 23.0)
	draw_set_transform(center,0,Vector2(49,17))
	draw_arc(Vector2.ZERO,1,0,TAU,40,Color(0.73,0.55,1,circle_alpha),2 / 17.0)
	draw_set_transform(Vector2.ZERO)
	for i: int in range(8):
		var a: float = i * PI / 4 + t * 0.0005
		draw_line(center + Vector2(cos(a) * 50,sin(a) * 17),center + Vector2(cos(a + 0.1) * 61,sin(a + 0.1) * 21),Color(0.73,0.55,1,circle_alpha),2)
	# Reveal above the ground plane as the body rises out of the circle (clip at y + 3).
	var d: Dictionary = session.morgra.drawing("intro",t / MS)
	var asset: BmkAnimationAsset = bank.animation("morgra_art." + str(d.get("clip","intro")))
	var i_: int = mini(asset.sprite_frames.get_frame_count(&"source") - 1,maxi(0,int(d["index"]) - 1))
	var tex: Texture2D = asset.sprite_frames.get_frame_texture(&"source",i_)
	var scale_: float = asset.frame_scales[i_]
	var pivot: Vector2 = asset.frame_pivots[i_]
	var top: float = e.y + offset - pivot.y * scale_
	var rows: float = clampf((e.y + 3 - top) / scale_,0,tex.get_height())
	if rows <= 0: return
	draw_set_transform(Vector2(e.x,top),0,Vector2(e.face * scale_,scale_))
	draw_texture_rect_region(tex,Rect2(-pivot.x,0,tex.get_width(),rows),Rect2(0,0,tex.get_width(),rows),Color(1,1,1,rise))
	draw_set_transform(Vector2.ZERO)

## drawMorgraHazards(true): the moon judgment field under the actors.
class Ground:
	extends Node2D
	var session: BmkWaveSimulation
	var bank: BmkAssetBank
	var field: Node2D
	var overlay: Overlay

	class Overlay:
		extends Node2D
		var ground: Ground
		func _draw() -> void:
			var s: BmkWaveSimulation = ground.session
			if s == null: return
			for z: BmkLegacyHazard in s.legacy_hazards:
				if z.dead or z.kind != "moon_field": continue
				var f: float = z.age / BmkMorgraView.MS
				var a: float = f - z.delay
				var fade: float = clampf(minf(f / 10.0,(z.life - f) / 6.0),0,1)
				for spot: PackedFloat64Array in z.safe:
					draw_set_transform(Vector2(spot[0],spot[1]),0,Vector2(42,22))
					draw_arc(Vector2.ZERO,1,0,TAU,40,Color(0.945,0.9,1,fade),2 / 22.0)
					draw_set_transform(Vector2.ZERO)
				if a < 0: continue
				var beam: BmkAnimationAsset = ground.bank.animation("morgra_art.fx_moon_beam")
				for y: float in [s.ground_top + 25,420.0,480.0]:
					var x: float = s.cam_x + 30
					while x < s.cam_x + s.view_width:
						var blocked: bool = false
						for spot: PackedFloat64Array in z.safe:
							if absf(x - spot[0]) < 55 and absf(y - spot[1]) < 40: blocked = true
						if not blocked: BmkMorgraView.paint(self,beam,floori(a / 6),x,y,1,fade)
						x += 60

	class Field:
		extends Node2D
		var ground: Ground
		func _draw() -> void:
			var s: BmkWaveSimulation = ground.session
			if s == null: return
			for z: BmkLegacyHazard in s.legacy_hazards:
				if z.dead or z.kind != "moon_field" or z.safe.size() < 2: continue
				var f: float = z.age / BmkMorgraView.MS
				var fade: float = clampf(minf(f / 10.0,(z.life - f) / 6.0),0,1)
				var shader_material: ShaderMaterial = material as ShaderMaterial
				shader_material.set_shader_parameter("safe_a",Vector2(z.safe[0][0],z.safe[0][1]))
				shader_material.set_shader_parameter("safe_b",Vector2(z.safe[1][0],z.safe[1][1]))
				var active: bool = f - z.delay >= 0
				shader_material.set_shader_parameter("strength",(0.26 if active else 0.14) * fade)
				shader_material.set_shader_parameter("pattern_alpha",(1.0 if active else 0.78) * fade)
				shader_material.set_shader_parameter("cam_x",s.cam_x)
				var sheet: Texture2D = ground.bank.source_image(str(ground.bank.catalogs["JUDGMENT_ART"]["field"]))
				var durations: Array = ground.bank.catalogs["JUDGMENT_ART"]["fieldDurations"]
				var total: float = 0
				for d: Variant in durations: total += float(d)
				var time: float = fmod(z.age,total)
				var frame: int = 0
				for i: int in range(durations.size()):
					if time < float(durations[i]):
						frame = i
						break
					time -= float(durations[i])
				var k: float = sheet.get_width() / 7680.0
				shader_material.set_shader_parameter("sheet",sheet)
				shader_material.set_shader_parameter("sheet_size",Vector2(sheet.get_width(),sheet.get_height()) / k)
				shader_material.set_shader_parameter("cell",Vector2(frame % 6 * 1280 + 550,floori(frame / 6.0) * 360))
				shader_material.set_shader_parameter("top",s.ground_top)
				shader_material.set_shader_parameter("bottom",s.ground_bottom + 12)
				draw_rect(Rect2(s.cam_x,s.ground_top,s.view_width,s.ground_bottom - s.ground_top + 12),Color.WHITE)

	func _ready() -> void:
		var f: Field = Field.new()
		f.ground = self
		var shader_material: ShaderMaterial = ShaderMaterial.new()
		shader_material.shader = load("res://phase6/presentation/moon_field.gdshader") as Shader
		f.material = shader_material
		add_child(f)
		field = f
		overlay = Overlay.new()
		overlay.ground = self
		add_child(overlay)

	func refresh() -> void:
		field.queue_redraw()
		overlay.queue_redraw()
