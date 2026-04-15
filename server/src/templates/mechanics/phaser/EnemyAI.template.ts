/**
 * Phaser 3 Enemy AI Template (JavaScript)
 * Complete enemy controller with patrol, chase, and attack behaviors
 */

import type { MechanicsTemplate } from '../../../types/gameMechanics.types.js';

export const PHASER_ENEMY_AI_CODE = `class EnemyAI {
    constructor(scene, x, y, texture) {
        this.scene = scene;
        
        // Create sprite
        this.sprite = scene.physics.add.sprite(x, y, texture);
        this.sprite.setCollideWorldBounds(true);
        
        // Settings
        this.{{PATROL_SPEED}} = 100;
        this.{{CHASE_SPEED}} = 200;
        this.{{DETECTION_RANGE}} = 300;
        this.{{CHASE_RANGE}} = 500;
        this.{{ATTACK_RANGE}} = 50;
        this.{{ATTACK_DAMAGE}} = 10;
        this.{{ATTACK_COOLDOWN}} = 1500; // milliseconds
        this.{{VISION_ANGLE}} = 60;
        this.{{WAYPOINT_WAIT_TIME}} = 1000;
        
        // State machine
        this.states = { PATROL: 'patrol', CHASE: 'chase', ATTACK: 'attack' };
        this.currentState = this.states.PATROL;
        
        // Waypoints
        this.waypoints = [];
        this.currentWaypointIndex = 0;
        this.waypointWaitTimer = 0;
        
        // Target
        this.player = null;
        this.lastAttackTime = 0;
    }
    
    setWaypoints(waypoints) {
        this.waypoints = waypoints;
        return this;
    }
    
    setPlayer(player) {
        this.player = player;
        return this;
    }
    
    update(time, delta) {
        if (!this.player) return;
        
        // State machine
        switch (this.currentState) {
            case this.states.PATROL:
                this.patrolBehavior(delta);
                this.checkForPlayer();
                break;
            
            case this.states.CHASE:
                this.chaseBehavior();
                this.checkAttackRange();
                this.checkLosePlayer();
                break;
            
            case this.states.ATTACK:
                this.attackBehavior(time);
                break;
        }
        
        // Update animation
        this.updateAnimation();
    }
    
    patrolBehavior(delta) {
        if (!this.waypoints || this.waypoints.length === 0) {
            this.sprite.setVelocity(0, 0);
            return;
        }
        
        const targetWaypoint = this.waypoints[this.currentWaypointIndex];
        const distance = Phaser.Math.Distance.Between(
            this.sprite.x, this.sprite.y,
            targetWaypoint.x, targetWaypoint.y
        );
        
        if (distance < 10) {
            // Wait at waypoint
            this.waypointWaitTimer += delta;
            this.sprite.setVelocity(0, 0);
            
            if (this.waypointWaitTimer >= this.{{WAYPOINT_WAIT_TIME}}) {
                this.currentWaypointIndex = (this.currentWaypointIndex + 1) % this.waypoints.length;
                this.waypointWaitTimer = 0;
            }
        } else {
            // Move toward waypoint
            const angle = Phaser.Math.Angle.Between(
                this.sprite.x, this.sprite.y,
                targetWaypoint.x, targetWaypoint.y
            );
            
            this.sprite.setVelocity(
                Math.cos(angle) * this.{{PATROL_SPEED}},
                Math.sin(angle) * this.{{PATROL_SPEED}}
            );
            
            // Flip sprite
            this.sprite.flipX = Math.cos(angle) < 0;
        }
    }
    
    chaseBehavior() {
        const angle = Phaser.Math.Angle.Between(
            this.sprite.x, this.sprite.y,
            this.player.x, this.player.y
        );
        
        this.sprite.setVelocity(
            Math.cos(angle) * this.{{CHASE_SPEED}},
            Math.sin(angle) * this.{{CHASE_SPEED}}
        );
        
        // Flip sprite
        this.sprite.flipX = Math.cos(angle) < 0;
    }
    
    attackBehavior(time) {
        // Stop moving
        this.sprite.setVelocity(0, 0);
        
        // Face player
        this.sprite.flipX = this.player.x < this.sprite.x;
        
        // Attack cooldown
        if (time >= this.lastAttackTime + this.{{ATTACK_COOLDOWN}}) {
            this.performAttack();
            this.lastAttackTime = time;
        }
        
        // Return to chase if player moves away
        const distance = Phaser.Math.Distance.Between(
            this.sprite.x, this.sprite.y,
            this.player.x, this.player.y
        );
        
        if (distance > this.{{ATTACK_RANGE}} * 1.2) {
            this.currentState = this.states.CHASE;
        }
    }
    
    checkForPlayer() {
        const distance = Phaser.Math.Distance.Between(
            this.sprite.x, this.sprite.y,
            this.player.x, this.player.y
        );
        
        if (distance <= this.{{DETECTION_RANGE}}) {
            // Check vision cone
            const angleToPlayer = Phaser.Math.Angle.Between(
                this.sprite.x, this.sprite.y,
                this.player.x, this.player.y
            );
            
            const facingAngle = this.sprite.flipX ? Math.PI : 0;
            const angleDiff = Math.abs(Phaser.Math.Angle.Wrap(angleToPlayer - facingAngle));
            
            if (angleDiff <= Phaser.Math.DegToRad(this.{{VISION_ANGLE}} / 2)) {
                // Simple line of sight (no raycasting for simplicity)
                this.currentState = this.states.CHASE;
            }
        }
    }
    
    checkAttackRange() {
        const distance = Phaser.Math.Distance.Between(
            this.sprite.x, this.sprite.y,
            this.player.x, this.player.y
        );
        
        if (distance <= this.{{ATTACK_RANGE}}) {
            this.currentState = this.states.ATTACK;
        }
    }
    
    checkLosePlayer() {
        const distance = Phaser.Math.Distance.Between(
            this.sprite.x, this.sprite.y,
            this.player.x, this.player.y
        );
        
        if (distance > this.{{CHASE_RANGE}}) {
            this.currentState = this.states.PATROL;
            this.findNearestWaypoint();
        }
    }
    
    findNearestWaypoint() {
        if (!this.waypoints || this.waypoints.length === 0)  return;
        
        let minDistance = Infinity;
        let nearestIndex = 0;
        
        for (let i = 0; i < this.waypoints.length; i++) {
            const distance = Phaser.Math.Distance.Between(
                this.sprite.x, this.sprite.y,
                this.waypoints[i].x, this.waypoints[i].y
            );
            
            if (distance < minDistance) {
                minDistance = distance;
                nearestIndex = i;
            }
        }
        
        this.currentWaypointIndex = nearestIndex;
    }
    
    performAttack() {
        // Play attack animation
        if (this.sprite.anims) {
            this.sprite.anims.play('attack', true);
        }
        
        // Deal damage to player
        const distance = Phaser.Math.Distance.Between(
            this.sprite.x, this.sprite.y,
            this.player.x, this.player.y
        );
        
        if (distance <= this.{{ATTACK_RANGE}}) {
            // Call player's takeDamage method if it exists
            if (this.player.takeDamage) {
                this.player.takeDamage(this.{{ATTACK_DAMAGE}});
            }
        }
    }
    
    updateAnimation() {
        if (!this.sprite.anims) return;
        
        const velocityX = Math.abs(this.sprite.body.velocity.x);
        const velocityY = Math.abs(this.sprite.body.velocity.y);
        const speed = Math.sqrt(velocityX * velocityX + velocityY * velocityY);
        
        if (this.currentState === this.states.CHASE && speed > 10) {
            this.sprite.anims.play('run', true);
        } else if (this.currentState === this.states.PATROL && speed > 10) {
            this.sprite.anims.play('walk', true);
        } else if (this.currentState !== this.states.ATTACK) {
            this.sprite.anims.play('idle', true);
        }
    }
    
    destroy() {
        this.sprite.destroy();
    }
}

export default EnemyAI;
`;

export const PHASER_ENEMY_AI_CONFIG: MechanicsTemplate = {
    id: 'phaser-enemy-ai',
    name: 'Phaser 3 Enemy AI System',
    engine: 'phaser',
    category: 'ai',
    language: 'javascript',
    code: PHASER_ENEMY_AI_CODE,
    variables: [
        { name: 'PATROL_SPEED', type: 'number', default: 100, // @ts-ignore
  description: 'Enemy patrol movement speed' },
        { name: 'CHASE_SPEED', type: 'number', default: 200, // @ts-ignore
  description: 'Enemy chase movement speed' },
        { name: 'DETECTION_RANGE', type: 'number', default: 300, // @ts-ignore
  description: 'Range to detect player (pixels)' },
        { name: 'CHASE_RANGE', type: 'number', default: 500, // @ts-ignore
  description: 'How far to chase before giving up' },
        { name: 'ATTACK_RANGE', type: 'number', default: 50, // @ts-ignore
  description: 'Range to attack player' },
        { name: 'ATTACK_DAMAGE', type: 'number', default: 10, // @ts-ignore
  description: 'Damage dealt per attack' },
        { name: 'ATTACK_COOLDOWN', type: 'number', default: 1500, // @ts-ignore
  description: 'Time between attacks (ms)' },
        { name: 'VISION_ANGLE', type: 'number', default: 60, // @ts-ignore
  description: 'Field of view angle in degrees' },
        { name: 'WAYPOINT_WAIT_TIME', type: 'number', default: 1000, // @ts-ignore
  description: 'Time to wait at waypoints (ms)' }
    ],
    dependencies: [
        'Phaser 3.x',
        'Arcade Physics',
        'Player sprite with takeDamage method'
    ],
    instructions: `# Phaser 3 Enemy AI Setup

## 1. Import and Create Enemy
\`\`\`javascript
import EnemyAI from './EnemyAI.js';

// In your scene's create():
this.enemy = new EnemyAI(this, 100, 100, 'enemy_sprite');
\`\`\`

## 2. Setup Waypoints
\`\`\`javascript
const waypoints = [
    { x: 100, y: 100 },
    { x: 300, y: 100 },
    { x: 300, y: 300 },
    { x: 100, y: 300 }
];

this.enemy.setWaypoints(waypoints);
\`\`\`

## 3. Set Player Reference
\`\`\`javascript
this.enemy.setPlayer(this.player);
\`\`\`

## 4. Update Loop
\`\`\`javascript
// In your scene's update():
update(time, delta) {
    this.enemy.update(time, delta);
}
\`\`\`

## 5. Player Damage Method
Your player needs:
\`\`\`javascript
takeDamage(amount) {
    this.health -= amount;
    console.log('Player hit! Health:', this.health);
}
\`\`\`

## 6. Animations (Optional)
Create animations for: idle, walk, run, attack

## Testing
1. Enemy patrols between waypoints
2. Gets close - enemy chases
3. In attack range - enemy attacks
4. Run away - enemy returns to patrol
`,
    // @ts-ignore
  version: '1.0.0',
    tags: ['ai', 'enemy', 'behavior', 'phaser', 'patrol', 'chase', 'javascript']
};
