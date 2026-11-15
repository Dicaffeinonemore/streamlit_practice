class_name BmkFullFrameSelector
extends BmkFrameSelector

func player(s: BmkSimulation) -> Dictionary:
	if s.player.st == "grabbed": return {"clip":"hurt","index":[4,5,6,5][int(floor(s.player.t * s.MS / 120)) % 4]}
	return super.player(s)

func enemy(sim: BmkSimulation, actor: BmkActorState, art: Dictionary) -> Dictionary:
	var e: BmkStageActor = actor as BmkStageActor
	var s: BmkStageSimulation = sim as BmkStageSimulation
	if e.boss: return {"clip":e.g2.clip,"index":e.g2.fi}
	if e.species == "hound":
		if e.st in ["dead","down"]: return {"clip":"knockdown","index":anim_index(PackedInt32Array([4,4,4,6,10]),e.t)}
		if e.st == "rec" and e.getup: return {"clip":"getup","index":anim_index(PackedInt32Array([5,5,5,5,5,5]),e.t)}
		if e.st == "hurt": return {"clip":"hurt","index":mini(5,int(floor(e.t / 4.0)))}
		if e.st == "grabbing": return {"clip":"dive","index":4}
		if e.st == "trip": return {"clip":"knockdown","index":[3,4,5][anim_index(PackedInt32Array([6,20,30]),e.t)]}
		if e.dive != null: return {"clip":"dive","index":e.dive.f}
		var clip: String = "run" if e.walk else "idle"
		return {"clip":clip,"index":int(floor(s.tick / (3.0 if e.walk else 6.0) + e.id * 3)) % (art["clips"][clip] as Array).size()}
	if e.st == "grabbing": return {"clip":"choke","index":int(floor(s.tick / 6.0 + e.id * 3)) % (art["clips"]["choke"] as Array).size()}
	if e.molotov:
		if e.st in ["dead","down","hurt"] or e.st == "rec" and e.getup: return super.enemy(s,e,art)
		if e.pat == "throw" and e.st == "wind": return {"clip":"throw","index":clampi(int(floor(e.t / 6.0)),0,4)}
		if e.pat == "kick": return {"clip":"throw","index":4 if e.st == "wind" else 6}
		if s.tick - e.throw_at < 23: return {"clip":"throw","index":5 + anim_index(PackedInt32Array([3,4,5,5,6]),s.tick - e.throw_at)}
	return super.enemy(s,e,art)
