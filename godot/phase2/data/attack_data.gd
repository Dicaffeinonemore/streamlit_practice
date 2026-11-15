class_name BmkAttackData
extends Resource
@export var id: String = ""
@export var label: String = ""
@export var key: String = ""
@export var wind_ms: float = 0.0
@export var active_ms: float = 0.0
@export var recovery_ms: float = 0.0
@export var duration_ms: float = 0.0
@export var damage: float = 0.0
@export var reach: float = 0.0
@export var behind: float = 0.0
@export var step: float = 0.0
@export var knockdown: bool = false
@export var hitstop: int = 0
@export var hitstun: int = -1
@export var effect: int = 0
@export var cooldown_ms: float = 0.0
@export var strikes: PackedFloat64Array = PackedFloat64Array()
@export var inv_from: float = 0.0
@export var inv_to: float = 0.0
@export var travel_from: float = 0.0
@export var travel_to: float = 0.0
@export var height: float = 0.0
@export var smash_ratio: float = 0.0
