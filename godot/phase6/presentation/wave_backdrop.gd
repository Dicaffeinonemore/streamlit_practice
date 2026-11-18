class_name BmkWaveBackdrop
extends BmkStreetView
## release.js drawReleaseBackdrop() and floor-runtime.js drawStageFloor() for the wave stages.
## Drawn in world space (the world node is scaled by Z = 1.5 and scrolled by the camera).
const Z: float = 1.5
const OY: float = 146.0
const SCREEN_W: float = 960.0
const FL_TOP: float = 332.0
const VH: float = 360.0
var wave: BmkWaveSimulation
var key: String = ""
var previous: String = ""
var blend: float = 1.0
var last_tick: int = -1

func backdrop_key(s: BmkWaveSimulation) -> String:
	var n: int = s.stage_index + 1
	var boss: BmkLegacyActor
	for e: BmkActorState in s.enemies:
		if e.boss:
			boss = e as BmkLegacyActor
			break
	if boss != null and boss.p2shown and n in [2,4,5]: return "phase%d" % n
	if boss != null: return "boss%d" % n
	return "field%d" % n

func image(id: String) -> Texture2D:
	var art: Dictionary = bank.catalogs["RELEASE_ART"]
	return bank.source_image(str(art[id])) if art.has(id) else null

func reset() -> void:
	key = ""
	previous = ""
	blend = 1.0
	last_tick = -1

func _draw() -> void:
	if wave == null: return
	var next: String = backdrop_key(wave)
	if next != key:
		previous = key
		key = next
		blend = 0.0 if not previous.is_empty() else 1.0
	if last_tick != wave.tick:
		last_tick = wave.tick
		blend = minf(1.0,blend + 0.025)
	if blend < 1.0 and not previous.is_empty(): paint(image(previous),1.0)
	paint(image(key),blend)
	draw_floor()
	# feel-runtime.js drawFeelGround(): danger zones, same-lane rings and the SP aura.
	draw_feel()

## Screen-space tiles (height HORIZON + 4, alternate tiles mirrored) mapped into world units.
func paint(texture: Texture2D, alpha: float) -> void:
	if texture == null or alpha <= 0.0: return
	var horizon: float = (wave.ground_top - OY) * Z
	var height: float = horizon + 4
	var scale_: float = maxf(SCREEN_W / texture.get_width(),height / texture.get_height())
	var dw: float = texture.get_width() * scale_
	var dh: float = texture.get_height() * scale_
	var offset: float = wave.cam_x * Z
	var n: int = floori(offset / dw)
	while n * dw - offset < SCREEN_W:
		var left: float = roundf(n * dw - offset)
		var right: float = roundf((n + 1) * dw - offset)
		var rect: Rect2 = Rect2(Vector2(wave.cam_x + left / Z,OY + (height - dh) / Z),Vector2((right - left) / Z,dh / Z))
		if n % 2 != 0:
			draw_set_transform(Vector2(rect.position.x + rect.size.x,0),0,Vector2(-1,1))
			rect.position.x = 0
		draw_texture_rect(texture,rect,false,Color(1,1,1,alpha))
		draw_set_transform(Vector2.ZERO)
		n += 1

func draw_floor() -> void:
	var index: int = wave.stage_index
	var art: Dictionary = bank.catalogs["FLOOR_ART"][index]
	var texture: Texture2D = bank.source_image(str(bank.catalogs["FLOOR_IMAGES"][index]))
	if texture == null: return
	var crop: Array = art["crop"]
	var k: float = texture.get_width() / float(art["size"][0])
	var source: Rect2 = Rect2(float(crop[0]) * k,float(crop[1]) * k,float(crop[2]) * k,float(crop[3]) * k)
	var height: float = ceilf(OY + VH - FL_TOP) + 1
	var width: float = float(crop[2]) / float(crop[3]) * height
	var cam: float = wave.cam_x
	var tile: int = floori(cam / width)
	while tile * width - cam < 640.0:
		var left: float = roundf(tile * width - cam)
		var right: float = roundf((tile + 1) * width - cam)
		var rect: Rect2 = Rect2(cam + left,FL_TOP,right - left,height)
		if tile % 2 != 0:
			draw_set_transform(Vector2(rect.position.x + rect.size.x,0),0,Vector2(-1,1))
			rect.position.x = 0
		draw_texture_rect_region(texture,rect,source)
		draw_set_transform(Vector2.ZERO)
		tile += 1
	for i: int in range(14):
		draw_rect(Rect2(cam,FL_TOP + i,640,1),Color(8 / 255.0,5 / 255.0,14 / 255.0,0.4 * (1 - i / 14.0)))
