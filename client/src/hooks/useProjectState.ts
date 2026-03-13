/**
 * useProjectState Hook
 * Extracted from App.tsx - Manages project state and reducer
 */

import { useReducer, useCallback } from 'react';
import {
  ProjectState,
  Phase,
  AgentRole,
  TaskStatus,
  Task,
  Artifact,
  Agent,
  ProjectBudget,
  TokenUsage,
  EvaluationResult,
  Methodology,
  LogEntry,
  AgentRoleType,
} from '@orbitai/shared';


import { appReducer, AppAction, createInitialState } from '../state/appReducer';

// Reducer is now managed in state/appReducer.ts

export function useProjectState(initialState?: ProjectState) {
  // Use lazy initialization to ensure createInitialState() is only called once
  // Without this, the || expression evaluates on every render causing infinite loops
  const [state, dispatch] = useReducer(
    appReducer,
    initialState,
    (init) => init || createInitialState()
  );

  const actions = {
    setPhase: useCallback((phase: Phase) => dispatch({ type: 'SET_PHASE', payload: phase }), []),
    addAgent: useCallback((agent: Agent) => dispatch({ type: 'ADD_AGENT', payload: agent }), []),
    addAgents: useCallback((agents: Agent[]) => dispatch({ type: 'ADD_AGENTS', payload: agents }), []),
    removeAgent: useCallback((agentId: string) => dispatch({ type: 'DELETE_AGENT', payload: agentId }), []),
    setAgents: useCallback((agents: Agent[]) => dispatch({ type: 'SET_AGENTS', payload: agents }), []),
    addTask: useCallback((task: Task) => dispatch({ type: 'ADD_TASK', payload: task }), []),
    updateTaskStatus: useCallback(
      (id: string, status: TaskStatus) =>
        dispatch({ type: 'UPDATE_TASK_STATUS', payload: { id, status } }),
      []
    ),
    updateTaskProgress: useCallback(
      (id: string, progress: number) =>
        dispatch({ type: 'UPDATE_TASK_PROGRESS', payload: { id, progress } }),
      []
    ),
    updateTaskDetails: useCallback(
      (id: string, title: string, description: string) =>
        dispatch({ type: 'UPDATE_TASK_DETAILS', payload: { id, title, description } }),
      []
    ),
    deleteTask: useCallback((id: string) => dispatch({ type: 'DELETE_TASK', payload: id }), []),
    addArtifact: useCallback(
      (artifact: Artifact) => dispatch({ type: 'ADD_ARTIFACT', payload: artifact }),
      []
    ),
    updateArtifact: useCallback(
      (id: string, content: string) =>
        dispatch({ type: 'UPDATE_ARTIFACT', payload: { id, content } }),
      []
    ),
    deleteArtifact: useCallback(
      (id: string) => dispatch({ type: 'DELETE_ARTIFACT', payload: id }),
      []
    ),
    addLog: useCallback((message: string | LogEntry) => {
      const payload: LogEntry = typeof message === 'string'
        ? {
          id: Date.now().toString(),
          timestamp: Date.now(),
          agent: 'system' as AgentRoleType,
          message,
          type: 'info'
        }
        : message;
      dispatch({ type: 'ADD_LOG', payload });
    }, []),
    setProcessing: useCallback(
      (isProcessing: boolean) => dispatch({ type: 'SET_PROCESSING', payload: isProcessing }),
      []
    ),
    setProjectDetails: useCallback(
      (details: { name: string; description: string; methodology?: Methodology; estimatedSprints?: number }) =>
        dispatch({ type: 'SET_PROJECT_DETAILS', payload: details }),
      []
    ),
    resetProject: useCallback(
      (newState: ProjectState) => dispatch({ type: 'RESET_PROJECT', payload: newState }),
      []
    ),
    setStandards: useCallback(
      (standards: string[]) => dispatch({ type: 'SET_STANDARDS', payload: standards }),
      []
    ),
    toggleInternet: useCallback(
      (enabled: boolean) => dispatch({ type: 'TOGGLE_INTERNET', payload: enabled }),
      []
    ),
    startNextSprint: useCallback(() => dispatch({ type: 'START_NEXT_SPRINT' }), []),
    setTheme: useCallback((theme: string) => dispatch({ type: 'SET_THEME', payload: theme }), []),
    updateBudgetCap: useCallback(
      (cap: number) => dispatch({ type: 'UPDATE_BUDGET_CAP', payload: cap }),
      []
    ),
    updateProjectId: useCallback(
      (id: string) => dispatch({ type: 'UPDATE_PROJECT_ID', payload: id }),
      []
    ),
  };

  return { state, dispatch, actions };
}










