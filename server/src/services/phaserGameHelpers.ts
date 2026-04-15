/**
 * Phaser game generation helpers
 * Extracted to separate module for maintainability
 */

/**
 * Detect if game features require Phaser framework (vs vanilla Canvas)
 */
export function detectComplexGame(features: string[], requirements: string[]): boolean {
  const complexKeywords = [
    'physics', 'collision', 'sprite', 'animation', 'particle',
    'multiplayer', 'networking', 'tilemap', 'platformer', 'rpg',
    'inventory system', 'skill tree', 'quest system', '3d', 'webgl'
  ];

  const allText = [...features, ...requirements].join(' ').toLowerCase();
  const matchCount = complexKeywords.filter(kw => allText.includes(kw)).length;

  // Require 2+ complex keywords to trigger Phaser
  return matchCount >= 2;
}

/**
 * Build Phaser 3 game prompt for complex/production games
 */
export function buildPhaserGamePrompt(
  cleanGoal: string,
  playerFeatures: string[],
  cleanRequirements: string[],
  brainstormingContext: any,
  targetPlatforms: string[]
): string {
  const featuresList = playerFeatures.length > 0
    ? playerFeatures.map((f, i) => `${i + 1}. ${f}`).join('\n')
    : 'Basic game mechanics';

  return `🎮 PHASER 3 PRODUCTION GAME - NOT A MENU INTERFACE

YOU ARE CREATING A PLAYABLE PHASER 3 GAME WITH PROFESSIONAL SPRITE SYSTEMS.

**PROJECT GOAL:** ${cleanGoal.substring(0, 3000)}

**FEATURES:**
${featuresList}

**BRAINSTORMING CONTEXT (INCORPORATE THESE IDEAS):**
- **Concept:** ${brainstormingContext?.concept || 'N/A'}
- **Audience:** ${brainstormingContext?.audience || 'General'}
- **Style:** ${brainstormingContext?.style || 'Standard'}
- **Core Loop:** ${brainstormingContext?.coreLoop || 'Standard gameplay'}


════════════════════════════════════════════════════════════════════
⚠️ CRITICAL: ASSET LOADING RESTRICTIONS ⚠️
════════════════════════════════════════════════════════════════════

🚫 ABSOLUTE PROHIBITIONS - THESE WILL CAUSE THE GAME TO FREEZE:
   ❌ NEVER use this.load.image() with data URIs (data:image/png;base64,...)
   ❌ NEVER use this.load.spritesheet() with data URIs
   ❌ NEVER use this.load.audio() with blob URLs or data URIs
   ❌ NEVER use this.load.svg() with inline SVG data
   
   WHY: Phaser blocks "Local data URIs" in iframe/srcdoc environments for security.
        This causes preload() to fail silently, resulting in black screens.

✅ MANDATORY: CREATE ALL SPRITES USING Graphics.generateTexture():
   
   CORRECT PATTERN:
   function preload() {
     // ⚠️ DO NOT use this.load.image() - it fails with data URIs in iframes!
     // ✅ ONLY use this.add.graphics().generateTexture()
     
     const g = this.add.graphics();
     
     // Example: Player sprite with gradients and details
     g.fillStyle(0x00ffcc);
     g.fillCircle(16, 16, 16);
     g.fillStyle(0xffffff);
     g.fillCircle(10, 12, 4);  // Left eye
     g.fillCircle(22, 12, 4);  // Right eye
     g.generateTexture('player', 32, 32);
     g.clear();  // Reuse graphics object
     
     // Example: Background with gradient (use fillGradientStyle for complex visuals)
     g.fillGradientStyle(0x0a1428, 0x0a1428, 0x1e3a5f, 0x1e3a5f, 1);
     g.fillRect(0, 0, 800, 600);
     g.generateTexture('background', 800, 600);
     g.clear();
     
     g.destroy();  // Clean up when done
   }

✅ FOR AUDIO: Use Web Audio API programmatically (no external files):
   const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
   const osc = audioCtx.createOscillator();
   // ... configure and play

IF YOU USE this.load.image() OR DATA URIs, THE GAME WILL BE COMPLETELY BROKEN.

════════════════════════════════════════════════════════════════════
⚠️ MANDATORY: MENU/OVERLAY BUTTON REQUIREMENTS ⚠️
════════════════════════════════════════════════════════════════════

If you include a START MENU or any overlay screen, follow these rules:

🔘 **BUTTON REQUIREMENTS:**
   - Every button MUST have an onclick handler that works
   - Set button z-index: 9999 (higher than canvas)
   - Never use pointer-events: none on buttons
   - Use inline onclick for reliability

✅ CORRECT MENU IMPLEMENTATION:
\`\`\`html
<div id="startMenu" style="position:absolute;inset:0;z-index:1000;display:flex;justify-content:center;align-items:center;background:rgba(0,0,0,0.8)">
  <div style="text-align:center">
    <h1>Game Title</h1>
    <button id="startBtn" style="z-index:9999;cursor:pointer;padding:15px 40px;font-size:18px" 
      onclick="document.getElementById('startMenu').style.display='none';document.querySelector('canvas').focus();">
      START GAME
    </button>
  </div>
</div>
\`\`\`

✅ OR USE PHASER'S BUILT-IN INPUT:
\`\`\`javascript
// In create() function - creates clickable start text
const startText = this.add.text(400, 300, 'Click to Start', { fontSize: '32px' })
  .setInteractive()
  .on('pointerdown', () => { this.scene.start('GameScene'); });
\`\`\`

❌ NEVER DO THIS:
   - Button without onclick handler
   - pointer-events: none on menu buttons  
   - z-index lower than canvas
   - Menu that blocks the entire game without dismiss

**TEMPLATE - EXPAND THIS WITH GAME MECHANICS:**
<!DOCTYPE html>
<html><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${cleanGoal.substring(0, 30)} - Phaser Game</title>
<script src="https://cdn.jsdelivr.net/npm/phaser@3.60.0/dist/phaser.min.js"></script>
<style>
body{margin:0;padding:0;background:#1a1a2e;display:flex;justify-content:center;align-items:center;min-height:100vh;font-family:Arial}
#game{box-shadow:0 20px 50px rgba(0,0,0,0.5);border-radius:8px}
</style></head><body><div id="game"></div><script>
const config={type:Phaser.AUTO,width:800,height:600,parent:'game',backgroundColor:'#0f3460',
scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},
physics:{default:'arcade',arcade:{gravity:{y:300},debug:false}},
scene:{preload,create,update}};
const game=new Phaser.Game(config);
let player,cursors,score=0,scoreText,enemies,collectibles;

function preload(){
  // ⚠️ CRITICAL: ALL sprites MUST be created using Graphics.generateTexture()
  // ❌ NEVER use this.load.image() - it will cause the game to freeze in iframes!
  
  const g=this.add.graphics();
  
  // 1. Background sprite with gradient (800x600)
  // Use fillGradientStyle for visually rich backgrounds
  g.fillGradientStyle(0x0a1428,0x0a1428,0x1e3a5f,0x1e3a5f,1);
  g.fillRect(0,0,800,600);
  g.generateTexture('background',800,600);g.clear();
  
  // 2. Player sprite (32x32) - Multi-colored with outline
  g.lineStyle(2,0x000000);  // Black outline
  g.fillStyle(0x00ffcc);
  g.fillCircle(16,16,14);
  g.strokeCircle(16,16,14);
  g.fillStyle(0xffffff);
  g.fillCircle(10,12,4);  // Left eye
  g.fillCircle(22,12,4);  // Right eye
  g.fillStyle(0xff6b6b);
  g.fillCircle(16,20,3);  // Mouth
  g.generateTexture('player',32,32);g.clear();
  
  // 3. Large platform with border (100x20)
  g.fillStyle(0x2d5016);  // Dark green fill
  g.fillRect(0,0,100,20);
  g.lineStyle(2,0x44ff44);  // Bright green border
  g.strokeRect(0,0,100,20);
  g.generateTexture('platform',100,20);g.clear();
  
  // 4. Small platform (50x15)
  g.fillStyle(0x5a3e1b);
  g.fillRect(0,0,50,15);
  g.lineStyle(2,0x8b6f47);
  g.strokeRect(0,0,50,15);
  g.generateTexture('smallPlatform',50,15);g.clear();
  
  // 5. Collectible coin with shine (24x24)
  g.fillStyle(0xffdd00);
  g.fillCircle(12,12,12);
  g.fillStyle(0xffaa00);
  g.fillCircle(12,12,8);
  g.fillStyle(0xffffff,0.6);  // Shine effect
  g.fillCircle(9,9,4);
  g.generateTexture('coin',24,24);g.clear();
  
  // 6. Enemy sprite with details (32x32)
  g.lineStyle(2,0x000000);
  g.fillStyle(0xff4444);
  g.fillCircle(16,16,14);
  g.strokeCircle(16,16,14);
  g.fillStyle(0xffffff);
  g.fillCircle(10,12,4);
  g.fillCircle(22,12,4);
  g.fillStyle(0x000000);  // Evil eyes
  g.fillCircle(10,12,2);
  g.fillCircle(22,12,2);
  g.generateTexture('enemy',32,32);g.clear();
  
  // 7. Particle sprite (8x8) - Small glowing dot for effects
  g.fillStyle(0xffff00);
  g.fillCircle(4,4,4);
  g.fillStyle(0xffffff,0.8);
  g.fillCircle(4,4,2);
  g.generateTexture('particle',8,8);g.clear();
  
  // 8. Star collectible (20x20)
  g.fillStyle(0xffff00);
  g.beginPath();
  for(let i=0;i<5;i++){
    const angle=i*Math.PI*2/5-Math.PI/2;
    const x=10+Math.cos(angle)*10;
    const y=10+Math.sin(angle)*10;
    if(i===0)g.moveTo(x,y);else g.lineTo(x,y);
    const innerAngle=angle+Math.PI/5;
    const ix=10+Math.cos(innerAngle)*5;
    const iy=10+Math.sin(innerAngle)*5;
    g.lineTo(ix,iy);
  }
  g.closePath();
  g.fillPath();
  g.generateTexture('star',20,20);g.clear();
  
  // 9. Power-up sprite with glow (28x28)
  g.fillStyle(0x00ffff,0.3);  // Glow aura
  g.fillCircle(14,14,14);
  g.fillStyle(0x00ffff);
  g.fillCircle(14,14,10);
  g.fillStyle(0xffffff);
  g.fillCircle(14,14,6);
  g.generateTexture('powerup',28,28);g.clear();
  
  // 10. UI Button background (120x40)
  g.fillStyle(0x4a90e2);
  g.fillRoundedRect(0,0,120,40,8);
  g.lineStyle(3,0x357abd);
  g.strokeRoundedRect(0,0,120,40,8);
  g.generateTexture('button',120,40);g.clear();
  
  g.destroy();  // ✅ Clean up graphics object when done
  
  console.log('✅ All sprites created programmatically using Graphics.generateTexture()');
}

function create(){
  // Create platforms
  const platforms=this.physics.add.staticGroup();
  platforms.create(400,580,'platform').setScale(8,1).refreshBody();
  platforms.create(600,450,'platform').setScale(2,1).refreshBody();
  platforms.create(200,350,'platform').setScale(2,1).refreshBody();
  platforms.create(750,270,'platform').setScale(2,1).refreshBody();
  
  // Create player
  player=this.physics.add.sprite(100,450,'player');
  player.setBounce(0.2);
  player.setCollideWorldBounds(true);
  this.physics.add.collider(player,platforms);
  
  // Create collectibles (coins)
  collectibles=this.physics.add.group({
    key:'coin',
    repeat:11,
    setXY:{x:12,y:0,stepX:70}
  });
  collectibles.children.iterate(c=>c.setBounceY(Phaser.Math.FloatBetween(0.4,0.8)));
  this.physics.add.collider(collectibles,platforms);
  this.physics.add.overlap(player,collectibles,(p,c)=>{
    c.disableBody(true,true);
    score+=10;
    scoreText.setText('Score: '+score);
    // Respawn if all collected
    if(collectibles.countActive(true)===0){
      collectibles.children.iterate(child=>child.enableBody(true,child.x,0,true,true));
    }
  });
  
  // Create enemies
  enemies=this.physics.add.group();
  const enemy1=enemies.create(400,300,'enemy');
  enemy1.setBounce(1);
  enemy1.setCollideWorldBounds(true);
  enemy1.setVelocity(Phaser.Math.Between(-200,200),20);
  this.physics.add.collider(enemies,platforms);
  this.physics.add.collider(player,enemies,(p,e)=>{
    this.physics.pause();
    p.setTint(0xff0000);
    const txt=this.add.text(400,300,'GAME OVER\\nClick to Restart',
      {fontSize:'48px',fill:'#fff',fontStyle:'bold',stroke:'#000',strokeThickness:6,align:'center'});
    txt.setOrigin(0.5);
    // Use proper state check instead of .once() to ensure reliability
    this.input.on('pointerdown', () => {
        if(this.physics.world.isPaused) {
            this.scene.restart();
            score=0;
        }
    });
  });
  
  // Controls
  cursors=this.input.keyboard.createCursorKeys();
  
  // Touch controls for mobile
  this.input.on('pointerdown',pointer=>{
    if(pointer.x<400)player.setVelocityX(-160);
    else player.setVelocityX(160);
    if(player.body.touching.down)player.setVelocityY(-330);
  },this);
  
  // Score text
  scoreText=this.add.text(16,16,'Score: 0',{
    fontSize:'32px',
    fill:'#fff',
    fontStyle:'bold',
    stroke:'#000',
    strokeThickness:4
  });
  
  // Particle effects
  const particles=this.add.particles('coin');
  particles.createEmitter({
    speed:100,
    scale:{start:0.5,end:0},
    blendMode:'ADD',
    lifespan:300,
    on:false
  });
  this.collectParticles=particles;
  
  console.log('Phaser game loaded. Use arrow keys to move, UP to jump.');
}

function update(){
  if(!player||!player.active)return;
  
  // Player movement
  if(cursors.left.isDown){
    player.setVelocityX(-160);
    player.flipX=true;
  }else if(cursors.right.isDown){
    player.setVelocityX(160);
    player.flipX=false;
  }else{
    player.setVelocityX(0);
  }
  
  // Jump
  if(cursors.up.isDown&&player.body.touching.down){
    player.setVelocityY(-330);
  }
  
  // TODO: Implement ${cleanGoal} specific mechanics:
  // - Power-up systems (press SPACE for special ability)
  // - Enemy AI behaviors (patrol patterns, aim at player)
  // - Level progression (score thresholds, new enemy types)
  // - Special abilities (double jump, dash, projectiles)
  // - Health system with lives/respawn
  // - Boss fights
}
</script></body></html>

**ADVANCED SPRITE TECHNIQUES - STUDY THESE PATTERNS:**

1. **Gradient Backgrounds:**
   // Vertical gradient (top to bottom, different colors)
   g.fillGradientStyle(topLeft, topRight, bottomLeft, bottomRight, alpha);
   g.fillRect(0, 0, width, height);
   
   // Example: Sky gradient from blue to purple
   g.fillGradientStyle(0x87ceeb, 0x87ceeb, 0x4b0082, 0x4b0082, 1);
   g.fillRect(0, 0, 800, 600);
   g.generateTexture('sky', 800, 600);

2. **Complex Shapes with Layering:**
   // Create detailed sprites by layering multiple shapes
   g.fillStyle(0x8b4513);  // Brown body
   g.fillRect(4, 8, 24, 24);
   g.fillStyle(0x654321);  // Darker outline
   g.lineStyle(2, 0x654321);
   g.strokeRect(4, 8, 24, 24);
   g.fillStyle(0xff0000);  // Red detail
   g.fillCircle(16, 16, 4);
   g.generateTexture('block', 32, 32);

3. **Animated Sprite Sheets (Multiple Frames):**
   // Create each frame as separate texture
   for(let frame = 0; frame < 4; frame++) {
     g.clear();
     g.fillStyle(0x00ff00);
     g.fillCircle(16, 16, 12 + frame * 2);  // Growing circle
     g.generateTexture('explosion_' + frame, 32, 32);
   }
   // Use in animation: this.anims.create({key:'explode', frames:['explosion_0','explosion_1'...]})

4. **Transparency and Glow Effects:**
   // Outer glow with transparency
   g.fillStyle(0xffff00, 0.2);  // Yellow, 20% opacity
   g.fillCircle(16, 16, 16);
   g.fillStyle(0xffff00, 0.6);  // 60% opacity
   g.fillCircle(16, 16, 12);
   g.fillStyle(0xffff00, 1.0);  // Solid core
   g.fillCircle(16, 16, 8);
   g.generateTexture('glow', 32, 32);

5. **Geometric Patterns:**
   // Triangle
   g.fillStyle(0xff00ff);
   g.beginPath();
   g.moveTo(16, 4);
   g.lineTo(28, 28);
   g.lineTo(4, 28);
   g.closePath();
   g.fillPath();
   g.generateTexture('triangle', 32, 32);

6. **Text as Texture:**
   // Create text sprites (for score popups, etc.)
   g.fillStyle(0xffffff);
   const textStyle = {fontSize: '24px', fill: '#fff', fontStyle: 'bold'};
   const text = this.add.text(0, 0, '+10', textStyle);
   text.generateTexture('scorePopup', text.width, text.height);
   text.destroy();

**REMEMBER:**
✅ ALL assets = Graphics.generateTexture()
❌ NEVER = this.load.image() or data URIs
✅ Gradients = fillGradientStyle()
✅ Complex sprites = Layer multiple shapes
✅ Particles = Small sprites (8x8) with glow effects
✅ Variations = Create multiple textures with loops

**CRITICAL REQUIREMENTS:**
1. EXPAND the template with full "${cleanGoal}" mechanics
2. Implement ALL features using Phaser's built-in physics and sprite systems
3. Add proper enemy AI, power-ups, levels, and win/lose conditions
4. Use Phaser Particle Emitters for visual effects
5. Add audio (sound effects for jumps, collects, hits)
6. Make it IMMEDIATELY PLAYABLE with smooth, responsive controls
7. DO NOT create dashboard UIs or menu systems - make it a PLAYABLE GAME

**PHASER BEST PRACTICES:**
- Use Phaser.Physics.Arcade for collision and movement
- Use Groups for managing collections (enemies, coins)
- Leverage object pooling for performance
- Add tweens for smooth animations (this.tweens.add(...))
- Handle both keyboard and touch input
- Use particle emitters for effects (jumps, hits, collects)
- ❌ DO NOT use input.once() for mechanics (shooting, jumping) - use input.on()
- ✅ Reset state flags (canShoot, isJumping) correctly in update() loop

Start with <!DOCTYPE html>:`;
}
