class_name BmkStreetView
extends Node2D
var session: BmkSimulation
var bank: BmkAssetBank
var section: BmkStreetSection
var background_id: String = "street"
var show_danger_zones: bool = true

func draw_asset(asset: BmkAnimationAsset, index: int, at: Vector2) -> void:
	var frame: int = index % asset.sprite_frames.get_frame_count(&"source")
	var texture: Texture2D = asset.sprite_frames.get_frame_texture(&"source",frame)
	var scale_value: float = asset.frame_scales[frame]
	draw_texture_rect(texture,Rect2(at - asset.frame_pivots[frame] * scale_value,texture.get_size() * scale_value),false)

func ellipse(at: Vector2, rx: float, ry: float, color: Color, fill: bool = false, width: float = 1.0) -> void:
	draw_set_transform(at,0,Vector2(rx,ry))
	if fill:
		draw_circle(Vector2.ZERO,1,color)
	else:
		draw_arc(Vector2.ZERO,1,0,TAU,48,color,width / rx,true)
	draw_set_transform(Vector2.ZERO)

func _draw() -> void:
	draw_background()
	draw_feel()

func draw_background() -> void:
	if session == null:
		return
	var bg: Dictionary = section.background
	var top: float = 340.0 - float(bg["floorY"]) * float(bg["scale"])
	draw_asset(bank.animation("stage1_background.%s.base" % background_id),0,Vector2(0,340))
	var animations: Array = bg["anims"]
	for i: int in range(animations.size()):
		var part: Dictionary = animations[i]
		draw_asset(bank.animation("stage1_background.%s.layer_%d" % [background_id,i]),int(floor(session.tick / 5.0)) % 36,Vector2(float(part["x"]) * float(bg["scale"]),top + float(part["y"]) * float(bg["scale"])))

func draw_feel() -> void:
	if session == null: return
	var wind_lane: bool = false
	for e: BmkActorState in session.enemies:
		var zone: BmkHitZone = session.enemy_controller.attack_zone(session,e)
		if show_danger_zones and zone != null and (not zone.active or zone.active_age <= 2):
			var rect: Rect2 = zone.rectangle()
			var fill: Rect2 = rect
			if not zone.active:
				fill.size.x *= zone.progress
				if zone.face < 0:
					fill.position.x = rect.end.x - fill.size.x
			draw_rect(fill,Color(1,0.92,0.92,0.55) if zone.active else (Color(0.86,0.063,0.25,0.32) if zone.knockdown else Color(1,0.16,0.16,0.28)))
			draw_rect(rect,Color("ff2050") if zone.knockdown else Color(1,0.235,0.235,0.75),false,2.6 if zone.knockdown else 1.2)
		if e.st in ["chase","wind"] and absf(e.y - session.player.y) <= session.data.enemy_depth:
			wind_lane = wind_lane or e.st == "wind"
			ellipse(Vector2(e.x,e.y),30.0 * (1.0 - minf(e.z,150) / 300.0),8.4,Color(1,0.275,0.275,0.85))
		if session.lane_flash_ticks > 0 and e.st != "dead" and session.lane_flash_ids.has(e.id):
			ellipse(Vector2(e.x,e.y),32,9.4,Color(1,1,1,0.45 * session.lane_flash_ticks / 12.0),true)
	var p: BmkActorState = session.player
	if wind_lane and p.st != "dead":
		var alpha: float = 0.35 + 0.3 * sin(session.tick * 0.35)
		ellipse(Vector2(p.x,p.y),34.0 * (1.0 - minf(p.z,150) / 300.0),9.4,Color(1,0.196,0.196,alpha * 0.5),true)
		ellipse(Vector2(p.x,p.y),34,9.4,Color(1,0.196,0.196,minf(1,alpha + 0.35)),false,1.5)
	if p.sp >= 100 and p.st != "dead":
		ellipse(Vector2(p.x,p.y),30,9,Color(0.35,0.67,1,0.14),true)
		ellipse(Vector2(p.x,p.y),30,9,Color(0.55,0.8,1,0.85),false,1.4)
