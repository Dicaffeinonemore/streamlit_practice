# Black Moon Knight — native Godot port

Open this folder's `project.godot` with Godot 4.7.2 and press **F5**. The main scene is `res://phase4/game.tscn`: title, character select (Barel or Viesa), new game, Continue, practice, boss challenge and settings. All five stages and their bosses are playable, from Gorath to the Black Moon Sovereign, and the story ends with the ALL CLEAR screen.

To run without the editor:

```text
Godot_v4.7.2-stable_win64.exe --path <this folder>
```

Arcade keys (default): arrows move, Z attacks, X jumps, Shift dashes, C uses the full-SP special, A casts stocked magic. Barel's skills are S/D/Q/W/E (thrust, slam, whirl, leap, red wave). Viesa's are S (rapid fire), E (charge shot: hold on the full draw for up to three levels, +4 damage each), Q (dash with ground backflip), W (dash with air backflip) and D (melee combo). For both characters, holding the direction when a dash (Shift or a double tap) ends keeps them running at ×1.6 walking speed. Holding attack does not chain combos; press again within the source buffer/link timing. The WASD preset and custom bindings are in Settings.

Escape or the pause button (top right) pauses. On touch screens, turn on Settings → 모바일 조작 키 for the on-screen lever and buttons; their transparency, size and layout are adjustable (배치 편집). F9 shows collision debug. With debug visible, F10/F11 jump to a boss's phase two / ultimate where the original has such keys (Gorath, Vargul), and for the Sovereign. Saves go to `user://` (bmk_settings, bmk_checkpoint, bmk_records).

Validation, source differences and regeneration commands for each phase are in `docs/PHASE1_REPORT.md` through `docs/PHASE10_REPORT.md`. Audio polish, the tutorial/demo and platform exports are Phases 11–13.
