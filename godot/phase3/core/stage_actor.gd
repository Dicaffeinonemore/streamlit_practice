class_name BmkStageActor
extends BmkActorState
var boss: bool = false
var gr: float = 0.0
var gr_max: float = 150.0
var gr_t: int = 0
var next_kd: float = 0.0
var g2: BmkGorathState
var grab: BmkGrabState
var quiet_inv_until: int = 0
var kick_cd: int = 0
var grab_cd: int = 0
var dive_cd: int = 0
var angle: float = 0.0
var radius: float = 0.0
var dive: BmkDiveState
var bite: bool = false
var molotov: bool = false
var balcony: bool = false
var throws: int = 0
var lane_y: float = 430.0
var drop_to: float = 370.0
var tx: float = 0.0
var ty: float = 0.0
var throw_at: int = -99999
var armor_t: int = -999
var armor_hits: int = 0
var grab_used: bool = false

