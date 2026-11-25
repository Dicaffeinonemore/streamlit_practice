class_name BmkHudDesign
extends RefCounted
## Shared HUD v4, in native 960 × 540 coordinates.

const V4_DIR := "res://port_assets/ui/hud-v4"
const ENEMY_DIR := "res://port_assets/ui/enemy-v3"
const SKILL_ART := preload("res://port_assets/images/hud_ui_source__92e93cec0567.png")
const BAREL_FACE := preload("res://port_assets/images/barel_art.portrait__7a615edb604b.png")
const VIESA_FACE := preload("res://port_assets/images/viesa_art.portrait__e86f3aab880e.png")
const INK := Color("080609")
const TEXT := Color("f0dfcf")
const GOLD := Color("d4b06a")
const WINE := Color("2a0a10")
const PAUSE := Rect2(922,12,26,26)
const KEY_GLYPHS := "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"

static var textures: Dictionary = {}
static var faces: Dictionary = {}
static var lettering_font: SystemFont
static var enemy_font: SystemFont

static func lettering() -> Font:
	if lettering_font == null:
		lettering_font = SystemFont.new()
		lettering_font.font_names = PackedStringArray(["Georgia", "Malgun Gothic", "Noto Sans CJK KR", "Arial"])
		lettering_font.font_weight = 700
	return lettering_font

static func compact_texture(name: String, enemy: bool = false) -> Texture2D:
	var path := "%s/%s.png" % [ENEMY_DIR if enemy else V4_DIR, name]
	if not textures.has(path): textures[path] = load(path)
	return textures[path] as Texture2D

static func compact_image(hud: CanvasItem, name: String, at: Vector2, enemy: bool = false) -> void:
	hud.draw_texture(compact_texture(name, enemy), at)

static func compact_fill(hud: CanvasItem, name: String, at: Vector2, ratio: float, enemy: bool = false) -> void:
	var tex := compact_texture(name, enemy)
	var width := floorf(tex.get_width() * clampf(ratio, 0, 1))
	if width > 0:
		var src := Rect2(0,0,width,tex.get_height())
		hud.draw_texture_rect_region(tex,Rect2(at,src.size),src)

static func compact_text(hud: CanvasItem, value: String, at: Vector2, width: float = -1) -> void:
	# The separate enemy-v3 HUD keeps its current label treatment.
	if enemy_font == null:
		enemy_font = SystemFont.new()
		enemy_font.font_names = PackedStringArray(["Arial Rounded MT Bold", "Malgun Gothic", "Noto Sans CJK KR", "Arial"])
		enemy_font.font_weight = 800
	var f := enemy_font
	hud.draw_string_outline(f, at, value, HORIZONTAL_ALIGNMENT_LEFT, width, 10, 2, Color.BLACK)
	hud.draw_string(f, at, value, HORIZONTAL_ALIGNMENT_LEFT, width, 10, TEXT)

static func hud_text(hud: CanvasItem, value: String, at: Vector2, size_: int, width: float, color: Color = TEXT) -> void:
	var font := lettering()
	while size_ > 6 and font.get_string_size(value,HORIZONTAL_ALIGNMENT_LEFT,-1,size_).x > width:
		size_ -= 1
	hud.draw_string(font,at,value,HORIZONTAL_ALIGNMENT_LEFT,width,size_,color)

static func sheet_frame(name: String, frame: int, size_: Vector2) -> AtlasTexture:
	var tile := AtlasTexture.new()
	tile.atlas = compact_texture(name)
	tile.region = Rect2(Vector2(frame * size_.x,0),size_)
	tile.filter_clip = true
	return tile

static func draw_frame(hud: CanvasItem, name: String, frame: int, size_: Vector2, at: Vector2) -> void:
	var src := Rect2(Vector2(frame * size_.x,0),size_)
	hud.draw_texture_rect_region(compact_texture(name),Rect2(at,size_),src)

static func draw_player(hud: CanvasItem, p: BmkActorState, stage: int, hp_lag: float) -> void:
	compact_image(hud,"player_panel",Vector2(12,12))
	var pulse := int(Time.get_ticks_msec() / 180.0) % 2
	if p.buff > 0: draw_frame(hud,"buff_glow",pulse,Vector2(52,52),Vector2(11,11))
	var portrait_box := Rect2(19,19,36,36)
	hud.draw_rect(portrait_box,WINE)
	hud.draw_texture_rect(VIESA_FACE if p.is_viesa() else BAREL_FACE,portrait_box,false)
	if p.buff > 0: hud.draw_rect(Rect2(19,53,roundf(36 * clampf(p.buff / 900.0,0,1)),2),GOLD)
	compact_image(hud,"portrait_frame",Vector2(15,15))
	compact_image(hud,"name_plate",Vector2(60,13))
	hud_text(hud,"VIESA" if p.is_viesa() else "VAREL",Vector2(67,24),10,105)
	compact_image(hud,"life_icon",Vector2(182,16))
	hud_text(hud,"×%d" % maxi(0,p.lives),Vector2(193,24),9,14)

	compact_image(hud,"hp_track",Vector2(63,32))
	compact_fill(hud,"hp_lag_fill",Vector2(63,32),hp_lag / p.max_hp)
	compact_fill(hud,"hp_fill",Vector2(63,32),p.hp / p.max_hp)
	compact_image(hud,"player_bar_frame",Vector2(60,29))
	compact_image(hud,"sp_track",Vector2(63,43))
	compact_fill(hud,"sp_fill",Vector2(63,43),p.sp / 100.0)
	if p.sp >= 100.0:
		hud.draw_rect(Rect2(63,43,144,1),Color("8fd0ff") if pulse else Color("3e8fe8"))
	compact_image(hud,"player_bar_frame",Vector2(60,40))

	for i: int in range(3):
		var at := Vector2(60 + i * 17,51)
		compact_image(hud,"scroll_slot",at)
		compact_image(hud,"scroll_icon" if i < p.mg else "scroll_icon_empty",at + Vector2(2,2))
	compact_image(hud,"score_plate",Vector2(113,54))
	hud_text(hud,"SCORE",Vector2(118,63),7,27,Color("c1b5ae"))
	hud_text(hud,str(p.score),Vector2(148,63),8,33)
	hud.draw_rect(Rect2(183,57,1,6),Color("5e4520"))
	hud_text(hud,"Lv %d" % stage,Vector2(186,63),8,21,GOLD)

static func draw_skills(hud: CanvasItem, p: BmkActorState, _s: BmkSimulation, _font: Font) -> void:
	var actions := ["KeyU","KeyH","KeyO","KeyP","KeyL"]
	var ids := ["thrust","slam","whirl","leap","redwave"]
	for i: int in range(ids.size()):
		var at := Vector2(42 + i * 29,72)
		compact_image(hud,"skill_slot",at)
		var box := Rect2(at + Vector2(5,2),Vector2(16,16))
		if p.is_viesa():
			hud.draw_texture_rect_region(BmkViesaHud.ui_atlas(),box,BmkViesaHud.src(Rect2(952 + i * 140,700,105,120)))
		else:
			hud.draw_texture_rect_region(SKILL_ART,box,Rect2(51 + i * 87.2,201,61,66))
		var id: String = ids[i]
		var remaining: float = p.skill_cd.get(id,0.0)
		if remaining > 0 and not (p.is_viesa() and id == "slam"):
			var src := Rect2(0,0,20,16)
			hud.draw_texture_rect_region(compact_texture("skill_cooldown_mask"),Rect2(at + Vector2(3,2),src.size),src)
			hud_text(hud,"%.1f" % (remaining / 1000.0),at + Vector2(6,13),8,14)
		var events := InputMap.action_get_events("bmk_" + str(actions[i]))
		var key := "?"
		for event: InputEvent in events:
			if event is InputEventKey:
				key = OS.get_keycode_string(event.physical_keycode).to_upper()
				break
		var glyph := KEY_GLYPHS.find(key) if key.length() == 1 else -1
		if glyph >= 0:
			compact_image(hud,"skill_keycap",at + Vector2(8,18))
			draw_glyph(hud,glyph,at + Vector2(10,20))
		else:
			hud.draw_rect(Rect2(at + Vector2(2,18),Vector2(22,8)),INK)
			hud.draw_rect(Rect2(at + Vector2(3,18),Vector2(20,1)),Color("9a7434"))
			hud_text(hud,key,at + Vector2(4,24),7,18)

static func draw_glyph(hud: CanvasItem, glyph: int, at: Vector2) -> void:
	hud.draw_texture_rect_region(compact_texture("key_font"),Rect2(at,Vector2(5,5)),Rect2(glyph*6,0,5,5))

static func face(kind: String) -> Array:
	if faces.has(kind): return faces[kind]
	var picks := {
		"gorath": "gorath_remake.p1_idle", "gorath2": "gorath_remake.p2_idle",
		"boss2": "morgra_art.idle", "boss2_p2": "morgra_art.p2_idle",
		"boss3": "aurelion_art.idle", "boss3_p2": "aurelion_art.awaken",
		"boss4": "vargul_art.p1_idle", "boss4_p2": "vargul_art.p2_idle",
		"boss5": "sovereign_art.idle", "boss5_p2": "sovereign_art.idle_p2",
	}
	if not picks.has(kind): return []
	var asset := load("res://port_assets/resources/%s.tres" % picks[kind]) as BmkAnimationAsset
	if asset == null or asset.sprite_frames == null: return []
	var index := asset.sprite_frames.get_frame_count(&"source") - 1 if kind == "boss3_p2" else 0
	var tex := asset.sprite_frames.get_frame_texture(&"source",index)
	var w := float(tex.get_width())
	var h := float(tex.get_height())
	var side := minf(w * 0.65,h * 0.52)
	var start := Vector2((w-side)/2,0)
	if kind.begins_with("gorath"):
		side = minf(w * 0.4,h)
		start.x = w * 0.56 - side / 2
	elif kind.begins_with("boss3"):
		side = minf(w * 0.65,h * 0.35)
		start = Vector2((w-side)/2,h*0.03)
	elif kind.begins_with("boss4"):
		side = minf(w * 0.65,h * 0.38)
		start = Vector2(w*0.2,h*0.13)
	elif kind.begins_with("boss5"):
		side = minf(w,h * 0.3)
		var pivot := asset.frame_pivots[0].x if not asset.frame_pivots.is_empty() else w * 0.5
		start = Vector2(pivot - side * 0.42,h*0.03)
	var src := Rect2(start,Vector2(side,side)).intersection(Rect2(0,0,w,h))
	var result := [tex,src]
	faces[kind] = result
	return result

static func boss_plate(hud: CanvasItem, x: int, width: int) -> void:
	var tex := compact_texture("boss_name_plate")
	hud.draw_texture_rect_region(tex,Rect2(x,484,11,16),Rect2(0,0,11,16))
	# Repeat the Aseprite center in whole pixels, keeping both end caps intact.
	var middle := width - 15
	for offset: int in range(0,middle,135):
		var length := mini(135,middle-offset)
		hud.draw_texture_rect_region(tex,Rect2(x+11+offset,484,length,16),Rect2(11,0,length,16))
	hud.draw_texture_rect_region(tex,Rect2(x+width-4,484,4,16),Rect2(146,0,4,16))

static func draw_boss(hud: CanvasItem, kind: String, label: String, ratio: float, lag: float, groggy: float, tag: String = "", phase_two: bool = false) -> void:
	var portrait_box := Rect2(262,484,36,36)
	hud.draw_rect(portrait_box,WINE)
	var picked := face(kind)
	if not picked.is_empty(): hud.draw_texture_rect_region(picked[0],portrait_box,picked[1])
	compact_image(hud,"boss_portrait_frame",Vector2(258,480))
	boss_plate(hud,306,190)
	hud_text(hud,label,Vector2(318,495),10,170)
	boss_plate(hud,620,84)
	var phase := "PHASE II" if phase_two else "PHASE I"
	hud_text(hud,tag if not tag.is_empty() else phase,Vector2(632,495),8,48,GOLD)
	draw_frame(hud,"boss_phase_pip",1 if phase_two else 0,Vector2(7,7),Vector2(683,489))
	draw_frame(hud,"boss_phase_pip",0 if phase_two else 1,Vector2(7,7),Vector2(692,489))
	compact_image(hud,"boss_track",Vector2(317,506))
	compact_fill(hud,"boss_lag_fill",Vector2(317,506),lag)
	compact_fill(hud,"boss_hp_fill",Vector2(317,506),ratio)
	compact_image(hud,"boss_bar_frame",Vector2(304,503))
	if groggy > 0:
		compact_image(hud,"boss_groggy_marker",Vector2(317 + roundf(371 * clampf(groggy,0,1)),504))
