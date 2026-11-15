# Black Moon Knight — native Stage 1

Open this folder's `project.godot` with Godot 4.7.2, then press **F5**. The main scene is `res://phase3/stage_game.tscn`. Reopen the project if it was already running when the installer updated its main scene.

Move with the arrow keys. Z attacks, X jumps, Shift dashes, C uses a full-SP special, A casts stocked magic. S/D/Q/W/E use thrust/slam/whirl/leap/red wave. Holding attack does not automatically chain combos; press again within the source buffer/link timing.

Escape pauses or resumes. R restarts. F1 changes to the original WASD key preset. F9 displays collision debug; F2 refills SP/magic while debug is visible. M toggles sound. Leaving the application pauses the game.

This approved Phase 3 version covers Barel, all five Stage 1 sections, six enemy types, barrel/items, stage gimmicks and the two-phase Gorath remake. It proceeds to Stage 1 completion. The original menus/HUD/save and later stages are separate phases. The earlier slice remains at `phase2/vertical_slice.tscn`, and the simplified prototype remains at `scenes/main.tscn`; selecting a scene and pressing F6 runs it.

With F9 debug visible, 1–5 restart at a section, F10 starts Gorath phase 2 and F11 starts his ultimate. CLI: `--section=1..5 --boss-phase=2 --boss-ult=1 --debug=1 --hitbox=1 --keys=wasd`.

See `port_docs/PHASE3_REPORT.md` and `port_docs/PHASE3_COMPARISON.html` in the installed destination for validation and differences. In the working source project these documents are in `docs/`.
