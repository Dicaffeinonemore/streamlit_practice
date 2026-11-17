extends SceneTree
const CHECKPOINT: String = "res://phase4/restart_test_checkpoint.json"
const RECORDS: String = "res://phase4/restart_test_records.json"
const SETTINGS: String = "res://phase4/restart_test_settings.json"

func _initialize() -> void:
	var store: BmkSaveStore = BmkSaveStore.new()
	store.checkpoint_path = CHECKPOINT
	store.records_path = RECORDS
	var failures: int = 0
	if "--write" in OS.get_cmdline_user_args():
		var entry: BmkCheckpoint = BmkCheckpoint.new()
		entry.hp = 71
		entry.score = 12345
		if store.save_checkpoint(entry) != OK: failures += 1
		if store.record(0,12345,"A",87) != OK: failures += 1
		var options: BmkSettings = BmkSettings.new()
		options.use_preset("arcade")
		if not options.bind("KeyA",KEY_F): failures += 1
		options.music_volume = 0.4
		if options.save(SETTINGS) != OK: failures += 1
	else:
		var entry: BmkCheckpoint = store.checkpoint()
		if entry == null or entry.hp != 71 or entry.score != 12345: failures += 1
		var records: Dictionary = store.records()
		if records["bestScore"] != 12345 or records["stages"][0]["rank"] != "A": failures += 1
		var options: BmkSettings = BmkSettings.read(SETTINGS)
		if options.preset != "custom" or options.bindings.get("KeyA") != KEY_F or not is_equal_approx(options.music_volume,0.4): failures += 1
		for path: String in [CHECKPOINT,RECORDS,SETTINGS]: DirAccess.remove_absolute(ProjectSettings.globalize_path(path))
	print("RESTART %s: %d failures" % ["WRITE" if "--write" in OS.get_cmdline_user_args() else "READ",failures])
	quit(0 if failures == 0 else 1)
