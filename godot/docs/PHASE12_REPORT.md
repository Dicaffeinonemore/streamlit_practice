# Phase 12 — Tutorial demonstration and opening

The F5 game now follows the browser's start flow: character select → 조작 안내 (the tutorial with its live demonstration) → 게임 시작 → the opening → Stage 1. The tutorial also opens from the pause menu and from practice. The demonstration is `demo-runtime.js` ported onto the real simulation, and the opening is `release.js` `startOpening` / `drawOpening`.

## Delivered

- **Demonstration (`phase12/core/demo_controller.gd`).** It ports `demoStart`, `demoStep`, `demoPress`, `demoUpdate` and `demoStop`. Each step builds a new character and a training dummy (`mkEnemy('grunt')`, HP 99999, never falls) at camera + 22% / + the step's dummy distance. The step's script is then pressed key by key at its millisecond times (tap 90 ms, hold 300 ms unless given). Each tick runs the source order:
  - flash, shake and chain decay
  - hitstop, otherwise player → jump observer → enemies → hazards → effects
  - dummy heal
  - key-buffer ageing

  A step ends 700 ms after the player is idle again past the script's end + 250 ms, or after 10 s. Previous / next wrap around; ❚❚ / ▶ freezes the demo; a step chip jumps to that step and resumes.
- **Steps.** `phase12/core/demo_steps.gd` holds both characters' twelve steps: titles, keys, descriptions, scripts, dummy distances and the SP / scroll setups. It is generated from the source's `DEMO_STEPS` by the oracle, so it cannot drift by hand.
- **Isolation.** The source saves the global game state and restores it. Here the demonstration runs in its own session, and the live session is never stepped or modified. While the tutorial is open:
  - every view points at the demo session
  - the world and HUD render into a 960 × 540 `SubViewport`, shown in the tutorial like `#demoView`'s copy of the canvas

  Closing the tutorial puts back the live session, its clock and its in-flight impact effects. Every way of leaving does this: back, Esc, a menu change, practice, starting a game or a challenge. A new game started from the tutorial replaces the session, as `demoStop()` skips its restore when the player changed.
- **Backdrop and character** (`demoStart(from)`):
  - From pause: the paused run's character, and that run's stage and camera. Stage 1 keeps its section's street; Stages 2–5 keep their backdrop, and Vargul's / Sovereign's remains stay in view.
  - From character select: the selected character over the session left in place. At launch that is Stage 1's first section at camera 0, like the browser's fresh `STAGES[0]`.
  - The dummy uses the shared soldier code of the wave stages, as `mkEnemy('grunt')` does in every stage, with Stage 1's soldier art in Stage 1.
- **Tutorial screen (`phase12/presentation/tutorial_screen.gd`, `keyboard_view.gd`, `core/key_names.gd`).** `index.html #tutorial` at 960 × 540:
  - The heading carries the key preset name.
  - The demo view has its caption (n / 12, title, keycaps joined by + for two-key steps) and progress bar (`#demoBar` width formula).
  - The side shows the description, the keyboard picture and ◀ 이전 / ❚❚ 멈춤 / 다음 ▶.
  - Below: the step chips, the collapsible 아이템 · 전투 팁 and the key/ESC/M line.
  - The actions are 직접 연습 / 게임 시작 / 캐릭터 선택 or 돌아가기. Practice and start are hidden from pause; back is shown only from pause or character select.
  - Keycaps use the current bindings (`UX.keyName`). The keyboard picture colours keys by action kind, dims keys outside the step and lights the keys the script holds. Viesa's short names are used when she is shown.
  - The player's own keys only light the caps (`lightCaps`); they never reach the game.
- **Keys** (`onKeyOnce`):
  - Enter starts the game, except from pause; a focused button takes Enter first, as in the page. 게임 시작 has the focus when the tutorial opens.
  - The arrow keys (the arcade movement keys) light their caps but never move button focus, as in the page.
  - Esc goes back to pause, character select or the title.
  - M still toggles sound.
  - Losing focus does not open the pause menu over the tutorial.
- **Sound.** From character select the sound runs, so the demonstration's effects are heard, as at the browser title. From pause the sound stays suspended (`AUDIO.pause(true)`), so the demonstration is silent there too. The click plays on opening. The demo view hides the skill bar and key help, which are page elements in the source and not part of the copied canvas.
- **Opening (`phase12/presentation/opening_screen.gd`).** Six original panels, 3 s each, one tick at a time (`openingTime += MS`):
  - each panel fades in and out over a sixth of its time and covers the screen with nearest sampling
  - a 3.5% slow zoom when screen shake is on
  - the 104 px band and the line drawn as `krText` (bold, 4 px black stroke; 32 px for the title card)

  It ends at 18 s, or on Enter / Space / Esc or 건너뛰기 · Enter / Space. Starting it silences the music (`AUDIO.silence()`). It then starts the story with the selected character.
- **Practice guide buttons.** 실전 시작 (`btnPracticeGo`: the opening, then the story with the practised character) and 조작 안내 (`btnPracticeHelp`: pause, then the tutorial) are shown under the practice prompt while practising.
- **Pause menu.** It gains 조작 안내 (`btnPauseHelp`).
- **Fix found by the demonstration.** A red wave that hits after Barel's skill has ended now plays `barelWave`, as `damageEnemy(…, 'redwave', 'barelWave')` does. Before, it played `swordHit`. Earlier phase traces never had a late hit, so they are unaffected.

## Verification

| Check | Result |
|---|---|
| Demonstration against the original page (`phase12/tests/test_demo_parity.gd`, `tools/oracle/phase12_traces.cjs`) | 3 scenarios, 3,939 source ticks, 368,243 comparisons, 0 differences. The scenarios are every step of Barel and Viesa from character select, and Viesa over a paused Stage 3. Each tick compares the scripted presses, DEMO state, progress bar, highlighted keys, player, dummy, red waves, arrows, the ultimate and every sound request. |
| `DEMO_STEPS` | Both lists equal the source, field by field |
| Isolation in the source | The oracle records the paused run before and after the tutorial: identical. The native test checks the origin session is untouched. |
| Rendered integration (`phase12/verify_tutorial.gd`) | 67 checks, 0 failures. They cover: character select → tutorial; demo session and view; the Stage 1 launch backdrop; actions per origin; preset name; caption; chips; keyboard label; held-key lights; prev, next, pause and chip by mouse; player keys that only light caps; arrow keys that keep the focus; focus loss; Esc back with the session restored; the Viesa list and names; practice from the tutorial; the practice guide buttons; Enter → opening; no checkpoint or record written; opening silence, panel timing, skip and the 18 s end; pause origin in Stage 1 and Stage 3 (backdrop, camera, placement, silent sound, Enter ignored, run restored exactly, resume); leaving by another screen |
| Regressions | Phase 2–9 GUT source parity (Phase 2 street/clock 2,233 assertions; Phases 2, 3, 5, 6, 7, 8, 9 traces), 0 differences. Rendered checks: Phase 4 foundation, menu 15, practice 8, challenge 5, rendered 12, startup, restart write/read; Viesa 40; Stages 2–5 27/27/30/42; touch 48; audio 38. All 0 failures. Phase 4, 5 and 10 story starts now pass through the tutorial and opening (2 checks each added). The earlier phases' evidence captures re-render pixel-identical. `phase3/tools/verify_startup.gd` fails as before. |

Side-by-side captures at 960 × 540 with the same moments: `evidence/phase12_source_*.png` (browser, `tools/oracle/phase12_source_capture.cjs`) and `evidence/phase12_*.png` (Godot). They show Barel walking (step 1, tick 4), Barel's red wave (step 10, tick 40), Viesa over a paused Stage 3 and the opening's second panel at 4.5 s.

Regenerate:

```text
node godot/tools/oracle/phase12_traces.cjs
node godot/tools/oracle/phase12_steps.cjs
node godot/tools/oracle/phase12_source_capture.cjs
Godot_v4.7.2-stable_win64_console.exe --headless --path godot -s addons/gut/gut_cmdln.gd -gtest=res://phase12/tests/test_demo_parity.gd -gexit
Godot_v4.7.2-stable_win64_console.exe --path godot --script phase12/verify_tutorial.gd
```

## Known differences

- **Source patches 1.70 and 1.71 are not ported.** Their notes say they are web-only. 1.71 gives Viesa a dash attack and dash-attack-while-running, with Barel's post-dash grace. The native port keeps the 1.69 rule, so Viesa's `dashGrace` is the one field the demonstration test leaves out for her (14 ticks would differ, on her dash step). The 1.70 / 1.71 Viesa art changes are not in the native assets either.
- **Layout is a native adaptation.** The tutorial uses fixed 960 × 540 proportions taken from the page's 2fr / 1fr grid. It does not have the page's single-column layout for narrow windows. The keyboard picture's labels are at least 6–7 px; the page scales them with the container and they would be about 4 px here. Buttons use a flat version of the page's `.btn` colours.
- **The keyboard picture shows no alias keys** (the dashed WASD-preset extras), because the native input has had no alias keys since Phase 4.
- **Paused Stage 1 props.** The demo shows the paused section's backdrop, but its gate, wall and scaffold props are at their section-start state rather than their live state.
- **Demo tick.** The demo starts from the origin session's tick (0 at launch). The browser keeps counting title ticks; this only shifts idle-animation phases.
- **Title practice.** The native title keeps its 연습하기 button (a Phase 4 adaptation). Practice uses the last selected character.
- `phase3/tools/verify_startup.gd` still expects the Phase 3 main scene and fails as before.
