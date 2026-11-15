class_name BmkSpecialDim
extends Node2D
var session: BmkSimulation

func _draw() -> void:
	if session == null or session.player.st != "special":
		return
	var ms: float = session.player.t * session.MS
	var brightness: float = 1.0 - 0.65 * (ms / 200.0) if ms < 200 else (0.35 + 0.65 * ((ms - 1900.0) / 200.0) if ms > 1900 else 0.35)
	draw_rect(Rect2(session.cam_x - 40,106,720,440),Color(0.063,0.008,0.031,1.0 - brightness))
