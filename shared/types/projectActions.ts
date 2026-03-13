import { Phase, Agent, Task, TaskStatus, LogEntry, Artifact, DialogueEvent, TokenUsage, EvaluationResult, ProjectState, Methodology, MCPServer } from '../types';

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

