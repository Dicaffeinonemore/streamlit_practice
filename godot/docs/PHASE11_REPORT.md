# Phase 11 — Audio polish

The native game now reproduces `audio.js`: which sound plays at which step, how each sound is routed, the mix and its compressor, music transitions, pause, mute and the custom boss file.

## Delivered

- **Sound and music events match the source step for step.** Every phase oracle (phases 2, 3, 5–9) now records each `AUDIO.sfx`, `AUDIO.music` / `bossMusic` / `victoryMusic` and `AUDIO.stop` / `silence` call per executed step (`tools/oracle/audio_log.cjs`). `BmkSimulation.audio_log` records the native requests the same way, and every parity test compares them. Differences found and fixed:
  - `playerHitSfx(kind, hitSound)` is ported as `BmkSimulation.player_hit_sound()` and used by every `damageEnemy` path, barrel hits and the ground smash: special slashes are silent (`'none'`), the special finisher plays `barelFinalHit` twice, slam/leap hits play `barelSlam` (also on the smash), red-wave hits play `barelWave`, and every hit plays `hurt` when it deals damage (the phase 2 resolver lacked it).
  - Lightning (`fireBolts`) plays the attack hit sound (`swordHit` 2, Viesa `hit` 2), not `bolt`.
  - Skill start sounds (`spdash` without a variant), the thrust and whirl swing sounds, `pdie` on a lethal hit, `jump` on a dash-attack jump cancel, `hit` when knocked enemies collide.
  - Gorath: `hit` 2 when phase one's health runs out, `g2creak` on each armour grab, `slam` with `g2block` at the burst, `phase2` with the roar, `slam` after `bossdie`.
  - Stage 1: the gate's `barrel` every 10 ticks before its `slam`, `land` with `barrel` when the wall breaks, `hit` on a heavy-grab escape.
  - Game over: `AUDIO.stop(0.3)` and `defeat` (missing before). The extra `victory` jingle at stage clear was removed: the source only starts the victory music.
- **Mix.** Buses `BmkSfx` (.9 × effects volume) and `BmkMusic` (music volume) send to `BmkMix`: Amplify .8 then a Compressor fitted to the browser's master chain. The DynamicsCompressor (threshold −14, ratio 5, 30 dB knee, automatic makeup) was measured on steady sines (`tools/oracle/phase11_compressor_curve.cjs`): it adds +0.64 dB to quiet material and compresses gently above −8 dBFS. Godot's peak compressor at threshold −7.5 dB, ratio 1.08, gain +0.7 dB matches that curve within 0.24 dB from −42 to +4 dBFS (`phase11/fixtures/compressor_curve.json`).
- **Re-extracted audio.** Synthesized effects are now captured at the SFX bus input (× 0.5 headroom, played back at × 2), so the master gain and compressor are applied once, to the whole mix, like the browser. Before, each WAV carried the browser's master chain and the native player multiplied the effects volume again (−1.9 dB at the default 80%). Aurelion's two samples (`aurelionWave`, `aurelionExplosion`) were not extracted before and were silent; they are now included (`aurelion-sfx.js` joins the audio source key).
- **Routing** (`BmkGameAudio.route()`): Barel's samples, `hurtH` → `hurt` and Aurelion's wave use `playBarelSample()` (leading-silence offset, 18 ms repeat guard, the special's 0.88 s combo cut with an 8 ms fade). Viesa's samples and Aurelion's explosion start at 0. The enemy death and Gorath samples skip their silence; Gorath's fall back to `bwave` / `bcharge`. The repeat guard now applies only to Barel's samples, as in the source (it applied to every sound before). 32 independent voices; a busy pool reuses the oldest.
- **Music transitions** (`music()` / `stop()`): the old track fades out over 0.6 s (0.4 s before a fanfare) while the new one rises over 0.8 s (0.05 s for a fanfare). Stage scores loop. Boss music follows the source priority: custom file, then `boss.mp3`, then the synthesized boss score, at .34 × 2. Victory and ending play their fanfare once and continue into the loop without a gap (`AudioStreamInteractive` auto-advance). The title and boss list call `silence()` (0.25 s), Gorath's hush stops in 0.15 s, game over in 0.3 s.
- **Pause** freezes the music, every effect voice and any running fade, like suspending the AudioContext. **Mute** (M on every screen, or Settings → 소리) silences the mix, keeps the requested track and restarts it when sound returns, plays `click` when turned on, and is remembered (`user://bmk_audio.json`, the source's `sf_snd`). Capture tools mute without saving.
- **Custom boss music** (Settings → 보스전 음악): a native file dialog for MP3, OGG or WAV up to 30 MB. The file is decoded before it replaces the current choice, copied to `user://boss_bgm` and restored on the next run; a fight in progress switches at once. "보스전 음악 기본값으로" clears it. The status shows 내 파일 / 게임 기본 mp3 / 기본 합성 BGM, as `showBgm()` does.
- Character select plays `click` when it opens, as `openCharacterSelect()` does.

## Verification

| Check | Result |
|---|---|
| Sound/music events in the source traces (phases 2, 3, 5–9) | 90,050 steps, 12,899,288 comparisons including every audio request, 0 differences |
| `phase11/verify_audio.gd` | 38 checks: bus graph and compressor, volumes, routing of every path, every traced sound has a route, stage/boss/victory/ending/stop transitions with fade timing, pause, mute persistence and restart, custom file decode/restore/refusal (bad data, over 30 MB)/clear |
| Rendered mix (`evidence/phase11_mix_compare.json`) | the same 12 s scenario rendered by the browser chain and by Godot's Movie Maker: 10 effects within 0.46 dB, 6 music sections (fade-in, stage, fade-out, boss, fanfare, loop) within 0.09 dB, peaks −1.40 / −1.65 dBFS, 5 ms offset (the source schedules synthesized notes 5 ms ahead) |
| Loop seams | stage scores 5×10⁻⁵–5×10⁻⁴ sample delta at the loop point; victory/ending fanfares continue into phase-aligned loops |
| Regressions | phase 2–9 GUT; rendered checks of phases 4–10 (challenge 5, menu 15, practice 8, rendered 10, restart write/read, startup, Viesa 38, stages 2–5: 27/27/30/42, touch 46), 0 failures; extraction hashes 831 files, 0 mismatches. `phase3/tools/verify_startup.gd` still expects the Phase 3 main scene (replaced in Phase 4) and fails as before |

Regenerate:

```text
node godot/tools/oracle/dump_frame_data.cjs            (and phase3/5/6/7/8/9_traces.cjs)
node godot/tools/oracle/phase11_compressor_curve.cjs
node godot/tools/extract/extract_all.cjs
node godot/tools/oracle/phase11_mix_reference.cjs <dir>/mix_reference.wav
Godot_v4.7.2-stable_win64.exe --path godot --resolution 64x36 --write-movie <dir>/godot_mix.png --fixed-fps 60 res://phase11/tools/render_mix.tscn
python godot/tools/oracle/phase11_mix_compare.py <dir>/mix_reference.wav <dir>/godot_mix.wav godot/evidence/phase11_mix_compare.json
Godot_v4.7.2-stable_win64_console.exe --headless --path godot --script phase11/verify_audio.gd
```

## Known differences

- **The compressor is a fitted approximation.** Godot's compressor has no soft knee or look-ahead; the static curve matches within 0.24 dB, but attack/release on fast transients can differ slightly (Godot's attack is capped at 2 ms; the source uses 3 ms).
- **Scores are pre-rendered.** Stage music starts at the warmed-up loop rather than from the first step of a fresh synthesizer; the synthesized boss scores (used only without `boss.mp3`) have small loop-point steps (up to 0.022).
- **Synthesized noise is fixed per variant.** The browser draws new random noise for each play; the native WAVs use the extraction seed.
- **Unloaded samples.** The browser falls back to synthesis while an MP3 is still decoding; native samples are always loaded, so the fallback never sounds.
- The playback-rate argument of `AUDIO.music()` is always 1 in the source and is not ported.
