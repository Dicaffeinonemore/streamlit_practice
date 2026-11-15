extends SceneTree

func _initialize() -> void:
	var data: BmkStageData = BmkStageData.new()
	data.source = BmkSourceJson.combat_source("res://phase3/fixtures")
	data.combat = (load("res://phase2/generated/combat.res") as BmkCombatData).duplicate(true) as BmkCombatData
	for id: String in ["heavy","molotov","hound","boss1"]:
		var raw: Dictionary = data.source["ET_BOSS"] if id == "boss1" else data.source["STAGE1_ET"][id]
		var stats: BmkEnemyStats = BmkEnemyStats.new()
		stats.id = id
		for pair: Array in [["hp","hp"],["spd","speed"],["dmg","damage"],["range","reach"],["kb","knockback"],["score","score"],["h","height"],["hw","half_width"]]:
			stats.set(str(pair[1]),raw.get(pair[0],0))
		data.combat.enemy_stats.append(stats)
	for clip: String in data.source["S1_MOVES"]["heavy"]:
		var move: BmkEnemyMove = BmkEnemyMove.new()
		var raw: Dictionary = data.source["S1_MOVES"]["heavy"][clip]
		move.species = "heavy"
		move.clip = clip
		move.lengths = PackedInt32Array(raw["len"])
		move.warning_frames = int(raw["warnTo"])
		data.combat.enemy_moves.append(move)
	DirAccess.make_dir_recursive_absolute("res://phase3/generated")
	var result: Error = ResourceSaver.save(data,"res://phase3/generated/stage.res")
	print("STAGE DATA: status %d" % result)
	quit(0 if result == OK else 1)
