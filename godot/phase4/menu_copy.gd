extends RefCounted

const CATALOGS := {
	"en": preload("res://phase4/title_art/menu.en.translation"),
	"ko": preload("res://phase4/title_art/menu.ko.translation")
}

# The current web pause and binding screens use Korean; the title has its own language setting.
static func text(key: String, language: String = "ko") -> String:
	var catalog: Translation = CATALOGS.get(language, CATALOGS["ko"])
	return catalog.get_message(key)
