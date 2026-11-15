# Phase 3 — complete Stage 1 and Gorath remake

Implemented for Godot 4.7.2 with the original artwork, source frame selection and fixed 60 Hz custom combat. F5 now starts `res://phase3/stage_game.tscn`.

## Delivered

- All five connected sections: occupied street, conquered market, hound kennel, execution plaza and butcher's arena.
- Original wave queues, spawn caps and delays; left/right, door, cage, balcony and wall-break entries; camera locks; narrow kennel lane; balcony drops; 40-tick wall break; gate opening and walking entry; 30+30-tick transitions.
- Axe, blade and club soldiers plus heavy soldiers, molotov throwers and hounds. Heavy armor and choking, hound circling/dive/bite/trip, escape inputs and throwing damage follow the source.
- Fire marks, bottle trajectories, fire lifetime/limit/fading and periodic player/enemy burn damage.
- Two-hit barrels, original drop probabilities, guaranteed scroll cadence, item bounce/lifetime/pickup bounds, healing, power, SP, magic and score items. Eight original prepared item cutouts were extracted directly from `ITEM_SPRITES` after the source's edge key and lighting operation.
- Gorath remake: 548-tick table intro, source auto-walk and quiet entry invulnerability; nine attacks and weighted nonrepeating selection; hook flight/retraction, capture, four-input escape and linked attacks; phase 1 HP 385 and phase 2 HP 420; stagger, quarter-HP knockdowns and getup; complete transformation with repeated frames and gradual HP refill.
- Phase 2 ultimate thresholds at 50% and 35% clamp incoming damage. Ultimate guard, ceiling hook, seven shaking loops, maximum six pending meat drops, 72-tick landing, source ellipse collision, reverse recovery and 120-tick breathing period are implemented.
- Boss death cancels attacks/grabs/hazards, requests the source slow motion, animates collapse, retains the body and proceeds through the source clear delay. Original stage music, boss MP3, special samples and victory fanfare/loop are connected.
- Original section scenery, cleaned soldier sprites, Gorath clips, hook/chain, falling/landed meat, foreground, guard aura, gate lighting, telegraphs and collision debug are rendered natively.

## Controls and debug

Default controls remain arrows / Z attack / X jump / Shift dash / C special / A stocked magic, with S/D/Q/W/E for the five skills. F1 switches to the source WASD preset. Escape pauses/resumes, R restarts, M toggles sound. Application focus loss pauses.

F9 opens collision debug. While visible, F2 refills SP/magic, 1–5 restart at a section, F10 starts Gorath phase 2 and F11 starts his ultimate. These shortcuts do not create saves.

Arguments: `--section=1..5`, `--boss-phase=2`, `--boss-ult=1`, `--debug=1`, `--hitbox=1`, `--keys=wasd`. To inspect the ultimate directly, combine `--section=5 --boss-phase=2 --boss-ult=1`.

The Phase 2 scene remains runnable with F6, and the earlier simplified prototype remains at `scenes/main.tscn` in the installed project.

## Verification

The oracle executes the original browser functions. It does not reimplement the JS FSM. Fractional source values retain their IEEE-754 bit patterns at import, and typed runtime Resources are saved as binary.

| Check | Result |
|---|---|
| Phase 3 source oracle | 37 scenarios, 12,402 original steps |
| State and enemy frame comparisons | 1,324,038 comparisons; zero differences |
| Covered cases | All six enemy types, grabs and escapes, armor, nine Gorath attacks, hook escape, transformation, both ultimate thresholds, death, intro, all five sections, eight item pickups, barrel/enemy drops and molotov/red-wave interaction |
| Phase 2 regression suite | Five tests, 2,237 assertions passed |
| Phase 2 rendered input regression | 24 checks passed |
| Phase 3 rendered integration | 29 checks passed |

Native integration exercises every section, market fire, kennel bounds, wall break, opened gate, intro/control release, both boss HP values, transformation, guarded ultimate and meat, guard recovery, death/clear, barrel destruction, drop and collection. Setup invulnerability is hidden only during screenshot capture so Barel remains visible.

Tests use midpoint randomness to isolate logic. In live play, spawns and pattern choices use normal randomness. The oracle's arrays are copied per frame; later threshold activation cannot mutate earlier recorded states.

See `evidence/phase3-parity.json`, `phase3-integration.json`, the GUT logs, and [the visual comparison](PHASE3_COMPARISON.html). Existing unrelated JavaScript edits were preserved; porting tools do not edit original scripts.

## Remaining differences and phase boundaries

- This phase implements the Gorath **remake**. The optional browser `boss1=old` legacy debug variant is not exposed in this native scene. It is not silently substituted with the simplified prototype.
- HUD, pause controls and debug are functional interim native UI. The original ornate HUD, title/character menus, persistent settings and rebinding, save/continue, rank and practice belong to Phase 4.
- Most gameplay artwork is original. Some dust, rubble/impact particles, the narrow-path decorations, eye-glow/vignette and exact text/audio mixing remain presentation differences. The power item retains a procedural fallback because the source has no `ITEM_ART.power` image. Native screenshots are visually comparable, not pixel-identical.
- The full source is not mathematically proven for every possible interaction. The listed oracle and integration cases are the verified scope. This work does not claim completion of Viesa or Stages 2–5.

## Next phase and review checklist

Phase 4 is the original HUD, title/pause/settings, key rebinding, save/continue, ranking and practice/challenge.

- [ ] Play through all five sections with normal controls and review scenery/entry timing.
- [ ] Compare heavy/hound escapes, bottle/fire behavior and pickup effects with the browser.
- [ ] Compare intro, hook escape, transformation, both ultimate thresholds, meat landing and death/clear.
- [ ] Review the temporary HUD and documented remaining presentation differences.
- [ ] Obtain approval before beginning Phase 4.
