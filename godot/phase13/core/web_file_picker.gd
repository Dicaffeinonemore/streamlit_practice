class_name BmkWebFilePicker
extends RefCounted
## Phase 13 Web export: index.html #bossBgmFile. Opens the browser's file chooser and hands the bytes
## back, because a web page cannot browse the visitor's disk through a Godot FileDialog.
## The size limit is checked in the page before the file is read, as the source checks file.size.

## (file name, bytes) once a file has been read.
signal picked(name: String, bytes: PackedByteArray)
## "big" (over the limit) or "read" (the browser could not read it).
signal failed(reason: String, name: String)

const SCRIPT: String = """
window.bmkPickFile = function (accept, maxBytes, done) {
	const input = document.createElement('input');
	input.type = 'file';
	input.accept = accept;
	input.style.display = 'none';
	document.body.appendChild(input);
	const finish = (name, data, reason) => { input.remove(); done(name, data, reason); };
	input.addEventListener('cancel', () => finish('', '', 'cancel'));
	input.addEventListener('change', () => {
		const file = input.files && input.files[0];
		if (!file) { finish('', '', 'cancel'); return; }
		if (file.size > maxBytes) { finish(file.name, '', 'big'); return; }
		const reader = new FileReader();
		reader.onload = () => { const url = String(reader.result); finish(file.name, url.slice(url.indexOf(',') + 1), ''); };
		reader.onerror = () => finish(file.name, '', 'read');
		reader.readAsDataURL(file);
	});
	input.click();
};
"""

## Kept alive while the chooser is open; JavaScript calls it once.
var _callback: JavaScriptObject

func open(accept: String, max_bytes: int) -> void:
	JavaScriptBridge.eval(SCRIPT, true)
	_callback = JavaScriptBridge.create_callback(_on_done)
	var window: JavaScriptObject = JavaScriptBridge.get_interface("window")
	window.bmkPickFile(accept, max_bytes, _callback)

func _on_done(args: Array) -> void:
	var name: String = str(args[0]) if args.size() > 0 else ""
	var data: String = str(args[1]) if args.size() > 1 else ""
	var reason: String = str(args[2]) if args.size() > 2 else "read"
	if reason == "cancel": return
	if not reason.is_empty():
		failed.emit(reason, name)
		return
	var bytes: PackedByteArray = Marshalls.base64_to_raw(data)
	if bytes.is_empty():
		failed.emit("read", name)
		return
	picked.emit(name, bytes)
