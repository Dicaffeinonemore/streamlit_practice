extends GutTest
const DATA_PATH: String = "res://phase2/generated/combat.res"
var mismatch_count: int = 0
var comparisons: int = 0
var mismatch_lines: Array[String] = []
var source_catalogs: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://port_assets/catalogs/source_catalogs.json")) as Dictionary
var selector: BmkFrameSelector = BmkFrameSelector.new(source_catalogs["barel_timelines"])

func apply_player(p: BmkActorState, values: Dictionary) -> void:
	for key: String in values:
		p.set(key, values[key])

func setup_scenario(scenario: Dictionary) -> BmkSimulation:
	var s: BmkSimulation = BmkSimulation.new(load(DATA_PATH) as BmkCombatData)
	s.fixed_random = true
	apply_player(s.player, scenario.get("player", {}))
	for spec: Dictionary in scenario["enemies"]:
		var e: BmkActorState = s.spawn(str(spec["kind"]), float(spec["x"]), float(spec["y"]))
		e.hp = float(spec.get("hp", e.d.hp))
		e.max_hp = e.hp
		e.training = bool(spec.get("training", false))
	return s

func commands(s: BmkSimulation, scenario: Dictionary, frame: int) -> void:
	for ev: Dictionary in scenario["events"]:
		if int(ev["frame"]) == frame:
			if bool(ev["down"]):
				s.input.press(str(ev["key"]), s.tick)
			else:
				s.input.release(str(ev["key"]))
	for c: Dictionary in scenario.get("commands", []):
		if int(c["frame"]) != frame:
			continue
		match str(c["op"]):
			"damage_enemy":
				s.combat.damage_enemy(s, s.enemies[int(c["index"])], float(c["damage"]), bool(c["kd"]), int(c["kind"]), false, str(c["attack"]))
			"hurt_player":
				s.combat.hurt_player(s, float(c["damage"]), int(c["dir"]), bool(c["kd"]), float(c.get("height", -1.0)))
			"enemy_move":
				s.enemy_controller.begin_move(s, s.enemies[int(c["index"])], str(c["clip"]))

func snapshot(s: BmkSimulation) -> Dictionary:
	var p: BmkActorState = s.player
	var player: Dictionary = {"x":p.x,"y":p.y,"z":p.z,"vx":p.vx,"vz":p.vz,"face":p.face,"hp":p.hp,"lives":p.lives,"st":p.st,"t":p.t,"atk":p.atk,"combo":p.combo,"comboT":p.combo_t,"buf":p.buf,"x0":p.x0,"inv":p.inv,"flash":p.flash,"buff":p.buff,"score":p.score,"walk":p.walk,"walkTime":p.walk_time,"sp":p.sp,"dashCd":p.dash_cd,"dashGrace":p.dash_grace,"mg":p.mg,"castFired":p.cast_fired,"skill":p.skill,"skillDest":p.skill_dest,"hurtKind":p.hurt_kind,"hurtDuration":p.hurt_duration,"spX":p.sp_x,"spY":p.sp_y,"spX0":p.sp_x0,"spY0":p.sp_y0,"spHits":p.sp_hits,"spFin":p.sp_fin,"spDash":p.sp_dash,"dashAttackHit":p.dash_attack_hit,"dashFlash":p.dash_flash}
	var enemies: Array[Dictionary] = []
	for e: BmkActorState in s.enemies:
		enemies.append({"id":e.id,"s1":e.species,"x":e.x,"y":e.y,"z":e.z,"vx":e.vx,"vz":e.vz,"face":e.face,"hp":e.hp,"st":e.st,"t":e.t,"inv":e.inv,"flash":e.flash,"wait":e.wait,"atkCd":e.attack_cd,"walk":e.walk,"recT":e.recovery_t,"hurtT":e.hurt_t,"chainN":e.chain_n,"hitLow":e.hit_low,"redFlash":e.red_flash,"getup":e.getup,"pat":e.pat,"remove":e.remove,"mv":{"clip":e.mv.clip,"t":e.mv_t,"f":e.mv_f,"hit":e.mv_hit} if e.mv != null else null})
	var hazards: Array[Dictionary] = []
	for z: BmkProjectileState in s.hazards:
		hazards.append({"x":z.x,"y":z.y,"h":z.height,"age":z.age,"travel":z.travel,"damage":z.damage,"dead":z.dead})
	var poses: Array[Dictionary] = []
	for e: BmkActorState in s.enemies:
		poses.append(selector.enemy(s,e,source_catalogs["STAGE1_ENEMY_ART"][e.species]))
	return {"tick":s.tick,"hitStop":s.hit_stop,"shake":s.shake,"flashT":s.flash_t,"chain":{"n":s.chain_n,"t":s.chain_t,"max":s.chain_max},"stat":{"ticks":s.stat_ticks,"damage":s.stat_damage,"deaths":s.stat_deaths,"kills":s.stat_kills},"pressed":s.input.pressed.duplicate(),"player":player,"skillCd":p.skill_cd.duplicate(),"enemies":enemies,"hazards":hazards,"pose":{"player":selector.player(s),"enemies":poses}}

func compare_value(actual: Variant, expected: Variant, path: String) -> void:
	comparisons += 1
	if expected is Dictionary and actual is Dictionary:
		if actual.size() != expected.size():
			mismatch(path + " dictionary size", actual.size(), expected.size())
		for key: String in expected:
			compare_value(actual.get(key), expected[key], path + "." + key)
	elif expected is Array and actual is Array:
		if actual.size() != expected.size():
			mismatch(path + " array size", actual.size(), expected.size())
		for i: int in range(mini(actual.size(), expected.size())):
			compare_value(actual[i], expected[i], path + "[%d]" % i)
	elif expected == null:
		# JS undefined/null optional state fields use these falsy defaults in native state.
		var empty: bool = actual == null
		if actual is bool:
			empty = not actual
		elif actual is int or actual is float:
			empty = float(actual) == 0.0
		elif actual is String:
			empty = actual.is_empty()
		if not empty:
			mismatch(path, actual, expected)
	elif (expected is float or expected is int) and (actual is float or actual is int):
		if absf(float(actual) - float(expected)) > 0.0000001:
			mismatch(path, actual, expected)
	elif actual != expected:
		mismatch(path, actual, expected)

func mismatch(path: String, actual: Variant, expected: Variant) -> void:
	mismatch_count += 1
	if mismatch_lines.size() < 60:
		mismatch_lines.append("%s: native=%s source=%s" % [path,str(actual),str(expected)])

