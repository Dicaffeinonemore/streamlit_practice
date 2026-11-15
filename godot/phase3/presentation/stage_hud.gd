class_name BmkStageHud
extends BmkGameHud

func _draw() -> void:
	super._draw()
	if game == null or game.session is not BmkStageSimulation: return
	var s: BmkStageSimulation = game.session as BmkStageSimulation
	draw_rect(Rect2(298,31,662,29),Color(0.025,0.02,0.035,0.98))
	var names: Array[String] = ["OCCUPIED STREET","CONQUERED MARKET","HOUND KENNEL","EXECUTION PLAZA","BUTCHER'S ARENA"]
	text(Vector2(304,49),"STAGE 1 / %d OF 5 / %s" % [s.sections.idx + 1,names[s.sections.idx]],Color("bbb0b5"),12)
	text(Vector2(755,47),"MAGIC %d   WAVE %d/%d" % [s.player.mg,mini(s.sections.event_index + 1,(s.sections.section["events"] as Array).size()),(s.sections.section["events"] as Array).size()],Color("bbb0b5"),12)
	var boss_: BmkStageActor = s.gorath.boss(s)
	if boss_ != null:
		draw_rect(Rect2(168,425,624,47),Color(0.025,0.01,0.025,0.85))
		text(Vector2(180,442),"GORATH / PHASE %d     HP %d / %d" % [boss_.g2.phase,boss_.hp,boss_.max_hp],Color("f6ccaf"),14)
		bar(Vector2(180,449),600,boss_.hp / boss_.max_hp,Color("b91d38"))
		bar(Vector2(180,462),600,boss_.gr / boss_.gr_max,Color("d6a563"))
		if boss_.g2.guard: text(Vector2(680,442),"GUARD",Color("ff755e"),12)
		if boss_.g2.card_t > 0 and boss_.g2.card_t < 130:
			draw_rect(Rect2(0,144,960,92),Color(0.02,0.01,0.04,0.55))
			text(Vector2(340,190),"GORATH",Color("ffe27a"),42)
			text(Vector2(340,216),"THE BUTCHER",Color("e8d2cd"),16)
		if s.boss_title > 0: text(Vector2(315,160),"RAIN OF THE SLAUGHTERHOUSE",Color("ffbcaa"),19)
	if s.mode == "bossintro":
		var n: float = s.intro_ms / s.MS
		var total: float = float(s.stage_data.source["G2_INTRO"]["total"])
		var height: float = round(64 * s.ease(minf(1,n / 20)) * clampf((total - n) / 12,0,1))
		draw_rect(Rect2(0,0,960,height),Color("05030a"))
		draw_rect(Rect2(0,540 - height,960,height),Color("05030a"))
	var p: BmkStageActor = s.player as BmkStageActor
	if p.grab != null:
		text(Vector2(285,125),"TAP ATTACK / DIRECTIONS TO ESCAPE  %d / %d" % [p.grab.presses,2 if p.grab.kind == "bite" else 4],Color("ffe1ab"),16)
	if s.sections.fade_t >= 0:
		var alpha: float = s.sections.fade_t / 30.0 if s.sections.fade_t <= 30 else 1 - (s.sections.fade_t - 30) / 30.0
		draw_rect(Rect2(0,0,960,540),Color(0,0,0,alpha))
	if s.boss_white > 0: draw_rect(Rect2(0,0,960,540),Color(1,1,1,0.6))
	if game.debug_view.visible: text(Vector2(405,102),"1-5 SECTION   F10 PHASE 2   F11 ULTIMATE",Color("c1efc5"),12)
	if s.mode == "clear":
		draw_rect(Rect2(0,0,960,540),Color(0.01,0.005,0.02,0.72))
		text(Vector2(282,243),"STAGE 1 COMPLETE",Color("ffe18b"),36)
		text(Vector2(282,283),"SCORE %d    R: RESTART" % s.player.score,Color("e4d5ba"),18)
