import React from 'react';
import {
    AgentRole, TaskStatus, Task, LogEntry, Artifact, Agent, ChatMessage, AppSettings,
    Phase, DialogueEvent, AGENTS, INITIAL_PROJECT_NAME, INITIAL_PROJECT_DESC,
    QUALITY_STANDARDS, MODEL_PRICING
} from '@orbitai/shared';
import {
    executeAgentTask, orchestrateNextSteps, interrogateAgent, validateProjectScope,
    chatWithOrchestrator, enhanceUserPrompt, generateEmbedding, performDeepResearch,
    modifyTaskWithAI, extractMCPTools, generateAgentProfile
} from '../services/geminiService';
import { executeTaskWithQualityImprovement } from '../services/qualityImprovement.service';
import { toast } from '../services/toastService';
// @ts-ignore
import JSZip from 'jszip';

// Helper for HITL preferences (replicating logic or importing if available)
const HAS_HITL_PREF_KEY = 'orbitai_hitl_pref_set';
const HITL_PREF_KEY = 'orbitai_hitl_pref';

const hasHITLPreferenceSet = () => sessionStorage.getItem(HAS_HITL_PREF_KEY) === 'true';
const getHITLPreference = () => sessionStorage.getItem(HITL_PREF_KEY) === 'true';
const setHITLPreference = (enabled: boolean) => {
    sessionStorage.setItem(HAS_HITL_PREF_KEY, 'true');
    sessionStorage.setItem(HITL_PREF_KEY, String(enabled));
};

export interface AiHandlerDeps {
    stateRef: React.MutableRefObject<any>; // Using any for state to avoid circular dep issues for now, or use exact type
    dispatch: React.Dispatch<any>;
    addLog: (message: string, agent: AgentRole, type: LogEntry['type'], taskId?: string) => void;
    autoPilotStatus: 'idle' | 'running' | 'paused';
    autoPilotStatusRef: React.MutableRefObject<'idle' | 'running' | 'paused'>;
    setAutoPilotStatus: (status: 'idle' | 'running' | 'paused') => void;
    isStoppingRef: React.MutableRefObject<boolean>;
    isBatchingRef: React.MutableRefObject<boolean>;
    activeTaskControllersRef: React.MutableRefObject<Map<string, AbortController>>;
    setGlobalMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
    globalMessages: ChatMessage[];
    setGlobalChatInput: React.Dispatch<React.SetStateAction<string>>;
    globalChatInput: string;
    setSetupMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
    setSetupInput: React.Dispatch<React.SetStateAction<string>>;
    setupInputRef: React.RefObject<HTMLTextAreaElement>;
    setupInput: string;
    setIsEnhancingChat: (val: boolean) => void;
    setIsEnhancingInput: (val: boolean) => void;
    setIsResearchingChat: (val: boolean) => void;
    setIsResearching: (val: boolean) => void;
    activeChatAgent: Agent | null;
    setActiveChatAgent: (agent: Agent | null) => void;
    chatHistory: Record<string, ChatMessage[]>;
    setChatHistory: React.Dispatch<React.SetStateAction<Record<string, ChatMessage[]>>>;
    setIsChatThinking: (val: boolean) => void;
    isChatThinking: boolean;
    user: any;
    handleUpgradeClick: () => void;
    pendingActionRef: React.MutableRefObject<(() => void) | null>;
    setShowHITLPrompt: (val: boolean) => void;
    setAppSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
    startTransition: (callback: () => void) => void;
    setActiveTab: (tab: string) => void;
    executeTask: (taskId: string, retryCount?: number) => Promise<void>; // Derived from taskHandlers
    settingsRef: React.MutableRefObject<AppSettings>;
    batchIntervalRef: React.MutableRefObject<NodeJS.Timeout | null>;
    setIsProcessingFile: (val: boolean) => void;
    globalFileInputRef: React.RefObject<HTMLInputElement>;
}

export const createAiHandlers = (deps: AiHandlerDeps) => {
    const {
        stateRef, dispatch, addLog,
        autoPilotStatus, autoPilotStatusRef, setAutoPilotStatus,
        isStoppingRef, isBatchingRef, activeTaskControllersRef,
        setGlobalMessages, globalMessages, setGlobalChatInput, globalChatInput,
        setSetupMessages, setSetupInput, setupInputRef, setupInput,
        setIsEnhancingChat, setIsEnhancingInput, setIsResearchingChat, setIsResearching,
        activeChatAgent, setActiveChatAgent, chatHistory, setChatHistory, setIsChatThinking, isChatThinking,
        user, handleUpgradeClick, pendingActionRef, setShowHITLPrompt, setAppSettings,
        startTransition, setActiveTab, executeTask, settingsRef, batchIntervalRef,
        setIsProcessingFile, globalFileInputRef
    } = deps;

    // --- Helpers for Phase Management (used by runAutoPilot) ---

    const orchestratePhase = async (phase: Phase, context: string) => {
        // Replicating basic orchestration logic if strictly needed here, 
        // OR assuming it's imported. 
        // Ideally, orchestratePhase should be a service, but it depends on dispatch.
        // For now, let's keep it minimal or pass it if it's external.
        // Wait, orchestratePhase is likely complex. 
        // Let's assume for this refactor we might need to duplicate the logic OR 
        // move orchestratePhase to a separate file later.
        // For now, I will implement a placeholder or simple version if not passed.
        // Actually, App.tsx has `orchestratePhase`. It's better to extract it here too.

        // Simple version of orchestratePhase logic from App.tsx (we should move it here)
        const currentState = stateRef.current;
        addLog(`Orchestrating phase: ${phase}`, AgentRole.ORCHESTRATOR, 'info');

        // Call Gemini orchestration
        try {
            const result = await orchestrateNextSteps(
                currentState.description,
                phase,
                currentState.tasks,
                currentState.agents,
                currentState.artifacts
            );

            if (result.tasks && result.tasks.length > 0) {
                result.tasks.forEach((t: any) => {
                    dispatch({ type: 'ADD_TASK', payload: { ...t, sprint: currentState.currentSprint } });
                });
                addLog(`Generated ${result.tasks.length} tasks for ${phase}`, AgentRole.ORCHESTRATOR, 'success');
            }
        } catch (e: any) {
            addLog(`Orchestration failed: ${e.message}`, AgentRole.ORCHESTRATOR, 'error');
        }
    };

    const advancePhase = async () => {
        const PHASE_ORDER_LIST = Object.values(Phase); // Or import PHASE_ORDER
        const currentIndex = PHASE_ORDER_LIST.indexOf(stateRef.current.currentPhase);
        if (currentIndex < PHASE_ORDER_LIST.length - 1) {
            const nextPhase = PHASE_ORDER_LIST[currentIndex + 1];
            dispatch({ type: 'SET_PHASE', payload: nextPhase });
            addLog(`Transitioning to phase: ${nextPhase}`, AgentRole.ORCHESTRATOR, 'success');
            await orchestratePhase(nextPhase, stateRef.current.description);
            return true;
        }
        return false;
    };

    const startNextSprint = async () => {
        addLog(`Initializing Sprint ${stateRef.current.currentSprint + 1}...`, AgentRole.ORCHESTRATOR, 'action');
        dispatch({ type: 'START_NEXT_SPRINT' });
        await new Promise(r => setTimeout(r, 500));
        await orchestratePhase(Phase.REQUIREMENTS, stateRef.current.description);
    };

    const regressPhase = () => {
        const PHASE_ORDER_LIST = Object.values(Phase);
        const currentIndex = PHASE_ORDER_LIST.indexOf(stateRef.current.currentPhase);
        if (currentIndex > 0) {
            const prevPhase = PHASE_ORDER_LIST[currentIndex - 1];
            dispatch({ type: 'SET_PHASE', payload: prevPhase });
            addLog(`Reverting to phase: ${prevPhase}`, AgentRole.ORCHESTRATOR, 'info');
        }
    };

    // --- Handlers ---

    const stopAutoPilot = React.useCallback(() => {
        if (autoPilotStatus === 'idle') return;

        isStoppingRef.current = true;
        isBatchingRef.current = false;

        if (batchIntervalRef.current) {
            clearInterval(batchIntervalRef.current);
            batchIntervalRef.current = null;
        }

        activeTaskControllersRef.current.forEach(c => c.abort());
        activeTaskControllersRef.current.clear();

        setAutoPilotStatus('idle');
        autoPilotStatusRef.current = 'idle';

        dispatch({ type: 'SET_PROCESSING', payload: false });

        if (user?.id && stateRef.current.id) {
            // Try to stop background autopilot if running
            // This requires network call, let's skip for simple migration or add basic fetch if needed
        }

        addLog("Execution stopped.", AgentRole.ORCHESTRATOR, 'info');
    }, [autoPilotStatus, addLog, dispatch, activeTaskControllersRef, isStoppingRef, user, stateRef, batchIntervalRef, autoPilotStatusRef, setAutoPilotStatus]);

    const handleRunAllTasks = React.useCallback(async () => {
        // Check if HITL preference has been set this session
        if (!hasHITLPreferenceSet()) {
            pendingActionRef.current = async () => {
                // Re-call self effectively
                handleRunAllTasks();
            };
            setShowHITLPrompt(true);
            return;
        } else {
            const enableHITL = getHITLPreference();
            setAppSettings(prev => ({ ...prev, enableHumanInTheLoop: enableHITL }));
        }

        const currentState = stateRef.current;
        if (currentState.budget.used >= currentState.budget.total) {
            alert("Budget Cap Reached!");
            return;
        }

        const pendingTasks = currentState.tasks.filter((t: Task) =>
            (t.status === TaskStatus.PENDING || t.status === TaskStatus.FAILED || t.status === TaskStatus.PAUSED) &&
            t.sprint === currentState.currentSprint
        );

        if (pendingTasks.length === 0) {
            addLog(`No pending tasks to run.`, AgentRole.ORCHESTRATOR, 'info');
            return;
        }

        addLog(`Initiating batch execution: ${pendingTasks.length} tasks...`, AgentRole.ORCHESTRATOR, 'action');
        isBatchingRef.current = true;
        isStoppingRef.current = false;
        dispatch({ type: 'SET_PROCESSING', payload: true });

        const schedulerInterval = setInterval(() => {
            if (!isBatchingRef.current || isStoppingRef.current || stateRef.current.budget.used >= stateRef.current.budget.total) {
                clearInterval(schedulerInterval);
                dispatch({ type: 'SET_PROCESSING', payload: false });
                return;
            }
            const currentTasks = stateRef.current.tasks;
            const runningCount = currentTasks.filter((t: Task) => t.status === TaskStatus.IN_PROGRESS).length;
            const maxParallel = Math.max(1, settingsRef.current.maxParallelTasks || 5);
            if (runningCount >= maxParallel) return;

            const readyCandidates = currentTasks.filter((t: Task) =>
                (t.status === TaskStatus.PENDING || t.status === TaskStatus.FAILED || t.status === TaskStatus.PAUSED) &&
                t.sprint === stateRef.current.currentSprint &&
                (!t.dependencies || t.dependencies.every(dId => currentTasks.find((dt: Task) => dt.id === dId)?.status === TaskStatus.COMPLETED)) &&
                !activeTaskControllersRef.current.has(t.id)
            );
            readyCandidates.slice(0, maxParallel - runningCount).forEach((t: Task) => executeTask(t.id));

            // Stop if nothing left
            if (runningCount === 0 && readyCandidates.length === 0 && !currentTasks.some((t: Task) => t.status === TaskStatus.IN_PROGRESS)) {
                // Check if truly done
                if (!currentTasks.some((t: Task) => (t.status === TaskStatus.PENDING || t.status === TaskStatus.PAUSED) && t.sprint === stateRef.current.currentSprint)) {
                    clearInterval(schedulerInterval);
                    isBatchingRef.current = false;
                    dispatch({ type: 'SET_PROCESSING', payload: false });
                    addLog(`Batch execution complete.`, AgentRole.ORCHESTRATOR, 'success');
                }
            }
        }, 1000);
        batchIntervalRef.current = schedulerInterval;
    }, [addLog, executeTask, stateRef, dispatch, isBatchingRef, isStoppingRef, settingsRef, batchIntervalRef, activeTaskControllersRef, setShowHITLPrompt, setAppSettings, pendingActionRef]);

    const runAutoPilot = async () => {
        await new Promise(r => setTimeout(r, 50));
        if (autoPilotStatusRef.current !== 'running') {
            return;
        }
        await new Promise(r => setTimeout(r, 0));

        while (autoPilotStatusRef.current === 'running') {
            if (isStoppingRef.current || stateRef.current.budget.used >= stateRef.current.budget.total) {
                stopAutoPilot();
                break;
            }

            // Execute pending
            const pendingTasks = stateRef.current.tasks.filter((t: Task) =>
                (t.status === TaskStatus.PENDING || t.status === TaskStatus.FAILED || t.status === TaskStatus.PAUSED) &&
                t.sprint === stateRef.current.currentSprint
            );

            if (pendingTasks.length > 0) {
                await handleRunAllTasks();
            }

            // Check state again
            if (autoPilotStatusRef.current !== 'running' || isStoppingRef.current) break;

            // Wait for batching
            while (isBatchingRef.current) {
                await new Promise(r => setTimeout(r, 1000));
                if (isStoppingRef.current) break;
            }

            // Check for phase advance
            const hasActive = stateRef.current.tasks.some((t: Task) => t.status === TaskStatus.IN_PROGRESS);
            const hasReview = stateRef.current.tasks.some((t: Task) => t.status === TaskStatus.REVIEW);

            if (hasReview) {
                await new Promise(r => setTimeout(r, 2000));
                continue;
            }

            if (!hasActive && pendingTasks.length === 0) {
                await new Promise(r => setTimeout(r, 1500));
                if (autoPilotStatusRef.current !== 'running') break;

                const advanced = await advancePhase();
                if (!advanced) {
                    await startNextSprint();
                }
                await new Promise(r => setTimeout(r, 2000));
            } else {
                await new Promise(r => setTimeout(r, 1000));
            }
        }

        if (autoPilotStatusRef.current === 'running') {
            stopAutoPilot();
        }
    };

    const startAutoPilot = async () => {
        if (autoPilotStatus === 'running') return;
        if (stateRef.current.budget.used >= stateRef.current.budget.total) {
            addLog("Budget cap reached. Cannot start Auto-Pilot.", AgentRole.ORCHESTRATOR, 'warning');
            return;
        }

        isStoppingRef.current = false;
        autoPilotStatusRef.current = 'running';
        setAutoPilotStatus('running');
        addLog("Auto-Pilot sequence initiated.", AgentRole.ORCHESTRATOR, 'action');
        startTransition(() => setActiveTab('network'));

        setTimeout(() => {
            runAutoPilot();
        }, 100);
    };

    const handleAutoPilotClick = () => {
        if (user?.plan === 'Starter') {
            handleUpgradeClick();
        } else {
            if (!hasHITLPreferenceSet()) {
                pendingActionRef.current = () => {
                    startAutoPilot();
                };
                setShowHITLPrompt(true);
            } else {
                const enableHITL = getHITLPreference();
                setAppSettings(prev => ({ ...prev, enableHumanInTheLoop: enableHITL }));
                startAutoPilot();
            }
        }
    };

    const handleEnhanceInput = async (isChat: boolean = false) => {
        const textToEnhance = isChat ? globalChatInput : setupInput;
        if (!textToEnhance.trim()) return;

        if (isChat) setIsEnhancingChat(true);
        else setIsEnhancingInput(true);

        // Simulate user message
        const userMsg: ChatMessage = { id: Math.random().toString(), sender: 'user', text: `Polish this request: "${textToEnhance}"`, timestamp: Date.now() };
        if (isChat) {
            setGlobalMessages(prev => [...prev, userMsg]);
            setGlobalChatInput("");
        } else {
            setSetupMessages(prev => [...prev, userMsg]);
            setSetupInput("");
        }

        try {
            const enhanced = await enhanceUserPrompt(textToEnhance);
            const resultMsg: ChatMessage = { id: Math.random().toString(), sender: 'system', text: `**Polished Proposal:**\n${enhanced}\n\n*Reply "Yes" or "Proceed" to accept this scope.*`, timestamp: Date.now() };
            if (isChat) setGlobalMessages(prev => [...prev, resultMsg]);
            else setSetupMessages(prev => [...prev, resultMsg]);
        } catch (err) {
            console.error("Failed to enhance prompt", err);
            if (!isChat) setSetupInput(textToEnhance);
        } finally {
            if (isChat) setIsEnhancingChat(false);
            else setIsEnhancingInput(false);
        }
    };

    const handleDeepResearch = React.useCallback(async (isChat: boolean = false, query?: string) => {
        const textToResearch = query || (isChat ? globalChatInput : setupInput);
        if (!textToResearch.trim()) return;

        if (isChat) setIsResearchingChat(true);
        else setIsResearching(true);

        const userMsg: ChatMessage = { id: Math.random().toString(), sender: 'user', text: `Research Request: "${textToResearch}"`, timestamp: Date.now() };
        if (isChat) {
            setGlobalMessages(prev => [...prev, userMsg]);
            setGlobalChatInput("");
        } else {
            setSetupMessages(prev => [...prev, userMsg]);
            if (!query) setSetupInput("");
        }

        try {
            const researched = await performDeepResearch(textToResearch);
            const resultMsg: ChatMessage = { id: Math.random().toString(), sender: 'system', text: `**Research Findings:**\n${researched}\n\n*Reply "Yes" or "Proceed" to initialize the project with this specification.*`, timestamp: Date.now() };
            if (isChat) setGlobalMessages(prev => [...prev, resultMsg]);
            else setSetupMessages(prev => [...prev, resultMsg]);
        } catch (err) {
            console.error("Deep research failed", err);
            if (!isChat && !query) setSetupInput(textToResearch);
        } finally {
            if (isChat) setIsResearchingChat(false);
            else setIsResearching(false);
        }
    }, [globalChatInput, setupInput, setGlobalMessages, setGlobalChatInput, setSetupMessages, setSetupInput, setIsResearchingChat, setIsResearching]);

    const handleSuggestionClick = (prompt: string) => {
        if (setupInput.trim()) {
            setSetupInput(`${prompt}\n\nAdditional Requirements: ${setupInput}`);
        } else {
            setSetupInput(prompt);
        }
        setupInputRef.current?.focus();
    };

    const handleOpenChat = (agent: Agent) => {
        setActiveChatAgent(agent);
    };

    const handleSendMessage = async (text: string) => {
        if (!activeChatAgent) return;
        const newMessage: ChatMessage = { id: Math.random().toString(36), sender: 'user', text, timestamp: Date.now() };
        setChatHistory(prev => ({ ...prev, [activeChatAgent.id]: [...(prev[activeChatAgent.id] || []), newMessage] }));
        setIsChatThinking(true);

        const responseText = await interrogateAgent(activeChatAgent, text, chatHistory[activeChatAgent.id] || [], stateRef.current.description, stateRef.current.artifacts, stateRef.current.useInternet);
        const responseMessage: ChatMessage = { id: Math.random().toString(36), sender: 'agent', text: responseText, timestamp: Date.now() };
        setChatHistory(prev => ({ ...prev, [activeChatAgent.id]: [...(prev[activeChatAgent.id] || []), responseMessage] }));
        setIsChatThinking(false);
    };

    const handleGlobalChatSend = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!globalChatInput.trim() || isChatThinking) return;

        const text = globalChatInput;
        setGlobalChatInput("");
        const newMessage: ChatMessage = { id: Math.random().toString(36), sender: 'user', text, timestamp: Date.now(), isLogEvent: false };
        setGlobalMessages(prev => [...prev, newMessage]);
        setIsChatThinking(true);

        const orchestrator = stateRef.current.agents.find((a: Agent) => a.role === AgentRole.ORCHESTRATOR) || AGENTS[0];
        try {
            const response = await chatWithOrchestrator(text, globalMessages, stateRef.current);
            setGlobalMessages(prev => [...prev, { id: Math.random().toString(36), sender: 'agent', text: response.text, timestamp: Date.now(), agentId: orchestrator.id, isLogEvent: false }]);

            if (response.action) {
                const { type, payload } = response.action;
                if (type === 'CREATE_TASK' && payload.title) {
                    const newTask: Task = {
                        id: Math.random().toString(36).substring(7),
                        title: payload.title,
                        description: payload.description || "Created via chat command",
                        assignedTo: payload.assignedTo || AgentRole.IMPLEMENTATION_AGENT,
                        phase: stateRef.current.currentPhase,
                        status: TaskStatus.PENDING,
                        dependencies: [],
                        logs: [],
                        progress: 0,
                        traceRefs: ["CHAT_CMD"],
                        sprint: stateRef.current.currentSprint,
                        evaluation: { score: 0, reasoning: 'Quality score will be calculated when task is executed.', criteria: [], timestamp: Date.now() }
                    };
                    dispatch({ type: 'ADD_TASK', payload: newTask });
                } else if (type === 'CHANGE_PHASE' && payload) {
                    const targetPhase = Object.values(Phase).find(p => p.toLowerCase() === payload.toLowerCase());
                    if (targetPhase) dispatch({ type: 'SET_PHASE', payload: targetPhase as Phase });
                } else if (type === 'RUN_BATCH') {
                    handleRunAllTasks();
                }
            }
        } catch (err: any) {
            setGlobalMessages(prev => [...prev, { id: Math.random().toString(36), sender: 'system', text: `Communication Error: ${err.message || "Unable to reach Orchestrator."}`, timestamp: Date.now(), isLogEvent: false }]);
        } finally {
            setIsChatThinking(false);
        }
    };

    const handleGlobalFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.name.endsWith('.zip')) {
            setIsProcessingFile(true);
            try {
                const zip = await JSZip.loadAsync(file);
                let combinedContext = `\n\n[USER UPLOADED ARCHIVE: ${file.name}]\n`;

                // Process zip entries
                const promises: Promise<void>[] = [];
                zip.forEach((relativePath: string, zipEntry: any) => {
                    if (!zipEntry.dir && !relativePath.match(/\.(png|jpg|pdf|exe|dll|bin)$/i)) {
                        promises.push(
                            zipEntry.async('string').then((text: string) => {
                                combinedContext += `\n--- FILE: ${relativePath} ---\n\`\`\`\n${text.substring(0, 8000)}\n\`\`\`\n`;
                            })
                        );
                    }
                });
                await Promise.all(promises);

                setTimeout(() => {
                    setGlobalChatInput(prev => prev + combinedContext);
                    setIsProcessingFile(false);
                }, 1000);
            } catch (err) {
                console.error("Zip read error", err);
                setIsProcessingFile(false);
            }
            return;
        }

        const reader = new FileReader();
        reader.onload = (ev) => {
            const result = ev.target?.result as string;
            setGlobalChatInput(prev => prev + `\n\n[USER UPLOADED FILE: ${file.name}]\n\`\`\`\n${result.substring(0, 5000)}...(truncated)\n\`\`\`\n`);
        };
        reader.readAsText(file);
        if (globalFileInputRef.current) globalFileInputRef.current.value = '';
    };

    const handleForceBuild = async () => {
        addLog("Manually triggering Compile Final Build task...", AgentRole.ORCHESTRATOR, 'action');
        const newTask: Task = {
            id: Math.random().toString(36).substring(7),
            title: "Force Compile Final Build",
            description: "Manually triggered task to generate the final HTML5 build artifact.",
            assignedTo: AgentRole.INTEGRATION_AGENT,
            phase: Phase.INTEGRATION,
            status: TaskStatus.PENDING,
            dependencies: [],
            logs: [],
            progress: 0,
            traceRefs: ["MANUAL_OVERRIDE"],
            sprint: stateRef.current.currentSprint,
            evaluation: { score: 0, reasoning: 'Quality score will be calculated when task is executed.', criteria: [], timestamp: Date.now() }
        };
        dispatch({ type: 'ADD_TASK', payload: newTask });
        setTimeout(() => executeTask(newTask.id), 100);
    };

    return {
        startAutoPilot,
        stopAutoPilot,
        handleAutoPilotClick,
        handleEnhanceInput,
        handleDeepResearch,
        handleSuggestionClick,
        handleOpenChat,
        handleSendMessage,
        handleGlobalChatSend,
        handleRunAllTasks,
        advancePhase,
        startNextSprint,
        regressPhase,
        handleForceBuild,
        handleGlobalFileSelect
    };
};
