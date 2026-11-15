class_name BmkStageTopView
extends BmkFullStageView

func _draw() -> void:
	if session == null: return
	var s: BmkStageSimulation = session as BmkStageSimulation
	if (section as BmkFullStage).background.get("fg") != null:
		var bg: Dictionary = (section as BmkFullStage).background
		var texture: Texture2D = bank.source_image(str(bg["fg"]))
		var k: float = float(bg["scale"])
		draw_texture_rect(texture,Rect2(Vector2(0,340 - float(bg["floorY"]) * k),texture.get_size() * k),false)
	for x: float in (section as BmkFullStage).scaffolds:
		draw_scaffold(x,true)
	for z: BmkFireHazard in s.fire_hazards:
		if z.type == "molotov": draw_asset(bank.animation("stage1_fx.bottle_spin"),int(floor(z.age / s.MS / 3)),Vector2(z.x,z.y - z.h))
	var e: BmkStageActor = s.gorath.boss(s)
	if e == null: return
	for m: BmkMeatState in e.g2.meats:
		if m.t >= 72: continue
		var frame: Dictionary = m.frame()
		if bool(frame.get("sky",false)):
			var u: float = float(frame["u"])
			draw_g2(s,m.kind,0,Vector2(m.x,m.y - (m.y - 146 + 30) * (1 - u * u)),1,1,m.spin * deg_to_rad(10) * (1 - u) * cos(m.t * 0.2))
		else: draw_g2(s,m.kind,int(frame["fi"]),Vector2(m.x,m.y),1,float(frame["alpha"]))
	var hook: BmkGorathHook = e.g2.hook
	if hook == null or hook.hidden: return
	if hook.ult:
		var frames: Array = s.stage_data.source["G2A"]["clips"][e.g2.clip]["frames"]
		var point: Array = (frames[clampi(e.g2.fi,0,frames.size() - 1)] as Dictionary).get("chain",[])
		if point.is_empty(): return
		var from: Vector2 = Vector2(e.x + e.face * float(point[0]),e.y - float(point[1]))
		var axis: Vector2 = Vector2(e.face * cos(deg_to_rad(float(point[2]))),-sin(deg_to_rad(float(point[2]))))
		var length: float = minf(640,(from.y - 116) / -axis.y if axis.y < -0.05 else 640) * clampf(hook.u,0,1)
		chain(from,from + axis * length)
		if hook.u < 1: hook_sprite(from + axis * length,axis.angle())
	else:
		var hand_: PackedFloat64Array = s.gorath.actions.hand(s,e)
		chain(Vector2(hand_[0],e.y - hand_[1]),Vector2(hook.x,hook.y - hook.h))
		hook_sprite(Vector2(hook.x,hook.y - hook.h),0 if hook.dir > 0 else PI)

func chain(from: Vector2, to: Vector2) -> void:
	var asset: BmkAnimationAsset = bank.animation("gorath_remake.chain")
	var texture: Texture2D = asset.sprite_frames.get_frame_texture(&"source",0)
	var k: float = asset.frame_scales[0]
	var width: float = texture.get_width() * k
	var height: float = texture.get_height() * k
	var length: float = from.distance_to(to)
	draw_set_transform(from,(to - from).angle())
	var at: float = 0
	while at < length:
		var n: float = minf(width,length - at)
		draw_texture_rect_region(texture,Rect2(at,-height / 2,n,height),Rect2(0,0,n / k,texture.get_height()))
		at += width * 0.8
	draw_set_transform(Vector2.ZERO)

func hook_sprite(at: Vector2, angle_: float) -> void:
	var asset: BmkAnimationAsset = bank.animation("gorath_remake.hook")
	var texture: Texture2D = asset.sprite_frames.get_frame_texture(&"source",0)
	draw_set_transform(at,angle_,Vector2(1,-1 if cos(angle_) < 0 else 1) * asset.frame_scales[0])
	draw_texture(texture,-asset.frame_pivots[0])
	draw_set_transform(Vector2.ZERO)
