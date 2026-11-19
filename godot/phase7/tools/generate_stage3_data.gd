extends SceneTree

func _initialize() -> void:
	var data: BmkWaveData = BmkWaveData.new()
	data.source = BmkSourceJson.combat_source("res://phase7/fixtures")
	DirAccess.make_dir_recursive_absolute("res://phase7/generated")
	var result: Error = ResourceSaver.save(data,BmkWaveData.PATHS[2])
	print("STAGE 3 DATA: %d Aurelion clips, status %d" % [(data.source["AURELION"]["timing"] as Dictionary).size(),result])
	quit(0 if result == OK else 1)
