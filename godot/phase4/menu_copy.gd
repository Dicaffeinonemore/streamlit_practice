class_name BmkCopy
extends RefCounted

const CATALOGS := {
	"en": preload("res://phase4/title_art/menu.en.translation"),
	"ko": preload("res://phase4/title_art/menu.ko.translation")
}

static var locale: String = "en"

static func set_language(language: String) -> void:
	locale = language if CATALOGS.has(language) else "en"
	TranslationServer.set_locale(locale)

static func text(key: String, language: String = "") -> String:
	var catalog: Translation = CATALOGS.get(language if not language.is_empty() else locale, CATALOGS["en"])
	return catalog.get_message(key)
