class_name BmkAurelionView
extends Node2D
## aurelion-runtime.js drawAurelionHazards() and the royal halo / gold aura from drawAurelion().
## Both use the 'lighter' composite, so this node draws with an ADD material.
## back = true draws the phase-two aura at the feet (before the actors).
const MS: float = 1000.0 / 60.0
var session: BmkWaveSimulation
var bank: BmkAssetBank
var back: bool = false

func _ready() -> void:
	var material_: CanvasItemMaterial = CanvasItemMaterial.new()
	material_.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD
	material = material_

func fx_asset(id: String) -> BmkAnimationAsset:
	return bank.animation("aurelion_art.fx_" + id) if ResourceLoader.exists("res://port_assets/resources/aurelion_art.fx_%s.tres" % id) else null

func paint(asset: BmkAnimationAsset, index: int, x: float, y: float, face: int, alpha: float, extra_scale: float = 1.0) -> void:
	if asset == null: return
	var count: int = asset.sprite_frames.get_frame_count(&"source")
	var i: int = mini(count - 1,maxi(0,index))
	var scale_: float = asset.frame_scales[i] * extra_scale
	draw_set_transform(Vector2(x,y),0,Vector2(face * scale_,scale_))
	draw_texture(asset.sprite_frames.get_frame_texture(&"source",i),-asset.frame_pivots[i],Color(1,1,1,alpha))
	draw_set_transform(Vector2.ZERO)

static func halo_visible(e: BmkLegacyActor) -> bool:
	var a: BmkAurelionState = e.aurelion
	return a != null and a.halo and (e.p2shown or e.st == "intro") and e.st not in ["down","stun","dead"] and (e.phase_t == 0 or a.transition_age >= 146)

func _draw() -> void:
	if session == null or session.aurelion == null: return
	var k: float = float(session.wave_data.source["AURELION"]["K"])
	for actor: BmkActorState in session.enemies:
		var e: BmkLegacyActor = actor as BmkLegacyActor
		if e.type != "boss3" or not halo_visible(e): continue
		if back:
			if e.p2shown: paint(fx_asset("gold_aura"),floori(session.tick / 5.0) % 4,e.x,e.y,e.face,0.55)
		else: paint(fx_asset("royal_halo"),floori(session.tick / 6.0) % 4,e.x,e.y - e.z - 215 * k,e.face,1.0)
	if back: return
	var art: Dictionary = session.wave_data.source["AURELION"]
	for z: BmkLegacyHazard in session.legacy_hazards:
		if z.type != "aurelion" or z.dead: continue
		var f: float = z.age / MS - z.delay
		if f < 0: continue
		var def: Dictionary = art["projectiles"].get(z.kind,{})
		var fx: Dictionary = art["effects"].get(z.fx,{})
		var step: float = float(def.get("frame_duration",fx.get("frame_duration",5)))
		var frames: int = int(fx.get("frames",4))
		var frame: int = floori(f / step) % frames if bool(def.get("loop",false)) else mini(frames - 1,floori(f / step))
		# riftWarningAlpha({age, delay: Infinity}): judgment marks blink until the pillars fall.
		var alpha: float = (0.95 if floori(z.age / 150) % 2 == 0 else 0.24) if z.kind == "judge_mark" else 1.0
		paint(fx_asset(z.fx),frame,z.x,z.y - z.h,z.face,alpha,float(def.get("scale",1.0)))
