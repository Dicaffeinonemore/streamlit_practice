extends SceneTree
## Phase 11: the native mix against audio.js. Run headless:
##   Godot_v4.7.2-stable_win64_console.exe --headless --path godot --script phase11/verify_audio.gd
var failures: Array[String] = []
var checks: int = 0
var saved_preferences: Variant = null
var saved_boss: Variant = null

func check(value: bool, label: String) -> void:
	checks += 1
	if not value: failures.append(label)

func near(a: float, b: float, tolerance: float = 0.001) -> bool:
	return absf(a - b) <= tolerance

func _initialize() -> void:
	call_deferred("run")

func backup() -> void:
	for pair: Array in [[BmkGameAudio.PREFERENCES, "saved_preferences"], [BmkGameAudio.BOSS_COPY, "saved_boss"]]:
		if FileAccess.file_exists(pair[0]):
			set(pair[1], FileAccess.get_file_as_bytes(pair[0]))
			DirAccess.remove_absolute(pair[0])

func restore() -> void:
	for pair: Array in [[BmkGameAudio.PREFERENCES, saved_preferences], [BmkGameAudio.BOSS_COPY, saved_boss]]:
		if FileAccess.file_exists(pair[0]): DirAccess.remove_absolute(pair[0])
		if pair[1] != null:
			var file: FileAccess = FileAccess.open(pair[0], FileAccess.WRITE)
			file.store_buffer(pair[1])
			file.close()

func make_audio() -> BmkGameAudio:
	var audio: BmkGameAudio = BmkGameAudio.new()
	root.add_child(audio)
	return audio

func wait(seconds: float) -> void:
	await create_timer(seconds).timeout

static func wav_bytes(seconds: float) -> PackedByteArray:
	var rate: int = 22050
	var count: int = int(seconds * rate)
	var data: PackedByteArray = PackedByteArray()
	data.resize(count * 2)
	for i: int in range(count): data.encode_s16(i * 2, int(sin(TAU * 440.0 * i / rate) * 8000.0))
	var header: PackedByteArray = PackedByteArray()
	header.resize(44)
	header.encode_u32(0, 0x46464952)
	header.encode_u32(4, 36 + data.size())
	header.encode_u32(8, 0x45564157)
	header.encode_u32(12, 0x20746d66)
	header.encode_u32(16, 16)
	header.encode_u16(20, 1)
	header.encode_u16(22, 1)
	header.encode_u32(24, rate)
	header.encode_u32(28, rate * 2)
	header.encode_u16(32, 2)
	header.encode_u16(34, 16)
	header.encode_u32(36, 0x61746164)
	header.encode_u32(40, data.size())
	return header + data

func run() -> void:
	backup()
	var audio: BmkGameAudio = make_audio()
	# ---- mix graph (audio.js setup()) and volumes (setVolumes)
	var mix: int = AudioServer.get_bus_index(BmkGameAudio.MIX_BUS)
	var sfx: int = AudioServer.get_bus_index(BmkGameAudio.SFX_BUS)
	var music_bus: int = AudioServer.get_bus_index(BmkGameAudio.MUSIC_BUS)
	check(mix >= 0 and sfx >= 0 and music_bus >= 0, "Mix, SFX and music buses exist")
	check(AudioServer.get_bus_send(sfx) == BmkGameAudio.MIX_BUS and AudioServer.get_bus_send(music_bus) == BmkGameAudio.MIX_BUS and AudioServer.get_bus_send(mix) == &"Master", "SFX and music send to the mix bus, the mix to Master")
	var amplify: AudioEffectAmplify = AudioServer.get_bus_effect(mix, 0) as AudioEffectAmplify
	var compressor: AudioEffectCompressor = AudioServer.get_bus_effect(mix, 1) as AudioEffectCompressor
	var fit: Dictionary = (JSON.parse_string(FileAccess.get_file_as_string("res://phase11/fixtures/compressor_curve.json")) as Dictionary)["godot"]
	check(amplify != null and near(db_to_linear(amplify.volume_db), 0.8), "Master gain .8 before the compressor")
	check(compressor != null and near(compressor.threshold, fit["threshold_db"]) and near(compressor.ratio, fit["ratio"]) and near(compressor.gain, fit["gain_db"]), "Compressor uses the fitted browser curve")
	audio.set_levels(0.7, 0.8)
	check(near(AudioServer.get_bus_volume_linear(music_bus), 0.7) and near(AudioServer.get_bus_volume_linear(sfx), 0.72), "musB .34 x music (scores carry .34) and sfxB .9 x effects")
	# ---- routing (audio.js sfx())
	var r: Dictionary = audio.route("hurtH")
	check(r.get("id") == "hurt" and bool(r["guarded"]) and float(r["offset"]) > 0.0, "hurtH plays Barel's hurt sample with its offset and repeat guard")
	check(near(float(audio.route("barelCombo")["duration"]), 0.88), "The special's combo sample is cut at 0.88 s")
	check(audio.route("viesaArrow").get("offset") == 0.0 and not bool(audio.route("viesaArrow")["guarded"]), "Viesa samples start at 0 without a guard")
	check(audio.route("aurelionExplosion").get("id") == "aurelionExplosion" and audio.route("aurelionExplosion")["offset"] == 0.0, "Aurelion's explosion sample plays like Viesa's")
	check(audio.route("aurelionWave").get("id") == "aurelionWave" and bool(audio.route("aurelionWave")["guarded"]), "Aurelion's wave sample plays like Barel's")
	check(float(audio.route("mobdie")["offset"]) > 0.0 and audio.route("g2hook").get("id") == "g2hook", "Enemy death and Gorath samples")
	check(audio.route("swing", 1).get("id") == "swing_1" and near(float(audio.route("swing", 1)["gain"]), 2.0) and audio.route("swing", 7).get("id") == "swing_2", "Synthesized effects play at 1 / synth_render_gain, variant 0-2")
	check(audio.route("nope").is_empty(), "Unknown sounds are silent")
	# Every sound the original game requested in all phase traces has a native route.
	var missing: Dictionary = {}
	for phase: String in ["phase2","phase3","phase5","phase6","phase7","phase8","phase9"]:
		var fixture: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://%s/fixtures/traces.json" % phase)) as Dictionary
		for trace: Dictionary in fixture["traces"]:
			for frame: Dictionary in trace["frames"]:
				for request: Array in frame.get("audio", []):
					if request[0] == "sfx" and audio.route(str(request[1]), int(request[2])).is_empty(): missing[str(request[1])] = true
	check(missing.is_empty(), "Every traced sound has a route: missing %s" % [missing.keys()])
	# ---- music transitions (music(), stop(fade))
	audio.stage_number = 2
	audio.play_track("stage")
	var first: AudioStreamPlayer = audio.music
	check(audio.track_id == "stage" and (first.stream as AudioStreamOggVorbis) != null and (first.stream as AudioStreamOggVorbis).loop and first.stream.resource_path.ends_with("stage_2_loop.ogg"), "Stage music loops the stage's score")
	await wait(0.4)
	check(first.volume_linear > 0.3 and first.volume_linear < 0.7, "Stage music fades in over .8 s (%.2f at .4 s)" % first.volume_linear)
	await wait(0.6)
	check(near(first.volume_linear, 1.0, 0.01), "Stage music reaches full level")
	audio.play_track("boss")
	var boss: AudioStreamPlayer = audio.music
	check(boss != first and boss.stream is AudioStreamMP3 and (boss.stream as AudioStreamMP3).loop, "Boss music uses the game mp3, looped")
	await wait(0.3)
	check(first.volume_linear > 0.35 and first.volume_linear < 0.65, "Previous track fades out over .6 s (%.2f at .3 s)" % first.volume_linear)
	await wait(0.6)
	check(first.stream == null and near(boss.volume_linear, 0.68, 0.02), "Old track released; the boss file plays at .34 x 2")
	audio.play_track("victory")
	var victory: AudioStreamInteractive = audio.music.stream as AudioStreamInteractive
	check(victory != null and victory.clip_count == 2 and victory.get_clip_auto_advance(0) == AudioStreamInteractive.AUTO_ADVANCE_ENABLED and victory.get_clip_auto_advance_next_clip(0) == 1, "Victory fanfare advances to its loop without a gap")
	await wait(0.1)
	check(near(audio.music.volume_linear, 1.0, 0.01), "The fanfare enters over .05 s")
	audio.play_track("ending")
	check((audio.music.stream as AudioStreamInteractive).get_clip_stream(0).resource_path.ends_with("ending_intro.wav"), "Final clear plays the ending score")
	audio.play_track("stop", 0.3)
	var stopping: AudioStreamPlayer = audio.music
	check(audio.wanted.is_empty() and audio.track_id == "stop", "AUDIO.stop forgets the requested track")
	await wait(0.45)
	check(stopping.stream == null, "Stopped music is released after its fade")
	# ---- pause (AudioContext.suspend)
	audio.play_track("stage")
	audio.pause_audio(true)
	var level: float = audio.music.volume_linear
	await wait(0.3)
	check(audio.paused and audio.music_tweens[audio.music_index] != null and not audio.music_tweens[audio.music_index].is_running() and near(audio.music.volume_linear, level), "Pause freezes the music fade (%.3f -> %.3f)" % [level, audio.music.volume_linear])
	check(audio.route("swing").size() > 0, "Routing is available while paused")
	audio.pause_audio(false)
	await wait(0.9)
	check(near(audio.music.volume_linear, 1.0, 0.01), "Resuming continues the fade")
	# ---- mute (AUDIO.toggle / sf_snd)
	audio.toggle()
	check(not audio.enabled and AudioServer.is_bus_mute(mix) and audio.wanted == "stage" and audio.music.stream == null, "Mute silences the mix and keeps the requested track")
	var preferences: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(BmkGameAudio.PREFERENCES)) as Dictionary
	check(preferences.get("sound") == "off", "Mute is remembered")
	var reopened: BmkGameAudio = make_audio()
	check(not reopened.enabled, "A new session starts muted")
	reopened.queue_free()
	audio.toggle()
	check(audio.enabled and not AudioServer.is_bus_mute(mix) and audio.music.stream != null, "Unmuting restarts the requested track")
	# ---- custom boss file (setBossFile / clearBossFile)
	var probe: String = "user://phase11_probe.wav"
	var file: FileAccess = FileAccess.open(probe, FileAccess.WRITE)
	file.store_buffer(wav_bytes(0.5))
	file.close()
	audio.play_track("boss")
	var result: Dictionary = audio.set_boss_file(ProjectSettings.globalize_path(probe))
	check(bool(result["ok"]) and bool(result["saved"]) and audio.boss_info()["source"] == "custom" and audio.boss_info()["name"] == "phase11_probe.wav", "A custom boss file is decoded and kept")
	check(audio.music.stream is AudioStreamWAV and near(audio.music.volume_linear, 0.0, 0.05), "A running boss fight switches to the new file")
	var restored: BmkGameAudio = make_audio()
	check(restored.boss_info()["source"] == "custom" and restored.boss_stream is AudioStreamWAV, "The custom file survives a restart")
	restored.queue_free()
	var bad: String = "user://phase11_bad.mp3"
	file = FileAccess.open(bad, FileAccess.WRITE)
	file.store_string("not audio")
	file.close()
	check(not bool(audio.set_boss_file(ProjectSettings.globalize_path(bad))["ok"]) and audio.boss_info()["name"] == "phase11_probe.wav", "An undecodable file is refused and the previous choice stays")
	var big: String = "user://phase11_big.wav"
	file = FileAccess.open(big, FileAccess.WRITE)
	file.store_buffer(PackedByteArray([0]))
	file.seek(BmkGameAudio.BOSS_MAX_BYTES + 1)
	file.store_8(0)
	file.close()
	check(audio.set_boss_file(ProjectSettings.globalize_path(big))["message"] == "30MB 이하의 파일만 쓸 수 있습니다.", "Files over 30 MB are refused")
	audio.clear_boss_file()
	check(audio.boss_info()["source"] == "default" and not FileAccess.file_exists(BmkGameAudio.BOSS_COPY), "Clearing returns to the game mp3")
	for path: String in [probe, bad, big]: DirAccess.remove_absolute(path)
	audio.queue_free()
	restore()
	print("PHASE 11 AUDIO: %d checks; %d failures" % [checks, failures.size()])
	for failure: String in failures: print("  FAIL ", failure)
	quit(1 if failures.size() > 0 else 0)
