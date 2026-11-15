class_name BmkStageCombat
extends BmkCombatResolver

func damage_enemy(sim: BmkSimulation, actor: BmkActorState, damage: float, kd: bool, kind: int = 0, fixed_damage: bool = false, attack_id: String = "") -> void:
	var s: BmkStageSimulation = sim as BmkStageSimulation
	var e: BmkStageActor = actor as BmkStageActor
	if e.st == "dead" or e.invulnerable: return
	if e.boss:
		s.gorath.damage(s,e,damage,kd,kind,fixed_damage,attack_id)
		return
	var before: String = e.st
	var armor: bool = false
	var tier: BmkGradeData = s.data.grade(attack_id,kd,kind)
	if s.player.st != "special" and (e.chain_n if before == "hurt" else 0) + 1 >= s.data.chain_cap: tier = s.data.grade("special",true,2)
	var strong: bool = kd or tier.knockdown or fixed_damage or s.player.st in ["skill","special"]
	if e.species == "heavy":
		if s.tick - e.armor_t > 90: e.armor_hits = 0
		e.armor_t = s.tick
		e.armor_hits += 1
		armor = not strong and e.armor_hits <= 3
		if not armor: e.armor_hits = 0
	armor = armor or before == "grabbing"
	# Retain the shared hit accounting, then restore source armor state.
	var old_t: int = e.t
	var old_mv: BmkEnemyMove = e.mv
	var old_vx: float = e.vx
	var old_vz: float = e.vz
	var old_chain: int = e.chain_n
	var old_pat: String = e.pat
	var old_hurt: int = e.hurt_t
	if damage > 0: s.sound("hurt")
	super.damage_enemy(s,e,damage,kd,kind,fixed_damage,attack_id)
	if e.st == "dead" and before != "dead": s.item_controller.enemy_drop(s,e)
	elif armor and not e.invulnerable:
		e.st = before
		e.t = old_t
		e.mv = old_mv
		e.vx = old_vx
		e.vz = old_vz
		e.chain_n = old_chain
		e.pat = old_pat
		e.hurt_t = old_hurt
		e.red_flash = 8
		e.flash = 0
	else: e.dive = null

func strike(sim: BmkSimulation, a: BmkAttackData) -> void:
	super.strike(sim,a)
	var s: BmkStageSimulation = sim as BmkStageSimulation
	for b: BmkWorldItem in s.barrels:
		if not b.gone and not s.player.hit_set.has(b.id) and in_reach(s.player,b,a.reach,24,55):
			s.player.hit_set[b.id] = true
			s.item_controller.damage_barrel(s,b)

func hurt_player(sim: BmkSimulation, damage: float, direction: int, kd: bool, hit_height: float = -1.0) -> bool:
	var s: BmkStageSimulation = sim as BmkStageSimulation
	var p: BmkStageActor = s.player as BmkStageActor
	if p.st == "grabbed" and p.grab != null and p.grab.kind == "bite" and p.inv <= 0:
		s.grabs.release(s,"hit")
	return super.hurt_player(s,damage,direction,kd,hit_height)

func enemy_collision(sim: BmkSimulation, actor: BmkActorState) -> void:
	var e: BmkStageActor = actor as BmkStageActor
	if e.boss or e.dive != null: return
	if not e.bump_active or not (e.st == "hurt" or e.st == "down" and e.z > 0) or absf(e.vx) < sim.data.bump_min: return
	for other: BmkActorState in sim.enemies:
		var o: BmkStageActor = other as BmkStageActor
		if o == e or o.boss or o.dive != null or o.balcony or e.bump_set.has(o.id) or o.st in ["dead","down","enter","grabbing"] or o.invulnerable: continue
		if absf(e.x - o.x) >= 30 or absf(e.y - o.y) >= 14: continue
		e.bump_set[o.id] = true
		var dir: int = int(signf(e.vx)) if e.vx != 0 else 1
		damage_enemy(sim,o,maxi(1,sim.js_round(e.bump_damage * 0.3)),false,1,false,"bump")
		if o.st == "hurt":
			o.vx = dir * o.d.knockback * 0.6
			o.hit_direction = dir

func skill_strike(sim: BmkSimulation, phase: int, a: BmkAttackData) -> void:
	super.skill_strike(sim,phase,a)
	var s: BmkStageSimulation = sim as BmkStageSimulation
	for b: BmkWorldItem in s.barrels:
		var key: String = "%d:%d" % [phase,b.id]
		var dx: float = (b.x - s.player.x) * s.player.face
		if not b.gone and not s.player.skill_hits.has(key) and dx > -a.behind - 16 and dx < a.reach + 16 and absf(b.y - s.player.y) < 38 and s.player.z < 85:
			s.player.skill_hits[key] = true
			s.item_controller.damage_barrel(s,b)
