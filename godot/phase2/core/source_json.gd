class_name BmkSourceJson
extends RefCounted
## Preserve JS IEEE-754 values at the import boundary, including floor boundaries.
static func combat_source(folder: String = "res://phase2/fixtures") -> Dictionary:
	var source: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(folder + "/source_data.json")) as Dictionary
	var numbers: Array = JSON.parse_string(FileAccess.get_file_as_string(folder + "/source_numbers.json")) as Array
	for entry: Dictionary in numbers:
		var path: Array = entry["path"]
		var container: Variant = source
		for i: int in range(path.size() - 1):
			container = container[int(path[i])] if container is Array else container[str(path[i])]
		var key: Variant = int(path[-1]) if container is Array else str(path[-1])
		container[key] = str(entry["bits"]).hex_decode().decode_double(0)
	return source
