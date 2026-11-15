extends SceneTree
## Import boundary: source JSON becomes typed Resources; runtime never balances itself.

func _initialize() -> void:
	call_deferred("run")

func make_attack(id: String, source: Dictionary) -> BmkAttackData:
	var a: BmkAttackData = BmkAttackData.new()
	a.id = id
	a.label = str(source.get("name", id))
	a.key = str(source.get("key", ""))
	var fields: Dictionary[String, String] = {"windMs":"wind_ms", "actMs":"active_ms", "recMs":"recovery_ms", "durMs":"duration_ms", "damage":"damage", "reachPx":"reach", "behindPx":"behind", "stepPx":"step", "knockdown":"knockdown", "hitstopTicks":"hitstop", "fx":"effect", "cooldownMs":"cooldown_ms", "heightPx":"height", "smashRatio":"smash_ratio"}
	for key: String in fields:
		if source.has(key):
			a.set(fields[key], source[key])
	if source.get("hitstunTicks") != null:
		a.hitstun = int(source["hitstunTicks"])
	if source.has("strikeMs"):
		var strikes: Variant = source["strikeMs"]
		a.strikes = PackedFloat64Array(strikes if strikes is Array else [strikes])
	if source.has("invulnerableMs"):
		a.inv_from = float(source["invulnerableMs"][0])
		a.inv_to = float(source["invulnerableMs"][1])
	if source.has("travelMs"):
		a.travel_from = float(source["travelMs"][0])
		a.travel_to = float(source["travelMs"][1])
	if a.duration_ms == 0.0:
		a.duration_ms = a.wind_ms + a.active_ms + a.recovery_ms
	if source.has("fireMs"):
		a.strikes = PackedFloat64Array([float(source["fireMs"])])
	return a

func run() -> void:
	var s: Dictionary = BmkSourceJson.combat_source()
	var c: Dictionary = s["combat"]
	var p: Dictionary = c["player"]
	var b: Dictionary = c["barel"]
	var result: BmkCombatData = BmkCombatData.new()
	result.source_hash = FileAccess.get_file_as_string("res://phase2/fixtures/source_data.json").sha256_text()
	result.ground_speed = p["move"]["groundPxPerTick"]
	result.air_speed = p["move"]["airPxPerTick"]
	result.depth_ratio = p["move"]["depthRatio"]
	result.jump_velocity = p["jump"]["initialVz"]
	result.gravity = p["jump"]["gravityPerTick"]
	result.buffer_ms = c["input"]["bufferMs"]
	result.link_ms = c["input"]["linkMs"]
	result.active_ratio = b["combo"]["activeStartRatio"]
	result.active_tail = b["combo"]["activeTailMs"]
	result.cancel_ratio = b["combo"]["cancelRatio"]
	result.hurt_ticks = p["hurt"]["defaultHitstunTicks"]
	result.hurt_inv = p["hurt"]["invulnerableTicks"]
	result.hurt_speed = p["hurt"]["knockbackPx"]
	result.hurt_decay = p["hurt"]["knockbackDecay"]
	result.hurt_stop = p["hurt"]["hitstopTicks"]
	result.down_velocity = p["knockdown"]["launchVz"]
	result.down_speed = p["knockdown"]["knockbackPx"]
	result.down_decay = p["knockdown"]["knockbackDecay"]
	result.down_ticks = p["knockdown"]["getupAfterTicks"]
	result.down_inv = p["knockdown"]["getupInvulnerableTicks"]
	result.down_stop = p["knockdown"]["hitstopTicks"]
	result.dash_distance = b["dash"]["distPx"]
	result.dash_duration = b["dash"]["durMs"]
	result.dash_move_ms = b["dash"]["moveMs"]
	result.dash_cancel_ms = b["dash"]["attackCancelMs"]
	result.dash_inv = b["dash"]["invulnerableTicks"]
	result.dash_cd = b["dash"]["cooldownTicks"]
	var da: Dictionary = b["dashAttack"]
	result.dash_attack_ends = PackedInt32Array(da["frameEndTicks"])
	result.dash_attack_from = da["strikeTicks"][0]
	result.dash_attack_to = da["strikeTicks"][1]
	result.dash_attack_cancel = da["cancelTick"]
	result.dash_skill_cancel = da["skillCancelOnHitTick"]
	result.dash_grace = da["graceTicks"]
	result.dash_damage_ratio = da["damageRatioOfC1"]
	result.dash_sp = da["spGain"]
	result.dash_attack_stop = da["hitstopTicks"]
	result.dash_body_height = s["dash_attack"]["bodyHeight"]
	var box: Dictionary = s["dash_attack"]["hitbox"]
	result.dash_box = Rect2(float(box["front"]), float(box["bottom"]), float(box["reach"]) - float(box["front"]), float(box["top"]) - float(box["bottom"]))
	result.dash_depth = box["depth"]
	result.dash_front = box["front"]
	result.dash_reach = box["reach"]
	result.dash_bottom = box["bottom"]
	result.dash_top = box["top"]
	result.dash_tip_height = s["dash_attack"]["bladeTip"][1]
	for segment: Dictionary in da["move"]:
		result.dash_attack_segments.append(PackedFloat64Array([float(segment["fromTick"]), float(segment["toTick"]), float(segment["bodyRatioPerTick"])]))
	result.skill_end_inv = b["skillEndInvulnerableTicks"]
	for id: String in b["combo"]["moves"]:
		result.attacks.append(make_attack(id, b["combo"]["moves"][id]))
	result.attacks.append(make_attack("air", b["air"]))
	for id: String in ["thrust", "slam", "whirl", "leap", "redwave"]:
		result.skills.append(make_attack(id, b["skills"][id]))
	var feel: Dictionary = c["feel"]
	for id: String in feel["tierOrder"]:
		var src: Dictionary = feel["tiers"][id]
		var grade: BmkGradeData = BmkGradeData.new()
		grade.id = id
		grade.rank = result.grades.size()
		grade.hitstop = src["hitstop"]
		grade.stun_bonus = src["stunBonus"]
		grade.knockback_multiplier = src["kbMul"]
		grade.shake = src["shake"]
		grade.flash = src["flash"]
		grade.knockdown = src.get("knockdown", false)
		grade.knockdown_speed = src.get("knockdownVx", 0.0)
		result.grades.append(grade)
	for id: String in feel["tierByAttack"]:
		result.tier_by_attack[id] = feel["tierByAttack"][id]
	result.chain_cap = feel["chainCap"]
	result.knockdown_speed = feel["knockdownVx"]
	result.bump_min = feel["collide"]["minSpeed"]
	result.bump_damage = feel["collide"]["dmgMul"]
	result.bump_knockback = feel["collide"]["kbMul"]
	result.bump_dx = feel["collide"]["dx"]
	result.bump_dy = feel["collide"]["dy"]
	result.enemy_hurt_ticks = c["enemies"]["default"]["hurtTicks"]
	result.enemy_depth = c["enemies"]["hit"]["depthPx"]
	result.enemy_height = c["enemies"]["hit"]["heightPx"]
	result.getup_lengths = PackedInt32Array(s["stage_anim"]["getup"])
	result.after_getup = s["stage_anim"]["afterGetup"]
	for id: String in ["axe", "blade", "club"]:
		var src: Dictionary = s["stage_enemies"][id]
		var stats: BmkEnemyStats = BmkEnemyStats.new()
		stats.id = id
		stats.hp = src["hp"]
		stats.speed = src["spd"]
		stats.damage = src["dmg"]
		stats.reach = src["range"]
		stats.knockback = src["kb"]
		stats.score = src["score"]
		stats.height = src["h"]
		stats.half_width = src["hw"]
		result.enemy_stats.append(stats)
		for clip: String in s["stage_moves"][id]:
			var m: Dictionary = s["stage_moves"][id][clip]
			var move: BmkEnemyMove = BmkEnemyMove.new()
			move.species = id
			move.clip = clip
			move.lengths = PackedInt32Array(m["len"])
			move.warning_frames = m["warnTo"]
			move.next_clip = m.get("next", "")
			if m.has("dash"):
				move.dash_from = m["dash"][0]
				move.dash_to = m["dash"][1]
				move.dash_ratio = m["dash"][2]
			if m.has("armor"):
				move.armor_from = m["armor"][0]
				move.armor_to = m["armor"][1]
			for hit: Dictionary in m.get("hits", []):
				var reach: float = 0.0
				for f: int in range(int(hit["f"][0]), int(hit["f"][1]) + 1):
					var art_index: int = int(s["stage_art"][id]["clips"][clip][f - 1])
					reach = maxf(reach, float(s["stage_art"][id]["frames"][art_index]["tip"][0]))
				move.hit_from.append(int(hit["f"][0]))
				move.hit_to.append(int(hit["f"][1]))
				move.hit_damage.append(floorf(float(hit["dmg"]) * result.attacks[0].damage + 0.5))
				move.hit_reach.append(floorf(reach * float(hit.get("reachMul", 1.0)) * 10.0 + 0.5) / 10.0)
				move.hit_knockdown.append(1 if bool(hit.get("kd", false)) else 0)
			result.enemy_moves.append(move)
	var special: Dictionary = s["special"]
	result.special_duration = special["dur"]
	result.special_slash = special["slash"]
	result.special_finisher = special["fin"]
	result.special_from = special["slashFromMs"]
	result.special_interval = special["slashMs"]
	result.special_hits = PackedFloat64Array(special["slashHitMs"])
	result.special_finish_ms = special["finMs"]
	result.magic_duration = s["magic"]["dur"]
	result.magic_fire = s["magic"]["fire"]
	result.magic_damage = s["magic"]["damage"]
	result.hurt_high_weights = PackedFloat64Array(s["hurt_sequences"]["high"])
	result.hurt_low_weights = PackedFloat64Array(s["hurt_sequences"]["low"])
	DirAccess.make_dir_recursive_absolute("res://phase2/generated")
	var error: Error = ResourceSaver.save(result, "res://phase2/generated/combat.tres")
	if error == OK:
		# Binary resources retain exact doubles; text loading can change one ULP.
		error = ResourceSaver.save(result, "res://phase2/generated/combat.res")
	print("COMBAT DATA: generated from original JS, status %d" % error)
	quit(0 if error == OK else 1)
