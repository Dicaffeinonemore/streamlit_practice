class_name BmkCheckpoint
extends Resource
@export var version: int = 1
@export var character_id: String = "barel"
@export var stage: int = 0
@export var score: int = 0
@export var hp: int = 100
@export var lives: int = 3
@export var sp: int = 0
@export var mg: int = 0
@export var buff: int = 0

static func decode(value: Variant) -> BmkCheckpoint:
	if value is not Dictionary: return null
	var data: Dictionary = value
	if data.get("version") != 1 or data.get("characterId", "barel") not in ["barel", "viesa"]: return null
	var character: String = str(data.get("characterId", "barel"))
	var limits: Dictionary = {"stage":[0,4],"score":[0,1000000000],"hp":[1,80 if character == "viesa" else 100],"lives":[1,3],"sp":[0,100],"mg":[0,3],"buff":[0,900]}
	for key: String in limits:
		var number: Variant = data.get(key)
		if number is not int and number is not float: return null
		if not is_finite(float(number)) or float(number) != floor(float(number)) or float(number) < limits[key][0] or float(number) > limits[key][1]: return null
	var result: BmkCheckpoint = BmkCheckpoint.new()
	result.character_id = character
	for key: String in limits: result.set(key,int(data[key]))
	return result

func encode() -> Dictionary:
	return {"version":version,"characterId":character_id,"stage":stage,"score":score,"hp":hp,"lives":lives,"sp":sp,"mg":mg,"buff":buff}
