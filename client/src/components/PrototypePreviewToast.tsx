import React, { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
    X,
    RotateCcw,
    Check,
    Globe,
    Minus,
    Square,
    Play,
    Maximize2,
    Minimize2,
    Send,
    Sparkles,
    Loader2,
    MessageSquare,
    Bot,
    CheckCircle2,
    XCircle,
    AlertCircle,
    Zap
} from 'lucide-react';
import PreviewFrame from './PreviewFrame';
import { websocketClient } from '../services/websocketClient';
import { webContainerService } from '../services/WebContainerService';
import { fileMountService } from '../services/FileMountService';
import { fileWatchService } from '../services/FileWatchService';
import WebTerminal from './WebTerminal';
import { WebContainer } from '@webcontainer/api';

// Conversation message type matching the project chat
interface ConversationMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp?: string;
}

interface PrototypePreviewToastProps {
    isOpen: boolean;
    wireframeCode: string;
    projectName?: string;
    onApprove: () => void;
    onRegenerate: () => void;
    onClose: () => void;
    onRefine?: (refinementMessage: string) => Promise<void>;
    isRefining?: boolean;
    conversationMessages?: ConversationMessage[];
}

/**
 * PrototypePreviewToast - Shows a browser-like preview popup after generation
 * Allows users to test the prototype and refine it with chat (continues project chat)
 */
const PrototypePreviewToast: React.FC<PrototypePreviewToastProps> = ({
    isOpen,
    wireframeCode,
    projectName = 'Prototype',
    onApprove,
    onRegenerate,
    onClose,
    onRefine,
    isRefining = false,
    conversationMessages = []
}) => {
    // Start at 75% size by default (not expanded)
    const [isExpanded, setIsExpanded] = useState(false);
    const [isAnimating, setIsAnimating] = useState(false);
    const [refinementInput, setRefinementInput] = useState('');
    // WebContainer State
    const [webContainerUrl, setWebContainerUrl] = useState<string | null>(null);
    const [isWebContainerBooting, setIsWebContainerBooting] = useState(false);
    const [webContainerError, setWebContainerError] = useState<string | null>(null);

    // Local refinement messages (appended to project chat)
    const [localRefinements, setLocalRefinements] = useState<Array<{ role: 'user' | 'assistant'; message: string }>>([]);
    // AI Test state with live streaming
    const [isAITesting, setIsAITesting] = useState(false);
    const [liveFrame, setLiveFrame] = useState<string | null>(null);
    const [testScenarios, setTestScenarios] = useState<Array<{
        id: string;
        type: string;
        target: string;
        description: string;
        status: 'pending' | 'running' | 'passed' | 'failed';
        error?: string;
    }>>([]);
    const [testSummary, setTestSummary] = useState<{
        status: 'idle' | 'running' | 'passed' | 'failed';
        passedCount: number;
        failedCount: number;
        summary?: string;
    }>({ status: 'idle', passedCount: 0, failedCount: 0 });
    const [autofixStatus, setAutofixStatus] = useState<{ attempt: number; maxAttempts: number } | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const sessionIdRef = useRef<string | null>(null);
    const [containerInstance, setContainerInstance] = useState<WebContainer | null>(null);
    const [activeTab, setActiveTab] = useState<'preview' | 'terminal'>('preview');

    // Handle escape key to close
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    // Animate in when opened and start at 75% size
    useEffect(() => {
        if (isOpen) {
            setIsAnimating(true);
            setIsExpanded(false); // Start at 75% size
            const timer = setTimeout(() => setIsAnimating(false), 300);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    // Boot WebContainer in background when opened
    useEffect(() => {
        let isMounted = true;
        const bootContainer = async () => {
            if (!isOpen || !wireframeCode || webContainerUrl || isWebContainerBooting) return;

            // Only supported in contexts with COOP/COEP
            if (!webContainerService.isSupported()) {
                console.warn('[Prototype] WebContainers not supported (missing headers?). Preview will use srcDoc instead.');
                // Not an error - srcDoc rendering still works
                return;
            }

            try {
                setIsWebContainerBooting(true);
                setWebContainerError(null);

                // 1. Boot
                await webContainerService.boot();

                // 2. Mount files
                const tree = fileMountService.createTreeFromCode(wireframeCode);
                await webContainerService.mount(tree);

                // 2b. Attach File Watcher (Sync Engine)
                const containerInstance = await webContainerService.getInstanceOrThrow();
                setContainerInstance(containerInstance);
                fileWatchService.attach(containerInstance, projectName || 'temp-project');

                // 3. Register server-ready listener BEFORE starting server (fix race condition)
                const container = await webContainerService.getInstanceOrThrow();
                container.on('server-ready', (port, url) => {
                    if (isMounted) {
                        console.log('[Prototype] Sandbox ready at:', url);
                        setWebContainerUrl(url);
                        setIsWebContainerBooting(false);
                    }
                });

                // 4. Start built-in Node.js server (no npm install needed!)
                webContainerService.run('node', ['server.js'], (data) => {
                    console.log('[Prototype Server]', data);
                });

                // 6. Timeout fallback - if server-ready never fires, end booting after 30s
                // This prevents the "Booting Sandbox..." from showing forever
                setTimeout(() => {
                    if (isMounted) {
                        // Use functional update to check current state
                        setIsWebContainerBooting(current => {
                            if (current) {
                                console.warn('[Prototype] Sandbox boot timeout - continuing without sandbox URL');
                                return false;
                            }
                            return current;
                        });
                    }
                }, 30000);

            } catch (err: any) {
                console.error('[Prototype] Sandbox boot failed:', err);
                if (isMounted) {
                    setWebContainerError(err.message);
                    setIsWebContainerBooting(false);
                }
            }
        };

        if (isOpen && !webContainerUrl) {
            bootContainer();
        }

        return () => { isMounted = false; };
    }, [isOpen, wireframeCode]);

    // WebSocket listener for CUA live events
    useEffect(() => {
        // Listen for WebSocket events from socket.io
        const handleCuaFrame = (event: CustomEvent) => {
            const { sessionId, frame } = event.detail;
            // Only log matching frames to reduce console noise from stale sessions
            if (sessionId === sessionIdRef.current) {
                console.log('[CUA Frame] Received matching frame:', {
                    sessionId,
                    frameSize: frame?.length || 0
                });
                setLiveFrame(frame);
            }
            // Silently ignore frames from old/mismatched sessions
        };

        const handleCuaScenarios = (event: CustomEvent) => {
            const { sessionId, scenarios } = event.detail;
            if (sessionId === sessionIdRef.current) {
                setTestScenarios(scenarios);
            }
        };

        const handleCuaScenarioResult = (event: CustomEvent) => {
            const { sessionId, scenario } = event.detail;
            if (sessionId === sessionIdRef.current) {
                setTestScenarios(prev => prev.map(s =>
                    s.id === scenario.id ? { ...s, ...scenario } : s
                ));
                if (scenario.status === 'passed') {
                    setTestSummary(prev => ({ ...prev, passedCount: prev.passedCount + 1 }));
                } else if (scenario.status === 'failed') {
                    setTestSummary(prev => ({ ...prev, failedCount: prev.failedCount + 1 }));
                }
            }
        };

        const handleCuaComplete = (event: CustomEvent) => {
            const { sessionId, status, summary } = event.detail;
            if (sessionId === sessionIdRef.current) {
                setTestSummary(prev => ({ ...prev, status, summary }));
                setIsAITesting(false);
                setAutofixStatus(null);
            }
        };

        const handleCuaAutofixAttempt = (event: CustomEvent) => {
            const { sessionId, attempt, maxAttempts } = event.detail;
            if (sessionId === sessionIdRef.current) {
                setAutofixStatus({ attempt, maxAttempts });
                if (attempt > 1) {
                    setLiveFrame(null); // Clear frame between attempts to show reload
                }
            }
        };

        window.addEventListener('cua:frame', handleCuaFrame as EventListener);
        window.addEventListener('cua:scenarios', handleCuaScenarios as EventListener);
        window.addEventListener('cua:scenario:result', handleCuaScenarioResult as EventListener);
        window.addEventListener('cua:test:complete', handleCuaComplete as EventListener);
        window.addEventListener('cua:autofix:attempt', handleCuaAutofixAttempt as EventListener);

        return () => {
            window.removeEventListener('cua:frame', handleCuaFrame as EventListener);
            window.removeEventListener('cua:scenarios', handleCuaScenarios as EventListener);
            window.removeEventListener('cua:scenario:result', handleCuaScenarioResult as EventListener);
            window.removeEventListener('cua:test:complete', handleCuaComplete as EventListener);
            window.removeEventListener('cua:autofix:attempt', handleCuaAutofixAttempt as EventListener);
        };
    }, []);

    // Run live CUA test
    const runCUATest = useCallback(async () => {
        if (isAITesting || !wireframeCode) return;

        // Cancel any previous session before starting a new one
        const previousSessionId = sessionIdRef.current;
        if (previousSessionId) {
            try {
                await fetch('/api/cua/session/cancel', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sessionId: previousSessionId })
                });
                console.log('[CUA] Cancelled previous session:', previousSessionId);
            } catch (e) {
                // Ignore cancel errors - best effort cleanup
            }
        }

        // Ensure WebSocket is connected for CUA live events
        websocketClient.connectForCUA();

        const sessionId = `cua-${Date.now()}`;
        sessionIdRef.current = sessionId;

        setIsAITesting(true);
        setLiveFrame(null);
        setTestScenarios([]);
        setTestSummary({ status: 'running', passedCount: 0, failedCount: 0 });
        setAutofixStatus(null);

        try {
            // Call CUA backend API with auto-fix enabled - this waits for real test completion
            const response = await fetch('/api/cua/test/autofix', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    html: wireframeCode,
                    projectId: projectName || 'temp-project', // Send ID so backend can use synced files
                    sessionId,
                    maxRetries: 2
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[CUA] API Request Failed:', {
                    status: response.status,
                    statusText: response.statusText,
                    body: errorText
                });

                let errorMessage = `CUA API request failed: ${response.status}`;
                try {
                    const errorJson = JSON.parse(errorText);
                    if (errorJson.error) errorMessage += ` - ${errorJson.error}`;
                    if (errorJson.errors) errorMessage += ` - ${errorJson.errors.map((e: any) => e.msg).join(', ')}`;
                } catch (e) {
                    errorMessage += ` - ${errorText.substring(0, 100)}`;
                }

                throw new Error(errorMessage);
            }

            const data = await response.json();
            console.log('[CUA] Real test completed:', {
                sessionId: data.sessionId,
                status: data.status,
                passedCount: data.passedCount,
                failedCount: data.failedCount,
                autoFixApplied: data.autoFixApplied,
                attempts: data.attempts
            });

            // Use the REAL test results from the API response
            if (data.scenarios && Array.isArray(data.scenarios)) {
                // Map API scenarios to our format with real statuses
                const realScenarios = data.scenarios.map((s: any) => ({
                    id: s.id,
                    type: s.type,
                    target: s.target,
                    description: s.description,
                    status: s.status as 'pending' | 'running' | 'passed' | 'failed',
                    error: s.error
                }));
                setTestScenarios(realScenarios);
            }

            // Update summary with REAL results
            setTestSummary({
                status: data.status as 'running' | 'passed' | 'failed',
                passedCount: data.passedCount || 0,
                failedCount: data.failedCount || 0,
                summary: data.summary || (data.status === 'passed'
                    ? `✓ All ${data.passedCount} tests passed`
                    : `✗ ${data.failedCount} test(s) failed`)
            });

            // Log auto-fix info if applied
            if (data.autoFixApplied) {
                console.log('[CUA] Auto-fix was applied! Attempts:', data.attempts);
                console.log('[CUA] Fix changes:', data.fixChanges);
            }

            setIsAITesting(false);

        } catch (error) {
            console.error('[CUA] Backend test failed:', error);
            // Even fallback should report as failed, not fake success
            setTestSummary({
                status: 'failed',
                passedCount: 0,
                failedCount: 1,
                summary: `✗ Test failed: ${error instanceof Error ? error.message : 'Connection error'}`
            });
            setIsAITesting(false);
        }
    }, [isAITesting, wireframeCode]);

    // Note: simulateFallback function has been removed - we now use real API test results only
    // Tests will report actual pass/fail status from the backend CUA service

    // Auto-start CUA testing when prototype opens
    useEffect(() => {
        if (isOpen && wireframeCode && testSummary.status === 'idle') {
            // Wait 2s to allow file watcher to sync files to backend before starting test
            const timer = setTimeout(() => {
                runCUATest();
            }, 2000);
            return () => clearTimeout(timer);
        }
    }, [isOpen, wireframeCode, testSummary.status, runCUATest]);

    // Scroll chat to bottom when new messages arrive
    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [localRefinements, conversationMessages]);

    // Handle refinement submission
    const handleRefinementSubmit = useCallback(async () => {
        const message = refinementInput.trim();
        if (!message || isRefining || !onRefine) return;

        // Add user message to local refinements
        setLocalRefinements(prev => [...prev, { role: 'user', message }]);
        setRefinementInput('');

        try {
            await onRefine(message);
            // Add success message
            setLocalRefinements(prev => [...prev, {
                role: 'assistant',
                message: '✨ Applied your changes! Check the preview above.'
            }]);
        } catch (error) {
            setLocalRefinements(prev => [...prev, {
                role: 'assistant',
                message: '❌ Failed to apply changes. Please try again.'
            }]);
        }
    }, [refinementInput, isRefining, onRefine]);

    // Handle Enter key in input
    const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleRefinementSubmit();
        }
    }, [handleRefinementSubmit]);

    if (!isOpen) return null;

    const mockUrl = `orbitai://preview/${projectName.toLowerCase().replace(/\s+/g, '-')}`;

    // Use portal to render at document body level for true fullscreen overlay
    return createPortal(
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/80 backdrop-blur-md z-[99998] transition-opacity duration-300"
                style={{ opacity: isAnimating ? 0 : 1 }}
                onClick={onClose}
            />

            {/* Toast Container - 75% default, 100% maximized */}
            <div
                ref={containerRef}
                className={`fixed z-[99999] transition-all duration-300 ease-out ${isExpanded
                    ? 'inset-0'
                    : 'inset-[12.5%] rounded-2xl'
                    }`}
                style={{
                    transform: isAnimating ? 'translateY(20px) scale(0.98)' : 'translateY(0) scale(1)',
                    opacity: isAnimating ? 0 : 1
                }}
            >
                <div className="w-full h-full bg-slate-900 rounded-2xl shadow-2xl border border-slate-700/50 overflow-hidden flex flex-col">
                    {/* Browser Chrome */}
                    <div className="bg-gradient-to-b from-slate-800 to-slate-850 px-3 py-2 flex items-center gap-3 border-b border-slate-700/50 shrink-0">
                        {/* Traffic Lights */}
                        <div className="flex items-center gap-1.5">
                            <button
                                onClick={onClose}
                                className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-400 transition-colors flex items-center justify-center group"
                                title="Close"
                            >
                                <X size={8} className="text-red-900 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                            <button
                                onClick={() => setIsExpanded(false)}
                                className="w-3 h-3 rounded-full bg-yellow-500 hover:bg-yellow-400 transition-colors flex items-center justify-center group"
                                title="Minimize"
                            >
                                <Minus size={8} className="text-yellow-900 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                            <button
                                onClick={() => setIsExpanded(!isExpanded)}
                                className="w-3 h-3 rounded-full bg-green-500 hover:bg-green-400 transition-colors flex items-center justify-center group"
                                title={isExpanded ? 'Restore' : 'Maximize'}
                            >
                                <Square size={6} className="text-green-900 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                        </div>

                        {/* URL Bar */}
                        <div className="flex-1 flex items-center bg-slate-900/50 rounded-lg px-3 py-1.5 gap-2 border border-slate-700/30">
                            <Globe size={14} className="text-slate-500" />
                            <span className="text-slate-400 text-xs font-mono truncate">{mockUrl}</span>
                        </div>

                        {/* Expand Button */}
                        <button
                            onClick={() => setIsExpanded(!isExpanded)}
                            className="p-1.5 hover:bg-slate-700/50 rounded-lg transition-colors"
                            title={isExpanded ? 'Shrink' : 'Expand'}
                        >
                            {isExpanded ? (
                                <Minimize2 size={14} className="text-slate-400" />
                            ) : (
                                <Maximize2 size={14} className="text-slate-400" />
                            )}
                        </button>
                    </div>

                    {/* Preview Title Bar */}
                    <div className="bg-gradient-to-r from-primary/20 via-purple-600/20 to-pink-500/20 px-4 py-2 flex items-center justify-between border-b border-slate-700/30 shrink-0">
                        <div className="flex items-center gap-2">
                            <Play size={16} className="text-primary" />
                            <span className="text-sm font-medium text-white">{projectName} Preview</span>
                            <span className="text-xs text-slate-400">• Test & refine your prototype</span>

                            {/* Tabs */}
                            <div className="flex bg-slate-800/50 rounded-lg p-0.5 ml-4 border border-slate-700/50">
                                <button
                                    onClick={() => setActiveTab('preview')}
                                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${activeTab === 'preview'
                                        ? 'bg-primary text-white shadow-sm'
                                        : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                                        }`}
                                >
                                    Preview
                                </button>
                                <button
                                    onClick={() => setActiveTab('terminal')}
                                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${activeTab === 'terminal'
                                        ? 'bg-primary text-white shadow-sm'
                                        : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                                        }`}
                                >
                                    Terminal
                                </button>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {/* AI Test Button - Also allows manual re-run */}
                            <button
                                onClick={() => {
                                    // Reset and re-run if already completed
                                    if (testSummary.status === 'passed' || testSummary.status === 'failed') {
                                        setTestSummary({ status: 'idle', passedCount: 0, failedCount: 0 });
                                        setAutofixStatus(null);
                                        setTestScenarios([]);
                                        setLiveFrame(null);
                                        setTimeout(() => runCUATest(), 100);
                                    } else {
                                        runCUATest();
                                    }
                                }}
                                disabled={isAITesting}
                                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${isAITesting
                                    ? 'bg-cyan-600 text-white cursor-wait'
                                    : testSummary.status === 'passed'
                                        ? 'bg-green-600 hover:bg-green-500 text-white'
                                        : testSummary.status === 'failed'
                                            ? 'bg-red-600 hover:bg-red-500 text-white'
                                            : 'bg-cyan-600 hover:bg-cyan-500 text-white'
                                    }`}
                                title={testSummary.status === 'idle' ? 'CUA tests run automatically' : 'Click to re-run tests'}
                            >
                                {isAITesting ? (
                                    <Loader2 size={12} className="animate-spin" />
                                ) : testSummary.status === 'passed' ? (
                                    <CheckCircle2 size={12} />
                                ) : testSummary.status === 'failed' ? (
                                    <XCircle size={12} />
                                ) : (
                                    <Bot size={12} />
                                )}
                                {isAITesting ? 'Testing...' : testSummary.status === 'passed' ? '✓ Passed' : testSummary.status === 'failed' ? '✗ Failed' : 'AI Test'}
                            </button>
                            <button
                                onClick={onRegenerate}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs font-medium rounded-lg transition-all"
                            >
                                <RotateCcw size={12} />
                                Regenerate
                            </button>
                            <button
                                onClick={onApprove}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 text-white text-xs font-medium rounded-lg transition-all shadow-lg shadow-primary/25"
                            >
                                <Check size={12} />
                                Approve
                            </button>
                        </div>
                    </div>

                    {/* Main Content Area */}
                    <div className="flex-1 flex flex-col lg:flex-row min-h-0 relative">
                        {/* TERMINAL VIEW */}
                        {activeTab === 'terminal' && (
                            <div className="absolute inset-0 z-40 bg-slate-900 border-b border-slate-700">
                                {containerInstance ? (
                                    <WebTerminal webContainerInstance={containerInstance} />
                                ) : (
                                    <div className="flex items-center justify-center h-full text-slate-400">
                                        <div className="flex flex-col items-center gap-2">
                                            <Loader2 className="animate-spin" />
                                            <span>Booting Terminal...</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* FULL-SCREEN CUA TEST OVERLAY */}
                        {isAITesting && activeTab === 'preview' && (
                            <div className="absolute inset-0 z-50 bg-slate-900/95 backdrop-blur-sm flex flex-col items-center justify-center p-8">
                                {/* Header */}
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-3 h-3 bg-cyan-500 rounded-full animate-pulse" />
                                    <span className="text-xl font-semibold text-white">AI Agent Testing Prototype...</span>
                                    <Loader2 size={20} className="text-cyan-400 animate-spin" />
                                </div>

                                {/* Large Live Frame */}
                                <div className="w-full max-w-3xl aspect-video rounded-xl border-2 border-cyan-500/50 overflow-hidden shadow-2xl shadow-cyan-500/20 bg-slate-900 mb-6 relative">
                                    {liveFrame ? (
                                        <img src={liveFrame} alt="Live agent view" className="w-full h-full object-contain" />
                                    ) : wireframeCode ? (
                                        <>
                                            {/* Show actual prototype in background */}
                                            <PreviewFrame
                                                artifact={{
                                                    id: 'preview-testing',
                                                    type: 'wireframe',
                                                    content: wireframeCode,
                                                    name: projectName
                                                }}
                                                theme={undefined}
                                            />
                                            {/* Testing overlay */}
                                            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center">
                                                <div className="flex flex-col items-center gap-3 text-center">
                                                    <Loader2 size={40} className="text-cyan-400 animate-spin" />
                                                    <span className="text-white text-sm font-medium">
                                                        {autofixStatus && autofixStatus.attempt > 1
                                                            ? `AI is auto-fixing prototype...`
                                                            : `AI Agent is testing...`}
                                                    </span>
                                                    <span className="text-slate-400 text-xs text-center px-4">
                                                        {autofixStatus && autofixStatus.attempt > 1
                                                            ? `Attempt ${autofixStatus.attempt} of ${autofixStatus.maxAttempts}`
                                                            : `Analyzing prototype and starting live feed`}
                                                    </span>
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-slate-500">
                                            <div className="flex flex-col items-center gap-3">
                                                <Loader2 size={40} className="animate-spin" />
                                                <span className="text-sm">Preparing prototype...</span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Scenario Progress */}
                                <div className="w-full max-w-3xl bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <Zap size={16} className="text-cyan-400" />
                                            <span className="text-sm font-medium text-white">Test Scenarios</span>
                                        </div>
                                        <span className="text-xs text-slate-400">
                                            {testSummary.passedCount + testSummary.failedCount}/{testScenarios.length} completed
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                                        {testScenarios.map(scenario => (
                                            <div
                                                key={scenario.id}
                                                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${scenario.status === 'running' ? 'bg-cyan-600/30 border border-cyan-500/50' :
                                                    scenario.status === 'passed' ? 'bg-green-600/20 border border-green-500/30' :
                                                        scenario.status === 'failed' ? 'bg-red-600/20 border border-red-500/30' :
                                                            'bg-slate-700/30 border border-slate-600/30'
                                                    }`}
                                            >
                                                {scenario.status === 'pending' ? (
                                                    <div className="w-3 h-3 rounded-full bg-slate-500" />
                                                ) : scenario.status === 'running' ? (
                                                    <Loader2 size={12} className="text-cyan-400 animate-spin" />
                                                ) : scenario.status === 'passed' ? (
                                                    <CheckCircle2 size={12} className="text-green-400" />
                                                ) : (
                                                    <XCircle size={12} className="text-red-400" />
                                                )}
                                                <span className={`text-xs truncate ${scenario.status === 'running' ? 'text-cyan-300 font-medium' :
                                                    scenario.status === 'passed' ? 'text-green-300' :
                                                        scenario.status === 'failed' ? 'text-red-300' :
                                                            'text-slate-400'
                                                    }`}>
                                                    {scenario.target}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Skip button */}
                                <button
                                    onClick={() => setIsAITesting(false)}
                                    className="mt-6 px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
                                >
                                    Skip to results →
                                </button>

                            </div>
                        )}


                        {/* Test Complete Overlay - Shows briefly after testing */}
                        {!isAITesting && testSummary.status !== 'idle' && testSummary.summary && (
                            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 px-6 py-3 rounded-xl bg-slate-800/90 backdrop-blur border border-slate-700/50 shadow-xl">
                                <div className="flex items-center gap-3">
                                    {testSummary.status === 'passed' ? (
                                        <CheckCircle2 size={20} className="text-green-400" />
                                    ) : (
                                        <XCircle size={20} className="text-red-400" />
                                    )}
                                    <span className={`text-sm font-medium ${testSummary.status === 'passed' ? 'text-green-300' : 'text-red-300'}`}>
                                        {testSummary.summary}
                                    </span>
                                    <button
                                        onClick={() => setTestSummary({ status: 'idle', passedCount: 0, failedCount: 0 })}
                                        className="ml-2 text-slate-400 hover:text-white"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Preview Content */}
                        <div className="flex-1 bg-white overflow-hidden relative min-h-[300px]">
                            {wireframeCode ? (
                                <PreviewFrame
                                    url={webContainerUrl}
                                    artifact={{
                                        type: 'wireframe',
                                        name: projectName,
                                        content: wireframeCode
                                    }}
                                    theme={undefined}
                                />
                            ) : (
                                <div className="flex items-center justify-center h-full text-slate-400">
                                    <p>No preview available</p>
                                </div>
                            )}

                            {/* Refining overlay */}
                            {isRefining && (
                                <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center">
                                    <div className="flex items-center gap-3 bg-slate-800 px-6 py-4 rounded-xl shadow-xl">
                                        <Loader2 size={24} className="text-primary animate-spin" />
                                        <span className="text-white font-medium">Applying changes...</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Refinement Chat Panel - Continues Project Chat */}
                        <div className="w-full lg:w-96 bg-slate-850 border-t lg:border-t-0 lg:border-l border-slate-700/50 flex flex-col shrink-0">
                            {/* Chat Header */}
                            <div className="px-4 py-3 border-b border-slate-700/50 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <MessageSquare size={16} className="text-primary" />
                                    <h2 className="text-sm font-semibold text-slate-900">{projectName}</h2>

                                    {/* WebContainer Status Badges */}
                                    {isWebContainerBooting && (
                                        <span className="flex items-center gap-1.5 px-2 py-0.5 bg-amber-500/10 text-amber-600 text-[10px] font-medium rounded-full border border-amber-500/20">
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                            Booting Sandbox...
                                        </span>
                                    )}
                                    {webContainerUrl && (
                                        <span className="flex items-center gap-1.5 px-2 py-0.5 bg-green-500/10 text-green-600 text-[10px] font-medium rounded-full border border-green-500/20">
                                            <CheckCircle2 className="w-3 h-3" />
                                            Sandbox Active
                                        </span>
                                    )}
                                    {webContainerError && (
                                        <span className="flex items-center gap-1.5 px-2 py-0.5 bg-red-500/10 text-red-600 text-[10px] font-medium rounded-full border border-red-500/20" title={webContainerError}>
                                            <XCircle className="w-3 h-3" />
                                            Sandbox Failed
                                        </span>
                                    )}
                                    <span className="text-sm font-medium text-white">Project Chat</span>
                                </div>
                                <span className="text-xs text-slate-500">
                                    {conversationMessages.length + localRefinements.length} messages
                                </span>
                            </div>

                            {/* Chat History - Project Messages + Refinements */}
                            <div
                                ref={chatContainerRef}
                                className="flex-1 overflow-y-auto p-3 space-y-2 min-h-[150px]"
                            >
                                {/* Show last 10 project conversation messages */}
                                {conversationMessages.slice(-10).map((msg, i) => (
                                    <div
                                        key={`conv-${i}`}
                                        className={`text-xs p-2.5 rounded-lg ${msg.role === 'user'
                                            ? 'bg-blue-600/20 text-blue-100 ml-6 border-l-2 border-blue-500'
                                            : msg.role === 'system'
                                                ? 'bg-slate-700/30 text-slate-400 text-center italic'
                                                : 'bg-slate-700/50 text-slate-200 mr-6 border-l-2 border-slate-500'
                                            }`}
                                    >
                                        {msg.role === 'user' && <span className="text-blue-400 text-[10px] block mb-1">You</span>}
                                        {msg.role === 'assistant' && <span className="text-slate-400 text-[10px] block mb-1">AI</span>}
                                        <div className="line-clamp-3">{msg.content}</div>
                                    </div>
                                ))}

                                {/* Separator if there are project messages */}
                                {conversationMessages.length > 0 && localRefinements.length > 0 && (
                                    <div className="flex items-center gap-2 py-2">
                                        <div className="flex-1 h-px bg-primary/30" />
                                        <Sparkles size={12} className="text-primary" />
                                        <span className="text-[10px] text-primary/70">Refinements</span>
                                        <div className="flex-1 h-px bg-primary/30" />
                                    </div>
                                )}

                                {/* Local refinements */}
                                {localRefinements.map((msg, i) => (
                                    <div
                                        key={`ref-${i}`}
                                        className={`text-xs p-2.5 rounded-lg ${msg.role === 'user'
                                            ? 'bg-primary/20 text-white ml-6 border-l-2 border-primary'
                                            : 'bg-green-900/30 text-green-200 mr-6 border-l-2 border-green-500'
                                            }`}
                                    >
                                        {msg.message}
                                    </div>
                                ))}

                                {/* Empty state */}
                                {conversationMessages.length === 0 && localRefinements.length === 0 && (
                                    <div className="text-center text-slate-500 text-xs py-6">
                                        <Sparkles size={20} className="mx-auto mb-2 text-slate-600" />
                                        <p className="font-medium">Refine your prototype</p>
                                        <p className="mt-2 text-slate-600">Try:</p>
                                        <p className="text-slate-400 italic">"Make the header blue"</p>
                                        <p className="text-slate-400 italic">"Add a dark mode toggle"</p>
                                    </div>
                                )}
                            </div>

                            {/* Chat Input */}
                            <div className="p-3 border-t border-slate-700/50">
                                <div className="flex items-center gap-2">
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        value={refinementInput}
                                        onChange={(e) => setRefinementInput(e.target.value)}
                                        onKeyPress={handleKeyPress}
                                        placeholder="Describe changes..."
                                        disabled={isRefining || !onRefine}
                                        className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
                                    />
                                    <button
                                        onClick={handleRefinementSubmit}
                                        disabled={!refinementInput.trim() || isRefining || !onRefine}
                                        className="p-2 bg-primary hover:bg-primary/90 disabled:bg-slate-700 disabled:cursor-not-allowed rounded-lg transition-colors"
                                        title="Send"
                                    >
                                        {isRefining ? (
                                            <Loader2 size={18} className="text-white animate-spin" />
                                        ) : (
                                            <Send size={18} className="text-white" />
                                        )}
                                    </button>
                                </div>
                                {!onRefine && (
                                    <p className="text-xs text-slate-500 mt-2 text-center">
                                        Refinement not available
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div >
        </>,
        document.body
    );
};

export default React.memo(PrototypePreviewToast);
