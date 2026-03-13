import { Agent, Task, Artifact, DialogueEvent, TokenUsage, EvaluationResult } from '@orbitai/shared';
import { executeAgentTask } from './geminiService';

export interface AgentModeOptions {
  maxIterations?: number;
  autoFixErrors?: boolean;
  verbose?: boolean;
}

export interface AgentModeResult {
  output: string;
  resources: string[];
  tokenUsage: TokenUsage;
  modelUsed: string;
  evaluation?: EvaluationResult;
  collaboration?: DialogueEvent[];
  iterations: number;
  errorsFixed: number;
  finalStatus: 'success' | 'partial' | 'failed';
}

/**
 * Enhanced Agent Mode with iterative error fixing
 */
export async function executeAgentMode(
  agent: Agent,
  task: Task,
  projectContext: string,
  artifacts: Artifact[],
  useInternet: boolean,
  mcpServers: any[],
  e2bKey: string,
  onDialogue: (event: DialogueEvent) => void,
  standards: string[],
  options: AgentModeOptions = {},
  signal?: AbortSignal
): Promise<AgentModeResult> {
  const {
    maxIterations = 3,
    autoFixErrors = true,
    verbose = true
  } = options;

  let iterations = 0;
  let errorsFixed = 0;
  let lastError: string | null = null;
  let accumulatedOutput = '';
  let accumulatedResources: string[] = [];
  let totalTokenUsage: TokenUsage = { input: 0, output: 0, total: 0 };

  if (verbose) {
    onDialogue({
      id: Math.random().toString(36).substring(7),
      sender: agent.role,
      receiver: agent.role,
      message: `🤖 Agent Mode enabled - Will attempt up to ${maxIterations} iterations with automatic error fixing`,
      type: 'draft',
      timestamp: Date.now()
    });
  }

  while (iterations < maxIterations) {
    iterations++;
    
    if (verbose) {
      onDialogue({
        id: Math.random().toString(36).substring(7),
        sender: agent.role,
        receiver: agent.role,
        message: `🔄 Iteration ${iterations}/${maxIterations}...`,
        type: 'draft',
        timestamp: Date.now()
      });
    }

    try {
      // Enhance task description with error context if this is a retry
      let enhancedTask = { ...task };
      if (lastError && iterations > 1) {
        enhancedTask = {
          ...task,
          description: `${task.description}\n\n[Previous attempt failed with error: ${lastError}]\n\nPlease fix the error and retry.`
        };
      }

      const result = await executeAgentTask(
        agent,
        enhancedTask,
        projectContext,
        artifacts,
        useInternet,
        mcpServers,
        e2bKey,
        onDialogue,
        standards,
        signal
      );

      // Check for errors in output
      const hasError = detectErrors(result.output);
      
      if (!hasError) {
        // Success!
        if (verbose && iterations > 1) {
          onDialogue({
            id: Math.random().toString(36).substring(7),
            sender: agent.role,
            receiver: agent.role,
            message: `✅ Task completed successfully after ${iterations} iteration(s)`,
            type: 'draft',
            timestamp: Date.now()
          });
        }

        return {
          output: result.output,
          resources: result.resources || [],
          tokenUsage: result.tokenUsage,
          modelUsed: result.modelUsed,
          evaluation: result.evaluation,
          collaboration: result.collaboration,
          iterations,
          errorsFixed,
          finalStatus: 'success'
        };
      } else {
        // Error detected, but we got output - try to extract error message
        const errorMessage = extractErrorMessage(result.output);
        lastError = errorMessage || 'Unknown error detected in output';
        errorsFixed++;

        if (verbose) {
          onDialogue({
            id: Math.random().toString(36).substring(7),
            sender: agent.role,
            receiver: agent.role,
            message: `⚠️ Error detected: ${lastError}. Attempting to fix...`,
            type: 'draft',
            timestamp: Date.now()
          });
        }

        // Accumulate output for partial success
        accumulatedOutput += result.output + '\n\n--- Retry ---\n\n';
        accumulatedResources.push(...(result.resources || []));
        totalTokenUsage = {
          input: totalTokenUsage.input + (result.tokenUsage?.input || 0),
          output: totalTokenUsage.output + (result.tokenUsage?.output || 0),
          total: totalTokenUsage.total + (result.tokenUsage?.total || 0)
        };

        // Continue to next iteration
        if (iterations < maxIterations) {
          continue;
        } else {
          // Max iterations reached
          return {
            output: accumulatedOutput || result.output,
            resources: accumulatedResources,
            tokenUsage: totalTokenUsage,
            modelUsed: result.modelUsed,
            evaluation: result.evaluation,
            collaboration: result.collaboration,
            iterations,
            errorsFixed,
            finalStatus: 'partial'
          };
        }
      }
    } catch (error: any) {
      lastError = error.message || 'Execution failed';
      errorsFixed++;

      if (verbose) {
        onDialogue({
          id: Math.random().toString(36).substring(7),
          sender: agent.role,
          receiver: agent.role,
          message: `❌ Error: ${lastError}. ${iterations < maxIterations ? 'Retrying...' : 'Max iterations reached.'}`,
          type: 'draft',
          timestamp: Date.now()
        });
      }

      // If this is the last iteration, return failure
      if (iterations >= maxIterations) {
        return {
          output: accumulatedOutput || `Task failed after ${iterations} attempts. Last error: ${lastError}`,
          resources: accumulatedResources,
          tokenUsage: totalTokenUsage,
          modelUsed: 'unknown',
          iterations,
          errorsFixed,
          finalStatus: 'failed'
        };
      }

      // Continue to next iteration
      continue;
    }
  }

  // Should not reach here, but just in case
  return {
    output: accumulatedOutput || 'Task execution incomplete',
    resources: accumulatedResources,
    tokenUsage: totalTokenUsage,
    modelUsed: 'unknown',
    iterations,
    errorsFixed,
    finalStatus: 'failed'
  };
}

/**
 * Detect errors in output
 */
function detectErrors(output: string): boolean {
  const errorIndicators = [
    'error:',
    'exception:',
    'failed',
    'failure',
    'cannot',
    'unable to',
    'syntax error',
    'runtime error',
    'type error',
    'reference error',
    'undefined',
    'null pointer',
    'traceback',
    'stack trace'
  ];

  const lowerOutput = output.toLowerCase();
  return errorIndicators.some(indicator => lowerOutput.includes(indicator));
}

/**
 * Extract error message from output
 */
function extractErrorMessage(output: string): string | null {
  const errorPatterns = [
    /error:\s*(.+)/i,
    /exception:\s*(.+)/i,
    /failed:\s*(.+)/i,
    /(.+error.+)/i
  ];

  for (const pattern of errorPatterns) {
    const match = output.match(pattern);
    if (match && match[1]) {
      return match[1].trim().substring(0, 200); // Limit length
    }
  }

  return null;
}
















