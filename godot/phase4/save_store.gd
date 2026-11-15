class_name BmkSaveStore
extends RefCounted
const CHECKPOINT_PATH: String = "user://bmk_checkpoint.json"
const RECORDS_PATH: String = "user://bmk_records.json"
var checkpoint_path: String = CHECKPOINT_PATH
var records_path: String = RECORDS_PATH

func read_json(path: String) -> Variant:
	if not FileAccess.file_exists(path): return null
	return JSON.parse_string(FileAccess.get_file_as_string(path))

func write_json(path: String, value: Variant) -> Error:
	var file: FileAccess = FileAccess.open(path,FileAccess.WRITE)
	if file == null: return FileAccess.get_open_error()
	file.store_string(JSON.stringify(value))
	return file.get_error()

func checkpoint() -> BmkCheckpoint:
	return BmkCheckpoint.decode(read_json(checkpoint_path))

func save_checkpoint(value: BmkCheckpoint) -> Error:
	return write_json(checkpoint_path,value.encode() if value != null else null)

func records() -> Dictionary:
	var raw: Variant = read_json(records_path)
	if raw is not Dictionary or raw.get("bestScore") is not float and raw.get("bestScore") is not int or raw.get("stages") is not Array: return {"bestScore":0,"stages":[]}
	var score: float = float(raw["bestScore"])
	if not is_finite(score) or score < 0 or score > 1000000000: return {"bestScore":0,"stages":[]}
	var stages: Array = []
	for entry: Variant in (raw["stages"] as Array).slice(0,5):
		if entry is Dictionary and entry.get("rank") in ["S","A","B","C"] and (entry.get("seconds") is float or entry.get("seconds") is int) and is_finite(float(entry["seconds"])) and float(entry["seconds"]) >= 0 and float(entry["seconds"]) <= 10000000:
			stages.append({"rank":entry["rank"],"seconds":entry["seconds"]})
		else: stages.append(null)
	return {"bestScore":score,"stages":stages}

func record(stage: int, score: int, rank: String, seconds: int) -> Error:
	if stage < 0 or stage > 4 or score < 0 or score > 1000000000 or rank not in ["S","A","B","C"] or seconds < 0 or seconds > 10000000: return ERR_INVALID_PARAMETER
	var result: Dictionary = records()
	var stages: Array = result["stages"]
	while stages.size() <= stage: stages.append(null)
	var old: Variant = stages[stage]
	var order: Array[String] = ["S","A","B","C"]
	if old == null or order.find(rank) < order.find(str(old["rank"])) or rank == old["rank"] and seconds < float(old["seconds"]): stages[stage] = {"rank":rank,"seconds":seconds}
	result["bestScore"] = maxi(int(result["bestScore"]),score)
	return write_json(records_path,result)
