/**
 * CUA Adapter Service
 * Bridges the existing Playwright-based CUA service with the @trycua/agent SDK
 * Provides unified interface for local and cloud-based testing
 *
 * @module services/cua-adapter
 */

// Types from @trycua/agent (declared locally since module exports vary)
type AgentRequest = any;
type AgentResponse = any;
type AgentMessage = any;
type ComputerCallMessage = any;
type ComputerCallOutputMessage = any;
type ReasoningMessage = any;
type AssistantMessage = any;
type Usage = any;
type ComputerAction = any;
import { cuaService, TestScenario, CUATestResult } from './cua.service.js';
import { cuaLLMService } from './cua-llm.service.js';
import { logger } from '../utils/logger.js';
import { webSocketService } from './websocket.service.js';

// Re-export types for consumers
export type { AgentRequest, AgentResponse, AgentMessage, ComputerAction, Usage };

/**
 * CUA test execution mode
 * - local: Playwright with rule-based/AI scenario generation
 * - llm-enhanced: Playwright with LLM vision analysis during execution
 * - cloud: CUA Cloud with full VLM agent
 * - auto: Try cloud first, fall back to llm-enhanced, then local
 */
export type CUATestMode = 'local' | 'llm-enhanced' | 'cloud' | 'auto';

/**
 * Options for CUA testing
 */
export interface CUATestOptions {
  mode: CUATestMode;
  /** Model configuration string for cloud mode (e.g., 'anthropic/claude-sonnet-4-5') */
  model?: string;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Save trajectory for debugging */
  saveTrajectory?: boolean;
  /** CUA Cloud API key (required for cloud mode) */
  apiKey?: string;
  /** CUA Cloud endpoint URL */
  cloudUrl?: string;
}

/**
 * Default test options
 */
const DEFAULT_OPTIONS: CUATestOptions = {
  mode: 'local',
  timeout: 60000,
  saveTrajectory: false,
};

/**
 * CUA Adapter Service
 * Provides a unified interface for both local Playwright testing and remote CUA cloud testing
 */
class CUAAdapterService {
  private isCloudConfigured = false;
  private cloudUrl?: string;
  private apiKey?: string;

  constructor() {
    // Check for cloud configuration on init
    this.cloudUrl = process.env.CUA_CLOUD_URL;
    this.apiKey = process.env.CUA_API_KEY;
    this.isCloudConfigured = !!(this.cloudUrl && this.apiKey);

    if (this.isCloudConfigured) {
      logger.info('[CUA Adapter] Cloud mode available');
    } else {
      logger.info('[CUA Adapter] Running in local-only mode');
    }
  }

  /**
   * Convert local Playwright test results to CUA AgentResponse format
   */
  convertToCUAFormat(result: CUATestResult): AgentResponse {
    const messages: AgentMessage[] = [];
    let callIdCounter = 1;

    // Add reasoning message at the start
    const reasoningMessage: ReasoningMessage = {
      type: 'reasoning',
      summary: [
        {
          type: 'summary_text',
          text: `Analyzing prototype and executing ${result.scenarios.length} test scenarios`,
        },
      ],
    };
    messages.push(reasoningMessage);

    // Convert each scenario to CUA message format
    for (const scenario of result.scenarios) {
      const callId = `call_${callIdCounter++}`;

      // Create computer call message
      const action = this.scenarioToAction(scenario);
      const computerCall: ComputerCallMessage = {
        type: 'computer_call',
        call_id: callId,
        status:
          scenario.status === 'passed'
            ? 'completed'
            : scenario.status === 'failed'
              ? 'failed'
              : 'pending',
        action,
      };
      messages.push(computerCall);

      // Create computer call output (screenshot would go here)
      const computerOutput: ComputerCallOutputMessage = {
        type: 'computer_call_output',
        call_id: callId,
        output: {
          type: 'computer_screenshot',
          image_url: result.screenshot || '',
        },
      };
      messages.push(computerOutput);
    }

    // Add final assistant message with summary
    const summaryMessage: AssistantMessage = {
      type: 'message',
      role: 'assistant',
      content: [
        {
          type: 'output_text',
          text:
            result.summary ||
            `Test ${result.status}: ${result.passedCount} passed, ${result.failedCount} failed`,
        },
      ],
    };
    messages.push(summaryMessage);

    // Calculate estimated usage (local tests don't have real token counts)
    const usage: Usage = {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
      response_cost: 0,
    };

    return {
      output: messages,
      usage,
      status: result.status === 'passed' ? 'completed' : 'failed',
      error: result.error,
    };
  }

  /**
   * Convert TestScenario to CUA ComputerAction
   */
  private scenarioToAction(scenario: TestScenario): ComputerAction {
    switch (scenario.type) {
      case 'click':
        return {
          type: 'click',
          button: 'left',
          x: 0, // Would need element coordinates
          y: 0,
        };
      case 'input':
        return {
          type: 'type',
          text: (scenario as any).testValue || 'test input',
        };
      case 'keyboard':
        return {
          type: 'keypress',
          keys: this.parseKeyboardTarget(scenario.target),
        };
      case 'scroll':
        return {
          type: 'scroll',
          scroll_x: 0,
          scroll_y: 200,
          x: 640,
          y: 360,
        };
      case 'hover':
        return {
          type: 'move',
          x: 0,
          y: 0,
        };
      default:
        return {
          type: 'screenshot',
        };
    }
  }

  /**
   * Parse keyboard target to key array
   */
  private parseKeyboardTarget(target: string): string[] {
    if (target === 'Arrow Keys') {
      return ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
    }
    if (target === 'Spacebar') {
      return ['Space'];
    }
    if (target === 'Enter Key') {
      return ['Enter'];
    }
    return [target];
  }

  /**
   * Execute test with local Playwright
   */
  async executeLocal(html: string, sessionId: string): Promise<AgentResponse> {
    logger.info(`[CUA Adapter] Executing local test for session: ${sessionId}`);

    try {
      const result = await cuaService.testPrototypeLive(html, sessionId);
      return this.convertToCUAFormat(result);
    } catch (error: unknown) {
      logger.error('[CUA Adapter] Local execution failed:', error);
      return {
        output: [],
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, response_cost: 0 },
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Execute test with LLM-enhanced local Playwright
   * Uses vision analysis for failure diagnosis and intelligent summaries
   */
  async executeLLMEnhanced(html: string, sessionId: string): Promise<AgentResponse> {
    logger.info(`[CUA Adapter] Executing LLM-enhanced test for session: ${sessionId}`);

    try {
      // Run the base test
      const result = await cuaService.testPrototypeLive(html, sessionId);
      const messages: AgentMessage[] = [];
      let tokenCount = 0;

      // Analyze failures with LLM if any
      const failedScenarios = result.scenarios.filter(s => s.status === 'failed');
      if (failedScenarios.length > 0 && result.screenshot) {
        const screenshotBase64 = result.screenshot.replace(/^data:image\/\w+;base64,/, '');

        for (const failed of failedScenarios) {
          try {
            const analysis = await cuaLLMService.analyzeFailure(
              screenshotBase64,
              `${failed.type}: ${failed.description}`,
              failed.error || 'Unknown error'
            );

            // Add reasoning message for failure analysis
            const reasoningMsg: ReasoningMessage = {
              type: 'reasoning',
              summary: [
                {
                  type: 'summary_text',
                  text: `Failure Analysis for "${failed.description}": ${analysis.cause}. Suggestion: ${analysis.suggestion} (Severity: ${analysis.severity})`,
                },
              ],
            };
            messages.push(reasoningMsg);
            tokenCount += 500; // Estimate
          } catch (e: unknown) {
            logger.warn('[CUA Adapter] LLM failure analysis failed:', e);
          }
        }
      }

      // Generate AI-powered summary if screenshot available
      if (result.screenshot) {
        try {
          const screenshotBase64 = result.screenshot.replace(/^data:image\/\w+;base64,/, '');
          const testResults = result.scenarios.map(s => ({
            scenario: s.description,
            passed: s.status === 'passed',
            error: s.error,
          }));

          const aiSummary = await cuaLLMService.generateTestSummary(screenshotBase64, testResults);
          result.summary = aiSummary;
          tokenCount += 300;
        } catch (e: unknown) {
          logger.warn('[CUA Adapter] LLM summary generation failed:', e);
        }
      }

      // Emit LLM analysis events
      const io = webSocketService.getIO();
      if (io && messages.length > 0) {
        io.emit('cua:reasoning', {
          sessionId,
          analysis: messages,
          timestamp: new Date(),
        });
      }

      // Convert to CUA format with enhanced data
      const response = this.convertToCUAFormat(result);

      // Update usage with estimated LLM tokens
      response.usage = {
        prompt_tokens: tokenCount,
        completion_tokens: Math.floor(tokenCount * 0.5),
        total_tokens: Math.floor(tokenCount * 1.5),
        response_cost: tokenCount * 0.00001, // Estimated cost
      };

      // Prepend LLM analysis messages
      response.output = [...messages, ...response.output];

      return response;
    } catch (error: unknown) {
      logger.error('[CUA Adapter] LLM-enhanced execution failed:', error);
      // Fall back to local execution
      return this.executeLocal(html, sessionId);
    }
  }

  /**
   * Execute test with CUA Cloud (when configured)
   */
  async executeCloud(
    html: string,
    sessionId: string,
    options: CUATestOptions
  ): Promise<AgentResponse> {
    const cloudUrl = options.cloudUrl || this.cloudUrl;
    const apiKey = options.apiKey || this.apiKey;

    if (!cloudUrl || !apiKey) {
      logger.warn('[CUA Adapter] Cloud not configured, falling back to local');
      return this.executeLocal(html, sessionId);
    }

    logger.info(`[CUA Adapter] Executing cloud test for session: ${sessionId}`);

    try {
      // Import AgentClient dynamically to avoid issues when not configured
      const { AgentClient } = (await import('@trycua/agent')) as any;

      const client = new AgentClient(cloudUrl, {
        apiKey,
        timeout: options.timeout || DEFAULT_OPTIONS.timeout,
      });

      // Check health first
      const health = await client.health();
      if (health.status !== 'healthy' && health.status !== 'connected') {
        logger.warn(`[CUA Adapter] Cloud unhealthy (${health.status}), falling back to local`);
        return this.executeLocal(html, sessionId);
      }

      // Create request
      const request: AgentRequest = {
        model: options.model || 'anthropic/claude-sonnet-4-5-20250929',
        input: [
          {
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: `Test this HTML prototype thoroughly. Execute clicks, form inputs, and verify all interactive elements work correctly.`,
              },
              { type: 'input_text', text: `HTML Content:\n${html.substring(0, 50000)}` },
            ],
          },
        ],
        agent_kwargs: {
          save_trajectory: options.saveTrajectory,
          verbosity: 10,
        },
        computer_kwargs: {
          os_type: 'linux',
          provider_type: 'cloud',
        },
      };

      // Execute and stream results
      const response = await client.responses.create(request);

      // Emit events for frontend
      this.emitCloudResults(sessionId, response);

      await client.disconnect();
      return response;
    } catch (error: unknown) {
      logger.error('[CUA Adapter] Cloud execution failed:', error);
      logger.info('[CUA Adapter] Falling back to local execution');
      return this.executeLocal(html, sessionId);
    }
  }

  /**
   * Emit cloud results via WebSocket for frontend consumption
   */
  private emitCloudResults(sessionId: string, response: AgentResponse): void {
    const io = webSocketService.getIO();
    if (!io) return;

    // Emit reasoning messages
    for (const msg of response.output) {
      if (msg.type === 'reasoning') {
        io.emit('cua:reasoning', {
          sessionId,
          summary: (msg as ReasoningMessage).summary,
          timestamp: new Date(),
        });
      }
    }

    // Emit usage stats
    io.emit('cua:usage', {
      sessionId,
      usage: response.usage,
      timestamp: new Date(),
    });
  }

  /**
   * Main test execution method with mode selection
   */
  async test(
    html: string,
    sessionId: string,
    options: Partial<CUATestOptions> = {}
  ): Promise<AgentResponse> {
    const opts: CUATestOptions = { ...DEFAULT_OPTIONS, ...options };

    logger.info(`[CUA Adapter] Test requested - Mode: ${opts.mode}, Session: ${sessionId}`);

    switch (opts.mode) {
      case 'cloud':
        return this.executeCloud(html, sessionId, opts);

      case 'llm-enhanced':
        return this.executeLLMEnhanced(html, sessionId);

      case 'auto':
        // Try cloud first if configured, fall back to llm-enhanced, then local
        if (this.isCloudConfigured || opts.apiKey) {
          return this.executeCloud(html, sessionId, opts);
        }
        // Use LLM-enhanced as default for auto mode
        return this.executeLLMEnhanced(html, sessionId);

      case 'local':
      default:
        return this.executeLocal(html, sessionId);
    }
  }

  /**
   * Check if cloud mode is available
   */
  isCloudAvailable(): boolean {
    return this.isCloudConfigured;
  }

  /**
   * Health check for the adapter
   */
  async healthCheck(): Promise<{ local: boolean; cloud: boolean | null }> {
    const localHealthy = await cuaService.healthCheck();

    let cloudHealthy: boolean | null = null;
    if (this.isCloudConfigured) {
      try {
        const { AgentClient } = (await import('@trycua/agent')) as any;
        const client = new AgentClient(this.cloudUrl!, { apiKey: this.apiKey });
        const health = await client.health();
        cloudHealthy = health.status === 'healthy' || health.status === 'connected';
        await client.disconnect();
      } catch {
        cloudHealthy = false;
      }
    }

    return { local: localHealthy, cloud: cloudHealthy };
  }
}

// Export singleton instance
export const cuaAdapterService = new CUAAdapterService();
