# Phase 13 — Platform exports

The project now has export presets for Windows, Web, Android and iOS, and step-by-step build instructions in [`EXPORTING.md`](EXPORTING.md).

- **Windows and Web:** built from the presets and checked as real exports. Each build was driven through new game → Stage 1 → restart → 이어하기.
- **Android and iOS:** have presets and instructions only. This PC has no JDK or Android SDK, and iOS needs a Mac. Installing the Android toolchain was deferred by the user.

Testing the real exports found five problems that F5 runs could never show. All five are fixed (see Delivered).

## Delivered

- **Export templates 4.7.2.stable.** Downloaded from the Godot release. The SHA-512 matches the release's `SHA512-SUMS.txt`. Installed in `%APPDATA%/Godot/export_templates/4.7.2.stable/`.
- **`export_presets.cfg`** with four presets:
  - Every preset uses all resources plus the four runtime JSON files and the tile manifest.
  - Tests, fixtures, verification and tool scripts, GUT, evidence, docs and raw PCM are left out.
  - Windows: x86_64, separate `.pck`, console wrapper for debug builds only.
  - Web: no threads (so no COOP/COEP headers are needed), desktop VRAM formats, adaptive canvas.
  - Android: arm64-v8a, immersive, no INTERNET permission, placeholder package `com.blackmoonknight.game`.
  - iOS: arm64, placeholder bundle id, team id empty.
- **Platform behaviour (`phase13/core/platform.gd`, `BmkPlatform`):**
  - **종료** is hidden on Web (a page cannot close its tab; the engine would stop and leave a blank canvas) and on iOS (apps must not quit themselves). Windows and Android keep it.
  - **Android back button:** `application/config/quit_on_go_back=false`. `BmkMenuGame.go_back()` sends Esc (pause, back a menu, end touch-layout editing). On the title it leaves through `request_close()`.
  - **Windows smaller than 960 × 540:** below the base size the stretch switches from integer to fractional, keeping the aspect. At or above the base size nothing changes. Before, a small browser window or desktop window cropped the game, while the source page always shrinks its canvas to fit.
- **Boss music on Web (`phase13/core/web_file_picker.gd`).** A web page cannot browse the disk with a Godot `FileDialog`, so on Web 보스전 음악 opens the browser's own `<input type=file>`, as `#bossBgmFile` does. The page checks the 30 MB limit before reading, as the source checks `file.size`. `BmkGameAudio.set_boss_bytes()` is the shared path after reading; `set_boss_file(path)` now calls it. Messages and storage are unchanged.
- **Fonts on Web.** A web page gives Godot no system fonts, so every `SystemFont("Malgun Gothic", …)` fell back to the default font and all Hangul drew as boxes. The Web pack carries Noto Sans KR, Noto Sans Symbols 2 (for ❚) and Noto Emoji. All three are SIL OFL 1.1; the licences are in `phase13/fonts/`. They are added to the default font's fallbacks at start-up on Web only. Other targets keep the system fonts.
- **Images over 8192 px (`phase13/core/tiled_texture.gd`, `phase13/tools/split_oversized_textures.gd`).** WebGL without a GPU (SwiftShader) and many phone GPUs cannot hold a texture with a side over 8192 px; Godot then draws it black. In the Web build the tutorial's training dummy was a black rectangle. Three original images exceed the limit:

  | Image | Size | Cut at |
  |---|---|---|
  | `named_art.atlas` | 2048 × 9840 | y 8004 |
  | `stage1_bg.market.anims.19` | 9288 × 92 | x 7998 |
  | `stage1_bg.plaza.anims.3` | 15408 × 178 | x 8132 |

  The tool cuts each into two lossless PNG tiles in `port_assets/tiles/`, only at a line no frame crosses, and rebuilds the image from the tiles to confirm it is identical. `BmkAssetBank` points those frames' atlases at a `BmkTiledTexture`. That texture keeps the original size and coordinates and draws each requested rectangle from the tile that holds it. Every AtlasTexture region, catalog rect and Phase 1 resource stays as extracted. This runs on every platform, so the desktop checks exercise the same path.
- **Runtime class kept in the pack.** Excluding `port_tools/` removed `port_tools/animation_asset.gd`, the class of every animation resource. The exported game then stopped at start-up: "Could not resolve class BmkStageGame". Only the Phase 1 import and review tools are excluded now.
- **Exported-build probes.** Export templates ignore `--script`, so `BmkMenuGame._ready()` attaches them. Each is loaded by path, so other exports never reference it.
  - `phase13/export_probe.gd`: Windows pack only. Attached with `-- --export-probe=write|read`; drives the game and writes a JSON report.
  - `phase13/web_probe.gd`: Web pack only. Attached when the URL has `bmk_probe=1`. It only reports buttons and state to the page and never drives the game.
- **Phase 12 test fix (`phase12/verify_tutorial.gd`).** "The opening ends at 18 s" failed at HEAD too, before any Phase 13 change. `openingTime += MS` reaches 17999.99999999988 after 1080 ticks in both JavaScript and GDScript, so the source and the port finish on tick 1081. The check had passed only while the opening's own `_physics_process` added real-time ticks during the test's waits. The test now steps the opening by hand from 0 and expects tick 1081. Game behaviour is unchanged.

## Verification

| Check | Result |
|---|---|
| Windows release export (`phase13/tools/verify_windows.cjs`) | Two processes on the release exe, through the game's own quit path, real `user://` (saves moved aside and restored). **Write 23 checks, read 13 checks, 0 failures.** Covered: exported template, 960 × 540, nearest sampling, WASAPI, 60 ticks/s, 종료 present; settings and back; 새 게임 → 비에사로 시작 → Enter → Esc → Stage 1 with Viesa; stage-entry checkpoint on disk; M → sound off on disk. After the restart: 이어하기 offered, sound still off, Continue restores Viesa in Stage 1, M, Esc pauses, leave by 종료 (exit 0). |
| Web release export in headless Chrome (`phase13/tools/verify_web.cjs`) | `?bmk_probe=1` makes `phase13/web_probe.gd` (Web pack only) publish visible button centres and game state to the page, so buttons are clicked by label with real browser input whatever the Web font metrics. **32 checks, 0 failures**, first load 3.8 s from localhost. Covered: no 종료, 이어하기 disabled at first; settings; the browser file chooser takes an mp3 (decoded, stored in IndexedDB, row renamed), refuses a 31 MB file keeping the previous choice, and 기본값으로 removes it; 새 게임 → 비에사로 시작 → Enter → Esc → Stage 1 with Viesa; audio context `suspended` before and `running` after the first gesture (`--autoplay-policy=user-gesture-required`); checkpoint and sound-off in IndexedDB; reload → 이어하기 offered, sound still off, Continue restores Viesa; M; Esc pauses. Phone 844 × 390 at DPR 3: canvas at device pixels (2× integer stretch), touch controls on by default, taps through character select, 게임 시작 and 건너뛰기 to Stage 1. Small window 800 × 450: the whole title fits, 새 게임 works. No script errors in the console. |
| Regressions | Phase 2–12 GUT source parity (Phase 2 street/clock 2,237 assertions; Phases 3, 5–9 traces; Phase 12 demo), Phase 1 asset round-trip 136,104 checks, and the rendered checks: Phase 4 foundation, menu 15, practice 8, challenge 5, rendered 12, restart write/read; Viesa 40; Stages 2–5 27/27/30/42; touch 48; audio 38; tutorial 67. All 0 failures. The 27 earlier evidence captures they re-render are pixel-identical (only PNG bytes differ, so they were left as committed), including the soldier comparisons drawn through the tiled named atlas. |

Evidence: `evidence/phase13/windows/` (probe reports and captures from the exported exe) and `evidence/phase13/web/` (`web_checks.json` and captures: desktop 1280 × 720, phone 844 × 390 at DPR 3, small window 800 × 450).

Regenerate:

```text
Godot --headless --path godot --script res://phase13/tools/split_oversized_textures.gd
Godot --headless --path godot --import
Godot --headless --path godot --export-release "Windows Desktop" build/windows/BlackMoonKnight.exe
Godot --headless --path godot --export-release "Web" build/web/index.html
node godot/phase13/tools/verify_windows.cjs
node godot/phase13/tools/verify_web.cjs
```

## Target differences

| | Windows | Web | Android (preset) | iOS (preset) |
|---|---|---|---|---|
| Build | exe 109 MB + pck 517 MB | wasm 40 MB + pck 526 MB | arm64 APK, pack ≈ 517 MB | Xcode project on macOS |
| Saves | `%APPDATA%/Godot/app_userdata/Black Moon Knight` (shared with F5) | IndexedDB `/userfs`, per origin and browser | app data | app data |
| Hangul | system (Malgun Gothic) | bundled Noto Sans KR | system | system |
| 종료 | yes | no | yes (and back button on the title) | no |
| Boss file | native file dialog | browser file chooser | native file dialog | native file dialog |
| Audio start | immediate | after the first click / key / tap (browser policy) | immediate | immediate |
| Threads | yes | no | yes | yes |

## Known differences and open decisions

- **Pack size.** Lossless import turns the originals' lossy WebP into lossless WebP, three times larger (`vargul_art.sheets.0`: 4.5 MB → 13.7 MB). Higher lossless effort saves only 1–2% (measured), and lossy re-encoding would change original pixels, so neither was applied. Consequences:
  - The Web `index.pck` cannot be committed or served from GitHub Pages (100 MB per-file limit), so the current GitHub → Streamlit deployment cannot carry it.
  - A Play Store release would need Play Asset Delivery.

  Choosing a host or accepting lossy compression is a decision for the owner.
- **Web text.** Web uses Noto Sans KR at regular weight; Windows uses Malgun Gothic. Bold labels (`krText`) render regular on Web, and the tutorial tips' emoji are monochrome. Headings meant for Batang / Nanum Myeongjo fall back to Noto Sans KR, as on desktop systems without those fonts.
- **App icon and version.** The source page has no icon (`<link rel="icon" href="data:,">`), so the exe, Web page and mobile presets use Godot's default icon. Version fields are empty. Both need the owner's choice; no icon was invented.
- **OS-level keyboard input** was not driven on Windows. The probe sends key events through the viewport, the same path the OS events take after the platform layer. Web keys and clicks were real browser input events (DevTools `Input.dispatch*`).
- **Device checks (Android/iOS)** are listed in `EXPORTING.md` and are still to do: safe area, multi-touch, back button, restart/continue, audio on app switch, and Stage 4's `Texture2D.get_image()` readback.
- **The original oversized images stay in the pack** because the extracted resources still reference them. They are no longer drawn.
