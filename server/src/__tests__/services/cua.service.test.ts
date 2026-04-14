/**
 * CUA Service Tests
 * Unit tests for the CUAService class covering browser-based prototype testing
 *
 * @module __tests__/services/cua.service
 */

import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';

// ---------------------------------------------------------------------------
// Module mocks — must appear before the service is imported
// ---------------------------------------------------------------------------

vi.mock('playwright', () => {
    const mockPage = {
        setContent: vi.fn().mockResolvedValue(undefined),
        goto: vi.fn().mockResolvedValue(undefined),
        content: vi.fn().mockResolvedValue('<html><body>Health Check</body></html>'),
        close: vi.fn().mockResolvedValue(undefined),
        screenshot: vi.fn().mockResolvedValue(Buffer.from('fake-screenshot')),
        evaluate: vi.fn().mockResolvedValue({ valid: true, details: {} }),
        waitForFunction: vi.fn().mockResolvedValue(undefined),
        waitForTimeout: vi.fn().mockResolvedValue(undefined),
        viewportSize: vi.fn().mockReturnValue({ width: 1280, height: 720 }),
        locator: vi.fn().mockReturnValue({
            first: vi.fn().mockReturnValue({
                isVisible: vi.fn().mockResolvedValue(true),
                boundingBox: vi.fn().mockResolvedValue({ x: 100, y: 100, width: 80, height: 40 }),
                click: vi.fn().mockResolvedValue(undefined),
                fill: vi.fn().mockResolvedValue(undefined),
            }),
        }),
        keyboard: {
            press: vi.fn().mockResolvedValue(undefined),
            type: vi.fn().mockResolvedValue(undefined),
        },
        mouse: {
            move: vi.fn().mockResolvedValue(undefined),
            wheel: vi.fn().mockResolvedValue(undefined),
        },
    };

    const mockContext = {
        newPage: vi.fn().mockResolvedValue(mockPage),
        close: vi.fn().mockResolvedValue(undefined),
    };

    const mockBrowser = {
        newPage: vi.fn().mockResolvedValue(mockPage),
        newContext: vi.fn().mockResolvedValue(mockContext),
        close: vi.fn().mockResolvedValue(undefined),
    };

    return {
        chromium: {
            launch: vi.fn().mockResolvedValue(mockBrowser),
        },
    };
});

vi.mock('../../utils/logger.js', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

vi.mock('../../services/websocket.service.js', () => ({
    webSocketService: {
        getIO: vi.fn(() => ({ emit: vi.fn() })),
    },
}));

vi.mock('../../services/gemini.service.js', () => ({
    geminiService: {
        generateContent: vi.fn(),
    },
}));

vi.mock('../../services/cua-llm.service.js', () => ({
    cuaLLMService: {
        canAutoFix: vi.fn(),
        generatePrototypeFix: vi.fn(),
    },
}));

vi.mock('../../services/prototypeLearning.service.js', () => ({
    prototypeLearningService: {
        recordLearning: vi.fn().mockResolvedValue(undefined),
    },
}));

vi.mock('../../services/projectFile.service.js', () => ({
    projectFileService: {
        getFiles: vi.fn().mockReturnValue([]),
        writeToTempDir: vi.fn().mockResolvedValue('/tmp-test-dir'),
    },
}));

vi.mock('fs', async () => {
    const existsSync = vi.fn().mockReturnValue(true);
    const mkdirSync = vi.fn();
    const readdirSync = vi.fn().mockReturnValue([]);
    const statSync = vi.fn().mockReturnValue({ mtimeMs: 0 });
    const renameSync = vi.fn();
    return {
        default: { existsSync, mkdirSync, readdirSync, statSync, renameSync },
        existsSync,
        mkdirSync,
        readdirSync,
        statSync,
        renameSync,
    };
});

vi.mock('express', () => {
    const mockApp = {
        use: vi.fn(),
    };
    const mockExpress = vi.fn(() => mockApp) as any;
    mockExpress.static = vi.fn(() => vi.fn());
    return { default: mockExpress };
});

vi.mock('http', () => {
    const mockServer = {
        listen: vi.fn((_port: number, cb: () => void) => { cb(); return mockServer; }),
        address: vi.fn(() => ({ port: 54321 })),
        close: vi.fn(),
    };
    return {
        default: {
            createServer: vi.fn(() => mockServer),
        },
        createServer: vi.fn(() => mockServer),
    };
});

// ---------------------------------------------------------------------------
// Import service under test AFTER mocks are in place
// ---------------------------------------------------------------------------

import { cuaService } from '../../services/cua.service.js';
import { chromium } from 'playwright';
import { webSocketService } from '../../services/websocket.service.js';
import { geminiService } from '../../services/gemini.service.js';
import { cuaLLMService } from '../../services/cua-llm.service.js';
import { projectFileService } from '../../services/projectFile.service.js';
import { logger } from '../../utils/logger.js';
import * as fs from 'fs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const getMockBrowser = () => (chromium.launch as Mock).mock.results[0]?.value;

const getMockPage = () => {
    const browser = getMockBrowser();
    if (browser?.newPage?.mock?.results[0]?.value) return browser.newPage.mock.results[0].value;
    // fall back to context page
    const ctx = browser?.newContext?.mock?.results[0]?.value;
    return ctx?.newPage?.mock?.results[0]?.value;
};

const makeValidPageEvaluate = () => {
    return vi.fn().mockResolvedValue({ valid: true, details: { textLength: 100, visibleElements: 5 } });
};

// Build a minimal valid AI scenario response for geminiService
const buildAiScenariosJson = () =>
    JSON.stringify({
        projectType: 'webapp',
        appAnalysis: { coreFeatures: ['button'], mainUserJourney: 'click' },
        testSuites: [
            {
                suiteName: 'Basic Tests',
                suiteType: 'gameplay',
                phase: 2,
                scenarios: [
                    {
                        id: 'ai-click-1',
                        type: 'click',
                        target: 'Submit Button',
                        selector: 'button',
                        description: 'Click submit',
                        expectedResult: 'Action triggered',
                        phase: 2,
                        dependsOn: [],
                    },
                ],
            },
        ],
    });

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CUAService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset the singleton's internal state between tests
        (cuaService as any).browser = null;
        (cuaService as any).isInitialized = false;
        (cuaService as any).frameStreamInterval = null;

        // Default websocket mock
        (webSocketService.getIO as Mock).mockReturnValue({ emit: vi.fn() });

        // Default fs mocks
        (fs.existsSync as Mock).mockReturnValue(true);
    });

    afterEach(() => {
        // Stop any lingering frame-streaming intervals
        if ((cuaService as any).frameStreamInterval) {
            clearInterval((cuaService as any).frameStreamInterval);
            (cuaService as any).frameStreamInterval = null;
        }
    });

    // -----------------------------------------------------------------------
    // initialize()
    // -----------------------------------------------------------------------

    describe('initialize()', () => {
        it('launches chromium and sets isInitialized to true', async () => {
            await cuaService.initialize();

            expect(chromium.launch).toHaveBeenCalledWith(
                expect.objectContaining({ headless: true })
            );
            expect((cuaService as any).isInitialized).toBe(true);
        });

        it('is a no-op when already initialized', async () => {
            (cuaService as any).isInitialized = true;
            (cuaService as any).browser = {};

            await cuaService.initialize();

            expect(chromium.launch).not.toHaveBeenCalled();
        });

        it('creates recordings directory when it does not exist', async () => {
            (fs.existsSync as Mock).mockReturnValue(false);

            await cuaService.initialize();

            expect(fs.mkdirSync).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({ recursive: true })
            );
        });

        it('propagates errors from chromium.launch', async () => {
            (chromium.launch as Mock).mockRejectedValueOnce(new Error('Browser unavailable'));

            await expect(cuaService.initialize()).rejects.toThrow('Browser unavailable');
            expect(logger.error).toHaveBeenCalled();
        });
    });

    // -----------------------------------------------------------------------
    // cleanup()
    // -----------------------------------------------------------------------

    describe('cleanup()', () => {
        it('closes the browser and resets state', async () => {
            const mockBrowser = { close: vi.fn().mockResolvedValue(undefined) };
            (cuaService as any).browser = mockBrowser;
            (cuaService as any).isInitialized = true;

            await cuaService.cleanup();

            expect(mockBrowser.close).toHaveBeenCalledOnce();
            expect((cuaService as any).browser).toBeNull();
            expect((cuaService as any).isInitialized).toBe(false);
        });

        it('is a no-op when browser is not initialized', async () => {
            (cuaService as any).browser = null;

            await expect(cuaService.cleanup()).resolves.not.toThrow();
        });
    });

    // -----------------------------------------------------------------------
    // healthCheck()
    // -----------------------------------------------------------------------

    describe('healthCheck()', () => {
        it('returns true when browser can set and retrieve content', async () => {
            const mockPage = {
                setContent: vi.fn().mockResolvedValue(undefined),
                content: vi.fn().mockResolvedValue('<html><body>Health Check</body></html>'),
                close: vi.fn().mockResolvedValue(undefined),
            };
            const mockBrowser = { newPage: vi.fn().mockResolvedValue(mockPage) };
            (chromium.launch as Mock).mockResolvedValueOnce(mockBrowser);

            const result = await cuaService.healthCheck();

            expect(result).toBe(true);
            expect(mockPage.setContent).toHaveBeenCalled();
            expect(mockPage.close).toHaveBeenCalled();
        });

        it('returns false when an error occurs', async () => {
            (chromium.launch as Mock).mockRejectedValueOnce(new Error('Playwright crash'));

            const result = await cuaService.healthCheck();

            expect(result).toBe(false);
            expect(logger.error).toHaveBeenCalled();
        });

        it('reuses existing browser instance if already initialized', async () => {
            const mockPage = {
                setContent: vi.fn().mockResolvedValue(undefined),
                content: vi.fn().mockResolvedValue('<html><body>Health Check</body></html>'),
                close: vi.fn().mockResolvedValue(undefined),
            };
            const mockBrowser = { newPage: vi.fn().mockResolvedValue(mockPage) };
            (cuaService as any).browser = mockBrowser;
            (cuaService as any).isInitialized = true;

            const result = await cuaService.healthCheck();

            expect(chromium.launch).not.toHaveBeenCalled();
            expect(result).toBe(true);
        });
    });

    // -----------------------------------------------------------------------
    // testPrototypeLive()
    // -----------------------------------------------------------------------

    describe('testPrototypeLive()', () => {
        const SESSION_ID = 'test-session-001';
        const SIMPLE_HTML = '<html><body><button>Click me</button></body></html>';

        const buildMocks = () => {
            const mockEmit = vi.fn();
            (webSocketService.getIO as Mock).mockReturnValue({ emit: mockEmit });

            const mockPage = {
                setContent: vi.fn().mockResolvedValue(undefined),
                goto: vi.fn().mockResolvedValue(undefined),
                content: vi.fn().mockResolvedValue(SIMPLE_HTML),
                screenshot: vi.fn().mockResolvedValue(Buffer.from('screenshot')),
                evaluate: vi.fn()
                    .mockResolvedValueOnce({ valid: true, details: { textLength: 50, visibleElements: 3 } })
                    .mockResolvedValue({}),
                waitForFunction: vi.fn().mockResolvedValue(undefined),
                waitForTimeout: vi.fn().mockResolvedValue(undefined),
                viewportSize: vi.fn().mockReturnValue({ width: 1280, height: 720 }),
                locator: vi.fn().mockReturnValue({
                    first: vi.fn().mockReturnValue({
                        isVisible: vi.fn().mockResolvedValue(true),
                        boundingBox: vi.fn().mockResolvedValue({ x: 50, y: 50, width: 100, height: 40 }),
                        click: vi.fn().mockResolvedValue(undefined),
                    }),
                }),
                keyboard: { press: vi.fn().mockResolvedValue(undefined) },
                mouse: { move: vi.fn().mockResolvedValue(undefined), wheel: vi.fn().mockResolvedValue(undefined) },
            };

            const mockContext = {
                newPage: vi.fn().mockResolvedValue(mockPage),
                close: vi.fn().mockResolvedValue(undefined),
            };

            const mockBrowser = {
                newContext: vi.fn().mockResolvedValue(mockContext),
                newPage: vi.fn().mockResolvedValue(mockPage),
                close: vi.fn().mockResolvedValue(undefined),
            };

            (chromium.launch as Mock).mockResolvedValueOnce(mockBrowser);
            (projectFileService.getFiles as Mock).mockReturnValue([]);

            // Gemini returns null → triggers rule-based fallback scenarios
            (geminiService.generateContent as Mock).mockResolvedValue(null);

            return { mockEmit, mockPage, mockContext, mockBrowser };
        };

        it('emits cua:test:start at the beginning', async () => {
            const { mockEmit } = buildMocks();

            await cuaService.testPrototypeLive(SIMPLE_HTML, SESSION_ID);

            expect(mockEmit).toHaveBeenCalledWith(
                'cua:test:start',
                expect.objectContaining({ sessionId: SESSION_ID })
            );
        });

        it('emits cua:test:complete at the end', async () => {
            const { mockEmit } = buildMocks();

            await cuaService.testPrototypeLive(SIMPLE_HTML, SESSION_ID);

            expect(mockEmit).toHaveBeenCalledWith(
                'cua:test:complete',
                expect.objectContaining({ sessionId: SESSION_ID })
            );
        });

        it('returns a CUATestResult with correct sessionId', async () => {
            buildMocks();

            const result = await cuaService.testPrototypeLive(SIMPLE_HTML, SESSION_ID);

            expect(result).toMatchObject({ sessionId: SESSION_ID });
            expect(result.scenarios).toBeInstanceOf(Array);
        });

        it('returns failed status when page validation fails', async () => {
            const mockEmit = vi.fn();
            (webSocketService.getIO as Mock).mockReturnValue({ emit: mockEmit });

            const mockPage = {
                setContent: vi.fn().mockResolvedValue(undefined),
                evaluate: vi.fn().mockResolvedValue({ valid: false, reason: 'Page appears blank' }),
                waitForFunction: vi.fn().mockResolvedValue(undefined),
                waitForTimeout: vi.fn().mockResolvedValue(undefined),
                screenshot: vi.fn().mockResolvedValue(Buffer.from('s')),
                viewportSize: vi.fn().mockReturnValue({ width: 1280, height: 720 }),
                close: vi.fn().mockResolvedValue(undefined),
            };
            const mockContext = {
                newPage: vi.fn().mockResolvedValue(mockPage),
                close: vi.fn().mockResolvedValue(undefined),
            };
            const mockBrowser = { newContext: vi.fn().mockResolvedValue(mockContext) };
            (chromium.launch as Mock).mockResolvedValueOnce(mockBrowser);
            (projectFileService.getFiles as Mock).mockReturnValue([]);

            const result = await cuaService.testPrototypeLive(SIMPLE_HTML, SESSION_ID);

            expect(result.status).toBe('failed');
            expect(result.summary).toMatch(/Page failed to render/);
        });

        it('initializes browser if not already running', async () => {
            buildMocks();
            expect((cuaService as any).browser).toBeNull();

            await cuaService.testPrototypeLive(SIMPLE_HTML, SESSION_ID);

            expect(chromium.launch).toHaveBeenCalledOnce();
        });

        it('returns failed result when browser creation throws', async () => {
            (webSocketService.getIO as Mock).mockReturnValue({ emit: vi.fn() });
            (chromium.launch as Mock).mockRejectedValueOnce(new Error('No display'));

            const result = await cuaService.testPrototypeLive(SIMPLE_HTML, SESSION_ID);

            expect(result.status).toBe('failed');
            expect(result.error).toBe('No display');
        });
    });

    // -----------------------------------------------------------------------
    // runLiveTestWithAutoFix()
    // -----------------------------------------------------------------------

    describe('runLiveTestWithAutoFix()', () => {
        const SESSION_ID = 'autofix-session';
        const HTML = '<html><body><p>App</p></body></html>';

        const makePassingResult = () => ({
            sessionId: SESSION_ID,
            status: 'passed' as const,
            scenarios: [{ id: 's1', type: 'click' as const, target: 'Btn', description: 'test', status: 'passed' as const }],
            passedCount: 1,
            failedCount: 0,
            summary: 'All passed',
        });

        const makeFailingResult = () => ({
            sessionId: SESSION_ID,
            status: 'failed' as const,
            scenarios: [{ id: 's1', type: 'click' as const, target: 'Btn', description: 'test', status: 'failed' as const, error: 'Element not found' }],
            passedCount: 0,
            failedCount: 1,
            summary: '1 failed',
        });

        beforeEach(() => {
            // Stub testPrototypeLive on the singleton so we don't spin up a browser
            vi.spyOn(cuaService, 'testPrototypeLive');
        });

        it('returns result immediately when tests pass on first attempt', async () => {
            (cuaService.testPrototypeLive as Mock).mockResolvedValueOnce(makePassingResult());

            const result = await cuaService.runLiveTestWithAutoFix(HTML, SESSION_ID);

            expect(result.autoFixApplied).toBe(false);
            expect(result.attempts).toBe(1);
            expect(result.status).toBe('passed');
        });

        it('attempts auto-fix when first run fails', async () => {
            (cuaService.testPrototypeLive as Mock)
                .mockResolvedValueOnce(makeFailingResult())
                .mockResolvedValueOnce(makePassingResult());

            (cuaLLMService.canAutoFix as Mock).mockResolvedValue({ canFix: true, confidence: 0.9, reason: '' });
            (cuaLLMService.generatePrototypeFix as Mock).mockResolvedValue({
                success: true,
                fixedHtml: '<html><body><p>Fixed</p></body></html>',
                changes: [{ description: 'Added missing element', type: 'add' }],
                explanation: 'Fixed missing element',
            });

            const result = await cuaService.runLiveTestWithAutoFix(HTML, SESSION_ID);

            expect(result.autoFixApplied).toBe(true);
            expect(result.attempts).toBe(2);
        });

        it('stops retrying when canAutoFix returns false', async () => {
            (cuaService.testPrototypeLive as Mock).mockResolvedValue(makeFailingResult());
            (cuaLLMService.canAutoFix as Mock).mockResolvedValue({ canFix: false, confidence: 0, reason: 'Cannot fix' });

            const result = await cuaService.runLiveTestWithAutoFix(HTML, SESSION_ID, 1);

            expect(result.autoFixApplied).toBe(false);
            expect(cuaService.testPrototypeLive).toHaveBeenCalledTimes(1);
        });

        it('emits cua:autofix:attempt events for each retry', async () => {
            const mockEmit = vi.fn();
            (webSocketService.getIO as Mock).mockReturnValue({ emit: mockEmit });

            (cuaService.testPrototypeLive as Mock)
                .mockResolvedValueOnce(makeFailingResult())
                .mockResolvedValueOnce(makePassingResult());

            (cuaLLMService.canAutoFix as Mock).mockResolvedValue({ canFix: true, confidence: 0.8, reason: '' });
            (cuaLLMService.generatePrototypeFix as Mock).mockResolvedValue({
                success: true,
                fixedHtml: '<html>fixed</html>',
                changes: [],
                explanation: '',
            });

            await cuaService.runLiveTestWithAutoFix(HTML, SESSION_ID, 1);

            expect(mockEmit).toHaveBeenCalledWith(
                'cua:autofix:attempt',
                expect.objectContaining({ sessionId: SESSION_ID, attempt: 1 })
            );
        });
    });

    // -----------------------------------------------------------------------
    // WebSocket emission
    // -----------------------------------------------------------------------

    describe('WebSocket emission', () => {
        it('queries WebSocket IO on each emitted event', async () => {
            const mockEmit = vi.fn();
            const mockGetIO = vi.fn().mockReturnValue({ emit: mockEmit });
            // Patch the mock at the object level so the service picks it up
            (webSocketService as any).getIO = mockGetIO;

            const mockPage = {
                setContent: vi.fn().mockResolvedValue(undefined),
                evaluate: vi.fn().mockResolvedValue({ valid: false, reason: 'blank' }),
                waitForFunction: vi.fn().mockResolvedValue(undefined),
                waitForTimeout: vi.fn().mockResolvedValue(undefined),
                screenshot: vi.fn().mockResolvedValue(Buffer.from('s')),
                viewportSize: vi.fn().mockReturnValue({ width: 1280, height: 720 }),
                close: vi.fn().mockResolvedValue(undefined),
            };
            const mockContext = { newPage: vi.fn().mockResolvedValue(mockPage), close: vi.fn().mockResolvedValue(undefined) };
            const mockBrowser = { newContext: vi.fn().mockResolvedValue(mockContext) };
            (chromium.launch as Mock).mockResolvedValueOnce(mockBrowser);
            (projectFileService.getFiles as Mock).mockReturnValue([]);

            await cuaService.testPrototypeLive('<html></html>', 'ws-query-session');

            // getIO should be called for at least cua:test:start and cua:test:complete
            expect(mockGetIO).toHaveBeenCalled();
        });

        it('includes a timestamp in every emitted event', async () => {
            const mockEmit = vi.fn();
            const mockGetIO = vi.fn().mockReturnValue({ emit: mockEmit });
            (webSocketService as any).getIO = mockGetIO;

            const mockPage = {
                setContent: vi.fn().mockResolvedValue(undefined),
                evaluate: vi.fn().mockResolvedValue({ valid: false, reason: 'blank' }),
                waitForFunction: vi.fn().mockResolvedValue(undefined),
                waitForTimeout: vi.fn().mockResolvedValue(undefined),
                screenshot: vi.fn().mockResolvedValue(Buffer.from('s')),
                viewportSize: vi.fn().mockReturnValue({ width: 1280, height: 720 }),
                close: vi.fn().mockResolvedValue(undefined),
            };
            const mockContext = { newPage: vi.fn().mockResolvedValue(mockPage), close: vi.fn().mockResolvedValue(undefined) };
            const mockBrowser = { newContext: vi.fn().mockResolvedValue(mockContext) };
            (chromium.launch as Mock).mockResolvedValueOnce(mockBrowser);
            (projectFileService.getFiles as Mock).mockReturnValue([]);

            await cuaService.testPrototypeLive('<html></html>', 'timestamp-session');

            expect(mockEmit).toHaveBeenCalled();
            mockEmit.mock.calls.forEach(([_event, data]) => {
                expect(data.timestamp).toBeInstanceOf(Date);
            });
        });
    });
});
