class_name BmkTiledTexture
extends Texture2D
## Phase 13: one source image drawn from several GPU textures.
##
## WebGL 2 without a GPU (SwiftShader) and many phone GPUs cannot hold a texture wider or taller than
## 8192 px; Godot then draws it black. Two original images exceed that (named_art.atlas, 2048 x 9840,
## and the plaza layer-3 strip, 15408 x 178). phase13/tools/split_oversized_textures.gd cuts them,
## losslessly and only between frames, into tiles under port_assets/tiles/. This texture keeps the
## original size and coordinates, so every AtlasTexture region and catalog rect stays as extracted,
## and draws each requested source rectangle from the tile(s) that hold it.
var size: Vector2i
var tiles: Array[Texture2D] = []
var origins: PackedVector2Array = PackedVector2Array()

static func from_manifest(entry: Dictionary) -> BmkTiledTexture:
	var t: BmkTiledTexture = BmkTiledTexture.new()
	t.size = Vector2i(int(entry["size"][0]),int(entry["size"][1]))
	for tile: Dictionary in entry["tiles"]:
		t.tiles.append(load("res://" + str(tile["path"])) as Texture2D)
		t.origins.append(Vector2(float(tile["origin"][0]),float(tile["origin"][1])))
	return t

func _get_width() -> int:
	return size.x

func _get_height() -> int:
	return size.y

func _has_alpha() -> bool:
	return true

func _is_pixel_opaque(x: int, y: int) -> bool:
	return true

func _draw(to_canvas_item: RID, pos: Vector2, modulate: Color, transpose: bool) -> void:
	_draw_rect_region(to_canvas_item,Rect2(pos,size),Rect2(Vector2.ZERO,size),modulate,transpose,false)

func _draw_rect(to_canvas_item: RID, rect: Rect2, tile: bool, modulate: Color, transpose: bool) -> void:
	_draw_rect_region(to_canvas_item,rect,Rect2(Vector2.ZERO,size),modulate,transpose,false)

## Maps source → destination as one rectangle would (negative destination sizes flip), split per tile.
func _draw_rect_region(to_canvas_item: RID, rect: Rect2, src_rect: Rect2, modulate: Color, transpose: bool, clip_uv: bool) -> void:
	if src_rect.size.x == 0 or src_rect.size.y == 0: return
	var scale: Vector2 = rect.size / src_rect.size
	if transpose: scale = Vector2(rect.size.x / src_rect.size.y,rect.size.y / src_rect.size.x)
	for i: int in range(tiles.size()):
		var part: Rect2 = src_rect.intersection(Rect2(origins[i],tiles[i].get_size()))
		if not part.has_area(): continue
		var offset: Vector2 = part.position - src_rect.position
		var dest: Rect2
		if transpose: dest = Rect2(rect.position + Vector2(offset.y,offset.x) * scale,Vector2(part.size.y,part.size.x) * scale)
		else: dest = Rect2(rect.position + offset * scale,part.size * scale)
		tiles[i].draw_rect_region(to_canvas_item,dest,Rect2(part.position - origins[i],part.size),modulate,transpose,clip_uv)
