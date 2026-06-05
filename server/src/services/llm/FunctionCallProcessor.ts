/**
 * Function Call Processor
 * Handles iterative function calling across all LLM providers
 * Supports: Gemini, OpenAI, Anthropic, DeepSeek, Grok
 */

import { logger } from '../../utils/logger.js';
import { toolRegistry, ToolDispatchResult } from '../toolRegistry.service.js';
import { geminiService } from '../gemini.service.js';
import { openAIService } from './providers/OpenAIService.js';
import { anthropicService } from './providers/AnthropicService.js';

export interface FunctionCall {
  name: string;
  args: Record<string, any>;
}

export interface FunctionCallResponse {
  name: string;
  response: any;
}

export interface LLMResponseWithFunctionCalls {
  text: string;
  functionCalls?: FunctionCall[];
  usage?: {
    promptTokens?: number;
    candidatesTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  modelUsed: string;
  provider: 'gemini' | 'openai' | 'anthropic' | 'deepseek' | 'grok';
}

export interface ProcessedResponse {
  text: string;
  functionCallsExecuted: FunctionCallResponse[];
  finalText: string;
  usage: {
    promptTokens: number;
    candidatesTokens: number;
    totalTokens: number;
  };
  modelUsed: string;
  provider: 'gemini' | 'openai' | 'anthropic' | 'deepseek' | 'grok';
}

export class FunctionCallProcessor {
  // WI-6a: configurable iteration cap (env FCP_MAX_ITERATIONS, default 5). Genuinely agentic
  // multi-step tasks frequently need more than 5 tool turns; a hardcoded cap silently truncates them.
  private maxIterations = Number(process.env.FCP_MAX_ITERATIONS) || 5;

  /**
   * Process LLM response with iterative function calling
   * Handles function calls across all providers
   */
  async processWithFunctionCalls(
    initialResponse: LLMResponseWithFunctionCalls,
    prompt: string,
    tools: any[],
    systemInstruction?: string,
    agentRole?: string,
    projectId?: string,
    taskId?: string
  ): Promise<ProcessedResponse> {
    const functionCallsExecuted: FunctionCallResponse[] = [];
    let currentText = initialResponse.text;
    let currentResponse = initialResponse;
    let iteration = 0;
    // dim 1 → 5: thread a real conversation (used natively by the OpenAI-family continuation) instead
    // of collapsing each turn into a single stringified prompt.
    const conversationMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [
      { role: 'user', content: prompt },
    ];
    let totalUsage = {
      promptTokens: initialResponse.usage?.promptTokens || 0,
      candidatesTokens:
        initialResponse.usage?.candidatesTokens || initialResponse.usage?.completionTokens || 0,
      totalTokens: initialResponse.usage?.totalTokens || 0,
    };

    // Process function calls iteratively
    while (
      currentResponse.functionCalls &&
      currentResponse.functionCalls.length > 0 &&
      iteration < this.maxIterations
    ) {
      iteration++;
      logger.info(
        `[FunctionCallProcessor] Iteration ${iteration}: Processing ${currentResponse.functionCalls.length} function call(s)`
      );

      // WI-4 / WI-5 / WI-6b: validate + allowlist + dispatch every call through the tool registry,
      // executed in PARALLEL (input order preserved). The tools shown to the model this request are
      // the allowlist; the registry routes to create_mcp_server / google_search / user MCP servers.
      const declaredTools = (tools || []).flatMap((t: any) => t?.functionDeclarations || []);
      const dispatched = await Promise.all(
        currentResponse.functionCalls.map(async (functionCall): Promise<ToolDispatchResult> => {
          logger.info(`[FunctionCallProcessor] Executing function: ${functionCall.name}`);
          try {
            return await toolRegistry.dispatch(functionCall, declaredTools, {
              agentRole,
              projectId,
              taskId,
            });
          } catch (error: any) {
            logger.error(`[FunctionCallProcessor] Function execution failed:`, error);
            return {
              name: functionCall.name,
              success: false,
              error: error?.message || 'Function execution failed',
            };
          }
        })
      );

      const functionResponses: FunctionCallResponse[] = dispatched.map(r => ({
        name: r.name,
        response: r.success ? r.result : { error: r.error },
      }));
      for (const executed of dispatched) {
        functionCallsExecuted.push({ name: executed.name, response: executed });
      }

      // Continue conversation with function results
      const continuationPrompt = this.buildContinuationPrompt(
        prompt,
        currentText,
        currentResponse.functionCalls,
        functionResponses
      );

      // dim 1 → 5: extend the structured conversation with the assistant turn + tool results so the
      // OpenAI-family continuation receives a real message history (not a single stringified prompt).
      const toolResultsText = (currentResponse.functionCalls || [])
        .map((call, i) => `Tool ${call.name} → ${JSON.stringify(functionResponses[i]?.response)}`)
        .join('\n');
      conversationMessages.push({ role: 'assistant', content: currentText || '(issued tool calls)' });
      conversationMessages.push({
        role: 'user',
        content: `Tool results:\n${toolResultsText}\n\nContinue the task using these results.`,
      });

      // Get next response from LLM
      currentResponse = await this.continueConversation(
        continuationPrompt,
        currentResponse.provider,
        currentResponse.modelUsed,
        tools,
        systemInstruction,
        functionResponses,
        conversationMessages
      );

      currentText = currentResponse.text;

      // Accumulate usage
      if (currentResponse.usage) {
        totalUsage.promptTokens += currentResponse.usage.promptTokens || 0;
        totalUsage.candidatesTokens +=
          currentResponse.usage.candidatesTokens || currentResponse.usage.completionTokens || 0;
        totalUsage.totalTokens += currentResponse.usage.totalTokens || 0;
      }
    }

    if (iteration >= this.maxIterations) {
      logger.warn(
        `[FunctionCallProcessor] Reached max iterations (${this.maxIterations}), stopping function call processing`
      );
    }

    return {
      text: currentText,
      functionCallsExecuted,
      finalText: currentText,
      usage: totalUsage,
      modelUsed: currentResponse.modelUsed,
      provider: currentResponse.provider,
    };
  }

  /**
   * Build continuation prompt with function call results
   */
  private buildContinuationPrompt(
    originalPrompt: string,
    previousResponse: string,
    functionCalls: FunctionCall[],
    functionResponses: FunctionCallResponse[]
  ): string {
    let continuation = `Previous response: ${previousResponse}\n\n`;
    continuation += `Function calls executed:\n`;

    for (let i = 0; i < functionCalls.length; i++) {
      const call = functionCalls[i];
      const response = functionResponses[i];
      continuation += `\nFunction: ${call.name}\n`;
      continuation += `Arguments: ${JSON.stringify(call.args, null, 2)}\n`;
      continuation += `Result: ${JSON.stringify(response.response, null, 2)}\n`;
    }

    continuation += `\nPlease continue with the task using the function call results above.`;

    return continuation;
  }

  /**
   * Continue conversation with function call results
   */
  private async continueConversation(
    prompt: string,
    provider: 'gemini' | 'openai' | 'anthropic' | 'deepseek' | 'grok',
    model: string,
    tools: any[],
    systemInstruction?: string,
    functionResponses?: FunctionCallResponse[],
    conversationMessages?: Array<{ role: 'user' | 'assistant'; content: string }>
  ): Promise<LLMResponseWithFunctionCalls> {
    try {
      switch (provider) {
        case 'gemini':
          return await this.continueGeminiConversation(
            prompt,
            model,
            tools,
            systemInstruction,
            functionResponses
          );

        case 'openai':
          return await this.continueOpenAIConversation(
            prompt,
            model,
            tools,
            systemInstruction,
            functionResponses,
            conversationMessages
          );

        case 'anthropic':
          return await this.continueAnthropicConversation(
            prompt,
            model,
            tools,
            systemInstruction,
            functionResponses
          );

        case 'deepseek':
          // DeepSeek uses OpenAI-compatible API
          return await this.continueOpenAIConversation(
            prompt,
            model,
            tools,
            systemInstruction,
            functionResponses,
            conversationMessages
          );

        case 'grok':
          // Grok uses OpenAI-compatible API
          return await this.continueOpenAIConversation(
            prompt,
            model,
            tools,
            systemInstruction,
            functionResponses,
            conversationMessages
          );

        default:
          throw new Error(`Unsupported provider: ${provider}`);
      }
    } catch (error: any) {
      logger.error(
        `[FunctionCallProcessor] Error continuing conversation with ${provider}:`,
        error
      );
      // Return a fallback response
      return {
        text: `Error processing function calls: ${error.message}`,
        usage: { promptTokens: 0, candidatesTokens: 0, totalTokens: 0 },
        modelUsed: model,
        provider,
      };
    }
  }

  /**
   * Continue Gemini conversation
   */
  private async continueGeminiConversation(
    prompt: string,
    model: string,
    tools: any[],
    systemInstruction?: string,
    functionResponses?: FunctionCallResponse[]
  ): Promise<LLMResponseWithFunctionCalls> {
    const config: any = {
      systemInstruction,
      tools: tools.length > 0 ? tools : undefined,
    };

    const result = await geminiService.generateContent(prompt, model, config);

    // Gemini service now returns functionCalls directly
    const functionCalls =
      result.functionCalls?.map(fc => ({
        name: fc.name,
        args: fc.args,
      })) || [];

    return {
      text: result.text,
      functionCalls: functionCalls.length > 0 ? functionCalls : undefined,
      usage: result.usage,
      modelUsed: model,
      provider: 'gemini',
    };
  }

  /**
   * Continue OpenAI conversation
   */
  private async continueOpenAIConversation(
    prompt: string,
    model: string,
    tools: any[],
    systemInstruction?: string,
    functionResponses?: FunctionCallResponse[],
    conversationMessages?: Array<{ role: 'user' | 'assistant'; content: string }>
  ): Promise<LLMResponseWithFunctionCalls> {
    // WI-3a: OpenAIService natively converts tool declarations and parses tool_calls, returning
    // structured `functionCalls`. dim 1 → 5: pass the real conversation (messages) when available so
    // tool results are native message turns, not a single stringified prompt (prompt kept as fallback).
    const result = await openAIService.generateContent(prompt, model, {
      systemInstruction,
      temperature: 0.7,
      tools: tools.length > 0 ? tools : undefined,
      messages: conversationMessages && conversationMessages.length > 0 ? conversationMessages : undefined,
    });

    const functionCalls =
      result.functionCalls && result.functionCalls.length > 0 ? result.functionCalls : undefined;

    return {
      text: result.text,
      functionCalls,
      usage: {
        promptTokens: result.usage.promptTokens,
        candidatesTokens: result.usage.completionTokens,
        totalTokens: result.usage.totalTokens,
      },
      modelUsed: model,
      provider: 'openai',
    };
  }

  /**
   * Continue Anthropic conversation
   */
  private async continueAnthropicConversation(
    prompt: string,
    model: string,
    tools: any[],
    systemInstruction?: string,
    functionResponses?: FunctionCallResponse[]
  ): Promise<LLMResponseWithFunctionCalls> {
    // WI-3b: pass tools for native Anthropic tool use; prefer native tool_use, fall back to text.
    const result = await anthropicService.generateContent(prompt, model, {
      systemInstruction,
      temperature: 0.7,
      tools: tools.length > 0 ? tools : undefined,
    });

    const functionCalls =
      result.functionCalls && result.functionCalls.length > 0
        ? result.functionCalls
        : this.extractFunctionCallsFromText(result.text);

    return {
      text: result.text,
      functionCalls: functionCalls.length > 0 ? functionCalls : undefined,
      usage: {
        promptTokens: result.usage.promptTokens,
        candidatesTokens: result.usage.completionTokens,
        totalTokens: result.usage.totalTokens,
      },
      modelUsed: model,
      provider: 'anthropic',
    };
  }

  /**
   * Extract function calls from text response (fallback for providers without native function calling)
   * Also used as primary method for text-based function call extraction
   */
  private extractFunctionCallsFromText(text: string): FunctionCall[] {
    const functionCalls: FunctionCall[] = [];

    // Look for JSON function call patterns in text
    // Pattern 1: create_mcp_server({...})
    const jsonPattern = /create_mcp_server\s*\(\s*(\{[\s\S]*?\})\s*\)/gi;
    let match;
    while ((match = jsonPattern.exec(text)) !== null) {
      try {
        const args = JSON.parse(match[1]);
        functionCalls.push({
          name: 'create_mcp_server',
          args,
        });
      } catch (e) {
        // Try to extract key-value pairs if JSON parsing fails
        logger.debug('JSON parsing failed, trying alternative extraction');
      }
    }

    // Pattern 2: Look for structured function call blocks
    const blockPattern =
      /```(?:json|function_call)?\s*\{[\s\S]*?"name"\s*:\s*"create_mcp_server"[\s\S]*?\}\s*```/gi;
    while ((match = blockPattern.exec(text)) !== null) {
      try {
        const jsonMatch = match[0].match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.name === 'create_mcp_server' && parsed.args) {
            functionCalls.push({
              name: 'create_mcp_server',
              args: parsed.args,
            });
          }
        }
      } catch (e) {
        // Ignore parsing errors
      }
    }

    return functionCalls;
  }

  /**
   * Extract function calls from OpenAI response
   */
  private extractFunctionCallsFromOpenAIResponse(response: any): FunctionCall[] {
    const functionCalls: FunctionCall[] = [];

    // OpenAI returns function calls in response.choices[0].message.tool_calls
    if (response.choices && response.choices[0]?.message?.tool_calls) {
      for (const toolCall of response.choices[0].message.tool_calls) {
        if (toolCall.type === 'function' && toolCall.function) {
          try {
            const args =
              typeof toolCall.function.arguments === 'string'
                ? JSON.parse(toolCall.function.arguments)
                : toolCall.function.arguments;

            functionCalls.push({
              name: toolCall.function.name,
              args: args || {},
            });
          } catch (e) {
            logger.warn('Failed to parse OpenAI function call:', e);
          }
        }
      }
    }

    return functionCalls;
  }

  /**
   * Convert tools to OpenAI format
   */
  private convertToolsToOpenAIFormat(tools: any[]): any[] {
    const openAITools: any[] = [];

    for (const tool of tools) {
      if (tool.functionDeclarations) {
        for (const funcDecl of tool.functionDeclarations) {
          openAITools.push({
            type: 'function',
            function: {
              name: funcDecl.name,
              description: funcDecl.description,
              parameters: funcDecl.parameters,
            },
          });
        }
      }
    }

    return openAITools;
  }
}

export const functionCallProcessor = new FunctionCallProcessor();
