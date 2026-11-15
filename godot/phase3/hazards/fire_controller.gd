class_name BmkFireController
extends RefCounted

func step(s: BmkStageSimulation) -> void:
	var i: int = 0
	# Original for-of visits fire appended when a bottle lands in this update.
	while i < s.fire_hazards.size():
		var z: BmkFireHazard = s.fire_hazards[i]
		i += 1
		z.age += s.MS
		match z.type:
			"firemark":
				if z.age > z.life: z.dead = true
			"molotov":
				var u: float = clampf(z.age / z.duration,0,1)
				z.x = lerpf(z.x0,z.tx,u)
				z.y = lerpf(z.y0,z.ty,u)
				z.h = lerpf(z.h0,0,u) + sin(PI * u) * z.arc
				if u >= 1:
					z.dead = true
					s.sound("barrel")
					s.shake = maxf(s.shake,3)
					spawn_fire(s,z.tx,z.ty)
			"fire":
				if z.age > 150 * s.MS:
					z.dead = true
					continue
				var scale_: float = z.scale_at(s.MS)
				if s.player.z <= 0 and s.player.st != "dead" and inside(z,s.player,scale_) and s.tick - z.hits.get(0,-99) >= 20:
					z.hits[0] = s.tick
					burn_player(s,3)
				for actor: BmkActorState in s.enemies:
					var e: BmkStageActor = actor as BmkStageActor
					if e.boss or e.st == "dead" or e.z > 0 or e.invulnerable or not inside(z,e,scale_) or s.tick - z.hits.get(e.id,-99) < 20: continue
					z.hits[e.id] = s.tick
					e.hp -= 3
					e.flash = 4
					if e.hp <= 0:
						e.hp = 0
						e.st = "dead"
						e.t = 0
						e.pat = ""
						e.vz = 4
						e.vx = 0
						s.player.score += e.d.score
						s.item_controller.enemy_drop(s,e)
						s.sound("mobdie")
	s.fire_hazards = s.fire_hazards.filter(func(z: BmkFireHazard) -> bool: return not z.dead)

func inside(z: BmkFireHazard, actor: BmkActorState, scale_: float) -> bool:
	return pow((actor.x - z.x) / (70 * scale_),2) + pow((actor.y - z.y) / (22 * scale_),2) <= 1

func spawn_fire(s: BmkStageSimulation, x: float, y: float) -> void:
	var live: Array[BmkFireHazard] = s.fire_hazards.filter(func(z: BmkFireHazard) -> bool: return z.type == "fire" and not z.dead)
	live.sort_custom(func(a: BmkFireHazard, b: BmkFireHazard) -> bool: return a.age > b.age)
	while live.size() >= 3:
		var old: BmkFireHazard = live.pop_front()
		old.dead = true
	var z: BmkFireHazard = BmkFireHazard.new()
	z.x = x
	z.y = y
	s.fire_hazards.append(z)

func burn_player(s: BmkStageSimulation, damage: float) -> void:
	var p: BmkActorState = s.player
	if p.inv > 0 or p.st in ["dead","special"]: return
	s.stat_damage += minf(p.hp,damage)
	p.hp -= damage
	p.flash = 5
	s.sound("hurt")
	if p.hp <= 0: s.grabs.kill_player(s,0)
