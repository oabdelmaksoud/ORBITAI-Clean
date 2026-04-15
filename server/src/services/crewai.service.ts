/**
 * CrewAI-inspired Multi-Agent Orchestration Service
 * Coordinates multiple specialized agents to work together on complex tasks
 */

import { ChatOpenAI } from '@langchain/openai';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { logger } from '../utils/logger.js';
import { apiKeyProvider } from './apiKeyProvider.service.js';
import { internalTaskRouter } from './internalTaskRouter.service.js';

export interface Agent {
  id: string;
  role: string;
  goal: string;
  backstory?: string;
  tools?: string[];
  model?: string;
  temperature?: number;
}

export interface Task {
  id: string;
  description: string;
  agentId: string;
  expectedOutput?: string;
  dependencies?: string[];
}

export interface Crew {
  id: string;
  name: string;
  agents: Agent[];
  tasks: Task[];
  verbose?: boolean;
}

export interface CrewExecutionResult {
  crewId: string;
  tasks: Array<{
    taskId: string;
    agentId: string;
    output: string;
    status: 'completed' | 'failed' | 'skipped';
    executionTime: number;
  }>;
  totalExecutionTime: number;
  success: boolean;
}

class CrewAIService {
  private agents: Map<string, Agent> = new Map();
  private crews: Map<string, Crew> = new Map();
  private llmCache: Map<string, any> = new Map();
  private initialized: boolean = false;

  /**
   * Initialize CrewAI service
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      this.initialized = true;
      logger.info('✅ CrewAI service initialized');
    } catch (error: unknown) {
      logger.error('Failed to initialize CrewAI service:', error);
      throw error;
    }
  }

  /**
   * Create an agent
   */
  createAgent(agent: Agent): Agent {
    this.agents.set(agent.id, agent);
    logger.debug(`Created agent: ${agent.id} (${agent.role})`);
    return agent;
  }

  /**
   * Get agent by ID
   */
  getAgent(agentId: string): Agent | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Create a crew
   */
  createCrew(crew: Crew): Crew {
    // Validate agents exist
    for (const agent of crew.agents) {
      if (!this.agents.has(agent.id)) {
        this.createAgent(agent);
      }
    }

    this.crews.set(crew.id, crew);
    logger.debug(`Created crew: ${crew.id} with ${crew.agents.length} agents`);
    return crew;
  }

  /**
   * Get crew by ID
   */
  getCrew(crewId: string): Crew | undefined {
    return this.crews.get(crewId);
  }

  /**
   * Get LLM instance for an agent (using database-stored API keys)
   * Uses internal router for intelligent model selection when no model specified
   */
  private async getLLMForAgent(agent: Agent, taskDescription?: string): Promise<any> {
    let model = agent.model;

    // Use internal router for model selection if no model specified
    if (!model) {
      try {
        const routingDecision = await internalTaskRouter.routeTask({
          prompt: taskDescription || agent.goal,
          taskType: 'analysis',
          agentRole: agent.role,
          context: 'system',
        });

        model = routingDecision.selectedModel.modelIdentifier;
        logger.info(
          `[CrewAI] Internal router selected: ${model} (${routingDecision.tier} tier) for agent ${agent.role}`
        );
      } catch (routerError: any) {
        logger.warn(`[CrewAI] Internal router failed, using default model: ${routerError.message}`);
        const openaiKey = await apiKeyProvider.getApiKey('openai');
        model = openaiKey ? 'gpt-4o-mini' : 'gemini-2.5-flash'; // Default to economy models
      }
    }

    const cacheKey = `${model}_${agent.temperature || 0.7}`;

    if (this.llmCache.has(cacheKey)) {
      return this.llmCache.get(cacheKey);
    }

    let llm: any;
    const openaiKey = await apiKeyProvider.getApiKey('openai');
    const geminiKey = await apiKeyProvider.getApiKey('gemini');
    const temperature = agent.temperature ?? 0.7;

    if (openaiKey && model.includes('gpt')) {
      llm = new ChatOpenAI({
        modelName: model,
        temperature,
        openAIApiKey: openaiKey,
      });
    } else if (geminiKey) {
      llm = new ChatGoogleGenerativeAI({
        model: model,
        temperature,
        apiKey: geminiKey,
      } as any);
    } else {
      throw new Error(
        'No LLM API key configured. Add API keys via Admin Console → Settings → API Keys'
      );
    }

    this.llmCache.set(cacheKey, llm);
    return llm;
  }

  /**
   * Execute a task with an agent
   */
  private async executeTask(
    task: Task,
    agent: Agent,
    context: Record<string, any> = {}
  ): Promise<{
    output: string;
    status: 'completed' | 'failed';
    executionTime: number;
  }> {
    const startTime = Date.now();

    try {
      const llm = await this.getLLMForAgent(agent, task.description);

      // Build prompt with agent context
      const systemPrompt = `You are ${agent.role}.

${agent.backstory || ''}

Your goal: ${agent.goal}

${agent.tools ? `Available tools: ${agent.tools.join(', ')}` : ''}

Task: ${task.description}
${task.expectedOutput ? `Expected output format: ${task.expectedOutput}` : ''}

${Object.keys(context).length > 0 ? `Context from previous tasks:\n${JSON.stringify(context, null, 2)}` : ''}

Provide your response:`;

      const response = await llm.invoke(systemPrompt);
      const output =
        typeof response.content === 'string' ? response.content : JSON.stringify(response.content);

      const executionTime = Date.now() - startTime;

      return {
        output,
        status: 'completed',
        executionTime,
      };
    } catch (error: unknown) {
      logger.error(`Task ${task.id} execution failed:`, error);
      return {
        output: `Error: ${error instanceof Error ? error.message : String(error)}`,
        status: 'failed',
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Execute a crew (run all tasks with their assigned agents)
   */
  async executeCrew(
    crewId: string,
    inputs: Record<string, any> = {}
  ): Promise<CrewExecutionResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    const crew = this.crews.get(crewId);
    if (!crew) {
      throw new Error(`Crew ${crewId} not found`);
    }

    const startTime = Date.now();
    const taskResults: CrewExecutionResult['tasks'] = [];
    const taskContext: Record<string, string> = {};

    // Build task dependency graph
    const taskMap = new Map<string, Task>();
    const taskDependencies = new Map<string, string[]>();

    for (const task of crew.tasks) {
      taskMap.set(task.id, task);
      taskDependencies.set(task.id, task.dependencies || []);
    }

    // Topological sort to execute tasks in order
    const executedTasks = new Set<string>();
    const executeTaskWithDependencies = async (taskId: string): Promise<void> => {
      if (executedTasks.has(taskId)) {
        return;
      }

      const task = taskMap.get(taskId);
      if (!task) {
        return;
      }

      // Execute dependencies first
      for (const depId of taskDependencies.get(taskId) || []) {
        await executeTaskWithDependencies(depId);
      }

      // Execute task
      const agent = this.agents.get(task.agentId);
      if (!agent) {
        taskResults.push({
          taskId: task.id,
          agentId: task.agentId,
          output: `Error: Agent ${task.agentId} not found`,
          status: 'failed',
          executionTime: 0,
        });
        executedTasks.add(taskId);
        return;
      }

      // Build context from previous tasks
      const context: Record<string, any> = { ...inputs };
      for (const [prevTaskId, output] of Object.entries(taskContext)) {
        context[`task_${prevTaskId}`] = output;
      }

      const result = await this.executeTask(task, agent, context);
      taskContext[task.id] = result.output;

      taskResults.push({
        taskId: task.id,
        agentId: task.agentId,
        output: result.output,
        status: result.status === 'completed' ? 'completed' : 'failed',
        executionTime: result.executionTime,
      });

      executedTasks.add(taskId);
    };

    // Execute all tasks
    for (const task of crew.tasks) {
      if (!executedTasks.has(task.id)) {
        await executeTaskWithDependencies(task.id);
      }
    }

    const totalExecutionTime = Date.now() - startTime;
    const success = taskResults.every(r => r.status === 'completed');

    if (crew.verbose) {
      logger.info(`Crew ${crewId} execution completed in ${totalExecutionTime}ms`);
      logger.info(
        `Tasks: ${taskResults.filter(r => r.status === 'completed').length}/${taskResults.length} completed`
      );
    }

    return {
      crewId,
      tasks: taskResults,
      totalExecutionTime,
      success,
    };
  }

  /**
   * Create a simple crew with predefined agents
   */
  createSimpleCrew(
    crewId: string,
    crewName: string,
    agents: Agent[],
    taskDescriptions: Array<{ description: string; agentRole: string }>
  ): Crew {
    // Create agents if they don't exist
    for (const agent of agents) {
      if (!this.agents.has(agent.id)) {
        this.createAgent(agent);
      }
    }

    // Create tasks
    const tasks: Task[] = taskDescriptions.map((desc, index) => {
      const agent = agents.find(a => a.role === desc.agentRole);
      if (!agent) {
        throw new Error(`Agent with role ${desc.agentRole} not found`);
      }

      return {
        id: `task_${crewId}_${index}`,
        description: desc.description,
        agentId: agent.id,
        dependencies: index > 0 ? [`task_${crewId}_${index - 1}`] : [],
      };
    });

    return this.createCrew({
      id: crewId,
      name: crewName,
      agents,
      tasks,
      verbose: true,
    });
  }

  /**
   * List all crews
   */
  listCrews(): Crew[] {
    return Array.from(this.crews.values());
  }

  /**
   * List all agents
   */
  listAgents(): Agent[] {
    return Array.from(this.agents.values());
  }
}

export const crewAIService = new CrewAIService();
