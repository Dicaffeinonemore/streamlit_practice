class_name BmkViesaAction
extends RefCounted
## player.viesaAction in viesa-runtime.js.
var phase: String = ""
var id: String = ""
var held: int = 0
var shots: int = 0
var x0: float = 0.0
var face: int = 1
var high: bool = false
var h0: float = 0.0
var released: bool = false
## 모아 쏘기 charge level (0-3).
var charge: int = 0
var clock: int = 0
var arrows: int = 0
var final_fired: bool = false
var landed: bool = false
## dash_slash: each target takes dash damage once (ids; barrels are negative).
var dash_hits: Dictionary[int, bool] = {}
## ult: last tick each enemy took a phantom arrow.
var hit_times: Dictionary[int, int] = {}
