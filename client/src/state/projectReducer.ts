// Project State Reducer
// Extracted from App.tsx for better state management organization

import {
    ProjectState,
    Phase,
    Agent,
    Task,
    TaskStatus,
    LogEntry,
    Artifact,
    DialogueEvent,
    TokenUsage,
    EvaluationResult,
    Methodology
} from '@orbitai/shared';
import {
    AGENTS,
    INITIAL_PROJECT_NAME,
    INITIAL_PROJECT_DESC,
    DEFAULT_MCP_SERVERS,
    INITIAL_BUDGET
} from '@orbitai/shared';
import { generateObjectId, isValidObjectId } from '../services/projectStorage';

// Action Types
export type ProjectAction =
    | { type: 'SET_PHASE'; payload: Phase }
    | { type: 'ADD_AGENT'; payload: Agent }
    | { type: 'UPDATE_AGENT'; payload: { id: string; agent: Partial<Agent> } }
    | { type: 'ADD_AGENTS'; payload: Agent[] }
    | { type: 'DELETE_AGENT'; payload: string }
    | { type: 'ADD_TASK'; payload: Task }
    | { type: 'UPDATE_TASK_STATUS'; payload: { id: string; status: TaskStatus } }
    | { type: 'UPDATE_TASK_PROGRESS'; payload: { id: string; progress: number } }
    | { type: 'UPDATE_TASK_DETAILS'; payload: { id: string; title: string; description: string } }
    | { type: 'UPDATE_PROJECT_ID'; payload: string }
    | { type: 'UPDATE_TASK_TIMING'; payload: { id: string; startTime?: number; endTime?: number } }
    | { type: 'ADD_TASK_LOG'; payload: { id: string; message: string } }
    | { type: 'UPDATE_TASK_RESOURCES'; payload: { id: string; resources: string[] } }
    | { type: 'UPDATE_TASK_DIALOGUE'; payload: { id: string; event: DialogueEvent } }
    | { type: 'UPDATE_TASK_COLLABORATION'; payload: { id: string; collaboration: DialogueEvent[] } }
    | { type: 'UPDATE_TASK_COST'; payload: { id: string; cost: number; tokenUsage: TokenUsage; modelUsed: string } }
    | { type: 'UPDATE_TASK_EVALUATION'; payload: { id: string; evaluation: EvaluationResult } }
    | { type: 'DELETE_TASK'; payload: string }
    | { type: 'ADD_ARTIFACT'; payload: Artifact }
    | { type: 'UPDATE_ARTIFACT'; payload: { id: string; content: string } }
    | { type: 'UPDATE_ARTIFACT_EMBEDDING'; payload: { id: string; embedding: number[] } }
    | { type: 'DELETE_ARTIFACT'; payload: string }
    | { type: 'ADD_LOG'; payload: LogEntry }
    | { type: 'SET_PROCESSING'; payload: boolean }
    | { type: 'SET_PROJECT_DETAILS'; payload: { name: string; description: string; methodology?: Methodology; estimatedSprints?: number } }
    | { type: 'SET_ESTIMATED_SPRINTS'; payload: number }
    | { type: 'RESET_PROJECT'; payload: ProjectState }
    | { type: 'SET_STANDARDS'; payload: string[] }
    | { type: 'TOGGLE_INTERNET'; payload: boolean }
    | { type: 'START_NEXT_SPRINT'; payload: any }
    | { type: 'UPDATE_BUDGET_CAP'; payload: number }
    | { type: 'SET_THEME'; payload: string };

/**
 * Create initial project state
 */
export const createInitialState = (userId?: string): ProjectState => ({
    id: generateObjectId(),
    name: INITIAL_PROJECT_NAME,
    description: INITIAL_PROJECT_DESC,
    created: Date.now(),
    lastModified: Date.now(),
    userId: userId,
    currentPhase: Phase.INITIATION,
    currentSprint: 1,
    methodology: 'V-Model',
    agents: AGENTS,
    tasks: [],
    artifacts: [],
    logs: [],
    isProcessing: false,
    useInternet: true,
    selectedStandards: [],
    mcpServers: DEFAULT_MCP_SERVERS,
    budget: { total: INITIAL_BUDGET, used: 0, currency: 'USD', totalTokens: 0, lastUpdated: Date.now() },
    selectedTheme: 'modern'
});

/**
 * Project state reducer
 */
export const projectReducer = (state: ProjectState, action: ProjectAction): ProjectState => {
    switch (action.type) {
        case 'SET_PHASE':
            return { ...state, currentPhase: action.payload, lastModified: Date.now() };

        case 'ADD_AGENT':
            return { ...state, agents: [...state.agents, action.payload], lastModified: Date.now() };

        case 'ADD_AGENTS': {
            const newAgents = action.payload.filter((newAgent: Agent) =>
                !state.agents.some(a => a.id === newAgent.id || a.role === newAgent.role)
            );
            return newAgents.length > 0
                ? { ...state, agents: [...state.agents, ...newAgents], lastModified: Date.now() }
                : state;
        }

        case 'UPDATE_AGENT':
            return {
                ...state,
                agents: state.agents.map(a => a.id === action.payload.id ? { ...a, ...action.payload.agent } : a),
                lastModified: Date.now()
            };

        case 'DELETE_AGENT':
            return { ...state, agents: state.agents.filter(a => a.id !== action.payload), lastModified: Date.now() };

        case 'ADD_TASK':
            return { ...state, tasks: [...state.tasks, action.payload], lastModified: Date.now() };

        case 'UPDATE_TASK_STATUS':
            return {
                ...state,
                tasks: state.tasks.map(t => t.id === action.payload.id ? { ...t, status: action.payload.status } : t),
                lastModified: Date.now()
            };

        case 'UPDATE_TASK_PROGRESS':
            return {
                ...state,
                tasks: state.tasks.map(t => t.id === action.payload.id ? { ...t, progress: action.payload.progress } : t),
                lastModified: Date.now()
            };

        case 'UPDATE_TASK_DETAILS':
            return {
                ...state,
                tasks: state.tasks.map(t => t.id === action.payload.id
                    ? { ...t, title: action.payload.title, description: action.payload.description }
                    : t),
                lastModified: Date.now()
            };

        case 'UPDATE_TASK_TIMING':
            return {
                ...state,
                tasks: state.tasks.map(t => t.id === action.payload.id
                    ? { ...t, startTime: action.payload.startTime ?? t.startTime, endTime: action.payload.endTime ?? t.endTime }
                    : t),
                lastModified: Date.now()
            };

        case 'ADD_TASK_LOG':
            return {
                ...state,
                tasks: state.tasks.map(t => t.id === action.payload.id
                    ? { ...t, logs: [...t.logs, action.payload.message] }
                    : t),
                lastModified: Date.now()
            };

        case 'UPDATE_TASK_RESOURCES':
            return {
                ...state,
                tasks: state.tasks.map(t => t.id === action.payload.id
                    ? { ...t, resources: [...(t.resources || []), ...action.payload.resources] }
                    : t),
                lastModified: Date.now()
            };

        case 'UPDATE_TASK_DIALOGUE':
            return {
                ...state,
                tasks: state.tasks.map(t => t.id === action.payload.id
                    ? { ...t, collaboration: [...(t.collaboration || []), action.payload.event] }
                    : t),
                lastModified: Date.now()
            };

        case 'UPDATE_TASK_COLLABORATION':
            return {
                ...state,
                tasks: state.tasks.map(t => t.id === action.payload.id
                    ? { ...t, collaboration: action.payload.collaboration }
                    : t),
                lastModified: Date.now()
            };

        case 'UPDATE_TASK_COST':
            return {
                ...state,
                tasks: state.tasks.map(t => t.id === action.payload.id
                    ? { ...t, cost: (t.cost || 0) + action.payload.cost, tokenUsage: action.payload.tokenUsage, modelUsed: action.payload.modelUsed }
                    : t),
                budget: {
                    ...state.budget,
                    used: state.budget.used + action.payload.cost,
                    totalTokens: state.budget.totalTokens + action.payload.tokenUsage.totalTokens
                },
                lastModified: Date.now()
            };

        case 'UPDATE_TASK_EVALUATION':
            return {
                ...state,
                tasks: state.tasks.map(t => t.id === action.payload.id
                    ? { ...t, evaluation: action.payload.evaluation }
                    : t),
                lastModified: Date.now()
            };

        case 'DELETE_TASK':
            return { ...state, tasks: state.tasks.filter(t => t.id !== action.payload), lastModified: Date.now() };

        case 'ADD_ARTIFACT':
            return { ...state, artifacts: [...state.artifacts, action.payload], lastModified: Date.now() };

        case 'UPDATE_ARTIFACT':
            return {
                ...state,
                artifacts: state.artifacts.map(a => a.id === action.payload.id
                    ? { ...a, content: action.payload.content }
                    : a),
                lastModified: Date.now()
            };

        case 'UPDATE_ARTIFACT_EMBEDDING':
            return {
                ...state,
                artifacts: state.artifacts.map(a => a.id === action.payload.id
                    ? { ...a, embedding: action.payload.embedding }
                    : a),
                lastModified: Date.now()
            };

        case 'DELETE_ARTIFACT':
            return { ...state, artifacts: state.artifacts.filter(a => a.id !== action.payload), lastModified: Date.now() };

        case 'ADD_LOG':
            return { ...state, logs: [...state.logs, action.payload] };

        case 'SET_PROCESSING':
            return { ...state, isProcessing: action.payload };

        case 'SET_PROJECT_DETAILS':
            return {
                ...state,
                name: action.payload.name,
                description: action.payload.description,
                methodology: action.payload.methodology || state.methodology,
                estimatedSprints: action.payload.estimatedSprints !== undefined
                    ? action.payload.estimatedSprints
                    : state.estimatedSprints,
                lastModified: Date.now()
            };

        case 'SET_ESTIMATED_SPRINTS':
            return { ...state, estimatedSprints: action.payload, lastModified: Date.now() };

        case 'RESET_PROJECT': {
            const resetState = { ...action.payload };
            if (!resetState.mcpServers || resetState.mcpServers.length === 0) {
                resetState.mcpServers = DEFAULT_MCP_SERVERS.map(s => ({ ...s, status: 'active' }));
            } else {
                const defaultIds = new Set(DEFAULT_MCP_SERVERS.map(s => s.id));
                const mergedServers = DEFAULT_MCP_SERVERS.map(s => ({ ...s, status: 'active' }));
                const validStatuses = ['active', 'inactive'];
                resetState.mcpServers.forEach((server: any) => {
                    if (server && server.id && !defaultIds.has(server.id)) {
                        const status = validStatuses.includes(server.status) ? server.status : 'active';
                        mergedServers.push({ ...server, status: status as 'active' | 'inactive' });
                    }
                });
                resetState.mcpServers = mergedServers;
            }
            return resetState;
        }

        case 'SET_STANDARDS':
            return { ...state, selectedStandards: action.payload, lastModified: Date.now() };

        case 'TOGGLE_INTERNET':
            return { ...state, useInternet: action.payload, lastModified: Date.now() };

        case 'START_NEXT_SPRINT':
            return { ...state, currentSprint: state.currentSprint + 1, lastModified: Date.now() };

        case 'SET_THEME':
            return { ...state, selectedTheme: action.payload, lastModified: Date.now() };

        case 'UPDATE_BUDGET_CAP':
            return { ...state, budget: { ...state.budget, total: action.payload }, lastModified: Date.now() };

        case 'UPDATE_PROJECT_ID': {
            const newId = action.payload;
            if (isValidObjectId(newId)) {
                return { ...state, id: newId, lastModified: Date.now() };
            } else {
                console.warn('[Reducer] Invalid project ID provided to UPDATE_PROJECT_ID, generating valid one:', newId);
                return { ...state, id: generateObjectId(), lastModified: Date.now() };
            }
        }

        default:
            return state;
    }
};

export default projectReducer;
