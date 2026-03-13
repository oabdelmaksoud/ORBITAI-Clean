/**
 * Game Prompt Builder
 * Specialized prompt construction for HTML5 canvas game generation
 * Extracted from enhancedPreviewGenerator.service.ts
 */

export interface GamePromptOptions {
    userGoal: string;
    playerFeatures: string[];
    requirements: string[];
    brainstormingContext?: unknown;
    targetPlatforms?: string[];
}

/**
 * Process features to remove dashboard terminology
 */
export function processGameFeatures(features: string[]): string[] {
    return features.map(f =>
        f.replace(/dashboard/gi, 'HUD overlay')
            .replace(/menu/gi, 'game mode')
            .replace(/settings/gi, 'configuration')
            .replace(/panel/gi, 'display')
    );
}

/**
 * Build ultra-strict canvas game prompt
 * Prioritizes playable mechanics over UI
 */
export function buildGamePrompt(options: GamePromptOptions): string {
    const { userGoal, playerFeatures, requirements, brainstormingContext } = options;

    const processedFeatures = processGameFeatures(playerFeatures);

    const featuresList = processedFeatures.length > 0
        ? processedFeatures.map((f, i) => `${i + 1}. ${f} → MUST be playable in-game mechanic with keyboard/mouse controls`).join('\n')
        : 'Basic game mechanics';

    const requirementsList = requirements.length > 0
        ? requirements.map((r, i) => `${i + 1}. ${r}`).join('\n')
        : 'No specific requirements';

    return `🚨 CRITICAL GAME GENERATION RULES 🚨

YOU ARE CREATING A PLAYABLE VIDEO GAME, NOT A WEB APPLICATION OR DASHBOARD.

════════════════════════════════════════════════════════════════════
⛔ ABSOLUTE PROHIBITIONS - ANY OF THESE = INSTANT REJECTION:
════════════════════════════════════════════════════════════════════
❌ NEVER create tab navigation UI (e.g., Dashboard tab, Powers tab, Combat tab)
❌ NEVER create button grids for selecting abilities or powers
❌ NEVER use React (no React.createElement, useState, useEffect, JSX)
❌ NEVER use Tailwind CSS (no bg-, text-, flex-, grid-, hover- classes)
❌ NEVER create settings menus, configuration panels, or admin interfaces
❌ NEVER create form inputs (text inputs, dropdowns, sliders) for game configuration
❌ NEVER create static stat displays without gameplay
❌ NEVER put game content inside a sidebar layout
❌ NEVER create clickable cards or buttons as the main interface
❌ NEVER use <div> as the main game container - USE <canvas>

IF YOU GENERATE ANY OF THE ABOVE, THE OUTPUT WILL BE COMPLETELY REJECTED.

════════════════════════════════════════════════════════════════════
✅ MANDATORY REQUIREMENTS - MUST HAVE ALL OF THESE:
════════════════════════════════════════════════════════════════════
✅ HTML5 <canvas> element as the VERY FIRST element inside <body>
✅ Canvas dimensions: minimum 800x600px, ideally fullscreen
✅ Vanilla JavaScript ONLY (NO frameworks, NO React, NO libraries except maybe Three.js for 3D)
✅ requestAnimationFrame game loop running at 60 FPS
✅ WASD/Arrow key event listeners attached on page load
✅ BOTH 'w'/'a'/'s'/'d' AND 'ArrowUp'/'ArrowLeft'/'ArrowDown'/'ArrowRight' MUST work
✅ Support both lowercase (keys['w']) AND uppercase (keys['W']) for WASD
✅ Visible player character/entity drawn on canvas (rectangle, circle, sprite, or 3D model)
✅ Player responds to keyboard input - move when WASD OR Arrow keys pressed
✅ Player CANNOT escape canvas bounds - strict boundary collision required
✅ Game physics: velocity, acceleration, collision with canvas boundaries
✅ At least one type of enemy, obstacle, or interactive object
✅ Collision detection between player and enemies/objects
✅ Score system that increases based on gameplay actions
✅ Health/lives system with game over condition
✅ Game state flow: START → PLAYING → GAME_OVER → RESTART
✅ Visual feedback: particles, color changes, animations
✅ Audio feedback: sound effects for jumps, collisions, collectibles, game over
✅ Programmatic sound generation using Web Audio API (no external files required)

════════════════════════════════════════════════════════════════════
📖 HOW TO INTERPRET FEATURES AS GAMEPLAY MECHANICS:
════════════════════════════════════════════════════════════════════
When you see a feature like "Heat Vision" or "Flight", implement it as:

❌ WRONG: Create a button labeled "Heat Vision" that does nothing
❌ WRONG: Create a "Powers" tab with a list of abilities
❌ WRONG: Create a slider to configure heat vision intensity

✅ CORRECT: Add a key press (e.g., SPACEBAR) that shoots red projectiles from player
✅ CORRECT: Draw projectile sprites on canvas, move them via game loop
✅ CORRECT: Detect collision with enemies, reduce enemy health, show explosion effect
✅ CORRECT: Add cooldown timer (10 seconds), display as progress bar on HUD

FEATURE TRANSLATION EXAMPLES:
- "Flight" → Player can move vertically, add gravity/thrust physics
- "Combat" → Collision detection with enemies causes damage
- "Powers" → Key bindings for special abilities (Q, E, R keys)
- "Dashboard" → HUD overlay showing score, health, ammo (NOT a separate tab)

════════════════════════════════════════════════════════════════════
🎮 PROJECT-SPECIFIC FEATURES TO IMPLEMENT:
════════════════════════════════════════════════════════════════════
${featuresList}

════════════════════════════════════════════════════════════════════
📋 REQUIREMENTS:
════════════════════════════════════════════════════════════════════
${requirementsList}

${brainstormingContext ? `
════════════════════════════════════════════════════════════════════
💡 BRAINSTORMED IDEAS (Implement as gameplay):
════════════════════════════════════════════════════════════════════
${formatBrainstormingForGame(brainstormingContext)}
` : ''}

════════════════════════════════════════════════════════════════════
🎯 GAME GOAL: ${userGoal}
════════════════════════════════════════════════════════════════════

Output a COMPLETE, PLAYABLE HTML5 canvas game. Start with <!DOCTYPE html>:`;
}

/**
 * Format brainstorming context for game prompts
 */
function formatBrainstormingForGame(context: unknown): string {
    if (!context || typeof context !== 'object') return '';

    const ctx = context as Record<string, unknown>;
    const ideas = ctx.ideas as Array<{ label: string; description?: string }> | undefined;

    if (!ideas || !Array.isArray(ideas)) return '';

    return ideas
        .filter(idea => idea.label)
        .map(idea => `- ${idea.label}${idea.description ? `: ${idea.description}` : ''}`)
        .join('\n');
}

/**
 * Game validation checks - detect forbidden patterns
 */
export interface GameValidationResult {
    isValid: boolean;
    dashboardPatterns: string[];
    missingElements: string[];
}

export function validateGameOutput(html: string): GameValidationResult {
    const dashboardPatterns: string[] = [];
    const missingElements: string[] = [];

    // Check for forbidden dashboard patterns
    const hasReact = html.includes('React.') ||
        html.includes('useState') ||
        html.includes('useEffect') ||
        html.includes('ReactDOM.');
    if (hasReact) dashboardPatterns.push('React framework detected');

    const tailwindMatches = (html.match(/class="[^"]*\b(bg-|text-|flex-|grid-|hover:)/g) || []).length;
    if (tailwindMatches > 15) dashboardPatterns.push(`Excessive Tailwind usage (${tailwindMatches} instances)`);

    const hasTabs = html.includes('role="tablist"') ||
        html.includes('data-tab') ||
        /\<button[^>]*\>(?:Dashboard|Powers|Combat|Settings|Missions)/i.test(html);
    if (hasTabs) dashboardPatterns.push('Tab navigation UI detected');

    const buttonCount = (html.match(/\<button/g) || []).length;
    if (buttonCount > 12) dashboardPatterns.push(`Button grid detected (${buttonCount} buttons)`);

    const hasFormInputs = (html.match(/\<input|\<select|\<textarea/g) || []).length > 2;
    if (hasFormInputs) dashboardPatterns.push('Form inputs detected (configuration UI)');

    // Check for required game elements
    const hasCanvas = html.includes('<canvas');
    const hasGameLoop = html.includes('requestAnimationFrame');
    const hasKeyboard = html.includes('keydown') || html.includes('addEventListener');

    if (!hasCanvas) missingElements.push('canvas element');
    if (!hasGameLoop) missingElements.push('requestAnimationFrame game loop');
    if (!hasKeyboard) missingElements.push('keyboard controls');

    return {
        isValid: dashboardPatterns.length === 0 && missingElements.length === 0,
        dashboardPatterns,
        missingElements
    };
}

/**
 * Get game-specific system instruction
 */
export function getGameSystemInstruction(usePhaser: boolean = false): string {
    if (usePhaser) {
        return 'You are an expert Phaser 3 game developer. Output ONLY complete playable Phaser games with physics and sprites, NOT menu interfaces. Focus on GAMEPLAY FIRST. Start with <!DOCTYPE html>.';
    }
    return 'You are an expert HTML5 game developer. Output ONLY complete playable canvas games with game loops, NOT menu interfaces or button grids. Focus on GAMEPLAY FIRST. Start with <!DOCTYPE html>.';
}
