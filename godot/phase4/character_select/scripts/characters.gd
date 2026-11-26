class_name BmkSelectCharacters
extends RefCounted
## 캐릭터 데이터 — 이 파일만 고치면 선택창 내용이 바뀝니다.
## stats 는 1~5 정수. "difficulty_label" 을 넣지 않으면 난이도 값에서 자동으로 정해집니다.
## focus_* 는 카드가 접혔을 때·펼쳤을 때 이미지 초점 (0~1, CSS object-position 과 같은 의미).

const LIST := [
	{
		"id": "barel",
		"numeral": "I",
		"role": "SELECT_MELEE",
		"art": "res://phase4/character_select/img/barel.jpg",
		"focus_collapsed": Vector2(0.45, 0.0),
		"focus_expanded": Vector2(0.40, 0.10),
		"stats": {"power": 5, "agility": 2, "difficulty": 2},
	},
	{
		"id": "viesa",
		"numeral": "II",
		"role": "SELECT_RANGE",
		"art": "res://phase4/character_select/img/viesa.jpg",
		"focus_collapsed": Vector2(0.55, 0.0),
		"focus_expanded": Vector2(0.50, 0.08),
		"stats": {"power": 2, "agility": 5, "difficulty": 4},
	},
	{"id": "locked-3", "numeral": "III", "locked": true},
	{"id": "locked-4", "numeral": "IV", "locked": true},
]

const STAT_DEFS := [
	{"key": "power", "label": "SELECT_POWER"},
	{"key": "agility", "label": "SELECT_AGILITY"},
	{"key": "difficulty", "label": "SELECT_DIFFICULTY", "difficulty": true},
]


static func difficulty_label(c: Dictionary) -> String:
	if c.has("difficulty_label"):
		return c["difficulty_label"]
	var d: int = c["stats"]["difficulty"]
	if d <= 2:
		return BmkCopy.text("SELECT_EASY")
	elif d == 3:
		return BmkCopy.text("SELECT_NORMAL")
	return BmkCopy.text("SELECT_HARD")
