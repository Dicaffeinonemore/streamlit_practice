# Phase 1 — original asset extraction and Godot resource import

Scope: original art/audio extraction, metadata preservation, a typed Godot import tool, an asset review scene, and asset-level verification. Native gameplay parity remains Phase 2 and has not been started.

## Delivered

- A re-runnable Node/isolated-Chromium pipeline under `godot/tools/extract/` consumes the actual HTML script graph. It does not edit original JS or invoke the excluded art-generation tools.
- All 205 runtime manifest image paths resolve; exact original bytes are copied with readable semantic names and hash suffixes. Source paths, hashes, aliases, and authoring-source availability are retained.
- 21 original Aseprite manifests are parsed with the source adapter. Relative authoring paths and raw JSON are retained for provenance; normalized Resources resolve the copied PNG directly. Legacy folders receive distinct IDs to avoid the duplicate jump-manifest basename collision.
- 639 palette/RLE source frames are independently decoded and compared to browser-presented buffers, including the original player pinhole repair. Both raw and presented pages are exported.
- Source-rendered procedural poses are sampled at every simulation tick in each recorded recipe and both facings. Canonical effects, floors and backdrops are baked with their source parameters/ranges recorded. Variable geometry remains explicitly parameterized for future gameplay code.
- Stage-one presented frame exports include the source edge-fragment cleanup and the newer club attack sheet/anchors. Original unprocessed atlases are also preserved.
- Barel Rika frames and named-motion fallbacks retain their anchors and scale, with separate actual timeline clips. Barel combo FX, stage-one animated backdrop layers, zone sheets, title GIF frames, source boss/character frames and named actors are cataloged. Boss HD texture coordinates and foot-coordinate units are normalized separately; Vargul's per-frame visual-scale factors are retained.
- Original embedded MPEG samples are decoded to files with exact keys and namespaces. Their playback offsets, overrides and source playback code are retained in audio metadata.
- Source synthesized SFX are rendered through the original audio setup and gain table in variants 0/1/2.
- Ten source stage/boss score periods plus victory/ending march loops are rendered with source SCORE.create/step, warmup reverb, original tempo and no preview fade. Victory/ending fanfares are separate files. Existing boss.mp3 is copied byte-for-byte and retains priority over synthesized boss music.
- A typed Godot importer saves an `animation_asset.gd` Resource containing SpriteFrames, pivots, scales, frame durations, timing-authority flags and original metadata for each animation.
- `port_tools/asset_review.tscn` provides filtering, play/pause/frame stepping, a fixed foot-anchor cross and an OGG playback button. This scene can run independently in the existing project with F6; the existing game's F5 entry scene is preserved.

## Verification results

| Check | Result |
|---|---:|
| Original runtime image paths resolved | 205 / 205 |
| Missing required runtime assets | 0 |
| Animation resources | 833 |
| Frames | 26,629 |
| Textures used by normalized frame catalog | 487 |
| Source-rendered baked PNG frame RGBA matches | 19,737 |
| Independent RLE presented-frame matches | 639 |
| Browser-decoded original/copied crop matches | 1,714 |
| Out-of-bounds normalized frames | 0 |
| Embedded MPEG samples | 12 |
| Synthesized SFX variants | 129 |
| Full-period OGG loops decoded with exact sample lengths | 12 |
| Godot saved/reloaded resource and audio checks | 135,809, zero errors |
| Repeated Godot Resource saves | 833 resources, zero byte changes |
| Repeated extraction outputs with verified canonical audio | 826 files, zero byte changes |

The final extraction-output hash comparison and deployed preview evidence are recorded in `godot/evidence/` and the target project's `evidence/` folder. See `port_assets/catalogs/validation.json`, `rle_verification.json`, `audio.json`, `output_hashes.json`, and `port_assets/review/comparison_results.json` for machine-readable evidence. The HTML and PNG comparison outputs show original vs extracted artwork, including Barel, the six stage-one enemy species, boss phases and Gorath props.

These are asset/import checks, not a claim that the older gameplay prototype has source-equivalent combat.

## Audio determinism and intentional distinctions

Chromium's convolution output differs at the last floating-point bits on fresh captures. Independent captures showed differences around 1e-9 in sampled boundary values; these can alter PCM rounding and subsequently OGG bytes. A clean-cache capture is therefore not promised to be byte-identical to an earlier clean-cache capture.

For reproducible re-runs, original captured PCM/WAV and OGG are canonical build inputs keyed by source file contents, browser version, sample rate and encoder version. Every byte hash is checked before reuse; changed source or tools invalidate the key. Preserve `audio/pcm/` and `audio.json` to reproduce the identical build elsewhere. `--rerender-audio` explicitly replaces the canonical capture. Re-encoding unchanged PCM was separately verified byte-identical after deterministic Ogg serial/CRC normalization. This is documented rather than hidden by an overly broad determinism claim.

Music loops contain steady-state source synthesis. Runtime fades, pause/resume, custom boss file selection and final mixing are later native audio integration work. SFX variants preserve the source setup/gain contract; the later native mixer must avoid applying the already baked mix factors twice.

Unknown animation durations are marked as state-driven and retain their original timing catalogs. SpriteFrames uses a clearly flagged 100 ms preview duration in those cases; gameplay must use the original state/frame logic. The asset review's render-time delta loop does not implement game simulation.

Procedural sprite sheets cover the exact bounded recipes recorded in `bake_recipes.json`. They do not claim exhaustive coverage of infinite aiming, scaling, beam-width, chain geometry or backdrop-time parameter combinations. Those remain exact parameterized renderers/reference fixtures in their approved later phases. Existing original art is preferred to procedural fallbacks.

## Files and execution

- Source plan: `godot/docs/PORTING_PLAN.md`.
- Pipeline instructions: `godot/tools/extract/README.md`.
- Generated data/art/audio: `godot/port_assets/`.
- Typed importer: `godot/port_tools/import_assets.gd`.
- Native round-trip checks: `godot/port_tools/verify_assets.gd`.
- Small review scene: `godot/port_tools/asset_review.tscn`.
- Deployment helper: `tools/install_godot_phase1.ps1`; copies the Phase 1 directories into the existing `dark-moon-nights` project and preserves its `project.godot` and gameplay entry scene. PCM intermediates are not deployed.

Open the review scene in Godot and press **F6 (Run Current Scene)**. In the standalone `godot/project.godot` asset-review project, F5 also starts the review scene. In the existing deployed game project, F5 still starts the existing game prototype.

## Phase gate

Phase 1 prepares original assets and native Resources. Next is Phase 2: the statically typed, fixed-60-Hz gameplay core and source-equivalent Barel/section-one vertical slice, with frame trace comparisons and full hit/telegraph debugging.

Stop after the Phase 1 report and wait for approval before starting Phase 2.
