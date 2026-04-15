import express from 'express';
import { logger } from '../utils/logger.js';

const router = express.Router();

/**
 * Demo game HTML for CUA testing
 * A simple Cyber-Drift style game with Start button
 */
const DEMO_GAME_HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cyber-Drift Demo</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', system-ui, sans-serif;
      background: linear-gradient(135deg, #0f0c29, #302b63, #24243e);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: white;
    }
    .game-container {
      text-align: center;
      padding: 2rem;
    }
    h1 {
      font-size: 3rem;
      background: linear-gradient(90deg, #00f5ff, #ff00ff);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 1rem;
      text-shadow: 0 0 30px rgba(0,245,255,0.5);
    }
    .subtitle {
      color: #888;
      margin-bottom: 2rem;
    }
    #start-game {
      background: linear-gradient(90deg, #00f5ff, #7b2ff7);
      border: none;
      padding: 1rem 3rem;
      font-size: 1.5rem;
      color: white;
      border-radius: 50px;
      cursor: pointer;
      transition: transform 0.3s, box-shadow 0.3s;
      box-shadow: 0 0 30px rgba(123,47,247,0.5);
    }
    #start-game:hover {
      transform: scale(1.1);
      box-shadow: 0 0 50px rgba(0,245,255,0.8);
    }
    #start-game:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    #game-canvas {
      margin-top: 2rem;
      width: 600px;
      height: 400px;
      background: rgba(0,0,0,0.5);
      border: 2px solid #00f5ff;
      border-radius: 10px;
      display: none;
      position: relative;
      overflow: hidden;
    }
    .game-active #game-canvas { display: block; }
    .game-active #start-game { display: none; }
    .player {
      position: absolute;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      width: 60px;
      height: 30px;
      background: linear-gradient(90deg, #00f5ff, #7b2ff7);
      border-radius: 10px;
      transition: left 0.1s;
    }
    .obstacle {
      position: absolute;
      width: 50px;
      height: 50px;
      background: #ff00ff;
      border-radius: 5px;
      top: -50px;
      animation: fall 2s linear forwards;
    }
    @keyframes fall {
      to { top: 450px; }
    }
    #score {
      position: absolute;
      top: 10px;
      right: 20px;
      font-size: 1.5rem;
      color: #00f5ff;
    }
    #game-over {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0,0,0,0.9);
      padding: 2rem;
      border-radius: 10px;
      text-align: center;
      display: none;
    }
    #restart-btn {
      margin-top: 1rem;
      padding: 0.5rem 2rem;
      background: #00f5ff;
      border: none;
      border-radius: 5px;
      cursor: pointer;
      font-size: 1rem;
    }
  </style>
</head>
<body>
  <div class="game-container" id="game-container">
    <h1>🚗 Cyber-Drift</h1>
    <p class="subtitle">Demo Game for CUA Testing</p>
    <button id="start-game">🎮 Start Game</button>
    <div id="game-canvas">
      <div class="player" id="player"></div>
      <div id="score">Score: 0</div>
      <div id="game-over">
        <h2>Game Over!</h2>
        <p>Final Score: <span id="final-score">0</span></p>
        <button id="restart-btn">Play Again</button>
      </div>
    </div>
  </div>

  <script>
    console.log('[CUA-Demo] Demo game loaded');
    
    const startBtn = document.getElementById('start-game');
    const gameCanvas = document.getElementById('game-canvas');
    const player = document.getElementById('player');
    const scoreEl = document.getElementById('score');
    const gameOverEl = document.getElementById('game-over');
    const finalScoreEl = document.getElementById('final-score');
    const restartBtn = document.getElementById('restart-btn');
    const container = document.getElementById('game-container');
    
    let playerX = 300;
    let score = 0;
    let gameRunning = false;
    let obstacleInterval;
    
    function startGame() {
      console.log('[CUA-Demo] Game started!');
      container.classList.add('game-active');
      gameRunning = true;
      score = 0;
      playerX = 300;
      player.style.left = playerX + 'px';
      scoreEl.textContent = 'Score: 0';
      gameOverEl.style.display = 'none';
      
      // Clear existing obstacles
      document.querySelectorAll('.obstacle').forEach(o => o.remove());
      
      // Spawn obstacles
      obstacleInterval = setInterval(spawnObstacle, 1500);
      
      // Score counter
      setInterval(() => {
        if (gameRunning) {
          score++;
          scoreEl.textContent = 'Score: ' + score;
        }
      }, 100);
    }
    
    function spawnObstacle() {
      if (!gameRunning) return;
      
      const obstacle = document.createElement('div');
      obstacle.className = 'obstacle';
      obstacle.style.left = Math.random() * 550 + 'px';
      gameCanvas.appendChild(obstacle);
      
      obstacle.addEventListener('animationend', () => {
        obstacle.remove();
      });
      
      // Collision detection
      const checkCollision = setInterval(() => {
        if (!gameRunning) {
          clearInterval(checkCollision);
          return;
        }
        const pRect = player.getBoundingClientRect();
        const oRect = obstacle.getBoundingClientRect();
        
        if (pRect.left < oRect.right && pRect.right > oRect.left &&
            pRect.top < oRect.bottom && pRect.bottom > oRect.top) {
          endGame();
          clearInterval(checkCollision);
        }
      }, 50);
    }
    
    function endGame() {
      console.log('[CUA-Demo] Game over! Score:', score);
      gameRunning = false;
      clearInterval(obstacleInterval);
      finalScoreEl.textContent = score;
      gameOverEl.style.display = 'block';
    }
    
    function restartGame() {
      startGame();
    }
    
    // Controls
    document.addEventListener('keydown', (e) => {
      if (!gameRunning) return;
      if (e.key === 'ArrowLeft' || e.key === 'a') {
        playerX = Math.max(0, playerX - 30);
      } else if (e.key === 'ArrowRight' || e.key === 'd') {
        playerX = Math.min(540, playerX + 30);
      }
      player.style.left = playerX + 'px';
    });
    
    startBtn.addEventListener('click', startGame);
    restartBtn.addEventListener('click', restartGame);
    
    console.log('[CUA-Demo] Event listeners attached');
  </script>
</body>
</html>
`;

/**
 * GET /api/demo/prototype
 * Returns demo game HTML for CUA testing
 * No authentication required
 */
router.get('/prototype', (req, res) => {
    logger.info('[Demo] Serving demo prototype for CUA testing');
    res.json({
        success: true,
        data: {
            html: DEMO_GAME_HTML,
            name: 'Cyber-Drift Demo',
            description: 'Demo game for CUA (Computer Using Agent) testing',
            features: ['Start Game button', 'Keyboard controls', 'Score tracking', 'Game Over state'],
            testInstructions: [
                'Click the "Start Game" button',
                'Use arrow keys or A/D to move',
                'Avoid obstacles',
                'Check score updates',
                'Verify Game Over screen appears on collision'
            ]
        }
    });
});

/**
 * GET /api/demo/prototype/html
 * Returns raw HTML for iframe embedding
 * No authentication required
 */
router.get('/prototype/html', (req, res) => {
    logger.info('[Demo] Serving raw demo prototype HTML');
    res.setHeader('Content-Type', 'text/html');
    res.send(DEMO_GAME_HTML);
});

export default router;
