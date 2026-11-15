# Phase 3 complete — 2026-11-15

The user approved Phase 3 with "진행시켜!" after Phase 2 completion. Phase 3 is now installed and verified in `C:\Users\훈도\Documents\dark-moon-nights`. Stop for Phase 4 approval. Do not automatically implement menus/save/rank or later stages.

## Installed state

- F5: `res://phase3/stage_game.tscn`, Godot 4.7.2.
- All five Stage 1 sections, original wave routes/caps/delays, transitions, narrow lane, balcony drop, wall and gate.
- Six soldier types, grabs/escapes, molotov/fire, barrels/items and Gorath remake with intro, two phases, hooks, transformation, guarded ultimate, meat landings, death/remains and stage completion.
- Original sprites/background/foreground, eight original source-prepared item cutouts, stage/boss/victory audio and functional interim HUD/debug.
- Default arcade keys unchanged. F9 enables F2 refill, section keys 1–5, F10 phase 2 and F11 ultimate. CLI supports section 1–5, boss phase/ultimate, hitbox/debug and WASD preset.
- The optional `--boss1=old` legacy debug variant exits with an explicit unsupported error. This phase implements the requested remake, not the legacy branch.

## Verification

- Source `godot/tools/oracle/phase3_capture.cjs` exports tables and fractional IEEE-754 bits. `phase3/tools/generate_stage_data.gd` produces `phase3/generated/stage.res`.
- `phase3_traces.cjs`: 37 scenarios / 12,402 actual browser steps, including all six enemies, grabs, nine boss moves, hooks, transform, ultimate thresholds, death/intro, five-section flow, all item pickups, barrel/enemy drops, mixed molotov/red-wave and enemy frame selection.
- GUT parity: 1,324,038 comparisons, zero mismatches. Test: `phase3/tests/test_stage_parity.gd`.
- Phase 2 regression: five tests / 2,237 assertions passed; rendered input regression 24 checks passed.
- Phase 3 rendered integration: 29 checks passed, in both source and installed destination. `phase3/tools/capture_stage.gd`.
- Configured F5 startup and direct section-5/phase-2/ultimate CLI startup passed, including orderly close. `phase3/tools/verify_startup.gd` reads the actual configured main scene.
- Final installer returned success and launched preview PID 27892. Destination preview log was clean at completion.

## Exit cleanup finding

Two leaked objects came from `AudioStreamWAV` / `AudioStreamPlaybackWAV` when headless boss startup played SFX. Music had already been disabled in headless mode. `BmkGameAudio.play` now also suppresses headless playback. Normal rendered music and sounds are unchanged. Stage window close releases the scene before a short SceneTree shutdown timer. Final installed startup/close logs are clean.

## Locations and rollback

- Working root: `C:\Users\훈도\Documents\streamlitpractice\streamlit_practice`.
- Installer: `tools/install_godot_phase3.ps1`, UTF-8 BOM, approved PowerShell file prefix available. Copies shared phase2 code, phase3, port_tools, project settings, README, reports and evidence; requires the prior verified Phase 2 installation.
- Original pre-Phase-3 backup: destination `migration_backups/phase3-20261115-202331`.
- Latest pre-install backup: destination `migration_backups/phase3-20261115-210918`.
- Docs: `godot/docs/PHASE3_REPORT.md`, `PHASE3_COMPARISON.html`; installed copies in `port_docs/`.
- Screenshots/source counterparts and JSON/logs: `godot/evidence/` and installed `evidence/`.
- Previous exact-core slice: `phase2/vertical_slice.tscn`. Earlier simplified prototype: destination `scenes/main.tscn`.

## Relevant architecture

- Phase 3 extends the existing typed simulation/controllers rather than replacing them with JS or physics bodies. Core factory/hooks and `walk_top`/slow request support remain regression-tested.
- `BmkStageSimulation`, `BmkFullStage`, `BmkStageEnemies`, `BmkStagePlayer`, `BmkStageCombat`, item/fire/grab controllers, Gorath controller/actions and typed action/hook/meat state classes.
- `BmkStageGame` extends `BmkVerticalSlice` using factories for actor views, selector, ground and HUD. `BmkStageTopView` draws original foreground, hooks/chains and airborne meat. `BmkStageActorView` handles quiet intro invincibility and guard silhouettes.
- Keep gameplay scalar x/y/z/velocities in float64. Hook hand coordinates use `PackedFloat64Array`, not float32 Vector2; Vector2 is only for rendering.
- Oracle copies mutable arrays (notably ultimate flags) per frame. Do not store live references in snapshots.
- GDScript Array membership does not coerce JSON float entries to integer variants. Pull-frame lists use `PackedInt32Array` before membership tests.
- Item integration test fixes RNG and starts 75 px from the barrel so it can inspect the drop before the player automatically collects it.

## Remaining boundaries

Original ornate UI/title/settings/rebinding/save/continue/rank/practice/challenge are Phase 4. Some particles/dust/rubble/narrow-path decorations, eye glow/vignette and exact audio/text mixing remain presentation differences, listed in the report. Do not claim full game, pixel identity or exhaustive proof of every interaction.

Unrelated existing root `game.js` edits were preserved. No original JS was edited by the porting tools. No subagents were used; do not spawn any without explicit instructions.
