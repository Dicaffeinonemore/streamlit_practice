class_name BmkCombatResolver
extends RefCounted

func can_hit(e: BmkActorState) -> bool:
	return e.st != "dead" and e.st != "down" and e.inv <= 0 and not e.invulnerable

func in_reach(a: BmkActorState, target: BmkActorState, reach: float, depth: float, height: float) -> bool:
	var dx: float = (target.x - a.x) * a.face
	return dx > -8.0 and dx < reach + target.hw and absf(target.y - a.y) < depth and absf(target.z - a.z) < height

func damage_enemy(s: BmkSimulation, e: BmkActorState, damage: float, kd: bool, kind: int = 0, fixed_damage: bool = false, attack_id: String = "", hit: String = "") -> void:
	if e.st == "dead" or e.invulnerable:
		return
	var p: BmkActorState = s.player
	s.chain_n += 1
	s.chain_t = 1700.0
	s.chain_max = maxi(s.chain_max, s.chain_n)
	var tier: BmkGradeData = s.data.grade(attack_id, kd, kind)
	if p.st != "special" and (e.chain_n if e.st == "hurt" else 0) + 1 >= s.data.chain_cap:
		tier = s.data.grade("special", true, 2)
	e.hp -= damage
	e.flash = tier.flash
	if damage > 0: s.sound("hurt")
	var move: BmkAttackData = s.data.attack(attack_id)
	var stop: int = move.hitstop if move != null else (s.data.dash_attack_stop if attack_id == "dashAttack" else 0)
	s.hit_stop = maxi(s.hit_stop, maxi(tier.hitstop, stop))
	if tier.shake > 0.0:
		s.shake = maxf(s.shake, tier.shake)
	var direction: int = 1 if p.x <= e.x else -1
	e.hit_direction = direction
	e.hr = 0.0
	e.bump_active = true
	e.bump_set.clear()
	e.bump_damage = damage
	s.last_hit_id = e.id
	s.last_tier = tier.id
	s.impact(e.x, e.y, 56.0, kind)
	s.player_hit_sound(kind, hit)
	if e.hp <= 0.0:
		e.hp = 0.0
		e.st = "dead"
		e.t = 0
		e.pat = ""
		p.score += e.d.score
		e.vz = 6.0
		e.vx = direction * 5.0
		s.sound("mobdie")
		return
	if tier.knockdown:
		kd = true
	e.hit_low = not (p.z > 20.0 or p.st == "special") and (attack_id == "c2" or p.st == "dash" or p.st == "skill" and p.skill == "thrust")
	var strong: bool = kd or fixed_damage or p.st == "skill" or p.st == "special"
	if e.mv != null and e.mv.armor_from >= 0 and not strong and e.mv_f + 1 >= e.mv.armor_from and e.mv_f + 1 <= e.mv.armor_to:
		e.red_flash = 6
		return
	e.mv = null
	e.chain_n = (e.chain_n if e.st == "hurt" else 0) + 1
	if kd:
		e.st = "down"
		e.t = 0
		e.vz = 5.0
		e.vx = direction * (tier.knockdown_speed if tier.knockdown_speed != 0.0 else s.data.knockdown_speed)
		e.chain_n = 0
	else:
		e.st = "hurt"
		e.t = 0
		e.hurt_t = maxi(s.data.enemy_hurt_ticks, move.hitstun if move != null and move.hitstun >= 0 else s.data.enemy_hurt_ticks) + tier.stun_bonus
		e.vx = direction * e.d.knockback * tier.knockback_multiplier
	e.pat = ""

func hurt_player(s: BmkSimulation, damage: float, direction: int, kd: bool, hit_height: float = -1.0, hitstun: float = -1.0) -> bool:
	var p: BmkActorState = s.player
	if p.inv > 0 or p.st in ["down", "dead", "special", "grabbed"]:
		return false
	damage = s.js_round(damage)
	# game.js hurtPlayer(): BarelHurt.begin() runs for Barel only; Viesa keeps her default hitstun.
	if not p.is_viesa(): begin_barel_hurt(s,p.z + 56.0 if hit_height < 0.0 else hit_height,hitstun if hitstun >= 0.0 else float(s.data.hurt_ticks))
	s.stat_damage += minf(p.hp, damage)
	p.hp -= damage
	p.flash = 5
	p.combo = 0
	p.buf = 0.0
	p.skill = ""
	p.viesa_action = null
	p.viesa_hover_grace = 0
	p.viesa_landing = ""
	s.chain_n = 0
	s.hit_stop = maxi(s.hit_stop, s.data.down_stop if kd else s.data.hurt_stop)
	s.shake = maxf(s.shake, 12.0 if kd else 7.0)
	s.impact(p.x, p.y, 56.0, 2 if kd else 1)
	s.sound("hurtH" if kd else "hurt")
	if p.hp <= 0.0:
		p.hp = 0.0
		p.lives -= 1
		s.stat_deaths += 1
		p.st = "dead"
		p.t = 0
		p.vz = 6.0
		p.vx = direction * 4.0
		s.sound("pdie")
		return true
	if kd or p.z > 0.0:
		p.st = "down"
		p.t = 0
		p.vz = s.data.down_velocity
		p.vx = direction * s.data.down_speed
	else:
		p.st = "hurt"
		p.t = 0
		p.vx = direction * s.data.hurt_speed
		p.inv = s.data.hurt_inv
	return true

## BarelHurt.begin(actor, worldHeight, totalTicks): hurt high/low pose and its frame ends.
func begin_barel_hurt(s: BmkSimulation, height: float, ticks: float) -> void:
	var p: BmkActorState = s.player
	p.hurt_kind = "hurt_high" if height - p.z >= 90.0 * 0.55 else "hurt_low"
	p.hurt_duration = maxi(7, s.js_round(ticks))
	var weights: PackedFloat64Array = s.data.hurt_high_weights if p.hurt_kind == "hurt_high" else s.data.hurt_low_weights
	var sum: float = 0.0
	for weight: float in weights:
		sum += weight
	p.hurt_ends.clear()
	var end: float = 0.0
	for weight: float in weights:
		end += weight / sum * (p.hurt_duration - 6)
		p.hurt_ends.append(end)
	p.hurt_ends.append(p.hurt_duration)

func strike(s: BmkSimulation, a: BmkAttackData) -> void:
	var p: BmkActorState = s.player
	s.strike_crows(a.reach, 0.0, p.x, p.y, p.z, p.face)
	s.strike_orbs(a.reach, 8.0, p.hit_set, "", {"damage":s.js_round(a.damage * (1.5 if p.buff > 0 else 1.0))})
	var blocked: bool = s.strike_fists(a.reach, 8.0, p.hit_set, "", {"damage":s.js_round(a.damage * (1.5 if p.buff > 0 else 1.0)),"kd":a.knockdown})
	for e: BmkActorState in s.enemies:
		if not can_hit(e) or p.hit_set.has(e.id) or blocked and s.is_sovereign(e):
			continue
		if in_reach(p, e, a.reach, 24.0, 55.0):
			p.hit_set[e.id] = true
			damage_enemy(s, e, s.js_round(a.damage * (1.5 if p.buff > 0 else 1.0)), a.knockdown, a.effect, false, a.id)
			p.sp = minf(100.0, p.sp + (8.0 if a.knockdown else 5.0))

func skill_strike(s: BmkSimulation, phase: int, a: BmkAttackData) -> void:
	var p: BmkActorState = s.player
	s.strike_crows(a.reach, a.behind, p.x, p.y, p.z, p.face)
	s.strike_orbs(a.reach, a.behind, p.skill_hits, "%d:o" % phase, {"depth":38.0,"damage":s.js_round(a.damage * (1.5 if p.buff > 0 else 1.0))})
	var blocked: bool = s.strike_fists(a.reach, a.behind, p.skill_hits, "%d:o" % phase, {"depth":38.0,"damage":s.js_round(a.damage * (1.5 if p.buff > 0 else 1.0)),"kd":a.knockdown})
	for e: BmkActorState in s.enemies:
		var key: String = "%d:%d" % [phase, e.id]
		if not can_hit(e) or p.skill_hits.has(key) or blocked and s.is_sovereign(e):
			continue
		var dx: float = (e.x - p.x) * p.face
		if dx > -a.behind - e.hw and dx < a.reach + e.hw and absf(e.y - p.y) < 38.0 and absf(e.z - p.z) < 85.0:
			p.skill_hits[key] = true
			damage_enemy(s, e, s.js_round(a.damage * (1.5 if p.buff > 0 else 1.0)), a.knockdown, a.effect, false, "skill")
			p.sp = minf(100.0, p.sp + (9.0 if a.knockdown else 5.0))

func enemy_collision(s: BmkSimulation, e: BmkActorState) -> void:
	if not e.bump_active or not (e.st == "hurt" or e.st == "down" and e.z > 0.0) or absf(e.vx) < s.data.bump_min:
		return
	for other: BmkActorState in s.enemies:
		if other == e or e.bump_set.has(other.id) or other.st in ["dead", "down", "enter", "grabbing"] or other.invulnerable:
			continue
		if absf(e.x - other.x) >= s.data.bump_dx or absf(e.y - other.y) >= s.data.bump_dy:
			continue
		e.bump_set[other.id] = true
		var direction: int = int(signf(e.vx)) if e.vx != 0.0 else 1
		damage_enemy(s, other, maxi(1, s.js_round((e.bump_damage if e.bump_damage != 0.0 else 1.0) * s.data.bump_damage)), false, 1, false, "bump")
		if other.st == "hurt":
			other.vx = direction * other.d.knockback * s.data.bump_knockback
		s.sound("hit")
