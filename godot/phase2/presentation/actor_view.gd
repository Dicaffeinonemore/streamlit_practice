class_name BmkActorView
extends Node2D
var body: Sprite2D
var alert: Label
var actor: BmkActorState
var session: BmkSimulation
var is_player: bool = false

func _ready() -> void:
	body = Sprite2D.new()
	body.centered = false
	add_child(body)
	alert = Label.new()
	alert.position = Vector2(-35,-140)
	# The "!" warning is UI (game.js drawEnemyOverlay): it stays above every effect.
	alert.z_index = 6
	alert.size = Vector2(70,40)
	alert.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	alert.add_theme_color_override("font_outline_color",Color.BLACK)
	alert.add_theme_constant_override("outline_size",4)
	add_child(alert)

func present(s: BmkSimulation, a: BmkActorState, asset: BmkAnimationAsset, frame: int, player_body: bool = false) -> void:
	session = s
	actor = a
	is_player = player_body
	position = Vector2(a.x,a.y)
	var index: int = clampi(frame,0,asset.sprite_frames.get_frame_count(&"source") - 1)
	body.texture = asset.sprite_frames.get_frame_texture(&"source",index)
	body.region_enabled = player_body and asset.metadata.get("clip", "") == "slam" and index >= 7
	if body.region_enabled:
		body.region_rect = Rect2(0,0,minf(220.0 if index == 7 else 190.0,body.texture.get_width()),body.texture.get_height())
	body.offset = -asset.frame_pivots[index]
	body.scale = Vector2(a.face,1) * asset.frame_scales[index]
	body.position = Vector2(0,-a.z)
	body.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR if player_body or asset.frame_scales[index] * 1.5 < 1.0 else CanvasItem.TEXTURE_FILTER_NEAREST
	body.visible = not (player_body and a.inv > 0 and a.st == "free" and (s.tick / 4) % 2 != 0) and not (not player_body and a.st == "dead" and a.t > 25 and (s.tick / 4) % 2 != 0)
	body.modulate = Color.WHITE
	if a.flash > 0:
		body.modulate = Color(1.8,1.8,1.8) if not player_body or a.st != "hurt" else Color(1.5,0.6,0.7)
	if not player_body:
		var jitter: float = 0.0
		if s.hit_stop > 0 and s.last_hit_id == a.id:
			jitter = (3.0 if s.last_tier in ["heavy","finisher"] else 2.0) * (1.0 if s.hit_stop % 2 != 0 else -1.0)
		var hurt: float = cos(a.hr * 0.03) * exp(-a.hr / 150.0) * a.hit_direction * 3.0 if a.hr < 220.0 else 0.0
		body.position.x = jitter + hurt
		if a.red_flash > 0 and (a.red_flash / 2) % 2 == 0:
			body.modulate = Color(1.5,0.35,0.45)
	body.modulate.a = clampf(1.0 - float(a.t - 65) / 35.0,0.0,1.0) if player_body and a.st == "dead" else a.alpha
	alert.visible = false
	if not player_body:
		var zone: BmkHitZone = s.enemy_controller.attack_zone(s,a)
		if zone != null and zone.warning and not zone.active and a.mv_t >= 1:
			var late: bool = zone.hit_in <= 8
			alert.visible = not late or (s.tick / 2) % 2 == 0
			alert.text = "!!" if zone.knockdown else "!"
			alert.position.y = -a.z - a.d.height - 56.0
			alert.add_theme_color_override("font_color",Color("ff3d3d") if late else Color("ffd23f"))
			alert.add_theme_font_size_override("font_size",s.js_round(26.0 * (1.0 if late else lerpf(1.4,1.0,clampf(a.mv_t / 4.0,0.0,1.0)))))
			if late and (s.tick / 2) % 2 != 0:
				body.modulate = Color(2,2,2,body.modulate.a)
	queue_redraw()

func _draw() -> void:
	if actor == null:
		return
	var radius: float = (32.0 if is_player else 30.0) * (1.0 - minf(actor.z,150.0) / 300.0)
	draw_set_transform(Vector2.ZERO,0.0,Vector2(radius,8.4))
	draw_circle(Vector2.ZERO,1.0,Color(0,0,0,0.35))
	draw_set_transform(Vector2.ZERO)
