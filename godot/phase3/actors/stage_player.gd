class_name BmkStagePlayer
extends BmkPlayerController

func update_grab(sim: BmkSimulation) -> void:
	(sim as BmkStageSimulation).grabs.step(sim as BmkStageSimulation)

func collect_items(sim: BmkSimulation) -> void:
	(sim as BmkStageSimulation).item_controller.collect(sim as BmkStageSimulation)

func special_hit(sim: BmkSimulation, last: bool) -> void:
	super.special_hit(sim,last)
	var s: BmkStageSimulation = sim as BmkStageSimulation
	for b: BmkWorldItem in s.barrels:
		if not b.gone and absf(b.x - s.player.sp_x) < (110 if last else 80) and absf(b.y - s.player.sp_y) < (60 if last else 44):
			s.item_controller.damage_barrel(s,b,"barelFinalHit" if last else "none")

func update_dash_attack(sim: BmkSimulation) -> void:
	var t: int = sim.player.t
	super.update_dash_attack(sim)
	var s: BmkStageSimulation = sim as BmkStageSimulation
	var p: BmkActorState = s.player
	if t < s.data.dash_attack_from or t >= s.data.dash_attack_to: return
	for b: BmkWorldItem in s.barrels:
		var dx: float = (b.x - p.x) * p.face
		if b.gone or p.hit_set.has(b.id) or dx + b.hw < s.data.dash_front or dx - b.hw > s.data.dash_reach or absf(b.y - p.y) >= s.data.dash_depth: continue
		p.hit_set[b.id] = true
		s.item_controller.damage_barrel(s,b)
		p.dash_attack_hit = true

