extends SceneTree
## Phase 13: cuts every original image wider or taller than LIMIT into lossless PNG tiles for
## BmkTiledTexture, and writes port_assets/tiles/tiles.json. Run in the editor binary, then --import:
##   Godot --headless --path godot --script res://phase13/tools/split_oversized_textures.gd
##   Godot --headless --path godot --import
## Cuts fall only between the AtlasTexture regions that use the image, so no frame is split. The
## originals and the extracted resources are not modified. Re-run after re-extracting Phase 1 assets.
const LIMIT: int = 8192
const OUT: String = "res://port_assets/tiles"

func _initialize() -> void:
	var regions: Dictionary = {}  # texture path -> Array[Rect2]
	var sizes: Dictionary = {}
	for file: String in DirAccess.get_files_at("res://port_assets/resources"):
		if not file.ends_with(".tres"): continue
		var asset: Resource = load("res://port_assets/resources/" + file)
		var frames: SpriteFrames = asset.get("sprite_frames") as SpriteFrames if asset != null else null
		if frames == null: continue
		for anim: StringName in frames.get_animation_names():
			for i: int in range(frames.get_frame_count(anim)):
				var atlas: AtlasTexture = frames.get_frame_texture(anim,i) as AtlasTexture
				if atlas == null or atlas.atlas == null: continue
				var path: String = atlas.atlas.resource_path
				sizes[path] = atlas.atlas.get_size()
				if not regions.has(path): regions[path] = []
				(regions[path] as Array).append(atlas.region)
	var manifest: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://port_assets/catalogs/asset_map.json")) as Dictionary
	for entry: Dictionary in manifest["entries"]:
		var path: String = "res://" + str(entry["destination"])
		if sizes.has(path) or not ResourceLoader.exists(path): continue
		var texture: Texture2D = load(path) as Texture2D
		if texture != null: sizes[path] = texture.get_size()
	DirAccess.make_dir_recursive_absolute(OUT)
	var result: Dictionary = {}
	var failures: int = 0
	var paths: Array = sizes.keys()
	paths.sort()
	for path: String in paths:
		var size: Vector2 = sizes[path]
		if maxf(size.x,size.y) <= LIMIT: continue
		var axis: int = 0 if size.x >= size.y else 1
		var length: int = int(size[axis])
		var used: Array = regions.get(path,[])
		var cuts: Array[int] = [0]
		while length - cuts.back() > LIMIT:
			var start: int = cuts.back()
			var best: int = -1
			var candidates: Array[int] = [start + LIMIT]
			for r: Rect2 in used:
				candidates.append(int(r.position[axis]))
				candidates.append(int(r.end[axis]))
			for c: int in candidates:
				if c <= start or c > start + LIMIT or c <= best: continue
				var crosses: bool = false
				for r: Rect2 in used:
					if r.position[axis] < c and r.end[axis] > c: crosses = true; break
				if not crosses: best = c
			if best < 0:
				push_error("No frame-safe cut for " + path)
				failures += 1
				break
			cuts.append(best)
		cuts.append(length)
		var image: Image = Image.load_from_file(ProjectSettings.globalize_path(path))
		image.convert(Image.FORMAT_RGBA8)
		var rebuilt: Image = Image.create_empty(image.get_width(),image.get_height(),false,Image.FORMAT_RGBA8)
		var tiles: Array = []
		for i: int in range(cuts.size() - 1):
			var origin: Vector2i = Vector2i(cuts[i],0) if axis == 0 else Vector2i(0,cuts[i])
			var extent: Vector2i = Vector2i(cuts[i + 1] - cuts[i],image.get_height()) if axis == 0 else Vector2i(image.get_width(),cuts[i + 1] - cuts[i])
			var tile: Image = image.get_region(Rect2i(origin,extent))
			var tile_path: String = "%s/%s.tile%d.png" % [OUT,path.get_file().get_basename(),i]
			if tile.save_png(tile_path) != OK: failures += 1
			rebuilt.blit_rect(Image.load_from_file(ProjectSettings.globalize_path(tile_path)),Rect2i(Vector2i.ZERO,extent),origin)
			tiles.append({"path":tile_path.trim_prefix("res://"),"origin":[origin.x,origin.y],"size":[extent.x,extent.y]})
		var identical: bool = rebuilt.get_data() == image.get_data()
		if not identical: failures += 1
		result[path] = {"size":[int(size.x),int(size.y)],"tiles":tiles,"frames":used.size(),"identical":identical}
		print("%s %dx%d -> %d tiles, cuts %s, %d frames, lossless=%s" % [path.get_file(),int(size.x),int(size.y),tiles.size(),str(cuts),used.size(),identical])
	var file: FileAccess = FileAccess.open(OUT + "/tiles.json",FileAccess.WRITE)
	file.store_string(JSON.stringify({"limit":LIMIT,"textures":result},"  ",true))
	file.close()
	print("SPLIT: %d oversized textures, %d failures" % [result.size(),failures])
	quit(0 if failures == 0 else 1)
