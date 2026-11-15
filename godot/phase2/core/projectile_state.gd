class_name BmkProjectileState
extends RefCounted
var x: float = 0.0
var y: float = 0.0
var height: float = 44.0
var direction: int = 1
var age: float = 0.0
var travel: float = 0.0
var damage: float = 0.0
var dead: bool = false
var hits: Dictionary[int, bool] = {}
