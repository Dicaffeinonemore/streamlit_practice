# Phase 8 — Stage 4, Vargul the Frozen Gravelord

Stage 4 (얼어붙은 망자의 왕국) is playable with Barel and Viesa: story continuation from Stage 3, Continue from a saved Stage 4 entry, and the Vargul boss challenge. The simulation is a line-by-line port of `vargul-runtime.js` on top of the wave stage, verified against the original browser code.

## Delivered

- **Stage:** seven waves with the Stage 4 soldier scaling (HP ×2.1, damage ×1.7, speed ×1.15, 서리 망자 names), the frozen throne arena, field/boss/phase-two backdrops, the Stage 4 floor and music.
- **Vargul (HP 2000 / 2500):** per-move source timelines for both phases (combo, cross, dash, orb, sweep, sword, taunt; ultimate in phase two) with alignment and dash lock, 520 px dash travel with frost trails, turning, invulnerable/hidden/armor flags, weighted picks in source order with cooldowns, floor-busy and orb checks, the behind-the-boss sweep and pressure sweep after 3 (2) unpunished hits.
- **Melee hit detection:** the combo/dash/sweep hitboxes use the browser's per-row pixel spans of the eight cut slash/thrust drawings (captured from the browser and verified frame by frame), not rectangles.
- **Ice orbs:** two independent HP 30 orbs with approach/retreat/strafe steering, separation, bob, telegraphed shots (one shard, two in phase two), 10-tick invulnerability, potion/scroll drops, +20 groggy each; the 720-tick resummon cooldown starts only after both orbs break. Every Barel and Viesa attack keeps its own orb hit set (combo, dash attack, skills, special, magic, red wave, arrows — which stop on an orb — dash slash, ultimate).
- **Floor attacks:** sword marks (45 ticks, ×.85 in phase two) and screen-wide cross marks (60 ticks) with their eruption timing, and the ultimate: tracking mark, lock, leap, hidden fall, impact (23 damage) and the expanding ice wave with its frozen arena radius.
- **Boss state:** groggy/stun (also from orbs), quarter-HP knockdowns, the 288-tick transition (knockdown, awakening bursts at 3/8 and 7/8, eight-tick cross-fade) into phase two, death at 96 + 50 ticks and the remains left on the floor.
- **Presentation:** Vargul's clips at their visual scales, the white telegraph blink and '!' warning, the phase-two frost aura and pulsing mask, the cut slash/thrust melee effect drawn with the boss in depth order, sword/cross warnings, cross eruption zone tiles, orbs with HP bars, shards, ultimate warning and glacier impact, the ice-wave ring, the intro card with Vargul's 192-tick intro.
- **Debug:** with F9 visible, F10 switches Vargul to phase two and F11 sets phase two to 35% HP for the ultimate (the browser's F3/F4 debug keys).
- **Meta:** Stage 3 clear offers 다음 스테이지; Continue accepts Stage 4 entries; Stage 4 clear records and saves the Stage 5 entry; the challenge list unlocks Vargul after a Stage 4 record.

## Verification

| Check | Result |
|---|---|
| Phase 8 source oracle (`tools/oracle/phase8_traces.cjs`) | 31 scenarios, 14,597 original steps |
| Stage 4 trace comparison (`phase8/tests/test_stage4_parity.gd`) | 2,488,285 comparisons, 0 differences |
| Covered cases | Stage 4 soldier pack, all 7 patterns in each phase, back sweep, phase-one/two/ultimate/Viesa AI, orbs vs Barel (combo, skill, red wave, magic, special) and Viesa (arrows, dash slash, ultimate), resummon cooldown, pressure sweep, transition, groggy, HP knockdown, death with remains, intro, banner, full wave progression |
| Rendered integration (`phase8/verify_stage4.gd`) | 30 checks: next stage, banner, music, Continue, waves → intro → transition → orbs and cooldown → death/remains → clear/save/record, Vargul challenge |
| Regressions | Phase 2 GUT (2,237 assertions), Phase 3/5/6/7 source parity, all eight Phase 4 checks, Phase 5–7 rendered integration |

Side-by-side captures with identical setup (`phase8/fixtures/capture_scenes.json`): `evidence/phase8_source_*.png` (browser) and `evidence/phase8_compare_*.png` (Godot) for soldiers, intro, combo, cross, phase-two orbs and the ultimate impact.

Regenerate:

```text
node godot/tools/oracle/phase8_capture.cjs
node godot/tools/oracle/phase8_traces.cjs
node godot/tools/oracle/phase8_source_capture.cjs
Godot_v4.7.2-stable_win64_console.exe --headless --path godot --script phase8/tools/generate_stage4_data.gd
```

## Known differences

- Floating texts (pattern names, damage numbers) and the combo counter remain undrawn, as in earlier phases.
- The browser's run/hit telemetry (`stats.runs`, used by its debug overlay) and the F6/F7 move-repeat debug keys are not ported.
- Stage 5 (Sovereign) is Phase 9; its saved entry is kept but cannot be continued yet.
