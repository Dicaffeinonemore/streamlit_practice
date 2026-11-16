# Phase 4 work in progress

The Phase 4 scene is staged in `res://phase4/game.tscn`. It has not been installed in the destination project and must not be represented as complete.

Implemented locally: title and pause menus, stage-entry checkpoint and record handling, character selection with Barel, stage-clear results, configurable controls and settings, practice, and an unlocked Gorath challenge. The title and player HUD use extracted source art. The stage-clear checkpoint is preserved for Stage 2 even though that stage is not yet playable.

Verification so far: `phase4/verify_menu.gd` has 15 passing checks; `phase4/verify_rendered.gd` has 8 passing rendered interaction/capture checks; Phase 2 GUT has 5 passing tests and 2,237 assertions; Phase 3 source-trace GUT passes. Test persistence is isolated to temporary files within the working project. Screenshots are `evidence/phase4_title.png` and `evidence/phase4_hud.png`.

Remaining before installation: compare the original menus and full HUD side by side and finish their layout, Korean labels, boss/enemy panels and skill graphics; test practice's five tasks, death/respawn and save isolation through real input; test full boss challenge and result with gameplay; check all settings against their browser behavior and handle save errors visibly; verify title, pause, retry, continue and clear across app restarts with isolated storage; add a destination installer with backup and verify F5 after installation. Practice currently uses the Stage 1 axe soldier rather than the original grunt. Do not overwrite the working destination with this staged scene until the remaining checks pass.
