class_name BmkStageHud
extends BmkGameHud
var boss_atlas: Texture2D
var enemy_atlas: Texture2D

func _draw() -> void:
	super._draw()
	if game == null or game.session is not BmkStageSimulation: return
	var s: BmkStageSimulation = game.session as BmkStageSimulation
	if game is BmkMenuGame and (game as BmkMenuGame).game_mode == "practice":
		var practice: BmkMenuGame = game as BmkMenuGame
		var guide: Array[String] = ["move","attack","jump","dash","skill"]
		var labels: Dictionary = {"move":"이동하기", "attack":"허수아비 공격", "jump":"점프", "dash":"회피", "skill":"기술 명중"}
		var prompt: String = "연습 완료!"
		for step: String in guide:
			if not practice.practice_done.has(step):
				prompt = str(labels[step])
				break
		draw_rect(Rect2(260,82,440,32),Color(0,0,0,0.8))
		draw_string(korean_font,Vector2(275,104),"연습 %d / 5   %s" % [practice.practice_done.size(),prompt],HORIZONTAL_ALIGNMENT_LEFT,-1,15,Color("ffe18b"))
	if game is not BmkMenuGame:
		draw_rect(Rect2(298,31,662,29),Color(0.025,0.02,0.035,0.98))
		var names: Array[String] = ["OCCUPIED STREET","CONQUERED MARKET","HOUND KENNEL","EXECUTION PLAZA","BUTCHER'S ARENA"]
		text(Vector2(304,49),"STAGE 1 / %d OF 5 / %s" % [s.sections.idx + 1,names[s.sections.idx]],Color("bbb0b5"),12)
		text(Vector2(755,47),"MAGIC %d   WAVE %d/%d" % [s.player.mg,mini(s.sections.event_index + 1,(s.sections.section["events"] as Array).size()),(s.sections.section["events"] as Array).size()],Color("bbb0b5"),12)
	var boss_: BmkStageActor = s.gorath.boss(s)
	if boss_ != null:
		if game is BmkMenuGame: draw_source_boss(boss_)
		else:
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
	elif game is BmkMenuGame:
		for actor: BmkActorState in s.enemies:
			if actor.id == s.last_hit_id and actor.st != "dead":
				draw_source_enemy(actor)
				break
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
	if game.show_flash and s.boss_white > 0: draw_rect(Rect2(0,0,960,540),Color(1,1,1,0.6))
	if game.debug_view.visible: text(Vector2(405,102),"1-5 SECTION   F10 PHASE 2   F11 ULTIMATE",Color("c1efc5"),12)
	if s.mode == "clear":
		draw_rect(Rect2(0,0,960,540),Color(0.01,0.005,0.02,0.72))
		text(Vector2(282,243),"STAGE 1 COMPLETE",Color("ffe18b"),36)
		text(Vector2(282,283),"SCORE %d    R: RESTART" % s.player.score,Color("e4d5ba"),18)

func draw_source_boss(boss_: BmkStageActor) -> void:
	if boss_atlas == null: boss_atlas = load("res://port_assets/images/boss_ui_source__29c360191ddf.png") as Texture2D
	var scale_: float = 600.0 / 2172.0
	var origin: Vector2 = Vector2(140,350)
	var extra: float = 680.0 / scale_ - 2172.0
	for part: Array in [[0,500,0,500],[500,1300,500,1300 + extra],[1800,372,1800 + extra,372]]:
		draw_texture_rect_region(boss_atlas,Rect2(origin + Vector2(float(part[2]),0) * scale_,Vector2(float(part[3]),724) * scale_),Rect2(float(part[0]),0,float(part[1]),724))
	var width: float = 1588 + extra
	var start: Vector2 = origin + Vector2(342,342) * scale_
	draw_rect(Rect2(start,Vector2(width,58) * scale_),Color("1b0c12"))
	var fill: float = width * clampf(boss_.hp / boss_.max_hp,0,1)
	if fill > 0: draw_texture_rect_region(boss_atlas,Rect2(start,Vector2(fill,58) * scale_),Rect2(400,342,1000,58))
	draw_rect(Rect2(origin + Vector2(380,416) * scale_,Vector2((1500 + extra) * scale_ * clampf(boss_.gr / boss_.gr_max,0,1),2)),Color("cfab70"))
	draw_string(korean_font,origin + Vector2(910 + extra / 2,320) * scale_,"도살자 고라스  %d단계" % boss_.g2.phase,HORIZONTAL_ALIGNMENT_LEFT,-1,13,Color("ffe5dd"))

func draw_source_enemy(actor: BmkActorState) -> void:
	if enemy_atlas == null: enemy_atlas = load("res://port_assets/images/enemy_ui_source__92e4bd2e3ff9.png") as Texture2D
	var scale_: float = 290.0 / 1815.0
	var origin: Vector2 = Vector2(662,56)
	draw_texture_rect_region(enemy_atlas,Rect2(origin,Vector2(1815,660) * scale_),Rect2(185,28,1815,660))
	var portrait_center: Vector2 = origin + Vector2(480 - 185,342 - 28) * scale_
	draw_circle(portrait_center,167 * scale_,Color("35090d"))
	var selected: Dictionary = game.selector.enemy(game.session,actor,game.bank.catalogs["STAGE1_ENEMY_ART"].get(actor.species,{}))
	var animation: BmkAnimationAsset = game.bank.animation(game.actor_animation_id(actor,selected))
	if animation != null:
		var frame: int = clampi(int(selected["index"]),0,animation.sprite_frames.get_frame_count(&"source") - 1)
		var portrait: Texture2D = animation.sprite_frames.get_frame_texture(&"source",frame)
		draw_texture_rect(portrait,Rect2(portrait_center - Vector2(22,29),Vector2(44,58)),false)
	var start: Vector2 = origin + Vector2(697 - 185,332 - 28) * scale_
	draw_rect(Rect2(start,Vector2(1168,63) * scale_),Color("21090e"))
	var fill: float = 1168 * clampf(actor.hp / actor.max_hp,0,1)
	if fill > 0: draw_texture_rect_region(enemy_atlas,Rect2(start,Vector2(fill,63) * scale_),Rect2(760,332,800,63))
	draw_string(korean_font,origin + Vector2(140,36),actor.species.to_upper(),HORIZONTAL_ALIGNMENT_CENTER,120,12,Color("ffe5dd"))
