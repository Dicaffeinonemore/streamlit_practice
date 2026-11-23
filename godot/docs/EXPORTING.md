# Exporting Black Moon Knight

How to build the four platform targets defined in `export_presets.cfg`. Outputs go to `godot/build/`, which git ignores. Commands run from the repository root. `Godot` stands for `Godot_v4.7.2-stable_win64_console.exe`.

## One-time setup

1. **Engine:** Godot 4.7.2 stable (`4.7.2.stable.official.ed1daf0bf`). Don't change the engine version without re-running the phase checks.
2. **Export templates 4.7.2.stable:** download `Godot_v4.7.2-stable_export_templates.tpz` from the Godot 4.7.2 GitHub release and check its SHA-512 against the release's `SHA512-SUMS.txt`:

   ```text
   ca4d71c4d7b81dfc15d1a98baa07534aa95b03fdda78a0075b06672e1648d2e5f40980c9adc28d23e1b92e732ee7bf3461997aa804af74ec2fcd7a93ccb84079
   ```

   Unzip it, then copy the contents of its `templates/` folder to `%APPDATA%/Godot/export_templates/4.7.2.stable/`. Editor → Manage Export Templates → Install from File does the same.
3. Import once after a fresh clone: `Godot --headless --path godot --import`.

## What every preset packs

- All imported resources, plus four JSON files the game reads at run time: `port_assets/catalogs/source_catalogs.json`, `asset_map.json`, `audio.json` and `phase11/fixtures/compressor_curve.json`. The tile manifest `port_assets/tiles/tiles.json` is packed too.
- Left out: tests, fixtures' JSON, verification and tool scripts, GUT (`addons/`), `evidence/`, `docs/`, `tools/`, `port_assets/review/`, raw PCM and the Phase 1 import/review tools.
- **Keep `port_tools/animation_asset.gd`.** It is the runtime class of every animation resource. Excluding all of `port_tools/` leaves the game unable to start ("Could not resolve class BmkStageGame").
- `phase13/export_probe.gd` goes into the Windows pack only. `phase13/web_probe.gd` and `phase13/fonts/` go into the Web pack only.

## Windows

```text
Godot --headless --path godot --export-release "Windows Desktop" build/windows/BlackMoonKnight.exe
```

Output: `BlackMoonKnight.exe` (109 MB) and `BlackMoonKnight.pck` (517 MB). The two files must stay in the same folder. Saves go to `%APPDATA%/Godot/app_userdata/Black Moon Knight/`, the same folder the editor's F5 run uses.

Check it (this moves your real saves aside and puts them back afterwards):

```text
node godot/phase13/tools/verify_windows.cjs
```

It runs the exported game twice with `-- --export-probe=write|read`. Export templates ignore `--script`, so `phase4/game.gd` attaches `phase13/export_probe.gd` when that argument is given and the probe is in the pack.

The exe has the default Godot icon and no version info. No original icon exists; see the Phase 13 report.

## Web

```text
Godot --headless --path godot --export-release "Web" build/web/index.html
```

Output: `index.html`, `index.js`, `index.wasm` (40 MB), `index.pck` (526 MB), audio worklets and icons. Serve the folder over HTTP; `file://` does not work.

- **Oversized images.** `port_assets/tiles/` holds lossless tiles of the three originals over 8192 px. Re-run `phase13/tools/split_oversized_textures.gd` and then `--import` after re-extracting the Phase 1 assets.
- The build has no thread support. A host doesn't need COOP/COEP headers.
- **Size.** `index.pck` is larger than GitHub's 100 MB per-file limit, so the Web build cannot be committed here or served from GitHub Pages. Check the chosen host's per-file and total limits. The browser keeps the whole pack in memory.
- **Fonts.** A web page gives Godot no system fonts. Noto Sans KR, Noto Sans Symbols 2 and Noto Emoji (SIL OFL 1.1, `phase13/fonts/`) are added as fallbacks of the default font on Web only.
- **Saves.** `user://` is IndexedDB `/userfs` for that origin in that browser. Clearing site data deletes them.
- **Boss music.** The file is chosen with the browser's file chooser, not a Godot file dialog.
- **No 종료 button.** A page cannot close its tab.

Check it in headless Chrome. The check opens the page with `?bmk_probe=1`. `phase13/web_probe.gd` (Web pack only) then reports visible buttons and game state to the page; without that parameter it is never attached.

```text
node godot/phase13/tools/verify_web.cjs
```

## Android (preset only; not built yet)

Needs JDK 17 and the Android SDK (command-line tools, `platform-tools`, a current `build-tools` and platform), neither of which is installed on the current PC.

1. Install them. Then set Editor Settings → Export → Android → Java SDK Path and Android SDK Path, or `export/android/java_sdk_path` and `export/android/android_sdk_path` in `editor_settings-4.7.tres`.
2. **Debug signing:** the editor uses the debug keystore from Editor Settings (`export/android/debug_keystore`). It can create one if it is missing.
3. **Release signing:** create a keystore and keep it out of the repository.

   ```text
   keytool -genkeypair -v -keystore bmk-release.keystore -alias bmk -keyalg RSA -keysize 2048 -validity 10000
   ```

   Pass it through the environment rather than the preset: `GODOT_ANDROID_KEYSTORE_RELEASE_PATH`, `GODOT_ANDROID_KEYSTORE_RELEASE_USER`, `GODOT_ANDROID_KEYSTORE_RELEASE_PASSWORD`.
4. Build:

   ```text
   Godot --headless --path godot --export-debug "Android" build/android/BlackMoonKnight.apk
   ```

Preset choices to review before release:
- the package name `com.blackmoonknight.game` (placeholder)
- version code 1 and an empty version name
- arm64-v8a only, immersive mode, landscape from `display/window/handheld/orientation`
- no INTERNET permission

The pack is about 517 MB, so a Play Store release needs Play Asset Delivery or a smaller pack.

Android's back button acts as Esc (pause, back a menu, end layout editing). On the title it leaves the app (`application/config/quit_on_go_back=false` plus `BmkMenuGame.go_back()`).

## iOS (preset only; cannot be built on Windows)

Needs macOS with Xcode. On the Mac:
1. Install the same templates.
2. Set `application/app_store_team_id` and check the bundle id `com.blackmoonknight.game` (placeholder).
3. Export. Godot writes an Xcode project; sign and archive it in Xcode.

The title has no 종료 button on iOS (apps must not quit themselves). Hangul uses the system fonts, as on Android.

## Device checklist (Android / iOS, still to do)

- [ ] The app starts in landscape; nothing is covered by the notch or rounded corners (Phase 10 safe area).
- [ ] Touch controls appear by default and hold several fingers at once; layout editing persists.
- [ ] The first tap starts the sound. M / settings mute, pause on app switch, resume.
- [ ] New game → quit the app → reopen → 이어하기 restores the same character and stage.
- [ ] Back button (Android): pause in play, back in menus, leaves from the title.
- [ ] Korean text and the tutorial's ❚❚ / emoji render with the system fonts.
- [ ] Stage 4 (Vargul melee effects read pixels with `Texture2D.get_image()`) and Stage 1 plaza draw correctly.
