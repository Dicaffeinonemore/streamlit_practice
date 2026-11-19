# Phase 10 — Touch controls and mobile layout

The browser's on-screen controls (`game-ui.js` touch controls, `index.html` `#touchControls`, `mobile-display.js`) are ported to the F5 game. The movement lever and action pad feed the same canonical action codes as the keyboard, so every character, stage and boss plays the same by touch. This phase also adds the pixel-UI pause button (`#playPause`), which the browser shows on desktop as well.

## Delivered

- **Lever:** an 8-direction lever with a 22% dead zone and a 0.41 diagonal ratio. The knob is limited to 55% of the radius, drawn with its shaft and arrows. Direction keys are pressed and released in the source order (A, D, W, S). Two quick flicks request a dash, through the same double-tap rule as the keyboard.
- **Pad:** the ten buttons at their source positions and sizes in `--u` units:
  - attack, jump, dash
  - magic, with its stock count
  - special, with a ready glow at full SP
  - the five skills, using Barel's skill drawings
- **Multi-touch:** each finger holds one control. A code is released only when no other finger still holds it.
- **Skill buttons:** cooldown shading rises from the bottom, using the source's Barel cooldown base, with the remaining seconds shown. Borders show ready, disabled and active states. Viesa's held snipe keeps the button enabled.
- **Viesa:** the magic button is removed, and the editor shows her control names.
- **Visibility:** the controls show only in play, and always while the layout editor is open. Leaving play (pause, stage banner, boss intro, menus) releases held controls, like `lostpointercapture`. Focus loss and pause clear fingers and keys (`clearInput()` → `UX.clearTouch()`). A finger's late release then changes nothing.
- **Geometry:**
  - `--u = clamp(40px, 12.5vmin, 64px) × size`, in CSS pixels.
  - The lever sits at `max(18px, safe-left/bottom)` and the pad at `max(14px, safe-right/bottom)`.
  - Device safe areas come from `DisplayServer`. The approved iPhone 12/13 mini profile applies its default layout and its 50/50/21 px insets in landscape.
  - Insets already covered by the letterbox margins are not added twice.
- **Layout editor:**
  - Open it from Settings → 모바일 키 배치 편집. Drag a control to move it (in `--u`); the control stays on screen.
  - The bar buttons are −/+ (size 0.5–2), 숨기기/보이기 (hidden controls show dashed at 20%), 원위치, 전체 원위치 and 완료. Esc also ends editing.
  - Touches in the editor never press actions.
- **Settings:** 모바일 조작 키 on/off (the default follows the presence of a touch screen), 모바일 키 투명도 (0–90%), 모바일 키 크기 (60–160%), 배치 편집 and 초기화. They persist in `bmk_settings` (`touch`, `touch_layout`), validated like `validLayout()`: out-of-range values and unknown controls are dropped.
- **HUD:** with touch controls on, the desktop skill bar and the keyboard help line are hidden (`body.touch #skillbar`). The pause button opens the pause menu.
- **Mobile window:** handheld orientation is set to sensor landscape.

## Verification

| Check | Result |
|---|---|
| Touch controls through the F5 game (`phase10/verify_touch.gd`) | 46 checks, 0 failures |
| Canonical inputs | A 160-frame touch script (lever with diagonals and direction changes, double-flick dash, attack, shared jump held by two fingers, skill, attack combo, dash) gives a frame-by-frame identical simulation trace to its keyboard equivalent |
| Covered cases | Visibility (title, play, pause, boss intro, editor); pause button; multi-touch; focus-loss cancellation and stale releases; release on hide; pass-through outside the controls; editor drag, resize, hide, select, keep-on-screen, Esc and done; persistence and validation; transparency/size steps and reset; iPhone mini profile geometry and device insets |
| Regressions | Phase 2 GUT; Phase 4 foundation, menu, practice, challenge, rendered, restart and startup checks; Phase 5–9 rendered integration |

Side-by-side captures at 960 × 540 (`phase10/fixtures/touch_scenes.json`): `evidence/phase10_source_*.png` (browser page with the DOM overlay) and `evidence/phase10_compare_*.png` (Godot) for Barel with an active lever, attack, cooldowns and a ready special; Viesa; a custom layout (moved, resized, hidden); and the layout editor.

Regenerate the browser captures with `node godot/tools/oracle/phase10_source_capture.cjs`.

## Known differences

- **Controls stay inside the game area.** They are drawn inside the 16:9 game area, because Godot's letterboxed canvas cannot draw outside it. On phones wider than 16:9 they overlap the game's edges rather than the side bars. The `--u` size, margins and insets otherwise follow the CSS.
- **Sliders are step buttons.** Transparency and size use 10% step buttons in the menu instead of sliders.
- **Fullscreen handling is not ported.** `mobile-fullscreen.js` (fullscreen toggle, page-scroll blocking, rotation hint) is not needed for a native app; the orientation is locked to landscape instead.
- **Disabled skill buttons still take presses.** A press on a skill button that is cooling down still reaches the game, exactly like the keyboard key.
- **Simplified styling.** Inset shadows are omitted, and the SVG icons are redrawn as vector polygons.
