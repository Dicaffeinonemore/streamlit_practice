class_name BmkGameHud
extends Control
var game: BmkVerticalSlice
var font: Font
var korean_font: Font
## Health trail behind the HP fill (game.js lagTo(p, 'hpLag', p.hp, .5)).
var hp_lag: float = -1.0

func _ready() -> void:
	font = ThemeDB.fallback_font
	var system_font: SystemFont = SystemFont.new()
	system_font.font_names = PackedStringArray(["Malgun Gothic", "Noto Sans CJK KR", "Arial"])
	korean_font = system_font
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	# The HUD design is drawn at 960 / 1672 of its size; smooth it like the web canvas does.
	texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR

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
			# body.touch #skillbar { display: none } - the touch pad shows the skills instead.
			if not page_controls_hidden(): draw_source_skills(p,s)
	else:
		draw_rect(Rect2(0,0,960,79),Color(0.025,0.02,0.035,0.86))
		text(Vector2(20,25),"BAREL",Color("e4d5ba"),20)
		text(Vector2(20,46),"HP %d / 100    LIFE %d" % [p.hp,p.lives],Color("f2e9dd"),13)
		bar(Vector2(20,53),260,p.hp / 100,Color("bd354b"))
		bar(Vector2(20,66),260,p.sp / 100,Color("70b7ee"))
		text(Vector2(304,27),"Lunatic Nights",Color("e4d5ba"),19)
		text(Vector2(304,49),"STAGE 1 / OCCUPIED STREET",Color("bbb0b5"),12)
		text(Vector2(755,25),"SCORE %06d" % p.score,Color("e4d5ba"),16)
		text(Vector2(755,47),"WAVE %d / 2    MAGIC %d" % [mini(2,game.section.event_index + 1),p.mg],Color("bbb0b5"),12)
	if s.chain_n > 1:
		text(Vector2(820,108),"%d HIT" % s.chain_n,Color("ffe18b"),25)
	# The bottom key line would sit under the boss bar of the HUD design; the skill icons show the keys.
	if not page_controls_hidden() and not boss_bar_visible(): draw_key_help(s,p)
	if not game.section.locked and game.section.event_index > 0 and not game.section.complete:
		text(Vector2(826,281),"GO  >",Color("ffe18b"),22)
	if game.debug_view.visible:
		draw_rect(Rect2(12,86,365,72),Color(0,0,0,0.75))
		text(Vector2(21,104),"F9  HITBOX / F2 REFILL SP + MAGIC",Color("c1efc5"),12)
		text(Vector2(21,123),"tick %d | hitStop %d | tier %s" % [s.tick,s.hit_stop,s.last_tier],Color("c1efc5"),12)
		text(Vector2(21,143),"%s t=%d | x %.2f  y %.2f  z %.2f" % [p.st,p.t,p.x,p.y,p.z],Color("c1efc5"),12)
	# The F5 game's menu draws its own pause / CONTINUE? / GAME OVER screens over this.
	var menu_shown: bool = game is BmkMenuGame and (game as BmkMenuGame).menu != null and (game as BmkMenuGame).menu.visible
	if (game.clock.paused or game.section.complete or s.game_over) and not menu_shown:
		draw_rect(Rect2(0,0,960,540),Color(0.015,0.01,0.025,0.7))
		var title: String = "SECTION 1 COMPLETE" if game.section.complete else ("GAME OVER" if s.game_over else "PAUSED")
		text(Vector2(304,251),title,Color("e4d5ba"),30)
		text(Vector2(304,288),"R: RESTART STREET" if game.section.complete or s.game_over else "ESC: RESUME    R: RESTART",Color("ddd5dd"),16)

## #skillbar and the key help are page elements, shown only in play: hidden with touch controls,
## and in the tutorial demo view (the browser copies only the canvas into #demoView).
func page_controls_hidden() -> bool:
	return touch_mode() or game is BmkMenuGame and (game as BmkMenuGame).demo.on

func touch_mode() -> bool:
	return game is BmkMenuGame and (game as BmkMenuGame).preferences != null and (game as BmkMenuGame).preferences.touch

## Keyboard help line and the skill cooldown bars (not shown with touch controls).
func draw_key_help(s: BmkSimulation, p: BmkActorState) -> void:
	draw_rect(Rect2(0,490,960,50),Color(0.025,0.02,0.035,0.86))
	var keys: Array[String] = []
	for action: String in BmkPhysicalInput.ACTIONS:
		var events: Array[InputEvent] = InputMap.action_get_events("bmk_" + action)
		keys.append(OS.get_keycode_string((events[0] as InputEventKey).physical_keycode) if not events.is_empty() else "?")
	text(Vector2(18,509),"%s/%s/%s/%s MOVE  %s ATTACK  %s JUMP  %s SPECIAL  %s MAGIC  %s DASH" % [keys[0],keys[1],keys[2],keys[3],keys[5],keys[4],keys[7],keys[8],keys[6]],Color("d0c5ca"),12)
	text(Vector2(18,529),"%s THRUST   %s SLAM   %s WHIRL   %s LEAP   %s RED WAVE" % [keys[9],keys[10],keys[11],keys[12],keys[13]],Color("a3b4c9"),12)
	text(Vector2(659,529),"F1 KEYS   F9 DEBUG   ESC PAUSE   R RESTART",Color("a3b4c9"),11)
	# Skill cooldowns are shown on the HUD icons (BmkHudDesign.draw_skills).
	if game is not BmkMenuGame:
		var index: int = 0
		for skill: BmkAttackData in s.data.skills:
			var x: float = 21 + index * 124
			var remaining: float = p.skill_cd[skill.id]
			bar(Vector2(x,478),108,1.0 - remaining / skill.cooldown_ms,Color("a6badd"))
			if remaining > 0:
				text(Vector2(x,472),"%s %.1f" % [skill.id,remaining / 1000.0],Color("a3a0ad"),11)
			index += 1

## game.js render(): the boss intro replaces the player HUD with its card.
func hud_hidden() -> bool:
	return false

## True while the boss bar of the HUD design is on screen (BmkStageHud).
func boss_bar_visible() -> bool:
	return false

func stage_number() -> int:
	if game != null and game.session is BmkWaveSimulation: return (game.session as BmkWaveSimulation).stage_index + 1
	return 1

func draw_source_hud(p: BmkActorState) -> void:
	if p.is_viesa():
		BmkViesaHud.draw_player(self,p)
		return
	# Player HUD design (pixel-ui.js drawPixelHUD).
	if hp_lag < p.hp or hp_lag < 0: hp_lag = p.hp
	elif not game.clock.paused: hp_lag = maxf(p.hp, hp_lag - 0.5)
	BmkHudDesign.draw_player(self, p, stage_number(), hp_lag)

func draw_source_skills(p: BmkActorState, s: BmkSimulation) -> void:
	if p.is_viesa():
		BmkViesaHud.draw_skills(self,p,s)
		return
	BmkHudDesign.draw_skills(self, p, s, font)
