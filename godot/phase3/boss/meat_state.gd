class_name BmkMeatState
extends RefCounted
var kind: String = ""
var x: float = 0.0
var y: float = 0.0
var t: int = 0
var start: int = 0
var land: int = 0
var n: int = 0
var spin: int = 1

func frame() -> Dictionary:
	var s: int = t - start
	var pre: int = (land - 1) * 3
	if s < 0:
		return {"sky":true,"u":float(t) / start}
	if s < pre:
		return {"fi":int(floor(s / 3.0)),"alpha":1.0}
	var last_at: int = pre + (n - land) * 4
	return {"fi":mini(n - 1,land - 1 + int(floor((s - pre) / 4.0))),"alpha":clampf(1.0 - (s - last_at - 90) / 30.0,0,1),"dead":s > last_at + 120}

