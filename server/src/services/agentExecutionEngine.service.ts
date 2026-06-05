/**
 * Agent Execution Engine (multi-agent orchestration — dimension 8).
 *
 * Turns the dead "CustomAgent catalog + no-op /execute" into a real runtime:
 *   - runAgent: load an agent's config (role/goal/systemPrompt/preferredLLM/tools) and actually run
 *     it through the LLM router.
 *   - runSequence: chain multiple agents into a pipeline (e.g. orchestrator → implementer →
 *     reviewer), threading each agent's output as context to the next.
 *   - records each run to the AgentExecution collection, so the existing (previously data-starved)
 *     health/collaboration analytics finally have real data to read.
 */

import { logger } from '../utils/logger.js';
import { llmRouter } from './llm/LLMRouter.js';
import { AgentExecution } from '../models/AgentExecution.model.js';

export interface RunnableAgent {
  id?: string;
  role: string;
  name?: string;
  goal?: string;
  systemPrompt?: string;
  preferredLLM?: string;
  maxTokens?: number;
  tools?: any[];
}

export interface AgentRunContext {
  userId?: string;
  projectId?: string;
  taskId?: string;
}

export interface AgentRunResult {
  agentId?: string;
  agentRole: string;
  output: string;
  modelUsed?: string;
  success: boolean;
  error?: string;
}

export interface SequenceResult {
  steps: AgentRunResult[];
  finalOutput: string;
}

class AgentExecutionEngine {
  private buildSystemInstruction(agent: RunnableAgent): string {
    if (agent.systemPrompt && agent.systemPrompt.trim()) return agent.systemPrompt;
    const parts = [`You are ${agent.name || agent.role}, acting as the ${agent.role}.`];
    if (agent.goal) parts.push(`Your goal: ${agent.goal}.`);
    return parts.join(' ');
  }

  /** Load an agent's config and run it through the LLM router. */
  async runAgent(agent: RunnableAgent, input: string, ctx: AgentRunContext = {}): Promise<AgentRunResult> {
    const startedAt = new Date();
    try {
      const result = await llmRouter.executeWithFallback({
        prompt: input,
        context: {
          agentRole: agent.role,
          systemInstruction: this.buildSystemInstruction(agent),
          model: agent.preferredLLM,
          maxTokens: agent.maxTokens,
          tools: agent.tools,
        },
        routingContext: { userId: ctx.userId, projectId: ctx.projectId },
        requestType: 'agent-execution',
        contextType: 'workspace',
      });
      void this.recordExecution(agent, ctx, 'completed', startedAt);
      return {
        agentId: agent.id,
        agentRole: agent.role,
        output: result.text || '',
        modelUsed: result.modelUsed,
        success: true,
      };
    } catch (error: any) {
      logger.error(`[AgentEngine] Agent "${agent.role}" failed:`, error);
      void this.recordExecution(agent, ctx, 'failed', startedAt);
      return {
        agentId: agent.id,
        agentRole: agent.role,
        output: '',
        success: false,
        error: error?.message || 'Agent execution failed',
      };
    }
  }

  /** Run agents as an ordered pipeline, threading each output into the next agent's context. */
  async runSequence(agents: RunnableAgent[], task: string, ctx: AgentRunContext = {}): Promise<SequenceResult> {
    const steps: AgentRunResult[] = [];
    let context = task;
    for (const agent of agents) {
      const result = await this.runAgent(agent, context, ctx);
      steps.push(result);
      if (result.success && result.output) {
        context =
          `Original task:\n${task}\n\n` +
          `The previous agent (${result.agentRole}) produced:\n${result.output}\n\n` +
          `Build on this for your part of the work.`;
      }
    }
    const lastSuccessful = [...steps].reverse().find(s => s.success && s.output);
    return { steps, finalOutput: lastSuccessful?.output ?? '' };
  }

  /** Best-effort execution record (feeds the health/collaboration analytics). Never throws. */
  private async recordExecution(
    agent: RunnableAgent,
    ctx: AgentRunContext,
    status: 'completed' | 'failed',
    startedAt: Date
  ): Promise<void> {
    if (!ctx.projectId || !ctx.taskId) return; // schema requires both
    try {
      await AgentExecution.create({
        projectId: ctx.projectId,
        taskId: ctx.taskId,
        agentId: agent.id || agent.role,
        agentRole: agent.role,
        status,
        artifactsCreated: [],
        stateSnapshot: { artifacts: [], timestamp: new Date() },
        startedAt,
        completedAt: new Date(),
      });
    } catch (error) {
      logger.warn('[AgentEngine] Failed to record execution (non-fatal):', error);
    }
  }
}

export const agentExecutionEngine = new AgentExecutionEngine();
