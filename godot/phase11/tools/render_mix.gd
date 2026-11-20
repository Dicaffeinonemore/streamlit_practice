extends Node
## Phase 11: plays phase11/fixtures/mix_scenario.json through BmkGameAudio for Godot's Movie Maker.
##   Godot_v4.7.2-stable_win64.exe --path godot --write-movie <dir>/godot_mix.png --fixed-fps 60 res://phase11/tools/render_mix.tscn
## The movie writer saves the mixed output beside the frames as godot_mix.wav (compared by
## tools/oracle/phase11_mix_compare.py against the browser render of the same scenario).
var audio: BmkGameAudio
var scenario: Dictionary
var frame: int = 0

func _ready() -> void:
	scenario = JSON.parse_string(FileAccess.get_file_as_string("res://phase11/fixtures/mix_scenario.json")) as Dictionary
	audio = BmkGameAudio.new()
	add_child(audio)
	# The user's own mute choice and boss file must not change the comparison.
	audio.boss_stream = null
	audio.enabled = true
	AudioServer.set_bus_mute(AudioServer.get_bus_index(BmkGameAudio.MIX_BUS), false)
	audio.set_levels(float(scenario["music_volume"]), float(scenario["sfx_volume"]))
	audio.stage_number = int(scenario["stage"])

func _process(_delta: float) -> void:
	for event: Dictionary in scenario["events"]:
		if roundi(float(event["t"]) * 60.0) != frame: continue
		if event.has("music"): audio.play_track(str(event["music"]))
		else: audio.play(str(event["sfx"]), int(event["variant"]))
	frame += 1
	if frame >= roundi(float(scenario["seconds"]) * 60.0): get_tree().quit()
