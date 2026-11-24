class_name BmkDemoSteps
extends RefCounted
## demo-runtime.js DEMO_STEPS, generated from the source by tools/oracle/phase12_steps.cjs
## (phase12/fixtures/traces.json). script: [kind, action, start ms, press ms]; setup: {sp} or {mg}.
const MAX_MS: float = 10000.0
const STEPS: Dictionary = {
	"barel": [
		{"title":"DEMO_barel_01_TITLE","keys":["KeyA","KeyD","KeyW","KeyS"],"dummy":430,"desc":"DEMO_barel_01_DESC","script":[["hold","KeyD",0,700],["hold","KeyW",820,380],["hold","KeyS",1300,380],["hold","KeyA",1800,500]],"setup":null},
		{"title":"DEMO_barel_02_TITLE","keys":["Space"],"dummy":430,"desc":"DEMO_barel_02_DESC","script":[["tap","Space",200],["hold","KeyD",1350,750],["tap","Space",1420]],"setup":null},
		{"title":"DEMO_barel_03_TITLE","keys":["KeyJ"],"dummy":78,"desc":"DEMO_barel_03_DESC","script":[["tap","KeyJ",200],["tap","KeyJ",430],["tap","KeyJ",660]],"setup":null},
		{"title":"DEMO_barel_04_TITLE","keys":["ShiftLeft","KeyJ"],"dummy":360,"desc":"DEMO_barel_04_DESC","script":[["tap","ShiftLeft",200],["tap","ShiftLeft",1250],["tap","KeyJ",1360]],"setup":null},
		{"title":"DEMO_barel_05_TITLE","keys":["Space","KeyJ"],"dummy":85,"desc":"DEMO_barel_05_DESC","script":[["tap","Space",200],["tap","KeyJ",470]],"setup":null},
		{"title":"DEMO_barel_06_TITLE","keys":["KeyU"],"dummy":110,"desc":"DEMO_barel_06_DESC","script":[["tap","KeyU",250]],"setup":null},
		{"title":"DEMO_barel_07_TITLE","keys":["KeyH"],"dummy":90,"desc":"DEMO_barel_07_DESC","script":[["tap","KeyH",250]],"setup":null},
		{"title":"DEMO_barel_08_TITLE","keys":["KeyO"],"dummy":80,"desc":"DEMO_barel_08_DESC","script":[["tap","KeyO",250]],"setup":null},
		{"title":"DEMO_barel_09_TITLE","keys":["KeyP"],"dummy":170,"desc":"DEMO_barel_09_DESC","script":[["tap","KeyP",250]],"setup":null},
		{"title":"DEMO_barel_10_TITLE","keys":["KeyL"],"dummy":300,"desc":"DEMO_barel_10_DESC","script":[["tap","KeyL",250]],"setup":null},
		{"title":"DEMO_barel_11_TITLE","keys":["KeyK"],"dummy":160,"desc":"DEMO_barel_11_DESC","script":[["tap","KeyK",350]],"setup":{"sp":100}},
		{"title":"DEMO_barel_12_TITLE","keys":["KeyI"],"dummy":260,"desc":"DEMO_barel_12_DESC","script":[["tap","KeyI",350]],"setup":{"mg":1}},
	],
	"viesa": [
		{"title":"DEMO_viesa_01_TITLE","keys":["KeyA","KeyD","KeyW","KeyS"],"dummy":430,"desc":"DEMO_viesa_01_DESC","script":[["hold","KeyD",0,700],["hold","KeyW",820,380],["hold","KeyS",1300,380],["hold","KeyA",1800,500]],"setup":null},
		{"title":"DEMO_viesa_02_TITLE","keys":["Space"],"dummy":430,"desc":"DEMO_viesa_02_DESC","script":[["tap","Space",200],["hold","KeyD",1350,750],["tap","Space",1420]],"setup":null},
		{"title":"DEMO_viesa_03_TITLE","keys":["KeyJ"],"dummy":320,"desc":"DEMO_viesa_03_DESC","script":[["tap","KeyJ",200],["tap","KeyJ",560],["tap","KeyJ",920]],"setup":null},
		{"title":"DEMO_viesa_04_TITLE","keys":["ShiftLeft"],"dummy":400,"desc":"DEMO_viesa_04_DESC","script":[["tap","ShiftLeft",200],["tap","ShiftLeft",1200]],"setup":null},
		{"title":"DEMO_viesa_05_TITLE","keys":["Space","KeyJ"],"dummy":300,"desc":"DEMO_viesa_05_DESC","script":[["tap","Space",200],["tap","KeyJ",470],["tap","KeyJ",820]],"setup":null},
		{"title":"DEMO_viesa_06_TITLE","keys":["KeyH"],"dummy":80,"desc":"DEMO_viesa_06_DESC","script":[["tap","KeyH",250],["tap","KeyH",520],["tap","KeyH",790]],"setup":null},
		{"title":"DEMO_viesa_07_TITLE","keys":["KeyU"],"dummy":320,"desc":"DEMO_viesa_07_DESC","script":[["tap","KeyU",250]],"setup":null},
		{"title":"DEMO_viesa_08_TITLE","keys":["KeyO"],"dummy":200,"desc":"DEMO_viesa_08_DESC","script":[["tap","KeyO",250]],"setup":null},
		{"title":"DEMO_viesa_09_TITLE","keys":["KeyP","KeyJ"],"dummy":200,"desc":"DEMO_viesa_09_DESC","script":[["tap","KeyP",250],["tap","KeyJ",1100],["tap","KeyJ",1400]],"setup":null},
		{"title":"DEMO_viesa_10_TITLE","keys":["KeyL"],"dummy":420,"desc":"DEMO_viesa_10_DESC","script":[["hold","KeyL",250,1700]],"setup":null},
		{"title":"DEMO_viesa_11_TITLE","keys":["KeyK"],"dummy":260,"desc":"DEMO_viesa_11_DESC","script":[["tap","KeyK",350]],"setup":{"sp":100}},
		{"title":"DEMO_viesa_12_TITLE","keys":["KeyI"],"dummy":260,"desc":"DEMO_viesa_12_DESC","script":[["tap","KeyI",350]],"setup":{"mg":1}},
	],
}
