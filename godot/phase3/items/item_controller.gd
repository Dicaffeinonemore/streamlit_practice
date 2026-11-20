class_name BmkItemController
extends RefCounted

func drop(s: BmkStageSimulation, type: String, x: float, y: float) -> void:
	var item: BmkWorldItem = BmkWorldItem.new()
	item.type = type
	item.x = x
	item.y = y
	item.vz = 5
	item.vx = s.random_between(-1,1)
	s.items.append(item)

func enemy_drop(s: BmkStageSimulation, e: BmkStageActor) -> void:
	var roll: float = s.random_between(0,1)
	if e.boss:
		drop(s,"gold",e.x - 20,e.y)
		drop(s,"big",e.x + 20,e.y)
		return
	s.stat_kills += 1
	if s.stat_kills % 6 == 1:
		drop(s,"scroll",e.x,e.y)
		return
	var type: String = "big" if roll < 0.07 else ("potion" if roll < 0.28 else ("power" if roll < 0.34 else ("crystal" if roll < 0.42 else ("coin" if roll < 0.53 else ("coinBag" if roll < 0.58 else ("gold" if roll < 0.6 else ""))))))
	if not type.is_empty():
		drop(s,type,e.x,e.y)

## game.js damageBarrel(b, hitSound): playerHitSfx(0, hitSound) decides the hit sound.
func damage_barrel(s: BmkStageSimulation, b: BmkWorldItem, hit: String = "") -> void:
	b.hp -= 1
	b.flash = 6
	s.hit_stop = maxi(s.hit_stop,2)
	s.player_hit_sound(0, hit)
	if b.hp > 0:
		return
	b.gone = true
	var roll: float = s.random_between(0,1)
	var type: String = "potion" if roll < 0.4 else ("big" if roll < 0.52 else ("power" if roll < 0.64 else ("scroll" if roll < 0.76 else ("crystal" if roll < 0.86 else ("coin" if roll < 0.94 else ("coinBag" if roll < 0.98 else "gold"))))))
	drop(s,type,b.x,b.y)
	s.sound("barrel")

func collect(s: BmkStageSimulation) -> void:
	var p: BmkActorState = s.player
	for item: BmkWorldItem in s.items:
		if item.gone or p.st == "dead" or absf(item.x - p.x) >= 28 or absf(item.y - p.y) >= 22 or p.z >= 40 or item.z >= 30:
			continue
		item.gone = true
		s.sound("pickup")
		match item.type:
			"potion": p.hp = minf(p.max_hp,p.hp + 30)
			"big": p.hp = minf(p.max_hp,p.hp + 60)
			"power": p.buff = 900
			"scroll": p.mg = mini(3,p.mg + 1)
			"crystal": p.sp = minf(100,p.sp + 25)
			_: p.score += int(s.stage_data.source["SCORE_ITEMS"].get(item.type,0))

func step(s: BmkStageSimulation) -> void:
	for b: BmkWorldItem in s.barrels:
		if b.flash > 0: b.flash -= 1
	s.barrels = s.barrels.filter(func(b: BmkWorldItem) -> bool: return not b.gone)
	for item: BmkWorldItem in s.items:
		item.t += 1
		item.life -= 1
		if item.z > 0 or item.vz != 0:
			item.x += item.vx
			item.z += item.vz
			item.vz -= 0.4
			if item.z <= 0:
				item.z = 0
				item.vz = 0
				item.vx = 0
		if item.life <= 0: item.gone = true
	s.items = s.items.filter(func(item: BmkWorldItem) -> bool: return not item.gone)

