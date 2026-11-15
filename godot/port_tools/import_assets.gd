extends SceneTree
## Run after --editor --import. Does not modify the existing game's main scene.
const AnimationAsset: Script = preload("res://port_tools/animation_asset.gd")
var failures: Array[String] = []
var texture_cache: Dictionary[String, Texture2D] = {}

func _initialize() -> void:
	call_deferred("run")

func run() -> void:
	var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string("res://port_assets/catalogs/animations.json"))
	if not parsed is Dictionary:
		push_error("Animation catalog is invalid")
		quit(1)
		return
	var catalog: Dictionary = parsed
	var animations: Array = catalog["animations"]
	var frame_count: int = 0
	DirAccess.make_dir_recursive_absolute("res://port_assets/resources")
	var index: Array[Dictionary] = []
	for value: Variant in animations:
		var animation: Dictionary = value
		var id: String = str(animation["id"])
		var resource: Resource = AnimationAsset.new()
		resource.set("source_id", id)
		resource.set("metadata", animation.get("metadata", {}))
		var frames: SpriteFrames = SpriteFrames.new()
		frames.resource_scene_unique_id = "source_frames"
		frames.remove_animation(&"default")
		frames.add_animation(&"source")
		frames.set_animation_speed(&"source", 1000.0)
		frames.set_animation_loop(&"source", bool(animation.get("metadata", {}).get("loop", false)))
		var pivots: PackedVector2Array = PackedVector2Array()
		var scales: PackedFloat64Array = PackedFloat64Array()
		var durations: PackedFloat64Array = PackedFloat64Array()
		var authoritative: PackedByteArray = PackedByteArray()
		var source_frames: Array[Dictionary] = []
		for frame_value: Variant in animation["frames"]:
			var f: Dictionary = frame_value
			var path: String = "res://" + str(f["image"])
			if not texture_cache.has(path):
				var loaded: Resource = load(path)
				if not loaded is Texture2D:
					failures.append("Unsupported texture: " + path)
					continue
				texture_cache[path] = loaded as Texture2D
			var image: Texture2D = texture_cache[path]
			var rect: Array = f["rect"]
			var region: Rect2 = Rect2(float(rect[0]), float(rect[1]), float(rect[2]), float(rect[3]))
			if region.position.x < 0 or region.position.y < 0 or region.end.x > image.get_width() or region.end.y > image.get_height():
				failures.append("Frame out of bounds: " + id)
			var atlas: AtlasTexture = AtlasTexture.new()
			atlas.resource_scene_unique_id = "frame_%d" % pivots.size()
			atlas.atlas = image
			atlas.region = region
			atlas.filter_clip = true
			var duration: float = float(f["duration_ms"]) if f.get("duration_ms") != null else 100.0
			frames.add_frame(&"source", atlas, duration)
			var pivot: Array = f["pivot"]
			pivots.append(Vector2(float(pivot[0]), float(pivot[1])))
			scales.append(float(f["scale"]))
			durations.append(duration)
			authoritative.append(1 if f.get("duration_ms") != null else 0)
			source_frames.append(f)
			frame_count += 1
		resource.set("sprite_frames", frames)
		resource.set("frame_pivots", pivots)
		resource.set("frame_scales", scales)
		resource.set("duration_ms", durations)
		resource.set("authoritative_duration", authoritative)
		resource.set("source_frames", source_frames)
		var output: String = "res://port_assets/resources/" + id + ".tres"
		var result: Error = ResourceSaver.save(resource, output)
		if result != OK:
			failures.append("Failed to save: " + output)
		else:
			# Portable resources resolve by path; generated editor UIDs are machine-local.
			var text: String = FileAccess.get_file_as_string(output)
			var uid_pattern: RegEx = RegEx.new()
			uid_pattern.compile(' uid="[^"]*"')
			text = uid_pattern.sub(text, "", true)
			var saved: FileAccess = FileAccess.open(output, FileAccess.WRITE)
			saved.store_string(text)
		index.append({"id": id, "path": output, "frames": frames.get_frame_count(&"source")})
	var file: FileAccess = FileAccess.open("res://port_assets/resources/index.json", FileAccess.WRITE)
	file.store_string(JSON.stringify(index, "\t", true))
	for failure: String in failures:
		push_error(failure)
	print("IMPORT: %d animation Resources, %d frames, %d errors" % [index.size(), frame_count, failures.size()])
	quit(0 if failures.is_empty() else 1)
