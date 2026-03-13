/**
 * Project State Helpers
 * Utility functions for managing project state
 */

import { ProjectState, Phase, Methodology, Agent, AgentRole, Mode } from '@orbitai/shared';
import { INITIAL_PROJECT_NAME, INITIAL_PROJECT_DESC, INITIAL_BUDGET, AGENTS, DEFAULT_MCP_SERVERS } from '@orbitai/shared';

/**
 * Get the Orchestrator agent - the only agent that starts with a project
 * The Orchestrator analyzes the project and dynamically adds other agents as needed
 */
export function getOrchestratorAgent(): Agent {
  const orchestrator = AGENTS.find(a => a.role === AgentRole.ORCHESTRATOR);
  if (orchestrator) {
    return orchestrator;
  }
  // Fallback if not found in AGENTS
  return {
    id: 'a1',
    name: 'Raed',
    role: AgentRole.ORCHESTRATOR,
    mode: Mode.REASONING,
    avatar: 'https://api.dicebear.com/9.x/bottts-neutral/svg?seed=Raed&backgroundColor=transparent',
    description: 'Distinguished Program Director with 20+ years driving digital transformation.',
    goal: 'Orchestrate high-stakes technical initiatives with military precision, focusing on critical path analysis and risk mitigation.',
    backstory: 'A veteran of Silicon Valley giants who has led multi-million dollar projects from inception to IPO. Acts as the "Sherpa" for the team, guiding them through treacherous technical terrain with calm, strategic authority.'
  };
}

/**
 * Get all available agents from the pool (for Orchestrator to assign)
 */
export function getAvailableAgentPool(): Agent[] {
  return AGENTS.filter(a => a.role !== AgentRole.ORCHESTRATOR);
}

/**
 * Get agent by role from the pool
 */
export function getAgentByRole(role: AgentRole): Agent | undefined {
  return AGENTS.find(a => a.role === role);
}

export function createInitialState(userId?: string): ProjectState {
  // Projects start with ONLY the Orchestrator agent
  // The Orchestrator will dynamically add other agents based on project needs
  const orchestrator = getOrchestratorAgent();
  
  return {
    id: Math.random().toString(36).substring(7),
    name: INITIAL_PROJECT_NAME,
    description: INITIAL_PROJECT_DESC,
    created: Date.now(),
    lastModified: Date.now(),
    userId: userId,
    currentPhase: 'Initiation' as Phase,
    methodology: 'V-Model' as Methodology,
    agents: [orchestrator], // Start with ONLY Orchestrator
    tasks: [],
    artifacts: [],
    logs: [],
    isProcessing: false,
    selectedStandards: [],
    useInternet: true,
    currentSprint: 1,
    estimatedSprints: 4,
    selectedTheme: 'modern',
    mcpServers: DEFAULT_MCP_SERVERS,
    budget: {
      total: INITIAL_BUDGET,
      used: 0,
      currency: 'USD',
      totalTokens: 0,
      lastUpdated: Date.now(),
    },
  };
}

