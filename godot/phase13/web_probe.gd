extends Node
## Phase 13 Web check helper. BmkMenuGame attaches it on Web only when the page URL contains
## bmk_probe=1 and this file is in the pack (Web preset only). It publishes, whenever they change:
##   window.bmkButtons = {label: [x, y, disabled]}  centres of visible buttons in 960 x 540 space
##   window.bmkState   = {menu, menuVisible, gameMode, character, stage, sound}
## so phase13/tools/verify_web.cjs can click real buttons whatever the Web font metrics are, and check
## the game state as strongly as the Windows probe does. It reads only; it never drives the game.
var game: BmkMenuGame
var last: String = ""

func _ready() -> void:
	game = get_parent() as BmkMenuGame

func _process(_delta: float) -> void:
	var buttons: Dictionary = {}
	for node: Node in get_tree().root.find_children("*","Button",true,false):
		var b: Button = node as Button
		if b.is_visible_in_tree() and not b.text.is_empty():
			var c: Vector2 = b.get_global_rect().get_center()
			buttons[b.text] = [roundi(c.x),roundi(c.y),b.disabled]
	var state: Dictionary = {
		"menu":game.menu.mode if game.menu != null else "",
		"menuVisible":game.menu != null and game.menu.visible,
		"gameMode":game.game_mode,
		"character":game.session.player.character_id if game.session != null else "",
		"stage":game.stage_index,
		"sound":game.audio != null and game.audio.enabled,
	}
	var json: String = JSON.stringify({"buttons":buttons,"state":state})
	if json == last: return
	last = json
	JavaScriptBridge.eval("(function(d){window.bmkButtons=d.buttons;window.bmkState=d.state;})(%s);" % json,true)
