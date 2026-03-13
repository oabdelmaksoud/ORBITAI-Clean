import { Agent, Task, Artifact, DialogueEvent, TokenUsage, EvaluationResult } from '@orbitai/shared';
import { executeAgentTask } from './geminiService';

export interface QualityImprovementOptions {
  maxQualityRetries?: number;
  qualityThreshold?: number; // Default 70
  verbose?: boolean;
  enableHumanInTheLoop?: boolean; // If false, tasks will be marked as completed even if score < threshold
}

export interface QualityImprovementResult {
  output: string;
  resources: string[];
  tokenUsage: TokenUsage;
  modelUsed: string;
  evaluation?: EvaluationResult;
  collaboration?: DialogueEvent[];
  qualityRetries: number;
  finalStatus: 'success' | 'review_required';
}

const QUALITY_THRESHOLD = 70;
const MAX_QUALITY_RETRIES = 3;

/**
 * Execute task with automatic quality improvement until score >= threshold
 * Retries with improved prompts based on evaluation feedback until quality threshold is met
 */
export async function executeTaskWithQualityImprovement(
  agent: Agent,
  task: Task,
  projectContext: string,
  artifacts: Artifact[],
  useInternet: boolean,
  mcpServers: any[],
  onDialogue: (event: DialogueEvent) => void,
  standards: string[],
  options: QualityImprovementOptions = {},
  signal?: AbortSignal
): Promise<QualityImprovementResult> {
  const {
    maxQualityRetries = MAX_QUALITY_RETRIES,
    qualityThreshold = QUALITY_THRESHOLD,
    verbose = true,
    enableHumanInTheLoop = true // Default to true for safety
  } = options;

  let qualityRetries = 0;
  let lastEvaluation: EvaluationResult | undefined;
  let accumulatedOutput = '';
  let accumulatedResources: string[] = [];
  let totalTokenUsage: TokenUsage = { input: 0, output: 0, total: 0 };
  let lastModelUsed = 'unknown';
  let allCollaboration: DialogueEvent[] = [];

  // First attempt
  let currentTask = { ...task };
  let attemptOutput = '';
  let attemptResources: string[] = [];
  let attemptTokenUsage: TokenUsage = { input: 0, output: 0, total: 0 };
  let attemptModelUsed = 'unknown';
  let attemptCollaboration: DialogueEvent[] = [];

  while (qualityRetries <= maxQualityRetries) {
    try {
      if (verbose && qualityRetries > 0) {
        onDialogue({
          id: Math.random().toString(36).substring(7),
          sender: 'Quality Controller',
          receiver: agent.role,
          message: `🔄 Quality Improvement Attempt ${qualityRetries + 1}/${maxQualityRetries + 1}: Previous score was ${lastEvaluation?.score || 'N/A'}/100. Improving based on feedback...`,
          type: 'critique',
          timestamp: Date.now()
        });
      }

      const result = await executeAgentTask(
        agent,
        currentTask,
        projectContext,
        artifacts,
        useInternet,
        mcpServers,
        onDialogue,
        standards,
        signal
      );

      attemptOutput = result.output;
      attemptResources = result.resources || [];
      attemptTokenUsage = result.tokenUsage || { input: 0, output: 0, total: 0 };
      attemptModelUsed = result.modelUsed || 'unknown';
      attemptCollaboration = result.collaboration || [];

      // Accumulate resources and collaboration
      accumulatedResources.push(...attemptResources);
      allCollaboration.push(...attemptCollaboration);

      // Accumulate token usage
      totalTokenUsage = {
        input: totalTokenUsage.input + attemptTokenUsage.input,
        output: totalTokenUsage.output + attemptTokenUsage.output,
        total: totalTokenUsage.total + attemptTokenUsage.total
      };

      // Check evaluation score
      if (result.evaluation) {
        lastEvaluation = result.evaluation;
        let score = result.evaluation.score;

        // Note: Code review and refinement are handled in the backend
        // The backend will automatically apply code quality checks and refinement

        if (verbose) {
          onDialogue({
            id: Math.random().toString(36).substring(7),
            sender: 'Quality Controller',
            receiver: agent.role,
            message: `📊 Quality Score: ${score}/100${score >= qualityThreshold ? ' ✅ (Acceptable)' : ` ⚠️ (Below threshold of ${qualityThreshold})`}`,
            type: score >= qualityThreshold ? 'draft' : 'critique',
            timestamp: Date.now()
          });
        }

        // If score meets threshold, return success
        if (score >= qualityThreshold) {
          if (verbose && qualityRetries > 0) {
            onDialogue({
              id: Math.random().toString(36).substring(7),
              sender: 'Quality Controller',
              receiver: agent.role,
              message: `✅ Quality threshold achieved after ${qualityRetries + 1} attempt(s). Final score: ${score}/100`,
              type: 'draft',
              timestamp: Date.now()
            });
          }

          return {
            output: attemptOutput,
            resources: accumulatedResources,
            tokenUsage: totalTokenUsage,
            modelUsed: attemptModelUsed,
            evaluation: result.evaluation,
            collaboration: allCollaboration,
            qualityRetries,
            finalStatus: 'success'
          };
        }

        // Score below threshold - prepare for retry with improved prompt
        if (qualityRetries < maxQualityRetries) {
          qualityRetries++;

          // Build improvement prompt based on evaluation feedback
          const improvementPrompt = buildImprovementPrompt(
            task,
            result.evaluation,
            qualityRetries,
            qualityThreshold
          );

          // Update task description with improvement instructions
          currentTask = {
            ...task,
            description: `${task.description}\n\n--- QUALITY IMPROVEMENT FEEDBACK (Attempt ${qualityRetries + 1}) ---\n\nPrevious attempt scored ${score}/100 (target: ${qualityThreshold}+).\n\nEvaluation Feedback:\n${result.evaluation.reasoning}\n\nAreas to improve:\n${result.evaluation.criteria.filter(c => !c.toLowerCase().includes('strength')).join('\n')}\n\n${improvementPrompt}\n\nPlease revise and improve the output to address these issues and achieve a score of ${qualityThreshold} or higher.`
          };

          // Accumulate previous output for context
          accumulatedOutput += (accumulatedOutput ? '\n\n--- Previous Attempt ---\n\n' : '') + attemptOutput;

          continue; // Retry with improved prompt
        } else {
          // Max retries reached - check HITL setting
          const finalStatus = enableHumanInTheLoop ? 'review_required' : 'success';
          
          if (verbose) {
            if (enableHumanInTheLoop) {
              onDialogue({
                id: Math.random().toString(36).substring(7),
                sender: 'Quality Controller',
                receiver: agent.role,
                message: `⚠️ Maximum quality improvement attempts (${maxQualityRetries + 1}) reached. Final score: ${score}/100. Human review required.`,
                type: 'critique',
                timestamp: Date.now()
              });
            } else {
              onDialogue({
                id: Math.random().toString(36).substring(7),
                sender: 'Quality Controller',
                receiver: agent.role,
                message: `⚠️ Maximum quality improvement attempts (${maxQualityRetries + 1}) reached. Final score: ${score}/100. Auto-completing (HITL disabled).`,
                type: 'draft',
                timestamp: Date.now()
              });
            }
          }

          return {
            output: attemptOutput,
            resources: accumulatedResources,
            tokenUsage: totalTokenUsage,
            modelUsed: attemptModelUsed,
            evaluation: result.evaluation,
            collaboration: allCollaboration,
            qualityRetries,
            finalStatus
          };
        }
      } else {
        // No evaluation available - return as-is (shouldn't happen, but handle gracefully)
        return {
          output: attemptOutput,
          resources: accumulatedResources,
          tokenUsage: totalTokenUsage,
          modelUsed: attemptModelUsed,
          evaluation: undefined,
          collaboration: allCollaboration,
          qualityRetries,
          finalStatus: 'success' // Assume success if no evaluation
        };
      }
    } catch (error: any) {
      // If error occurs during quality improvement, return last successful attempt or error
      if (accumulatedOutput) {
        const finalStatus = lastEvaluation && lastEvaluation.score >= qualityThreshold 
          ? 'success' 
          : (enableHumanInTheLoop ? 'review_required' : 'success');
        return {
          output: accumulatedOutput,
          resources: accumulatedResources,
          tokenUsage: totalTokenUsage,
          modelUsed: lastModelUsed,
          evaluation: lastEvaluation,
          collaboration: allCollaboration,
          qualityRetries,
          finalStatus
        };
      }
      throw error;
    }
  }

  // Fallback (shouldn't reach here)
  return {
    resources: accumulatedResources,
    tokenUsage: totalTokenUsage,
    modelUsed: attemptModelUsed,
    evaluation: lastEvaluation,
    collaboration: allCollaboration,
    qualityRetries,
    finalStatus: enableHumanInTheLoop ? 'review_required' : 'success'
  };
}

/**
 * Build improvement prompt based on evaluation feedback
 */
function buildImprovementPrompt(
  originalTask: Task,
  evaluation: EvaluationResult,
  attemptNumber: number,
  threshold: number
): string {
  const score = evaluation.score;
  const gap = threshold - score;
  
  let prompt = `\n\n**IMPROVEMENT INSTRUCTIONS:**\n\n`;
  
  if (gap > 20) {
    prompt += `The output needs significant improvement (${gap} points below threshold). `;
    prompt += `Focus on:\n`;
    prompt += `- Completeness: Ensure all requirements are fully addressed\n`;
    prompt += `- Quality: Improve clarity, accuracy, and detail\n`;
    prompt += `- Structure: Better organization and formatting\n`;
  } else if (gap > 10) {
    prompt += `The output needs moderate improvement (${gap} points below threshold). `;
    prompt += `Focus on:\n`;
    prompt += `- Addressing the specific issues mentioned in the evaluation\n`;
    prompt += `- Enhancing clarity and completeness\n`;
  } else {
    prompt += `The output is close to the threshold (${gap} points below). `;
    prompt += `Make targeted improvements based on the evaluation feedback.\n`;
  }

  // Add specific criteria-based guidance
  if (evaluation.criteria && evaluation.criteria.length > 0) {
    prompt += `\n**Specific areas to address:**\n`;
    evaluation.criteria.forEach((criterion, idx) => {
      prompt += `${idx + 1}. ${criterion}\n`;
    });
  }

  // Add reasoning insights
  if (evaluation.reasoning) {
    const reasoningLower = evaluation.reasoning.toLowerCase();
    if (reasoningLower.includes('incomplete')) {
      prompt += `\n⚠️ **Completeness Issue**: The output appears incomplete. Ensure all parts of the task are fully addressed.\n`;
    }
    if (reasoningLower.includes('unclear') || reasoningLower.includes('vague')) {
      prompt += `\n⚠️ **Clarity Issue**: Improve clarity and specificity. Add more detail where needed.\n`;
    }
    if (reasoningLower.includes('error') || reasoningLower.includes('incorrect')) {
      prompt += `\n⚠️ **Accuracy Issue**: Review for errors or inaccuracies and correct them.\n`;
    }
  }

  prompt += `\n**Goal**: Achieve a quality score of ${threshold} or higher.\n`;

  return prompt;
}

