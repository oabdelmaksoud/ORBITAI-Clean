/**
 * AI Agent Assignment Routes
 * Handles intelligent agent assignment using Orchestrator AI reasoning
 */

import express from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';
import { geminiService } from '../services/gemini.service.js';
import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';

const router = express.Router();

// Optional authentication - allows unauthenticated requests but extracts user if available
router.use((req: AuthRequest, res, next) => {
  const authHeader = req.headers.authorization;

  // Valid token format: "Bearer <token>" where <token> is non-empty
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];

    if (token && token.trim().length > 0) {
      try {
        // Manually verify token to avoid the strict error handling of authenticateToken middleware
        // This ensures faulty tokens don't block the request
        const decoded = jwt.verify(token, config.jwtSecret) as any;

        req.user = {
          id: decoded.userId,
          email: decoded.email,
          name: decoded.name || decoded.email.split('@')[0],
          plan: decoded.plan,
          role: decoded.role || 'public' // Default to public if role missing
        };
      } catch (error) {
        // Token invalid/expired - just log warning and proceed as guest
        // Do NOT return error response
        logger.warn('[Agent Assignment] Optional auth token invalid, proceeding as guest', { error: (error as Error).message });
      }
    }
  }

  // Always proceed
  next();
});

/**
 * Analyze project requirements and determine which agents are needed
 * Uses AI reasoning to make intelligent decisions about team composition
 */
router.post('/analyze-agent-requirements', async (req: AuthRequest, res) => {
  try {
    const { projectName, projectDescription, currentPhase, availableAgents } = req.body;

    if (!projectDescription) {
      return res.status(400).json({
        success: false,
        error: 'Project description is required'
      });
    }

    logger.info('[Agent Assignment] Analyzing project requirements with AI', {
      projectName,
      phase: currentPhase,
      availableAgentCount: availableAgents?.length || 0
    });

    // Build the prompt for the Orchestrator to reason about team composition
    const agentDescriptions = availableAgents?.map((agent: any) =>
      `- **${agent.role}** (${agent.name}): ${agent.description}\n  Capabilities: ${agent.capabilities?.join(', ') || 'General'}`
    ).join('\n') || '';

    const prompt = `You are Raed, the Orchestrator - a Distinguished Program Director with 20+ years driving digital transformation. 
You are assembling a team for a new software project. Your task is to analyze the project requirements and determine which team members are needed.

## Project Information
**Name:** ${projectName || 'Unnamed Project'}
**Current Phase:** ${currentPhase || 'Initiation'}
**Description:**
${projectDescription}

## Available Team Members
${agentDescriptions}

## Your Task
Analyze the project requirements carefully and determine which team members are essential for this project. Consider:

1. **Project Scope & Complexity**: What does this project actually need to deliver?
2. **Technical Requirements**: What technical skills are required?
3. **Phase Requirements**: What's needed for the ${currentPhase || 'Initiation'} phase?
4. **Efficiency**: Don't over-staff. Only select agents that are truly necessary.
5. **Dependencies**: Some agents may depend on others' work.

## Response Format
Respond with a JSON object containing:
{
  "selectedAgents": [
    {
      "role": "AGENT_ROLE_EXACTLY_AS_PROVIDED",
      "justification": "Brief explanation of why this agent is needed for this specific project"
    }
  ],
  "overallReasoning": "A brief paragraph explaining your team composition strategy for this project"
}

IMPORTANT:
- Only select agents that are genuinely needed
- Use the exact role names from the available agents list
- Provide specific justifications tied to the project requirements
- For simple projects, a smaller team is better
- Consider the current phase when selecting agents`;

    // Call Gemini for AI reasoning (use fast model for quick selection)
    const result = await geminiService.generateContent(
      prompt,
      'gemini-2.5-flash', // Fast model for quick agent selection
      {
        systemInstruction: 'You are an expert project manager AI. Respond only with valid JSON. Be concise.',
        responseMimeType: 'application/json'
      }
    );

    // Parse the AI response
    let aiDecision;
    try {
      // Clean the response - remove markdown code blocks if present
      let cleanedResponse = result.text || '';
      cleanedResponse = cleanedResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      aiDecision = JSON.parse(cleanedResponse);
    } catch (parseError) {
      logger.warn('[Agent Assignment] Failed to parse AI response, using fallback', {
        error: parseError,
        response: result.text?.substring(0, 500)
      });

      // Fallback to basic team
      aiDecision = {
        selectedAgents: [
          { role: 'Requirements Agent', justification: 'Essential for gathering and analyzing project requirements' }
        ],
        overallReasoning: 'Fallback team composition due to AI parsing error.'
      };
    }

    logger.info('[Agent Assignment] AI decision made', {
      selectedCount: aiDecision.selectedAgents?.length || 0,
      agents: aiDecision.selectedAgents?.map((a: any) => a.role)
    });

    res.json({
      success: true,
      data: aiDecision
    });

  } catch (error: unknown) {
    logger.error('[Agent Assignment] Error analyzing requirements:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to analyze agent requirements'
    });
  }
});

/**
 * Request additional agents during project execution
 * The Orchestrator can call this when new capabilities are needed mid-project
 */
router.post('/request-additional-agents', async (req: AuthRequest, res) => {
  try {
    const { projectDescription, currentAgentRoles, taskDescription, reason, availableAgents } = req.body;

    if (!taskDescription && !reason) {
      return res.status(400).json({
        success: false,
        error: 'Task description or reason is required'
      });
    }

    logger.info('[Agent Assignment] Requesting additional agents', {
      currentTeamSize: currentAgentRoles?.length || 0,
      reason
    });

    const agentDescriptions = availableAgents?.map((agent: any) =>
      `- **${agent.role}** (${agent.name}): ${agent.description}\n  Capabilities: ${agent.capabilities?.join(', ') || 'General'}`
    ).join('\n') || '';

    const prompt = `You are Raed, the Orchestrator. Your current team needs additional help.

## Current Situation
**Project Context:** ${projectDescription?.substring(0, 500) || 'No description available'}
**Current Team:** ${currentAgentRoles?.join(', ') || 'None'}
**Task Requiring Help:** ${taskDescription || 'Not specified'}
**Reason for Request:** ${reason || 'Additional capabilities needed'}

## Available Agents (Not Yet on Team)
${agentDescriptions}

## Your Decision
Analyze whether additional agents are truly needed. If so, select only the minimum necessary.

Respond with JSON:
{
  "selectedAgents": [
    {
      "role": "AGENT_ROLE",
      "justification": "Why this agent is needed for the specific task"
    }
  ],
  "overallReasoning": "Brief explanation of your decision"
}

If no additional agents are needed, return an empty selectedAgents array with reasoning.`;

    const result = await geminiService.generateContent(
      prompt,
      'gemini-2.5-flash',
      {
        systemInstruction: 'You are an expert project manager AI. Respond only with valid JSON.',
        responseMimeType: 'application/json'
      }
    );

    let aiDecision;
    try {
      let cleanedResponse = result.text || '';
      cleanedResponse = cleanedResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      aiDecision = JSON.parse(cleanedResponse);
    } catch (parseError) {
      aiDecision = {
        selectedAgents: [],
        overallReasoning: 'Unable to determine additional agents needed.'
      };
    }

    res.json({
      success: true,
      data: aiDecision
    });

  } catch (error: unknown) {
    logger.error('[Agent Assignment] Error requesting additional agents:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to process additional agent request'
    });
  }
});

/**
 * Intelligently assign existing custom agents to project or create new ones
 * This endpoint analyzes project needs and either assigns existing agents or creates new ones
 */
router.post('/intelligent-assignment', async (req: AuthRequest, res) => {
  try {
    const { projectId, projectDescription, currentPhase } = req.body;
    // Use fallback ID if authentication failed (guest mode)
    const userId = req.user?.id || 'guest-user';

    if (!projectId) {
      return res.status(400).json({
        success: false,
        error: 'Project ID is required'
      });
    }

    if (!projectDescription) {
      return res.status(400).json({
        success: false,
        error: 'Project description is required'
      });
    }

    logger.info('[Intelligent Assignment] Starting intelligent agent assignment', {
      projectId,
      userId,
      phase: currentPhase
    });

    const { intelligentlyAssignAgentsToProject } = await import('../services/intelligentAgentAssignment.service.js');

    const result = await intelligentlyAssignAgentsToProject(
      projectId,
      userId,
      projectDescription,
      currentPhase || 'Initiation'
    );

    logger.info('[Intelligent Assignment] Assignment complete', {
      assignedCount: result.assignedAgents.length,
      createdCount: result.createdAgents,
      existingCount: result.assignedExistingAgents
    });

    res.json({
      success: true,
      data: result
    });

  } catch (error: unknown) {
    logger.error('[Intelligent Assignment] Error in intelligent assignment:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to intelligently assign agents'
    });
  }
});

export default router;




