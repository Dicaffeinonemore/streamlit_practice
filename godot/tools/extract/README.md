# Phase 1 extraction tools

Run from the original browser repository root. These tools consume existing art and invoke the original JavaScript in an isolated Chromium page. They do not edit browser game files, run art-generation Python/Lua tools, or implement native gameplay.

## Dependencies

- Node 24 (tested with the version in `port_assets/catalogs/toolchain.json`).
- Sharp 0.35.5. Install this directory's package or use `CODEX_NODE_MODULES` to point to an existing Node modules directory. The local Codex runtime fallback is supported.
- Chrome/Chromium; set `BROWSER_PATH` if it is not in the usual Windows/Linux location.
- Python 3.12 with NumPy and CFFI. Set `BMK_PYTHON` if necessary.
- SoundFile 0.13.1 installed only into `godot/tools/.deps`, including its platform libsndfile wheel:

```text
python -m pip install --target godot/tools/.deps --no-deps soundfile==0.13.1
```

The encoder streams 4,096-frame blocks to avoid the Windows libsndfile/Vorbis integer-conversion stack overflow on long clips. It normalizes Ogg stream serial numbers and recalculates page CRCs to remove container randomness. Output duration is verified by decoding it again. No system installation of FFmpeg is needed.

## Build

```text
node godot/tools/extract/extract_all.cjs
node godot/tools/extract/verify_outputs.cjs
```

Generated outputs live in `godot/port_assets/`:

- `images/`: exact original image bytes, readable catalog-derived names, hash suffixes.
- `aseprite/`: original manifests/metadata/PNGs, parsed with the original adapter.
- `rle/`: lossless raw and presented legacy sprites. Player pinhole repair matches the source function.
- `baked/`: source-rendered procedural poses/effects, source-cleaned stage-one frames (including the newer club attack), fallback floors/backdrops. Transparent padding is copied as raw RGBA without alpha resampling.
- `gif/`: every original animated title frame with source durations, since native Godot does not directly import GIF as a SpriteFrames animation.
- `audio/original/`: original embedded MPEG samples with exact keys and namespace folders, plus the supplied boss MP3.
- `audio/sfx/`: source synthesized effects for variants 0/1/2. Captured through the original setup/mix and gain table; embedded override priority is retained in audio metadata.
- `audio/pcm/`: repeatable PCM intermediates (ignored by Git and deployment).
- `audio/music/`: twelve full-period OGG loops and separate victory/ending WAV fanfares.
- `catalogs/`: all source catalogs and source hashes, normalized frame metadata, audio metadata, original-to-native file map/provenance, validation, tooling versions and complete extraction-output hashes.
- `review/`: original/extracted comparison HTML, pixel comparison JSON and contact-sheet PNG.

`--catalogs-only` is a development-only subset: it skips RLE/procedural/audio extraction. Do not use it as the final Phase 1 build or as proof of repeatability.

To check repeatability, copy `port_assets/catalogs/output_hashes.json` outside `port_assets` after a complete run, run the full command again with the same tools/source, then:

```text
node godot/tools/extract/verify_outputs.cjs path/to/first-run-hashes.json
```

The manifest excludes `.import` and its own hash file. PCM/audio, PNG pixels, metadata, source reference, and review outputs are covered. Godot's generated editor caches/resources are validated separately after import. Old generated files are never recursively deleted by these scripts.

### Canonical audio captures

Fresh Chromium convolution renders were observed to differ at the last floating-point bits (for example seam differences around 1e-9), which can change a handful of PCM quantization decisions and the resulting OGG bytes. They are not bit-reproducible from an empty cache. Do not claim otherwise.

Once captured, the original PCM/WAV and encoded OGG are canonical build inputs. Normal runs verify their complete hashes and the source/browser/sample-rate/encoder key before reusing them. A source/tool version change invalidates reuse. `--rerender-audio` explicitly creates a new baseline; archive the PCM folder and `audio.json` when reproducing the same byte-exact output on another machine. `--reuse-audio` is a development recovery option that validates and seals a previous original capture against the recorded source hashes. The repeatability test covers regeneration of images/metadata plus reuse of this verified canonical audio. Re-encoding unchanged PCM was separately verified byte-identical after Ogg serial normalization.

## Godot import and review

```text
Godot_v4.7.2-stable_win64_console.exe --headless --path godot --editor --import
Godot_v4.7.2-stable_win64_console.exe --headless --path godot --script port_tools/import_assets.gd
Godot_v4.7.2-stable_win64_console.exe --headless --path godot --script port_tools/verify_assets.gd
Godot_v4.7.2-stable_win64_console.exe --path godot
```

The small review scene is `port_tools/asset_review.tscn`. It can also be opened and run with F6 inside the existing deployed Godot project after installation. It previews source artwork on a fixed foot cross, supports individual frames and filtering, and plays the extracted stage-one OGG loop.

The importer creates one typed `animation_asset.gd` Resource with SpriteFrames per animation, preserving per-frame pivots, source scale, original source fields and durations. Unknown/state-dependent durations are explicitly marked; 100 ms is **preview only**. Exact state-dependent playback remains in source metadata/timelines for the approved gameplay port. The gallery's delta-based preview is presentation only and is not a gameplay clock.

## Interpretation of verification

Original texture copy comparisons are browser-decoded crops from original vs copied files. RLE checks compare independent Node decoding to the browser's presented buffers. Baked PNG checks decode atlas rectangles and hash them against source-rendered RGBA. Godot tests check saved/reloaded resources, frame/pivot/scale/duration preservation, and imported audio lengths. These are asset/import checks; they do not establish native combat equivalence.

Continuous effects, aimed chains, lane geometry, variable-width beams and backdrop time functions remain parameterized systems. Canonical baked recipes record their exact inputs and bounded time range; they are reference sprites, not a claim that an infinite parameter space can be replaced by one looping sheet. Future native implementations must match these source functions and the additional action/scene parameters.

Run the HTML comparison through a server at the browser repository root so its original and extracted relative paths both resolve. For example, open `/godot/port_assets/review/comparison.html` on the original game's local server if it serves that directory, or a plain static local server rooted at the repository. The standalone PNG remains viewable without a server.
