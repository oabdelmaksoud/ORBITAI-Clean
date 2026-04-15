/**
 * Autogen-inspired Multi-Agent Conversation Service
 * Facilitates multi-agent conversations with automated task execution
 * Uses LLM Router for intelligent model selection and API key management
 */

import { logger } from '../utils/logger.js';
import { llmRouter } from './llm/LLMRouter.js';

export interface AutogenAgent {
  id: string;
  name: string;
  systemMessage: string;
  model?: string;
  temperature?: number;
  maxConsecutiveAutoReply?: number;
  humanInputMode?: 'NEVER' | 'ALWAYS' | 'TERMINATE';
  codeExecution?: boolean;
}

export interface AutogenConfig {
  userId?: string;
  projectId?: string;
}

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  agentId?: string;
  timestamp?: Date;
}

export interface ConversationConfig {
  maxRounds?: number;
  terminationCondition?: (messages: ConversationMessage[]) => boolean;
  humanInTheLoop?: boolean;
}

export interface ConversationResult {
  conversationId: string;
  messages: ConversationMessage[];
  rounds: number;
  terminated: boolean;
  terminationReason?: string;
  executionTime: number;
}

class AutogenService {
  private agents: Map<string, AutogenAgent> = new Map();
  private conversations: Map<string, ConversationMessage[]> = new Map();
  private conversationConfigs: Map<string, AutogenConfig> = new Map();
  private initialized: boolean = false;

  /**
   * Initialize Autogen service
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      this.initialized = true;
      logger.info('✅ Autogen service initialized');
    } catch (error: unknown) {
      logger.error('Failed to initialize Autogen service:', error);
      throw error;
    }
  }

  /**
   * Register an agent
   */
  registerAgent(agent: AutogenAgent): AutogenAgent {
    this.agents.set(agent.id, agent);
    logger.debug(`Registered agent: ${agent.id} (${agent.name})`);
    return agent;
  }

  /**
   * Get agent by ID
   */
  getAgent(agentId: string): AutogenAgent | undefined {
    return this.agents.get(agentId);
  }


  /**
   * Generate reply from an agent using LLM Router
   */
  private async generateReply(
    agent: AutogenAgent,
    conversationHistory: ConversationMessage[],
    currentMessage?: string,
    userId?: string,
    projectId?: string
  ): Promise<string> {
    // Build conversation context
    let conversationText = '';

    // Add conversation history
    for (const msg of conversationHistory) {
      if (msg.role === 'user') {
        conversationText += `User: ${msg.content}\n\n`;
      } else if (msg.role === 'assistant') {
        const agentName = this.agents.get(msg.agentId || '')?.name || 'Assistant';
        conversationText += `${agentName}: ${msg.content}\n\n`;
      }
    }

    // Add current message if provided
    if (currentMessage) {
      conversationText += `User: ${currentMessage}\n\n`;
    }

    // Build the prompt (system instruction is handled separately by LLM router)
    const prompt = `${conversationText}${agent.name}:`;

    // Use LLM Router to generate response
    const result = await llmRouter.executeWithFallback({
      prompt: prompt,
      context: {
        agentRole: agent.name,
        taskType: 'chat',
        systemInstruction: agent.systemMessage, // System instruction handled separately
        model: agent.model, // Use specified model if provided
        maxTokens: 500 // Limit response length for faster responses
      },
      routingContext: {
        userId: userId,
        projectId: projectId,
        userPreferences: {
          costPreference: 'low' // Prefer fast/cheap models for agent conversations to reduce latency
        }
      },
      requestType: 'agent-conversation',
      contextType: 'workspace'
    });

    return result.text || '';
  }

  /**
   * Initiate a conversation between agents
   */
  async initiateConversation(
    conversationId: string,
    agents: AutogenAgent[],
    initialMessage: string,
    config: ConversationConfig = {},
    autogenConfig?: AutogenConfig
  ): Promise<ConversationResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    const messages: ConversationMessage[] = [];
    const maxRounds = config.maxRounds || 10;
    let rounds = 0;
    let terminated = false;
    let terminationReason: string | undefined;

    // Store conversation config for API key routing
    if (autogenConfig) {
      this.conversationConfigs.set(conversationId, autogenConfig);
    }

    // Register agents if not already registered
    for (const agent of agents) {
      if (!this.agents.has(agent.id)) {
        this.registerAgent(agent);
      }
    }

    const userId = autogenConfig?.userId;
    const projectId = autogenConfig?.projectId;

    // Initialize conversation
    messages.push({
      role: 'user',
      content: initialMessage,
      timestamp: new Date(),
    });

    // Start conversation loop
    let currentAgentIndex = 0;
    let consecutiveAutoReplies = new Map<string, number>();

    logger.info(`[Autogen] Starting conversation with ${agents.length} agents, maxRounds: ${maxRounds}`);

    // OPTIMIZATION: First round - all agents respond in parallel for speed
    if (rounds === 0 && agents.length > 1) {
      logger.debug(`[Autogen] First round: All ${agents.length} agents responding in parallel`);

      try {
        const parallelReplies = await Promise.all(
          agents.map(async (agent) => {
            try {
              const replyPromise = this.generateReply(
                agent,
                messages,
                initialMessage,
                userId,
                projectId
              );

              // Add 5-second timeout per agent response
              const timeoutPromise = new Promise<string>((_, reject) => {
                setTimeout(() => reject(new Error('Agent response timeout (60s)')), 60000);
              });

              const reply = await Promise.race([replyPromise, timeoutPromise]);
              return { agentId: agent.id, agentName: agent.name, reply, success: true };
            } catch (error: unknown) {
              logger.error(`Agent ${agent.id} failed in parallel round:`, error);
              return { agentId: agent.id, agentName: agent.name, reply: `Error: ${(error instanceof Error ? error.message : String(error))}`, success: false };
            }
          })
        );

        // Add all replies to messages
        for (const { agentId, agentName, reply, success } of parallelReplies) {
          if (success && reply && reply.trim().length > 0) {
            messages.push({
              role: 'assistant',
              content: reply,
              agentId,
              timestamp: new Date(),
            });
            consecutiveAutoReplies.set(agentId, 1);
          } else {
            messages.push({
              role: 'assistant',
              content: success ? `${agentName} is thinking...` : reply,
              agentId,
              timestamp: new Date(),
            });
          }
        }

        rounds = 1;
        currentAgentIndex = 0; // Start round-robin from beginning for subsequent rounds

        // Enhanced early termination: Stop after first round if agents provide sufficient value
        const allReplies = parallelReplies.map(r => r.reply.toLowerCase()).join(' ');
        // const _allRepliesText = parallelReplies.map(r => r.reply).join(' ');

        // Check explicit termination signals
        if (allReplies.includes('terminate') ||
          allReplies.includes('conversation complete') ||
          allReplies.includes('task complete')) {
          terminated = true;
          terminationReason = 'Agents indicated completion';
        } else {
          // Enhanced: Check if agents provided sufficient value (quality threshold)
          // If all agents responded with meaningful content (not just "thinking" or errors)
          const meaningfulReplies = parallelReplies.filter(r =>
            r.success &&
            r.reply &&
            r.reply.trim().length > 50 && // At least 50 characters
            !r.reply.toLowerCase().includes('error') &&
            !r.reply.toLowerCase().includes('thinking')
          );

          // If we have at least 2 meaningful replies and maxRounds is 2 or less, stop after first round
          // This optimizes for speed when we only need 2 rounds anyway
          if (meaningfulReplies.length >= Math.min(2, agents.length) && maxRounds <= 2) {
            terminated = true;
            terminationReason = 'Sufficient value provided in first round';
            logger.info(`[Autogen] Early termination: ${meaningfulReplies.length}/${agents.length} agents provided sufficient value`);
          }
        }
      } catch (error: unknown) {
        logger.error('[Autogen] Parallel first round failed:', error);
        // Fall through to sequential mode
      }
    }

    // Subsequent rounds: sequential (round-robin) for context building
    while (rounds < maxRounds && !terminated) {
      const currentAgent = agents[currentAgentIndex];
      const maxAutoReplies = currentAgent.maxConsecutiveAutoReply || 10;

      logger.debug(`[Autogen] Round ${rounds + 1}/${maxRounds}: Agent ${currentAgent.name} (${currentAgent.id})`);

      // Check if agent should respond
      const autoReplyCount = consecutiveAutoReplies.get(currentAgent.id) || 0;

      if (currentAgent.humanInputMode === 'ALWAYS' && autoReplyCount >= maxAutoReplies) {
        // Need human input
        terminated = true;
        terminationReason = `Agent ${currentAgent.name} requires human input`;
        break;
      }

      // Generate reply with timeout (5 seconds max per agent)
      try {
        const replyPromise = this.generateReply(
          currentAgent,
          messages,
          undefined, // Only use initialMessage in first round
          userId,
          projectId
        );

        // Add 5-second timeout per agent response
        const timeoutPromise = new Promise<string>((_, reject) => {
          setTimeout(() => reject(new Error('Agent response timeout (60s)')), 60000);
        });

        const reply = await Promise.race([replyPromise, timeoutPromise]);

        if (!reply || reply.trim().length === 0) {
          logger.warn(`[Autogen] Agent ${currentAgent.name} generated empty reply`);
          // Still add a message to keep conversation going
          messages.push({
            role: 'assistant',
            content: `${currentAgent.name} is thinking...`,
            agentId: currentAgent.id,
            timestamp: new Date(),
          });
        } else {
          logger.debug(`[Autogen] Agent ${currentAgent.name} replied (${reply.length} chars)`);
          messages.push({
            role: 'assistant',
            content: reply,
            agentId: currentAgent.id,
            timestamp: new Date(),
          });
        }

        consecutiveAutoReplies.set(
          currentAgent.id,
          (consecutiveAutoReplies.get(currentAgent.id) || 0) + 1
        );

        // Reset other agents' counters
        for (const agentId of consecutiveAutoReplies.keys()) {
          if (agentId !== currentAgent.id) {
            consecutiveAutoReplies.set(agentId, 0);
          }
        }

        rounds++;

        // Check termination condition
        if (config.terminationCondition) {
          terminated = config.terminationCondition(messages);
          if (terminated) {
            terminationReason = 'Termination condition met';
          }
        }

        // Move to next agent (round-robin)
        currentAgentIndex = (currentAgentIndex + 1) % agents.length;

        // Check for natural termination (e.g., agent says conversation is complete)
        if (reply.toLowerCase().includes('terminate') ||
          reply.toLowerCase().includes('conversation complete') ||
          reply.toLowerCase().includes('task complete')) {
          terminated = true;
          terminationReason = 'Agent indicated completion';
        }
      } catch (error: unknown) {
        // Handle timeout or other errors
        const errorMessage = (error instanceof Error ? error.message : String(error)) || 'Unknown error';
        logger.warn(`[Autogen] Agent ${currentAgent.name} error: ${errorMessage}`);

        // Add error message to conversation
        messages.push({
          role: 'assistant',
          content: `${currentAgent.name}: ${errorMessage.includes('timeout') ? 'Response timeout - moving on...' : 'Error generating response'}`,
          agentId: currentAgent.id,
          timestamp: new Date(),
        });

        // Don't increment auto-reply count on error to allow retry
        rounds++;
        currentAgentIndex = (currentAgentIndex + 1) % agents.length;
      }
    }

    if (rounds >= maxRounds && !terminated) {
      terminated = true;
      terminationReason = 'Maximum rounds reached';
    }

    // Store conversation
    this.conversations.set(conversationId, messages);

    const executionTime = Date.now() - startTime;

    logger.info(`[Autogen] Conversation completed: ${rounds} rounds, ${messages.length} messages, terminated: ${terminated}, reason: ${terminationReason || 'N/A'}`);

    return {
      conversationId,
      messages,
      rounds,
      terminated,
      terminationReason,
      executionTime,
    };
  }

  /**
   * Continue an existing conversation
   */
  async continueConversation(
    conversationId: string,
    message: string,
    config: ConversationConfig = {},
    autogenConfig?: AutogenConfig
  ): Promise<ConversationResult> {
    const existingMessages = this.conversations.get(conversationId);
    if (!existingMessages || existingMessages.length === 0) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    // Get stored config if not provided
    const storedConfig = autogenConfig || this.conversationConfigs.get(conversationId);

    // Extract agents from conversation
    const agentIds = new Set(
      existingMessages
        .filter(m => m.agentId)
        .map(m => m.agentId!)
    );

    const agents = Array.from(agentIds)
      .map(id => this.agents.get(id))
      .filter((a): a is AutogenAgent => a !== undefined);

    if (agents.length === 0) {
      throw new Error('No agents found in conversation');
    }

    // Add new message
    existingMessages.push({
      role: 'user',
      content: message,
      timestamp: new Date(),
    });

    // Continue conversation
    return this.initiateConversation(conversationId, agents, message, {
      ...config,
      maxRounds: config.maxRounds || 5, // Shorter for continuation
    }, storedConfig);
  }

  /**
   * Create a two-agent conversation (user proxy + assistant)
   */
  createTwoAgentConversation(
    userProxyId: string,
    assistantId: string,
    assistantSystemMessage: string,
    userProxyConfig?: Partial<AutogenAgent>
  ): { userProxy: AutogenAgent; assistant: AutogenAgent } {
    const userProxy: AutogenAgent = {
      id: userProxyId,
      name: 'User Proxy',
      systemMessage: 'You are a user proxy. You help users interact with AI assistants.',
      humanInputMode: 'ALWAYS',
      maxConsecutiveAutoReply: 0,
      ...userProxyConfig,
    };

    const assistant: AutogenAgent = {
      id: assistantId,
      name: 'Assistant',
      systemMessage: assistantSystemMessage,
      humanInputMode: 'NEVER',
      maxConsecutiveAutoReply: 10,
    };

    this.registerAgent(userProxy);
    this.registerAgent(assistant);

    return { userProxy, assistant };
  }

  /**
   * Get conversation history
   */
  getConversation(conversationId: string): ConversationMessage[] {
    return this.conversations.get(conversationId) || [];
  }

  /**
   * List all conversations
   */
  listConversations(): string[] {
    return Array.from(this.conversations.keys());
  }

  /**
   * Clear conversation
   */
  clearConversation(conversationId: string): void {
    this.conversations.delete(conversationId);
  }
}

export const autogenService = new AutogenService();













