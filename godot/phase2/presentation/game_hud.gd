class_name BmkGameHud
extends Control
var game: BmkVerticalSlice
var font: Font
var source_hud_atlas: Texture2D
var korean_font: Font

func _ready() -> void:
	font = ThemeDB.fallback_font
	var system_font: SystemFont = SystemFont.new()
	system_font.font_names = PackedStringArray(["Malgun Gothic", "Noto Sans CJK KR", "Arial"])
	korean_font = system_font
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
	if game.show_flash and s.flash_t > 0:
		draw_rect(Rect2(0,0,960,540),Color(1,0.8,0.85,minf(0.55,s.flash_t / 220 * 0.55)))
	if game is BmkMenuGame:
		if not hud_hidden():
			draw_source_hud(p)
			draw_source_skills(p,s)
	else:
		draw_rect(Rect2(0,0,960,79),Color(0.025,0.02,0.035,0.86))
		text(Vector2(20,25),"BAREL",Color("e4d5ba"),20)
		text(Vector2(20,46),"HP %d / 100    LIFE %d" % [p.hp,p.lives],Color("f2e9dd"),13)
		bar(Vector2(20,53),260,p.hp / 100,Color("bd354b"))
		bar(Vector2(20,66),260,p.sp / 100,Color("70b7ee"))
		text(Vector2(304,27),"BLACK MOON KNIGHTS",Color("e4d5ba"),19)
		text(Vector2(304,49),"STAGE 1 / OCCUPIED STREET",Color("bbb0b5"),12)
		text(Vector2(755,25),"SCORE %06d" % p.score,Color("e4d5ba"),16)
		text(Vector2(755,47),"WAVE %d / 2    MAGIC %d" % [mini(2,game.section.event_index + 1),p.mg],Color("bbb0b5"),12)
	if s.chain_n > 1:
		text(Vector2(820,108),"%d HIT" % s.chain_n,Color("ffe18b"),25)
	draw_rect(Rect2(0,490,960,50),Color(0.025,0.02,0.035,0.86))
	var keys: Array[String] = []
	for action: String in BmkPhysicalInput.ACTIONS:
		var events: Array[InputEvent] = InputMap.action_get_events("bmk_" + action)
		keys.append(OS.get_keycode_string((events[0] as InputEventKey).physical_keycode) if not events.is_empty() else "?")
	text(Vector2(18,509),"%s/%s/%s/%s MOVE  %s ATTACK  %s JUMP  %s SPECIAL  %s MAGIC  %s DASH" % [keys[0],keys[1],keys[2],keys[3],keys[5],keys[4],keys[7],keys[8],keys[6]],Color("d0c5ca"),12)
	text(Vector2(18,529),"%s THRUST   %s SLAM   %s WHIRL   %s LEAP   %s RED WAVE" % [keys[9],keys[10],keys[11],keys[12],keys[13]],Color("a3b4c9"),12)
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

## game.js render(): the boss intro replaces the player HUD with its card.
func hud_hidden() -> bool:
	return false

func draw_source_hud(p: BmkActorState) -> void:
	if p.is_viesa():
		BmkViesaHud.draw_player(self,p)
		return
	if source_hud_atlas == null: source_hud_atlas = load("res://port_assets/images/pixel_ui_source__1d6b42ef373a.png") as Texture2D
	var atlas: Texture2D = source_hud_atlas
	var scale_: float = 960.0 / 1672.0 * 0.62 * 1064.0 / 1104.0
	var origin: Vector2 = Vector2(3,20)
	draw_texture_rect_region(atlas,Rect2(origin,Vector2(1104,420) * scale_),Rect2(0,140,1104,420))
	for row: Array in [[290,p.hp / 100.0,Color("290508")],[350,p.sp / 100.0,Color("031329")]]:
		var pos: Vector2 = origin + Vector2(274,int(row[0]) - 140) * scale_
		draw_rect(Rect2(pos,Vector2(468,34) * scale_),row[2])
		var amount: float = 468 * clampf(float(row[1]),0,1)
		if amount > 0: draw_texture_rect_region(atlas,Rect2(pos,Vector2(amount,34) * scale_),Rect2(305,int(row[0]),300,34))
	for i: int in range(3):
		if i >= p.mg: draw_rect(Rect2(origin + Vector2(773 + i * 82,303 - 140) * scale_,Vector2(83,90) * scale_),Color(0.04,0.03,0.04,0.85))
		if i >= p.lives: draw_rect(Rect2(origin + Vector2(284 + i * 88,423 - 140) * scale_,Vector2(88,132) * scale_),Color(0.04,0.03,0.04,0.85))
	text(Vector2(6,14),"SCORE %d" % p.score,Color("ffe1a0"),11)

func draw_source_skills(p: BmkActorState, s: BmkSimulation) -> void:
	if p.is_viesa():
		BmkViesaHud.draw_skills(self,p,s)
		return
	var actions: Array[String] = ["KeyU","KeyH","KeyO","KeyP","KeyL"]
	for i: int in range(mini(5,s.data.skills.size())):
		var at: Vector2 = Vector2(915,145 + i * 50)
		draw_texture_rect_region(source_hud_atlas,Rect2(at,Vector2(29,50)),Rect2(505 + 131 * i,644,140,243))
		draw_rect(Rect2(at + Vector2(4,13),Vector2(9,9)),Color("03101c"))
		var events: Array[InputEvent] = InputMap.action_get_events("bmk_" + actions[i])
		if not events.is_empty(): text(at + Vector2(4,21),OS.get_keycode_string((events[0] as InputEventKey).physical_keycode),Color("ffe1a0"),8)
		var skill: BmkAttackData = s.data.skills[i]
		var ratio: float = clampf(p.skill_cd[skill.id] / skill.cooldown_ms,0,1)
		if ratio > 0: draw_rect(Rect2(at,Vector2(29,50 * ratio)),Color(0,0,0,0.7))
