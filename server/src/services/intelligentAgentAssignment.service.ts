/**
 * Intelligent Agent Assignment Service
 * Assigns existing custom agents to projects or creates new ones based on project needs
 */

import { CustomAgent } from '../models/CustomAgent.model.js';
import { Project } from '../models/Project.model.js';
import { geminiService } from './gemini.service.js';
import { logger } from '../utils/logger.js';
import mongoose from 'mongoose';

export interface AgentNeed {
  role: string;
  name: string;
  description: string;
  goal: string;
  backstory: string;
  capabilities: string[];
  justification: string;
  priority: 'high' | 'medium' | 'low';
}

export interface AgentAssignmentResult {
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
}

/**
 * Analyze project needs and determine which agents are required
 */
export async function analyzeProjectNeeds(
  projectId: string,
  projectDescription: string,
  currentPhase: string,
  existingProjectAgents: string[] = []
): Promise<AgentNeed[]> {
  try {
    logger.info(`[Intelligent Assignment] Analyzing needs for project ${projectId}`, {
      phase: currentPhase,
      existingAgents: existingProjectAgents.length
    });

    // Get all available custom agents (both project-specific and global)
    const allCustomAgents = await CustomAgent.find({
      isActive: true,
      $or: [
        { projectId: null }, // Global agents
        { projectId: new mongoose.Types.ObjectId(projectId) } // Already assigned to this project
      ]
    }).lean();

    // Get project details
    const project = await Project.findById(projectId).lean();
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    // Build agent catalog for AI
    const agentCatalog = allCustomAgents.map(agent => ({
      id: agent._id.toString(),
      name: agent.name,
      role: agent.role,
      description: agent.description,
      goal: agent.goal,
      capabilities: agent.capabilities || [],
      projectId: agent.projectId?.toString() || null,
      isAssigned: agent.projectId?.toString() === projectId
    }));

    const prompt = `You are an intelligent project manager analyzing a software project to determine what agents are needed.

## Project Information
**Project ID:** ${projectId}
**Name:** ${project.name || 'Unnamed Project'}
**Description:** ${projectDescription}
**Current Phase:** ${currentPhase}
**Existing Agents:** ${existingProjectAgents.length > 0 ? existingProjectAgents.join(', ') : 'None'}

## Available Custom Agents
${agentCatalog.length > 0 ? agentCatalog.map(agent => `
- **${agent.name}** (${agent.role})
  - ID: ${agent.id}
  - Description: ${agent.description}
  - Goal: ${agent.goal}
  - Capabilities: ${agent.capabilities.join(', ') || 'General'}
  - Status: ${agent.isAssigned ? 'Already assigned to this project' : agent.projectId ? 'Assigned to another project' : 'Available (global)'}
`).join('\n') : 'No custom agents available'}

## Your Task
Analyze the project needs and determine:
1. Which existing agents (if any) should be assigned to this project
2. What new agents need to be created if no suitable existing agent exists

For each agent need, provide:
- **role**: A clear role name (e.g., "Senior Backend Developer", "Security Specialist")
- **name**: A descriptive name for the agent
- **description**: What this agent does
- **goal**: The agent's primary objective
- **backstory**: Professional background/context
- **capabilities**: List of specific capabilities needed (e.g., ['code_generation', 'api_integration'])
- **justification**: Why this agent is needed for THIS specific project
- **priority**: 'high', 'medium', or 'low'

## Response Format
Return JSON:
{
  "agentNeeds": [
    {
      "role": "Agent Role Name",
      "name": "Agent Display Name",
      "description": "What this agent does",
      "goal": "Primary objective",
      "backstory": "Professional background",
      "capabilities": ["capability1", "capability2"],
      "justification": "Why needed for this project",
      "priority": "high"
    }
  ],
  "reasoning": "Overall strategy for agent assignment"
}

IMPORTANT:
- Prefer assigning existing agents when they match the need
- Only create new agents when no suitable existing agent exists
- Consider the current phase - different phases need different agents
- Be specific about capabilities needed
- Prioritize high-priority needs first`;

    const result = await geminiService.generateContent(
      prompt,
      'gemini-2.5-flash',
      {
        systemInstruction: 'You are an expert project manager AI. Analyze project needs and determine required agents. Respond only with valid JSON.',
        responseMimeType: 'application/json'
      }
    );

    let analysis;
    try {
      let cleanedResponse = result.text || '';
      cleanedResponse = cleanedResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      analysis = JSON.parse(cleanedResponse);
    } catch (parseError) {
      logger.warn('[Intelligent Assignment] Failed to parse AI response', { error: parseError });
      // Fallback: return basic agent needs
      analysis = {
        agentNeeds: [
          {
            role: 'Implementation Agent',
            name: 'Implementation Specialist',
            description: 'Handles code implementation and development tasks',
            goal: 'Deliver high-quality, maintainable code',
            backstory: 'Experienced software developer with expertise in multiple programming languages',
            capabilities: ['code_generation', 'testing'],
            justification: 'Essential for implementing project requirements',
            priority: 'high'
          }
        ],
        reasoning: 'Fallback agent assignment due to AI parsing error'
      };
    }

    logger.info(`[Intelligent Assignment] Analysis complete`, {
      needsCount: analysis.agentNeeds?.length || 0,
      reasoning: analysis.reasoning
    });

    return analysis.agentNeeds || [];
  } catch (error: unknown) {
    logger.error('[Intelligent Assignment] Error analyzing project needs:', error);
    throw error;
  }
}

/**
 * Match agent needs to existing custom agents or create new ones
 */
export async function assignOrCreateAgents(
  projectId: string,
  userId: string,
  agentNeeds: AgentNeed[]
): Promise<AgentAssignmentResult> {
  const assignedAgents: AgentAssignmentResult['assignedAgents'] = [];
  let createdCount = 0;
  let assignedExistingCount = 0;

  try {
    logger.info(`[Intelligent Assignment] Processing ${agentNeeds.length} agent needs for project ${projectId}`);

    for (const need of agentNeeds) {
      // First, try to find an existing agent that matches
      // Look for agents with matching capabilities or role
      // Only consider agents that are NOT already assigned to this project
      const matchingAgents = await CustomAgent.find({
        isActive: true,
        $and: [
          {
            $or: [
              { role: { $regex: need.role, $options: 'i' } },
              { capabilities: { $in: need.capabilities } },
              { name: { $regex: need.name, $options: 'i' } }
            ]
          },
          {
            $or: [
              { projectId: null }, // Global agents available for assignment
              { projectId: { $ne: new mongoose.Types.ObjectId(projectId) } } // Agents from other projects (can be reassigned)
            ]
          }
        ]
      })
      .sort({ usageCount: -1 }) // Prefer more used agents (proven)
      .limit(5)
      .lean();

      let assigned = false;

      // Try to match with existing agent
      if (matchingAgents.length > 0) {
        // Use AI to determine best match
        const bestMatch = await findBestAgentMatch(need, matchingAgents);
        
        if (bestMatch && bestMatch.matchScore >= 0.7) {
          // Assign existing agent to project
          await CustomAgent.findByIdAndUpdate(bestMatch.agent._id, {
            projectId: new mongoose.Types.ObjectId(projectId),
            updatedAt: new Date()
          });

          assignedAgents.push({
            agentId: bestMatch.agent._id.toString(),
            agentName: bestMatch.agent.name,
            role: bestMatch.agent.role,
            source: 'existing',
            projectId
          });

          assignedExistingCount++;
          assigned = true;
          logger.info(`[Intelligent Assignment] Assigned existing agent "${bestMatch.agent.name}" to project ${projectId}`);
        }
      }

      // If no suitable existing agent, create a new one
      if (!assigned) {
        const newAgent = new CustomAgent({
          userId: new mongoose.Types.ObjectId(userId),
          projectId: new mongoose.Types.ObjectId(projectId),
          name: need.name,
          role: need.role,
          description: need.description,
          goal: need.goal,
          backstory: need.backstory,
          capabilities: need.capabilities || [],
          isActive: true,
          isPublic: false,
          usageCount: 0,
          tags: [need.priority],
          metadata: {
            createdBy: 'intelligent_assignment',
            projectId,
            priority: need.priority,
            justification: need.justification
          }
        });

        await newAgent.save();

        assignedAgents.push({
          agentId: newAgent._id.toString(),
          agentName: newAgent.name,
          role: newAgent.role,
          source: 'created',
          projectId
        });

        createdCount++;
        logger.info(`[Intelligent Assignment] Created new agent "${newAgent.name}" for project ${projectId}`);
      }
    }

    const reasoning = `Assigned ${assignedExistingCount} existing agent(s) and created ${createdCount} new agent(s) based on project needs.`;

    return {
      assignedAgents,
      createdAgents: createdCount,
      assignedExistingAgents: assignedExistingCount,
      reasoning
    };
  } catch (error: unknown) {
    logger.error('[Intelligent Assignment] Error assigning/creating agents:', error);
    throw error;
  }
}

/**
 * Use AI to find the best matching agent for a need
 */
async function findBestAgentMatch(
  need: AgentNeed,
  candidates: any[]
): Promise<{ agent: any; matchScore: number } | null> {
  try {
    const candidateDescriptions = candidates.map((agent, index) => 
      `${index + 1}. **${agent.name}** (${agent.role})
   - Description: ${agent.description}
   - Goal: ${agent.goal}
   - Capabilities: ${agent.capabilities?.join(', ') || 'None'}
   - Usage Count: ${agent.usageCount || 0}`
    ).join('\n\n');

    const prompt = `You are matching an agent need to the best available candidate.

## Agent Need
**Role:** ${need.role}
**Name:** ${need.name}
**Description:** ${need.description}
**Goal:** ${need.goal}
**Required Capabilities:** ${need.capabilities.join(', ')}

## Candidate Agents
${candidateDescriptions}

## Your Task
Determine which candidate (if any) is the best match. Consider:
1. Role alignment
2. Capability overlap
3. Goal compatibility
4. Experience (usage count)

Respond with JSON:
{
  "bestMatchIndex": 0,  // Index (1-based) of best match, or 0 if none suitable
  "matchScore": 0.85,    // 0.0 to 1.0, how well it matches
  "reasoning": "Why this agent is the best match"
}

If no candidate is suitable (matchScore < 0.7), set bestMatchIndex to 0.`;

    const result = await geminiService.generateContent(
      prompt,
      'gemini-2.5-flash',
      {
        systemInstruction: 'You are an expert at matching agents to project needs. Respond only with valid JSON.',
        responseMimeType: 'application/json'
      }
    );

    let match;
    try {
      let cleanedResponse = result.text || '';
      cleanedResponse = cleanedResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      match = JSON.parse(cleanedResponse);
    } catch (parseError) {
      // Fallback: use first candidate
      return {
        agent: candidates[0],
        matchScore: 0.5
      };
    }

    if (match.bestMatchIndex > 0 && match.bestMatchIndex <= candidates.length && match.matchScore >= 0.7) {
      return {
        agent: candidates[match.bestMatchIndex - 1],
        matchScore: match.matchScore
      };
    }

    return null;
  } catch (error: unknown) {
    logger.warn('[Intelligent Assignment] Error finding best match, using first candidate', error);
    return {
      agent: candidates[0],
      matchScore: 0.5
    };
  }
}

/**
 * Main function: Analyze project and assign/create agents as needed
 */
export async function intelligentlyAssignAgentsToProject(
  projectId: string,
  userId: string,
  projectDescription: string,
  currentPhase: string
): Promise<AgentAssignmentResult> {
  try {
    // Get existing project agents
    const existingAgents = await CustomAgent.find({
      projectId: new mongoose.Types.ObjectId(projectId),
      isActive: true
    }).lean();

    const existingAgentRoles = existingAgents.map(a => a.role);

    // Analyze what agents are needed
    const agentNeeds = await analyzeProjectNeeds(
      projectId,
      projectDescription,
      currentPhase,
      existingAgentRoles
    );

    if (agentNeeds.length === 0) {
      return {
        assignedAgents: [],
        createdAgents: 0,
        assignedExistingAgents: 0,
        reasoning: 'No additional agents needed at this time.'
      };
    }

    // Assign existing agents or create new ones
    const result = await assignOrCreateAgents(projectId, userId, agentNeeds);

    return result;
  } catch (error: unknown) {
    logger.error('[Intelligent Assignment] Error in intelligent assignment:', error);
    throw error;
  }
}



