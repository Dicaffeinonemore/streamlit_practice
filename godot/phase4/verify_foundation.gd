extends SceneTree

func _initialize() -> void:
	var failures: int = 0
	for sample: Array in [[0,0,0,5,"S"],[0,0,0,0,"A"],[300,0,1,0,"B"],[300,0,2,20,"C"]]:
		if BmkRankCalculator.calculate(sample[0],sample[1],sample[2],sample[3]) != sample[4]: failures += 1
	var valid: Dictionary = {"version":1,"stage":0,"score":0,"hp":100,"lives":3,"sp":0,"mg":0,"buff":0}
	var checkpoint: BmkCheckpoint = BmkCheckpoint.decode(valid)
	if checkpoint == null or checkpoint.character_id != "barel": failures += 1
	valid["hp"] = 101
	if BmkCheckpoint.decode(valid) != null: failures += 1
	valid["hp"] = 99.5
	if BmkCheckpoint.decode(valid) != null: failures += 1
	var store: BmkSaveStore = BmkSaveStore.new()
	store.checkpoint_path = "user://phase4_test_checkpoint.json"
	store.records_path = "user://phase4_test_records.json"
	if store.save_checkpoint(checkpoint) != OK or store.checkpoint() == null: failures += 1
	store.write_json(store.records_path,{"bestScore":0,"stages":[]})
	store.record(0,1000,"B",90)
	store.record(0,500,"A",120)
	store.record(0,700,"A",100)
	var records: Dictionary = store.records()
	if records["bestScore"] != 1000 or records["stages"][0]["rank"] != "A" or records["stages"][0]["seconds"] != 100: failures += 1
	DirAccess.remove_absolute(ProjectSettings.globalize_path(store.checkpoint_path))
	DirAccess.remove_absolute(ProjectSettings.globalize_path(store.records_path))
	print("PHASE 4 FOUNDATION: %d failures" % failures)
	quit(0 if failures == 0 else 1)
