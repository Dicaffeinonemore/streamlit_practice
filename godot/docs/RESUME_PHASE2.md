# Phase 2 complete — 2026-11-15

Historical checkpoint: Phase 3 was subsequently approved and completed. Read `RESUME_PHASE3.md` for the current installed state and next approval gate.

Phase 2 was resumed and completed. It is installed and verified in `C:\Users\훈도\Documents\dark-moon-nights`. Stop here for the user's Phase 3 approval, as required by the supplied specification. No later stage or boss implementation has begun.

## Current state

- Destination F5 main scene: `res://phase2/vertical_slice.tscn`.
- Original Barel art, three soldier types, first street section and two source wave queues are playable.
- 5,240 original combat steps / 502,597 state and animation comparisons: zero differences.
- 547 original street steps / 23,837 comparisons: zero differences.
- 126 strict geometry cases and 702 original clock intervals pass.
- GUT: five tests, 2,237 assertions, all passed in the working and destination projects.
- Native rendered integration: 24 checks passed in both locations, including every physical skill binding, magic, dash attack, game over and section completion.
- Destination main scene startup and headless exit are clean. Headless validation does not start music; normal rendered execution plays original stage 1 music. Audio streams are released on exit.
- Game preview was launched successfully (PID 16836 at completion), with clean `evidence/phase2-preview.log`.

## Important fixes

- The ten special frame mismatches came from a decimal changing one ULP while loading text resources. The oracle now captures fractional IEEE-754 bits; `BmkSourceJson` restores them at import, and runtime uses `phase2/generated/combat.res`. `combat.tres` is only the inspectable companion.
- Default Input Map is serialized into `project.godot`; runtime F1 switches the two source key presets.
- Cosmetic shake uses independent RNG. Source JavaScript RNG sequences are not claimed to match arbitrary live browser render cadences.
- Existing unrelated edits in root `game.js` (quiet invincibility blink during/after boss intro) were preserved. All current oracle source hashes match the working files.

## Files and evidence

- `godot/docs/PHASE2_REPORT.md`: scope, controls, validation, differences and next-phase checklist.
- `godot/docs/PHASE2_COMPARISON.html`: original/native screenshot pairs; images in `godot/evidence/`.
- Destination copies: `port_docs/PHASE2_REPORT.md`, `port_docs/PHASE2_COMPARISON.html`, `README_GODOT.md`.
- Installer: `tools/install_godot_phase2.ps1`, UTF-8 BOM for Windows PowerShell, approved prefix available. It backs up settings and changed directories before copying and validates the installed project.
- Original pre-Phase-2 settings: destination `migration_backups/phase2-20261115-175523`.
- Latest pre-install backup: destination `migration_backups/phase2-20261115-180450`.
- Existing prototype remains in destination `scenes/main.tscn` and can be run with F6.

## Controls

Default arcade: arrows move, Z attacks, X jumps, Shift dashes, C uses full-SP special, A casts stocked magic; S/D/Q/W/E use thrust/slam/whirl/leap/red wave. F1 changes presets. Escape pauses/resumes; leaving the application pauses. R restarts. M toggles sound. F9 toggles collision debug and permits F2 SP/magic refill. Supported CLI: `--section=1`, `--debug=1`, `--hitbox=1`, `--keys=wasd`.

## Deliberate phase limits

The slice stops at the street boundary. Barrel/item drops are deferred to full Stage 1 integration. HUD/pause/debug are functional interim controls; original ornate menus, persistence and rank are Phase 4. Some particles, dust, ghosts, vignette/text and exact compressor mixing remain documented visual/audio differences. Do not claim full game or pixel identity.

Next approved phase would cover all five Stage 1 sections and gimmicks plus Gorath remake (intro, phase 2 and ultimate). Read `PORTING_PLAN.md` and the supplied attachment before starting. Continue to use original art, statically typed GDScript and English new code/comments/docs. Do not spawn agents unless explicitly requested.
