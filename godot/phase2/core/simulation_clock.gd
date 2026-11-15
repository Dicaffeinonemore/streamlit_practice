class_name BmkSimulationClock
extends RefCounted
## Separate unscaled real time, outer physics time, and executed source ticks.
const MS: float = 1000.0 / 60.0
var accumulator: float = 0.0
var slow_t: float = 0.0
var paused: bool = false
var session: BmkSimulation

func _init(simulation: BmkSimulation = null) -> void:
	session = simulation

func advance(real_ms: float) -> int:
	var real: float = minf(100.0, real_ms)
	if paused:
		return 0
	accumulator += real * (0.3 if slow_t > 0.0 else 1.0)
	if slow_t > 0.0:
		slow_t -= real
	var count: int = 0
	while accumulator >= MS:
		session.step()
		if session.slow_request > 0.0:
			slow_t = session.slow_request
			session.slow_request = 0.0
		accumulator -= MS
		count += 1
	return count
