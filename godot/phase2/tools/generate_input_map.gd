extends SceneTree

func _initialize() -> void:
	var router: BmkPhysicalInput = BmkPhysicalInput.new()
	router.configure("arcade")
	var settings: ConfigFile = ConfigFile.new()
	var result: Error = settings.load("res://project.godot")
	if result == OK:
		for action: String in router.ACTIONS:
			var id: String = "bmk_" + action
			settings.set_value("input",id,{"deadzone":0.2,"events":InputMap.action_get_events(id)})
		result = settings.save("res://project.godot")
	print("INPUT MAP: %d source arcade actions, status %d" % [router.ACTIONS.size(),result])
	quit(0 if result == OK else 1)
