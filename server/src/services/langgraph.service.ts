/**
 * LangGraph Service
 * Provides stateful agent workflows with graph-based orchestration
 */

import { StateGraph, END, START } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { BaseMessage, HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import { logger } from '../utils/logger.js';
import { apiKeyProvider } from './apiKeyProvider.service.js';
import { internalTaskRouter } from './internalTaskRouter.service.js';

export interface GraphState {
  messages: BaseMessage[];
  [key: string]: any;
}

export interface GraphNode {
  id: string;
  name: string;
  handler: (state: GraphState) => Promise<GraphState | Partial<GraphState>>;
}

export interface GraphEdge {
  from: string;
  to: string;
  condition?: (state: GraphState) => string;
}

export interface GraphWorkflow {
  id: string;
  name: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  initialState?: GraphState;
}

export interface GraphExecutionResult {
  workflowId: string;
  finalState: GraphState;
  executionPath: string[];
  executionTime: number;
  success: boolean;
}

class LangGraphService {
  private workflows: Map<string, StateGraph> = new Map();
  private workflowConfigs: Map<string, GraphWorkflow> = new Map();
  private llmCache: Map<string, any> = new Map();
  private initialized: boolean = false;

  /**
   * Initialize LangGraph service
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      this.initialized = true;
      logger.info('✅ LangGraph service initialized');
    } catch (error: unknown) {
      logger.error('Failed to initialize LangGraph service:', error);
      throw error;
    }
  }

  /**
   * Get LLM instance (using database-stored API keys)
   * Uses internal router for intelligent model selection when no model specified
   */
  private async getLLM(model?: string, temperature?: number, taskPrompt?: string): Promise<any> {
    let modelName = model;

    // Use internal router for model selection if no model specified
    if (!modelName) {
      try {
        const routingDecision = await internalTaskRouter.routeTask({
          prompt: taskPrompt || 'LangGraph workflow execution',
          taskType: 'analysis',
          context: 'system'
        });

        modelName = routingDecision.selectedModel.modelIdentifier;
        logger.info(`[LangGraph] Internal router selected: ${modelName} (${routingDecision.tier} tier)`);
      } catch (routerError: any) {
        logger.warn(`[LangGraph] Internal router failed, using default model: ${routerError.message}`);
        const openaiKey = await apiKeyProvider.getApiKey('openai');
        modelName = openaiKey ? 'gpt-4o-mini' : 'gemini-2.5-flash'; // Default to economy models
      }
    }

    const cacheKey = `${modelName}_${temperature || 0.7}`;

    if (this.llmCache.has(cacheKey)) {
      return this.llmCache.get(cacheKey);
    }

    let llm: any;
    const openaiKey = await apiKeyProvider.getApiKey('openai');
    const geminiKey = await apiKeyProvider.getApiKey('gemini');
    const temp = temperature ?? 0.7;

    if (openaiKey && modelName.includes('gpt')) {
      llm = new ChatOpenAI({
        modelName: modelName,
        temperature: temp,
        openAIApiKey: openaiKey,
      });
    } else if (geminiKey) {
      llm = new ChatGoogleGenerativeAI({
        modelName: modelName,
        temperature: temp,
        apiKey: geminiKey,
      });
    } else {
      throw new Error('No LLM API key configured. Add API keys via Admin Console → Settings → API Keys');
    }

    this.llmCache.set(cacheKey, llm);
    return llm;
  }

  /**
   * Create a workflow from configuration
   */
  createWorkflow(workflow: GraphWorkflow): StateGraph {
    if (!this.initialized) {
      this.initialize();
    }

    // Create state graph
    const graph = new StateGraph({
      channels: {
        messages: {
          reducer: (x: BaseMessage[], y: BaseMessage[]) => x.concat(y),
          default: () => [],
        },
      },
    });

    // Add nodes
    for (const node of workflow.nodes) {
      graph.addNode(node.id, node.handler);
    }

    // Add edges
    for (const edge of workflow.edges) {
      if (edge.condition) {
        // Conditional edge
        graph.addConditionalEdges(
          edge.from,
          edge.condition,
          {
            [edge.to]: edge.to,
          }
        );
      } else {
        // Direct edge
        if (edge.from === 'START') {
          graph.addEdge(START, edge.to);
        } else if (edge.to === 'END') {
          graph.addEdge(edge.from, END);
        } else {
          graph.addEdge(edge.from, edge.to);
        }
      }
    }

    // Set entry point
    const entryNode = workflow.nodes.find(n =>
      !workflow.edges.some(e => e.to === n.id && e.from !== 'START')
    );
    if (entryNode && !workflow.edges.some(e => e.from === 'START')) {
      graph.addEdge(START, entryNode.id);
    }

    // Set exit point
    const exitNodes = workflow.nodes.filter(n =>
      !workflow.edges.some(e => e.from === n.id && e.to !== 'END')
    );
    for (const exitNode of exitNodes) {
      if (!workflow.edges.some(e => e.from === exitNode.id)) {
        graph.addEdge(exitNode.id, END);
      }
    }

    this.workflows.set(workflow.id, graph);
    this.workflowConfigs.set(workflow.id, workflow);

    logger.debug(`Created workflow: ${workflow.id} with ${workflow.nodes.length} nodes`);
    return graph;
  }

  /**
   * Execute a workflow
   */
  async executeWorkflow(
    workflowId: string,
    input: GraphState,
    config?: { stream?: boolean }
  ): Promise<GraphExecutionResult | AsyncGenerator<GraphState, void, unknown>> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    const workflowConfig = this.workflowConfigs.get(workflowId);
    const startTime = Date.now();
    const executionPath: string[] = [];

    try {
      const compiledGraph = workflow.compile();
      const initialState = workflowConfig?.initialState || input;

      if (config?.stream) {
        // Return async generator for streaming
        return this.streamWorkflow(compiledGraph, initialState, executionPath, startTime);
      }

      // Execute workflow
      const result = await compiledGraph.invoke(initialState);
      const executionTime = Date.now() - startTime;

      return {
        workflowId,
        finalState: result as GraphState,
        executionPath,
        executionTime,
        success: true,
      };
    } catch (error: unknown) {
      logger.error(`Workflow ${workflowId} execution failed:`, error);
      return {
        workflowId,
        finalState: input,
        executionPath,
        executionTime: Date.now() - startTime,
        success: false,
      };
    }
  }

  /**
   * Stream workflow execution
   */
  private async *streamWorkflow(
    compiledGraph: any,
    initialState: GraphState,
    executionPath: string[],
    startTime: number
  ): AsyncGenerator<GraphState, void, unknown> {
    try {
      const stream = await compiledGraph.stream(initialState);

      for await (const state of stream) {
        executionPath.push(Object.keys(state)[0] || 'unknown');
        yield state as GraphState;
      }
    } catch (error: unknown) {
      logger.error('Workflow streaming failed:', error);
      throw error;
    }
  }

  /**
   * Create a simple agent workflow
   */
  async createAgentWorkflow(
    workflowId: string,
    workflowName: string,
    systemPrompt: string,
    model?: string
  ): Promise<StateGraph> {
    const llm = await this.getLLM(model);

    // Define nodes
    const nodes: GraphNode[] = [
      {
        id: 'agent',
        name: 'Agent',
        handler: async (state: GraphState) => {
          const messages = state.messages || [];
          const response = await llm.invoke(messages);

          return {
            messages: [response],
          };
        },
      },
    ];

    // Define edges
    const edges: GraphEdge[] = [
      { from: 'START', to: 'agent' },
      { from: 'agent', to: 'END' },
    ];

    const workflow: GraphWorkflow = {
      id: workflowId,
      name: workflowName,
      nodes,
      edges,
      initialState: {
        messages: [new SystemMessage(systemPrompt)],
      },
    };

    return this.createWorkflow(workflow);
  }

  /**
   * Create a multi-agent conversation workflow
   */
  createMultiAgentWorkflow(
    workflowId: string,
    workflowName: string,
    agents: Array<{ id: string; name: string; systemPrompt: string; model?: string }>,
    routingLogic?: (state: GraphState) => string
  ): StateGraph {
    const nodes: GraphNode[] = agents.map(agent => ({
      id: agent.id,
      name: agent.name,
      handler: async (state: GraphState) => {
        const llm = await this.getLLM(agent.model);
        const messages = state.messages || [];

        // Add system message for this agent
        const agentMessages = [
          new SystemMessage(agent.systemPrompt),
          ...messages,
        ];

        const response = await llm.invoke(agentMessages);

        return {
          messages: [response],
          lastAgent: agent.id,
        };
      },
    }));

    const edges: GraphEdge[] = [];

    // Add routing edges
    if (routingLogic) {
      // Add conditional routing from each agent
      for (const agent of agents) {
        edges.push({
          from: agent.id,
          to: 'routing',
          condition: routingLogic,
        });
      }
    } else {
      // Simple round-robin
      for (let i = 0; i < agents.length; i++) {
        const nextAgent = agents[(i + 1) % agents.length];
        edges.push({
          from: agents[i].id,
          to: nextAgent.id,
        });
      }
    }

    const workflow: GraphWorkflow = {
      id: workflowId,
      name: workflowName,
      nodes,
      edges,
      initialState: {
        messages: [],
      },
    };

    return this.createWorkflow(workflow);
  }

  /**
   * Create a RAG workflow with retrieval and generation
   */
  async createRAGWorkflow(
    workflowId: string,
    workflowName: string,
    retrievalHandler: (state: GraphState) => Promise<Partial<GraphState>>,
    model?: string
  ): Promise<StateGraph> {
    const llm = await this.getLLM(model);

    const nodes: GraphNode[] = [
      {
        id: 'retrieve',
        name: 'Retrieve',
        handler: retrievalHandler,
      },
      {
        id: 'generate',
        name: 'Generate',
        handler: async (state: GraphState) => {
          const messages = state.messages || [];
          const context = (state as any).context || '';

          const prompt = `Context:\n${context}\n\nQuestion: ${messages[messages.length - 1]?.content || ''}\n\nAnswer:`;
          const response = await llm.invoke(prompt);

          return {
            messages: [response],
          };
        },
      },
    ];

    const edges: GraphEdge[] = [
      { from: 'START', to: 'retrieve' },
      { from: 'retrieve', to: 'generate' },
      { from: 'generate', to: 'END' },
    ];

    const workflow: GraphWorkflow = {
      id: workflowId,
      name: workflowName,
      nodes,
      edges,
    };

    return this.createWorkflow(workflow);
  }

  /**
   * Get workflow by ID
   */
  getWorkflow(workflowId: string): StateGraph | undefined {
    return this.workflows.get(workflowId);
  }

  /**
   * List all workflows
   */
  listWorkflows(): string[] {
    return Array.from(this.workflows.keys());
  }
}

export const langgraphService = new LangGraphService();
