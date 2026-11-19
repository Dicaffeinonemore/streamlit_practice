class_name BmkSovereignController
extends RefCounted
## sovereign-runtime.js line by line: the body scheduler (weighted picks, pending starts, the
## 20-tick gap between hit windows), the two attackable fists, every job, the grab, the ultimate
## cannons, ground waves, the phase transition, death and the intro. State lives in e.sovereign.
const MS: float = 1000.0 / 60.0
var data: BmkWaveData
var R: Dictionary
var fist_hw: float
var fist_hh: float
var fist_len: float
var fist_h: float
var sword_low: float
var sword_high: float
var first_hit: Array
var weight_order: Array
var view_oy: float
var view_vh: float

func _init(source: BmkWaveData) -> void:
	data = source
	var sov: Dictionary = data.source["SOVEREIGN"]
	R = sov["RULES"]
	var f: Dictionary = sov["FIST"]
	fist_hw = float(f["hw"])
	fist_hh = float(f["hh"])
	fist_len = float(f["len"])
	fist_h = float(f["h"])
	sword_low = float(sov["SWORD"][0])
	sword_high = float(sov["SWORD"][1])
	first_hit = sov["FIRST_HIT"]
	weight_order = sov["WEIGHT_ORDER"]
	view_oy = float(data.source["VIEW"]["OY"])
	view_vh = float(data.source["VIEW"]["VH"])

static func is_sovereign(e: BmkActorState) -> bool:
	return e is BmkLegacyActor and (e as BmkLegacyActor).type == "boss5"

func p2(e: BmkLegacyActor) -> int:
	return 1 if e.p2shown else 0

static func sgn(v: float, fallback: int) -> int:
	return int(signf(v)) if v != 0 else fallback

## sovData(e): created on first use, from the body's position at that moment.
func state(e: BmkLegacyActor) -> BmkSovereignState:
	if e.sovereign == null:
		var s: BmkSovereignState = BmkSovereignState.new()
		for i: int in range(2):
			var f: BmkSovereignState.Fist = BmkSovereignState.Fist.new()
			f.i = i
			f.x = e.x
			f.y = e.y
			f.h = 420
			f.face = e.face
			f.hp = float(R["fistHp"][0])
			f.max_hp = f.hp
			s.fists.append(f)
		e.sovereign = s
	return e.sovereign

func clip(e: BmkLegacyActor, name: String) -> String:
	return name + "_p2" if e.p2shown and data.source["SOVEREIGN"]["ART"]["clips"].has(name + "_p2") else name

func rand(s: BmkWaveSimulation, a: float, b: float) -> float:
	return a + s.rnd() * (b - a)

func gap(s: BmkWaveSimulation, e: BmkLegacyActor) -> int:
	var g: Array = R["gaps"][p2(e)]
	return int(R["attackDelay"]) + s.js_round(rand(s,float(g[0]),float(g[1])))

func intro_duration() -> float:
	return float(R["intro"]) * MS

func standing(e: BmkLegacyActor) -> bool:
	return e.st not in ["stun","down","dead"] and e.phase_t == 0

static func active(f: BmkSovereignState.Fist) -> bool:
	return f.st in ["home","job","return"]

static func walling(f: BmkSovereignState.Fist) -> bool:
	return f.job != null and f.job.id == "wall" and f.job.stage != "open"

func home(e: BmkLegacyActor, f: BmkSovereignState.Fist, s: BmkSovereignState) -> Array[float]:
	var spec: Array = R["home"]["back" if f.i != 0 else "front"]
	var bob: float = sin((s.now / float(R["home"]["period"]) + f.i * 0.5) * PI * 2) * float(R["home"]["bob"])
	return [e.x + e.face * float(spec[0]),e.y,float(spec[1]) + bob]

static func move(f: BmkSovereignState.Fist, x: float, y: float, h: float, v: float) -> bool:
	var dx: float = x - f.x
	var dy: float = y - f.y
	var dh: float = h - f.h
	var d: float = BmkViesaController.js_hypot([dx,dy,dh])
	if d <= v:
		f.x = x
		f.y = y
		f.h = h
		return true
	f.x += dx / d * v
	f.y += dy / d * v
	f.h += dh / d * v
	return false

func add_fx(e: BmkLegacyActor, id: String, x: float, y: float, h: float, w: float, hgt: float, life: int, ground: bool = false) -> void:
	var z: BmkSovereignState.Fx = BmkSovereignState.Fx.new()
	z.id = id
	z.x = x
	z.y = y
	z.h = h
	z.w = w
	z.hgt = hgt
	z.life = life
	z.ground = ground
	state(e).fx.append(z)

static func go(job: BmkSovereignState.Job, stage: String) -> void:
	job.stage = stage
	job.st = -1

# ------------------------------------------------------------------ hits on the player
func hurt_scale(s: BmkWaveSimulation) -> float:
	return 0.9 if s.player.is_viesa() else 1.0

func touch(s: BmkWaveSimulation, f: BmkSovereignState.Fist, o: Dictionary = {}) -> bool:
	var p: BmkActorState = s.player
	var hw: float = float(o.get("hw",fist_hw)) + 12 * hurt_scale(s)
	var from: float = float(o.get("fromX",f.x))
	var lo: float = float(o.get("low",f.h - fist_hh))
	var hi: float = float(o.get("high",f.h + fist_hh))
	return p.st != "dead" and p.x >= minf(f.x,from) - hw and p.x <= maxf(f.x,from) + hw and absf(p.y - f.y) < float(o.get("depth",20)) * hurt_scale(s) and p.z <= hi and p.z + s.player_body_height() >= lo

## sovHurt(e, job, key, damage, kd, from, push, hitHeight): from is a fist or the body.
func hurt(s: BmkWaveSimulation, e: BmkLegacyActor, job: BmkSovereignState.Job, key: String, damage: float, kd: bool, from_x: float, from_h: float = -1.0, push: float = 0.0, hit_height: float = -1.0) -> bool:
	if job.hits.has(key): return false
	var p: BmkActorState = s.player
	var dir: int = sgn(p.x - from_x,e.face)
	var height: float = hit_height if hit_height >= 0 else (from_h if from_h >= 0 else -1.0)
	var hit: bool = hurt_player(s,e,damage,dir,kd,height)
	if hit:
		job.hits[key] = true
		if push != 0: p.vx = dir * push
	return hit

func hurt_player(s: BmkWaveSimulation, e: BmkLegacyActor, damage: float, dir: int, kd: bool, height: float = -1.0) -> bool:
	return s.combat.hurt_player(s,damage * s.source_scale(e),dir,kd,height)

func in_mark(s: BmkWaveSimulation, m: BmkSovereignState.Mark) -> bool:
	var p: BmkActorState = s.player
	return pow((p.x - m.x) / m.rx,2) + pow((p.y - m.y) / m.ry,2) <= 1 and p.z < 70

func remove_mark(sd: BmkSovereignState, m: BmkSovereignState.Mark) -> void:
	sd.marks = sd.marks.filter(func(q: BmkSovereignState.Mark) -> bool: return q != m)

func impact(s: BmkWaveSimulation, e: BmkLegacyActor, f: BmkSovereignState.Fist) -> void:
	add_fx(e,"fist_impact",f.x,f.y,10,80,70,18)
	s.shake = maxf(s.shake,12)
	s.sound("slam")

# ------------------------------------------------------------------ the player hits the fists
func fist_key(e: BmkLegacyActor, i: int, prefix: String) -> Variant:
	return -200000 - e.id * 4 - i if prefix.is_empty() else "%sf%d_%d" % [prefix,e.id,i]

## strikeSovereignFists(reach, behind, hitSet, options): true when a fist in front of the body
## (or the iron wall) took the strike, so the body is not hit by it.
func strike_fists(s: BmkWaveSimulation, reach: float, behind: float, hit_set: Dictionary, key_prefix: String, o: Dictionary) -> bool:
	var p: BmkActorState = s.player
	var x: float = float(o.get("x",p.x))
	var y: float = float(o.get("y",p.y))
	var h: float = float(o.get("h",p.z))
	var face: int = int(o.get("face",p.face))
	var depth: float = float(o.get("depth",24))
	var global: bool = bool(o.get("global",false))
	var hit_sound: String = str(o.get("hitSound",""))
	var blocked: bool = false
	for actor: BmkActorState in s.enemies:
		if not is_sovereign(actor): continue
		var e: BmkLegacyActor = actor as BmkLegacyActor
		if e.sovereign == null or e.st == "dead" or e.st == "intro": continue
		var sd: BmkSovereignState = e.sovereign
		for f: BmkSovereignState.Fist in sd.fists:
			if not active(f): continue
			var dx: float = (f.x - x) * face
			var over: bool = global or dx >= -behind - fist_hw and dx <= reach + fist_hw and absf(f.y - y) < depth + 6 and f.h + fist_hh >= h + sword_low and f.h - fist_hh <= h + sword_high
			if not over: continue
			if not global and dx <= (e.x - x) * face: blocked = true
			var key: Variant = fist_key(e,f.i,key_prefix)
			if hit_set.has(key): continue
			hit_set[key] = true
			if walling(f):
				s.hit_sound(0,hit_sound)
				continue
			damage_fist(s,e,f,float(o.get("damage",s.data.attack("c1").damage)),bool(o.get("kd",false)),hit_sound)
			add_pressure(s,e)
		var guarding: bool = false
		for j: BmkSovereignState.Job in sd.jobs:
			if j.id == "wall" and j.stage == "guard": guarding = true
		if not global and guarding and int(signf(x - e.x)) == e.face and absf(e.x - x) < reach + 60 and absf(e.y - y) < depth + 10:
			blocked = true
			var key: Variant = fist_key(e,2,key_prefix)
			if not hit_set.has(key):
				hit_set[key] = true
				s.hit_sound(0,hit_sound)
	return blocked

func damage_fist(s: BmkWaveSimulation, e: BmkLegacyActor, f: BmkSovereignState.Fist, damage: float, kd: bool, hit_sound: String = "") -> void:
	if not active(f): return
	var dmg: int = s.js_round(damage * (float(R["kdFistMul"]) if kd else 1.0))
	f.hp -= dmg
	f.flash = 6
	if dmg > 0: s.sound("hurt")
	s.impact(f.x,f.y,f.h - 12,2 if kd else 1)
	s.hit_stop = maxi(s.hit_stop,5 if kd else 3)
	s.hit_sound(2 if kd else 0,hit_sound)
	if f.hp <= 0: break_fist(s,e,f)

func break_fist(s: BmkWaveSimulation, e: BmkLegacyActor, f: BmkSovereignState.Fist) -> void:
	if f.broken or not active(f): return
	var sd: BmkSovereignState = state(e)
	if f.job != null: end_job(s,e,sd,f.job)
	f.st = "fallen"
	f.broken = true
	f.timer = int(R["fallen"][p2(e)])
	f.vh = 0
	f.glow = ""
	f.trail = false
	f.wake = 0
	f.hp = 0
	add_fx(e,"fist_shatter",f.x,f.y,f.h,100,100,30)
	s.shake = maxf(s.shake,12)
	s.hit_stop = maxi(s.hit_stop,8)
	s.sound("groggy")
	if e.st != "dead" and e.phase_t == 0:
		var roll: float = s.rnd()
		var drops: Dictionary = R["fistDrops"]
		var type: String = "potion" if roll < float(drops["potion"]) else ("scroll" if roll < float(drops["potion"]) + float(drops["scroll"]) else "")
		if not type.is_empty(): s.item_controller.drop(s,type,clampf(f.x,s.cam_x + 20,s.cam_x + s.view_width - 20),clampf(f.y,s.ground_top + 8,s.ground_bottom - 8))
	if e.st == "dead" or e.phase_t > 0 or e.st == "stun": return
	e.gr = minf(e.gr_max,e.gr + float(R["fistGroggy"]))
	e.gr_t = 150
	if e.gr >= e.gr_max or sd.fists.all(func(q: BmkSovereignState.Fist) -> bool: return q.st == "fallen"): stun(s,e,int(data.source["GROGGY_TICKS"]))

func stun(s: BmkWaveSimulation, e: BmkLegacyActor, ticks: int) -> void:
	s.enemy_controller.reset_boss_fx(e,s)
	e.st = "stun"
	e.t = int(data.source["GROGGY_TICKS"]) - ticks
	e.vx = 0
	e.vz = 0
	e.z = 0
	s.shake = maxf(s.shake,16)
	s.sound("groggy")

## sovOpening(): consecutive hits outside an opening make the next action a backhand.
func opening(e: BmkLegacyActor, sd: BmkSovereignState) -> bool:
	if e.st in ["stun","down"]: return true
	for f: BmkSovereignState.Fist in sd.fists:
		if f.st in ["dropped","fallen","rise"] or f.job != null and f.job.stage in ["recover","stuck","stagger","open","dazed"]: return true
	for j: BmkSovereignState.Job in sd.jobs:
		if j.id == "beam" and j.stage == "recovery": return true
	return false

func add_pressure(_s: BmkWaveSimulation, e: BmkLegacyActor) -> void:
	var sd: BmkSovereignState = state(e)
	if opening(e,sd): return
	sd.pressure += 1
	sd.pressure_t = int(R["pressureDecay"])
	if sd.pressure >= int(R["pressure"][p2(e)]): sd.force_backhand = true

## interceptSovereignDamage(e): true means the hit is ignored.
func intercept(s: BmkWaveSimulation, e: BmkLegacyActor) -> bool:
	if e.st == "intro" or e.phase_t > 0 or e.st == "dead": return true
	add_pressure(s,e)
	return false

# ------------------------------------------------------------------ grab (Gorath hook escape rule)
func catch_player(s: BmkWaveSimulation, e: BmkLegacyActor, job: BmkSovereignState.Job) -> bool:
	var p: BmkStageActor = s.player as BmkStageActor
	if p.inv > 0 or p.st in ["dead","down","special","grabbed"] or p.z >= 40: return false
	p.st = "grabbed"
	p.t = 0
	p.grab = BmkGrabState.new()
	p.grab.owner_ref = weakref(e)
	p.grab.kind = "sovereign"
	p.grab.job = job
	p.vx = 0
	p.vz = 0
	p.z = 0
	p.skill = ""
	p.combo = 0
	p.combo_t = 0
	p.buf = 0
	p.walk = false
	s.input.clear()
	s.sound("hit",1)
	s.impact(p.x,p.y,58,1)
	return true

## updateSovereignGrab(): called from the player update while grabbed.
func grab_step(s: BmkWaveSimulation) -> void:
	var p: BmkStageActor = s.player as BmkStageActor
	var g: BmkGrabState = p.grab
	var e: BmkLegacyActor = g.owner as BmkLegacyActor if g != null else null
	var job: BmkSovereignState.Job = g.job as BmkSovereignState.Job if g != null else null
	if g == null or e == null or not s.enemies.has(e) or job.done or not standing(e):
		release_grab(s,"cancel")
		return
	p.t += 1
	p.walk = false
	p.z = 0
	p.vz = 0
	p.vx = 0
	s.input.dash_request = 0
	for code: String in data.source["GORATH_ESCAPE_KEYS"]:
		if s.input.hit([code]): g.presses += 1
	s.input.pressed.clear()
	if g.presses >= int(data.source["GORATH_GRAB"]["presses"]):
		release_grab(s,"escape")
		return
	g.hold += 1
	if g.hold >= float(data.source["GORATH_GRAB"]["hold"]): release_grab(s,"fail")

func release_grab(s: BmkWaveSimulation, result: String) -> void:
	var p: BmkStageActor = s.player as BmkStageActor
	var g: BmkGrabState = p.grab
	if g == null or g.kind != "sovereign": return
	var e: BmkLegacyActor = g.owner as BmkLegacyActor
	var job: BmkSovereignState.Job = g.job as BmkSovereignState.Job
	p.grab = null
	p.st = "free"
	p.t = 0
	p.vx = 0
	p.vz = 0
	s.input.clear()
	if job == null or job.done:
		p.inv = maxi(p.inv,30)
		return
	var gr: Dictionary = R["grab"]
	var f: BmkSovereignState.Fist = job.fists[0]
	var dir: int = sgn(p.x - e.x,e.face)
	var helper: BmkSovereignState.Fist = job.helper
	job.danger = false
	job.danger_done = true
	if result == "escape":
		p.inv = maxi(p.inv,30)
		job.stage = "stagger"
		job.st = 0
		damage_fist(s,e,f,float(gr["escapeDamage"]),false)
	elif result == "fail":
		# Squeeze; the other fist joins with a backhand (allowed exception to the 20-tick rule).
		if helper != null and helper.st == "job":
			p.inv = 0
			hurt_player(s,e,float(gr["backhand"]),dir,false)
			add_fx(e,"fist_impact",p.x,p.y,60,70,70,16)
		p.inv = 0
		hurt_player(s,e,float(gr["squeeze"]),dir,true)
		p.inv = maxi(p.inv,30)
		job.stage = "recover"
		job.st = 0
	else:
		p.inv = maxi(p.inv,30)
		job.stage = "recover"
		job.st = 0
	if helper != null and helper.job == job: finish_fist(helper)
	job.helper = null

# ------------------------------------------------------------------ scheduler
func home_count(sd: BmkSovereignState) -> int:
	var n: int = 0
	for f: BmkSovereignState.Fist in sd.fists:
		if f.st == "home": n += 1
	return n

func available(e: BmkLegacyActor, sd: BmkSovereignState, id: String) -> bool:
	if sd.cooldowns.get(id,0) > 0: return false
	for j: BmkSovereignState.Job in sd.jobs:
		if j.id == id: return false
	if sd.last_move == id and sd.repeats >= 2: return false
	if int(R["fists"][id]) > home_count(sd): return false
	var floor_: Array = R["floor"]
	if id in floor_:
		if not sd.marks.is_empty(): return false
		for j: BmkSovereignState.Job in sd.jobs:
			if j.id in floor_: return false
	if (id == "meteor" or id == "ultimate") and not e.p2shown: return false
	return true

func pick(s: BmkWaveSimulation, e: BmkLegacyActor, sd: BmkSovereignState, adx: float) -> String:
	var phase: int = p2(e)
	if sd.force_backhand and available(e,sd,"backhand"): return "backhand"
	if e.p2shown and e.hp <= e.max_hp * float(R["ultimateAt"]) and not sd.ultimate_used and available(e,sd,"ultimate"): return "ultimate"
	var band: String = "near" if adx < float(R["bands"]["near"]) else ("mid" if adx < float(R["bands"]["mid"]) else "far")
	var weights: Dictionary = R["weights"][phase][band]
	var options: Array = []
	for id: String in weight_order[phase][band]:
		if available(e,sd,id): options.append([id,float(weights[id])])
	if e.p2shown and sd.ultimate_used and available(e,sd,"ultimate"): options.append(["ultimate",float(R["ultimateLater"])])
	if options.is_empty(): return ""
	var total: float = 0
	for o: Array in options: total += float(o[1])
	var r: float = s.rnd() * total
	for o: Array in options:
		r -= float(o[1])
		if r < 0: return str(o[0])
	return str(options[-1][0])

func can_start(e: BmkLegacyActor, sd: BmkSovereignState, id: String) -> bool:
	if sd.jobs.size() >= int(R["maxJobs"][p2(e)]): return false
	for j: BmkSovereignState.Job in sd.jobs:
		if j.danger or not j.danger_done: return false
	var first: float = float(first_hit[p2(e)][id])
	if first < 0: return true
	return sd.now + first - sd.last_danger_end >= float(R["dangerGap"])

func start_job(s: BmkWaveSimulation, e: BmkLegacyActor, sd: BmkSovereignState, id: String) -> void:
	var p: BmkActorState = s.player
	var need: int = int(R["fists"][id])
	var homes: Array[BmkSovereignState.Fist] = []
	for f: BmkSovereignState.Fist in sd.fists:
		if f.st == "home": homes.append(f)
	sd.cooldowns[id] = int(R["cooldowns"][id])
	sd.repeats = sd.repeats + 1 if sd.last_move == id else 1
	sd.last_move = id
	var fists: Array[BmkSovereignState.Fist] = []
	if need == 2: fists = homes.slice(0,2)
	elif need == 1:
		if id == "backhand":
			var best: BmkSovereignState.Fist = homes[0]
			for i: int in range(1,homes.size()):
				if not (absf(best.x - p.x) <= absf(homes[i].x - p.x)): best = homes[i]
			fists.append(best)
		else:
			var first: BmkSovereignState.Fist = homes[0]
			for f: BmkSovereignState.Fist in homes:
				if f.i == 0:
					first = f
					break
			fists.append(first)
	var job: BmkSovereignState.Job = BmkSovereignState.Job.new()
	job.id = id
	job.stage = str(data.source["SOVEREIGN"]["FIRST_STAGE"][id])
	job.fists = fists
	job.danger_done = id == "wall"
	job.p2 = p2(e)
	for f: BmkSovereignState.Fist in fists:
		f.st = "job"
		f.job = job
	if id == "backhand":
		sd.force_backhand = false
		sd.pressure = 0
	if id == "ultimate":
		sd.ultimate_used = true
		var count: Array = R["ultimate"]["count"]
		job.hands = []
		job.remaining = floori(rand(s,float(count[0]),float(count[1]) + 1))
		job.elapsed_ms = 0.0
		job.last_y = null
		job.spawned = 0
		for f: BmkSovereignState.Fist in fists: f.st = "reserve"
	sd.jobs.append(job)
	e.face = 1 if p.x >= e.x else -1
	# command 1-8 pushes the fists forward, 9-16 raises and brings them down.
	var push: bool = id in ["direct","grab","clap","whirl","backhand","wall"]
	var own: bool = id == "beam"
	var b: BmkSovereignState.Body = BmkSovereignState.Body.new()
	b.job = job
	b.clip = clip(e,id if own else "command")
	b.from = 1 if own or push else 9
	b.to = 16 if own else (8 if push else 16)
	b.ticks = int(R["command"])
	b.bound = id in R["bodyBound"]
	sd.body = b
	s.enemy_controller.reset_boss_fx(e,s)
	e.st = "pat"
	e.pat = id
	e.pt = 0
	e.walk = false
	e.attack_cd = gap(s,e)
	s.sound("bwind")

func end_job(s: BmkWaveSimulation, e: BmkLegacyActor, sd: BmkSovereignState, job: BmkSovereignState.Job) -> void:
	if job.done: return
	job.done = true
	job.danger = false
	job.danger_done = true
	for f: BmkSovereignState.Fist in job.fists:
		if f.job == job: finish_fist(f)
	if job.helper != null and job.helper.job == job: finish_fist(job.helper)
	for m: BmkSovereignState.Mark in sd.marks.duplicate():
		if m.job == job: remove_mark(sd,m)
	var p: BmkStageActor = s.player as BmkStageActor
	if p.grab != null and p.grab.kind == "sovereign" and p.grab.job == job: release_grab(s,"cancel")
	sd.jobs = sd.jobs.filter(func(j: BmkSovereignState.Job) -> bool: return j != job)
	if sd.body != null and sd.body.job == job: release_body(s,e)

static func finish_fist(f: BmkSovereignState.Fist) -> void:
	f.st = "return"
	f.job = null
	f.glow = ""
	f.trail = false

func release_body(s: BmkWaveSimulation, e: BmkLegacyActor) -> void:
	var sd: BmkSovereignState = state(e)
	sd.body = null
	if e.st == "pat":
		e.st = "chase"
		e.t = 0
		e.pat = ""
		e.attack_cd = gap(s,e)

## runSovereignPattern(e): the body's command pose; jobs run in update_state().
func run_pattern(s: BmkWaveSimulation, e: BmkLegacyActor) -> void:
	var b: BmkSovereignState.Body = state(e).body
	if b == null:
		release_body(s,e)
		return
	b.t += 1
	if b.t >= b.ticks and b.clip.begins_with("command"):
		if b.bound: b.idle = true
		else: release_body(s,e)

func chase(s: BmkWaveSimulation, e: BmkLegacyActor) -> void:
	var sd: BmkSovereignState = state(e)
	var p: BmkActorState = s.player
	var dx: float = p.x - e.x
	var dy: float = p.y - e.y
	var walk: Array = R["walk"][p2(e)]
	var sx: float = float(walk[0])
	var sy: float = float(walk[1])
	if p.st == "dead": return
	if absf(dx) > 24: e.face = 1 if dx >= 0 else -1
	if e.attack_cd <= 0 and p.st != "down" and p.st != "grabbed":
		var id: String = ""
		if not sd.pending.is_empty() and sd.now < int(sd.pending["until"]) and available(e,sd,str(sd.pending["id"])): id = str(sd.pending["id"])
		else:
			sd.pending = {}
			id = pick(s,e,sd,absf(dx))
		if not id.is_empty():
			if can_start(e,sd,id):
				sd.pending = {}
				start_job(s,e,sd,id)
				return
			if sd.pending.is_empty(): sd.pending = {"id":id,"until":sd.now + int(R["pendingTicks"])}
		e.attack_cd = 6
	var tx: float = p.x - e.face * 95
	e.x += clampf(tx - e.x,-sx,sx)
	e.y += clampf(dy,-sy,sy)
	e.walk = absf(tx - e.x) > 2 or absf(dy) > 2

# ------------------------------------------------------------------ the ultimate (적월마광포)
func cannon_position(s: BmkWaveSimulation, job: BmkSovereignState.Job) -> Dictionary:
	var C: Dictionary = R["ultimate"]
	var p: BmkActorState = s.player
	var k: float = float(C["handScale"])
	var ox: float = float(C["handOrigin"][0])
	var oy: float = float(C["handOrigin"][1])
	var margin: float = float(C["margin"])
	var vw: float = s.view_width
	var half_w: float = 12 * hurt_scale(s)
	var body_h: float = s.player_body_height()
	var top: float = view_oy + margin + oy * k
	var bottom: float = view_oy + view_vh - margin - (217.2 - oy) * k
	var target: float = p.y - p.z - body_h * 0.5
	var best: Dictionary = {}
	var best_score: float = -INF
	for i: int in range(150):
		var dir: int = 1 if s.rnd() < 0.5 else -1
		var lo: float = margin + ox * k if dir == 1 else margin + (362 - ox) * k
		var hi: float = vw - margin - (362 - ox) * k if dir == 1 else vw - margin - ox * k
		var x: float = s.cam_x + (rand(s,lo,vw / 2) if dir == 1 else rand(s,vw / 2,hi))
		var y: float
		if i < 24:
			if int(job.spawned) % 2 == 0: y = clampf(target + rand(s,-18,18),top,bottom)
			else:
				var side: float = -1.0 if s.rnd() < 0.5 else 1.0
				y = clampf(target + side * rand(s,70,140),top,bottom)
		else: y = rand(s,top,bottom)
		var left: float = x + (-ox * k if dir == 1 else -(362 - ox) * k)
		var right: float = x + ((362 - ox) * k if dir == 1 else ox * k)
		var hand_top: float = y - oy * k
		var hand_bottom: float = y + (217.2 - oy) * k
		var overlaps: bool = right > p.x - half_w - 12 and left < p.x + half_w + 12 and hand_bottom > p.y - p.z - body_h - 12 and hand_top < p.y - p.z + 12
		var g: float = INF if job.last_y == null else absf(y - float(job.last_y))
		if not overlaps and g >= float(C["minYGap"]): return {"x":x,"y":y,"dir":dir}
		var score: float = (-10000.0 if overlaps else 0.0) + minf(g,200) + absf(x - p.x) * 0.05
		if score > best_score:
			best_score = score
			best = {"x":x,"y":y,"dir":dir}
	# Deterministic fallback handles unlucky random samples while preserving both constraints.
	var y: float = top
	while y <= bottom:
		for dir: int in [1,-1]:
			var x: float = s.cam_x + (margin + ox * k if dir == 1 else vw - margin - ox * k)
			var left: float = x + (-ox * k if dir == 1 else -(362 - ox) * k)
			var right: float = x + ((362 - ox) * k if dir == 1 else ox * k)
			var overlaps: bool = right > p.x - half_w - 12 and left < p.x + half_w + 12 and y + (217.2 - oy) * k > p.y - p.z - body_h - 12 and y - oy * k < p.y - p.z + 12
			if not overlaps and (job.last_y == null or absf(y - float(job.last_y)) >= float(C["minYGap"])): return {"x":x,"y":y,"dir":dir}
		y += 4
	return best

func cannon_spawn(s: BmkWaveSimulation, job: BmkSovereignState.Job) -> void:
	var position: Dictionary = cannon_position(s,job)
	job.last_y = position["y"]
	job.spawned = int(job.spawned) + 1
	job.remaining = int(job.remaining) - 1
	var h: BmkSovereignState.Hand = BmkSovereignState.Hand.new()
	h.x = float(position["x"])
	h.y = float(position["y"])
	h.dir = int(position["dir"])
	(job.hands as Array).append(h)

func cannon_tick(s: BmkWaveSimulation, e: BmkLegacyActor, sd: BmkSovereignState, job: BmkSovereignState.Job, dt: float) -> void:
	var C: Dictionary = R["ultimate"]
	var fire_at: float = float(C["fadeMs"]) + float(C["telegraphMs"]) + float(C["chargedMs"])
	var laser_ms: float = 20000.0 / float(C["laserFps"])
	if int(job.spawned) == 0: cannon_spawn(s,job)
	job.elapsed_ms = float(job.elapsed_ms) + dt
	job.warn = false
	job.danger = false
	var p: BmkActorState = s.player
	for h: BmkSovereignState.Hand in (job.hands as Array).duplicate():
		var previous: float = h.age_ms
		h.age_ms += dt
		if not h.fired and h.age_ms >= fire_at:
			h.fired = true
			s.sound("bolt")
			s.shake = maxf(s.shake,5)
			if int(job.remaining) > 0: cannon_spawn(s,job)
		if h.age_ms >= float(C["fadeMs"]) and h.age_ms < fire_at: job.warn = true
		var beam_start: float = fire_at + 8000.0 / float(C["laserFps"])
		var beam_end: float = fire_at + 16000.0 / float(C["laserFps"])
		# Interval overlap preserves the active window even if dt spans a frame boundary.
		if h.age_ms >= beam_start and previous < beam_end:
			job.danger = true
			var half: float = float(C["laserThickness"]) / 2
			var hw: float = 12 * hurt_scale(s)
			var within_x: bool = p.x + hw >= h.x and p.x - hw <= s.cam_x + s.view_width if h.dir > 0 else p.x - hw <= h.x and p.x + hw >= s.cam_x
			var player_bottom: float = p.y - p.z
			var player_top: float = player_bottom - s.player_body_height()
			if not h.hit and within_x and player_bottom >= h.y - half and player_top <= h.y + half and hurt_player(s,e,float(C["damage"]),h.dir,false,maxf(0,p.y - h.y)): h.hit = true
	job.hands = (job.hands as Array).filter(func(h: BmkSovereignState.Hand) -> bool: return h.age_ms < fire_at + laser_ms + float(C["fadeMs"]))
	if int(job.remaining) == 0 and (job.hands as Array).is_empty():
		job.danger_done = true
		end_job(s,e,sd,job)

# ------------------------------------------------------------------ patterns
func job_tick(s: BmkWaveSimulation, e: BmkLegacyActor, sd: BmkSovereignState, job: BmkSovereignState.Job) -> void:
	var p: BmkActorState = s.player
	var mul: float = float(R["fistSpeed"][job.p2])
	var rec: int = int(R["recover"][job.p2])
	var a: BmkSovereignState.Fist = job.fists[0] if job.fists.size() > 0 else null
	var b: BmkSovereignState.Fist = job.fists[1] if job.fists.size() > 1 else null
	var st: int = job.st
	job.danger = false
	job.warn = false
	match job.id:
		"direct", "grab":
			var D: Dictionary = R[job.id]
			var grab: bool = job.id == "grab"
			var lock: int = int(D["lock"])
			if job.stage == "wind":
				job.warn = true
				a.pose = 3 if grab else 12
				a.glow = "red" if grab else "white"
				a.face = e.face
				a.angle = 0
				if st == lock:
					job.lane = p.y
					job.dir = sgn(p.x - a.x,e.face)
				a.y += clampf((p.y if st < lock else float(job.lane)) - a.y,-3,3)
				move(a,e.x + e.face * 55,a.y,50.0 if grab else 58.0,4)
				if st >= int(D["wind"]) - 1:
					a.y = float(job.lane)
					job.travel = 0.0
					go(job,"fly")
					s.sound("swing",1 if grab else 2)
			elif job.stage == "fly":
				job.danger = true
				a.pose = 3 if grab else 1
				a.face = int(job.dir)
				a.trail = true
				a.glow = "red" if grab else "white"
				var old: float = a.x
				var edge: bool = a.x <= s.cam_x + 12 or a.x >= s.cam_x + s.view_width - 12
				a.x = clampf(a.x + int(job.dir) * float(D["speed"]) * mul,s.cam_x + 12,s.cam_x + s.view_width - 12)
				job.travel = float(job.travel) + absf(a.x - old)
				if grab:
					if touch(s,a,{"fromX":old}) and catch_player(s,e,job):
						go(job,"hold")
						return
				elif touch(s,a,{"fromX":old}): hurt(s,e,job,"out",float(D["damage"]),true,a.x,a.h)
				if float(job.travel) >= float(D["range"]) or edge or a.x == old:
					if not grab: add_fx(e,"fist_impact",a.x + int(job.dir) * 18,a.y,a.h,50,50,16)
					else: job.danger_done = true
					go(job,"recover")
			elif job.stage == "recover":
				a.trail = false
				a.glow = ""
				a.angle = 0
				if st >= rec - 1:
					if grab: end_job(s,e,sd,job)
					else: go(job,"back")
			elif job.stage == "back":
				job.danger = true
				a.trail = true
				var old: float = a.x
				a.x -= int(job.dir) * float(D["back"]) * mul
				if touch(s,a,{"fromX":old}): hurt(s,e,job,"back",float(D["backDamage"]),false,a.x,a.h)
				if (a.x - e.x) * int(job.dir) <= 40 or st > 150: end_job(s,e,sd,job)
			elif job.stage == "hold":
				job.danger = true
				a.pose = 4
				a.trail = false
				a.glow = "red"
				a.x = p.x - int(job.dir) * 6
				a.y = p.y
				a.h = 52
				a.angle = sin(sd.now * 0.6) * 0.06
				var g: BmkGrabState = (p as BmkStageActor).grab
				var other: BmkSovereignState.Fist = null
				for f: BmkSovereignState.Fist in sd.fists:
					if f != a:
						other = f
						break
				if g != null and job.helper == null and g.hold >= float(data.source["GORATH_GRAB"]["hold"]) - 16 and other != null and other.st == "home":
					job.helper = other
					other.st = "job"
					other.job = job
				if job.helper != null:
					var h: BmkSovereignState.Fist = job.helper
					h.pose = 9
					h.glow = "white"
					h.face = int(job.dir)
					move(h,p.x - int(job.dir) * 30,p.y,60,9)
				if p.st != "grabbed":
					job.danger_done = true
					go(job,"recover")
			elif job.stage == "stagger":
				a.pose = 1
				a.glow = ""
				a.trail = false
				a.angle = sin(st * 0.5) * 0.25
				if st >= int(D["stagger"]) - 1: end_job(s,e,sd,job)
		"slam":
			var S: Dictionary = R["slam"]
			var track: int = int(S["track"][job.p2])
			var lock: int = int(S["lock"][job.p2])
			var height: float = float(S["height"])
			if job.stage == "rise":
				job.warn = true
				a.pose = 2
				a.glow = "white"
				a.angle = 0
				if job.mark == null:
					job.mark = new_mark(job,a.x,clampf(a.y,s.ground_top + 10,s.ground_bottom),float(S["rx"]),float(S["ry"]))
					sd.marks.append(job.mark)
				move(a,job.mark.x,job.mark.y,height,maxf(4,height / float(S["rise"])))
				if st >= int(S["rise"]) - 1: go(job,"track")
			elif job.stage == "track":
				job.warn = true
				var m: BmkSovereignState.Mark = job.mark
				m.x += clampf(p.x - m.x,-float(S["dx"]),float(S["dx"]))
				m.y = clampf(m.y + clampf(p.y - m.y,-float(S["dy"]),float(S["dy"])),s.ground_top + 10,s.ground_bottom)
				move(a,m.x,m.y,height,8)
				if st >= track - 1: go(job,"lock")
			elif job.stage == "lock":
				job.warn = true
				job.mark.blink = true
				move(a,job.mark.x,job.mark.y,height,8)
				if st >= lock - 1: go(job,"fall")
			elif job.stage == "fall":
				job.danger = true
				a.x = job.mark.x
				a.y = job.mark.y
				a.trail = true
				a.h = maxf(fist_hh,height * (1 - float(st + 1) / float(S["fall"])))
				if st >= int(S["fall"]) - 1:
					a.h = fist_hh
					a.trail = false
					impact(s,e,a)
					go(job,"impact")
			elif job.stage == "impact":
				job.danger = true
				if in_mark(s,job.mark): hurt(s,e,job,"slam",float(S["damage"]),true,a.x,a.h)
				if st >= int(S["active"]) - 1:
					remove_mark(sd,job.mark)
					job.danger_done = true
					go(job,"stuck")
			elif job.stage == "stuck":
				a.glow = ""
				if st >= int(S["stuck"]) - 1: end_job(s,e,sd,job)
		"hammer":
			var H: Dictionary = R["hammer"]
			var height: float = float(H["height"])
			if job.stage == "rise":
				job.warn = true
				a.pose = 2
				a.glow = "white"
				a.angle = 0
				move(a,p.x,p.y,height,10)
				if st >= int(H["rise"]) - 1:
					job.k = 0
					go(job,"aim")
			elif job.stage == "aim":
				job.warn = true
				a.glow = "white"
				a.pose = 2
				if job.mark == null:
					job.mark = new_mark(job,p.x,clampf(p.y,s.ground_top + 10,s.ground_bottom),float(H["rx"]),float(H["ry"]))
					sd.marks.append(job.mark)
				var m: BmkSovereignState.Mark = job.mark
				m.blink = int(H["delay"]) - st <= 14
				move(a,m.x,m.y,height,12)
				if st >= int(H["delay"]) - int(H["fall"]) - 1: go(job,"fall")
			elif job.stage == "fall":
				job.danger = true
				var m: BmkSovereignState.Mark = job.mark
				a.x = m.x
				a.y = m.y
				a.trail = true
				a.h = maxf(fist_hh,height * (1 - float(st + 1) / float(H["fall"])))
				if st >= int(H["fall"]) - 1:
					a.h = fist_hh
					a.trail = false
					impact(s,e,a)
					go(job,"impact")
			elif job.stage == "impact":
				job.danger = true
				var k: int = int(job.k)
				if in_mark(s,job.mark): hurt(s,e,job,"h%d" % k,float(H["damage"][k]),k == int(H["count"]) - 1,a.x,a.h)
				if st >= int(H["active"]) - 1:
					remove_mark(sd,job.mark)
					job.mark = null
					job.k = k + 1
					if k + 1 >= int(H["count"]):
						job.danger_done = true
						go(job,"stuck")
					else: go(job,"aim")
			elif job.stage == "stuck":
				a.glow = ""
				if st >= int(H["stuck"]) - 1: end_job(s,e,sd,job)
		"clap":
			var C: Dictionary = R["clap"]
			var offset: float = float(C["offset"])
			var height: float = float(C["height"])
			if job.stage == "move":
				job.warn = true
				if st == 0:
					job.side = e.face
					job.lane = p.y
					job.cx = clampf(p.x,s.cam_x + offset + 10,s.cam_x + s.view_width - offset - 10)
				for pair: Array in [[a,int(job.side)],[b,-int(job.side)]]:
					var f: BmkSovereignState.Fist = pair[0]
					var side: int = pair[1]
					var tx: float = float(job.cx) + side * offset
					f.pose = 1
					f.face = -side
					f.angle = 0
					move(f,tx,float(job.lane),height,maxf(6,BmkViesaController.js_hypot([tx - f.x,float(job.lane) - f.y,height - f.h]) / maxi(1,int(C["move"]) - st)))
				if st >= int(C["move"]) - 1: go(job,"warn")
			elif job.stage == "warn":
				job.warn = true
				a.glow = "white"
				b.glow = "white"
				if st >= int(C["warn"]) - 1: go(job,"close")
			elif job.stage == "close":
				job.danger = true
				for pair: Array in [[a,int(job.side)],[b,-int(job.side)]]:
					var f: BmkSovereignState.Fist = pair[0]
					var side: int = pair[1]
					var old: float = f.x
					f.x = float(job.cx) + side * (offset - (offset - 18) * (st + 1) / float(C["close"]))
					f.trail = true
					if touch(s,f,{"fromX":old,"low":float(C["low"]),"high":float(C["high"]),"depth":22.0}): hurt(s,e,job,"clap",float(C["damage"]),true,f.x,f.h)
				if st >= int(C["close"]) - 1:
					if absf(p.x - float(job.cx)) < 30 and absf(p.y - float(job.lane)) < 22 and p.z <= float(C["high"]): hurt(s,e,job,"clap",float(C["damage"]),true,a.x,a.h)
					add_fx(e,"fist_impact",float(job.cx),float(job.lane),height,90,90,18)
					s.shake = maxf(s.shake,12)
					s.sound("slam")
					job.danger_done = true
					go(job,"stuck")
			elif job.stage == "stuck":
				a.glow = ""
				b.glow = ""
				a.trail = false
				b.trail = false
				if st >= int(C["stuck"]) - 1: end_job(s,e,sd,job)
		"wave":
			var W: Dictionary = R["wave"]
			var height: float = float(W["height"])
			if job.stage == "rise":
				job.warn = true
				for f: BmkSovereignState.Fist in [a,b]:
					f.pose = 10
					f.glow = "white"
					f.angle = 0
					move(f,f.x,f.y,height,maxf(4,height / float(W["rise"])))
				if st >= int(W["rise"]) - 1: go(job,"fall")
			elif job.stage == "fall":
				job.danger = true
				for f: BmkSovereignState.Fist in [a,b]:
					f.trail = true
					f.h = maxf(fist_hh,height * (1 - float(st + 1) / float(W["fall"])))
				if st >= int(W["fall"]) - 1:
					for f: BmkSovereignState.Fist in [a,b]:
						f.h = fist_hh
						f.trail = false
						add_fx(e,"fist_impact",f.x,f.y,10,80,70,18)
						for dir: int in [-1,1]:
							var w: BmkSovereignState.Wave = BmkSovereignState.Wave.new()
							w.job = job
							w.x = f.x
							w.dir = dir
							sd.waves.append(w)
					s.shake = maxf(s.shake,16)
					s.sound("slam")
					go(job,"stuck")
			elif job.stage == "stuck":
				a.glow = ""
				b.glow = ""
				job.danger = waves_of(sd,job)
				if st >= int(W["stuck"]) - 1:
					for f: BmkSovereignState.Fist in [a,b]:
						if f.job == job: finish_fist(f)
					job.fists = []
					go(job,"waves")
			elif job.stage == "waves":
				job.danger = waves_of(sd,job)
				if not job.danger: end_job(s,e,sd,job)
		"wall":
			var L: Dictionary = R["wall"]
			if job.stage == "move":
				if st == 0: job.side = e.face
				place_wall(e,sd,job,a,b)
				if st >= int(L["move"]) - 1: go(job,"guard")
			elif job.stage == "guard":
				place_wall(e,sd,job,a,b)
				if st >= int(L["guard"]) - 1: go(job,"open")
			elif job.stage == "open":
				# Fists sink to the floor: below Barel's sword line, the body is open from the front.
				for f: BmkSovereignState.Fist in [a,b]:
					f.h = maxf(0,f.h - 6)
					f.angle = 0.35 * int(job.side)
				if st >= int(L["open"]) - 1: end_job(s,e,sd,job)
		"whirl":
			var Wh: Dictionary = R["whirl"]
			var rx: float = float(Wh["rx"])
			if job.stage == "warn":
				job.warn = true
				var pair: Array[BmkSovereignState.Fist] = [a,b]
				for i: int in range(2):
					var f: BmkSovereignState.Fist = pair[i]
					f.glow = "white"
					f.pose = 1
					f.angle = 0
					move(f,e.x + (-1 if i != 0 else 1) * e.face * rx,e.y,float(Wh["height"]),maxf(6,rx * 1.4 / float(Wh["warn"])))
				if st >= int(Wh["warn"]) - 1:
					job.start = 0.0 if e.face > 0 else PI
					go(job,"spin")
			elif job.stage == "spin":
				job.danger = true
				var th: float = float(job.start) + float(st + 1) / float(Wh["spin"]) * float(Wh["turns"]) * PI * 2
				var pair: Array[BmkSovereignState.Fist] = [a,b]
				for i: int in range(2):
					var f: BmkSovereignState.Fist = pair[i]
					var ang: float = th + i * PI
					var old: float = f.x
					f.x = e.x + cos(ang) * rx
					f.y = e.y + sin(ang) * float(Wh["ry"])
					f.h = float(Wh["height"])
					var facing: float = -signf(sin(ang))
					f.face = int(facing) if facing != 0 else 1
					f.trail = true
					f.glow = "white"
					if touch(s,f,{"fromX":old,"low":float(Wh["low"]),"high":float(Wh["high"]),"depth":22.0}):
						hurt(s,e,job,"spin",float(Wh["damage"]),false,e.x,-1.0,float(Wh["push"]),s.player_impact_height(float(Wh["low"]),float(Wh["high"])))
				if st >= int(Wh["spin"]) - 1:
					job.danger_done = true
					go(job,"dazed")
			elif job.stage == "dazed":
				var pair: Array[BmkSovereignState.Fist] = [a,b]
				for i: int in range(2):
					var f: BmkSovereignState.Fist = pair[i]
					f.trail = false
					f.glow = ""
					f.h = maxf(36,f.h - 1.5)
					f.angle = sin(sd.now * 0.3 + i * 2) * 0.3
				if st >= int(Wh["dazed"]) - 1: end_job(s,e,sd,job)
		"backhand":
			var K: Dictionary = R["backhand"]
			if job.stage == "warn":
				job.warn = true
				a.pose = 9
				a.glow = "white"
				a.angle = 0
				if st == 0: job.dir = sgn(p.x - e.x,e.face)
				a.face = int(job.dir)
				move(a,e.x + int(job.dir) * 30,e.y,64,6)
				if st >= int(K["warn"]) - 1:
					job.lane = p.y
					job.tx = p.x + int(job.dir) * 60
					go(job,"swing")
			elif job.stage == "swing":
				job.danger = true
				a.trail = true
				var old: float = a.x
				var left: int = int(K["swing"]) - st
				a.x += (float(job.tx) - a.x) / left
				a.y += (float(job.lane) - a.y) / left
				a.h = 60
				if touch(s,a,{"fromX":old,"depth":26.0}): hurt(s,e,job,"bh",float(K["damage"]),false,e.x,-1.0,float(K["push"]),a.h)
				if st >= int(K["swing"]) - 1:
					job.danger_done = true
					go(job,"recover")
			elif job.stage == "recover":
				a.trail = false
				a.glow = ""
				if st >= rec - 1: end_job(s,e,sd,job)
		"meteor":
			var M: Dictionary = R["meteor"]
			var height: float = float(M["height"])
			var count: int = int(M["count"])
			if job.stage == "rise":
				job.warn = true
				for f: BmkSovereignState.Fist in [a,b]:
					f.pose = 11
					f.glow = "white"
					f.angle = 0
					move(f,f.x,f.y,height,maxf(8,(height - f.h) / maxi(1,int(M["rise"]) - st)))
				if st >= int(M["rise"]) - 1:
					job.marks = []
					go(job,"rain")
			elif job.stage == "rain":
				var marks: Array = job.marks
				if st % int(M["interval"]) == 0 and marks.size() < count:
					var k: int = marks.size()
					var m: BmkSovereignState.Mark = new_mark(job,p.x,clampf(p.y,s.ground_top + 10,s.ground_bottom),float(M["rx"]),float(M["ry"]))
					m.at = st
					m.k = k
					m.fist = job.fists[k % 2]
					marks.append(m)
					sd.marks.append(m)
				for f: BmkSovereignState.Fist in [a,b]:
					var m: BmkSovereignState.Mark = null
					for q: BmkSovereignState.Mark in marks:
						if q.fist == f and not q.done:
							m = q
							break
					if m == null:
						if marks.size() < count: move(f,f.x,f.y,height,16)
						else: f.glow = ""
						continue
					var impact_at: int = m.at + int(M["delay"])
					var fall_at: int = impact_at - int(M["fall"])
					m.blink = impact_at - st <= 14
					if st < fall_at:
						f.pose = 2
						f.trail = false
						move(f,m.x,m.y,height,80.0 if f.h >= height - 1 else 16.0)
					elif st < impact_at:
						job.danger = true
						f.x = m.x
						f.y = m.y
						f.pose = 2
						f.trail = true
						f.h = maxf(fist_hh,height * (impact_at - st - 1) / float(M["fall"]))
						if st == impact_at - 1:
							add_fx(e,"eruption",m.x,m.y,0,110,120,30,true)
							s.shake = maxf(s.shake,14)
							s.sound("slam")
					else:
						job.danger = true
						f.trail = false
						if in_mark(s,m): hurt(s,e,job,"m%d" % int(m.k),float(M["damage"]),true,f.x,f.h)
						if st >= impact_at + int(M["active"]) - 1:
							m.done = true
							remove_mark(sd,m)
				if marks.size() >= count and marks.all(func(q: BmkSovereignState.Mark) -> bool: return q.done):
					job.danger_done = true
					go(job,"stuck")
			elif job.stage == "stuck":
				for f: BmkSovereignState.Fist in [a,b]:
					f.glow = ""
					f.pose = 2
				if st >= int(M["stuck"]) - 1: end_job(s,e,sd,job)
		"ultimate":
			cannon_tick(s,e,sd,job,MS)
		"beam":
			var B: Dictionary = R["beam"]
			var fire: int = int(B["fire"][job.p2])
			var body: BmkSovereignState.Body = sd.body
			var charge: int = int(B["charge"])
			if job.stage == "charge":
				job.warn = true
				if st < int(B["lock"]): e.y += clampf(p.y - e.y,-1.6,1.6)
				else:
					if st == int(B["lock"]): job.lane = clampf(p.y,s.ground_top + 10,s.ground_bottom)
					e.y += (float(job.lane) - e.y) / maxi(1,charge - st)
				if body != null: body.drawing = 1 + mini(7,floori(float(st) / charge * 8))
				if st >= charge - 1:
					e.y = float(job.lane)
					go(job,"fire")
					s.sound("bolt")
					s.shake = maxf(s.shake,6)
			elif job.stage == "fire":
				job.danger = true
				if body != null: body.drawing = 9 + floori(st / 6.0) % 4
				if absf(p.y - float(job.lane)) <= float(B["depth"]) * hurt_scale(s) and p.z + s.player_body_height() >= float(B["low"]) and p.z <= float(B["high"]) and (p.x - e.x) * e.face > 0:
					hurt(s,e,job,"beam",float(B["damage"]),false,e.x,-1.0,0.0,s.player_impact_height(float(B["low"]),float(B["high"])))
				if st >= fire - 1:
					job.danger_done = true
					go(job,"recovery")
			elif job.stage == "recovery":
				if body != null: body.drawing = 13 + mini(3,floori(float(st) / float(B["recovery"]) * 4))
				if st >= int(B["recovery"]) - 1: end_job(s,e,sd,job)

func new_mark(job: BmkSovereignState.Job, x: float, y: float, rx: float, ry: float) -> BmkSovereignState.Mark:
	var m: BmkSovereignState.Mark = BmkSovereignState.Mark.new()
	m.job = job
	m.x = x
	m.y = y
	m.rx = rx
	m.ry = ry
	return m

func waves_of(sd: BmkSovereignState, job: BmkSovereignState.Job) -> bool:
	for w: BmkSovereignState.Wave in sd.waves:
		if w.job == job: return true
	return false

func place_wall(e: BmkLegacyActor, sd: BmkSovereignState, job: BmkSovereignState.Job, a: BmkSovereignState.Fist, b: BmkSovereignState.Fist) -> void:
	var pair: Array[BmkSovereignState.Fist] = [a,b]
	for i: int in range(2):
		var f: BmkSovereignState.Fist = pair[i]
		f.pose = 9
		f.face = int(job.side)
		f.angle = 0
		f.glow = ""
		move(f,e.x + int(job.side) * (46 + i * 6),e.y + (-3 if i != 0 else 3),70 + i * 8 + sin(sd.now * 0.2 + i) * 1.5,8)

# ------------------------------------------------------------------ fists, waves, fx
func fist_home(e: BmkLegacyActor, sd: BmkSovereignState, f: BmkSovereignState.Fist) -> void:
	var target: Array[float] = home(e,f,sd)
	f.pose = 1
	f.glow = ""
	f.trail = false
	f.face = e.face
	f.angle *= 0.7
	move(f,target[0],target[1],target[2],maxf(float(R["home"]["speed"]),BmkViesaController.js_hypot([target[0] - f.x,target[1] - f.y,target[2] - f.h]) * 0.15))

func rise(s: BmkWaveSimulation, e: BmkLegacyActor, f: BmkSovereignState.Fist) -> void:
	f.st = "rise"
	f.timer = int(R["rise"])
	f.max_hp = float(R["fistHp"][p2(e)])
	f.hp = f.max_hp
	f.broken = false
	f.wake = 0
	f.vh = 0
	add_fx(e,"reform",f.x,f.y,maxf(20,f.h),90,90,30)
	s.sound("pickup")

func tick_fists(s: BmkWaveSimulation, e: BmkLegacyActor, sd: BmkSovereignState) -> void:
	for f: BmkSovereignState.Fist in sd.fists:
		if f.flash > 0: f.flash -= 1
		if f.st == "home": fist_home(e,sd,f)
		elif f.st == "return":
			var target: Array[float] = home(e,f,sd)
			f.pose = 1
			f.face = e.face
			f.angle *= 0.8
			if move(f,target[0],target[1],target[2],float(R["direct"]["back"]) * float(R["fistSpeed"][p2(e)])): f.st = "home"
		elif f.st in ["dropped","fallen","dead"]:
			if f.h > 0:
				f.vh -= 0.6
				f.h = maxf(0,f.h + f.vh)
			f.angle = 0
			f.glow = ""
			f.trail = false
			if f.st == "fallen" and f.timer > 0: f.timer -= 1
			if f.st == "fallen" and f.timer <= 0 and not sd.grounded and standing(e): rise(s,e,f)
		elif f.st == "rise":
			var target: Array[float] = home(e,f,sd)
			f.timer -= 1
			f.wake = 1 - maxi(0,f.timer) / float(R["rise"])
			f.pose = 1
			f.face = e.face
			move(f,target[0],target[1],target[2],maxf(2,BmkViesaController.js_hypot([target[0] - f.x,target[1] - f.y,target[2] - f.h]) / maxi(1,f.timer)))
			if f.timer <= 0:
				f.st = "home"
				f.wake = 1

func tick_waves(s: BmkWaveSimulation, e: BmkLegacyActor, sd: BmkSovereignState) -> void:
	var W: Dictionary = R["wave"]
	var p: BmkActorState = s.player
	for w: BmkSovereignState.Wave in sd.waves:
		w.age += 1
		w.x += w.dir * float(W["speed"])
		if not w.hit and p.st != "dead" and absf(p.x - w.x) < 16 and p.z <= float(W["top"]) and hurt_player(s,e,float(W["damage"]),w.dir,true): w.hit = true
		if w.x < s.cam_x - 40 or w.x > s.cam_x + s.view_width + 40: w.dead = true
	sd.waves = sd.waves.filter(func(w: BmkSovereignState.Wave) -> bool: return not w.dead)

static func tick_fx(sd: BmkSovereignState) -> void:
	for f: BmkSovereignState.Fx in sd.fx: f.age += 1
	sd.fx = sd.fx.filter(func(f: BmkSovereignState.Fx) -> bool: return f.age < f.life)

func ground(s: BmkWaveSimulation, e: BmkLegacyActor, sd: BmkSovereignState) -> void:
	for j: BmkSovereignState.Job in sd.jobs.duplicate(): end_job(s,e,sd,j)
	for f: BmkSovereignState.Fist in sd.fists:
		if f.st not in ["fallen","dead","dropped"]:
			f.st = "dropped"
			f.vh = 0
			f.glow = ""
			f.trail = false
			f.job = null
			f.wake = 0
	sd.grounded = true
	sd.pending = {}

func begin_transition(s: BmkWaveSimulation, e: BmkLegacyActor) -> void:
	var sd: BmkSovereignState = state(e)
	ground(s,e,sd)
	s.enemy_controller.reset_boss_fx(e,s)
	# Leftover marks, waves and the beam are all cleared for the awakening.
	sd.marks.clear()
	sd.waves.clear()
	e.hp = 0
	e.phase_t = int(R["kneelDown"]) + int(R["awaken"])
	sd.trans_age = 0
	e.st = "rec"
	e.t = 0
	e.z = 0
	e.vz = 0
	e.vx = 0
	e.invulnerable = true
	e.gr = 0
	e.gr_t = 0
	s.player.inv = maxi(s.player.inv,90)
	s.sound("land")

func transition(s: BmkWaveSimulation, e: BmkLegacyActor, sd: BmkSovereignState) -> void:
	var awake: int = sd.trans_age - int(R["kneelDown"])
	e.walk = false
	e.invulnerable = true
	e.flash = 0
	if awake == floori((float(R["awakenShakeDrawing"]) - 1) / 16 * float(R["awaken"])):
		s.shake = maxf(s.shake,22)
		s.sound("phase2")
		add_fx(e,"reform",e.x,e.y,80,170,170,40)
	sd.trans_age += 1
	e.phase_t -= 1
	if e.phase_t == 0:
		e.p2shown = true
		e.max_hp = float(R["hp"][1])
		e.hp = e.max_hp
		e.next_kd = e.max_hp * 0.75
		e.gr = 0
		e.gr_t = 0
		e.invulnerable = false
		e.st = "chase"
		e.t = 0
		e.attack_cd = gap(s,e)
		sd.grounded = false
		sd.pressure = 0
		sd.force_backhand = false
		sd.ultimate_used = false
		sd.cooldowns.clear()
		for f: BmkSovereignState.Fist in sd.fists: rise(s,e,f)

func death(s: BmkWaveSimulation, e: BmkLegacyActor, sd: BmkSovereignState) -> void:
	if not sd.dead:
		sd.dead = true
		for j: BmkSovereignState.Job in sd.jobs.duplicate(): end_job(s,e,sd,j)
		sd.marks.clear()
		sd.waves.clear()
		var p: BmkStageActor = s.player as BmkStageActor
		if p.grab != null and p.grab.kind == "sovereign": release_grab(s,"cancel")
		for f: BmkSovereignState.Fist in sd.fists:
			f.st = "dead"
			f.broken = true
			f.vh = 0
			f.glow = ""
			f.trail = false
			f.wake = 0
			f.job = null
	e.t += 1
	e.invulnerable = true
	e.walk = false
	if e.t == 24:
		for f: BmkSovereignState.Fist in sd.fists: add_fx(e,"fist_shatter",f.x,f.y,maxf(f.h,14),110,110,32)
		s.shake = maxf(s.shake,14)
		s.sound("slam")
	if e.t >= int(R["death"]) + int(R["deathHold"]):
		if not sd.remains:
			var r: PackedFloat64Array = PackedFloat64Array([e.x,e.y,e.face])
			for f: BmkSovereignState.Fist in sd.fists: r.append_array(PackedFloat64Array([f.x,f.y,f.face]))
			s.sovereign_remains.append(r)
			sd.remains = true
		e.remove = true

## updateSovereignState(e): true during the transition and while dead.
func update_state(s: BmkWaveSimulation, e: BmkLegacyActor) -> bool:
	var sd: BmkSovereignState = state(e)
	sd.now += 1
	capture_afterimages(s,e,sd)
	for id: String in sd.cooldowns:
		if sd.cooldowns[id] > 0: sd.cooldowns[id] -= 1
	if sd.pressure_t > 0:
		sd.pressure_t -= 1
		if sd.pressure_t == 0: sd.pressure = 0
	if e.phase_t > 0:
		transition(s,e,sd)
		tick_fists(s,e,sd)
		tick_fx(sd)
		return true
	if e.st == "dead":
		death(s,e,sd)
		tick_fists(s,e,sd)
		tick_fx(sd)
		return true
	var down: bool = e.st in ["stun","down"]
	if down and not sd.grounded:
		ground(s,e,sd)
		sd.down_at = e.t
	if not down and sd.grounded:
		sd.grounded = false
		for f: BmkSovereignState.Fist in sd.fists:
			if f.st == "dropped": rise(s,e,f)
	if e.st == "down":
		e.vz = minf(e.vz,0)
		e.z = 0
	for j: BmkSovereignState.Job in sd.jobs.duplicate():
		if not j.done:
			job_tick(s,e,sd,j)
			j.st += 1
			j.t += 1
	tick_fists(s,e,sd)
	tick_waves(s,e,sd)
	tick_fx(sd)
	var danger: bool = not sd.waves.is_empty()
	for j: BmkSovereignState.Job in sd.jobs:
		if j.danger: danger = true
	if sd.danger_was and not danger: sd.last_danger_end = sd.now
	sd.danger_was = danger
	if sd.force_backhand and e.attack_cd > 10 + int(R["attackDelay"]): e.attack_cd = 10 + int(R["attackDelay"])
	e.hw = float(R["hw"])
	if e.st != "pat": e.invulnerable = false
	return false

func update_intro(s: BmkWaveSimulation, e: BmkLegacyActor) -> void:
	var sd: BmkSovereignState = state(e)
	var f: int = floori(s.intro_t / MS + 1e-6)
	var start: int = s.js_round((float(R["introFistDrawing"]) - 1) / 16 * float(R["intro"]))
	sd.now += 1
	e.z = 0
	for q: BmkSovereignState.Fist in sd.fists:
		var target: Array[float] = home(e,q,sd)
		if f < start:
			q.x = target[0]
			q.y = target[1]
			q.h = 420
			q.st = "intro"
			continue
		if q.st == "intro":
			var u: float = minf(1,float(f - start) / float(R["introFistDrop"]))
			q.x = target[0]
			q.y = target[1]
			q.h = 420 + (target[2] - 420) * BmkSimulation.ease(u)
			q.face = e.face
			q.pose = 1
			if u >= 1:
				q.st = "home"
				add_fx(e,"reform",q.x,q.y,q.h,90,90,30)
				s.sound("land")
				s.shake = maxf(s.shake,8)
		else: fist_home(e,sd,q)
	tick_fx(sd)

func warning(e: BmkLegacyActor) -> bool:
	if e.sovereign == null: return false
	for j: BmkSovereignState.Job in e.sovereign.jobs:
		if j.warn: return true
	return false

# ------------------------------------------------------------------ pose and ghosts (visual)
## sovPose(e): {clip, drawing (1-based)}.
func pose(s: BmkWaveSimulation, e: BmkLegacyActor) -> Array:
	var sd: BmkSovereignState = state(e)
	var clips: Dictionary = data.source["SOVEREIGN"]["ART"]["clips"]
	var seq := func(c: String, u: float) -> Array: return [c,mini(int(clips[c]),maxi(1,1 + floori(u * int(clips[c]))))]
	var range_ := func(c: String, a: int, b: int, u: float) -> Array: return [c,mini(b,a + floori(clampf(u,0,0.999) * (b - a + 1)))]
	var loop := func(c: String, a: int, b: int, rate: int) -> Array: return [c,a + floori(s.tick / float(rate)) % (b - a + 1)]
	if e.phase_t > 0:
		var t: int = sd.trans_age
		if t < int(R["kneelDown"]): return range_.call("kneel",1,6,float(t) / float(R["kneelDown"]))
		return seq.call("awaken",minf(0.999,(t - float(R["kneelDown"])) / float(R["awaken"])))
	if e.st == "intro": return seq.call("intro",minf(0.999,s.intro_t / MS / float(R["intro"])))
	if e.st == "dead": return seq.call("death",minf(0.999,e.t / float(R["death"])))
	if e.st == "stun": return [clip(e,"kneel"),7]
	if e.st == "down":
		var c: String = clip(e,"kneel")
		var elapsed: int = e.t - sd.down_at
		var left: int = 61 - e.t
		if elapsed < 24: return range_.call(c,1,6,elapsed / 24.0)
		if left < 24: return range_.call(c,11,16,1 - left / 24.0)
		return loop.call(c,7,10,9)
	if e.st == "hurt":
		var c: String = clip(e,"hurt")
		var n: int = int(clips[c])
		var half: int = floori(n / 2.0)
		return [c,mini(n,(half if e.hheavy else 0) + 1 + mini(half - 1,floori(e.t / 11.0 * half)))]
	var b: BmkSovereignState.Body = sd.body
	if e.st == "pat" and b != null:
		if b.idle: return loop.call(clip(e,"idle"),1,16,7)
		if b.drawing != null: return [b.clip,int(b.drawing)]
		return range_.call(b.clip,b.from,b.to,float(b.t) / b.ticks)
	return loop.call(clip(e,"walk"),1,16,5) if e.walk else loop.call(clip(e,"idle"),1,16,7)

func fist_frame(e: BmkLegacyActor, f: BmkSovereignState.Fist) -> Array:
	var ratio: float = f.hp / f.max_hp if f.max_hp != 0 else 0.0
	var stage: int = 0 if ratio > 0.66 else (1 if ratio > 0.33 else 2)
	return ["fist_p2" if e.p2shown else "fist_p1",([5,6,7][stage] if f.pose == 1 else f.pose)]

## sovCaptureAfterimages(e, s): ghosts of the body and active fists, sampled on simulation ticks.
## Visual only; ghosts expire even when the subject stops moving.
func capture_afterimages(s: BmkWaveSimulation, e: BmkLegacyActor, sd: BmkSovereignState) -> void:
	var A: Dictionary = R["afterimage"]
	var on: bool = standing(e) and e.st != "intro"
	var subjects: Array = [[sd,pose(s,e),e.x,e.y - e.z,e.face,0.0,on]]
	for f: BmkSovereignState.Fist in sd.fists:
		subjects.append([f,fist_frame(e,f),f.x,f.y - f.h,f.face,f.angle,on and active(f)])
	for subject: Array in subjects:
		var owner: Object = subject[0]
		var list: Array[BmkSovereignState.Ghost] = owner.get("afterimages")
		list.assign(list.filter(func(g: BmkSovereignState.Ghost) -> bool: return sd.now - g.at < int(A["life"])))
		if not bool(subject[6]):
			list.clear()
			owner.set("trail_sample",null)
			continue
		if sd.now % int(A["interval"]) != 0: continue
		var old: BmkSovereignState.Ghost = owner.get("trail_sample")
		var y: float = float(subject[3])
		if old != null and BmkViesaController.js_hypot([float(subject[2]) - old.x,y - old.y]) >= float(A["minDistance"]):
			list.append(old)
			if list.size() > int(A["max"]): list.remove_at(0)
		var g: BmkSovereignState.Ghost = BmkSovereignState.Ghost.new()
		g.clip = str(subject[1][0])
		g.drawing = int(subject[1][1])
		g.x = float(subject[2])
		g.y = y
		g.face = int(subject[4])
		g.angle = float(subject[5])
		g.at = sd.now
		owner.set("trail_sample",g)
