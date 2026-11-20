class_name BmkWaveCombat
extends BmkStageCombat
## game.js damageEnemy() for the wave stages' soldiers and bosses.

func damage_enemy(sim: BmkSimulation, actor: BmkActorState, damage: float, kd: bool, kind: int = 0, fixed_damage: bool = false, attack_id: String = "", hit: String = "") -> void:
	var s: BmkWaveSimulation = sim as BmkWaveSimulation
	var e: BmkLegacyActor = actor as BmkLegacyActor
	if e.type == "boss4" and s.vargul.intercept(e): return
	if e.type == "boss5" and s.sovereign.intercept(s,e): return
	if e.type == "boss3" and s.aurelion.intercept(s,e,kd,fixed_damage): return
	if e.phase_t > 0 or e.st == "reviving" or e.st == "dead" or e.invulnerable: return
	var p: BmkActorState = s.player
	var stunned: bool = e.st == "stun"
	var dmg: float = damage
	if stunned and not fixed_damage: dmg = s.js_round(dmg * 1.5)
	if e.boss and not fixed_damage: dmg = s.js_round(dmg * (1 + minf(0.5,0.05 * s.chain_n)))
	s.chain_n += 1
	s.chain_t = float(s.wave_data.source["CHAIN_MS"])
	s.chain_max = maxi(s.chain_max,s.chain_n)
	var tier: BmkGradeData = s.data.grade(attack_id,kd,kind)
	if not e.boss and p.st != "special" and (e.chain_n if e.st == "hurt" else 0) + 1 >= s.data.chain_cap: tier = s.data.grade("special",true,2)
	e.hp -= dmg
	e.flash = tier.flash
	if dmg > 0: s.sound("hurt")
	var move: BmkAttackData = s.data.attack(attack_id)
	var stop: int = move.hitstop if move != null else (s.data.dash_attack_stop if attack_id == "dashAttack" else 0)
	s.hit_stop = maxi(s.hit_stop,maxi(tier.hitstop,stop))
	if tier.shake > 0: s.shake = maxf(s.shake,tier.shake)
	s.player_hit_sound(kind, hit)
	var direction: int = 1 if p.x <= e.x else -1
	e.hr = 0
	e.hit_direction = direction
	e.hheavy = tier.rank >= 2
	e.bump_active = true
	e.bump_set.clear()
	e.bump_damage = dmg
	s.last_hit_id = e.id
	s.last_tier = tier.id
	s.impact(e.x,e.y,56,kind)
	if e.hp <= 0:
		if e.type == "boss2" and not e.p2shown:
			s.morgra.begin_revival(s,e)
			return
		if e.type == "boss4" and not e.p2shown:
			s.vargul.begin_transition(s,e)
			return
		if e.type == "boss5" and not e.p2shown:
			s.sovereign.begin_transition(s,e)
			return
		if e.type == "boss3" and not e.p2shown:
			s.enemy_controller.begin_boss_phase2(s,e,true)
			return
		e.hp = 0
		e.st = "dead"
		e.t = 0
		e.pat = ""
		p.score += e.d.score
		s.item_controller.enemy_drop(s,e)
		if e.boss:
			s.enemy_controller.reset_boss_fx(e,s)
			e.vx = 0
			e.vz = 0
			s.shake = 20
			s.hit_stop = 16
			s.flash_t = 220
			s.slow_request = 1100
			s.clear_boss_hazards()
			s.sound("bossdie")
		else:
			e.vz = 6
			e.vx = direction * 5
			s.sound("mobdie")
		return
	if e.boss:
		if stunned: return
		e.gr = minf(e.gr_max,e.gr + dmg * 0.9)
		e.gr_t = 150
		if e.gr >= e.gr_max:
			s.enemy_controller.reset_boss_fx(e,s)
			e.st = "stun"
			e.t = 0
			e.vx = 0
			e.z = 0
			e.vz = 0
			s.shake = 16
			s.hit_stop = 10
			s.sound("groggy")
			return
		if s.morgra.armored(e): return
		if e.hp <= e.next_kd:
			e.next_kd -= e.max_hp * 0.25
			s.enemy_controller.reset_boss_fx(e,s)
			e.st = "down"
			e.t = 0
			e.vz = 5
			e.vx = direction * 3
			if e.type == "boss3": s.spawn_adds(["rogue","rogue"])
		elif e.st == "chase" or e.st == "rec" or e.type == "boss3" and e.st == "pat" and not s.aurelion.armored(e) and e.aurelion.guard != "broken" or e.type == "boss4" and e.st == "pat" and not s.vargul.armored(e):
			if e.type == "boss3" or e.type == "boss4": s.enemy_controller.reset_boss_fx(e,s)
			e.st = "hurt"
			e.t = 0
			e.vx = direction
		return
	if tier.knockdown: kd = true
	if bool(s.wave_data.source["ENEMIES"].get(e.type,{}).get("armorWhileWind",false)) and e.st == "wind" and not kd: return
	e.chain_n = (e.chain_n if e.st == "hurt" else 0) + 1
	if kd:
		e.st = "down"
		e.t = 0
		e.vz = 5
		e.vx = direction * (tier.knockdown_speed if tier.knockdown_speed != 0.0 else s.data.knockdown_speed)
		e.chain_n = 0
	else:
		e.st = "hurt"
		e.t = 0
		var base: int = int(s.wave_data.source["ENEMIES"].get(e.type,s.wave_data.source["ENEMIES"]["default"])["hurtTicks"])
		e.hurt_t = maxi(base,move.hitstun if move != null and move.hitstun >= 0 else base) + tier.stun_bonus
		e.vx = direction * e.d.knockback * tier.knockback_multiplier
	e.pat = ""

## game.js hurtPlayer(dmg, dir, kd, source): bosses in phase 2 and their hazards scale damage.
func enemy_collision(sim: BmkSimulation, actor: BmkActorState) -> void:
	var e: BmkLegacyActor = actor as BmkLegacyActor
	var c: Dictionary = (sim as BmkWaveSimulation).wave_data.source["COLLIDE"]
	if e.boss or not e.bump_active or not (e.st == "hurt" or e.st == "down" and e.z > 0) or absf(e.vx) < float(c["minSpeed"]): return
	for other: BmkActorState in sim.enemies:
		var o: BmkLegacyActor = other as BmkLegacyActor
		if o == e or e.bump_set.has(o.id) or o.boss or o.st in ["dead","down","grabbing","enter"] or o.invulnerable or o.phase_t > 0: continue
		if absf(e.x - o.x) >= float(c["dx"]) or absf(e.y - o.y) >= float(c["dy"]): continue
		e.bump_set[o.id] = true
		var dir: int = int(signf(e.vx)) if e.vx != 0 else 1
		var keep: Dictionary[int, bool] = e.bump_set.duplicate()
		damage_enemy(sim,o,maxi(1,sim.js_round((e.bump_damage if e.bump_damage != 0.0 else 1.0) * float(c["dmgMul"]))),false,1,false,"bump")
		e.bump_set = keep
		if o.st == "hurt":
			o.vx = dir * o.d.knockback * float(c["kbMul"])
			o.hit_direction = dir
		sim.sound("hit")
