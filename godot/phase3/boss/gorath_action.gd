class_name BmkGorathAction
extends RefCounted
var kind: String = "move"
var id: String = ""
var t: int = 0
var f: int = 1
var used: Dictionary[String, bool] = {}
var linked: bool = false
var thrown: bool = false
var miss: bool = false
var phase: String = "cast"
var pulls: int = 0
var step: int = -1

