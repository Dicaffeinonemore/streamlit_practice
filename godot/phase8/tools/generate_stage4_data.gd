extends SceneTree

func _initialize() -> void:
	var data: BmkWaveData = BmkWaveData.new()
	data.source = BmkSourceJson.combat_source("res://phase8/fixtures")
	DirAccess.make_dir_recursive_absolute("res://phase8/generated")
	var result: Error = ResourceSaver.save(data,BmkWaveData.PATHS[3])
	print("STAGE 4 DATA: %d Vargul moves, status %d" % [(data.source["VARGUL"]["TIMELINES"][0] as Dictionary).size(),result])
	quit(0 if result == OK else 1)
