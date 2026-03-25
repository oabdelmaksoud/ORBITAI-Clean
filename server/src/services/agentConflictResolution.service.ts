/**
 * Agent Conflict Resolution Service
 * Resolves conflicting suggestions from agents
 */

import { logger } from '../utils/logger.js';
import { llmRouter } from './llm/LLMRouter.js';
import { Type, Schema } from '@google/genai';

export interface AgentConflict {
  id: string;
  projectId: string;
  conflictingAgents: Array<{
    agentId: string;
    agentRole: string;
    suggestion: string;
    priority: number;
  }>;
  conflictType: 'overlapping_changes' | 'contradictory_outputs' | 'competing_solutions';
  severity: 'high' | 'medium' | 'low';
  detectedAt: Date;
}

export interface ConflictResolution {
  conflictId: string;
  strategy: 'priority_based' | 'voting' | 'llm_based' | 'human_in_the_loop';
  resolvedSuggestion: string;
  resolvedBy: string;
  confidence: number;
  resolvedAt: Date;
}

// Agent role priorities (higher = more priority)
const AGENT_PRIORITIES: Record<string, number> = {
  'Orchestrator': 10,
  'QA/Audit Agent': 9,
  'Architecture Agent': 8,
  'Requirements Agent': 7,
  'Implementation Agent': 6,
  'Test Agent': 5,
  'UI/UX Designer': 4,
  'Integration Agent': 3,
  'Remediation/Bug Agent': 2,
  'Notebook Agent': 1
};

class AgentConflictResolutionService {
  /**
   * Detect conflicts
   */
  async detectConflicts(
    projectId: string,
    suggestions: Array<{
      agentId: string;
      agentRole: string;
      suggestion: string;
      artifactId?: string;
    }>
  ): Promise<AgentConflict[]> {
    const conflicts: AgentConflict[] = [];

    // Check for overlapping changes
    const overlappingConflicts = this.detectOverlappingChanges(suggestions);
    conflicts.push(...overlappingConflicts);

    // Check for contradictory outputs
    const contradictoryConflicts = this.detectContradictoryOutputs(suggestions);
    conflicts.push(...contradictoryConflicts);

    return conflicts;
  }

  /**
   * Detect overlapping changes
   */
  private detectOverlappingChanges(
    suggestions: Array<{ agentId: string; agentRole: string; suggestion: string; artifactId?: string }>
  ): AgentConflict[] {
    const conflicts: AgentConflict[] = [];
    const artifactMap = new Map<string, Array<{ agentId: string; agentRole: string; suggestion: string }>>();

    // Group by artifact
    for (const suggestion of suggestions) {
      if (suggestion.artifactId) {
        if (!artifactMap.has(suggestion.artifactId)) {
          artifactMap.set(suggestion.artifactId, []);
        }
        artifactMap.get(suggestion.artifactId)!.push({
          agentId: suggestion.agentId,
          agentRole: suggestion.agentRole,
          suggestion: suggestion.suggestion
        });
      }
    }

    // Find artifacts with multiple suggestions
    for (const [artifactId, agentSuggestions] of artifactMap.entries()) {
      if (agentSuggestions.length > 1) {
        conflicts.push({
          id: `conflict-${artifactId}-${Date.now()}`,
          projectId: '', // Will be set by caller
          conflictingAgents: agentSuggestions.map(s => ({
            agentId: s.agentId,
            agentRole: s.agentRole,
            suggestion: s.suggestion,
            priority: AGENT_PRIORITIES[s.agentRole] || 0
          })),
          conflictType: 'overlapping_changes',
          severity: 'medium',
          detectedAt: new Date()
        });
      }
    }

    return conflicts;
  }

  /**
   * Detect contradictory outputs
   */
  private detectContradictoryOutputs(
    suggestions: Array<{ agentId: string; agentRole: string; suggestion: string }>
  ): AgentConflict[] {
    const conflicts: AgentConflict[] = [];

    // Simple heuristic: check for contradictory keywords
    const contradictionKeywords = [
      ['add', 'remove'],
      ['enable', 'disable'],
      ['increase', 'decrease'],
      ['use', 'avoid'],
      ['include', 'exclude']
    ];

    for (let i = 0; i < suggestions.length; i++) {
      for (let j = i + 1; j < suggestions.length; j++) {
        const s1 = suggestions[i].suggestion.toLowerCase();
        const s2 = suggestions[j].suggestion.toLowerCase();

        for (const [word1, word2] of contradictionKeywords) {
          if ((s1.includes(word1) && s2.includes(word2)) ||
              (s1.includes(word2) && s2.includes(word1))) {
            conflicts.push({
              id: `conflict-${Date.now()}-${i}-${j}`,
              projectId: '',
              conflictingAgents: [
                {
                  agentId: suggestions[i].agentId,
                  agentRole: suggestions[i].agentRole,
                  suggestion: suggestions[i].suggestion,
                  priority: AGENT_PRIORITIES[suggestions[i].agentRole] || 0
                },
                {
                  agentId: suggestions[j].agentId,
                  agentRole: suggestions[j].agentRole,
                  suggestion: suggestions[j].suggestion,
                  priority: AGENT_PRIORITIES[suggestions[j].agentRole] || 0
                }
              ],
              conflictType: 'contradictory_outputs',
              severity: 'high',
              detectedAt: new Date()
            });
            break;
          }
        }
      }
    }

    return conflicts;
  }

  /**
   * Resolve conflict
   */
  async resolveConflict(
    conflict: AgentConflict,
    strategy: ConflictResolution['strategy'] = 'priority_based'
  ): Promise<ConflictResolution> {
    try {
      logger.info(`Resolving conflict ${conflict.id} using ${strategy} strategy`);

      let resolvedSuggestion: string;
      let resolvedBy: string;
      let confidence: number;

      switch (strategy) {
        case 'priority_based':
          const result = this.resolveByPriority(conflict);
          resolvedSuggestion = result.suggestion;
          resolvedBy = result.agentRole;
          confidence = 80;
          break;

        case 'voting':
          const voteResult = await this.resolveByVoting(conflict);
          resolvedSuggestion = voteResult.suggestion;
          resolvedBy = 'voting';
          confidence = voteResult.confidence;
          break;

        case 'llm_based':
          const llmResult = await this.resolveByLLM(conflict);
          resolvedSuggestion = llmResult.suggestion;
          resolvedBy = 'llm';
          confidence = llmResult.confidence;
          break;

        case 'human_in_the_loop':
          // Escalate to human
          resolvedSuggestion = 'PENDING_HUMAN_REVIEW';
          resolvedBy = 'human';
          confidence = 0;
          break;

        default:
          throw new Error(`Unknown resolution strategy: ${strategy}`);
      }

      return {
        conflictId: conflict.id,
        strategy,
        resolvedSuggestion,
        resolvedBy,
        confidence,
        resolvedAt: new Date()
      };
    } catch (error: any) {
      logger.error('Conflict resolution failed:', error);
      throw error;
    }
  }

  /**
   * Resolve by priority
   */
  private resolveByPriority(conflict: AgentConflict): { suggestion: string; agentRole: string } {
    // Sort by priority
    const sorted = [...conflict.conflictingAgents].sort((a, b) => b.priority - a.priority);
    return {
      suggestion: sorted[0].suggestion,
      agentRole: sorted[0].agentRole
    };
  }

  /**
   * Resolve by voting
   */
  private async resolveByVoting(conflict: AgentConflict): Promise<{ suggestion: string; confidence: number }> {
    // Count votes (weighted by agent priority)
    const votes = new Map<string, number>();

    for (const agent of conflict.conflictingAgents) {
      const key = agent.suggestion;
      votes.set(key, (votes.get(key) || 0) + agent.priority);
    }

    // Find highest vote
    let maxVotes = 0;
    let winningSuggestion = '';

    for (const [suggestion, voteCount] of votes.entries()) {
      if (voteCount > maxVotes) {
        maxVotes = voteCount;
        winningSuggestion = suggestion;
      }
    }

    const totalVotes = Array.from(votes.values()).reduce((sum, v) => sum + v, 0);
    const confidence = totalVotes > 0 ? (maxVotes / totalVotes) * 100 : 0;

    return {
      suggestion: winningSuggestion,
      confidence: Math.round(confidence)
    };
  }

  /**
   * Resolve by LLM
   */
  private async resolveByLLM(conflict: AgentConflict): Promise<{ suggestion: string; confidence: number }> {
    const prompt = `Resolve a conflict between agent suggestions:

${conflict.conflictingAgents.map((agent, i) => 
  `${i + 1}. ${agent.agentRole}: ${agent.suggestion}`
).join('\n')}

Conflict Type: ${conflict.conflictType}
Severity: ${conflict.severity}

Analyze the suggestions and provide:
1. The best resolution that combines or selects from the suggestions
2. Confidence level (0-100)
3. Reasoning for the choice

Return as JSON.`;

    const schema: Schema = {
      type: Type.OBJECT,
      properties: {
        resolution: { type: Type.STRING },
        confidence: { type: Type.NUMBER },
        reasoning: { type: Type.STRING }
      },
      required: ['resolution', 'confidence']
    };

    try {
      const response = await llmRouter.routeAndExecute({
        prompt,
        taskType: 'conflict_resolution',
        agentRole: 'Orchestrator',
        context: {
          agentRole: 'Orchestrator',
          tools: []
        },
        requiredOutputFormat: 'json',
        schema
      });

      const parsed = JSON.parse(response.content);
      return {
        suggestion: parsed.resolution,
        confidence: parsed.confidence || 70
      };
    } catch (error: any) {
      logger.warn('LLM conflict resolution failed:', error.message);
      // Fallback to priority-based
      const result = this.resolveByPriority(conflict);
      return {
        suggestion: result.suggestion,
        confidence: 60
      };
    }
  }
}

export const agentConflictResolutionService = new AgentConflictResolutionService();



