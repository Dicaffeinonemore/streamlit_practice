class_name BmkVargulState
extends RefCounted
## vargulData(e) in vargul-runtime.js (telemetry fields omitted).
var cooldowns: Dictionary[String, int] = {}
var pressure: int = 0
var force_sweep: bool = false
var repeats: int = 0
var last_move: String = ""
var token: int = 0
var move: String = ""
var timeline: Array = []
var timeline_key: String = ""
var cursor: int = 0
var processed: int = 0
var current: Dictionary = {}
var hit_ids: Dictionary[String, bool] = {}
var travel: float = 0.0
var locked_y: float = 0.0
var locked: bool = false
var ultimate: BmkLegacyHazard
var ultimate_used: bool = false
var had_orbs: bool = false
var transition_age: int = 0
var phase_banner: int = 0
var locomotion: String = ""
var locomotion_ticks: int = 0
var sweep_face: int = 0
var intro_break: bool = false
var remains: bool = false
