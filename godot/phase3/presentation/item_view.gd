class_name BmkItemView
extends Node2D
var item: BmkWorldItem
var sprite: Sprite2D

func _ready() -> void:
	sprite = Sprite2D.new()
	sprite.centered = false
	add_child(sprite)

func present(value: BmkWorldItem) -> void:
	item = value
	position = Vector2(item.x,item.y)
	var type: String = "box" if item.barrel else item.type
	if type == "power":
		sprite.visible = false
		queue_redraw()
		return
	sprite.visible = true
	sprite.texture = load("res://phase3/assets/items/%s.png" % type) as Texture2D
	var limit: Vector2 = Vector2(48,48) if item.barrel else (Vector2(38,32) if type == "big" else (Vector2(38,24) if type == "potion" else (Vector2(36,24) if type == "gold" else (Vector2(36,30) if type == "scroll" else Vector2(28,32)))))
	var scale_: float = minf(limit.x / sprite.texture.get_width(),limit.y / sprite.texture.get_height())
	var size_: Vector2 = sprite.texture.get_size() * scale_
	var bottom: float = 0 if item.barrel else -item.z - 2 + (sin(item.t * 0.1) * 3 if item.z == 0 else 0)
	sprite.position = Vector2(round(-size_.x / 2),round(bottom - size_.y))
	sprite.scale = Vector2.ONE * scale_
	sprite.modulate = Color(2,2,2) if item.flash > 0 else Color.WHITE
	visible = item.barrel or item.life >= 200 or (item.life / 6) % 2 == 0
	queue_redraw()

func _draw() -> void:
	if item == null: return
	draw_set_transform(Vector2.ZERO,0,Vector2(20 if item.barrel else 16,6 if item.barrel else 5))
	draw_circle(Vector2.ZERO,1,Color(0,0,0,0.35))
	draw_set_transform(Vector2.ZERO)
	if item.type == "power" and not item.barrel:
		draw_circle(Vector2(0,-item.z - 14),11,Color("d294ff"))
		draw_string(ThemeDB.fallback_font,Vector2(-5,-item.z - 8),"P",HORIZONTAL_ALIGNMENT_LEFT,-1,16,Color.WHITE)

