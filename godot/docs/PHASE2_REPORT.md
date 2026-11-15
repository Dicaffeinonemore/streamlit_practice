# Phase 2 — native core and first street section

Implemented with Godot 4.7.2, using the existing original art and audio. This is the approved Barel vertical slice. Later stages and bosses have not been started.

## Delivered

- F5 main scene: `res://phase2/vertical_slice.tscn`. Logical viewport 960x540, integer stretch, default Nearest filtering, 60 physics ticks per second. Rika artwork retains its source linear sampling at its original scale.
- Typed, custom x/y/z simulation. Movement, jump, three-hit combo, air attack, dash/dash attack, five skills, special and magic use source ticks and state transition ordering. No physics bodies perform combat detection.
- Source combat balance is extracted by Node and generated into typed Resources. `combat.res` is the runtime binary; `combat.tres` is an inspectable companion. An IEEE-754 sidecar preserves original fractional values through JSON import. Loading text decimals had changed a special animation floor boundary by one ULP; the binary resource resolves it without changing timing or tolerance.
- Original axe, blade and club soldier art and AI. The street uses the original two wave queues, maximum of three live enemies, left/right routes, shop-door entry, forward-only camera and lock limits. The slice stops at the boundary where the browser starts fading into the market.
- Hit grades, hitstop, hitstun, knockback, seven-hit knockdown, launched-enemy collisions, shake, flash, red lane shadows, warning range fill, late blink, `!` / `!!` and F9 collision display.
- Native depth sorting, floor shadows, separate airborne sprite height, source Rika frame selection, source cleaned enemy frames, original animated street layers and original combo/skill effects.
- Original MP3 samples and captured synthesized sounds, stage 1 OGG loop, leading-silence offsets, sample priority and one continuous special-combo sample.

## Run and controls

Open the destination `project.godot` in Godot 4.7.2 and press **F5**. If Godot was open while project settings changed externally, reopen the project once. F6 runs only the currently selected scene; use F5 for this slice.

| Action | Arcade default | WASD preset |
|---|---|---|
| Move | Arrow keys | WASD |
| Attack | Z | J |
| Jump | X | K |
| Special (full SP) | C | Space |
| Magic (requires stock) | A | L |
| Dash | Shift / horizontal double tap | Shift / horizontal double tap |
| Thrust / slam / whirl / leap / red wave | S / D / Q / W / E | U / I / O / P / H |

F1 switches the source keyboard presets. Escape pauses/resumes; leaving the application also pauses. R restarts the street. M toggles sound. F9 toggles hitboxes; F2 refills SP and magic only when that debug overlay is visible. Normal starting stock is the source's SP 0 / magic 0.

Supported arguments: `--section=1`, `--hitbox=1`, `--debug=1`, `--keys=wasd`. Only the first section is implemented in this phase. Unsupported section requests are reported instead of opening a different section.

## Verification

`tools/oracle/dump_frame_data.cjs` executes the real browser source; it does not implement a second JS combat model. Tests use GUT 9.7.1, vendored with its license in `addons/gut`.

| Check | Result |
|---|---|
| 36 combat scenarios, 5,240 source steps; state and selected animation frame comparisons | 502,597 comparisons, zero differences |
| Street camera, wave queue/cap/replenishment and door entry through the section boundary | 547 source steps, 23,837 comparisons, zero differences |
| Strict facing/x/depth/height boundaries | 126 source cases passed |
| Real browser accumulator at 30/60/144 Hz, slow motion, pause and elapsed-time cap | 702 render intervals matched |
| GUT suite | 5 tests, 2,237 assertions passed |
| Native rendered integration | 24 checks passed: physical bindings, all five skills, magic, dash attack, pause/restart, preset switch, attack damage, debug, special, game over, two waves and section completion |

The numerical fixture uses midpoint randomness to isolate the FSM and collisions. Out-of-scope drops and section progression are disabled only in the combat fixture; the separate street fixture exercises the real original progression. This is evidence for the tested slice, not a claim of complete game parity.

Screenshots and logs are in `evidence/`. Open [the comparison page](PHASE2_COMPARISON.html) to compare original/native poses, street placement and floor telegraphs. The porting tools do not edit original JavaScript; existing unrelated source edits are preserved.

## Differences and limits

- Full menus, original ornate HUD, persistent settings/rebinding/save/continue/rank and practice are Phase 4 work. This phase has a compact functional HUD, pause and debug controls so the combat slice can be played and reviewed.
- The street's barrel at x=520 and item/drop collection are deferred to full Stage 1 integration. This slice contains the two enemy waves, with no item farming or stock changes from drops.
- Source art and chosen frames are retained. Impact rings/particles, dash/jump dust, some afterimages, vignette, text rendering and the exact original audio compressor/fade mix are not fully reproduced. Original skill/combo sheets, special background dimming and slam clipping are present. Native rendering is visually comparable, not pixel-identical.
- Cosmetic shake uses an independent RNG so redraw frequency cannot change native combat spawns. Random sequences are not promised to match a live browser session.
- Slow motion is implemented and compared against the original accumulator; the source normally triggers it on boss death, which is outside this slice.
- Section completion stops here; the market, kennel, plaza, arena and Gorath await Phase 3 approval. The earlier prototype remains accessible separately through `scenes/main.tscn` with F6.

## Next phase and comparison checklist

Phase 3 is full Stage 1: remaining sections, barrel/items integration, molotov/balcony/fire, hounds/grabs, heavy soldiers/wall/gate, transitions and Gorath remake with intro, phase 2 and ultimate.

- [ ] Compare default physical keys, combo buffers and all cancels side by side with the browser.
- [ ] Compare all three warning shapes, late flash, hitstop jitter, seven-hit knockdown and collision knockback during normal play.
- [ ] Review the temporary HUD and documented FX/audio differences.
- [ ] Approve Phase 3 before implementing later sections or the boss.
