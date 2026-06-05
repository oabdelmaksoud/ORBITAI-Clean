/**
 * Function Call Processor
 * Handles iterative function calling across all LLM providers
 * Supports: Gemini, OpenAI, Anthropic, DeepSeek, Grok
 */

import { logger } from '../../utils/logger.js';
import { agentFunctionHandler } from '../agentFunctionHandler.service.js';
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
    let totalUsage = {
      promptTokens: initialResponse.usage?.promptTokens || 0,
      candidatesTokens: initialResponse.usage?.candidatesTokens || initialResponse.usage?.completionTokens || 0,
      totalTokens: initialResponse.usage?.totalTokens || 0
    };

    // Process function calls iteratively
    while (currentResponse.functionCalls && currentResponse.functionCalls.length > 0 && iteration < this.maxIterations) {
      iteration++;
      logger.info(`[FunctionCallProcessor] Iteration ${iteration}: Processing ${currentResponse.functionCalls.length} function call(s)`);

      // Execute all function calls
      const functionResponses: FunctionCallResponse[] = [];
      for (const functionCall of currentResponse.functionCalls) {
        try {
          logger.info(`[FunctionCallProcessor] Executing function: ${functionCall.name}`);
          
          // Handle google_search function calls via MCP service
          if (functionCall.name === 'google_search') {
            const { mcpService } = await import('../mcp.service.js');
            const searchResult = await mcpService.callTool('mcp-sys-3', 'google_search', functionCall.args);
            functionResponses.push({
              name: functionCall.name,
              response: searchResult
            });
            functionCallsExecuted.push({
              name: functionCall.name,
              response: { success: true, result: searchResult }
            });
          } else {
            // Handle other function calls via agentFunctionHandler
            const result = await agentFunctionHandler.handleFunctionCall(
              functionCall,
              agentRole || 'unknown',
              projectId,
              taskId
            );

            functionResponses.push({
              name: functionCall.name,
              response: result.success ? result.result : { error: result.error }
            });

            functionCallsExecuted.push({
              name: functionCall.name,
              response: result
            });

            // If server was created, log it
            if (result.serverCreated) {
              logger.info(`[FunctionCallProcessor] MCP server created: ${result.serverCreated.id} (${result.serverCreated.name})`);
            }
          }
        } catch (error: any) {
          logger.error(`[FunctionCallProcessor] Function execution failed:`, error);
          functionResponses.push({
            name: functionCall.name,
            response: { error: error.message || 'Function execution failed' }
          });
        }
      }

      // Continue conversation with function results
      const continuationPrompt = this.buildContinuationPrompt(
        prompt,
        currentText,
        currentResponse.functionCalls,
        functionResponses
      );

      // Get next response from LLM
      currentResponse = await this.continueConversation(
        continuationPrompt,
        currentResponse.provider,
        currentResponse.modelUsed,
        tools,
        systemInstruction,
        functionResponses
      );

      currentText = currentResponse.text;
      
      // Accumulate usage
      if (currentResponse.usage) {
        totalUsage.promptTokens += currentResponse.usage.promptTokens || 0;
        totalUsage.candidatesTokens += currentResponse.usage.candidatesTokens || currentResponse.usage.completionTokens || 0;
        totalUsage.totalTokens += currentResponse.usage.totalTokens || 0;
      }
    }

    if (iteration >= this.maxIterations) {
      logger.warn(`[FunctionCallProcessor] Reached max iterations (${this.maxIterations}), stopping function call processing`);
    }

    return {
      text: currentText,
      functionCallsExecuted,
      finalText: currentText,
      usage: totalUsage,
      modelUsed: currentResponse.modelUsed,
      provider: currentResponse.provider
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
    functionResponses?: FunctionCallResponse[]
  ): Promise<LLMResponseWithFunctionCalls> {
    try {
      switch (provider) {
        case 'gemini':
          return await this.continueGeminiConversation(prompt, model, tools, systemInstruction, functionResponses);
        
        case 'openai':
          return await this.continueOpenAIConversation(prompt, model, tools, systemInstruction, functionResponses);
        
        case 'anthropic':
          return await this.continueAnthropicConversation(prompt, model, tools, systemInstruction, functionResponses);
        
        case 'deepseek':
          // DeepSeek uses OpenAI-compatible API
          return await this.continueOpenAIConversation(prompt, model, tools, systemInstruction, functionResponses);
        
        case 'grok':
          // Grok uses OpenAI-compatible API
          return await this.continueOpenAIConversation(prompt, model, tools, systemInstruction, functionResponses);
        
        default:
          throw new Error(`Unsupported provider: ${provider}`);
      }
    } catch (error: any) {
      logger.error(`[FunctionCallProcessor] Error continuing conversation with ${provider}:`, error);
      // Return a fallback response
      return {
        text: `Error processing function calls: ${error.message}`,
        usage: { promptTokens: 0, candidatesTokens: 0, totalTokens: 0 },
        modelUsed: model,
        provider
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
      tools: tools.length > 0 ? tools : undefined
    };

    const result = await geminiService.generateContent(prompt, model, config);
    
    // Gemini service now returns functionCalls directly
    const functionCalls = result.functionCalls?.map(fc => ({
      name: fc.name,
      args: fc.args
    })) || [];

    return {
      text: result.text,
      functionCalls: functionCalls.length > 0 ? functionCalls : undefined,
      usage: result.usage,
      modelUsed: model,
      provider: 'gemini'
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
    functionResponses?: FunctionCallResponse[]
  ): Promise<LLMResponseWithFunctionCalls> {
    // WI-3a: OpenAIService natively converts tool declarations and parses tool_calls, returning
    // structured `functionCalls`. Pass the tools through and read the native result instead of the
    // create_mcp_server-only text regex (which silently dropped every other tool on continuation turns).
    const result = await openAIService.generateContent(prompt, model, {
      systemInstruction,
      temperature: 0.7,
      tools: tools.length > 0 ? tools : undefined
    });

    const functionCalls = (result.functionCalls && result.functionCalls.length > 0)
      ? result.functionCalls
      : undefined;

    return {
      text: result.text,
      functionCalls,
      usage: {
        promptTokens: result.usage.promptTokens,
        candidatesTokens: result.usage.completionTokens,
        totalTokens: result.usage.totalTokens
      },
      modelUsed: model,
      provider: 'openai'
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
    const result = await anthropicService.generateContent(prompt, model, {
      systemInstruction,
      temperature: 0.7
    });

    // Extract function calls from Anthropic response
    const functionCalls = this.extractFunctionCallsFromText(result.text);

    return {
      text: result.text,
      functionCalls,
      usage: {
        promptTokens: result.usage.promptTokens,
        candidatesTokens: result.usage.completionTokens,
        totalTokens: result.usage.totalTokens
      },
      modelUsed: model,
      provider: 'anthropic'
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
          args
        });
      } catch (e) {
        // Try to extract key-value pairs if JSON parsing fails
        logger.debug('JSON parsing failed, trying alternative extraction');
      }
    }
    
    // Pattern 2: Look for structured function call blocks
    const blockPattern = /```(?:json|function_call)?\s*\{[\s\S]*?"name"\s*:\s*"create_mcp_server"[\s\S]*?\}\s*```/gi;
    while ((match = blockPattern.exec(text)) !== null) {
      try {
        const jsonMatch = match[0].match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.name === 'create_mcp_server' && parsed.args) {
            functionCalls.push({
              name: 'create_mcp_server',
              args: parsed.args
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
            const args = typeof toolCall.function.arguments === 'string'
              ? JSON.parse(toolCall.function.arguments)
              : toolCall.function.arguments;
            
            functionCalls.push({
              name: toolCall.function.name,
              args: args || {}
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
              parameters: funcDecl.parameters
            }
          });
        }
      }
    }
    
    return openAITools;
  }
}

export const functionCallProcessor = new FunctionCallProcessor();

