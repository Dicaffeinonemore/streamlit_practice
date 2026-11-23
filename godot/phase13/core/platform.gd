class_name BmkPlatform
extends RefCounted
## Phase 13: the few behaviours that differ between export targets.
##
## Exit closes native desktop and Android builds. Web and iOS show a returnable end screen.
## Android's back button acts like Esc. Web uses a browser picker for custom boss music.

static func is_web() -> bool:
	return OS.has_feature("web")

static func is_mobile() -> bool:
	return OS.has_feature("android") or OS.has_feature("ios")

## Whether Exit can terminate the application.
static func can_quit() -> bool:
	return not is_web() and not OS.has_feature("ios")

## Whether the boss file is chosen through the browser instead of a FileDialog.
static func uses_browser_file_picker() -> bool:
	return is_web()

## Fonts packed into the Web export only (SIL OFL 1.1, licences beside them in phase13/fonts/):
## Noto Sans KR for Hangul, Noto Sans Symbols 2 for ❚ and other dingbats, Noto Emoji (monochrome)
## for the tutorial tips' emoji.
const WEB_FONTS: Array[String] = [
	"res://phase13/fonts/NotoSansKR.ttf",
	"res://phase13/fonts/NotoSansSymbols2.ttf",
	"res://phase13/fonts/NotoEmoji.ttf",
]

## A web page gives Godot no system fonts, so every SystemFont("Malgun Gothic", "Noto Sans CJK KR",
## "Arial") resolves to the built-in default font, which has no Hangul. On Web the bundled fonts are
## added to that default font's fallbacks before any screen is built. Other targets keep the system
## fonts the source page uses.
static func install_web_fonts() -> void:
	if not is_web(): return
	var base: Font = ThemeDB.fallback_font
	if base == null: return
	var list: Array[Font] = base.fallbacks.duplicate()
	for path: String in WEB_FONTS:
		var font: Font = load(path) as Font if ResourceLoader.exists(path) else null
		if font != null and not list.has(font): list.append(font)
	base.fallbacks = list

## Integer stretch never goes below 1x, so a window or browser canvas smaller than 960 x 540 crops the
## game (the source page always shrinks its canvas to fit). Below the base size the stretch becomes
## fractional, keeping the aspect; at or above it, integer stretch is unchanged.
static func fit_small_window(root: Window) -> void:
	var base: Vector2i = Vector2i(int(ProjectSettings.get_setting("display/window/size/viewport_width")),int(ProjectSettings.get_setting("display/window/size/viewport_height")))
	var small: bool = root.size.x < base.x or root.size.y < base.y
	root.content_scale_stretch = Window.CONTENT_SCALE_STRETCH_FRACTIONAL if small else Window.CONTENT_SCALE_STRETCH_INTEGER

static func watch_window(root: Window) -> void:
	fit_small_window(root)
	if root.has_meta(&"bmk_fit_small_window"): return
	root.set_meta(&"bmk_fit_small_window",true)
	root.size_changed.connect(func() -> void: fit_small_window(root))
