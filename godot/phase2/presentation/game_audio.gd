class_name BmkGameAudio
extends Node
var streams: Dictionary[String, AudioStream] = {}
var offsets: Dictionary[String, float] = {}
var last_play: Dictionary[String, int] = {}
var voices: Array[AudioStreamPlayer] = []
var voice_index: int = 0
var remaining: Array[float] = []
var gains: Array[float] = []
var music: AudioStreamPlayer
var enabled: bool = true
var track_id: String = "stage"
var victory_intro: bool = false

func _ready() -> void:
	var catalog: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://port_assets/catalogs/audio.json")) as Dictionary
	for entry: Dictionary in catalog["embedded"]:
		if entry["namespace"] in ["barel","death","gorath"]:
			var id: String = str(entry["key"])
			streams[id] = load("res://" + str(entry["file"])) as AudioStream
			offsets[id] = float(entry["leading_silence_offset"])
	for entry: Dictionary in catalog["synthesized"]:
		var id: String = "%s_%d" % [entry["key"],entry["variant"]]
		streams[id] = load("res://" + str(entry["file"])) as AudioStream
	for i: int in range(24):
		var voice: AudioStreamPlayer = AudioStreamPlayer.new()
		voice.volume_db = -5.0
		add_child(voice)
		voices.append(voice)
		remaining.append(-1.0)
		gains.append(1.0)
	music = AudioStreamPlayer.new()
	var track: AudioStreamOggVorbis = load("res://port_assets/audio/music/stage_1_loop.ogg") as AudioStreamOggVorbis
	track.loop = true
	music.stream = track
	music.volume_db = linear_to_db(0.8 * 0.7)
	add_child(music)
	music.finished.connect(on_music_finished)
	if DisplayServer.get_name() != "headless":
		music.play()

func play(key: String, variant: int = 0) -> void:
	if not enabled or DisplayServer.get_name() == "headless":
		return
	if key == "hurtH":
		key = "hurt"
	var id: String = key if streams.has(key) else "%s_%d" % [key,clampi(variant,0,2)]
	if not streams.has(id):
		return
	var now: int = Time.get_ticks_msec()
	if now - last_play.get(id,-10000) < 18:
		return
	last_play[id] = now
	var index: int = voice_index
	var voice: AudioStreamPlayer = voices[index]
	voice_index = (voice_index + 1) % voices.size()
	gains[index] = 0.8 * 0.9 * 0.8 if offsets.has(id) else 0.8
	voice.volume_db = linear_to_db(gains[index])
	remaining[index] = 0.88 if key == "barelCombo" else -1.0
	voice.stream = streams[id]
	voice.play(offsets.get(id,0.0))

func _process(delta: float) -> void:
	for i: int in range(voices.size()):
		if remaining[i] < 0 or voices[i].stream_paused:
			continue
		remaining[i] -= delta
		if remaining[i] <= 0:
			voices[i].stop()
			remaining[i] = -1
		elif remaining[i] < 0.008:
			voices[i].volume_db = linear_to_db(gains[i] * remaining[i] / 0.008)

func pause_audio(paused: bool) -> void:
	music.stream_paused = paused
	for voice: AudioStreamPlayer in voices:
		voice.stream_paused = paused

func toggle() -> void:
	enabled = not enabled
	music.volume_db = linear_to_db(0.8 * 0.7) if enabled else -80.0
	if not enabled:
		for voice: AudioStreamPlayer in voices:
			voice.stop()

func _exit_tree() -> void:
	music.stop()
	music.stream = null
	for voice: AudioStreamPlayer in voices:
		voice.stop()
		voice.stream = null

func play_track(id: String) -> void:
	if music == null: return
	music.stop()
	track_id = id
	victory_intro = id == "victory"
	if id == "stop": return
	var path: String = "res://port_assets/audio/original/boss.mp3" if id == "boss" else ("res://port_assets/audio/music/victory_intro.wav" if id == "victory" else "res://port_assets/audio/music/stage_1_loop.ogg")
	music.stream = load(path) as AudioStream
	if music.stream is AudioStreamMP3: (music.stream as AudioStreamMP3).loop = true
	if music.stream is AudioStreamOggVorbis: (music.stream as AudioStreamOggVorbis).loop = true
	music.volume_db = linear_to_db(0.8 * 0.34 * 0.7 * 2 if id == "boss" else 0.8 * 0.7) if enabled else -80
	if DisplayServer.get_name() != "headless": music.play()

func on_music_finished() -> void:
	if track_id != "victory" or not victory_intro: return
	victory_intro = false
	var stream: AudioStreamOggVorbis = load("res://port_assets/audio/music/victory_loop.ogg") as AudioStreamOggVorbis
	stream.loop = true
	music.stream = stream
	if DisplayServer.get_name() != "headless": music.play()
