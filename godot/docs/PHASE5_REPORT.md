# Phase 5 — Viesa, the second playable character

Viesa is playable in the F5 game (`res://phase4/game.tscn`) for story, practice and the Stage 1 boss challenge. Her simulation is a line-by-line port of `viesa-runtime.js` and the Viesa branches of `game.js`, verified against the original browser code.

## Delivered

- **Character rules:** HP 80, body width/half-width ×.9 (23.4 / 14.4), ×.9 hurt area in reach zones (axe/blade/club swings and the molotov kick), ×1.1 walking speed, ×1.15 dash distance with dash invulnerability, fixed default hitstun, no dash attack.
- **Bow:** ground shot and air shot (slow-fall while shooting, 6-tick hover grace), queued follow-up shots, nearest-target depth aim over 8 ticks, 213 px range, fade-out, hit sparks and SP gain.
- **Melee combo (H):** slash1 → slash2 → kick with ×.9/×1/×1.2 damage, kick knockdown and ×1.3 push, buffer and 420 ms link window.
- **Skills:** six-shot rapid fire with up/down lane steering (U); charge shot 모아 쏘기 (L): draw to frame 7 in 21 ticks, then hold for up to three 20-tick levels (+4 damage each, auto-release 45 ticks after level 3), piercing to the screen edge; dash with a sweep strike and landing knockdown into a ground backflip (O); dash into an air backflip with a 40-tick hover that allows one air shot or a further P (P). Original cooldowns.
- **Run:** holding the direction when a Shift/double-tap dash ends keeps Viesa running at ×1.6 walking speed until the direction is released, reversed or she jumps.
- **Ultimate 흑월 난사 (K):** leap, moon sigil, 50-tick barrage of 4 phantom arrows per tick plus volleys, 3-tick per-enemy phantom hit spacing that preserves hitstop, the giant arrow with radial knockdown/barrel damage and landing. Scenery-only dim, as in the browser.
- **Shared systems:** stocked magic, grabs (heavy and hound), hurt/knockdown/death/respawn, items, barrels and the Gorath boss all work with Viesa.
- **Presentation:** all 39 Viesa clips at source scale (the 2026-11 remake sheets in `assets_src/viesa/Viesa_Remake` supply idle/walk/run/dash, melee, jump/jump shot, charge shot, rapid fire, backflip, hurt/knockdown/getup/death; shot, ultimate and scroll keep the first art), charge-level pips, `viesaPose()` frame selection, arrows/trails/fades, snipe glow, dash streak, moon sigil, phantom/volley/giant arrows, hit sparks, landing dust and explosions (additive frames use an ADD layer). Barel-only body effects are suppressed for Viesa, matching `drawPlayer()`.
- **UI:** Viesa HUD from `viesa-ui.js` (HP/SP gauges, magic and life slots, power-up bar) and her vine-framed skill icons with the melee combo shown without a cooldown shade. Character selection shows both characters; the boss challenge now asks for a character first, like `openCharacterSelect(challengeStage)`. Practice uses the last selected character, like `newPlayer()`.
- **Saves:** stage-entry and clear checkpoints store `characterId`; Continue restores Viesa; next-stage healing caps at her 80 HP; Viesa saves above HP 80 are rejected.
- **Audio:** the original `viesaArrow`, `viesaSnipe` and `viesaUltimate` samples, started at 0 on the plain SFX bus like `playViesaSkill()`; Viesa's hits use the `hit` sound.

## Verification

| Check | Result |
|---|---|
| Phase 5 source oracle (`tools/oracle/phase5_traces.cjs`) | 28 scenarios, 4,110 original steps |
| Viesa trace comparison (`phase5/tests/test_viesa_parity.gd`) | 438,971 comparisons, 0 differences |
| Covered cases | walking/jumping/landing, shots (single, chain, depth aim, out of range, air), melee combo and link, rapid lanes, snipe tap/hold, both backflips and hover shot, dash shot, double-tap dash, ultimate with and without targets, magic, axe attacks, heavy grab, hound bite, barrel, cooldown reuse, hurt during a skill, air knockdown, death/respawn, potion |
| Rendered integration (`phase5/verify_viesa.gd`) | 38 checks: mouse selection, keyboard skills, ultimate, retry, clear/continue saves, practice (5 tasks), boss challenge, audio |
| Regressions | Phase 2 GUT (2,237 assertions), Phase 3 source trace parity, all eight Phase 4 checks |

Side-by-side captures with identical setup and input: `evidence/phase5_source_{shot,snipe,hover,ultimate}.png` (browser) and `evidence/phase5_viesa_compare_*.png` (Godot). The hover frame is identical; the shot, snipe and ultimate frames match in pose, effects and HUD.

The oracle runs with `Math.random = () => .5`; normal play uses real randomness for ultimate arrow targets. Commands to regenerate:

```text
node godot/tools/oracle/phase5_capture.cjs
node godot/tools/oracle/phase5_traces.cjs
node godot/tools/oracle/phase5_source_capture.cjs
Godot_v4.7.2-stable_win64_console.exe --headless --path godot --script phase5/tools/generate_viesa_data.gd
```

## Known differences

- The browser's combo counter, floating damage numbers and DOM skill bar are not part of this port's HUD (unchanged from Phase 4). Viesa's skill icons are drawn in the native side bar instead.
- `drawViesaEnemyBar()` exists in `viesa-ui.js` but the browser never calls it; enemies keep the shared bar, so it was not ported.
- Character selection is a native panel with the two character images rather than the browser's animated cards.
- Touch controls remain Phase 10. Stage 2 (Phase 6) is next.
