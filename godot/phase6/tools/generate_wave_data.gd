extends SceneTree

func _initialize() -> void:
	var data: BmkWaveData = BmkWaveData.new()
	data.source = BmkSourceJson.combat_source("res://phase6/fixtures")
	DirAccess.make_dir_recursive_absolute("res://phase6/generated")
	var result: Error = ResourceSaver.save(data,BmkWaveData.PATH)
	print("STAGE 2 DATA: %d Morgra moves, status %d" % [(data.source["MORGRA_MOVES"] as Dictionary).size(),result])
	quit(0 if result == OK else 1)
