class_name BmkGameHud
extends Control
var game: BmkVerticalSlice
var font: Font

func _ready() -> void:
	font = ThemeDB.fallback_font
	mouse_filter = Control.MOUSE_FILTER_IGNORE

func text(at: Vector2, value: String, color: Color = Color.WHITE, size_value: int = 16) -> void:
	draw_string(font,at,value,HORIZONTAL_ALIGNMENT_LEFT,-1,size_value,color)

func bar(at: Vector2, width: float, value: float, color: Color) -> void:
	draw_rect(Rect2(at,Vector2(width,7)),Color(0.05,0.04,0.06,0.9))
	draw_rect(Rect2(at,Vector2(width * clampf(value,0,1),7)),color)
	draw_rect(Rect2(at,Vector2(width,7)),Color(0.8,0.76,0.65,0.6),false)

func _draw() -> void:
	if game == null or game.session == null:
		return
	var s: BmkSimulation = game.session
	var p: BmkActorState = s.player
	if p.st == "cast" and not p.cast_fired:
		draw_rect(Rect2(0,0,960,540),Color(0.04,0.06,0.19,0.32 * minf(1,p.t * s.MS / 300)))
	if s.flash_t > 0:
		draw_rect(Rect2(0,0,960,540),Color(1,0.8,0.85,minf(0.55,s.flash_t / 220 * 0.55)))
	draw_rect(Rect2(0,0,960,79),Color(0.025,0.02,0.035,0.86))
	text(Vector2(20,25),"BAREL",Color("e4d5ba"),20)
	text(Vector2(20,46),"HP %d / 100    LIFE %d" % [p.hp,p.lives],Color("f2e9dd"),13)
	bar(Vector2(20,53),260,p.hp / 100,Color("bd354b"))
	bar(Vector2(20,66),260,p.sp / 100,Color("70b7ee"))
	text(Vector2(304,27),"BLACK MOON KNIGHT",Color("e4d5ba"),19)
	text(Vector2(304,49),"STAGE 1 / OCCUPIED STREET",Color("bbb0b5"),12)
	text(Vector2(755,25),"SCORE %06d" % p.score,Color("e4d5ba"),16)
	text(Vector2(755,47),"WAVE %d / 2    MAGIC %d" % [mini(2,game.section.event_index + 1),p.mg],Color("bbb0b5"),12)
	if s.chain_n > 1:
		text(Vector2(820,108),"%d HIT" % s.chain_n,Color("ffe18b"),25)
	var arcade: bool = game.physical.preset == "arcade"
	draw_rect(Rect2(0,490,960,50),Color(0.025,0.02,0.035,0.86))
	text(Vector2(18,509),"ARROWS MOVE   Z ATTACK   X JUMP   C SPECIAL   A MAGIC   SHIFT DASH" if arcade else "WASD MOVE   J ATTACK   K JUMP   SPACE SPECIAL   L MAGIC   SHIFT DASH",Color("d0c5ca"),12)
	text(Vector2(18,529),"S THRUST   D SLAM   Q WHIRL   W LEAP   E RED WAVE" if arcade else "U THRUST   I SLAM   O WHIRL   P LEAP   H RED WAVE",Color("a3b4c9"),12)
	text(Vector2(659,529),"F1 KEYS   F9 DEBUG   ESC PAUSE   R RESTART",Color("a3b4c9"),11)
	var index: int = 0
	for skill: BmkAttackData in s.data.skills:
		var x: float = 21 + index * 124
		var remaining: float = p.skill_cd[skill.id]
		bar(Vector2(x,478),108,1.0 - remaining / skill.cooldown_ms,Color("a6badd"))
		if remaining > 0:
			text(Vector2(x,472),"%s %.1f" % [skill.id,remaining / 1000.0],Color("a3a0ad"),11)
		index += 1
	if not game.section.locked and game.section.event_index > 0 and not game.section.complete:
		text(Vector2(826,281),"GO  >",Color("ffe18b"),22)
	if game.debug_view.visible:
		draw_rect(Rect2(12,86,365,72),Color(0,0,0,0.75))
		text(Vector2(21,104),"F9  HITBOX / F2 REFILL SP + MAGIC",Color("c1efc5"),12)
		text(Vector2(21,123),"tick %d | hitStop %d | tier %s" % [s.tick,s.hit_stop,s.last_tier],Color("c1efc5"),12)
		text(Vector2(21,143),"%s t=%d | x %.2f  y %.2f  z %.2f" % [p.st,p.t,p.x,p.y,p.z],Color("c1efc5"),12)
	if game.clock.paused or game.section.complete or s.game_over:
		draw_rect(Rect2(0,0,960,540),Color(0.015,0.01,0.025,0.7))
		var title: String = "SECTION 1 COMPLETE" if game.section.complete else ("GAME OVER" if s.game_over else "PAUSED")
		text(Vector2(304,251),title,Color("e4d5ba"),30)
		text(Vector2(304,288),"R: RESTART STREET" if game.section.complete or s.game_over else "ESC: RESUME    R: RESTART",Color("ddd5dd"),16)
