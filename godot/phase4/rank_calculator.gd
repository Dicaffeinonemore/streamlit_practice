class_name BmkRankCalculator
extends RefCounted

static func calculate(seconds: int, damage: float, deaths: int, max_chain: int) -> String:
	var points: float = maxf(0.0,60.0 - damage * 0.18 - deaths * 20.0) + clampf((300.0 - seconds) / 300.0,0.0,1.0) * 20.0 + mini(max_chain,20)
	if points >= 85.0 and deaths == 0: return "S"
	if points >= 65.0 and deaths == 0: return "A"
	return "B" if points >= 40.0 and deaths <= 1 else "C"
