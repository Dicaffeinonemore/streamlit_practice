class_name BmkDebugView
extends Node2D
var session: BmkSimulation

func _draw() -> void:
	if session == null:
		return
	var p: BmkActorState = session.player
	for dy: float in [-session.data.enemy_depth,session.data.enemy_depth]:
		draw_line(Vector2(p.x - 140,p.y + dy),Vector2(p.x + 140,p.y + dy),Color(1,1,0,0.6))
	var back: float = -8.0
	var reach: float = 0.0
	var depth: float = 24.0
	if p.st == "atk":
		reach = session.data.attack(p.atk).reach
	elif p.st == "dash_attack":
		back = session.data.dash_front
		reach = session.data.dash_reach
		depth = session.data.dash_depth
	elif p.st == "skill":
		var skill: BmkAttackData = session.data.skill(p.skill)
		back = -skill.behind
		reach = skill.reach
		depth = 38.0
	if reach > 0:
		var x0: float = p.x + p.face * back
		var x1: float = p.x + p.face * reach
		draw_rect(Rect2(minf(x0,x1),p.y - depth,absf(x1 - x0),depth * 2),Color("3dff7a"),false)
	for e: BmkActorState in session.enemies:
		if e.st == "dead":
			continue
		draw_rect(Rect2(e.x - e.hw,e.y - e.z - e.d.height,e.hw * 2,e.d.height),Color("4fc3ff"),false)
		var zone: BmkHitZone = session.enemy_controller.attack_zone(session,e)
		if zone != null:
			draw_rect(zone.rectangle(),Color.WHITE if zone.active else Color("ff4fd8"),false)
	draw_rect(Rect2(p.x - 1,p.y - 1,3,3),Color.WHITE)
