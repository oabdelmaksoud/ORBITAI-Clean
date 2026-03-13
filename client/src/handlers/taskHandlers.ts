
import React from 'react';
import {
    ProjectState,
    Task,
    TaskStatus,
    AgentRole,
    DialogueEvent,
    Artifact,
    MODEL_PRICING,
    AGENTS,
    QUALITY_STANDARDS
} from '@orbitai/shared';
import {
    modifyTaskWithAI,
    generateEmbedding
} from '../services/geminiService';
import { executeTaskWithQualityImprovement } from '../services/qualityImprovement.service';

export interface TaskHandlerDeps {
    stateRef: React.MutableRefObject<ProjectState>;
    dispatch: React.Dispatch<any>;
    addLog: (message: string, agent: AgentRole, type: 'info' | 'warning' | 'error' | 'success' | 'action', taskId?: string) => void;
    setTaskToDelete: (taskId: string | null) => void;
    taskToDelete: string | null;
    activeTaskControllersRef: React.MutableRefObject<Map<string, AbortController>>;
    settingsRef: React.MutableRefObject<any>; // AppSettings
    setGlobalMessages: React.Dispatch<React.SetStateAction<any[]>>;
}

export const createTaskHandlers = (deps: TaskHandlerDeps) => {
    const {
        stateRef,
        dispatch,
        addLog,
        setTaskToDelete,
        taskToDelete,
        activeTaskControllersRef,
        settingsRef,
        setGlobalMessages
    } = deps;

    const handleDeleteTask = (taskId: string) => {
        setTaskToDelete(taskId);
    };

    const confirmDeleteTask = () => {
        if (!taskToDelete) return;
        dispatch({ type: 'DELETE_TASK', payload: taskToDelete });
        addLog("Task deleted by user", AgentRole.ORCHESTRATOR, 'info');
        setTaskToDelete(null);
    };

    const handleUpdateTask = (taskId: string, title: string, description: string) => {
        dispatch({ type: 'UPDATE_TASK_DETAILS', payload: { id: taskId, title, description } });
        addLog(`Task updated by user: ${title}`, AgentRole.ORCHESTRATOR, 'info');
    };

    const handleAiModifyTask = async (taskId: string, instruction: string) => {
        const task = stateRef.current.tasks.find(t => t.id === taskId);
        if (!task) throw new Error("Task not found");

        // Assuming modifyTaskWithAI is an async function that returns updated details
        const newDetails = await modifyTaskWithAI(task, instruction);
        addLog(`Task modified via AI instruction: ${instruction}`, AgentRole.ORCHESTRATOR, 'action');
        return newDetails;
    };

    const handleRunAudit = (standardId: string) => {
        const stdName = QUALITY_STANDARDS.find(s => s.id === standardId)?.name || standardId;
        addLog(`Initiating specific audit task for ${stdName}`, AgentRole.QA_AUDIT_AGENT, 'action');

        // Create new task structure
        const newTask: Task = {
            id: Math.random().toString(36).substring(7),
            title: `Run Compliance Audit: ${stdName}`,
            description: `Conduct a full compliance audit against the ${stdName} standard. Generate a structured Audit Report detailing pass/fail status for key requirements.`,
            assignedTo: AgentRole.QA_AUDIT_AGENT,
            phase: stateRef.current.currentPhase,
            status: TaskStatus.PENDING,
            dependencies: [],
            logs: [],
            progress: 0,
            traceRefs: ["AUDIT", stdName],
            sprint: stateRef.current.currentSprint,
            evaluation: {
                score: 0,
                reasoning: 'Quality score will be calculated when task is executed.',
                criteria: [],
                timestamp: Date.now()
            }
        };

        dispatch({ type: 'ADD_TASK', payload: newTask });

        // Use generic executeTask (which is defined below, hoisted in scope inside this closure? No, const. need to define implementation)
        // We can't immediately call executeTask because it's defined later in this block.
        // Solution: define executeTask function first or use setTimeout inside the returned object?
        // Better: Define executeTaskImpl function variable, then use it.

        setTimeout(() => executeTaskImpl(newTask.id), 100);
    };

    const handleApproveTask = (taskId: string) => {
        dispatch({ type: 'UPDATE_TASK_STATUS', payload: { id: taskId, status: TaskStatus.COMPLETED } });
        addLog(`Quality Gate: Manual approval granted for task ${taskId}.`, AgentRole.QA_AUDIT_AGENT, 'success', taskId);
    };

    const handleRejectTask = (taskId: string) => {
        dispatch({ type: 'UPDATE_TASK_STATUS', payload: { id: taskId, status: TaskStatus.PENDING } });
        dispatch({ type: 'UPDATE_TASK_PROGRESS', payload: { id: taskId, progress: 0 } });
        addLog(`Quality Gate: Task rejected by user. Resetting for refinement.`, AgentRole.QA_AUDIT_AGENT, 'error', taskId);
    };


    const executeTaskImpl = async (taskId: string, retryCount = 0) => {
        const currentState = stateRef.current;
        const task = currentState.tasks.find(t => t.id === taskId);
        if (!task) return;

        // Prevent duplicate execution: check if task is already executing
        // BUT: Allow retries for FAILED tasks (they need to be able to retry)
        const isRetry = retryCount > 0 || task.status === TaskStatus.FAILED;
        if (activeTaskControllersRef.current.has(taskId) && !isRetry) {
            console.warn(`Task ${taskId} (${task.title}) is already executing - skipping duplicate call`);
            return;
        }

        // Also check if task status is already IN_PROGRESS (race condition protection)
        // BUT: Allow retries for FAILED tasks
        if (task.status === TaskStatus.IN_PROGRESS && !isRetry) {
            console.warn(`Task ${taskId} (${task.title}) is already IN_PROGRESS - skipping duplicate call`);
            return;
        }

        // If this is a retry, clear the old controller first
        if (isRetry && activeTaskControllersRef.current.has(taskId)) {
            const oldController = activeTaskControllersRef.current.get(taskId);
            if (oldController) {
                oldController.abort(); // Abort the old execution
            }
            activeTaskControllersRef.current.delete(taskId);
        }

        const controller = new AbortController();
        activeTaskControllersRef.current.set(taskId, controller);

        dispatch({ type: 'SET_PROCESSING', payload: true });
        dispatch({ type: 'UPDATE_TASK_STATUS', payload: { id: taskId, status: TaskStatus.IN_PROGRESS } });
        dispatch({ type: 'UPDATE_TASK_TIMING', payload: { id: taskId, startTime: Date.now() } });

        let agent = currentState.agents.find(a => a.role === task.assignedTo || a.name === task.assignedTo);
        if (!agent) {
            if (currentState.agents.length === 0) {
                addLog(`No agents available to execute task: ${task.title}`, AgentRole.ORCHESTRATOR, 'error', taskId);
                dispatch({ type: 'UPDATE_TASK_STATUS', payload: { id: taskId, status: TaskStatus.FAILED } });
                dispatch({ type: 'SET_PROCESSING', payload: false });
                activeTaskControllersRef.current.delete(taskId);
                return;
            }
            agent = currentState.agents[0];
            addLog(`Agent ${task.assignedTo} not found, using fallback: ${agent.role}`, AgentRole.ORCHESTRATOR, 'warning', taskId);
        }

        addLog(`Starting task execution: ${task.title}`, agent.role, 'action', taskId);

        // Fake progress simulation
        let currentProgress = 0;
        const progressInterval = setInterval(() => {
            currentProgress += 2 + Math.random() * 6;
            if (currentProgress > 95) currentProgress = 95;
            dispatch({ type: 'UPDATE_TASK_PROGRESS', payload: { id: taskId, progress: currentProgress } });
        }, 300);

        const handleCollaboration = (event: DialogueEvent) => {
            dispatch({ type: 'UPDATE_TASK_DIALOGUE', payload: { id: taskId, event } });
            addLog(`[Neural Dialogue] ${event.type.toUpperCase()}: ${event.sender} -> ${event.receiver}`, AgentRole.ORCHESTRATOR, 'info', taskId);

            // Fix: Add to global chat messages so it appears in the UI
            if (event.message) {
                const senderAgent = stateRef.current.agents.find(a => a.role === event.sender) || AGENTS.find(a => a.role === event.sender);
                setGlobalMessages(prev => [...prev, {
                    id: event.id || Math.random().toString(36),
                    sender: 'agent',
                    text: event.message,
                    timestamp: event.timestamp || Date.now(),
                    agentId: senderAgent?.id,
                    isLogEvent: false
                }]);
            }
        };

        try {
            // Execute the task using the imported service
            const result = await executeTaskWithQualityImprovement(
                agent,
                task,
                currentState.description,
                currentState.artifacts,
                currentState.useInternet,
                currentState.mcpServers,
                handleCollaboration,
                currentState.selectedStandards,
                {
                    maxQualityRetries: 3,
                    qualityThreshold: 70,
                    enableHumanInTheLoop: settingsRef.current.enableHumanInTheLoop
                },
                controller.signal
            );

            const { output, resources, tokenUsage, modelUsed: actualModel, evaluation, collaboration } = result;

            if (controller.signal.aborted) throw new Error("Operation cancelled by user.");

            dispatch({ type: 'UPDATE_TASK_PROGRESS', payload: { id: taskId, progress: 100 } });
            dispatch({ type: 'UPDATE_TASK_RESOURCES', payload: { id: taskId, resources } });

            if (evaluation) {
                dispatch({ type: 'UPDATE_TASK_EVALUATION', payload: { id: taskId, evaluation } });
            }

            if (collaboration && collaboration.length > 0) {
                dispatch({ type: 'UPDATE_TASK_COLLABORATION', payload: { id: taskId, collaboration } });
            }

            // Determine Artifact Type based on task phase/title
            let artifactType: Artifact['type'] = 'code';
            const safeTitle = (task.title || "").toLowerCase();

            if (agent.role === AgentRole.NOTEBOOK_AGENT || safeTitle.includes('notebook') || safeTitle.includes('analysis') || safeTitle.includes('data')) artifactType = 'notebook';
            else if (task.phase === Phase.REQUIREMENTS) artifactType = 'requirement';
            else if (task.phase === Phase.ARCHITECTURE) artifactType = 'design';
            else if (task.phase === Phase.TEST_PLANNING) artifactType = 'test-plan';
            else if (task.phase === Phase.IMPLEMENTATION) artifactType = 'code';

            if (safeTitle.includes('build') || safeTitle.includes('compile')) artifactType = 'build';
            else if (safeTitle.includes('audit')) artifactType = 'audit-report';
            else if (safeTitle.includes('image')) artifactType = 'image';

            const updatedTitle = (artifactType === 'code' || artifactType === 'build') ? task.title : `Output: ${task.title}`;

            const existingArtifact = currentState.artifacts.find(a => a.title === updatedTitle && a.type === artifactType);

            if (existingArtifact) {
                if (artifactType === 'notebook') {
                    try {
                        const existingCells = existingArtifact.notebookCells || (existingArtifact.content ? JSON.parse(existingArtifact.content) : []);
                        const newCells = output.includes('[') ? JSON.parse(output) : [{ id: `cell-${Date.now()}`, type: 'markdown', content: output }];
                        // Deduplicate or append? Appending for now
                        const mergedCells = [...existingCells, ...newCells];
                        dispatch({ type: 'UPDATE_ARTIFACT', payload: { id: existingArtifact.id, content: JSON.stringify(mergedCells) } });
                    } catch (e) {
                        dispatch({ type: 'UPDATE_ARTIFACT', payload: { id: existingArtifact.id, content: output } });
                    }
                } else {
                    dispatch({ type: 'UPDATE_ARTIFACT', payload: { id: existingArtifact.id, content: output } });
                }
                addLog(`Artifact updated: ${updatedTitle}`, agent.role, 'success', taskId);
            } else {
                const newArtifactId = Math.random().toString(36).substring(7);
                let notebookCells: any[] | undefined = undefined;
                let artifactContent = output;

                if (artifactType === 'notebook') {
                    try {
                        if (output.trim().startsWith('[')) {
                            notebookCells = JSON.parse(output);
                            artifactContent = JSON.stringify(notebookCells);
                        } else {
                            notebookCells = [{ id: `cell-${Date.now()}`, type: 'markdown', content: output }];
                            artifactContent = JSON.stringify(notebookCells);
                        }
                    } catch (e) {
                        notebookCells = [{ id: `cell-${Date.now()}`, type: 'markdown', content: output }];
                        artifactContent = JSON.stringify(notebookCells);
                    }
                }

                const artifact: Artifact = {
                    id: newArtifactId,
                    title: updatedTitle,
                    content: artifactContent,
                    type: artifactType,
                    phase: task.phase,
                    createdBy: agent.role,
                    timestamp: Date.now(),
                    tags: [task.phase],
                    traceRefs: task.traceRefs,
                    notebookCells: notebookCells
                };
                dispatch({ type: 'ADD_ARTIFACT', payload: artifact });

                if (artifactType !== 'image' && artifactType !== 'build' && artifactType !== 'notebook') {
                    generateEmbedding(output).then(vector => {
                        if (vector) dispatch({ type: 'UPDATE_ARTIFACT_EMBEDDING', payload: { id: artifact.id, embedding: vector } });
                    });
                }
            }

            // Calculate Cost
            let taskCost = 0;
            if (tokenUsage) {
                const pricing = MODEL_PRICING[actualModel] || MODEL_PRICING['unknown'];
                taskCost = (tokenUsage.promptTokens / 1000000) * pricing.input + (tokenUsage.candidatesTokens / 1000000) * pricing.output;
            }
            dispatch({ type: 'UPDATE_TASK_COST', payload: { id: taskId, cost: taskCost, tokenUsage: tokenUsage || { promptTokens: 0, candidatesTokens: 0, totalTokens: 0 }, modelUsed: actualModel } });

            // Quality Gate Logic
            const QUALITY_THRESHOLD = 70;
            const hasEvaluation = evaluation && evaluation.score !== undefined && evaluation.score !== null;
            // const scoreIsPending = !hasEvaluation || (evaluation && evaluation.score === 0);
            const scorePassesThreshold = hasEvaluation && evaluation && evaluation.score >= QUALITY_THRESHOLD;

            // Unused check:
            // const scoreIsPending = !hasEvaluation || (evaluation && evaluation.score === 0);

            // Determine final status
            let finalStatus: TaskStatus;

            // Note: Logic simplified from original to match structure
            if (!hasEvaluation || (evaluation && evaluation.score === 0)) {
                finalStatus = settingsRef.current.enableHumanInTheLoop ? TaskStatus.REVIEW : TaskStatus.IN_PROGRESS;
                addLog(`Quality Gate: Task quality score is pending.`, AgentRole.QA_AUDIT_AGENT, 'warning', taskId);
            } else if (!scorePassesThreshold && evaluation) {
                finalStatus = settingsRef.current.enableHumanInTheLoop ? TaskStatus.REVIEW : TaskStatus.IN_PROGRESS;
                addLog(`Quality Gate: Below threshold (${QUALITY_THRESHOLD}). Requires review.`, AgentRole.QA_AUDIT_AGENT, 'warning', taskId);
            } else if (result.finalStatus === 'success' && scorePassesThreshold && evaluation) {
                finalStatus = TaskStatus.COMPLETED;
                addLog(`Task completed successfully. Score: ${evaluation.score}/100.`, agent.role, 'success', taskId);
            } else {
                finalStatus = (!settingsRef.current.enableHumanInTheLoop && result.finalStatus === 'success') ? TaskStatus.COMPLETED : TaskStatus.REVIEW;
                if (finalStatus === TaskStatus.REVIEW) {
                    addLog(`Quality Gate: Task requires review.`, AgentRole.QA_AUDIT_AGENT, 'warning', taskId);
                } else {
                    addLog(`Task completed.`, agent.role, 'success', taskId);
                }
            }

            dispatch({ type: 'UPDATE_TASK_STATUS', payload: { id: taskId, status: finalStatus } });

        } catch (error: any) {
            if (controller.signal.aborted) {
                addLog(`Task execution cancelled by user`, AgentRole.ORCHESTRATOR, 'warning', taskId);
                dispatch({ type: 'UPDATE_TASK_STATUS', payload: { id: taskId, status: TaskStatus.PENDING } });
            } else {
                console.error(`Task execution failed:`, error);
                addLog(`Task execution failed: ${error.message || 'Unknown error'}`, AgentRole.ORCHESTRATOR, 'error', taskId);
                dispatch({ type: 'UPDATE_TASK_STATUS', payload: { id: taskId, status: TaskStatus.FAILED } });
            }
        } finally {
            clearInterval(progressInterval);
            dispatch({ type: 'SET_PROCESSING', payload: false });
            activeTaskControllersRef.current.delete(taskId);
        }
    };

    return {
        handleDeleteTask,
        confirmDeleteTask,
        handleUpdateTask,
        handleAiModifyTask,
        handleRunAudit,
        executeTask: executeTaskImpl,
        handleApproveTask,
        handleRejectTask
    };
};
