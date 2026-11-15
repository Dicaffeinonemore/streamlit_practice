class_name BmkGorathState
extends RefCounted
var phase: int = 1
var st: String = "chase"
var clip: String = "p1_idle"
var fi: int = 0
var act: BmkGorathAction
var hook: BmkGorathHook
var grabbing: bool = false
var meats: Array[BmkMeatState] = []
var last: String = ""
var want: String = ""
var want_t: int = 0
var ult: Array[bool] = [false,false]
var ult_queue: int = 0
var breath: int = 0
var tail: int = 0
var age: int = 0
var walk_t: float = 0.0
var jitter: float = 0.0
var bar_blink: int = 0
var guard: bool = false
var pending_t: bool = false
var card_t: int = 0
var intro_i: int = -1
var dark: float = 0.0
var block_t: int = -99

