# Phase 7 — Stage 3, the Golden King Aurelion

Stage 3 (몰락한 황금 왕국) is playable with Barel and Viesa: story continuation from Stage 2, Continue from a saved Stage 3 entry, and the Aurelion boss challenge. The simulation is a line-by-line port of `aurelion-runtime.js` on top of the Phase 6 wave stage, verified against the original browser code.

## Delivered

- **Stage:** seven waves with the Stage 3 soldier scaling (HP ×1.8, damage ×1.5, speed ×1.1, 황금 왕실 names), the throne-room boss arena, the approach backdrop 350 px before the boss and the Stage 3 floor and music.
- **Aurelion (HP 1800 / 2200):** per-tick source timelines with crossed events, the phase-two telegraph compression (×1/0.85), movement per drawing, invulnerable and super-armor windows, multi-hit and per-drawing attack data, body hits while charging, the charge cut-off within 130 px and the whirl's upgraded first hit.
- **Patterns:** three-hit combo with its stop1/stop2/full branches, sword wave (3 / 4 crescents), cleave with forward (and phase-two backward) gold shocks, charge, judgment marks (3 / 5) and pillars, guard, whirl and taunt, chosen by distance band weights in the source order, cooldowns, the two-in-a-row limit, approach/back-off locomotion and lane alignment.
- **Guard:** reactive guard when the player starts an attack nearby (35% / 45%), pressure guard after 3 (2) unpunished hits, parry of light hits (short hurt, no damage), break by heavy hits (+30 groggy), 60-tick timeout into a 24-tick opening. Every Barel and Viesa attack start reports to the boss (`reactAurelionAttack`).
- **Boss state:** quarter-HP knockdowns that summon two spearmen, groggy/stun, taunt after knocking the player down, hurtbox-driven width, the 242-tick transformation into phase two (halo and gold aura, HP refill) and death with its slow motion and 171-tick removal.
- **Presentation:** Aurelion's clips with the gold / red / white telegraph flash, royal halo and phase-two aura, gold slashes, waves, shocks, blinking judgment marks and pillars (additive), the boss '!' warning and stun stars (also for Morgra), the letterboxed intro card with Aurelion's intro length.
- **Meta:** Stage 2 clear offers 다음 스테이지; Continue accepts Stage 3 entries; Stage 3 clear records and saves the Stage 4 entry; the challenge list unlocks Aurelion after a Stage 3 record.

## Verification

| Check | Result |
|---|---|
| Phase 7 source oracle (`tools/oracle/phase7_traces.cjs`) | 34 scenarios, 13,948 original steps |
| Stage 3 trace comparison (`phase7/tests/test_stage3_parity.gd`) | 1,879,289 comparisons, 0 differences |
| Covered cases | Stage 3 soldier pack, Viesa vs brute, all 8 patterns in phase one and 6 in phase two, far charge, phase-one/two/Viesa/Barel-fight AI, parry, break, timeout, pressure guard, reactive guard check, groggy, HP knockdown with adds, transformation, death, intro, banner, full wave progression |
| Rendered integration (`phase7/verify_stage3.gd`) | 27 checks: next stage, banner, music, Continue, waves → intro → transformation → adds → death → clear/save/record, Aurelion challenge |
| Regressions | Phase 2 GUT (2,237 assertions), Phase 3/5/6 source parity, all eight Phase 4 checks, Phase 5 (38) and Phase 6 (27) rendered integration |

The Aurelion weight tables are captured with their original key order (`AURELION_WEIGHT_ORDER`), because the weighted pick walks `Object.entries()` in source order while the fixtures store keys sorted.

Side-by-side captures with identical setup (`phase7/fixtures/capture_scenes.json`): `evidence/phase7_source_*.png` (browser) and `evidence/phase7_compare_*.png` (Godot) for soldiers, intro, combo, phase-two cleave, phase-two judgment and guard.

Regenerate:

```text
node godot/tools/oracle/phase7_capture.cjs
node godot/tools/oracle/phase7_traces.cjs
node godot/tools/oracle/phase7_source_capture.cjs
Godot_v4.7.2-stable_win64_console.exe --headless --path godot --script phase7/tools/generate_stage3_data.gd
```

## Known differences

- Floating texts (pattern names such as 황금의 엄벌) and the combo counter remain undrawn, as in earlier phases.
- The telegraph flash uses colour modulation in place of the browser's CSS sepia/hue filters.
- Stage 4 (Vargul) is Phase 8; its saved entry is kept but cannot be continued yet.
