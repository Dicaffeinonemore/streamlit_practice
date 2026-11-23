class_name BmkStageSimulation
extends BmkSimulation
var stage_data: BmkStageData
var sections: BmkFullStage
var gorath: BmkGorathController = BmkGorathController.new()
var grabs: BmkGrabController = BmkGrabController.new()
var item_controller: BmkItemController = BmkItemController.new()
var hazard_controller: BmkFireController = BmkFireController.new()
var items: Array[BmkWorldItem] = []
var barrels: Array[BmkWorldItem] = []
var fire_hazards: Array[BmkFireHazard] = []
var mode: String = "play"
var intro_ms: float = 0.0
var boss_phase_debug: int = 1
var boss_ult_debug: bool = false
var boss_red: float = 0
var boss_red_to: float = 0
var boss_dim: float = 0
var boss_dim_to: float = 0
var boss_white: int = 0
var boss_title: int = 0
var remains: Array[BmkStageActor] = []
var clear_t: int = 0
var progression_enabled: bool = true
var viesa: BmkViesaWorld = BmkViesaWorld.new()

func _init(config: BmkStageData = null) -> void:
	if config == null: return
	stage_data = config
	player = BmkStageActor.new()
	configure(config.combat)
	combat = BmkStageCombat.new()
	player_controller = BmkStagePlayer.new()
	enemy_controller = BmkStageEnemies.new()
	sections = BmkFullStage.new(self,config.source)
	stage_driver = Callable()

func spawn(species: String, x: float, y: float) -> BmkActorState:
	var e: BmkStageActor = BmkStageActor.new()
	e.id = next_id
	next_id += 1
	e.species = species
	e.d = data.stats(species)
	e.x = x
	e.y = y
	e.hw = e.d.half_width
	e.hp = e.d.hp
	e.max_hp = e.hp
	e.next_kd = js_round(e.hp * 1.2) * 0.75
	e.face = -1
	e.st = "chase"
	e.wait = random_between(0,40)
	e.attack_cd = random_between(20,60)
	e.boss = species == "boss1"
	if e.boss:
		e.g2 = BmkGorathState.new()
		e.hp = stage_data.g2("hp",0)
		e.max_hp = e.hp
		e.next_kd = e.max_hp * 0.75
	enemies.append(e)
	return e

func step() -> bool:
	if mode == "clear" or game_over or continue_pending: return false
	tick += 1
	if mode == "bossintro":
		gorath.intro(self)
		return false
	stat_ticks += 1
	if flash_t > 0: flash_t -= MS
	if hit_stop > 0:
		hit_stop -= 1
		return false
	if chain_t > 0:
		chain_t -= MS
		if chain_t <= 0: chain_n = 0
	if shake > 0: shake *= 0.85
	if sections.fading():
		input.age_processed_step()
		step_completed.emit()
		return true
	player_controller.step(self)
	observe_jump()
	if game_over or continue_pending: return true
	if progression_enabled: sections.step()
	for e: BmkActorState in enemies:
		if (e as BmkStageActor).boss: gorath.step(self,e as BmkStageActor)
		else: enemy_controller.step(self,e)
	enemies = enemies.filter(func(e: BmkActorState) -> bool: return not e.remove)
	update_hazards()
	hazard_controller.step(self)
	if clear_t == 0 and sections.idx == 4 and sections.event_index >= 1 and not sections.locked and enemies.is_empty():
		clear_t = 1
		music("victory")
	if clear_t > 0:
		clear_t += 1
		if clear_t > 200:
			mode = "clear"
			player.score += int(player.hp * 10)
	item_controller.step(self)
	viesa.update_effects()
	input.age_processed_step()
	step_completed.emit()
	return true

## game.js newPlayer(score, characterId): select the playable character's controller.
func use_character(id: String) -> void:
	player.character_id = id
	viesa.reset()
	if id == "viesa":
		player_controller = BmkViesaController.new()
		BmkViesaController.configure_player(player, BmkViesaData.shared())
	else:
		player_controller = BmkStagePlayer.new()

## updHazards(): Viesa's ultimate and arrows are updated before the other hazards.
func update_hazards() -> void:
	if player_controller is BmkViesaController: (player_controller as BmkViesaController).update_projectiles(self)
	super.update_hazards()
