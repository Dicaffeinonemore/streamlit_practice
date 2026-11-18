class_name BmkLegacyPresenter
extends RefCounted
## named-runtime.js namedEnemyFrame()/paintNamedFrame() for the stage soldiers and
## morgra-runtime.js drawMorgra() frame selection. Returns what BmkActorView needs.
const MS: float = 1000.0 / 60.0
var bank: BmkAssetBank

func _init(asset_bank: BmkAssetBank) -> void:
	bank = asset_bank

## {asset, index, scale, lift, alpha, visible}
func pose(s: BmkWaveSimulation, e: BmkLegacyActor) -> Dictionary:
	if e.type == "boss2": return morgra_pose(s,e)
	return soldier_pose(s,e)

func clip_asset(role: String, action: String) -> BmkAnimationAsset:
	return bank.animation("named.%s.%s" % [role,action])

func named_clip(role: String, action: String, index: float) -> Array:
	var asset: BmkAnimationAsset = clip_asset(role,action)
	var count: int = asset.sprite_frames.get_frame_count(&"source")
	return [asset,mini(count - 1,maxi(0,floori(index)))]

func named_at(role: String, action: String, progress: float, loop: bool = false) -> Array:
	var count: int = clip_asset(role,action).sprite_frames.get_frame_count(&"source")
	return named_clip(role,action,(fposmod(progress,1.0) if loop else clampf(progress,0,0.999999)) * count)

func soldier_pose(s: BmkWaveSimulation, e: BmkLegacyActor) -> Dictionary:
	var role: String = "stage%d_%s" % [s.stage_index + 1,e.type]
	var picked: Array
	var wind: float = float(e.stats.get("wind",1))
	var act: float = float(e.stats.get("act",1))
	if e.st in ["wind","act","rec"]:
		if e.type == "brute":
			if e.st == "wind": picked = named_clip(role,"attack",0 if e.t / wind < 0.6 else 1)
			elif e.st == "act": picked = named_clip(role,"attack",2 if e.t / act < 0.6 else 3)
			else: picked = named_clip(role,"attack",4)
		elif e.st == "wind": picked = named_clip(role,"attack",0)
		elif e.st == "act": picked = named_at(role,"attack",0.34 + e.t / act * 0.65)
		else: picked = named_clip(role,"idle",0)
	elif e.st == "dead": picked = named_at(role,"death",e.t * MS / 450.0)
	elif e.st == "down" and e.z == 0: picked = named_at(role,"death",e.t / 35.0)
	elif e.st in ["hurt","stun","down"]: picked = named_at(role,"hurt",e.t / 30.0)
	else: picked = named_at(role,"walk" if e.walk else "idle",s.tick * MS / (720.0 if e.walk else 1400.0),true)
	var asset: BmkAnimationAsset = picked[0]
	var index: int = picked[1]
	var source: String = str(asset.source_frames[index].get("source",{}).get("source",""))
	return {"asset":asset,"index":index,"scale":1.12 if e.type == "brute" and not source.begins_with("heavy") else 1.0,
		"lift":0.0,"alpha":clampf(1 - (e.t - 40) / 25.0,0,1) if e.st == "dead" else e.alpha,"visible":true}

func morgra_pose(s: BmkWaveSimulation, e: BmkLegacyActor) -> Dictionary:
	var id: String = "p2_idle" if e.p2shown else ("walk" if e.walk else "idle")
	var f: float = s.tick
	var start: int = int(s.morgra.revive_value("death") + s.morgra.revive_value("wait"))
	if e.st == "reviving":
		id = "death" if e.t < start else "revive"
		f = mini(e.t,109) if e.t < start else e.t - start
	elif e.st == "dead":
		id = "p2_death" if e.p2shown else "death"
		f = e.t
	elif e.st == "down":
		id = "knockdown"
		f = minf(109,e.t / 60.0 * 110)
	elif e.st == "stun":
		id = "p2_hurt" if e.p2shown else "hurt"
		f = 0
	elif e.st == "hurt":
		id = "p2_hurt" if e.p2shown else "hurt"
		f = e.t * 3
	elif e.st == "pat":
		id = e.morgra_move if not e.morgra_move.is_empty() else s.morgra.resolve(e,e.pat)
		f = e.pt / MS
	var d: Dictionary = s.morgra.drawing(id,f)
	var clip: String = str(d.get("clip",id))
	var path: String = "res://port_assets/resources/morgra_art.%s.tres" % clip
	if not ResourceLoader.exists(path): return {"visible":false}
	var asset: BmkAnimationAsset = bank.animation("morgra_art." + clip)
	return {"asset":asset,"index":int(d["index"]) - 1,"scale":1.0,"lift":s.morgra.hover(e),
		"alpha":clampf(1 - (e.t - 65) / 55.0,0,1) if e.st == "dead" else e.alpha,"visible":e.st != "intro"}
