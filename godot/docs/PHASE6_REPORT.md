# Phase 6 — Stage 2, the Crow Witch Morgra

Stage 2 (까마귀 마녀의 성역) is playable with Barel and Viesa: story continuation from Stage 1, Continue from a saved Stage 2 entry, and the Morgra boss challenge. The simulation is a line-by-line port of the browser's wave-stage `update()`, `updEnemy()`, `damageEnemy()` boss branch and `morgra-runtime.js`, verified against the original code.

## Delivered

- **Wave stage:** `startStage(1)` (barrels, +40 next-stage healing unless restored, 160-tick banner), camera following and locking at each wave, `spawnWave()` side entries, `goT`, clear after the last wave with an empty field, 200-tick victory and HP×10 bonus, boss challenge starting in the arena (`beginBossChallenge`).
- **Soldiers:** grunt, rogue, brute and archer with the Stage 2 scaling (HP ×1.5, damage ×1.3, speed ×1.05), faction names, chase/attacker limits and lane offsets, swing wind/act/recovery with the feel-runtime reach zone (×.9 for Viesa), brute wind armor and 40% heavy form, archer spacing (190–330 px), aim tracking and straight arrows, per-type hurt ticks, chain cap, bumps and drops.
- **Boss state:** keep-away chase, attack gaps (×.8 in phase 2), chain bonus damage (+5% per hit, up to +50%), ×1.5 damage while stunned, groggy gauge (120 / 240), 300-tick stun, quarter-HP knockdowns, super armor windows, pattern invulnerability and hit stop.
- **Morgra:** all 13 patterns — staff swing, magic bolt, teleport (→ cackle), cackle, crow summon, dark curtain; aerial slash, crow rush, moon judgment, feather volley, crow summon (5), triple curtain, phase-two teleport — with their source frame events, hitboxes, hover, alpha, lane alignment and teleport rules. Projectiles: bolts, feathers, diving crows (cap 3/5), pillars, giant raven, moon field with two safe ellipses and beams, staff arcs and bursts, all with the phase-two ×1.5 damage scale.
- **Revival:** phase-one defeat clears the hazards, plays the 110 + 45 + 106-tick death and revival, then phase two at HP 1200 with the wings and the moon judgment first. Phase-two death: slow motion, flash, shake, gold and big potion drops, removal after 120 ticks.
- **Player interplay:** Barel's combo, dash attack and skills and Viesa's melee, arrows and dash cut down crows (+8 groggy each). Morgra's attack-specific hitstun now drives Barel's hurt pose (`BarelHurt.begin` ticks), including the lowered body height while crouched; Viesa keeps her default hitstun.
- **Presentation:** release backdrops (field → boss → phase two crossfade), the Stage 2 floor, named Stage 2 soldier art with the brute's ×1.12 scale, all Morgra clips with hover lift and fades, hazard sprites, the judgment moon and the cracked judgment field with true safe holes (shader), danger zones, the rising intro with its magic circle, the letterboxed intro card, the STAGE 2 banner, VICTORY text, the boss bar and enemy panel, Stage 2 and boss music.
- **Meta:** Stage 1 clear offers 다음 스테이지; Continue accepts Stage 2 entries; Stage 2 clear records rank/time and saves the Stage 3 entry; the challenge list unlocks Morgra after a Stage 2 record and asks for a character.

## Verification

| Check | Result |
|---|---|
| Phase 6 source oracle (`tools/oracle/phase6_traces.cjs`) | 36 scenarios, 14,856 original steps |
| Stage 2 trace comparison (`phase6/tests/test_stage2_parity.gd`) | 1,694,301 comparisons, 0 differences |
| Covered cases | each soldier type and a mixed pack, Viesa vs rogue/archer, Barel combo/brute armor/skills, all 13 Morgra patterns, phase-one/two/Viesa AI (900–1200 steps), revival, groggy, knockdown, stun hits, death, crows vs Barel and Viesa, boss intro, banner, full wave progression to the intro |
| Rendered integration (`phase6/verify_stage2.gd`) | 27 checks: next stage, banner, music, Continue, waves → intro → revival → phase two → death → clear/save/record, Morgra challenge with Viesa |
| Regressions | Phase 2 GUT (2,237 assertions), Phase 3 and Phase 5 source parity, all eight Phase 4 checks, Phase 5 rendered integration (38) |

Side-by-side captures with identical setup (`phase6/fixtures/capture_scenes.json`): `evidence/phase6_source_*.png` (browser) and `evidence/phase6_compare_*.png` (Godot) for soldiers, intro, crow summon, triple curtain, moon judgment and aerial slash.

Regenerate:

```text
node godot/tools/oracle/phase6_capture.cjs
node godot/tools/oracle/phase6_traces.cjs
node godot/tools/oracle/phase6_source_capture.cjs
Godot_v4.7.2-stable_win64_console.exe --headless --path godot --script phase6/tools/generate_wave_data.gd
```

## Known differences

- Floating texts (pattern names such as 달의 심판, damage numbers) and the combo counter are still not drawn, as in earlier phases.
- The judgment field omits the GIF rim glow around the safe ellipses (outlines are drawn); the boss bar has no lagging HP trail.
- Archer arrows are drawn as simple shafts instead of the browser's pixel-layer arrow.
- Stage 3 (Aurelion) is Phase 7; its saved entry is kept but cannot be continued yet.
