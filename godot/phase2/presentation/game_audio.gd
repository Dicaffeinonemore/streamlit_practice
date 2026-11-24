class_name BmkGameAudio
extends Node
## audio.js: the browser mix, sample routing, music transitions, mute and the custom boss file.
##
## Mix (audio.js setup()):
##   voices -> sfxB (.9 x effects volume) --\
##   music  -> musB (.34 x music volume) ----> master .8 -> DynamicsCompressor -> out
## Native buses: BmkSfx (.9 x effects) and BmkMusic (music volume) send to BmkMix (Amplify .8 ->
## a Compressor fitted to the measured browser curve, phase11/fixtures/compressor_curve.json).
## Synthesized WAVs are captured at the sfxB input x synth_render_gain; music OGGs already carry
## .34 x engine bus 2.5; embedded MP3 samples are raw.
const MIX_BUS: StringName = &"BmkMix"
const SFX_BUS: StringName = &"BmkSfx"
const MUSIC_BUS: StringName = &"BmkMusic"
const PREFERENCES: String = "user://bmk_audio.json"
const BOSS_COPY: String = "user://boss_bgm"
## audio.js BOSS_MAX_BYTES / BOSS_FILE_GAIN.
const BOSS_MAX_BYTES: int = 30 * 1024 * 1024
const BOSS_FILE_GAIN: float = 2.0
## playBarelSample(): the same sample does not restart within 18 ms.
const SAMPLE_REPEAT_MS: int = 18
const GORATH_FALLBACK: Dictionary[String, String] = {"g2hook":"bwave","g2charge":"bcharge"}

## Sample keys by playback path: barel (leading-silence offset, repeat guard, optional duration),
## viesa (plays from 0), death (offset), gorath (offset, synthesized fallback).
var streams: Dictionary[String, AudioStream] = {}
var offsets: Dictionary[String, float] = {}
var barel_samples: Dictionary[String, bool] = {}
var viesa_samples: Dictionary[String, bool] = {}
var synth_gain: float = 2.0
var last_play: Dictionary[String, int] = {}
var voices: Array[AudioStreamPlayer] = []
var started: Array[int] = []
var remaining: Array[float] = []
var gains: Array[float] = []
var music_players: Array[AudioStreamPlayer] = []
var music_tweens: Array[Tween] = [null, null]
var music_index: int = 0
var music: AudioStreamPlayer:
	get: return music_players[music_index] if not music_players.is_empty() else null
var enabled: bool = true
var paused: bool = false
## AUDIO.want / wantedBoss / wantedVictory: the requested track survives mute and pause.
var track_id: String = "stop"
var wanted: String = ""
## Stage music loop number (stage_N_loop.ogg) used by the "stage" track.
var stage_number: int = 1
var victory_intro: bool = false
var music_level: float = 0.7
var sfx_level: float = 0.8
var boss_name: String = ""
var boss_stream: AudioStream
var boss_listeners: Array[Callable] = []
var compressor_fit: Dictionary = {}

func _ready() -> void:
	var catalog: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://port_assets/catalogs/audio.json")) as Dictionary
	synth_gain = 1.0 / float(catalog.get("synth_render_gain", 1.0))
	for entry: Dictionary in catalog["embedded"]:
		var id: String = str(entry["key"])
		var group: String = str(entry["namespace"])
		streams[id] = load("res://" + str(entry["file"])) as AudioStream
		# audio.js: Barel, Aurelion's wave, enemy death and Gorath samples skip their encoded
		# leading silence; playViesaSkill() starts Viesa's (and Aurelion's explosion) at 0.
		if group == "barel" or group == "aurelion" and id == "aurelionWave": barel_samples[id] = true
		elif group == "viesa" or group == "aurelion": viesa_samples[id] = true
		if not viesa_samples.has(id): offsets[id] = float(entry["leading_silence_offset"])
	for entry: Dictionary in catalog["synthesized"]:
		streams["%s_%d" % [entry["key"], entry["variant"]]] = load("res://" + str(entry["file"])) as AudioStream
	setup_buses()
	for i: int in range(32):
		var voice: AudioStreamPlayer = AudioStreamPlayer.new()
		voice.bus = SFX_BUS
		add_child(voice)
		voices.append(voice)
		started.append(-1)
		remaining.append(-1.0)
		gains.append(1.0)
	for i: int in range(2):
		var player: AudioStreamPlayer = AudioStreamPlayer.new()
		player.bus = MUSIC_BUS
		player.volume_linear = 0.0
		add_child(player)
		player.finished.connect(on_music_finished.bind(player))
		music_players.append(player)
	read_preferences()
	set_levels(music_level, sfx_level)

## Buses are created once per process; their order keeps BmkMix last before Master.
func setup_buses() -> void:
	var fit: Variant = JSON.parse_string(FileAccess.get_file_as_string("res://phase11/fixtures/compressor_curve.json")) if FileAccess.file_exists("res://phase11/fixtures/compressor_curve.json") else null
	compressor_fit = (fit as Dictionary).get("godot", {}) if fit is Dictionary else {}
	if AudioServer.get_bus_index(MIX_BUS) < 0:
		AudioServer.add_bus()
		var mix: int = AudioServer.bus_count - 1
		AudioServer.set_bus_name(mix, MIX_BUS)
		AudioServer.set_bus_send(mix, &"Master")
		var amplify: AudioEffectAmplify = AudioEffectAmplify.new()
		amplify.volume_db = linear_to_db(0.8)
		AudioServer.add_bus_effect(mix, amplify)
		var compressor: AudioEffectCompressor = AudioEffectCompressor.new()
		compressor.threshold = float(compressor_fit.get("threshold_db", -7.5))
		compressor.ratio = float(compressor_fit.get("ratio", 1.08))
		compressor.gain = float(compressor_fit.get("gain_db", 0.7))
		compressor.attack_us = float(compressor_fit.get("attack_us", 2000))
		compressor.release_ms = float(compressor_fit.get("release_ms", 200))
		AudioServer.add_bus_effect(mix, compressor)
	for bus_name: StringName in [SFX_BUS, MUSIC_BUS]:
		if AudioServer.get_bus_index(bus_name) < 0:
			AudioServer.add_bus()
			var index: int = AudioServer.bus_count - 1
			AudioServer.set_bus_name(index, bus_name)
			AudioServer.set_bus_send(index, MIX_BUS)

static func silent_output() -> bool:
	return DisplayServer.get_name() == "headless"

# ------------------------------------------------------------------ effects
## AUDIO.sfx(name, a).
func play(key: String, variant: int = 0) -> void:
	if not enabled or paused or silent_output(): return
	var r: Dictionary = route(key, variant)
	if r.is_empty(): return
	if bool(r["guarded"]):
		var now: int = Time.get_ticks_msec()
		if now - last_play.get(r["id"], -100000) < SAMPLE_REPEAT_MS: return
		last_play[r["id"]] = now
	start_voice(streams[r["id"]], float(r["gain"]), float(r["offset"]), float(r["duration"]))

## audio.js sfx() routing as {id, gain, offset, duration, guarded}; empty when nothing plays.
## Barel's samples (and 'hurtH' -> 'hurt', Aurelion's wave) use playBarelSample(): leading-silence
## offset, an 18 ms repeat guard and the special's 0.88 s combo cut. Viesa's and Aurelion's explosion
## start at 0; the enemy death and Gorath samples skip their silence; the rest is the synthesized
## SFX table (Gorath's two samples fall back to bwave / bcharge when absent).
func route(key: String, variant: int = 0) -> Dictionary:
	var sample: String = "hurt" if key == "hurtH" else key
	if barel_samples.has(sample):
		return {"id":sample,"gain":1.0,"offset":offsets.get(sample, 0.0),"duration":0.88 if sample == "barelCombo" else -1.0,"guarded":true}
	if viesa_samples.has(key):
		return {"id":key,"gain":1.0,"offset":0.0,"duration":-1.0,"guarded":false}
	if key == "mobdie" and streams.has("mobdie"):
		return {"id":key,"gain":1.0,"offset":offsets["mobdie"],"duration":-1.0,"guarded":false}
	if GORATH_FALLBACK.has(key):
		if streams.has(key): return {"id":key,"gain":1.0,"offset":offsets[key],"duration":-1.0,"guarded":false}
		key = GORATH_FALLBACK[key]
	var id: String = "%s_%d" % [key, clampi(variant, 0, 2)]
	return {"id":id,"gain":synth_gain,"offset":0.0,"duration":-1.0,"guarded":false} if streams.has(id) else {}

## Independent voices like WebAudio buffer sources; a free voice is preferred, else the oldest.
func start_voice(stream: AudioStream, gain: float, offset: float, duration: float) -> void:
	var index: int = -1
	var oldest: int = 0
	for i: int in range(voices.size()):
		if not voices[i].playing:
			index = i
			break
		if started[i] < started[oldest]: oldest = i
	if index < 0: index = oldest
	var voice: AudioStreamPlayer = voices[index]
	started[index] = Time.get_ticks_usec()
	gains[index] = gain
	remaining[index] = duration
	voice.volume_linear = gain
	voice.stream = stream
	voice.play(offset)

func _process(delta: float) -> void:
	for i: int in range(voices.size()):
		if remaining[i] < 0.0 or voices[i].stream_paused: continue
		remaining[i] -= delta
		if remaining[i] <= 0.0:
			voices[i].stop()
			remaining[i] = -1.0
		elif remaining[i] < 0.008:
			voices[i].volume_linear = gains[i] * remaining[i] / 0.008

# ------------------------------------------------------------------ music
## AUDIO.music / bossMusic / victoryMusic and AUDIO.stop(fade): 'stage', 'boss', 'victory', 'ending', 'stop'.
func play_track(id: String, fade: float = 0.0) -> void:
	if music_players.is_empty(): return
	if id == "stop":
		stop_music(fade)
		wanted = ""
		track_id = "stop"
		return
	var victory: bool = id == "victory" or id == "ending"
	# music(): stop(win ? .4 : .6), then the new track fades in over .8 s (a fanfare over .05 s).
	stop_music(0.4 if victory else 0.6)
	wanted = id
	track_id = id
	victory_intro = victory
	if not enabled: return
	var stream: AudioStream = track_stream(id)
	if stream == null: return
	music_index = 1 - music_index
	var player: AudioStreamPlayer = music
	player.stream = stream
	player.volume_linear = 0.0
	player.stream_paused = paused
	if not silent_output(): player.play()
	ramp(music_index, track_gain(id), 0.05 if victory else 0.8)

func track_stream(id: String) -> AudioStream:
	match id:
		"boss":
			var file: AudioStream = boss_stream if boss_stream != null else load("res://port_assets/audio/original/boss.mp3") as AudioStream
			if file != null:
				set_loop(file)
				return file
			return looped("res://port_assets/audio/music/boss_%d_loop.ogg" % stage_number)
		"victory", "ending":
			# The fanfare plays once, then its warmed-up march loops without a gap.
			var interactive: AudioStreamInteractive = AudioStreamInteractive.new()
			interactive.clip_count = 2
			interactive.set_clip_stream(0, load("res://port_assets/audio/music/%s_intro.wav" % id) as AudioStream)
			interactive.set_clip_stream(1, looped("res://port_assets/audio/music/%s_loop.ogg" % id))
			interactive.set_clip_auto_advance(0, AudioStreamInteractive.AUTO_ADVANCE_ENABLED)
			interactive.set_clip_auto_advance_next_clip(0, 1)
			interactive.initial_clip = 0
			return interactive
		_:
			return looped("res://port_assets/audio/music/stage_%d_loop.ogg" % stage_number)

## Boss files play through a x2 bus on musB (.34): .68 at full music volume; scores carry their gain.
func track_gain(id: String) -> float:
	return 0.34 * BOSS_FILE_GAIN if id == "boss" and track_stream_is_file() else 1.0

func track_stream_is_file() -> bool:
	return boss_stream != null or ResourceLoader.exists("res://port_assets/audio/original/boss.mp3")

static func looped(path: String) -> AudioStream:
	var stream: AudioStream = load(path) as AudioStream
	set_loop(stream)
	return stream

static func set_loop(stream: AudioStream) -> void:
	if stream is AudioStreamMP3: (stream as AudioStreamMP3).loop = true
	elif stream is AudioStreamOggVorbis: (stream as AudioStreamOggVorbis).loop = true
	elif stream is AudioStreamWAV:
		var wav: AudioStreamWAV = stream as AudioStreamWAV
		wav.loop_mode = AudioStreamWAV.LOOP_FORWARD
		wav.loop_begin = 0
		wav.loop_end = int(wav.get_length() * wav.mix_rate)

## AudioParam.linearRampToValueAtTime on the track bus gain.
func ramp(index: int, target: float, seconds: float) -> void:
	if music_tweens[index] != null: music_tweens[index].kill()
	var player: AudioStreamPlayer = music_players[index]
	if seconds <= 0.0:
		player.volume_linear = target
		music_tweens[index] = null
		return
	var tween: Tween = create_tween()
	tween.tween_property(player, "volume_linear", target, seconds)
	tween.finished.connect(func() -> void: music_tweens[index] = null, CONNECT_ONE_SHOT)
	music_tweens[index] = tween
	if paused: tween.pause()

## stop(fade): the current track ramps to silence and is released.
func stop_music(fade: float) -> void:
	var index: int = music_index
	var player: AudioStreamPlayer = music_players[index]
	if not player.playing and player.stream == null: return
	if fade <= 0.0:
		if music_tweens[index] != null: music_tweens[index].kill()
		player.stop()
		player.stream = null
		return
	ramp(index, 0.0, fade)
	music_tweens[index].finished.connect(func() -> void:
		if music_index != index or wanted.is_empty():
			player.stop()
			player.stream = null)

## AUDIO.silence(): title, boss list and opening.
func silence() -> void:
	play_track("stop", 0.25)

func on_music_finished(player: AudioStreamPlayer) -> void:
	# Looping tracks never finish; a stream that ends is released.
	player.stream = null

# ------------------------------------------------------------------ pause, mute, volumes
## AUDIO.pause(): the AudioContext suspends, so music, effects and fades stop where they are.
func pause_audio(value: bool) -> void:
	paused = value
	for player: AudioStreamPlayer in music_players: player.stream_paused = value
	for voice: AudioStreamPlayer in voices: voice.stream_paused = value
	for tween: Tween in music_tweens:
		if tween != null and tween.is_valid():
			if value: tween.pause()
			else: tween.play()

## AUDIO.toggle(): mute keeps the requested track and restarts it when sound returns.
func toggle() -> bool:
	enable(not enabled)
	write_preferences()
	if enabled: play("click")
	return enabled

func enable(value: bool) -> void:
	enabled = value
	AudioServer.set_bus_mute(AudioServer.get_bus_index(MIX_BUS), not enabled)
	if not enabled:
		var desired: String = wanted
		stop_music(0.0)
		for voice: AudioStreamPlayer in voices: voice.stop()
		wanted = desired
	elif not wanted.is_empty() and not music.playing:
		play_track(wanted)

## AUDIO.setVolumes(music, effects): musB .34 x music (the .34 is in the scores), sfxB .9 x effects.
func set_levels(music_value: float, sfx_value: float) -> void:
	music_level = clampf(music_value, 0, 1)
	sfx_level = clampf(sfx_value, 0, 1)
	var music_bus: int = AudioServer.get_bus_index(MUSIC_BUS)
	var sfx_bus: int = AudioServer.get_bus_index(SFX_BUS)
	if music_bus >= 0: AudioServer.set_bus_volume_linear(music_bus, music_level)
	if sfx_bus >= 0: AudioServer.set_bus_volume_linear(sfx_bus, 0.9 * sfx_level)

# ------------------------------------------------------------------ custom boss music
## AUDIO.bossInfo(): custom file > game default mp3 > synthesized score.
func boss_info() -> Dictionary:
	var source: String = "custom" if boss_stream != null else ("default" if ResourceLoader.exists("res://port_assets/audio/original/boss.mp3") else "synth")
	return {"source":source,"name":boss_name}

## AUDIO.setBossFile(file): at most 30 MB, decoded before it replaces the current choice.
func set_boss_file(path: String) -> Dictionary:
	if not FileAccess.file_exists(path): return {"ok":false,"message":BmkCopy.text("FILE_MISSING")}
	var file: FileAccess = FileAccess.open(path, FileAccess.READ)
	if file == null: return {"ok":false,"message":BmkCopy.text("FILE_OPEN_ERROR")}
	if file.get_length() > BOSS_MAX_BYTES: return {"ok":false,"message":BmkCopy.text("FILE_SIZE")}
	var bytes: PackedByteArray = file.get_buffer(file.get_length())
	file.close()
	return set_boss_bytes(path.get_file(), bytes)

## The same choice from bytes already read (the Web export's browser file chooser).
func set_boss_bytes(file_name: String, bytes: PackedByteArray) -> Dictionary:
	if bytes.size() > BOSS_MAX_BYTES: return {"ok":false,"message":BmkCopy.text("FILE_SIZE")}
	var extension: String = file_name.get_extension().to_lower()
	var stream: AudioStream = decode(bytes, extension)
	if stream == null: return {"ok":false,"message":BmkCopy.text("FILE_UNPLAYABLE")}
	var saved: bool = false
	var copy: FileAccess = FileAccess.open(BOSS_COPY, FileAccess.WRITE)
	if copy != null:
		saved = copy.store_buffer(bytes)
		copy.close()
	boss_stream = stream
	boss_name = file_name
	write_preferences(extension if saved else "")
	notify_boss()
	return {"ok":true,"saved":saved}

func clear_boss_file() -> void:
	boss_stream = null
	boss_name = ""
	if FileAccess.file_exists(BOSS_COPY): DirAccess.remove_absolute(BOSS_COPY)
	write_preferences()
	notify_boss()

static func decode(bytes: PackedByteArray, extension: String) -> AudioStream:
	if bytes.is_empty(): return null
	var stream: AudioStream
	match extension:
		"mp3": stream = AudioStreamMP3.load_from_buffer(bytes)
		"ogg": stream = AudioStreamOggVorbis.load_from_buffer(bytes)
		"wav": stream = AudioStreamWAV.load_from_buffer(bytes)
	return stream if stream != null and stream.get_length() > 0.0 else null

## notifyBoss(): a boss fight switches to the new choice immediately.
func notify_boss() -> void:
	if enabled and wanted == "boss": play_track("boss")
	for listener: Callable in boss_listeners:
		if listener.is_valid(): listener.call(boss_info())

# ------------------------------------------------------------------ preferences
## localStorage 'sf_snd' and the IndexedDB boss file: kept beside, not inside, the settings save.
func read_preferences() -> void:
	if not FileAccess.file_exists(PREFERENCES): return
	var raw: Variant = JSON.parse_string(FileAccess.get_file_as_string(PREFERENCES))
	if raw is not Dictionary: return
	if raw.get("sound") == "off": enable(false)
	var extension: Variant = raw.get("boss_extension")
	if extension is String and not (extension as String).is_empty() and FileAccess.file_exists(BOSS_COPY) and raw.get("boss_name") is String:
		var stream: AudioStream = decode(FileAccess.get_file_as_bytes(BOSS_COPY), extension)
		if stream != null:
			boss_stream = stream
			boss_name = raw["boss_name"]

func write_preferences(boss_extension: String = "") -> void:
	var extension: String = boss_extension
	if extension.is_empty() and boss_stream != null and FileAccess.file_exists(PREFERENCES):
		var old: Variant = JSON.parse_string(FileAccess.get_file_as_string(PREFERENCES))
		if old is Dictionary and old.get("boss_extension") is String: extension = old["boss_extension"]
	var file: FileAccess = FileAccess.open(PREFERENCES, FileAccess.WRITE)
	if file == null: return
	file.store_string(JSON.stringify({"sound":"on" if enabled else "off","boss_name":boss_name if boss_stream != null else "","boss_extension":extension if boss_stream != null else ""}))
	file.close()

func _exit_tree() -> void:
	for player: AudioStreamPlayer in music_players:
		player.stop()
		player.stream = null
	for voice: AudioStreamPlayer in voices:
		voice.stop()
		voice.stream = null
