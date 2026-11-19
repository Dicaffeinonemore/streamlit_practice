extends SceneTree

func _initialize() -> void:
	var data: BmkWaveData = BmkWaveData.new()
	data.source = BmkSourceJson.combat_source("res://phase9/fixtures")
	DirAccess.make_dir_recursive_absolute("res://phase9/generated")
	var result: Error = ResourceSaver.save(data,BmkWaveData.PATHS[4])
	print("STAGE 5 DATA: %d Sovereign attacks, status %d" % [(data.source["SOVEREIGN"]["ATTACKS"] as Array).size(),result])
	quit(0 if result == OK else 1)
