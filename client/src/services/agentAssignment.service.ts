/**
 * Agent Assignment Service
 * Handles dynamic agent assignment by the Orchestrator using AI reasoning
 * The Orchestrator analyzes the project and intelligently decides which agents are needed
 */

import { Agent, AgentRole, Phase } from '@orbitai/shared';
import { AGENTS } from '@orbitai/shared';

// API Base URL for backend calls
const API_BASE_URL = ((import.meta as any)?.env?.VITE_API_URL) || '';

export interface AgentAssignmentResult {
  agents: Agent[];
  reasoning: string;
  agentJustifications: Record<string, string>;
}

/**
 * Get agent from pool by role
 */
export function getAgentByRole(role: AgentRole): Agent | undefined {
  return AGENTS.find(a => a.role === role);
}

/**
 * Get all available agents (excluding Orchestrator which is always present)
 */
export function getAvailableAgentPool(): Agent[] {
  return AGENTS.filter(a => a.role !== AgentRole.ORCHESTRATOR);
}

/**
 * Get the Orchestrator agent
 */
export function getOrchestratorAgent(): Agent {
  return AGENTS.find(a => a.role === AgentRole.ORCHESTRATOR)!;
}

/**
 * Use AI reasoning to analyze project and determine required agents
 * The Orchestrator agent uses Gemini to intelligently decide which team members are needed
 */
export async function analyzeProjectWithAI(
  projectName: string,
  projectDescription: string,
  currentPhase: Phase
): Promise<AgentAssignmentResult> {
  try {
    // Get auth token
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('authToken') : null;
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Available agents for selection (excluding Orchestrator who is always present)
    const availableAgents = getAvailableAgentPool().map(agent => ({
      role: agent.role,
      name: agent.name,
      description: agent.description,
      goal: agent.goal,
      capabilities: getAgentCapabilities(agent.role)
    }));

    const response = await fetch(`${API_BASE_URL}/api/ai/analyze-agent-requirements`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        projectName,
        projectDescription,
        currentPhase,
        availableAgents
      })
    });

    if (!response.ok) {
      console.warn('[Agent Assignment] AI analysis failed, using fallback:', response.statusText);
      return fallbackAgentAssignment(projectName, projectDescription, currentPhase);
    }

    const result = await response.json();
    
    // Convert role strings back to Agent objects
    const assignedAgents: Agent[] = [getOrchestratorAgent()]; // Always include Orchestrator
    const agentJustifications: Record<string, string> = {};
    
    if (result.data?.selectedAgents) {
      for (const selection of result.data.selectedAgents) {
        const agent = getAgentByRole(selection.role as AgentRole);
        if (agent && !assignedAgents.some(a => a.role === agent.role)) {
          assignedAgents.push(agent);
          agentJustifications[agent.role] = selection.justification || '';
        }
      }
    }

    return {
      agents: assignedAgents,
      reasoning: result.data?.overallReasoning || 'AI-powered team composition based on project analysis.',
      agentJustifications
    };

  } catch (error) {
    console.warn('[Agent Assignment] AI analysis error, using fallback:', error);
    return fallbackAgentAssignment(projectName, projectDescription, currentPhase);
  }
}

/**
 * Get capabilities description for each agent role
 */
function getAgentCapabilities(role: AgentRole): string[] {
  const capabilities: Record<AgentRole, string[]> = {
    [AgentRole.ORCHESTRATOR]: [
      'Project coordination and planning',
      'Task delegation and tracking',
      'Cross-team communication',
      'Risk management'
    ],
    [AgentRole.REQUIREMENTS_AGENT]: [
      'Requirements gathering and analysis',
      'User story creation',
      'Acceptance criteria definition',
      'Stakeholder communication'
    ],
    [AgentRole.UX_DESIGNER]: [
      'User interface design',
      'Wireframing and prototyping',
      'User experience optimization',
      'Design system creation',
      'Accessibility compliance'
    ],
    [AgentRole.DESIGN_ARCH_AGENT]: [
      'System architecture design',
      'Database schema design',
      'API design',
      'Technology stack selection',
      'Scalability planning'
    ],
    [AgentRole.TEST_REQ_ENGINEER]: [
      'Test planning and strategy',
      'Test case design',
      'Test coverage analysis',
      'Quality metrics definition'
    ],
    [AgentRole.IMPLEMENTATION_AGENT]: [
      'Code implementation',
      'Feature development',
      'Code optimization',
      'Technical problem solving'
    ],
    [AgentRole.INTEGRATION_AGENT]: [
      'CI/CD pipeline setup',
      'Deployment automation',
      'System integration',
      'Infrastructure management'
    ],
    [AgentRole.TEST_AGENT]: [
      'Automated testing execution',
      'Bug detection and reporting',
      'Regression testing',
      'Performance testing'
    ],
    [AgentRole.QA_AUDIT_AGENT]: [
      'Security auditing',
      'Compliance verification',
      'Code review',
      'Quality assurance'
    ],
    [AgentRole.REMEDIATION_AGENT]: [
      'Bug fixing',
      'Performance optimization',
      'Technical debt resolution',
      'Emergency response'
    ]
  };

  return capabilities[role] || [];
}

/**
 * Fallback agent assignment when AI is unavailable
 * Uses a minimal intelligent approach based on phase
 */
function fallbackAgentAssignment(
  projectName: string,
  projectDescription: string,
  currentPhase: Phase
): AgentAssignmentResult {
  const agents: Agent[] = [getOrchestratorAgent()];
  const agentJustifications: Record<string, string> = {};
  
  // Phase-based minimal team composition
  const phaseTeams: Record<Phase, AgentRole[]> = {
    'Initiation': [AgentRole.REQUIREMENTS_AGENT],
    'Requirements': [AgentRole.REQUIREMENTS_AGENT, AgentRole.UX_DESIGNER],
    'Architecture': [AgentRole.DESIGN_ARCH_AGENT, AgentRole.REQUIREMENTS_AGENT],
    'Test Planning': [AgentRole.TEST_REQ_ENGINEER],
    'Implementation': [AgentRole.IMPLEMENTATION_AGENT, AgentRole.UX_DESIGNER],
    'Integration': [AgentRole.INTEGRATION_AGENT, AgentRole.TEST_AGENT],
    'System & Acceptance Testing': [AgentRole.TEST_AGENT, AgentRole.QA_AUDIT_AGENT],
    'Release Prep': [AgentRole.INTEGRATION_AGENT, AgentRole.QA_AUDIT_AGENT],
    'Post-Release': [AgentRole.REMEDIATION_AGENT],
  };

  const requiredRoles = phaseTeams[currentPhase] || [AgentRole.REQUIREMENTS_AGENT];
  
  for (const role of requiredRoles) {
    const agent = getAgentByRole(role);
    if (agent) {
      agents.push(agent);
      agentJustifications[role] = `Required for ${currentPhase} phase.`;
    }
  }

  return {
    agents,
    reasoning: `Fallback team composition for ${currentPhase} phase. AI analysis was unavailable.`,
    agentJustifications
  };
}

/**
 * Synchronous fallback for immediate use (non-async contexts)
 * Returns minimal team, should be followed by async AI analysis
 */
export function getInitialAgentTeam(): AgentAssignmentResult {
  return {
    agents: [getOrchestratorAgent()],
    reasoning: 'Initial team with Orchestrator. Full team will be assigned after project analysis.',
    agentJustifications: {}
  };
}

/**
 * Request additional agents during project execution
 * The Orchestrator can call this when new capabilities are needed
 */
export async function requestAdditionalAgents(
  projectDescription: string,
  currentAgents: Agent[],
  taskDescription: string,
  reason: string
): Promise<AgentAssignmentResult> {
  try {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('authToken') : null;
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const availableAgents = getAvailableAgentPool()
      .filter(a => !currentAgents.some(ca => ca.role === a.role))
      .map(agent => ({
        role: agent.role,
        name: agent.name,
        description: agent.description,
        capabilities: getAgentCapabilities(agent.role)
      }));

    const response = await fetch(`${API_BASE_URL}/api/ai/request-additional-agents`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        projectDescription,
        currentAgentRoles: currentAgents.map(a => a.role),
        taskDescription,
        reason,
        availableAgents
      })
    });

    if (!response.ok) {
      return {
        agents: [],
        reasoning: 'Unable to determine additional agents needed.',
        agentJustifications: {}
      };
    }

    const result = await response.json();
    const newAgents: Agent[] = [];
    const agentJustifications: Record<string, string> = {};

    if (result.data?.selectedAgents) {
      for (const selection of result.data.selectedAgents) {
        const agent = getAgentByRole(selection.role as AgentRole);
        if (agent && !currentAgents.some(a => a.role === agent.role)) {
          newAgents.push(agent);
          agentJustifications[agent.role] = selection.justification || '';
        }
      }
    }

    return {
      agents: newAgents,
      reasoning: result.data?.overallReasoning || 'Additional agents assigned based on task requirements.',
      agentJustifications
    };

  } catch (error) {
    console.error('[Agent Assignment] Failed to request additional agents:', error);
    return {
      agents: [],
      reasoning: 'Error requesting additional agents.',
      agentJustifications: {}
    };
  }
}

/**
 * Intelligently assign existing custom agents to project or create new ones
 * This analyzes project needs and either assigns existing custom agents or creates new ones
 */
export async function intelligentlyAssignCustomAgents(
  projectId: string,
  projectDescription: string,
  currentPhase: Phase | string
): Promise<{
  assignedAgents: Array<{
    agentId: string;
    agentName: string;
    role: string;
    source: 'existing' | 'created';
    projectId: string;
  }>;
  createdAgents: number;
  assignedExistingAgents: number;
  reasoning: string;
}> {
  try {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('authToken') : null;
    
    if (!token) {
      throw new Error('Authentication required for intelligent agent assignment');
    }

    const response = await fetch(`${API_BASE_URL}/api/ai/intelligent-assignment`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        projectId,
        projectDescription,
        currentPhase: typeof currentPhase === 'string' ? currentPhase : currentPhase
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to assign agents' }));
      throw new Error(error.error || 'Failed to intelligently assign agents');
    }

    const result = await response.json();
    return result.data;
  } catch (error: any) {
    console.error('[Intelligent Assignment] Error:', error);
    throw error;
  }
}

export const agentAssignmentService = {
  analyzeProjectWithAI,
  getAgentByRole,
  getAvailableAgentPool,
  getOrchestratorAgent,
  getInitialAgentTeam,
  requestAdditionalAgents,
  intelligentlyAssignCustomAgents,
  // Keep old function name for compatibility but use AI
  analyzeProjectForAgents: analyzeProjectWithAI
};
