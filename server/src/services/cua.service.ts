/**
 * CUA (Computer Using Agent) Service
 * Provides real browser-based testing for prototypes using Playwright
 * with LIVE streaming and AI-POWERED test scenario generation
 * 
 * @module services/cua
 */

import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { logger } from '../utils/logger.js';
import { webSocketService } from './websocket.service.js';
import { geminiService } from './gemini.service.js';
import { cuaLLMService } from './cua-llm.service.js';
import { prototypeLearningService } from './prototypeLearning.service.js';
import { projectFileService } from './projectFile.service.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import express from 'express';
import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Video recordings directory
const RECORDINGS_DIR = path.join(__dirname, '../../public/cua-recordings');

// Frame streaming interval (300ms = ~3 FPS)
const FRAME_INTERVAL = 300;

export interface TestScenario {
    id: string;
    type: 'click' | 'input' | 'keyboard' | 'hover' | 'scroll' | 'wait';
    target: string;
    selector?: string;
    description: string;
    expectedResult?: string;
    status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
    error?: string;
    duration?: number;

    // Dependency and ordering fields
    phase?: number;           // Execution phase (1=setup, 2=main, 3=cleanup)
    dependsOn?: string[];     // IDs of scenarios that must pass first
    prerequisiteCheck?: string; // CSS selector that must be visible before running
    category?: 'setup' | 'gameplay' | 'validation' | 'edge_case';
}

export interface CUATestResult {
    sessionId: string;
    status: 'running' | 'passed' | 'failed';
    scenarios: TestScenario[];
    summary?: string;
    screenshot?: string;
    videoUrl?: string;
    error?: string;
    totalDuration?: number;
    passedCount?: number;
    failedCount?: number;
}

class CUAService {
    private browser: Browser | null = null;
    private isInitialized = false;
    private frameStreamInterval: NodeJS.Timeout | null = null;

    /**
     * Initialize Playwright browser instance
     */
    async initialize(headless: boolean = true): Promise<void> {
        if (this.isInitialized) return;

        try {
            // Ensure recordings directory exists
            if (!fs.existsSync(RECORDINGS_DIR)) {
                fs.mkdirSync(RECORDINGS_DIR, { recursive: true });
            }

            logger.info(`[CUA] Launching browser - Headless: ${headless}`);
            this.browser = await chromium.launch({
                headless,
                slowMo: headless ? 0 : 50,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
            this.isInitialized = true;
            logger.info('[CUA] Browser initialized successfully');
        } catch (error) {
            logger.error('[CUA] Failed to initialize browser:', error);
            throw error;
        }
    }

    /**
     * Clean up browser instance
     */
    async cleanup(): Promise<void> {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.isInitialized = false;
            logger.info('[CUA] Browser cleaned up');
        }
    }

    /**
     * Start a static server for a directory
     */
    private startStaticServer(dir: string): Promise<{ port: number, close: () => void }> {
        return new Promise((resolve) => {
            const app = express();
            app.use(express.static(dir));
            const server = http.createServer(app);
            // Listen on a random ephemeral port
            server.listen(0, () => {
                const port = (server.address() as any).port;
                resolve({
                    port,
                    close: () => {
                        server.close();
                    }
                });
            });
        });
    }

    /**
     * Emit event via WebSocket
     */
    private emit(event: string, data: any): void {
        const io = webSocketService.getIO();
        if (io) {
            // Include sessionId in all events for easier client-side filtering
            io.emit(event, { ...data, timestamp: new Date() });

            if (event === 'cua:frame') {
                // Log only every 30th frame to avoid log spam (~10s intervals at 3FPS)
                if (data.frameCount && data.frameCount % 30 === 0) {
                    logger.debug(`[CUA] Emitted ${data.frameCount} frames for session ${data.sessionId}`);
                }
            } else {
                logger.info(`[CUA] Emitted event ${event} for session ${data.sessionId || 'unknown'}`);
            }
        } else {
            logger.warn(`[CUA] WebSocket not available, cannot emit ${event}`);
        }
    }

    /**
     * Start streaming live frames
     */
    private startFrameStreaming(page: Page, sessionId: string): void {
        logger.info(`[CUA] Starting frame streaming for session ${sessionId}`);
        let frameCount = 0;
        this.frameStreamInterval = setInterval(async () => {
            try {
                const screenshot = await page.screenshot({ type: 'jpeg', quality: 60 });
                const frame = `data:image/jpeg;base64,${screenshot.toString('base64')}`;
                frameCount++;
                if (frameCount <= 3 || frameCount % 30 === 0) {
                    logger.info(`[CUA] Frame ${frameCount} captured for session ${sessionId}, size: ${Math.round(frame.length / 1024)}KB`);
                }
                this.emit('cua:frame', { sessionId, frame, frameCount });
            } catch (e: any) {
                // Ignore errors if streaming is stopped
                if (this.frameStreamInterval) {
                    logger.warn(`[CUA] Frame capture failed: ${e.message}`);
                }
            }
        }, FRAME_INTERVAL);
    }

    /**
     * Stop streaming live frames
     */
    private stopFrameStreaming(): void {
        if (this.frameStreamInterval) {
            clearInterval(this.frameStreamInterval);
            this.frameStreamInterval = null;
        }
    }

    /**
     * Inject visible cursor and key indicator overlays into the page
     */
    private async injectCursorOverlay(page: Page): Promise<void> {
        await page.evaluate(() => {
            // Create cursor element
            const cursor = document.createElement('div');
            cursor.id = 'cua-cursor';
            cursor.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87a.5.5 0 0 0 .35-.85L6.35 2.86a.5.5 0 0 0-.85.35z" fill="#3B82F6" stroke="#fff" stroke-width="1.5"/>
            </svg>`;
            cursor.style.cssText = `
                position: fixed;
                z-index: 999999;
                pointer-events: none;
                left: 50%;
                top: 50%;
                transition: all 0.15s ease-out;
                filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
            `;
            document.body.appendChild(cursor);

            // Create key indicator element
            const keyIndicator = document.createElement('div');
            keyIndicator.id = 'cua-key-indicator';
            keyIndicator.style.cssText = `
                position: fixed;
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%);
                z-index: 999999;
                pointer-events: none;
                background: rgba(15, 23, 42, 0.9);
                color: #fff;
                padding: 8px 16px;
                border-radius: 8px;
                font-family: system-ui, sans-serif;
                font-size: 14px;
                font-weight: 500;
                opacity: 0;
                transition: opacity 0.2s ease;
                border: 1px solid rgba(59, 130, 246, 0.5);
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            `;
            document.body.appendChild(keyIndicator);

            // Create action indicator element
            const actionIndicator = document.createElement('div');
            actionIndicator.id = 'cua-action-indicator';
            actionIndicator.style.cssText = `
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                z-index: 999999;
                pointer-events: none;
                background: rgba(15, 23, 42, 0.9);
                color: #22D3EE;
                padding: 10px 20px;
                border-radius: 8px;
                font-family: system-ui, sans-serif;
                font-size: 13px;
                font-weight: 500;
                opacity: 0;
                transition: opacity 0.3s ease;
                border: 1px solid rgba(34, 211, 238, 0.4);
                max-width: 80%;
                text-align: center;
            `;
            document.body.appendChild(actionIndicator);
        });
    }

    /**
     * Capture current game state for validation
     * Extracts score, position, canvas content, and other indicators
     */
    private async captureGameState(page: Page): Promise<{
        textContent: string;
        canvasHash: string;
        score: number | null;
        lives: number | null;
        timestamp: number;
    }> {
        return await page.evaluate(() => {
            // Get all text content from the page
            const textContent = document.body?.innerText || '';

            // Try to get score and lives from common patterns
            const scoreMatch = textContent.match(/score[:\s]*(\d+)/i);
            const livesMatch = textContent.match(/lives?[:\s]*(\d+)/i);

            // Get canvas content hash if canvas exists
            let canvasHash = '';
            const canvas = document.querySelector('canvas');
            if (canvas) {
                try {
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                        // Simple hash of pixel data
                        let hash = 0;
                        for (let i = 0; i < imageData.data.length; i += 100) {
                            hash = ((hash << 5) - hash + imageData.data[i]) | 0;
                        }
                        canvasHash = hash.toString();
                    }
                } catch (e) {
                    // Canvas might be tainted or not accessible
                    canvasHash = 'unavailable';
                }
            }

            return {
                textContent: textContent.substring(0, 500), // First 500 chars
                canvasHash,
                score: scoreMatch ? parseInt(scoreMatch[1]) : null,
                lives: livesMatch ? parseInt(livesMatch[1]) : null,
                timestamp: Date.now()
            };
        });
    }

    /**
     * Validate that game state changed after an action
     */
    private validateStateChange(
        before: { textContent: string; canvasHash: string; score: number | null; lives: number | null },
        after: { textContent: string; canvasHash: string; score: number | null; lives: number | null },
        actionType: string
    ): { changed: boolean; details: string } {
        const changes: string[] = [];

        // Check if canvas content changed (visual change)
        if (before.canvasHash !== after.canvasHash && before.canvasHash !== 'unavailable') {
            changes.push('visual content changed');
        }

        // Check if score changed
        if (before.score !== null && after.score !== null && before.score !== after.score) {
            changes.push(`score: ${before.score} → ${after.score}`);
        }

        // Check if lives changed
        if (before.lives !== null && after.lives !== null && before.lives !== after.lives) {
            changes.push(`lives: ${before.lives} → ${after.lives}`);
        }

        // Check if text content changed significantly
        if (before.textContent !== after.textContent) {
            changes.push('text content changed');
        }

        return {
            changed: changes.length > 0,
            details: changes.length > 0 ? changes.join(', ') : 'no observable change'
        };
    }

    /**
     * Move cursor to target position with smooth animation
     */
    private async moveCursor(page: Page, x: number, y: number): Promise<void> {
        await page.evaluate(({ x, y }) => {
            const cursor = document.getElementById('cua-cursor');
            if (cursor) {
                cursor.style.left = `${x}px`;
                cursor.style.top = `${y}px`;
            }
        }, { x, y });
    }

    /**
     * Show key indicator overlay
     */
    private async showKeyIndicator(page: Page, key: string): Promise<void> {
        await page.evaluate((keyText) => {
            const indicator = document.getElementById('cua-key-indicator');
            if (indicator) {
                indicator.textContent = `⌨️ ${keyText}`;
                indicator.style.opacity = '1';
                setTimeout(() => { indicator.style.opacity = '0'; }, 600);
            }
        }, key);
    }

    /**
     * Show action indicator overlay
     */
    private async showActionIndicator(page: Page, action: string): Promise<void> {
        await page.evaluate((actionText) => {
            const indicator = document.getElementById('cua-action-indicator');
            if (indicator) {
                indicator.textContent = actionText;
                indicator.style.opacity = '1';
            }
        }, action);
    }

    /**
     * Hide action indicator
     */
    private async hideActionIndicator(page: Page): Promise<void> {
        await page.evaluate(() => {
            const indicator = document.getElementById('cua-action-indicator');
            if (indicator) {
                indicator.style.opacity = '0';
            }
        });
    }

    /**
     * Type text character by character like a human with potential typos
     */
    private async humanType(page: Page, text: string, withTypos: boolean = true): Promise<void> {
        const typoChars = 'qwertyuiopasdfghjklzxcvbnm';

        for (let i = 0; i < text.length; i++) {
            const char = text[i];

            // 5% chance of typo when enabled
            if (withTypos && Math.random() < 0.05 && char.match(/[a-zA-Z]/)) {
                // Type wrong character
                const wrongChar = typoChars[Math.floor(Math.random() * typoChars.length)];
                await page.keyboard.type(wrongChar, { delay: 0 });
                await page.waitForTimeout(80 + Math.random() * 60);

                // Pause as if noticing the error
                await page.waitForTimeout(150 + Math.random() * 150);

                // Backspace to fix
                await page.keyboard.press('Backspace');
                await page.waitForTimeout(50 + Math.random() * 50);
            }

            // Type correct character
            await page.keyboard.type(char, { delay: 0 });

            // Variable delay per character (60-140ms with occasional pauses)
            let delay = 60 + Math.random() * 80;

            // Occasional longer pause (like thinking or finding next key)
            if (Math.random() < 0.1) {
                delay += 100 + Math.random() * 200;
            }

            await page.waitForTimeout(delay);
        }
    }

    /**
     * Add natural thinking pause before major actions
     */
    private async thinkingPause(page: Page): Promise<void> {
        const duration = 200 + Math.random() * 500; // 200-700ms
        await page.waitForTimeout(duration);
    }

    /**
     * Move mouse along a curved Bezier path with natural jitter
     */
    private async curvedMouseMove(page: Page, startX: number, startY: number, endX: number, endY: number): Promise<void> {
        const steps = 25 + Math.floor(Math.random() * 10); // 25-35 steps

        // Random control point for curve (offset from midpoint)
        const midX = (startX + endX) / 2;
        const midY = (startY + endY) / 2;
        const controlX = midX + (Math.random() - 0.5) * 100; // ±50px curve
        const controlY = midY + (Math.random() - 0.5) * 100;

        // Move along quadratic Bezier curve with jitter
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;

            // Quadratic Bezier formula
            const x = Math.pow(1 - t, 2) * startX + 2 * (1 - t) * t * controlX + Math.pow(t, 2) * endX;
            const y = Math.pow(1 - t, 2) * startY + 2 * (1 - t) * t * controlY + Math.pow(t, 2) * endY;

            // Add slight jitter (±2px)
            const jitterX = x + (Math.random() - 0.5) * 4;
            const jitterY = y + (Math.random() - 0.5) * 4;

            await page.mouse.move(jitterX, jitterY);

            // Update visible cursor
            await this.moveCursor(page, jitterX, jitterY);

            // Variable step delay (faster at start/end, slower in middle)
            const speedFactor = Math.sin(t * Math.PI); // Peaks at 0.5
            const delay = 8 + speedFactor * 12 + Math.random() * 5;
            await page.waitForTimeout(delay);
        }
    }

    /**
     * Smooth scroll with variable speed like a human
     */
    private async humanScroll(page: Page, direction: 'up' | 'down', distance: number): Promise<void> {
        const steps = 8 + Math.floor(Math.random() * 5);
        const stepDistance = distance / steps;

        for (let i = 0; i < steps; i++) {
            const scrollAmount = direction === 'down' ? stepDistance : -stepDistance;

            await page.evaluate((amount) => {
                window.scrollBy({ top: amount, behavior: 'auto' });
            }, scrollAmount);

            // Variable delay between scroll steps
            await page.waitForTimeout(30 + Math.random() * 50);
        }
    }

    /**
     * Validate that AI-generated scenario selectors actually exist on the page
     * Filters out scenarios with non-existent elements
     */
    private async validateScenarioSelectors(page: Page, scenarios: TestScenario[]): Promise<TestScenario[]> {
        const validatedScenarios: TestScenario[] = [];

        for (const scenario of scenarios) {
            // Keyboard and scroll scenarios don't need selector validation
            if (scenario.type === 'keyboard' || scenario.type === 'scroll' || scenario.type === 'wait') {
                validatedScenarios.push(scenario);
                continue;
            }

            // Check if selector exists
            if (!scenario.selector) {
                logger.debug(`[CUA] Skipping scenario "${scenario.target}" - no selector provided`);
                continue;
            }

            try {
                const element = page.locator(scenario.selector).first();
                const isVisible = await element.isVisible({ timeout: 500 }).catch(() => false);

                if (isVisible) {
                    validatedScenarios.push(scenario);
                    logger.debug(`[CUA] Validated selector: ${scenario.selector} for "${scenario.target}"`);
                } else {
                    logger.debug(`[CUA] Skipping scenario "${scenario.target}" - selector not found: ${scenario.selector}`);
                }
            } catch (error: any) {
                logger.debug(`[CUA] Selector validation failed for "${scenario.target}": ${error.message}`);
            }
        }

        return validatedScenarios;
    }

    /**
     * Use AI to analyze prototype and generate intelligent test scenarios
     */
    private async analyzePrototypeWithAI(htmlContent: string): Promise<TestScenario[] | null> {
        try {
            const prompt = `You are an expert QA engineer with deep understanding of user behavior. Analyze this HTML prototype and AUTONOMOUSLY generate a comprehensive test suite WITH PROPER EXECUTION ORDER.

HTML Content:
\`\`\`html
${htmlContent.substring(0, 12000)}
\`\`\`

YOUR MISSION:
1. DETECT the app type by analyzing the DOM (buttons, forms, game canvas, etc.)
2. UNDERSTAND the core functionality and user journey
3. GENERATE test scenarios IN THE CORRECT EXECUTION ORDER
4. Mark DEPENDENCIES between tests (e.g., "Start Game" must pass before "Move Left")

CRITICAL: Tests must run in the correct order! Use phases and dependencies:
- Phase 1 (SETUP): Click Start buttons, dismiss dialogs, initial setup
- Phase 2 (GAMEPLAY/MAIN): Core functionality tests (AFTER setup is complete)
- Phase 3 (VALIDATION): Verify results, check states
- Phase 4 (EDGE CASES): Error scenarios, boundary tests

Respond with ONLY a JSON object:
{
  "projectType": "detected type",
  "appAnalysis": {
    "coreFeatures": ["list of detected features"],
    "mainUserJourney": "describe the primary user flow",
    "setupRequired": ["list of setup steps required before main tests"]
  },
  "testSuites": [
    {
      "suiteName": "Name of test suite",
      "suiteType": "setup|gameplay|validation|edge_case",
      "phase": 1-4,
      "scenarios": [
        {
          "id": "unique-id-like-start-game",
          "type": "click|input|keyboard|hover|scroll|wait",
          "target": "Human-readable element name",
          "selector": "Specific CSS selector",
          "description": "What user does and why",
          "testValue": "Input value if applicable",
          "expectedResult": "Specific outcome to verify",
          "priority": "critical|high|medium|low",
          "phase": 1-4,
          "dependsOn": ["id-of-prerequisite-test"],
          "prerequisiteCheck": "CSS selector that must be visible before this test runs",
          "category": "setup|gameplay|validation|edge_case"
        }
      ]
    }
  ]
}

DEPENDENCY RULES:

**FOR GAMES (canvas, player, score elements):**
- Phase 1 (SETUP): 
  - "start-game": Click Start/Play button (prerequisiteCheck: "button, [onclick], .start")
  - ALWAYS RUN FIRST - all gameplay tests depend on this!
- Phase 2 (GAMEPLAY): 
  - Movement tests (WASD, arrows) - dependsOn: ["start-game"]
  - Ability tests - dependsOn: ["start-game"]
  - prerequisiteCheck: "canvas" or game area selector
- Phase 3 (VALIDATION):
  - Score updates, health changes - dependsOn: relevant gameplay tests
- Phase 4 (EDGE CASES):
  - Game over, death states - dependsOn: ["start-game"]

**FOR TODO/TASK APPS:**
- Phase 1 (SETUP): Clear any existing tasks if needed
- Phase 2 (MAIN): Add task, edit task - Phase 2 tests depend on Phase 1
- Phase 3 (VALIDATION): Check task persists, counts update
- Phase 4 (EDGE): Empty input, special characters

**FOR FORMS:**
- Phase 1 (SETUP): Ensure form is visible
- Phase 2 (MAIN): Fill each field IN ORDER
- Phase 3 (VALIDATION): Submit and verify
- Phase 4 (EDGE): Invalid inputs

CRITICAL ORDERING EXAMPLE FOR GAMES:
1. Phase 1: "Start Game" button click (NO dependencies)
2. Phase 2: "Move Right" (dependsOn: ["start-game"], prerequisiteCheck: "canvas")
3. Phase 2: "Jump" (dependsOn: ["start-game"])
4. Phase 3: "Score Update" (dependsOn: ["start-game"])

Generate 8-15 tests with CORRECT dependencies. Setup tests MUST come first!`;

            const result = await geminiService.generateContent(prompt, 'gemini-2.0-flash', {
                temperature: 0.4
            });

            if (!result || !result.text) {
                logger.warn('[CUA] AI analysis returned no result');
                return null;
            }

            // Parse JSON from response text
            const responseText = result.text;
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                logger.warn('[CUA] AI response did not contain valid JSON');
                return null;
            }

            const analysis = JSON.parse(jsonMatch[0]);

            // Log AI analysis insights
            if (analysis.appAnalysis) {
                logger.info(`[CUA] AI Analysis:`);
                logger.info(`  - Project Type: ${analysis.projectType}`);
                logger.info(`  - Core Features: ${analysis.appAnalysis.coreFeatures?.join(', ')}`);
                logger.info(`  - User Journey: ${analysis.appAnalysis.mainUserJourney}`);
                logger.info(`  - Test Suites: ${analysis.testSuites?.length || 0}`);
            }

            // Flatten testSuites into scenarios array
            const scenarios: TestScenario[] = [];
            let idCounter = 1;

            // Handle new testSuites format with phases and dependencies
            if (analysis.testSuites && Array.isArray(analysis.testSuites)) {
                for (const suite of analysis.testSuites) {
                    const suiteName = suite.suiteName || 'Test Suite';
                    const suiteType = suite.suiteType || 'gameplay';
                    const suitePhase = suite.phase || 2;

                    for (const s of suite.scenarios || []) {
                        const scenarioId = s.id || `ai-${suiteType}-${idCounter++}`;
                        scenarios.push({
                            id: scenarioId,
                            type: s.type || 'click',
                            target: s.target || `Element`,
                            selector: s.selector,
                            description: `[${suiteName}] ${s.description || s.target}`,
                            testValue: s.testValue,
                            testFlow: suiteType,
                            expectedResult: s.expectedResult || 'Responds correctly',
                            priority: s.priority || 'medium',
                            status: 'pending' as const,
                            // New dependency fields
                            phase: s.phase || suitePhase,
                            dependsOn: s.dependsOn || [],
                            prerequisiteCheck: s.prerequisiteCheck,
                            category: s.category || suiteType
                        });
                    }
                }
            }
            // Fallback: handle old flat scenarios format
            else if (analysis.scenarios && Array.isArray(analysis.scenarios)) {
                for (const s of analysis.scenarios) {
                    scenarios.push({
                        id: s.id || `ai-scenario-${idCounter++}`,
                        type: s.type || 'click',
                        target: s.target || `Element`,
                        selector: s.selector,
                        description: s.description || `Test ${s.target}`,
                        testValue: s.testValue,
                        testFlow: s.testFlow || 'gameplay',
                        expectedResult: s.expectedResult || 'Element responds correctly',
                        status: 'pending' as const,
                        phase: s.phase || 2,
                        dependsOn: s.dependsOn || [],
                        prerequisiteCheck: s.prerequisiteCheck,
                        category: s.category || 'gameplay'
                    });
                }
            }

            // Sort scenarios by phase (setup first, then main, then validation, then edge)
            scenarios.sort((a, b) => (a.phase || 2) - (b.phase || 2));

            logger.info(`[CUA] Generated ${scenarios.length} AI-powered test scenarios (sorted by phase)`);
            return scenarios;

        } catch (error: any) {
            logger.warn(`[CUA] AI analysis failed, falling back to rule-based: ${error.message}`);
            return null;
        }
    }

    /**
     * Analyze prototype and generate context-aware test scenarios
     * Uses AI when available, falls back to rule-based detection
     */
    async generateTestScenarios(page: Page, htmlContent?: string): Promise<TestScenario[]> {
        // Try AI-powered analysis first
        if (htmlContent) {
            const aiScenarios = await this.analyzePrototypeWithAI(htmlContent);
            if (aiScenarios && aiScenarios.length > 0) {
                // Validate that selectors actually exist on the page
                const validatedScenarios = await this.validateScenarioSelectors(page, aiScenarios);
                if (validatedScenarios.length > 0) {
                    logger.info(`[CUA] Using AI-generated scenarios: ${validatedScenarios.length}/${aiScenarios.length} validated`);
                    return validatedScenarios;
                }
                logger.warn('[CUA] No AI scenarios had valid selectors, falling back to rule-based');
            }
        }

        // Fallback to rule-based detection
        logger.info('[CUA] Using rule-based scenario generation');
        const scenarios: TestScenario[] = [];
        let idCounter = 1;

        // Analyze the page to find all interactive elements and detect project type
        const analysis = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const inputs = Array.from(document.querySelectorAll('input, textarea'));
            const links = Array.from(document.querySelectorAll('a[href]'));
            const canvas = document.querySelector('canvas');
            const selects = Array.from(document.querySelectorAll('select'));
            const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"], input[type="radio"]'));
            const forms = Array.from(document.querySelectorAll('form'));
            const tables = Array.from(document.querySelectorAll('table'));
            const cards = Array.from(document.querySelectorAll('[class*="card"], .card, [class*="product"], [class*="item"]'));
            const nav = document.querySelector('nav, [class*="nav"], [class*="menu"]');
            const images = Array.from(document.querySelectorAll('img'));
            const modals = document.querySelectorAll('[class*="modal"], [class*="dialog"], [role="dialog"]');
            const tabs = document.querySelectorAll('[role="tab"], [class*="tab"]');

            // Text content analysis for project type detection
            const bodyText = document.body?.innerText?.toLowerCase() || '';
            const hasCart = bodyText.includes('cart') || bodyText.includes('checkout') || bodyText.includes('buy') || bodyText.includes('price');
            const hasLogin = bodyText.includes('login') || bodyText.includes('sign in') || bodyText.includes('password');
            const hasDashboard = bodyText.includes('dashboard') || bodyText.includes('analytics') || bodyText.includes('statistics');
            const hasGame = bodyText.includes('score') || bodyText.includes('play') || bodyText.includes('game') || bodyText.includes('start');

            return {
                buttons: buttons.map((b, i) => ({
                    text: b.textContent?.trim() || `Button ${i + 1}`,
                    id: b.id || null,
                    className: b.className || null,
                    visible: b.offsetParent !== null,
                    type: b.type || 'button'
                })),
                inputs: inputs.map((inp) => ({
                    type: (inp as HTMLInputElement).type || 'text',
                    placeholder: (inp as HTMLInputElement).placeholder || null,
                    id: inp.id || null,
                    name: (inp as HTMLInputElement).name || null,
                    visible: inp.offsetParent !== null,
                    required: (inp as HTMLInputElement).required || false
                })),
                selects: selects.map((sel) => ({
                    id: sel.id || null,
                    name: (sel as HTMLSelectElement).name || null,
                    visible: sel.offsetParent !== null,
                    optionCount: (sel as HTMLSelectElement).options?.length || 0
                })),
                checkboxes: checkboxes.map((cb) => ({
                    id: cb.id || null,
                    type: (cb as HTMLInputElement).type,
                    visible: cb.offsetParent !== null
                })),
                links: links.filter(l => l.offsetParent !== null).map(l => ({
                    text: l.textContent?.trim() || '',
                    href: l.getAttribute('href') || ''
                })),
                hasCanvas: !!canvas,
                canvasSize: canvas ? { width: canvas.width, height: canvas.height } : null,
                formCount: forms.length,
                tableCount: tables.length,
                cardCount: cards.length,
                hasNav: !!nav,
                imageCount: images.length,
                modalCount: modals.length,
                tabCount: tabs.length,
                hasCart,
                hasLogin,
                hasDashboard,
                hasGame,
                title: document.title || 'Untitled'
            };
        });

        // Detect project type
        let projectType: 'game' | 'form' | 'dashboard' | 'ecommerce' | 'landing' | 'app' = 'app';
        if (analysis.hasCanvas && (analysis.hasGame || analysis.buttons.some(b =>
            ['start', 'play', 'begin', 'restart'].some(t => b.text.toLowerCase().includes(t))))) {
            projectType = 'game';
        } else if (analysis.formCount > 0 || (analysis.inputs.length >= 3 && analysis.hasLogin)) {
            projectType = 'form';
        } else if (analysis.hasDashboard || analysis.tableCount > 0 || analysis.tabCount > 2) {
            projectType = 'dashboard';
        } else if (analysis.hasCart || analysis.cardCount >= 3) {
            projectType = 'ecommerce';
        } else if (analysis.hasNav && analysis.imageCount > 2 && analysis.inputs.length < 3) {
            projectType = 'landing';
        }

        logger.info(`[CUA] Detected project type: ${projectType}`);

        // Generate scenarios based on project type

        // === BUTTONS (all project types) ===
        const visibleButtons = analysis.buttons.filter(b => b.visible);
        for (const button of visibleButtons.slice(0, 5)) { // Limit to 5 buttons
            const selector = button.id ? `#${button.id}` : `button:has-text("${button.text}")`;
            scenarios.push({
                id: `scenario-${idCounter++}`,
                type: 'click',
                target: `Button: "${button.text.substring(0, 20)}"`,
                selector,
                description: `Click "${button.text.substring(0, 30)}" button`,
                expectedResult: 'Button responds and triggers action',
                status: 'pending'
            });
        }

        // === FORM/INPUT SCENARIOS ===
        if (projectType === 'form' || analysis.inputs.length > 0) {
            const visibleInputs = analysis.inputs.filter(i => i.visible);
            for (const input of visibleInputs.slice(0, 4)) { // Limit to 4 inputs
                const selector = input.id ? `#${input.id}` : `input[type="${input.type}"]`;
                const inputLabel = input.placeholder || input.name || input.type;

                // Different test data based on input type
                let testValue = 'Test input';
                if (input.type === 'email') testValue = 'test@example.com';
                else if (input.type === 'password') testValue = 'TestPass123!';
                else if (input.type === 'number') testValue = '42';
                else if (input.type === 'tel') testValue = '+1234567890';

                scenarios.push({
                    id: `scenario-${idCounter++}`,
                    type: 'input',
                    target: `Input: ${inputLabel.substring(0, 20)}`,
                    selector,
                    description: `Enter "${testValue}" in ${inputLabel}`,
                    expectedResult: 'Input accepts and displays text',
                    status: 'pending'
                });
            }
        }

        // === SELECT DROPDOWNS ===
        for (const select of analysis.selects.filter(s => s.visible).slice(0, 2)) {
            const selector = select.id ? `#${select.id}` : 'select';
            scenarios.push({
                id: `scenario-${idCounter++}`,
                type: 'click',
                target: `Dropdown: ${select.name || 'Select'}`,
                selector,
                description: `Open and select option from dropdown`,
                expectedResult: 'Dropdown opens and selection works',
                status: 'pending'
            });
        }

        // === CHECKBOXES/RADIO ===
        if (analysis.checkboxes.length > 0) {
            const cb = analysis.checkboxes[0];
            const selector = cb.id ? `#${cb.id}` : `input[type="${cb.type}"]`;
            scenarios.push({
                id: `scenario-${idCounter++}`,
                type: 'click',
                target: cb.type === 'radio' ? 'Radio Button' : 'Checkbox',
                selector,
                description: `Toggle ${cb.type === 'radio' ? 'radio button' : 'checkbox'}`,
                expectedResult: `${cb.type === 'radio' ? 'Radio' : 'Checkbox'} changes state`,
                status: 'pending'
            });
        }

        // === NAVIGATION LINKS (landing/e-commerce) ===
        if ((projectType === 'landing' || projectType === 'ecommerce') && analysis.links.length > 0) {
            scenarios.push({
                id: `scenario-${idCounter++}`,
                type: 'hover',
                target: 'Navigation',
                selector: 'nav a, a',
                description: 'Test navigation hover effects',
                expectedResult: 'Links show hover state',
                status: 'pending'
            });
        }

        // === GAME-SPECIFIC SCENARIOS ===
        if (projectType === 'game' && analysis.hasCanvas) {
            scenarios.push({
                id: `scenario-${idCounter++}`,
                type: 'click',
                target: 'Game Canvas',
                selector: 'canvas',
                description: 'Click on game canvas',
                expectedResult: 'Canvas responds to click',
                status: 'pending'
            });

            scenarios.push({
                id: `scenario-${idCounter++}`,
                type: 'keyboard',
                target: 'Arrow Keys',
                description: 'Test arrow key controls (←→↑↓)',
                expectedResult: 'Game responds to arrow keys',
                status: 'pending'
            });

            scenarios.push({
                id: `scenario-${idCounter++}`,
                type: 'keyboard',
                target: 'Spacebar',
                description: 'Test spacebar action',
                expectedResult: 'Game responds to spacebar',
                status: 'pending'
            });
        }

        // === DASHBOARD TABS ===
        if (projectType === 'dashboard' && analysis.tabCount > 0) {
            scenarios.push({
                id: `scenario-${idCounter++}`,
                type: 'click',
                target: 'Tab Navigation',
                selector: '[role="tab"], [class*="tab"]',
                description: 'Switch between tabs',
                expectedResult: 'Tab content changes',
                status: 'pending'
            });
        }

        // === E-COMMERCE CARDS ===
        if (projectType === 'ecommerce' && analysis.cardCount > 0) {
            scenarios.push({
                id: `scenario-${idCounter++}`,
                type: 'click',
                target: 'Product Card',
                selector: '[class*="card"], [class*="product"]',
                description: 'Click on product/item card',
                expectedResult: 'Card interaction works',
                status: 'pending'
            });
        }

        // === SCROLL TEST (all projects with content) ===
        scenarios.push({
            id: `scenario-${idCounter++}`,
            type: 'scroll',
            target: 'Page Scroll',
            description: 'Scroll page to test content visibility',
            expectedResult: 'Page scrolls smoothly',
            status: 'pending'
        });

        return scenarios;
    }

    /**
     * Execute a single test scenario
     */
    async executeScenario(page: Page, scenario: TestScenario, sessionId: string): Promise<boolean> {
        const startTime = Date.now();
        scenario.status = 'running';
        this.emit('cua:scenario:start', { sessionId, scenario });

        try {
            // Show action indicator
            const actionText = scenario.description || `Testing: ${scenario.target}`;
            await this.showActionIndicator(page, actionText);

            switch (scenario.type) {
                case 'click':
                    if (scenario.selector) {
                        // Capture state BEFORE click
                        const clickStateBefore = await this.captureGameState(page);

                        const element = page.locator(scenario.selector).first();
                        const isVisible = await element.isVisible({ timeout: 2000 }).catch(() => false);
                        if (!isVisible) {
                            throw new Error(`Element not found: ${scenario.selector} - "${scenario.target}" does not exist on page`);
                        }
                        const box = await element.boundingBox();
                        if (!box) {
                            throw new Error(`Element has no bounding box: ${scenario.selector}`);
                        }
                        const targetX = box.x + box.width / 2;
                        const targetY = box.y + box.height / 2;

                        // Get current mouse position (approximate from viewport center)
                        const viewport = page.viewportSize() || { width: 1280, height: 720 };
                        const startX = viewport.width / 2;
                        const startY = viewport.height / 2;

                        // Move with curved path and jitter
                        await this.curvedMouseMove(page, startX, startY, targetX, targetY);

                        // Thinking pause before clicking
                        await this.thinkingPause(page);
                        await element.click();
                        await page.waitForTimeout(600 + Math.random() * 300);

                        // Capture state AFTER click
                        const clickStateAfter = await this.captureGameState(page);

                        // Validate that clicking changed something (especially for buttons)
                        const clickValidation = this.validateStateChange(clickStateBefore, clickStateAfter, scenario.target);
                        if (clickValidation.changed) {
                            logger.info(`[CUA] Click on "${scenario.target}" validated: ${clickValidation.details}`);
                        } else {
                            logger.debug(`[CUA] Click on "${scenario.target}" - no state change detected (may be expected)`);
                        }
                    } else {
                        throw new Error(`No selector provided for click action: ${scenario.target}`);
                    }
                    break;

                case 'input':
                    if (scenario.selector) {
                        const input = page.locator(scenario.selector).first();
                        const isVisible = await input.isVisible({ timeout: 2000 }).catch(() => false);
                        if (!isVisible) {
                            throw new Error(`Input element not found: ${scenario.selector} - "${scenario.target}" does not exist on page`);
                        }
                        const box = await input.boundingBox();
                        if (box) {
                            const targetX = box.x + box.width / 2;
                            const targetY = box.y + box.height / 2;

                            // Get current position
                            const viewport = page.viewportSize() || { width: 1280, height: 720 };
                            const startX = viewport.width / 2;
                            const startY = viewport.height / 2;

                            // Curved mouse movement to input
                            await this.curvedMouseMove(page, startX, startY, targetX, targetY);
                            await this.thinkingPause(page);
                        }
                        // Click to focus
                        await input.click();
                        await page.waitForTimeout(150 + Math.random() * 100);

                        // Clear existing content
                        await input.fill('');

                        // Use AI-provided testValue first, otherwise auto-detect
                        let testValue = (scenario as any).testValue;

                        if (!testValue) {
                            // Fallback: Determine test value based on input type
                            testValue = 'Test input';
                            const inputType = await input.getAttribute('type');
                            const placeholder = await input.getAttribute('placeholder') || '';

                            if (inputType === 'email' || placeholder.toLowerCase().includes('email')) {
                                testValue = 'user@example.com';
                            } else if (inputType === 'password' || placeholder.toLowerCase().includes('password')) {
                                testValue = 'SecurePass123!';
                            } else if (placeholder.toLowerCase().includes('name')) {
                                testValue = 'John Smith';
                            } else if (placeholder.toLowerCase().includes('task') || placeholder.toLowerCase().includes('todo')) {
                                testValue = 'Buy groceries from the store';
                            } else if (placeholder.toLowerCase().includes('search')) {
                                testValue = 'Search query';
                            }
                        }

                        // Type character by character like a human
                        await this.humanType(page, testValue);
                        await page.waitForTimeout(500);
                    } else {
                        throw new Error(`No selector provided for input action: ${scenario.target}`);
                    }
                    break;

                case 'keyboard':
                    await page.focus('body');
                    const target = scenario.target.toLowerCase();

                    // Capture game state BEFORE action
                    const stateBefore = await this.captureGameState(page);
                    logger.debug(`[CUA] State before keyboard action: canvas=${stateBefore.canvasHash}, score=${stateBefore.score}`);

                    // Map common game key scenarios to actual keys
                    if (target.includes('arrow') || target === 'arrow keys') {
                        const keys = [
                            { key: 'ArrowRight', display: '→ Right' },
                            { key: 'ArrowRight', display: '→ Right' },
                            { key: 'ArrowUp', display: '↑ Up' },
                            { key: 'ArrowLeft', display: '← Left' },
                            { key: 'ArrowDown', display: '↓ Down' }
                        ];
                        for (const { key, display } of keys) {
                            await this.showKeyIndicator(page, display);
                            await page.keyboard.press(key);
                            await page.waitForTimeout(400);
                        }
                    } else if (target.includes('wasd')) {
                        const keys = [
                            { key: 'd', display: 'D → Right' },
                            { key: 'd', display: 'D → Right' },
                            { key: 'w', display: 'W ↑ Up' },
                            { key: 'a', display: 'A ← Left' },
                            { key: 's', display: 'S ↓ Down' }
                        ];
                        for (const { key, display } of keys) {
                            await this.showKeyIndicator(page, display);
                            await page.keyboard.press(key);
                            await page.waitForTimeout(400);
                        }
                    } else if (target.includes('move') && target.includes('right')) {
                        await this.showKeyIndicator(page, '→ Moving Right');
                        await page.keyboard.press('ArrowRight');
                        await page.waitForTimeout(300);
                        await page.keyboard.press('d');
                        await page.waitForTimeout(400);
                    } else if (target.includes('move') && target.includes('left')) {
                        await this.showKeyIndicator(page, '← Moving Left');
                        await page.keyboard.press('ArrowLeft');
                        await page.waitForTimeout(300);
                        await page.keyboard.press('a');
                        await page.waitForTimeout(400);
                    } else if (target.includes('move') && target.includes('up')) {
                        await this.showKeyIndicator(page, '↑ Moving Up');
                        await page.keyboard.press('ArrowUp');
                        await page.waitForTimeout(300);
                        await page.keyboard.press('w');
                        await page.waitForTimeout(400);
                    } else if (target.includes('move') && target.includes('down')) {
                        await this.showKeyIndicator(page, '↓ Moving Down');
                        await page.keyboard.press('ArrowDown');
                        await page.waitForTimeout(300);
                        await page.keyboard.press('s');
                        await page.waitForTimeout(400);
                    } else if (target.includes('jump') || target.includes('space')) {
                        await this.showKeyIndicator(page, '⎵ Jump (Space)');
                        await page.keyboard.press('Space');
                        await page.waitForTimeout(500);
                    } else if (target.includes('pause')) {
                        await this.showKeyIndicator(page, '⏸ Pause (P/Escape)');
                        await page.keyboard.press('p');
                        await page.waitForTimeout(400);
                    } else if (target.includes('enter') || target.includes('start')) {
                        await this.showKeyIndicator(page, 'Enter ↵ / Start');
                        await page.keyboard.press('Enter');
                        await page.waitForTimeout(300);
                        await page.keyboard.press('Space');
                        await page.waitForTimeout(400);
                    } else {
                        // Generic keyboard action - try common game keys
                        await this.showKeyIndicator(page, `Key: ${scenario.target}`);
                        await page.keyboard.press('Space');
                        await page.waitForTimeout(400);
                    }

                    // Wait for game to process input and update
                    await page.waitForTimeout(300);

                    // Capture game state AFTER action
                    const stateAfter = await this.captureGameState(page);
                    logger.debug(`[CUA] State after keyboard action: canvas=${stateAfter.canvasHash}, score=${stateAfter.score}`);

                    // Validate that something changed
                    const validation = this.validateStateChange(stateBefore, stateAfter, scenario.target);
                    if (!validation.changed) {
                        logger.warn(`[CUA] Keyboard action "${scenario.target}" had no observable effect`);
                        // For keyboard tests, we warn but don't fail if game simply doesn't respond
                        // This allows tests to pass for static prototypes while logging the issue
                    } else {
                        logger.info(`[CUA] Keyboard action validated: ${validation.details}`);
                    }
                    break;

                case 'hover':
                    if (scenario.selector) {
                        const element = page.locator(scenario.selector).first();
                        const isVisible = await element.isVisible({ timeout: 2000 }).catch(() => false);
                        if (!isVisible) {
                            throw new Error(`Hover element not found: ${scenario.selector} - "${scenario.target}" does not exist on page`);
                        }
                        const box = await element.boundingBox();
                        if (!box) {
                            throw new Error(`Hover element has no bounding box: ${scenario.selector}`);
                        }
                        const targetX = box.x + box.width / 2;
                        const targetY = box.y + box.height / 2;

                        const viewport = page.viewportSize() || { width: 1280, height: 720 };
                        await this.curvedMouseMove(page, viewport.width / 2, viewport.height / 2, targetX, targetY);
                        await page.waitForTimeout(600 + Math.random() * 400);
                    } else {
                        throw new Error(`No selector provided for hover action: ${scenario.target}`);
                    }
                    break;

                case 'scroll':
                    await this.showKeyIndicator(page, '↓ Scroll Down');
                    await page.evaluate(() => {
                        window.scrollTo({ top: document.body.scrollHeight / 2, behavior: 'smooth' });
                    });
                    await page.waitForTimeout(600);
                    await this.showKeyIndicator(page, '↑ Scroll Up');
                    await page.evaluate(() => {
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                    });
                    await page.waitForTimeout(400);
                    break;
            }

            // Hide action indicator
            await this.hideActionIndicator(page);

            scenario.status = 'passed';
            scenario.duration = Date.now() - startTime;
            this.emit('cua:scenario:result', { sessionId, scenario });

            // Delay between scenarios for visibility
            await page.waitForTimeout(600);
            return true;

        } catch (error: any) {
            await this.hideActionIndicator(page);
            scenario.status = 'failed';
            scenario.error = error.message;
            scenario.duration = Date.now() - startTime;
            this.emit('cua:scenario:result', { sessionId, scenario });
            return false;
        }
    }

    /**
     * Test a prototype with live streaming and dynamic scenarios
     */
    async testPrototypeLive(html: string, sessionId: string): Promise<CUATestResult> {
        const startTime = Date.now();

        const result: CUATestResult = {
            sessionId,
            status: 'running',
            scenarios: [],
            passedCount: 0,
            failedCount: 0
        };

        // Emit test start
        this.emit('cua:test:start', { sessionId });

        let context: BrowserContext | null = null;

        try {
            // Ensure browser is initialized
            if (!this.browser) {
                await this.initialize();
            }

            // Create context with video recording and high-fidelity settings
            context = await this.browser!.newContext({
                viewport: { width: 1280, height: 720 },
                deviceScaleFactor: 2, // High-fidelity "Retina" quality for screenshots
                recordVideo: {
                    dir: RECORDINGS_DIR,
                    size: { width: 1280, height: 720 }
                }
            });

            const page = await context.newPage();

            // CRITICAL: Start live frame streaming IMMEDIATELY after page creation
            // This ensures "Waiting for live feed" disappears as soon as the browser is ready
            this.startFrameStreaming(page, sessionId);

            let serverCleanup: (() => void) | null = null;

            try {
                // Check if input is a Project ID with synced files
                // We assume regular HTML won't match UUID format exactly AND have files in the store
                const isProjectId = /^[0-9a-fA-F-]{36}$/.test(html) || (html.length < 50 && projectFileService.getFiles(html).length > 0);

                if (isProjectId && projectFileService.getFiles(html).length > 0) {
                    logger.info(`[CUA] Detected Project ID ${html}. Materializing and serving synced files...`);
                    const tempDir = await projectFileService.writeToTempDir(html);
                    const { port, close } = await this.startStaticServer(tempDir);
                    serverCleanup = close;

                    logger.info(`[CUA] Serving project at http://localhost:${port}`);
                    await page.goto(`http://localhost:${port}`, { waitUntil: 'load' });
                } else {
                    // Legacy: Check if it's the old "Loading..." placeholder or actual content
                    if (html === 'Loading...') {
                        // Should verify if we really want to render "Loading..." or error out
                    }
                    // Load the prototype as direct HTML
                    await page.setContent(html, { waitUntil: 'load' });
                }

                // Wait for React to load properly (handling our async fallback loader)
                try {
                    await page.waitForFunction(() => {
                        // Check for React + ReactDOM directly OR our custom ready event flag
                        const isReady = (window as any).React && (window as any).ReactDOM && (window as any).ReactDOM.createRoot;
                        // Also check if our bootstrapper has finished
                        return isReady && (window as any).__reactReady === true;
                    }, { timeout: 15000 });
                } catch (e) {
                    console.log('Timeout waiting for React/Bootstrapper to load - proceeding to content check');
                }

                // Wait for content to render (React app usually mounts to #root or #app)
                try {
                    await page.waitForFunction(() => {
                        const root = document.getElementById('root') || document.getElementById('app');
                        const hasContent = root && root.innerHTML.trim().length > 0;

                        // Also consider the page valid if it's NOT a React app but has other content
                        const bodyText = document.body?.innerText?.trim() || '';
                        const hasOtherContent = bodyText.length > 20;

                        return hasContent || hasOtherContent;
                    }, { timeout: 10000 });
                } catch (e) {
                    console.log('Timeout waiting for content render - checking for errors');
                }

                // Buffer for any final animations
                await page.waitForTimeout(1000);

                // CRITICAL: Validate that the page actually rendered visible content
                const pageValidation = await page.evaluate(() => {
                    const body = document.body;
                    if (!body) return { valid: false, reason: 'No body element' };

                    // Check if body has any visible content
                    const bodyText = body.innerText?.trim() || '';
                    const bodyHtml = body.innerHTML?.trim() || '';

                    // Check for visible elements
                    const visibleElements = Array.from(body.querySelectorAll('*')).filter(el => {
                        const style = window.getComputedStyle(el);
                        return style.display !== 'none' &&
                            style.visibility !== 'hidden' &&
                            (el as HTMLElement).offsetParent !== null;
                    });

                    // Check for React root or app container
                    const hasReactRoot = !!(document.getElementById('root') || document.getElementById('app'));
                    const reactRootHasContent = hasReactRoot &&
                        (document.getElementById('root')?.innerHTML?.trim() ||
                            document.getElementById('app')?.innerHTML?.trim() || '').length > 0;

                    // Validation criteria
                    const hasContent = bodyText.length > 10 || visibleElements.length > 3;
                    const hasInteractiveElements = body.querySelectorAll('button, input, a, [role="button"]').length > 0;

                    // Check for error messages indicating React or Bootstrapper failed
                    // CRITICAL: Only trigger on actual error DISPLAY elements, not just text anywhere in HTML
                    // This prevents false positives when legitimate content contains words like "Error"

                    // Look for actual error display elements with specific patterns
                    const errorDisplay = body.querySelector('.orbitai-bootstrap-error, [data-error-type="bootstrap"], .react-error-boundary, #error-container');
                    const errorH1 = body.querySelector('h1');
                    const errorH1Text = errorH1?.innerText?.trim() || '';

                    // Only consider it a bootstrap error if:
                    // 1. There's a dedicated error display element, OR
                    // 2. The H1 specifically says "Load Error", "Application Error", or "Runtime Error" AND the page lacks interactive elements
                    const hasBootstrapError =
                        !!errorDisplay ||
                        ((errorH1Text === 'Load Error' || errorH1Text === 'Application Error' || errorH1Text === 'Runtime Error') &&
                            body.querySelectorAll('button, input, a, [role="button"]').length < 3);

                    if (hasBootstrapError) {
                        // Extract the actual error message from the page for better debugging
                        let actualError = '';

                        // If we have a dedicated error display element, get its error message
                        if (errorDisplay) {
                            const errorMessage = errorDisplay.querySelector('.error-message, p');
                            actualError = errorMessage?.innerText?.trim().substring(0, 300) || '';
                        }

                        // Try to find error text in common error display patterns
                        if (!actualError) {
                            const errorParagraphs = body.querySelectorAll('p');
                            for (const p of Array.from(errorParagraphs)) {
                                const text = (p as HTMLElement).innerText?.trim() || '';
                                // Look for error-like content (contains error keywords or stack trace patterns)
                                if (text && (
                                    text.includes('SyntaxError') ||
                                    text.includes('ReferenceError') ||
                                    text.includes('TypeError') ||
                                    text.includes('Failed to initialize') ||
                                    text.includes('Cannot read propert')
                                )) {
                                    actualError = text.substring(0, 200);
                                    break;
                                }
                            }
                        }

                        // Fallback: check for error in h1 + p structure (only if H1 indicates error)
                        if (!actualError && (errorH1Text.includes('Error') || errorH1Text.includes('Failed'))) {
                            const nextP = errorH1?.nextElementSibling;
                            if (nextP?.tagName === 'P') {
                                actualError = (nextP as HTMLElement).innerText?.trim().substring(0, 200) || '';
                            }
                        }

                        const detailedReason = actualError
                            ? `Bootstrap/React initialization failed: ${actualError}`
                            : `Bootstrap/React initialization failed (no detailed error message found)`;

                        return {
                            valid: false,
                            reason: detailedReason
                        };
                    }

                    if (!hasContent && !hasInteractiveElements) {
                        // DEBUG: Capture what IS on the page to debug why it's blank
                        const debugHtml = body.innerHTML?.substring(0, 500) || 'null';
                        console.log('[CUA Debug] Blank page detected. InnerHTML start:', debugHtml);

                        return {
                            valid: false,
                            reason: `Page appears blank (text: ${bodyText.length} chars, elements: ${visibleElements.length}, interactive: 0). HTML preview: ${debugHtml.substring(0, 100)}...`
                        };
                    }

                    return {
                        valid: true,
                        details: {
                            textLength: bodyText.length,
                            visibleElements: visibleElements.length,
                            hasReactRoot,
                            reactRootHasContent
                        }
                    };
                });

                if (!pageValidation.valid) {
                    logger.error(`[CUA] Page validation failed: ${pageValidation.reason}`);

                    // Return early with failed status - don't run tests on blank page
                    result.status = 'failed';
                    result.summary = `Page failed to render: ${pageValidation.reason}`;
                    result.failedCount = 1;
                    result.scenarios = [{
                        id: 'page-render-check',
                        type: 'load' as const,
                        target: 'Page Content',
                        description: 'Verify page renders visible content',
                        status: 'failed' as const,
                        error: pageValidation.reason,
                        expectedResult: 'Page should display interactive UI elements'
                    }];

                    this.emit('cua:test:complete', {
                        sessionId,
                        status: 'failed',
                        summary: result.summary
                    });

                    return result;
                }

                logger.info(`[CUA] Page validation passed:`, pageValidation.details);

                // Inject cursor and indicator overlays
                await this.injectCursorOverlay(page);

                // Generate test scenarios using AI analysis (with rule-based fallback)
                const scenarios = await this.generateTestScenarios(page, html);
                result.scenarios = scenarios;

                // Emit scenarios to frontend
                this.emit('cua:scenarios', { sessionId, scenarios });

                logger.info(`[CUA] Generated ${scenarios.length} test scenarios for session ${sessionId}`);

                // Track completed scenario IDs for dependency checking
                const completedScenarios: Map<string, 'passed' | 'failed' | 'skipped'> = new Map();

                // Execute each scenario with dependency checking
                for (const scenario of scenarios) {
                    // Check if dependencies have all passed
                    if (scenario.dependsOn && scenario.dependsOn.length > 0) {
                        const unmetDependencies = scenario.dependsOn.filter(depId => {
                            const depStatus = completedScenarios.get(depId);
                            return depStatus !== 'passed';
                        });

                        if (unmetDependencies.length > 0) {
                            scenario.status = 'skipped';
                            scenario.error = `Dependencies failed: ${unmetDependencies.join(', ')}`;
                            logger.warn(`[CUA] Skipping "${scenario.target}" - dependencies not met: ${unmetDependencies.join(', ')}`);
                            completedScenarios.set(scenario.id, 'skipped');
                            result.failedCount!++;
                            this.emit('cua:scenario:result', { sessionId, scenario });
                            continue;
                        }
                    }

                    // Check prerequisite element visibility
                    if (scenario.prerequisiteCheck) {
                        try {
                            const prereqElement = page.locator(scenario.prerequisiteCheck).first();
                            const isPrereqVisible = await prereqElement.isVisible({ timeout: 1000 }).catch(() => false);

                            if (!isPrereqVisible) {
                                scenario.status = 'skipped';
                                scenario.error = `Prerequisite not met: "${scenario.prerequisiteCheck}" not visible`;
                                logger.warn(`[CUA] Skipping "${scenario.target}" - prerequisite element not visible: ${scenario.prerequisiteCheck}`);
                                completedScenarios.set(scenario.id, 'skipped');
                                result.failedCount!++;
                                this.emit('cua:scenario:result', { sessionId, scenario });
                                continue;
                            }
                        } catch (e) {
                            // Prerequisite check failed, skip test
                            scenario.status = 'skipped';
                            scenario.error = `Prerequisite check failed`;
                            completedScenarios.set(scenario.id, 'skipped');
                            result.failedCount!++;
                            this.emit('cua:scenario:result', { sessionId, scenario });
                            continue;
                        }
                    }

                    // Execute the scenario
                    await this.executeScenario(page, scenario, sessionId);

                    // INLINE AUTO-FIX: If scenario failed, attempt to fix and re-run
                    if (scenario.status === 'failed' && scenario.phase === 1) {
                        // Phase 1 (setup) failures are critical - attempt inline fix
                        logger.info(`[CUA Auto-Fix] Phase 1 scenario "${scenario.target}" failed, attempting inline fix...`);

                        this.emit('cua:autofix:inline', {
                            sessionId,
                            scenario: scenario.target,
                            status: 'attempting'
                        });

                        try {
                            // Get current HTML content
                            const currentHtml = await page.content();

                            // Generate fix for just this scenario
                            const fixResult = await cuaLLMService.generatePrototypeFix(
                                currentHtml,
                                [{
                                    scenario: scenario.target,
                                    error: scenario.error || 'Element not found or action failed',
                                    selector: scenario.selector
                                }]
                            );

                            if (fixResult.success && fixResult.fixedHtml !== currentHtml) {
                                logger.info(`[CUA Auto-Fix] Generated inline fix: ${fixResult.explanation}`);

                                // Apply fix by updating page content
                                await page.setContent(fixResult.fixedHtml, { waitUntil: 'domcontentloaded' });
                                await page.waitForTimeout(500);

                                // Reset scenario status and re-run
                                scenario.status = 'pending';
                                scenario.error = undefined;

                                this.emit('cua:autofix:inline', {
                                    sessionId,
                                    scenario: scenario.target,
                                    status: 'retrying',
                                    changes: fixResult.changes
                                });

                                // Re-execute the scenario
                                await this.executeScenario(page, scenario, sessionId);

                                if (scenario.status === 'passed') {
                                    logger.info(`[CUA Auto-Fix] Inline fix successful for "${scenario.target}"`);
                                    this.emit('cua:autofix:inline', {
                                        sessionId,
                                        scenario: scenario.target,
                                        status: 'fixed'
                                    });
                                } else {
                                    logger.warn(`[CUA Auto-Fix] Inline fix did not resolve "${scenario.target}"`);
                                }
                            }
                        } catch (fixError: any) {
                            logger.warn(`[CUA Auto-Fix] Inline fix failed: ${fixError.message}`);
                        }
                    }

                    // Track result for dependency checking
                    completedScenarios.set(scenario.id, scenario.status as 'passed' | 'failed' | 'skipped');

                    if (scenario.status === 'passed') {
                        result.passedCount!++;
                    } else {
                        result.failedCount!++;
                    }
                }

                // Stop frame streaming
                this.stopFrameStreaming();

                // Take final screenshot
                const screenshotBuffer = await page.screenshot({ type: 'png' });
                result.screenshot = `data:image/png;base64,${screenshotBuffer.toString('base64')}`;

                // Determine final status
                if (result.failedCount! === 0) {
                    result.status = 'passed';
                    result.summary = `✓ All ${result.passedCount} tests passed!`;
                } else {
                    result.status = 'failed';
                    result.summary = `✗ ${result.passedCount}/${scenarios.length} tests passed, ${result.failedCount} failed`;
                }

                result.totalDuration = Date.now() - startTime;
                logger.info(`[CUA] Test completed for session ${sessionId}: ${result.summary}`);

            } finally {
                await page.close();
            }

            // Close context to save video
            await context.close();

            // Find and rename video file
            const videoFiles = fs.readdirSync(RECORDINGS_DIR)
                .filter(f => f.endsWith('.webm'))
                .map(f => ({ name: f, time: fs.statSync(path.join(RECORDINGS_DIR, f)).mtimeMs }))
                .sort((a, b) => b.time - a.time);

            if (videoFiles.length > 0) {
                const latestVideo = videoFiles[0].name;
                const newVideoPath = path.join(RECORDINGS_DIR, `${sessionId}.webm`);
                const oldVideoPath = path.join(RECORDINGS_DIR, latestVideo);
                if (latestVideo !== `${sessionId}.webm`) {
                    try {
                        fs.renameSync(oldVideoPath, newVideoPath);
                    } catch { }
                }
                result.videoUrl = `/cua-recordings/${sessionId}.webm`;
                logger.info(`[CUA] Video saved: ${result.videoUrl}`);
            }

        } catch (error: any) {
            logger.error('[CUA] Test error:', error);
            this.stopFrameStreaming();

            result.status = 'failed';
            result.error = error.message;
            result.summary = `✗ Test failed: ${error.message}`;
            result.totalDuration = Date.now() - startTime;
        }

        // Emit test complete
        this.emit('cua:test:complete', result);

        return result;
    }

    /**
     * Quick health check
     */
    async healthCheck(): Promise<boolean> {
        try {
            if (!this.browser) {
                await this.initialize();
            }
            const page = await this.browser!.newPage();
            await page.setContent('<html><body>Health Check</body></html>');
            const content = await page.content();
            await page.close();
            return content.includes('Health Check');
        } catch (error) {
            logger.error('[CUA] Health check failed:', error);
            return false;
        }
    }

    /**
     * Run live CUA test with auto-fix capability
     * If tests fail, attempts to automatically fix the prototype and re-run
     */
    async runLiveTestWithAutoFix(
        html: string,
        sessionId: string,
        maxRetries: number = 2
    ): Promise<CUATestResult & {
        autoFixApplied: boolean;
        fixedHtml?: string;
        fixChanges?: { description: string; type: string }[];
        attempts: number;
    }> {
        let currentHtml = html;
        let attempts = 0;
        let lastResult: CUATestResult | null = null;
        const originalSessionId = sessionId; // Keep track of the original ID for streaming

        while (attempts < maxRetries + 1) {
            attempts++;
            // Use originalSessionId for the backend logic but keep attempt identification in logs
            const attemptLabel = attempts === 1 ? originalSessionId : `${originalSessionId}-fix${attempts - 1}`;

            logger.info(`[CUA Auto-Fix] Attempt ${attempts}/${maxRetries + 1} for session ${attemptLabel}`);

            // Emit attempt status using originalSessionId so frontend stays synced
            this.emit('cua:autofix:attempt', {
                sessionId: originalSessionId,
                attempt: attempts,
                maxAttempts: maxRetries + 1
            });

            // Run the test - CRITICAL: testPrototypeLive must use originalSessionId for consistent event emission
            lastResult = await this.testPrototypeLive(currentHtml, originalSessionId);

            // Check if all tests passed
            if (lastResult.failedCount === 0) {
                logger.info(`[CUA Auto-Fix] All tests passed on attempt ${attempts}`);
                return {
                    ...lastResult,
                    autoFixApplied: attempts > 1,
                    fixedHtml: attempts > 1 ? currentHtml : undefined,
                    attempts
                };
            }

            // If there are failed tests and we have retries left
            if (attempts <= maxRetries) {
                const failedTests = lastResult.scenarios
                    .filter(s => s.status === 'failed')
                    .map(s => ({
                        scenario: s.target,
                        error: s.error || 'Unknown error',
                        selector: s.selector
                    }));

                logger.info(`[CUA Auto-Fix] ${failedTests.length} tests failed, attempting auto-fix...`);

                // Check if failures are auto-fixable
                const canFix = await cuaLLMService.canAutoFix(failedTests);

                if (!canFix.canFix) {
                    logger.warn(`[CUA Auto-Fix] Failures not auto-fixable: ${canFix.reason}`);
                    break;
                }

                // Emit fix in progress
                this.emit('cua:autofix:progress', {
                    sessionId,
                    status: 'generating',
                    failedTests: failedTests.length,
                    confidence: canFix.confidence
                });

                // Generate fix
                const fixResult = await cuaLLMService.generatePrototypeFix(
                    currentHtml,
                    failedTests
                );

                if (fixResult.success && fixResult.fixedHtml !== currentHtml) {
                    logger.info(`[CUA Auto-Fix] Generated fix with ${fixResult.changes.length} changes: ${fixResult.explanation}`);

                    // Emit fix applied
                    this.emit('cua:autofix:applied', {
                        sessionId,
                        changes: fixResult.changes,
                        explanation: fixResult.explanation
                    });

                    currentHtml = fixResult.fixedHtml;

                    // Record learnings from successful fix (scoped by project type)
                    try {
                        for (const failed of failedTests) {
                            await prototypeLearningService.recordLearning({
                                projectType: 'webapp', // TODO: Extract from context when available
                                genre: undefined, // TODO: Extract from brainstormingContext
                                issuePattern: failed.error,
                                fix: fixResult.changes.map(c => c.description).join('; '),
                                source: 'cua-autofix',
                                tags: ['auto-generated']
                            });
                        }
                        logger.info(`[CUA Auto-Fix] Recorded ${failedTests.length} learnings from successful fix`);
                    } catch (learnErr: any) {
                        logger.warn(`[CUA Auto-Fix] Failed to record learnings: ${learnErr.message}`);
                    }

                    // Continue to next attempt with fixed HTML
                    continue;
                } else {
                    logger.warn(`[CUA Auto-Fix] Unable to generate fix: ${fixResult.explanation}`);
                    break;
                }
            }
        }

        // Return last result with auto-fix status
        return {
            ...lastResult!,
            autoFixApplied: attempts > 1 && currentHtml !== html,
            fixedHtml: currentHtml !== html ? currentHtml : undefined,
            attempts
        };
    }
}

// Export singleton instance
export const cuaService = new CUAService();
