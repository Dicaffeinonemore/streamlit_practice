# Black Moon Knight: native Godot port plan

Status: **Phase 0 analysis complete; implementation is awaiting approval.**

Source snapshot: 2026-11-14, browser game v1.67. Working source root: `C:/Users/훈도/Documents/streamlitpractice/streamlit_practice`. Deployment project: `C:/Users/훈도/Documents/dark-moon-nights`. Engine already verified locally: `4.7.2.stable.official.ed1daf0bf`. This records the installed version; it does not claim to have checked the newest upstream release. Verify any engine upgrade against the approved baseline before changing it.

## 1. Scope, authority, and the existing prototype

The goal is a native, statically typed GDScript port of the existing game, preserving its behavior, numerical values, operation ordering, timing, and current visual selection. Use the source JavaScript as the authority when comments, patch notes, and previous prototype behavior disagree. Keep Korean text visible to players; write new code, comments, and technical documentation in English.

User art policy: **when original art exists, use it and make the runtime match it.** No replacement character art or invented placeholder effects should replace an available original. Start from the asset actually chosen by the current browser renderer, including its source frames, foot anchors, sheet-specific scaling, and timing. Raw working sheets are useful for identification and comparisons; their mere presence does not override a newer processed runtime sheet. Preserve any legacy art explicitly selectable by the original game.

The earlier `artifacts/godot_port` / deployed `dark-moon-nights` project is a useful runnable prototype, not a behavioral parity baseline. It uses delta movement and floating state ages, simplifies enemy AI, grab attacks, telegraphs, effects, and waves, changes input behavior, and saves section checkpoints rather than original stage-entry snapshots. It has no complete Viesa or stages 2–5. Its previous smoke checks demonstrate internal consistency, not equivalence with the browser. Retain the project and its backups for comparison; replace systems only after each approved phase passes parity checks. Do not treat its hand-written approximations as source data.

Out of scope: Streamlit/server deployment, single-HTML bundling, sprite-lab, mobile-lab, aseprite-test, unrelated `streamlit_wuxia_mbti.py`, Python/Lua art-generation tools, and the `GamePerf` instrumentation/optimization implementation. Consume outputs of art tools. `GameAssets`, although declared in `perf-runtime.js`, is an important loading contract and needs a native replacement; excluding that file must not discard asset readiness and stage loading semantics.

Phase 0 writes this plan and auditable inventories only. It does not change the deployed game or implement extraction/import/gameplay.

## 2. Evidence and entry-point inventory

Reviewed areas: README and patch history, actual HTML script order and menus, server entry and bundling behavior, combat data and helper functions, `game.js` state/input/combat/update/render loop, `motion.js` pixel-buffer and pose engine, UX settings/save/input mapping, audio and score scheduling, feel/telegraph/collision code, stage-one sections/enemy AI, Barel runtime and animation overrides, the Gorath remake art/runtime set, plus the remaining character/boss/visual/demo module interfaces and data layouts. All 79 loaded JavaScript files were parsed for the accompanying inventory.

Auditable companions:

- [`GLOBAL_INVENTORY.md`](GLOBAL_INVENTORY.md): every discovered script-level binding and explicit exported global property, its source line, proposed Godot owner, and lexical cross-file consumers.
- [`GLOBAL_INVENTORY.json`](GLOBAL_INVENTORY.json): exact script order, source SHA-256 hashes, module declarations/exports, free identifier references, manifest existence results, and load-order differences.
- `node godot/tools/analyze_source.cjs`: repeatable, read-only source analysis; does not execute game code. Uses Acorn from an installed package or Node 24's bundled parser. The Node-internal fallback is analysis tooling only, not a runtime dependency.

Snapshot findings:

| Item | Finding |
|---|---|
| Loaded external scripts | 79, in `index.html` order |
| Unique application global names | 1,008; includes file-private top-level bindings conservatively |
| Runtime manifest | 205 files, zero missing at analysis time |
| Audio data URIs in loaded scripts | 12 MPEG payloads: death 1, Viesa 3, Barel 6, Gorath hook 1, charge 1 |
| Working art present locally | `assets_src/gorath_remake/gorath/` and `assets/barel/rika-source/` exist |
| Browser test infrastructure | `tests/regression.cjs` already uses Chromium/CDP without Playwright |
| Legacy HD format | Palette-indexed base64 RLE, **not** base64 PNG atlases |

`server.py:SCRIPTS` is stale relative to HTML. It omits `barel-sfx.js`, `gorath-hook-sfx.js`, `gorath-charge-sfx.js`, `mobile-display.js`, both Barel named-motion modules, both Barel Rika modules, `barel-combo-fx-art.js`, and `src/animation/barel-combo-fx.js`. Current bundling explicitly follows HTML tags. Use the actual HTML load graph for extraction/oracle startup; do not silently omit these ten scripts.

The complete global list is intentionally in an appendix rather than an abbreviated list here. Namespace members such as `MO.Layer` are APIs/data members, not separate global bindings. Destructured aliases imported from `MO` into `game.js` are listed individually. Browser APIs and DOM IDs are environmental dependencies, not game globals. Consumer analysis resolves lexical scopes, but does not claim reflective/property-access call graph completeness; all static exported names remain included. No computed direct global export site was found by this scan. Per-entity fields are owned by entity state, not promoted to Autoloads.

## 3. Systems and exact behavior to preserve

| System | Source behavior / native responsibility |
|---|---|
| Simulation | Browser accumulator uses `MS = 1000/60`, caps incoming real elapsed time at 100 ms, and executes discrete `update()` calls. Fixed Godot physics driver invokes the same ordered simulation step. No movement multiplied by delta. |
| Slow motion | Browser adds `real * 0.3` to the accumulator while `slowT > 0`; `slowT` decreases by real elapsed time. Native clock has an unscaled outer time and a simulation budget; actor counters only advance on actual simulation steps. Do not apply global `Engine.time_scale` to unrelated UI/audio. |
| Hitstop | `update()` increments `tick`, `stat.ticks`, and decrements screen flash before decrementing `hitStop` and returning early. Actor timers, chain timer, and effects freeze. `pressed` entries age only when `update()` returns a processed result. Preserve these apparently unusual orderings. |
| Input | Physical keys map through UX presets to canonical action codes. `keys` is held state; `pressed` is a consumable millisecond buffer. Preserve event-edge actions, double-tap direction within 15 ticks, focus/blur clearing, aliases, and remap collisions. Do not add hold-J auto-combos. |
| Buffer/link | Global action buffer 220 ms, combo link 420 ms. `p.buf` is separate from the global pressed map. Combo continuation after recovery uses `Math.round(LINK_MS/MS)` ticks; within attacks the cancel test uses exact millisecond thresholds. |
| Player FSM | `free`, `atk`, `dash`, `dash_attack`, `skill`, `special`, `cast`, `hurt`, `down`, `dead`, `grabbed`, plus character-specific action data. Keep source skill-before-dash and gravity-before-switch ordering. |
| Movement | Ground 3.1 px/tick, air 2.6, depth factor .75; Viesa multiplies movement by 1.1. Horizontal and depth inputs are independent; diagonal input is **not normalized**. Jump velocity 9.6, gravity .55. Simulation uses floating world coordinates with integer state counters. |
| Barel attacks | c1: 90/110/150 ms, damage 10, reach 80; c2: 70/100/140, damage 11, reach 82; c3: 200/140/340, damage 16, reach 98. Active start .35 of swing; active tail 30 ms; cancel .45 of recovery. Source easing moves the step during swing, not instantly on attack entry. |
| Dash/skills | Dash 80 px with source easing over 150 ms, duration 190 ms, attack cancel 110 ms; invulnerability 15 ticks, cooldown 31. Dash attack has its own 10-frame tick schedule, cancel and grace windows. Five Barel skills, SP special, and scroll magic retain source hit sets, timing, target selection, and movement curves. |
| Normal AI | Common enemies use chase/wind/act/rec, spacing, ranged attacks, hurt/down/recovery and state-specific armor. Stage-one six species override these with measured frame timelines, grabs, hound ring/dive/bite/trip, thrower kicks/throws, and entry routes. |
| Boss AI | Common dispatch and per-boss controllers must preserve interruptions and callback order. Gorath remake uses `g2` substate and legacy grab constants; Morgra revives and owns crows; Aurelion has armor/guard/reaction mechanics; Vargul owns independent attackable orbs; Sovereign owns independently attackable fists and concurrent jobs. |
| Hit/hurt | Custom x/y/z math, directional strict inequalities, half widths, absolute/relative height rules, per-attack hit sets, fixed damage exceptions, Viesa hurt scaling, shields/interception and cancel behavior. No Godot physics bodies for combat. |
| Feel | Grade lookup drives hitstop, stun bonus, knockback, shake and flash. Stun is `max(default, move override) + grade bonus`, not one universal duration. Bosses use their own armor/stagger rules. |
| Seven-hit cap | Only consecutive hits while already hurt count; source excludes special-state attacks. Seventh qualifying hit promotes to finisher and knockdown. Do not just count all hits since spawn. |
| Enemy collision | Launched nonboss enemies may bump eligible enemies when speed >=2.5 and offsets <30 x / <14 depth; damage rounds original damage ×.3, knockback multiplier .6; per-flight duplicate suppression. |
| Telegraphs | `enemyAttackZone` and `zoneContains` feed both actual collision and drawing. Floor fill, next-hit outlines, same-lane red shadows, attack-lane flash, late blinking and `!`/`!!` use the same source zone/frame data. Minimum windup 20 ticks; last 8 ticks alert red. |
| Camera | Logical 960×540; world zoom 1.5, visible world 640×360, OY 146. Walk area GTOP 340 / GBOT 500 before section restrictions. Source camera generally advances forward only and stops at next event limit. |
| Waves/sections | Stage one has five separate backgrounds, reset-local x, spawn caps/delays, locked fights, balcony/door/cage/wallbreak origins, narrow lanes, destructible wall and gate entry. Other stages use STAGES wave tables and arena hazards. |
| Items/barrels | Preserve per-source drop rolls, barrel damage/hit-set behavior, pickup x/y/z constraints, life/gravity, potion 30, big potion 60, power 900 ticks, magic cap 3, crystal SP +25 and score catalog. |
| HUD/menus | Reproduce title, character select, opening, stage/boss intros, tutorial, pause, settings, clear, game over, ending, challenge/results, skill icons and cooldown readiness, portraits, enemy/boss bars, chain and rank tallies. |
| Persistence | Validated version-1 stage-entry progress, settings, high score/per-stage rank and sound preference; optional custom boss MP3 stored separately. Restore character and transient-state defaults exactly. |
| Rank | `stat.ticks/60` is the source time basis, including source hitstop bookkeeping. Score combines damage/death penalties, time and max chain; S >=85/no death, A >=65/no death, B >=40/<=1 death, otherwise C. Keep rounding and post-clear health bonus ordering. |
| Practice | Source prevents player damage and uses real engine actions/training completion criteria. Isolate session and suppress normal save/record writes. Do not substitute prototype continuous regeneration as the final behavior. |
| Demo/tutorial | `DEMO` runs scripted canonical input through the real simulation, snapshots/restores live session, and presents a separate view. Native isolated session avoids corrupting a paused run or record. |
| Audio | Web Audio synthesized stage/boss/victory/ending score, generated SFX, sampled MPEG overrides, mix levels and pause/mute. Custom boss file > default MP3 > synthesized boss score. Preserve sample playback guards and scheduling intent. |

Hit-grade values from `combat-data.js`:

| Grade | Stop ticks | Stun bonus | KB multiplier | Shake | Flash |
|---|---:|---:|---:|---:|---:|
| light | 4 | 8 | .8 | 0 | 2 |
| mid | 6 | 10 | 1.3 | 3 | 3 |
| heavy | 9 | 12 | 2.2 | 7 | 4 |
| finisher | 12 | 0 / knockdown | 3 | 12 | 5 |

For example c1 hurt time is max(26,30)+8 = 38 ticks; c2 is max(26,36)+8 = 44. The grade stop and move-specific stop take their maximum. Preserve the distinction between a move's nominal swing phase and its actual sampled collision-active ticks.

### Gorath remake findings

- Read the art pages, frame rectangles, per-clip `k`, pivots, measured hit extents, hand/chain/eye marks and landing frame markers together with the controller. Eight runtime atlas pages cover 33 clips.
- Source HP is 385 then 420. Actual `G2.ult` is [.50, .35], not the README/patch .35/.15. The current generated intro timeline totals 548 ticks, not the older documented 467. Preserve actual code and tag these documentation discrepancies.
- Transform has a repeated frame sequence, a gradual HP refill, armor burst, stagger reset and a pending transition when already down. A one-timer phase swap is not equivalent.
- Damage is clamped at the next unspent ultimate threshold before normal resolution; large hits cannot skip an ultimate. Ultimate can interrupt other attacks/grabs and stagger states. Invulnerability guards produce original block effects and throttle their sound.
- Hook release is frame 9, speed 8 px/tick, swept capture test, a source pull/retraction state, four consumed escape inputs, linked source attack damage totaling 20, and source escape stagger. A straight line plus timed 20-damage application is only a prototype approximation.
- Ultimate has cast, ceiling flight, repeated pulls and reversed recovery; max six pending landings, exact landing tick 72, original spacing/random aiming, ellipse collision and height <=60. Its drawn warning ratio (.3) differs from collision depth ratio (.35); preserve and document this source quirk rather than silently correcting it.
- Death cancels hazards/grabs, slows simulation, animates landing, retains remains and removes the enemy only after the original hold. Clear/victory timing depends on that removal.

## 4. Native architecture and ownership

Proposed project structure below is a design, not code created in Phase 0. Keep small entry/actor scenes. Build complex UI node trees in typed scripts; do not hand-author large scene files.

```text
godot/
  project.godot
  autoload/       game_state.gd, settings_store.gd, save_store.gd,
                  audio_manager.gd, asset_registry.gd
  scenes/         game.tscn, actor.tscn, item.tscn
  core/           simulation_clock.gd, game_session.gd, input_router.gd
  actors/         actor_state.gd, player_state.gd, enemy_state.gd,
                  barel_controller.gd, viesa_controller.gd, actor_visual.gd
  combat/         combat_data.gd, combat_resolver.gd, hit_zone.gd, feel_system.gd
  enemies/        normal_enemy_controller.gd, stage_one_enemy_controller.gd
  bosses/         boss_controller.gd, gorath_remake_controller.gd, ...
  stages/         stage_controller.gd, stage_one_controller.gd, scroll_camera.gd
  world/          hazard_system.gd, item_system.gd, backdrop.gd, effects_renderer.gd
  ui/             hud.gd, telegraph_renderer.gd, debug_overlay.gd, screens/
  modes/          practice_controller.gd, challenge_controller.gd, demo_controller.gd
  resources/      generated combat, stage, move, frame and animation Resources
  assets/         named originals, baked residual procedural visuals, audio
  tools/extract/  deterministic Node/Chromium extraction tools (Phase 1)
  tests/          source oracle fixtures and typed Godot parity tests
  docs/           this plan and generated global inventory
```

Only GameState (screen/session selection), SettingsStore, SaveStore, AudioManager and AssetRegistry are Autoloads. SimulationClock, player/enemy state, input buffers, stage events, RNG state, effects and statistics belong to a `GameSession` instance. Demo and live gameplay must be able to coexist without global entity pointers. Most global JS functions become methods on a scene-local owner or pure typed helpers, not new singletons.

Use integer simulation counters for original tick variables, integer frame indices and typed enums for states. Use floating positions and velocities because source values are fractional. Millisecond thresholds remain the original doubles or generated exact rational tick thresholds, with original `<`, `<=`, `>` and operation ordering retained. Translate JS `Math.round` explicitly (including negative-half differences) and preserve insertion order where Sets/arrays affect resolution. Typed arrays/Resources carry catalogs; dictionaries are limited to validated import boundaries and genuinely dynamic keyed data. No untyped catch-all actor dictionaries in final gameplay code.

Actor node: root `Node2D` at (x, depth), shadow on the ground pass, visual child offset upward by z, foot-anchored sprite/animation, stable y sorting with source tie ordering. Combat uses actor state directly. Render layers separately hold backdrops, floor warnings/shadows, sorted bodies, foreground effects, and screen-space HUD/cinematics.

### Source-to-Godot mapping

The exhaustive per-file declaration mapping is `GLOBAL_INVENTORY.md`. The file-group table here supplies the intended scene/Resource boundaries; the appendix follows these contracts even when a source file maps to more than one owner.

| JavaScript source(s) | Proposed Godot equivalent |
|---|---|
| `index.html` | game entry scene + typed screen/HUD builders, original labels and layout assets |
| `server.py` | no runtime port; extraction reads HTML graph; packaging/export handled later |
| `perf-runtime.js` | AssetRegistry loading readiness/grouping only; GamePerf and browser cache optimizations excluded |
| `combat-data.js` | generated typed CombatData/MoveData/FeelData Resources; pure helper parity functions |
| `game.js` | GameSession, SimulationClock, InputRouter, PlayerController, CombatResolver, EnemySystem, StageController, ItemSystem, HazardSystem, ScrollCamera, RankCalculator and screen routing |
| `motion.js` | source visual bake adapter + residual effect/pixel-kit Resources; pure easing/pose helper references where needed |
| `sprites.js`, `hd_sprites.js`, `legion_sprites.js` | decoded RGBA sheets, SpriteFrames/atlas Resources, original anchors and HD_SCALE; fallback catalog |
| `backgrounds.js`, `release-art.js`, `release.js` | StageBackdrop Resources, TitleScreen/OpeningController, original phase backdrop crossfades |
| `score.js`, `audio.js` | AudioManager, deterministic offline-rendered music/audio Resources, custom-boss-file preference |
| `death-sfx.js`, `viesa-sfx.js`, `barel-sfx.js`, `gorath-hook-sfx.js`, `gorath-charge-sfx.js` | extracted MPEG files and exact-key AudioCatalog |
| `game-ui.js` | SettingsStore, SaveStore, InputRouter, KeyBindingsScreen, TouchControls and title record/continue widgets |
| `mobile-display.js` | mobile display/layout Resource, safe-area logic in TouchControls; no laboratory app |
| `named-art.js`, `named-runtime.js` | roster Atlas/Animation Resources + ActorVisual fallback selection |
| `floor-art.js`, `floor-runtime.js` | FloorRenderer + textures/scale Resources |
| `zone-art.js`, `zone-runtime.js` | HazardVisual Resources and phase-aware HazardRenderer |
| `barel-art.js`, `barel-runtime.js` | BarelVisual, portraits/icons and original effects; separate from BarelController |
| `src/animation/aseprite.js` | frame manifest importer, animation timeline player and state-specific frame metadata |
| `src/animation/barel-combo0.js`, `barel-combo1.js`, `barel-combo2.js` | combo timeline Resources, legacy frame selection fallbacks |
| `src/animation/barel-idle.js`, `barel-walk.js`, `barel-dash.js` | state animation Resources; DashFx cache/lifecycle stays visual-only |
| `src/animation/barel-dash-attack.js`, `barel-air-attack.js` | original attack frame sequences and measured box/pivot Resources |
| `src/animation/barel-hurt.js`, `barel-down.js`, `barel-jump.js`, `barel-grabbed.js` | body-height/contact selection, state timeline/landing observation Resources |
| `src/animation/barel-named-motion-data.js`, `barel-named-motion.js` | named-motion manifest/timeline Resources and original fallback precedence |
| `src/animation/barel-rika-data.js`, `barel-rika.js` | current Barel primary frame/scale/timeline Resources; explicit `off` legacy mode |
| `barel-combo-fx-art.js`, `src/animation/barel-combo-fx.js` | original combo FX resources and state-driven FX player |
| `viesa-art.js`, `viesa-runtime.js` | ViesaController, ViesaVisual, ViesaProjectile/Ultimate controllers and effect Resources |
| `gorath-art.js`, `gorath-runtime.js` | LegacyGorathController/Visual, shared grab constants, explicit old-boss mode |
| `gorath-remake-art.js`, `gorath-remake-runtime.js` | GorathRemakeController, GorathVisual, arena cinematic and meat/hook hazard Resources |
| `morgra-art.js`, `morgra-runtime.js` | MorgraController, revival/crow subcontrollers and Move/Animation Resources |
| `judgment-art.js`, `judgment-runtime.js` | JudgmentHazard/Visual resources and original boss integration |
| `aurelion-art.js`, `aurelion-runtime.js` | AurelionController, guard/armor/reaction state, visual/move Resources |
| `vargul-art.js`, `vargul-melee-art.js`, `vargul-data.js`, `vargul-runtime.js` | VargulController, attackable OrbController, ultimate/hazard/visual Resources |
| `sovereign-art.js`, `sovereign-data.js`, `sovereign-runtime.js` | SovereignController, FistController instances, job scheduler, interception and body/fist Resources |
| `item-art.js`, `item-runtime.js` | ItemCatalog, ItemVisual, original score item values |
| `pixel-ui-art.js`, `boss-ui-art.js`, `enemy-ui-art.js`, `pixel-ui.js` | original UI atlas Resources + HUD and boss/enemy bar Controls |
| `viesa-ui-art.js`, `viesa-ui.js` | Viesa HUD/icons and selection presentation Resources |
| `stage1-bg-art.js`, `stage1-fx-art.js`, `stage1-enemy-art.js` | StageOne background layers, measured enemy frame metadata and FX Resources |
| `stage1-runtime.js` | StageOneController, StageOneEnemyController, GimmickController and stage-one visual adapters |
| `feel-runtime.js` | HitZone/CombatResolver shared geometry, FeelSystem, TelegraphRenderer, DebugOverlay |
| `demo-runtime.js` | isolated DemoController + TutorialScreen, scripts expressed as canonical input events |

Principal mutable global owners: `player/enemies/items/barrels/hazards/parts/texts/impacts/bursts/ghosts/bolts/nextId/stat/chain` go to GameSession-owned systems; `camX/camLock/lockAt/waveIdx` to ScrollCamera/StageController; `S1` to StageOneController; `G2S/G2FX/gorath2Remains` to Gorath presentation/session state; `DEMO` to DemoController; `keys/pressed/lastTap/dashReq` to InputRouter; `tick/hitStop/slowT` to SimulationClock with explicit ordered callbacks. No duplicated player truth inside UI or visuals.

## 5. Art and audio extraction/import strategy (Phase 1 design)

### Asset selection and source formats

| Observed source format | Extraction/consumption strategy |
|---|---|
| Hashed PNG/WebP in `assets/runtime/`; `data/runtime-assets.json` | Copy exact bytes to readable semantic paths inferred from JS catalog field + clip/page, preserve original hash and path in a mapping manifest. Dedupe physical files while retaining every semantic alias. Do not recompress an existing original. Fail on missing required files. |
| JS art catalogs (`*-art.js`) | Safely evaluate declarative catalogs in a sandbox; export all atlas pages, frame rectangles, anchors, scale, tips, back extents, hands, marks, hitboxes, chain coordinates and blend flags. Use source data rather than guessing a grid. Follow references into existing JSON when equivalent and record source precedence. |
| `hd_sprites.js` / `legion_sprites.js` | Load in original order. Decode each base64 `(palette index, run length)` pair into original RGBA buffers using `pal`, `w/h`, `ax/ay`, `n` and HD_SCALE. Preserve transparent pixels and source repair/masking behavior such as `sealSpritePinholes`; keep raw and presented comparison outputs separate. Pack deterministic sheets with frame metadata. |
| True embedded PNG/WebP data URLs, if encountered | Decode MIME-validated bytes directly; do not assume every base64 string is an image. Current loaded art predominantly references external runtime assets. |
| Aseprite manifest + exports | Consume checked-in `.animation.json`, actual Aseprite frame/metadata JSON, atlas PNG, durations, tags and pivot/foot metadata. Preserve source module custom timelines and per-state frame selection; SpriteFrames' uniform animation speed alone cannot encode these rules. |
| Barel Rika/named-motion data | Read processed paths, renderScale and per-frame anchors, plus runtime TIMELINES and pose precedence. Keep original high-resolution frame sizes; do not replace with the older Barel atlas when current data exists. |
| Raw `assets_src`, `assets/barel/rika-source`, other ignored authoring sheets | Inventory local availability and provenance. Prefer processed game-selected art. Do not rerun excluded Python/Lua generators or synthesize replacement art. Raw sheets without metadata are a review item, not permission to invent anchors/timing. |
| `motion.js` Mk/Layer/pose functions and procedural backgrounds/floors | Only bake residual procedural visuals actually reached by the browser selection/fallback path. Use original drawing functions at source scale, both facings where necessary, all sampled simulation frames and original blend modes. Parameterized hazards/effects need either enumerated parameter sets or a small exact native renderer; do not flatten world-dependent telegraphs into a misleading static sprite. |
| UI/portraits/title/opening/zone/item atlases | Preserve original crops, animations, additive layers and scaling, not just actor bodies. Reuse original icons/effects whenever present. Use native Controls with original assets and text. |
| MPEG data URLs in five SFX modules | Decode exact bytes using original key filenames with namespace collision handling/aliases. Include `GORATH_HOOK_SFX_URL` and `GORATH_CHARGE_SFX_URL`. Preserve gain, throttle and state-based sound suppression from audio/runtime code. |
| Synthesized SFX inside `audio.js` | Render in OfflineAudioContext at fixed sample rate/seed with a table of name/variant inputs; map original call keys to resulting samples or exact native synthesis where needed. Embedded MP3 overrides remain higher priority. |
| `score.js` stage/boss tracks | Offline-render full repeatable musical periods (5 stage + 5 synthesized boss tracks), not `renderPreview`'s 12-second fade. Schedule through SCORE.create/step with deterministic noise, save PCM intermediate and encode OGG with a pinned encoder. Render warmup/tail overlap for reverb and specify exact loop start/end samples. |
| Victory/ending score | Render intro fanfare once plus separately loopable march section; keep the 2-bar intro and 8-bar repeat behavior. They are not identical to a single uniformly repeating stage track. |
| Existing `assets/bgm/boss.mp3` | Copy exact file and preserve precedence: custom chosen file > supplied default > synthesized boss music. Native custom file selection lives in AudioManager/SaveStore later. |

Planned tools: `godot/tools/extract/manifest.cjs`, `catalogs.cjs`, `rle.cjs`, `aseprite.cjs`, `bake_visuals.cjs`, `audio.cjs`, `compare.cjs`, coordinated by `extract_all.cjs`. These names are proposed; no Phase 1 pipeline has been implemented here. Use existing CDP test techniques for browser-only canvas/Web Audio work. Existing `tools/export_godot_data.cjs` is partial prototype tooling, not the final extraction pipeline.

Determinism contract: canonical key sorting, fixed RNG seed, controlled clock/DPR, exact browser build and audio sample rate, deterministic packing/encoder settings, relative paths, source hashes, output hashes, schema version and tool-version lock. Do not write wall-clock timestamps or machine paths into generated payloads. Run extraction twice and compare byte hashes. Log every missing resource, fallback, alias and unused authoring reference. Asset preview pages must not depend on the deployed native runtime to produce their expected images.

Import tool: typed EditorScript/import utility creates AtlasTexture/SpriteFrames Resources with frame rectangles and per-frame durations. A separate AnimationTimeline Resource retains pivot/scale, state-dependent selection, exact simulation boundaries and hit/hand metadata. Do not let render FPS advance gameplay events. Validate frame bounds, transparent edge gutters and maximum texture dimensions. Repack oversized sheets only with exact remapped rects and unchanged pivots.

Pixel filtering: project default Nearest as requested. Browser `smoothFor(k)` and Barel Rika's high-resolution downsampling are real source behavior. Compare at source render scale before deciding per-resource overrides; document any approved Linear override rather than globally changing sampling. Integer viewport scaling is preferred when it fits, but preserve the source internal zoom of 1.5 and original logical/world coordinate relationship.

Visual evidence: a side-by-side HTML comparison and exported PNG contact sheets for original renderer vs extracted frame at the same action tick, foot location, scale, facing, alpha and blend. Include Barel idle/walk/three attacks/hurt/jump/down, each normal enemy, every boss phase, hook/chain/meat, UI icons and residual procedural sprites. Compare alpha masks, foot drift, weapon tip positions and RGBA where rasterization permits.

## 6. Core parity implementation strategy (Phase 2 design)

The vertical slice is intentionally smaller than the earlier prototype: **Stage 1 section 1 with Barel, axe/club/blade enemies and identical source timing**. Do not infer that the old prototype's larger surface area means parity is complete.

1. Configure 960×540, 60 Hz physics, default Nearest, suitable integer viewport scaling where available and a small main scene. Verify the installed 4.7.2 engine; pin the exact engine for oracle comparisons.
2. Generate typed CombatData Resources from the original declarations/helper evaluations. Keep Barel/shared/enemy values in one generated source of balance, with source hash and validation; boss-specific values stay in their own generated Resources.
3. Port discrete `update()` ordering, InputRouter and Player FSM line by line. Native `_physics_process` drives an unscaled clock and simulation budget; no delta-based actor updates. Source millisecond quantities remain at original sampling boundaries. Real-time slow duration and discrete state time remain separate.
4. Port pure x/y/z zone queries, hit sets, rounding, damage/armor/interception, HP/SP gain and knockdown. Telegraphs and combat query identical HitZone data. Preserve source live-array iteration/removal and hitstop trigger semantics.
5. Port basic enemy AI and stage-one section-1 frame transitions including source windup stretching. Implement feel/knockback, chain cap and enemy-enemy impacts before calling the slice complete.
6. Connect primary original Barel Rika assets plus original enemy/background/FX frames. Advance pose selection from simulation state and source timelines, not elapsed animation playback.
7. Add F9 full hit/hurt/telegraph overlay, frame/tick, input-buffer state, tier, stun, last target and hitstop. Body rectangles alone are insufficient.
8. Make typed GUT parity tests using a Godot-4.7-compatible pinned release; verify exact dependency compatibility when Phase 2 begins. Do not implement a test framework or install it during Phase 0.

The source oracle is a small Node/CDP runner (planned `godot/tools/oracle/dump_frame_data.cjs`) that starts the original HTML graph, disables autonomous RAF for controlled stepping, sets deterministic RNG and scripted canonical inputs, and snapshots actual states each simulation step. Static combat tables alone cannot prove source FSM equivalence. Reuse the existing frame-data fixtures/tests as evidence, not as a replacement for new exact traces.

Fixtures include raw and effective wind/active/recovery boundaries; every attack's first/last hit; input press/consume/link ticks; movement and jump trajectories; per-grade hitstun/stop/KB; seven-hit promotion; collision hits; dash grace/cancels; one-hit-per-set; armor; lane and height boundary samples. Keep source output values as immutable test inputs generated from that source hash. Run fixtures at several render refresh rates with the same 60 Hz simulation inputs and compare native step traces.

## 7. Saves, audio, and debug compatibility

SaveStore mirrors logical keys `bmk_settings`, `bmk_checkpoint`, `bmk_records`, and sound preference `sf_snd`, using validated versioned JSON/ConfigFile in `user://`. `bmk_lab_*` is laboratory-only and excluded. Custom boss MP3 is in IndexedDB in the source; native storage must retain chosen bytes/name outside the JSON. Browser storage is not automatically accessible; a future explicit export/import adapter can migrate it. Do not overwrite the prototype's `checkpoint_v1.json` or treat its section schema as source-compatible.

Progress saves at **stage entry**, not every section. Snapshot contains characterId, stage, score, HP, lives, SP, magic and buff with source validation limits (Barel HP100, Viesa HP80). `startStage` restores/reset transient state; normal next-stage recovery is 40 HP, and clear-save ordering must avoid double healing. Clear results update best rank/time and high score, add HP×10 bonus, and clear checkpoint after final stage. Practice, demo and boss challenge must not write normal progress.

CLI/debug parity: map `section` to `--section=1..5`, `hitbox` to `--hitbox=1` plus F9, `debug` to `--debug=1`, `boss_phase` to `--boss-phase=2`, `boss_ult` to `--boss-ult=1`, `boss1=old` to `--boss1=old`, and `barelRika=off` to `--barel-rika=off`. Preserve Vargul F2/F3/F4/F6/F7/F8 debug gates and attack selection only in explicit debug mode. Add native debug menu during its approved phase. Enumerate all additional URLSearchParams keys in the source-oracle fixture generator rather than silently assigning unsupported flags behavior.

## 8. Approval-gated phases and completion comparisons

Each row is a separate approval gate. Report completed work, source differences with reasons, evidence and next phase; then stop. No subsequent phase starts automatically.

| Phase | Deliverable | Side-by-side exit checklist |
|---|---|---|
| 0 — current | Plan, exact script/global inventory, asset availability and risks | Source graph/hashes recorded; all globals assigned; discrepancies identified; user approves Phase 1 |
| 1 — extraction | Deterministic asset/audio pipeline, import Resources, visual comparison evidence | 205 manifest paths resolved or explicitly accounted; all selected art paths/embedded samples decoded; RLE and pose baking match source; pivots/scales/timelines intact; repeated output hashes identical; music period/loop seam checked |
| 2 — vertical slice | Fixed-step typed core, Barel + section 1 enemies, full feel and F9 | Source/native frame trace equality; hit/height/depth boundaries; no diagonal normalization; original buffers/dash/cancels; grade/chain/bump behavior; original art at exact scale; same scripted fight outcome |
| 3 — full stage 1 | All five sections/gimmicks + Gorath remake and legacy selection | Spawn routes/caps/delays, balcony drop, hound/grabs, fire, wall/gate/fade; intro 548 ticks; HP385/420; threshold clamp .50/.35; exact hook/escape/link; 72-tick meat landing and ultimate invulnerability/recovery; death/remains/clear ordering |
| 4 — menus/meta | HUD/title/pause/settings/key binding/save/rank/practice/challenge | Original portraits/icons, key presets and conflicts, volume/motion options, focus pause, validated stage-entry restore/round-trip, lives/respawn, rank/time/score and no practice/challenge save leaks |
| 5 — Viesa | Full second playable character and UI | HP80 and .9 hurt scale, 1.1 movement, arrow trajectories/height, melee, six-shot barrage, hold/release snipe, ground/air backflip, hover/landing, 200-arrow ultimate, character-specific saves and SFX |
| 6 — stage 2 | Morgra stage and two phases | Waves/arena; revival HP1200; crows and projectile interception; pattern frame/invulnerability and revival/clear timings |
| 7 — stage 3 | Aurelion stage and two phases | HP1800/2200, armor/guard reactions, attack choices and all move/event frames, adds, source backdrops/hazards |
| 8 — stage 4 | Vargul stage and two phases | HP2000/2500, independent HP30 orbs, resummon cooldown starts after both break, ice hazards/ultimate and debug traces |
| 9 — stage 5 | Sovereign stage and two phases | HP2400/3000, fist HP140/180, damage interception and rear-height fix, job overlap/guard/grab/ultimate, phase transition/final ending |
| 10 — touch/mobile | TouchControls and responsive safe-area layout | Canonical inputs equal keyboard trace, simultaneous touches/release/focus cancellation, original edit/persist behavior and mini safe areas; no lab port |
| 11 — audio polish | Full original mix/events, custom boss-file UX and seamless loops | Embedded sample comparison, throttle/priority/suppression, stage/boss transitions, pause/resume/mute, victory intro/loop and ending, approved music loudness/seams |
| 12 — tutorial/demo | Real scripted demonstrations and opening/tutorial flow | Same steps/events/key highlighting, isolated snapshots and restores, pause/help origins, no live save/stat leaks |
| 13 — exports | Windows, Web, Android/iOS presets and instructions | Real target builds, aspect/pixel sampling/input/audio/save persistence, restart/continue on device, required signing/toolchain checks and target-specific differences recorded |

## 9. Risks and decisions for review

| Risk / unresolved detail | Proposed handling |
|---|---|
| Existing prototype diverges substantially | Reuse original asset references and helpful presentation scaffolding only after checking them. Rebuild timing/state/combat core from JS under parity tests; do not patch around approximate behavior. |
| Shared globals and cyclic dependencies | Audit the complete appendix; pass session/system references explicitly. Split visual/controller state; preserve initialization data dependencies and do not introduce 1,008 singletons. |
| Source comments disagree with live code | JS is authoritative. Record Gorath timing/threshold discrepancies and similar cases as source quirks. Do not rebalance. |
| Raw authoring art may be ignored by Git | Current local working assets exist, all 205 runtime manifest files exist. Package consumed runtime outputs; keep provenance and flag missing unmanifested runtime references in extraction. Presence checks do not replace frame decode/bounds QA. |
| Primary art vs fallback art | Match current renderer's selection order: Rika first where enabled, state modules/legacy fallback as source dictates; never replace available original FX with stock shapes without recording a true source procedural case. |
| Nearest default vs source smooth downsampling | Keep Nearest project default; review per-resource sampling with source render comparisons. Request any intentional visual departure at the phase gate. |
| Source RLE/frame repair | Decode raw then reproduce actual presented repairs/masks; distinguish raw-data fidelity from browser-render fidelity in fixtures. |
| Slow time and mixed ms/tick counters | Separate real time, outer physics tick and executed simulation tick. Explicitly test hitstop buffering, intro/stat accounting, slow death and rendering refresh independence. |
| JS/GDScript numerical quirks | Match `Math.round`, strict comparisons, truncation, Set identity/insertion, modulo and RNG call order. Use stable actor IDs in snapshots; preserve fractional positions. |
| Dynamic effects and baked sprites | Frame baking alone cannot represent continuously aimed beams, chains, variable-size warnings or scene collisions. Reuse existing sheets and exact parameterized geometry; approve any bounded approximation explicitly. |
| Offline score rendering and OGG | Pin browser/encoder/sample rate; distinguish synthesized fallback from supplied MP3; warmup/tail overlap; exact sample loop metadata; encoder/tool installation may need separate environment access. |
| Engine/test-library compatibility | Installed engine is known; check latest upstream and GUT compatibility when implementation begins. Do not claim a dependency version is validated before testing it. |
| Replay determinism | Use the same deterministic RNG adapter for both source/native fixture runs. Normal game randomness may remain random; seeded comparison must preserve the source sequence of random calls. |
| DOM/fonts/native screenshots | Use original raster UI assets and Korean-capable bundled font only when available/licensed in source. Font metrics and native rendering can differ; compare geometry/text wrap separately from raster sprite equality. |
| Multi-platform exports | No toolchain/signing assumptions. Implement desktop parity first; Web/mobile threading/audio/filesystem constraints get explicit target validation later. |

No missing-art question currently blocks approval of Phase 1. Defaults proposed for approval: use current browser-selected original art, preserve source numbers/quirks, pin the installed engine baseline initially, and replace prototype approximations in gated stages. If art choice or engine version should intentionally differ, record that as a deliberate change before implementation.

## 10. Phase 0 completion and requested approval

- [x] Source systems, update ordering, input/FSM/combat, stage/AI/UI/save/audio/rank/demo contracts inventoried.
- [x] Actual HTML graph and stale server list reconciled.
- [x] Exhaustive discovered application globals mapped in the companion inventory, including source locations and hashes.
- [x] Runtime assets checked for existence; format-specific extraction and native import strategy specified.
- [x] Existing prototype limitations and source/document mismatches documented.
- [x] Later phases, comparison criteria and approval stops specified.
- [ ] User approves Phase 1 asset extraction/import work.

**Next action after approval: implement Phase 1 only, using existing original art/audio and deterministic comparison outputs.**
