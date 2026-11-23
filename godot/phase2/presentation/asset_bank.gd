class_name BmkAssetBank
extends RefCounted
const TILES: String = "res://port_assets/tiles/tiles.json"
var cache: Dictionary[String, BmkAnimationAsset] = {}
var catalogs: Dictionary = {}
var source_images: Dictionary[String, String] = {}
var image_cache: Dictionary[String, Texture2D] = {}
## Phase 13: images over the GPU size limit, drawn from tiles (BmkTiledTexture), by texture path.
var tiled: Dictionary[String, Texture2D] = {}
var tile_manifest: Dictionary = {}

func _init() -> void:
	catalogs = JSON.parse_string(FileAccess.get_file_as_string("res://port_assets/catalogs/source_catalogs.json")) as Dictionary
	var manifest: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://port_assets/catalogs/asset_map.json")) as Dictionary
	for entry: Dictionary in manifest["entries"]: source_images[str(entry["source"])] = "res://" + str(entry["destination"])
	if FileAccess.file_exists(TILES):
		tile_manifest = (JSON.parse_string(FileAccess.get_file_as_string(TILES)) as Dictionary).get("textures",{})

## The texture to draw for an image path: the tiled stand-in when the image is over the limit.
func drawable(texture: Texture2D) -> Texture2D:
	if texture == null or texture is BmkTiledTexture or not tile_manifest.has(texture.resource_path): return texture
	if not tiled.has(texture.resource_path): tiled[texture.resource_path] = BmkTiledTexture.from_manifest(tile_manifest[texture.resource_path])
	return tiled[texture.resource_path]

func source_image(path: String) -> Texture2D:
	if not image_cache.has(path): image_cache[path] = drawable(load(source_images[path]) as Texture2D)
	return image_cache[path]

func animation(id: String) -> BmkAnimationAsset:
	if not cache.has(id):
		cache[id] = load("res://port_assets/resources/%s.tres" % id) as BmkAnimationAsset
		retarget(cache[id])
	return cache[id]

## Points every frame whose atlas is over the limit at that atlas's tiled stand-in. Regions are kept,
## so the frame draws the same pixels; the shared resource is updated once for every user.
func retarget(asset: BmkAnimationAsset) -> void:
	if asset == null or asset.sprite_frames == null or tile_manifest.is_empty(): return
	for anim: StringName in asset.sprite_frames.get_animation_names():
		for i: int in range(asset.sprite_frames.get_frame_count(anim)):
			var frame: AtlasTexture = asset.sprite_frames.get_frame_texture(anim,i) as AtlasTexture
			if frame != null: frame.atlas = drawable(frame.atlas)
