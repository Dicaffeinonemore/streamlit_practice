extends SceneTree
var review: Control

func _initialize() -> void:
	call_deferred("run")

func run() -> void:
	review = load("res://port_tools/asset_review.tscn").instantiate() as Control
	root.add_child(review)
	review.set_process(false)
	var list: ItemList = review.get("list") as ItemList
	if list.item_count != 833:
		push_error("Review list did not load the complete asset index")
		quit(1)
		return
	var selected: bool = false
	for i: int in range(list.item_count):
		if list.get_item_text(i) == "barel_rika.timeline.combo0":
			list.select(i)
			review.call("select_entry", i)
			review.set("frame_index", 4)
			review.call("show_frame")
			selected = true
			break
	if not selected:
		push_error("Rika combo preview is missing")
		quit(1)
		return
	await process_frame
	await process_frame
	await RenderingServer.frame_post_draw
	DirAccess.make_dir_recursive_absolute("res://evidence")
	var result: Error = root.get_texture().get_image().save_png("res://evidence/phase1_asset_review.png")
	print("CAPTURE: phase1_asset_review.png; status %d" % result)
	quit(0 if result == OK else 1)
