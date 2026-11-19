extends SceneTree

func _initialize() -> void:
	var data: BmkViesaData = BmkViesaData.new()
	data.source = BmkSourceJson.combat_source("res://phase5/fixtures")
	DirAccess.make_dir_recursive_absolute("res://phase5/generated")
	var result: Error = ResourceSaver.save(data,BmkViesaData.PATH)
	print("VIESA DATA: %d clips, status %d" % [(data.source["VIESA"]["clips"] as Dictionary).size(),result])
	quit(0 if result == OK else 1)
