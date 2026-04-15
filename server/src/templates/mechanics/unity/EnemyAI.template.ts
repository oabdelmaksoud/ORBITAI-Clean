/**
 * Unity Enemy AI Template
 * Complete enemy controller with patrol, chase, and attack behaviors
 */

import type { MechanicsTemplate } from '../../../types/gameMechanics.types.js';

export const UNITY_ENEMY_AI_CODE = `using UnityEngine;
using System.Collections;
using System.Collections.Generic;

public class EnemyAI : MonoBehaviour
{
    [Header("Patrol Settings")]
    [SerializeField] private Transform[] {{WAYPOINTS_ARRAY_NAME}};
    [SerializeField] private float {{PATROL_SPEED}} = 2f;
    [SerializeField] private float {{WAYPOINT_WAIT_TIME}} = 1f;
    
    [Header("Chase Settings")]
    [SerializeField] private float {{CHASE_SPEED}} = 4f;
    [SerializeField] private float {{DETECTION_RANGE}} = 8f;
    [SerializeField] private float {{CHASE_RANGE}} = 12f;
    [SerializeField] private LayerMask {{PLAYER_LAYER}};
    
    [Header("Attack Settings")]
    [SerializeField] private float {{ATTACK_RANGE}} = 1.5f;
    [SerializeField] private float {{ATTACK_DAMAGE}} = 10f;
    [SerializeField] private float {{ATTACK_COOLDOWN}} = 1.5f;
    
    [Header("Vision Settings")]
    [SerializeField] private float {{VISION_ANGLE}} = 60f;
    [SerializeField] private LayerMask {{OBSTACLE_LAYER}};
    
    // Components
    private Rigidbody2D rb;
    private Animator animator;
    private SpriteRenderer spriteRenderer;
    
    // State
    private enum EnemyState { Patrol, Chase, Attack }
    private EnemyState currentState = EnemyState.Patrol;
    
    // Patrol
    private int currentWaypointIndex = 0;
    private float waypointWaitTimer = 0f;
    
    // Target
    private Transform player;
    private float lastAttackTime = 0f;
    
    void Start()
    {
        rb = GetComponent<Rigidbody2D>();
        animator = GetComponent<Animator>();
        spriteRenderer = GetComponent<SpriteRenderer>();
        
        // Find player
        player = GameObject.FindGameObjectWithTag("Player")?.transform;
        
        if ({{WAYPOINTS_ARRAY_NAME}} == null || {{WAYPOINTS_ARRAY_NAME}}.Length == 0)
        {
            Debug.LogWarning("Enemy AI: No waypoints assigned!");
        }
    }
    
    void Update()
    {
        if (player == null) return;
        
        // State machine
        switch (currentState)
        {
            case EnemyState.Patrol:
                PatrolBehavior();
                CheckForPlayer();
                break;
                
            case EnemyState.Chase:
                ChaseBehavior();
                CheckAttackRange();
                CheckLosePlayer();
                break;
                
            case EnemyState.Attack:
                AttackBehavior();
                break;
        }
        
        // Update animator
        UpdateAnimation();
    }
    
    private void PatrolBehavior()
    {
        if ({{WAYPOINTS_ARRAY_NAME}} == null || {{WAYPOINTS_ARRAY_NAME}}.Length == 0)
            return;
        
        Transform targetWaypoint = {{WAYPOINTS_ARRAY_NAME}}[currentWaypointIndex];
        
        // Move toward waypoint
        Vector2 direction = (targetWaypoint.position - transform.position).normalized;
        rb.velocity = new Vector2(direction.x * {{PATROL_SPEED}}, rb.velocity.y);
        
        // Flip sprite
        if (direction.x != 0)
            spriteRenderer.flipX = direction.x < 0;
        
        // Check if reached waypoint
        if (Vector2.Distance(transform.position, targetWaypoint.position) < 0.2f)
        {
            waypointWaitTimer += Time.deltaTime;
            rb.velocity = Vector2.zero;
            
            if (waypointWaitTimer >= {{WAYPOINT_WAIT_TIME}})
            {
                currentWaypointIndex = (currentWaypointIndex + 1) % {{WAYPOINTS_ARRAY_NAME}}.Length;
                waypointWaitTimer = 0f;
            }
        }
    }
    
    private void ChaseBehavior()
    {
        Vector2 direction = (player.position - transform.position).normalized;
        rb.velocity = new Vector2(direction.x * {{CHASE_SPEED}}, rb.velocity.y);
        
        // Flip sprite
        if (direction.x != 0)
            spriteRenderer.flipX = direction.x < 0;
    }
    
    private void AttackBehavior()
    {
        // Stop moving
        rb.velocity = Vector2.zero;
        
        // Face player
        spriteRenderer.flipX = player.position.x < transform.position.x;
        
        // Attack cooldown
        if (Time.time >= lastAttackTime + {{ATTACK_COOLDOWN}})
        {
            PerformAttack();
            lastAttackTime = Time.time;
        }
        
        // Return to chase if player moves away
        float distance = Vector2.Distance(transform.position, player.position);
        if (distance > {{ATTACK_RANGE}} * 1.2f)
        {
            currentState = EnemyState.Chase;
        }
    }
    
    private void CheckForPlayer()
    {
        float distance = Vector2.Distance(transform.position, player.position);
        
        if (distance <= {{DETECTION_RANGE}})
        {
            // Check if player is in vision cone
            Vector2 directionToPlayer = (player.position - transform.position).normalized;
            float angle = Vector2.Angle(spriteRenderer.flipX ? Vector2.left : Vector2.right, directionToPlayer);
            
            if (angle <= {{VISION_ANGLE}} / 2)
            {
                // Raycast to check line of sight
                RaycastHit2D hit = Physics2D.Raycast(transform.position, directionToPlayer, distance, {{OBSTACLE_LAYER}});
                
                if (hit.collider == null || hit.collider.CompareTag("Player"))
                {
                    currentState = EnemyState.Chase;
                }
            }
        }
    }
    
    private void CheckAttackRange()
    {
        float distance = Vector2.Distance(transform.position, player.position);
        
        if (distance <= {{ATTACK_RANGE}})
        {
            currentState = EnemyState.Attack;
        }
    }
    
    private void CheckLosePlayer()
    {
        float distance = Vector2.Distance(transform.position, player.position);
        
        if (distance > {{CHASE_RANGE}})
        {
            currentState = EnemyState.Patrol;
            // Return to nearest waypoint
            FindNearestWaypoint();
        }
    }
    
    private void FindNearestWaypoint()
    {
        if ({{WAYPOINTS_ARRAY_NAME}} == null || {{WAYPOINTS_ARRAY_NAME}}.Length == 0)
            return;
        
        float minDistance = float.MaxValue;
        int nearestIndex = 0;
        
        for (int i = 0; i < {{WAYPOINTS_ARRAY_NAME}}.Length; i++)
        {
            float distance = Vector2.Distance(transform.position, {{WAYPOINTS_ARRAY_NAME}}[i].position);
            if (distance < minDistance)
            {
                minDistance = distance;
                nearestIndex = i;
            }
        }
        
        currentWaypointIndex = nearestIndex;
    }
    
    private void PerformAttack()
    {
        // Trigger attack animation
        if (animator != null)
            animator.SetTrigger("Attack");
        
        // Deal damage to player if in range
        Collider2D[] hits = Physics2D.OverlapCircleAll(transform.position, {{ATTACK_RANGE}}, {{PLAYER_LAYER}});
        
        foreach (Collider2D hit in hits)
        {
            if (hit.CompareTag("Player"))
            {
                // Try to get health component
                var health = hit.GetComponent<Health>();
                if (health != null)
                {
                    health.TakeDamage({{ATTACK_DAMAGE}});
                }
            }
        }
    }
    
    private void UpdateAnimation()
    {
        if (animator == null) return;
        
        animator.SetFloat("Speed", Mathf.Abs(rb.velocity.x));
        animator.SetBool("IsChasing", currentState == EnemyState.Chase);
        animator.SetBool("IsAttacking", currentState == EnemyState.Attack);
    }
    
    // Debug visualization
    private void OnDrawGizmosSelected()
    {
        // Detection range
        Gizmos.color = Color.yellow;
        Gizmos.DrawWireSphere(transform.position, {{DETECTION_RANGE}});
        
        // Chase range
        Gizmos.color = Color.orange;
        Gizmos.DrawWireSphere(transform.position, {{CHASE_RANGE}});
        
        // Attack range
        Gizmos.color = Color.red;
        Gizmos.DrawWireSphere(transform.position, {{ATTACK_RANGE}});
        
        // Vision cone
        if (spriteRenderer != null)
        {
            Vector3 forward = spriteRenderer.flipX ? Vector3.left : Vector3.right;
            Vector3 left = Quaternion.Euler(0, 0, {{VISION_ANGLE}} / 2) * forward;
            Vector3 right = Quaternion.Euler(0, 0, -{{VISION_ANGLE}} / 2) * forward;
            
            Gizmos.color = Color.blue;
            Gizmos.DrawRay(transform.position, left * {{DETECTION_RANGE}});
            Gizmos.DrawRay(transform.position, right * {{DETECTION_RANGE}});
        }
    }
}
`;

export const UNITY_ENEMY_AI_CONFIG: MechanicsTemplate = {
    id: 'unity-enemy-ai',
    name: 'Unity Enemy AI System',
    // @ts-ignore
  description: 'Complete enemy AI with patrol, chase, and attack behaviors using state machine',
    engine: 'unity',
    category: 'ai',
    language: 'csharp',
    code: UNITY_ENEMY_AI_CODE,
    variables: [
        { name: 'WAYPOINTS_ARRAY_NAME', type: 'string', default: 'patrolWaypoints', // @ts-ignore
  description: 'Name of waypoints array variable' },
        { name: 'PATROL_SPEED', type: 'number', default: 2, // @ts-ignore
  description: 'Enemy patrol movement speed' },
        { name: 'WAYPOINT_WAIT_TIME', type: 'number', default: 1, // @ts-ignore
  description: 'Time to wait at each waypoint' },
        { name: 'CHASE_SPEED', type: 'number', default: 4, // @ts-ignore
  description: 'Enemy chase movement speed' },
        { name: 'DETECTION_RANGE', type: 'number', default: 8, // @ts-ignore
  description: 'Range to detect player' },
        { name: 'CHASE_RANGE', type: 'number', default: 12, // @ts-ignore
  description: 'How far to chase before giving up' },
        { name: 'ATTACK_RANGE', type: 'number', default: 1.5, // @ts-ignore
  description: 'Range to attack player' },
        { name: 'ATTACK_DAMAGE', type: 'number', default: 10, // @ts-ignore
  description: 'Damage dealt per attack' },
        { name: 'ATTACK_COOLDOWN', type: 'number', default: 1.5, // @ts-ignore
  description: 'Time between attacks' },
        { name: 'VISION_ANGLE', type: 'number', default: 60, // @ts-ignore
  description: 'Field of view angle in degrees' },
        { name: 'PLAYER_LAYER', type: 'string', default: 'PlayerLayer', // @ts-ignore
  description: 'Layer mask for player detection' },
        { name: 'OBSTACLE_LAYER', type: 'string', default: 'ObstacleLayer', // @ts-ignore
  description: 'Layer mask for obstacles' }
    ],
    dependencies: [
        'Unity 2D Physics',
        'Rigidbody2D component',
        'Animator (optional)',
        'SpriteRenderer',
        'Health script (for damage system)'
    ],
    instructions: `# Unity Enemy AI Setup

## 1. Create Enemy GameObject
- Create a new 2D GameObject in your scene
- Add components:
  - Rigidbody2D (Gravity Scale: 1)
  - BoxCollider2D or CircleCollider2D
  - SpriteRenderer
  - Animator (optional, for animations)
  
## 2. Add EnemyAI Script
- Attach this EnemyAI.cs script to your enemy GameObject
- Configure in Inspector:
  - **Patrol Waypoints**: Create empty GameObjects as patrol points, drag them into array
  - **Speeds**: Adjust patrol speed (2) and chase speed (4)
  - **Ranges**: Set detection (8), chase (12), and attack (1.5) ranges
  - **Damage**: Configure attack damage (10) and cooldown (1.5s)
  - **Layers**: Set Player Layer and Obstacle Layer masks

## 3. Setup Layers
- Create layers: "Player", "Obstacle"
- Assign player to Player layer
- Assign walls/obstacles to Obstacle layer

## 4. Create Waypoints
- Create empty GameObjects in your scene
- Position them where you want the enemy to patrol
- Name them "Waypoint1", "Waypoint2", etc.
- Drag all waypoints into the Patrol Waypoints array

## 5. Animator Setup (Optional)
If using animations:
- Create Animator Controller
- Add parameters:
  - float "Speed"
  - bool "IsChasing"
  - bool "IsAttacking"  
  - trigger "Attack"
- Create animation states and transitions

## 6. Health System Integration
Enemy expects player Health component:
\`\`\`csharp
public class Health : MonoBehaviour
{
    public void TakeDamage(float damage) 
    {
        // Your damage logic
    }
}
\`\`\`

## Testing
1. Play mode - enemy should patrol between waypoints
2. Move player close - enemy should detect and chase
3. Get in attack range - enemy should attack
4. Run away - enemy should give up chase and return to patrol

## Debug Visualization
In Scene view with enemy selected, you'll see:
- Yellow circle: Detection range
- Orange circle: Chase range  
- Red circle: Attack range
- Blue lines: Vision cone
`,
    // @ts-ignore
  version: '1.0.0',
    tags: ['ai', 'enemy', 'behavior', 'patrol', 'chase', 'attack', 'state-machine']
};
