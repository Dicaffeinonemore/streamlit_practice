class_name BmkTouchLayout
extends RefCounted
## game-ui.js touch layout: transparency, overall size, and per-control offsets (in --u units),
## size and hidden flag. mobile-display.js: the approved iPhone 12/13 mini profile (insets and
## default layout). Display geometry only; the combat world stays 960 x 540.
const TOUCH_IDS: Array[String] = ["stick","KeyJ","Space","ShiftLeft","KeyI","KeyK","KeyU","KeyH","KeyO","KeyP","KeyL"]
const MINI: Dictionary = {"width":812,"height":375,"insets":{"top":0,"right":50,"bottom":21,"left":50},
	"layout":{"alpha":0.55,"scale":1.0,"items":{
		"stick":{"dx":0.0,"dy":-0.004264327115892126,"k":1.0,"hide":false},
		"KeyJ":{"dx":0.0,"dy":0.0,"k":1.0,"hide":false},"Space":{"dx":0.0,"dy":0.0,"k":1.0,"hide":false},
		"ShiftLeft":{"dx":0.0,"dy":0.0,"k":1.0,"hide":false},"KeyI":{"dx":0.0,"dy":0.0,"k":1.0,"hide":false},
		"KeyK":{"dx":0.0,"dy":0.0,"k":1.0,"hide":false},"KeyU":{"dx":0.0,"dy":0.0,"k":1.0,"hide":false},
		"KeyH":{"dx":0.0,"dy":0.0,"k":1.0,"hide":false},"KeyO":{"dx":0.0,"dy":0.0,"k":1.0,"hide":false},
		"KeyP":{"dx":0.0,"dy":0.0,"k":1.0,"hide":false},"KeyL":{"dx":0.0,"dy":0.0,"k":1.0,"hide":false}}}}
## Test hook: forces (true/false) the mini-screen match; null uses the device.
static var force_mini: Variant = null

## MOBILE_DISPLAY.matches(): an iPhone whose logical screen is 375 x 812 points.
static func mini_matches() -> bool:
	if force_mini != null: return bool(force_mini)
	if OS.get_name() != "iOS": return false
	var size: Vector2 = Vector2(DisplayServer.screen_get_size()) / maxf(1.0,DisplayServer.screen_get_scale())
	var sides: Array[float] = [minf(size.x,size.y),maxf(size.x,size.y)]
	return absf(sides[0] - float(MINI["height"])) <= 1 and absf(sides[1] - float(MINI["width"])) <= 1

## layoutDefaults().
static func defaults() -> Dictionary:
	if mini_matches(): return (MINI["layout"] as Dictionary).duplicate(true)
	return {"alpha":0.55,"scale":1.0,"items":{}}

static func number(v: Variant, a: float, b: float) -> bool:
	return (v is int or v is float) and is_finite(float(v)) and float(v) >= a and float(v) <= b

## validLayout(l): keeps only valid values on top of the defaults.
static func validate(raw: Variant) -> Dictionary:
	var out: Dictionary = defaults()
	if raw is not Dictionary: return out
	var l: Dictionary = raw
	if number(l.get("alpha"),0.1,1): out["alpha"] = float(l["alpha"])
	if number(l.get("scale"),0.6,1.6): out["scale"] = float(l["scale"])
	var items: Variant = l.get("items")
	if items is Dictionary:
		for id: String in TOUCH_IDS:
			var it: Variant = (items as Dictionary).get(id)
			if it is Dictionary and number(it.get("dx"),-40,40) and number(it.get("dy"),-40,40) and number(it.get("k"),0.5,2):
				out["items"][id] = {"dx":float(it["dx"]),"dy":float(it["dy"]),"k":float(it["k"]),"hide":it.get("hide") == true}
	return out
