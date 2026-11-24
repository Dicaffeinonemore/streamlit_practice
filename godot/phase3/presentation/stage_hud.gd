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
		var prompt: String = BmkCopy.text("PRACTICE_COMPLETE")
		for step: String in guide:
			if not practice.practice_done.has(step):
				prompt = BmkCopy.text("PRACTICE_" + step)
				break
		draw_rect(Rect2(260,82,440,32),Color(0,0,0,0.8))
		draw_string(korean_font,Vector2(275,104),BmkCopy.text("PRACTICE_STATUS") % [practice.practice_done.size(),prompt],HORIZONTAL_ALIGNMENT_LEFT,-1,15,Color("ffe18b"))
	if game is not BmkMenuGame:
		draw_rect(Rect2(298,31,662,29),Color(0.025,0.02,0.035,0.98))
		var names: Array[String] = [BmkCopy.text("SECTION_1"),BmkCopy.text("SECTION_2"),BmkCopy.text("SECTION_3"),BmkCopy.text("SECTION_4"),BmkCopy.text("SECTION_5")]
		text(Vector2(304,49),BmkCopy.text("HUD_SECTION") % [s.sections.idx + 1,names[s.sections.idx]],Color("bbb0b5"),12)
		text(Vector2(755,47),BmkCopy.text("HUD_WAVE") % [s.player.mg,mini(s.sections.event_index + 1,(s.sections.section["events"] as Array).size()),(s.sections.section["events"] as Array).size()],Color("bbb0b5"),12)
	var boss_: BmkStageActor = s.gorath.boss(s)
	if boss_ != null:
		if game is BmkMenuGame: draw_source_boss(boss_)
		else:
			draw_rect(Rect2(168,425,624,47),Color(0.025,0.01,0.025,0.85))
			text(Vector2(180,442),BmkCopy.text("HUD_GORATH") % [boss_.g2.phase,boss_.hp,boss_.max_hp],Color("f6ccaf"),14)
			bar(Vector2(180,449),600,boss_.hp / boss_.max_hp,Color("b91d38"))
			bar(Vector2(180,462),600,boss_.gr / boss_.gr_max,Color("d6a563"))
		if boss_.g2.guard: text(Vector2(680,442),BmkCopy.text("GUARD"),Color("ff755e"),12)
		if boss_.g2.card_t > 0 and boss_.g2.card_t < 130:
			draw_rect(Rect2(0,144,960,92),Color(0.02,0.01,0.04,0.55))
			text(Vector2(340,190),BmkCopy.text("GORATH_CARD"),Color("ffe27a"),42)
			text(Vector2(340,216),BmkCopy.text("THE_BUTCHER"),Color("e8d2cd"),16)
		if s.boss_title > 0: text(Vector2(315,160),BmkCopy.text("RAIN_SLAUGHTERHOUSE"),Color("ffbcaa"),19)
	elif s is BmkWaveSimulation and wave_boss(s as BmkWaveSimulation) != null and s.mode != "bossintro" and wave_boss(s as BmkWaveSimulation).st != "intro":
		var legacy: BmkLegacyActor = wave_boss(s as BmkWaveSimulation)
		draw_source_boss(legacy,BmkCopy.text("BOSS_%d" % (s.stage_index + 1)))
		if legacy.p2shown: text(Vector2(232,432),"II",Color("ffe5dd"),12)
	elif game is BmkMenuGame:
		for actor: BmkActorState in s.enemies:
			if actor.id == s.last_hit_id and actor.st != "dead":
				draw_source_enemy(actor)
				break
	if s is BmkWaveSimulation: draw_wave_overlays(s as BmkWaveSimulation)
	elif s.mode == "bossintro":
		var n: float = s.intro_ms / s.MS
		var total: float = float(s.stage_data.source["G2_INTRO"]["total"])
		var height: float = round(64 * s.ease(minf(1,n / 20)) * clampf((total - n) / 12,0,1))
		draw_rect(Rect2(0,0,960,height),Color("05030a"))
		draw_rect(Rect2(0,540 - height,960,height),Color("05030a"))
	var p: BmkStageActor = s.player as BmkStageActor
	if p.grab != null:
		text(Vector2(285,125),BmkCopy.text("BREAK_FREE") % [p.grab.presses,2 if p.grab.kind == "bite" else 4],Color("ffe1ab"),16)
	if s.sections.fade_t >= 0:
		var alpha: float = s.sections.fade_t / 30.0 if s.sections.fade_t <= 30 else 1 - (s.sections.fade_t - 30) / 30.0
		draw_rect(Rect2(0,0,960,540),Color(0,0,0,alpha))
	if game.show_flash and s.boss_white > 0: draw_rect(Rect2(0,0,960,540),Color(1,1,1,0.6))
	if game.debug_view.visible: text(Vector2(405,102),BmkCopy.text("DEBUG_PHASE"),Color("c1efc5"),12)
	# Standalone Stage 1 scene only; the menu game shows its own result / ending panel.
	if s.mode == "clear" and game is not BmkMenuGame:
		draw_rect(Rect2(0,0,960,540),Color(0.01,0.005,0.02,0.72))
		text(Vector2(282,243),BmkCopy.text("STAGE1_COMPLETE"),Color("ffe18b"),36)
		text(Vector2(282,283),BmkCopy.text("SCORE_RESTART") % s.player.score,Color("e4d5ba"),18)

func hud_hidden() -> bool:
	return game != null and game.session is BmkWaveSimulation and (game.session as BmkWaveSimulation).mode == "bossintro"

func wave_boss(s: BmkWaveSimulation) -> BmkLegacyActor:
	for e: BmkActorState in s.enemies:
		if e.boss: return e as BmkLegacyActor
	return null

## Stage entry banner (scene 'intro') and the boss name card during the boss intro.
func draw_wave_overlays(s: BmkWaveSimulation) -> void:
	# Arena help line while a fire / frost / abyss wave is locked.
	if not s.arena.is_empty() and s.cam_lock:
		var help := BmkCopy.text("HAZARD_" + str(s.arena["kind"]))
		outlined(Vector2(0,540 - 111),help,15,Color("ffe27a"),1.0,korean_font)
	# Stage entry banner (scene 'intro').
	if s.mode == "intro" and s.banner_t > 0:
		var a: float = clampf(minf(s.banner_t,160 - s.banner_t) / 25.0,0,1)
		draw_rect(Rect2(0,200,960,140),Color(0,0,0,0.6 * a))
		outlined(Vector2(0,280),BmkCopy.text("HUD_STAGE") % (s.stage_index + 1),56,Color(1,0.82,0.25,a),a,font)
		outlined(Vector2(0,328),BmkCopy.text("STAGE_TITLE_%d" % (s.stage_index + 1)),28,Color(1,1,1,a),a,korean_font)
	if s.clear_t > 20 and s.mode == "play": outlined(Vector2(0,270),BmkCopy.text("VICTORY"),64,Color(1,0.82,0.25),1.0,font)
	# drawIntroCard(u): letterbox bars, then STAGE n / Korean name / English name and a gold rule.
	if s.mode == "bossintro" and s.intro_boss != null:
		var u: float = s.intro_t / s.intro_duration(s.intro_boss)
		var bh: float = roundf(64 * BmkSimulation.ease(minf(1,u * 7)) * ((1 - (u - 0.9) * 10) if u > 0.9 else 1.0))
		draw_rect(Rect2(0,0,960,bh),Color("05030a"))
		draw_rect(Rect2(0,540 - bh,960,bh),Color("05030a"))
		if u > 0.42 and u < 0.92:
			var k: float = BmkSimulation.ease((u - 0.42) / 0.12)
			var fade: float = maxf(0,1 - (u - 0.84) / 0.08) if u > 0.84 else 1.0
			var off: float = roundf((1 - k) * 240)
			var y: float = 540 - 120
			draw_rect(Rect2(0,y - 46,960,92),Color(5 / 255.0,3 / 255.0,10 / 255.0,0.55 * fade))
			draw_string(font,Vector2(-off,y - 18),BmkCopy.text("HUD_STAGE") % (s.stage_index + 1),HORIZONTAL_ALIGNMENT_CENTER,960,11,Color(1,1,1,fade))
			outlined(Vector2(off,y + 26),BmkCopy.text("BOSS_%d" % (s.stage_index + 1)),34,Color(1,0.89,0.48,fade),fade,korean_font,Color(0.48,0.1,0.14,fade))
			draw_string(font,Vector2(off,y + 42),BmkCopy.text("BOSS_SHORT_%d" % (s.stage_index + 1)),HORIZONTAL_ALIGNMENT_CENTER,960,10,Color(0.95,0.82,0.42,fade))
			var lw: float = roundf(360 * k)
			draw_rect(Rect2(480 - lw / 2,y + 46,lw,2),Color(0.86,0.71,0.27,fade))

func outlined(at: Vector2, value: String, size_: int, color: Color, alpha: float, which: Font, outline: Color = Color(0,0,0,1)) -> void:
	outline.a = alpha
	draw_string_outline(which,at,value,HORIZONTAL_ALIGNMENT_CENTER,960,size_,6,outline)
	draw_string(which,at,value,HORIZONTAL_ALIGNMENT_CENTER,960,size_,color)

func draw_source_boss(boss_: BmkStageActor, label: String = "") -> void:
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
	draw_string(korean_font,origin + Vector2(910 + extra / 2,320) * scale_,label if not label.is_empty() else BmkCopy.text("GORATH_PHASE") % boss_.g2.phase,HORIZONTAL_ALIGNMENT_LEFT,-1,13,Color("ffe5dd"))

func enemy_name(actor: BmkActorState) -> String:
	var name_ := BmkCopy.text("ENEMY_" + actor.species)
	if actor is BmkLegacyActor:
		var stage := (game.session as BmkWaveSimulation).stage_index + 1
		return "%s %s" % [BmkCopy.text("FACTION_%d" % stage),name_]
	return name_

func draw_source_enemy(actor: BmkActorState) -> void:
	if enemy_atlas == null: enemy_atlas = load("res://port_assets/images/enemy_ui_source__92e4bd2e3ff9.png") as Texture2D
	var scale_: float = 290.0 / 1815.0
	var origin: Vector2 = Vector2(662,56)
	draw_texture_rect_region(enemy_atlas,Rect2(origin,Vector2(1815,660) * scale_),Rect2(185,28,1815,660))
	var portrait_center: Vector2 = origin + Vector2(480 - 185,342 - 28) * scale_
	draw_circle(portrait_center,167 * scale_,Color("35090d"))
	var selected: Dictionary
	var animation: BmkAnimationAsset
	if actor is BmkLegacyActor:
		var pose: Dictionary = (game as BmkStageGame).legacy_presenter.pose(game.session as BmkWaveSimulation,actor as BmkLegacyActor)
		animation = pose.get("asset") as BmkAnimationAsset
		selected = {"index":pose.get("index",0)}
	else:
		selected = game.selector.enemy(game.session,actor,game.bank.catalogs["STAGE1_ENEMY_ART"].get(actor.species,{}))
		animation = game.bank.animation(game.actor_animation_id(actor,selected))
	if animation != null:
		var frame: int = clampi(int(selected["index"]),0,animation.sprite_frames.get_frame_count(&"source") - 1)
		var portrait: Texture2D = animation.sprite_frames.get_frame_texture(&"source",frame)
		draw_texture_rect(portrait,Rect2(portrait_center - Vector2(22,29),Vector2(44,58)),false)
	var start: Vector2 = origin + Vector2(697 - 185,332 - 28) * scale_
	draw_rect(Rect2(start,Vector2(1168,63) * scale_),Color("21090e"))
	var fill: float = 1168 * clampf(actor.hp / actor.max_hp,0,1)
	if fill > 0: draw_texture_rect_region(enemy_atlas,Rect2(start,Vector2(fill,63) * scale_),Rect2(760,332,800,63))
	draw_string(korean_font,origin + Vector2(140,36),enemy_name(actor),HORIZONTAL_ALIGNMENT_CENTER,120,12,Color("ffe5dd"))
