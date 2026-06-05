/**
 * Planning & Reflection (dimension 9).
 *
 * Adds two agentic capabilities the harness lacked (concrete agents were one-shot calls):
 *   - createPlan: decompose a task into an ordered set of concrete steps, injected into the agent's
 *     prompt so execution follows a plan rather than improvising.
 *   - reflect: self-critique an output and decide whether it needs a revision pass.
 *
 * Flag-gated by HARNESS_PLANNING_ENABLED; every path degrades gracefully (empty plan / no revision)
 * so a planning/LLM failure never breaks task execution.
 */

import { logger } from '../utils/logger.js';
import { llmRouter } from './llm/LLMRouter.js';

export interface PlanStep {
  step: number;
  description: string;
}

export interface TaskPlan {
  steps: PlanStep[];
}

export interface Reflection {
  needsRevision: boolean;
  critique: string;
}

function planningEnabled(): boolean {
  return (process.env.HARNESS_PLANNING_ENABLED || '').toLowerCase() === 'true';
}

class PlanningService {
  /** Decompose a task into an ordered plan (2–6 steps). Returns an empty plan when disabled/on error. */
  async createPlan(
    taskTitle: string,
    taskDescription: string,
    agentRole = 'Implementation Agent'
  ): Promise<TaskPlan> {
    if (!planningEnabled() || !taskTitle) return { steps: [] };
    try {
      const prompt =
        `You are ${agentRole}. Break the task below into a concise ordered plan of 2-6 concrete steps. ` +
        `Return ONLY a JSON array of objects {"step": number, "description": string}.\n\n` +
        `Task: ${taskTitle}\n${taskDescription || ''}`;
      const result = await llmRouter.executeWithFallback({
        prompt,
        context: { agentRole, taskType: 'planning' },
        requestType: 'planning',
        contextType: 'workspace',
      });
      return { steps: this.parseSteps(result.text) };
    } catch (error) {
      logger.warn('[Planning] createPlan failed; proceeding without a plan:', error);
      return { steps: [] };
    }
  }

  /** Format a plan as a prompt block ready to append to a system instruction. */
  formatPlanForPrompt(plan: TaskPlan): string {
    if (!plan?.steps?.length) return '';
    const lines = plan.steps.map(s => `${s.step}. ${s.description}`).join('\n');
    return `\n\n[EXECUTION PLAN — follow these steps in order]\n${lines}\n[END PLAN]\n`;
  }

  /** Self-critique an output and decide whether a revision pass is warranted. */
  async reflect(
    taskTitle: string,
    output: string,
    agentRole = 'Implementation Agent'
  ): Promise<Reflection> {
    if (!planningEnabled() || !output || !output.trim()) return { needsRevision: false, critique: '' };
    try {
      const prompt =
        `Critique the following output for task "${taskTitle}". Respond ONLY as JSON ` +
        `{"needsRevision": boolean, "critique": string}. Set needsRevision true only if there are ` +
        `concrete, important problems worth a revision.\n\nOutput:\n${output.substring(0, 4000)}`;
      const result = await llmRouter.executeWithFallback({
        prompt,
        context: { agentRole, taskType: 'reflection' },
        requestType: 'reflection',
        contextType: 'workspace',
      });
      return this.parseReflection(result.text);
    } catch (error) {
      logger.warn('[Planning] reflect failed; skipping revision:', error);
      return { needsRevision: false, critique: '' };
    }
  }

  parseSteps(text: string): PlanStep[] {
    try {
      const match = text?.match(/\[[\s\S]*\]/);
      if (!match) return [];
      const arr = JSON.parse(match[0]);
      if (!Array.isArray(arr)) return [];
      return arr
        .map((s: any, i: number) => ({
          step: typeof s?.step === 'number' ? s.step : i + 1,
          description: String(s?.description ?? '').trim(),
        }))
        .filter(s => s.description.length > 0);
    } catch {
      return [];
    }
  }

  parseReflection(text: string): Reflection {
    try {
      const match = text?.match(/\{[\s\S]*\}/);
      if (!match) return { needsRevision: false, critique: '' };
      const obj = JSON.parse(match[0]);
      return { needsRevision: Boolean(obj?.needsRevision), critique: String(obj?.critique ?? '') };
    } catch {
      return { needsRevision: false, critique: '' };
    }
  }
}

export const planningService = new PlanningService();
