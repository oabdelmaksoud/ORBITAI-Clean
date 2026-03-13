/**
 * Godot Enemy AI Template (GDScript)
 * Complete enemy controller with patrol, chase, and attack behaviors
 */

import type { MechanicsTemplate } from '../../../types/gameMechanics.types.js';

export const GODOT_ENEMY_AI_CODE = `extends KinematicBody2D

# Patrol Settings
export var {{PATROL_SPEED}} := 100.0
export var {{WAYPOINT_WAIT_TIME}} := 1.0
export(Array, NodePath) var {{WAYPOINT_PATHS}} := []

# Chase Settings
export var {{CHASE_SPEED}} := 200.0
export var {{DETECTION_RANGE}} := 300.0
export var {{CHASE_RANGE}} := 500.0

# Attack Settings
export var {{ATTACK_RANGE}} := 50.0
export var {{ATTACK_DAMAGE}} := 10.0
export var {{ATTACK_COOLDOWN}} := 1.5

# Vision Settings
export var {{VISION_ANGLE}} := 60.0

# State
enum EnemyState { PATROL, CHASE, ATTACK }
var current_state := EnemyState.PATROL

# Components
onready var sprite := $Sprite
onready var animation_player := $AnimationPlayer if has_node("AnimationPlayer") else null

# Patrol
var waypoints := []
var current_waypoint_index := 0
var waypoint_wait_timer := 0.0

# Target
var player: Node2D = null
var last_attack_time := 0.0
var velocity := Vector2.ZERO

func _ready():
	# Load waypoints from paths
	for path in {{WAYPOINT_PATHS}}:
		var waypoint = get_node(path)
		if waypoint:
			waypoints.append(waypoint)
	
	if waypoints.empty():
		push_warning("Enemy AI: No waypoints assigned!")
	
	# Find player
	player = get_tree().get_nodes_in_group("player")[0] if not get_tree().get_nodes_in_group("player").empty() else null

func _physics_process(delta):
	if not player:
		return
	
	# State machine
	match current_state:
		EnemyState.PATROL:
			_patrol_behavior(delta)
			_check_for_player()
		
		EnemyState.CHASE:
			_chase_behavior(delta)
			_check_attack_range()
			_check_lose_player()
		
		EnemyState.ATTACK:
			_attack_behavior(delta)
	
	# Apply movement
	velocity = move_and_slide(velocity)
	
	# Update animation
	_update_animation()

func _patrol_behavior(delta):
	if waypoints.empty():
		velocity = Vector2.ZERO
		return
	
	var target_waypoint = waypoints[current_waypoint_index]
	var direction = (target_waypoint.global_position - global_position).normalized()
	
	# Move toward waypoint
	velocity = direction * {{PATROL_SPEED}}
	
	# Flip sprite
	if direction.x != 0:
		sprite.flip_h = direction.x < 0
	
	# Check if reached waypoint
	if global_position.distance_to(target_waypoint.global_position) < 10:
		waypoint_wait_timer += delta
		velocity = Vector2.ZERO
		
		if waypoint_wait_timer >= {{WAYPOINT_WAIT_TIME}}:
			current_waypoint_index = (current_waypoint_index + 1) % waypoints.size()
			waypoint_wait_timer = 0.0

func _chase_behavior(_delta):
	var direction = (player.global_position - global_position).normalized()
	velocity = direction * {{CHASE_SPEED}}
	
	# Flip sprite
	if direction.x != 0:
		sprite.flip_h = direction.x < 0

func _attack_behavior(delta):
	# Stop moving
	velocity = Vector2.ZERO
	
	# Face player
	sprite.flip_h = player.global_position.x < global_position.x
	
	# Attack cooldown
	var current_time = OS.get_ticks_msec() / 1000.0
	if current_time >= last_attack_time + {{ATTACK_COOLDOWN}}:
		_perform_attack()
		last_attack_time = current_time
	
	# Return to chase if player moves away
	var distance = global_position.distance_to(player.global_position)
	if distance > {{ATTACK_RANGE}} * 1.2:
		current_state = EnemyState.CHASE

func _check_for_player():
	var distance = global_position.distance_to(player.global_position)
	
	if distance <= {{DETECTION_RANGE}}:
		# Check if player is in vision cone
		var forward = Vector2.RIGHT if not sprite.flip_h else Vector2.LEFT
		var direction_to_player = (player.global_position - global_position).normalized()
		var angle = rad2deg(forward.angle_to(direction_to_player))
		
		if abs(angle) <= {{VISION_ANGLE}} / 2:
			# Raycast to check line of sight
			var space_state = get_world_2d().direct_space_state
			var result = space_state.intersect_ray(global_position, player.global_position, [self])
			
			if not result or result.collider.is_in_group("player"):
				current_state = EnemyState.CHASE

func _check_attack_range():
	var distance = global_position.distance_to(player.global_position)
	
	if distance <= {{ATTACK_RANGE}}:
		current_state = EnemyState.ATTACK

func _check_lose_player():
	var distance = global_position.distance_to(player.global_position)
	
	if distance > {{CHASE_RANGE}}:
		current_state = EnemyState.PATROL
		_find_nearest_waypoint()

func _find_nearest_waypoint():
	if waypoints.empty():
		return
	
	var min_distance = INF
	var nearest_index = 0
	
	for i in range(waypoints.size()):
		var distance = global_position.distance_to(waypoints[i].global_position)
		if distance < min_distance:
			min_distance = distance
			nearest_index = i
	
	current_waypoint_index = nearest_index

func _perform_attack():
	# Trigger attack animation
	if animation_player:
		animation_player.play("attack")
	
	# Deal damage to player if in range
	if global_position.distance_to(player.global_position) <= {{ATTACK_RANGE}}:
		if player.has_method("take_damage"):
			player.take_damage({{ATTACK_DAMAGE}})

func _update_animation():
	if not animation_player:
		return
	
	# Set animation based on state
	if current_state == EnemyState.CHASE:
		if animation_player.has_animation("run"):
			animation_player.play("run")
	elif current_state == EnemyState.PATROL:
		if animation_player.has_animation("walk"):
			animation_player.play("walk")
	elif velocity.length() < 1:
		if animation_player.has_animation("idle"):
			animation_player.play("idle")

func _draw():
	# Debug visualization
	if Engine.editor_hint or OS.is_debug_build():
		# Detection range
		draw_circle_arc_poly(Vector2.ZERO, {{DETECTION_RANGE}}, 0, 360, Color.yellow)
		
		# Chase range  
		draw_circle_arc_poly(Vector2.ZERO, {{CHASE_RANGE}}, 0, 360, Color.orange)
		
		# Attack range
		draw_circle_arc_poly(Vector2.ZERO, {{ATTACK_RANGE}}, 0, 360, Color.red)
		
		# Vision cone
		var forward = Vector2.RIGHT if not sprite.flip_h else Vector2.LEFT
		var left_angle = -{{VISION_ANGLE}} / 2
		var right_angle = {{VISION_ANGLE}} / 2
		
		draw_line(Vector2.ZERO, forward.rotated(deg2rad(left_angle)) * {{DETECTION_RANGE}}, Color.blue, 2)
		draw_line(Vector2.ZERO, forward.rotated(deg2rad(right_angle)) * {{DETECTION_RANGE}}, Color.blue, 2)

func draw_circle_arc_poly(center, radius, angle_from, angle_to, color):
	var nb_points = 32
	var points_arc = PoolVector2Array()
	points_arc.push_back(center)
	var colors = PoolColorArray([color])

	for i in range(nb_points + 1):
		var angle_point = deg2rad(angle_from + i * (angle_to - angle_from) / nb_points - 90)
		points_arc.push_back(center + Vector2(cos(angle_point), sin(angle_point)) * radius)
	
	draw_colored_polygon(points_arc, color * Color(1, 1, 1, 0.2))
`;

export const GODOT_ENEMY_AI_CONFIG: MechanicsTemplate = {
	id: 'godot-enemy-ai',
	name: 'Godot Enemy AI System',
	engine: 'godot',
	category: 'ai',
	language: 'gdscript',
	code: GODOT_ENEMY_AI_CODE,
	variables: [
		{ name: 'PATROL_SPEED', type: 'number', default: 100, description: 'Enemy patrol movement speed' },
		{ name: 'WAYPOINT_WAIT_TIME', type: 'number', default: 1, description: 'Time to wait at each waypoint' },
		{ name: 'WAYPOINT_PATHS', type: 'string', default: 'waypoint_paths', description: 'Array of NodePaths to waypoints' },
		{ name: 'CHASE_SPEED', type: 'number', default: 200, description: 'Enemy chase movement speed' },
		{ name: 'DETECTION_RANGE', type: 'number', default: 300, description: 'Range to detect player (pixels)' },
		{ name: 'CHASE_RANGE', type: 'number', default: 500, description: 'How far to chase before giving up' },
		{ name: 'ATTACK_RANGE', type: 'number', default: 50, description: 'Range to attack player' },
		{ name: 'ATTACK_DAMAGE', type: 'number', default: 10, description: 'Damage dealt per attack' },
		{ name: 'ATTACK_COOLDOWN', type: 'number', default: 1.5, description: 'Time between attacks (seconds)' },
		{ name: 'VISION_ANGLE', type: 'number', default: 60, description: 'Field of view angle in degrees' }
	],
	dependencies: [
		'KinematicBody2D node',
		'Sprite child node',
		'AnimationPlayer (optional)',
		'Player node in "player" group'
	],
	instructions: `# Godot Enemy AI Setup

## 1. Create Enemy Scene
- Create new scene with KinematicBody2D as root
- Add child nodes:
  - Sprite (for visual)
  - CollisionShape2D
  - AnimationPlayer (optional)

## 2. Attach Script
- Attach this enemy_ai.gd script to the root KinematicBody2D
- Configure exports in Inspector:
  - Patrol Speed: 100
  - Chase Speed: 200
  - Detection Range: 300
  - Attack Range: 50

## 3. Create Waypoints
- In your level scene, create Position2D nodes
- Name them "Waypoint1", "Waypoint2", etc.
- In Enemy's Waypoint Paths array, add NodePaths:
  - "../Waypoint1"
  - "../Waypoint2"  
  - etc.

## 4. Setup Player
- Add player node to group "player"
- Player needs take_damage method:
\`\`\`gdscript
func take_damage(amount: float):
    health -= amount
\`\`\`

## 5. Animations (Optional)
Create animations: "idle", "walk", "run", "attack"

## Testing
1. Run scene - enemy should patrol
2. Get close - enemy should chase
3. Get in attack range - enemy attacks
4. Run away - enemy gives up
`,
	version: '1.0.0',
	tags: ['ai', 'enemy', 'behavior', 'godot', 'patrol', 'chase', 'state-machine']
};
