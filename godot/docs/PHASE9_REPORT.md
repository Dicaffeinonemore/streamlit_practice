# Phase 9 — Stage 5, the Black Moon Sovereign, and the ending

Stage 5 (검은 월식의 심연) is playable with Barel and Viesa: story continuation from Stage 4, Continue from a saved Stage 5 entry, the Sovereign boss challenge, and the ALL CLEAR ending after the final stage. The simulation is a line-by-line port of `sovereign-runtime.js` on top of the wave stage, verified against the original browser code. This phase also adds the arena rifts of Stages 3–5, which Phases 7 and 8 had missed.

## Delivered

- **Stage:** eight waves with the Stage 5 soldier scaling (HP ×2.4, damage ×1.9, speed ×1.2, 심연 군단 names), two abyss arena waves, field/boss/phase-two backdrops, the Stage 5 floor and music.
- **Arena rifts (Stages 3–5):** while a fire, frost or abyss wave is locked, rifts cross the screen every 5 s (first after 1.8 s). Fire and frost mark the player's lane; abyss marks every lane except the cycling safe lane. Each rift warns for 1.2 s, then erupts for 350 ms (12 damage, knockdown). Frost can be jumped over at a height of 24. Rifts are cleared when the wave unlocks. They draw the floor marks, the 24-frame zone eruption tiles (depth sorted, with the eruption flash), and the help line.
- **Sovereign (HP 2400 / 3000):** a body scheduler with distance-band weighted picks in source order, cooldowns, the two-in-a-row limit, home-fist requirements, the floor-attack exclusion, phase-two-only meteor and ultimate, pending starts (90 ticks), at most 1 (2) concurrent jobs, and the 20-tick gap between hit windows. Command and beam body poses, with the body held for wall/whirl/ultimate/beam.
- **Fists (HP 140 / 180):** two independent fists with home bob, return and rise. They shield the body from the front for every Barel and Viesa attack (combo, dash attack, skills, special, magic, red wave, arrows, which stop on a fist, dash slash, ultimate), using the source sword band (h+25 to h+90) and per-attack hit sets. Knockdown hits deal ×1.5. A broken fist falls, may drop a potion or scroll, adds +40 groggy, and rises again after 480 (360) ticks. Both fists broken causes immediate groggy.
- **Jobs:**
  - direct punch with return hit
  - tracking slam
  - triple hammer
  - grab, using Gorath's escape rule: 4 inputs within 50 ticks, a squeeze of 18, and a helper backhand of 10 when the other fist is home
  - clap
  - ground waves
  - iron wall, which blocks frontal attacks with sparks, then opens
  - whirl, with push
  - backhand, after 3 (2) unpunished hits
  - meteor rain (phase two)
  - helm beam
  - the ultimate 적월마광포: 10–12 cannon hands that avoid the player and keep a 65 px gap between lanes, firing at 1.0 s, with the laser active from 1.5–2.0 s for 23 damage
- **Boss state:** grounding on stun/down (jobs end, fists drop), quarter-HP knockdowns, the 250-tick kneel/awaken transition into phase two (fists reform with 180 HP), and death at 110 + 60 ticks, which leaves the body and both fists on the floor.
- **Presentation:**
  - Body, pose clips and hit flash: the Sovereign's clips at source scale with gain 1.8 on hit. The phase-two moon and crack mask pulses (additive), and the helm charge glow.
  - Ghost trails: the body and fists leave afterimages through a shader that applies the same `sepia(.4) saturate(.7) hue-rotate(260deg)` matrix.
  - Fists:
    - depth-sorted fists (the back fist sits behind the body)
    - shadows and punch trails
    - the dimmed back fist and the white/red glow blink at the wrist core
    - stage-two cracks and HP bars
    - lying and fallen drawings
  - Floor and screen effects:
    - slam marks and ground waves with their lanes
    - the beam lane warning, the helm beam
    - cannon hands with telegraph lines and lasers
    - the intro (200 ticks, fists drop at drawing 13)
    - the boss '!' warning
    - remains
- **Meta:** Stage 4 clear offers 다음 스테이지; Continue accepts Stage 5 entries. The Stage 5 story clear records the stage, clears the checkpoint (`UX.saveCheckpoint(null)`), plays the ending score (intro, then loop) and shows ALL CLEAR with the tally. The challenge list unlocks 흑월의 군주, 소버린 after a Stage 5 record.
- **Debug:** with F9 visible, F10 starts the Sovereign's phase-two transition and F11 sets phase two to 35% HP so the ultimate is due. The browser has no Sovereign debug keys; these mirror Vargul's.

## Verification

| Check | Result |
|---|---|
| Phase 9 source oracle (`tools/oracle/phase9_traces.cjs`) | 50 scenarios, 24,487 original steps |
| Stage 5 trace comparison (`phase9/tests/test_stage5_parity.gd`) | 4,437,170 comparisons, 0 differences |
| Covered cases | Stage 5 soldier pack; all 10 jobs in phase one and 11 in phase two; ultimate hit and dodge; grab escape, fail and helper backhand; phase-one, hit-taking, phase-two, ultimate-due and Viesa AI; fists vs Barel (combo, skill, red wave, magic, special, from behind) and Viesa (arrows, dash slash, ultimate); fist break and rise; both fists broken; iron wall; pressure backhand; transition (also with a running slam); groggy; HP knockdown; death with remains; intro; banner; full wave progression; fire/frost/abyss arenas (Stages 3–5) |
| Rendered integration (`phase9/verify_stage5.gd`) | 42 checks: next stage, banner, music, Continue, abyss rifts, waves → intro → fists home → transition → phase two → fist break → groggy → ultimate → death/remains → ending score, ALL CLEAR, cleared checkpoint, record, Sovereign challenge |
| Regressions | Phase 2 GUT (2,237 assertions); Phase 3/5/6/7/8 source parity; Phase 4 menu, practice, challenge, rendered, restart and startup checks; Phase 5–8 rendered integration |

Side-by-side captures with identical setup (`phase9/fixtures/capture_scenes.json`): `evidence/phase9_source_*.png` (browser) and `evidence/phase9_compare_*.png` (Godot) for soldiers, intro, slam, whirl (Viesa), phase-two clap, beam, meteor, ultimate and the abyss arena.

Regenerate:

```text
node godot/tools/oracle/phase9_capture.cjs
node godot/tools/oracle/phase9_traces.cjs
node godot/tools/oracle/phase9_source_capture.cjs
Godot_v4.7.2-stable_win64_console.exe --headless --path godot --script phase9/tools/generate_stage5_data.gd
```

## Known differences

- Floating texts (damage numbers, pattern names, 주먹 파괴!, 탈출!, 2 페이즈) and the combo counter remain undrawn, as in earlier phases. Spark bursts on blocked strikes are not drawn; their sounds play.
- The laser's canvas `screen` blend is drawn additively. The helm beam's 20 px tapered muzzle clip is not applied; the beam keeps its full height there. Its collision is unchanged.
- The ending is the browser's simple ALL CLEAR screen; there is no credits sequence in the source.
- With the shared Viesa ultimate, a boss in a phase transition is now skipped before its hit time is recorded, matching the source. Earlier phases' traces are unaffected.
