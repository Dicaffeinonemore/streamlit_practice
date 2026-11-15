class_name BmkAssetBank
extends RefCounted
var cache: Dictionary[String, BmkAnimationAsset] = {}
var catalogs: Dictionary = {}
var source_images: Dictionary[String, String] = {}
var image_cache: Dictionary[String, Texture2D] = {}

func _init() -> void:
	catalogs = JSON.parse_string(FileAccess.get_file_as_string("res://port_assets/catalogs/source_catalogs.json")) as Dictionary
	var manifest: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://port_assets/catalogs/asset_map.json")) as Dictionary
	for entry: Dictionary in manifest["entries"]: source_images[str(entry["source"])] = "res://" + str(entry["destination"])

func source_image(path: String) -> Texture2D:
	if not image_cache.has(path): image_cache[path] = load(source_images[path]) as Texture2D
	return image_cache[path]

func animation(id: String) -> BmkAnimationAsset:
	if not cache.has(id):
		cache[id] = load("res://port_assets/resources/%s.tres" % id) as BmkAnimationAsset
	return cache[id]
