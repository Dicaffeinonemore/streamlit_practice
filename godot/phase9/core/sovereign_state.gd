class_name BmkSovereignState
extends RefCounted
## sovData(e) in sovereign-runtime.js: the body's scheduler state, two fists, running jobs,
## floor marks, ground waves and visual effects. Nullable source fields use null.
var now: int = 0
var jobs: Array[Job] = []
var cooldowns: Dictionary[String, int] = {}
var marks: Array[Mark] = []
var waves: Array[Wave] = []
var fx: Array[Fx] = []
var pressure: int = 0
var pressure_t: int = 0
var force_backhand: bool = false
var last_move: String = ""
var repeats: int = 0
var last_danger_end: int = -999
var danger_was: bool = false
## {id, until} or empty.
var pending: Dictionary = {}
var grounded: bool = false
var body: Body
var down_at: int = 0
var trans_age: int = 0
var fists: Array[Fist] = []
var ultimate_used: bool = false
var dead: bool = false
var remains: bool = false
## Visual only (sovCaptureAfterimages): the body's ghost trail.
var afterimages: Array[Ghost] = []
var trail_sample: Ghost

class Fist:
	extends RefCounted
	var i: int = 0
	var x: float = 0.0
	var y: float = 0.0
	var h: float = 420.0
	var face: int = 1
	var st: String = "intro"
	var hp: float = 0.0
	var max_hp: float = 0.0
	var pose: int = 1
	var angle: float = 0.0
	## "" = null, "white" or "red".
	var glow: String = ""
	var trail: bool = false
	var timer: int = 0
	var wake: float = 1.0
	var flash: int = 0
	var vh: float = 0.0
	var broken: bool = false
	var job: Job
	var afterimages: Array[Ghost] = []
	var trail_sample: Ghost

class Job:
	extends RefCounted
	var id: String = ""
	var t: int = 0
	var st: int = 0
	var stage: String = ""
	var fists: Array[Fist] = []
	var hits: Dictionary[String, bool] = {}
	var danger: bool = false
	var danger_done: bool = false
	var warn: bool = false
	var done: bool = false
	var p2: int = 0
	var helper: Fist
	var lane: Variant = null
	var dir: Variant = null
	var travel: Variant = null
	var k: Variant = null
	var side: Variant = null
	var cx: Variant = null
	var tx: Variant = null
	var start: Variant = null
	var mark: Mark
	## Meteor marks (null until the rain starts).
	var marks: Variant = null
	var remaining: Variant = null
	var spawned: Variant = null
	var elapsed_ms: Variant = null
	var last_y: Variant = null
	## Ultimate cannon hands (null for other jobs).
	var hands: Variant = null

class Mark:
	extends RefCounted
	var job: Job
	var x: float = 0.0
	var y: float = 0.0
	var rx: float = 0.0
	var ry: float = 0.0
	var blink: bool = false
	var at: int = 0
	var k: Variant = null
	var fist: Fist
	var done: bool = false

class Wave:
	extends RefCounted
	var job: Job
	var x: float = 0.0
	var dir: int = 1
	var age: int = 0
	var hit: bool = false
	var dead: bool = false

class Fx:
	extends RefCounted
	var id: String = ""
	var x: float = 0.0
	var y: float = 0.0
	var h: float = 0.0
	var w: float = 0.0
	var hgt: float = 0.0
	var life: int = 0
	var age: int = 0
	var face: int = 1
	var ground: bool = false

class Hand:
	extends RefCounted
	var x: float = 0.0
	var y: float = 0.0
	var dir: int = 1
	var age_ms: float = 0.0
	var fired: bool = false
	var hit: bool = false

class Body:
	extends RefCounted
	var job: Job
	var clip: String = ""
	var from: int = 1
	var to: int = 16
	var ticks: int = 24
	var t: int = 0
	var bound: bool = false
	## null, or the drawing forced by the beam job.
	var drawing: Variant = null
	var idle: bool = false

## A ghost of the body or a fist: [clip, drawing] or a fist frame, sampled on simulation ticks.
class Ghost:
	extends RefCounted
	var clip: String = ""
	var drawing: int = 1
	var x: float = 0.0
	var y: float = 0.0
	var face: int = 1
	var angle: float = 0.0
	var at: int = 0
