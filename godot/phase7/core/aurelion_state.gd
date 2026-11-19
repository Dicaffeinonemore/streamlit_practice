class_name BmkAurelionState
extends RefCounted
## aurelionData(e) in aurelion-runtime.js.
var cooldowns: Dictionary[String, int] = {}
var pressure: int = 0
var force_guard: bool = false
var last_move: String = ""
var repeats: int = 0
var halo: bool = false
var move: String = ""
var guard: String = ""
var timeline: Array = []
var cursor: int = 0
var processed: int = 0
var current: Dictionary = {}
var hit_instances: Dictionary[int, bool] = {}
var token: int = 0
var whirl_landed: bool = false
var marks: Array[PackedFloat64Array] = []
var taunt_pending: bool = false
var locomotion: String = ""
var locomotion_ticks: int = 0
var turn_ticks: int = 0
var transition_age: int = 0
var intro_frame: int = -1
