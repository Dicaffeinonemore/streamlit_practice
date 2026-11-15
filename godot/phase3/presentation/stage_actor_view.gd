class_name BmkStageActorView
extends BmkActorView
var guard_glows: Array[Sprite2D] = []

func _ready() -> void:
	super._ready()
	var glow_material: ShaderMaterial = ShaderMaterial.new()
	glow_material.shader = load("res://phase3/presentation/guard_silhouette.gdshader") as Shader
	for i: int in range(4):
		var glow: Sprite2D = Sprite2D.new()
		glow.centered = false
		glow.material = glow_material
		glow.visible = false
		add_child(glow)
		move_child(glow,0)
		guard_glows.append(glow)

func present(s: BmkSimulation, a: BmkActorState, asset: BmkAnimationAsset, frame: int, player_body: bool = false) -> void:
	super.present(s,a,asset,frame,player_body)
	if a is not BmkStageActor: return
	var e: BmkStageActor = a as BmkStageActor
	if player_body:
		if (s as BmkStageSimulation).mode == "bossintro" or s.tick < e.quiet_inv_until: body.visible = true
		return
	if e.balcony: body.modulate *= Color(0.62,0.62,0.62)
	if e.boss:
		var offsets: Array[Vector2] = [Vector2(-3,0),Vector2(3,0),Vector2(0,-3),Vector2(0,2)]
		for i: int in range(guard_glows.size()):
			var glow: Sprite2D = guard_glows[i]
			glow.visible = e.g2.guard
			glow.texture = body.texture
			glow.offset = body.offset
			glow.scale = body.scale
			glow.position = Vector2(e.g2.jitter,0) + offsets[i]
			glow.modulate.a = 0.3 + 0.22 * sin(s.tick * 0.45)
		body.visible = true
		body.position.x = e.g2.jitter
		body.modulate = Color.WHITE * (1.8 if e.flash > 0 else 1.0) * (1.0 - e.g2.dark)
		var act: BmkGorathAction = e.g2.act
		alert.visible = act != null and act.kind == "move" and not act.linked and act.f <= int((s as BmkStageSimulation).stage_data.move(act.id)["warnTo"]) and (s.tick / 7) % 2 == 0
		alert.text = "!"
		alert.position.y = -e.d.height - 56
		alert.add_theme_color_override("font_color",Color("ffd23f"))
		alert.add_theme_font_size_override("font_size",26)
	else:
		for glow: Sprite2D in guard_glows: glow.visible = false
		var zone: BmkHitZone = s.enemy_controller.attack_zone(s,e)
		var start: int = e.dive.t if e.dive != null else (e.mv_t if e.mv != null else e.t)
		if zone != null and zone.warning and not zone.active and start >= 1:
			alert.visible = zone.hit_in > 8 or (s.tick / 2) % 2 == 0
			alert.text = "!!" if zone.knockdown else "!"
			alert.position.y = -e.z - e.d.height - 56
			alert.add_theme_font_size_override("font_size",26)
			alert.add_theme_color_override("font_color",Color("ff3d3d") if zone.hit_in <= 8 else Color("ffd23f"))
		elif e.molotov and e.st == "wind" and e.pat == "throw":
			alert.visible = e.t < 22 or (s.tick / 2) % 2 == 0
			alert.text = "!"
			alert.position.y = -e.z - e.d.height - 56
			alert.add_theme_color_override("font_color",Color("ff3d3d") if e.t >= 22 else Color("ffd23f"))

func _draw() -> void:
	if actor is BmkStageActor and (actor as BmkStageActor).boss:
		if (actor as BmkStageActor).g2.clip == "intro_chop": return
		draw_set_transform(Vector2.ZERO,0,Vector2(52,8.4))
		draw_circle(Vector2.ZERO,1,Color(0,0,0,0.35))
		draw_set_transform(Vector2.ZERO)
	elif actor is BmkStageActor and (actor as BmkStageActor).balcony: return
	else: super._draw()
