extends SceneTree
## Verify native resource round-trips against the independent extraction catalog.
var failures: Array[String] = []
var checked: int = 0

func _initialize() -> void:
	call_deferred("run")

func require_value(condition: bool, message: String) -> void:
	checked += 1
	if not condition:
		failures.append(message)

func run() -> void:
	var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string("res://port_assets/catalogs/animations.json"))
	var catalog: Dictionary = parsed as Dictionary
	for entry_value: Variant in catalog["animations"]:
		var entry: Dictionary = entry_value
		var id: String = str(entry["id"])
		var asset: Resource = load("res://port_assets/resources/" + id + ".tres")
		require_value(asset != null, "Resource missing: " + id)
		if asset == null:
			continue
		var frames: SpriteFrames = asset.get("sprite_frames") as SpriteFrames
		var pivots: PackedVector2Array = asset.get("frame_pivots")
		var scales: PackedFloat64Array = asset.get("frame_scales")
		var durations: PackedFloat64Array = asset.get("duration_ms")
		var authority: PackedByteArray = asset.get("authoritative_duration")
		var expected: Array = entry["frames"]
		require_value(frames.get_frame_count(&"source") == expected.size(), "Frame count: " + id)
		require_value(pivots.size() == expected.size() and scales.size() == expected.size(), "Metadata count: " + id)
		for i: int in range(expected.size()):
			var f: Dictionary = expected[i]
			var atlas: AtlasTexture = frames.get_frame_texture(&"source", i) as AtlasTexture
			var rect: Array = f["rect"]
			var pivot: Array = f["pivot"]
			require_value(atlas != null and atlas.region == Rect2(float(rect[0]), float(rect[1]), float(rect[2]), float(rect[3])), "Atlas rect: " + id)
			require_value(pivots[i].is_equal_approx(Vector2(float(pivot[0]), float(pivot[1]))), "Foot pivot: " + id)
			require_value(is_equal_approx(scales[i], float(f["scale"])), "Scale: " + id)
			var duration: float = float(f["duration_ms"]) if f.get("duration_ms") != null else 100.0
			require_value(is_equal_approx(durations[i], duration), "Duration: " + id)
			require_value(authority[i] == (1 if f.get("duration_ms") != null else 0), "Timing authority: " + id)
	var audio_parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string("res://port_assets/catalogs/audio.json"))
	var audio: Dictionary = audio_parsed as Dictionary
	for track_value: Variant in audio["music"]:
		var track: Dictionary = track_value
		var stream: AudioStreamOggVorbis = load("res://" + str(track["file"])) as AudioStreamOggVorbis
		require_value(stream != null, "Music import: " + str(track["id"]))
		if stream != null:
			var expected_length: float = float(track["loop_end"]) / float(track["sample_rate"])
			require_value(absf(stream.get_length() - expected_length) < 0.001, "Music sample length: " + str(track["id"]))
	for sample_value: Variant in audio["embedded"] + audio["synthesized"]:
		var sample: Dictionary = sample_value
		var stream: AudioStream = load("res://" + str(sample["file"])) as AudioStream
		require_value(stream != null and stream.get_length() > 0.0, "SFX import: " + str(sample["file"]))
	for failure: String in failures:
		push_error(failure)
	print("VERIFY: %d checks, %d errors" % [checked, failures.size()])
	quit(0 if failures.is_empty() else 1)
