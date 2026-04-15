/**
 * Task Analyzer - Analyzes tasks to determine requirements and characteristics
 */

import { TaskComplexity} from './models/ModelRegistry.js';

export type TaskType = 
  | 'chat' 
  | 'conversation' 
  | 'prompt-enhancement' 
  | 'project-preview' 
  | 'code-generation' 
  | 'structured-output' 
  | 'documentation' 
  | 'analysis' 
  | 'creative'
  | 'long-context'
  | 'writing'
  | 'simple-tasks';

export type TaskDomain = 'code' | 'design' | 'analysis' | 'conversation' | 'documentation' | 'planning';
export type OutputType = 'text' | 'structured' | 'code' | 'diagram' | 'mixed';
export type LatencyRequirement = 'real-time' | 'fast' | 'normal' | 'batch';

export interface TaskContext {
  agentRole?: string;
  projectPhase?: string;
  userPackage?: string;
  projectBudget?: number;
  budgetUsed?: number;
  tools?: any[]; // Tools/function declarations that require function calling
}

export interface TaskAnalysis {
  taskId?: string;
  taskType: TaskType;
  agentRole?: string;
  complexity: TaskComplexity;
  domain: TaskDomain;
  outputType: OutputType;
  latencyRequirement: LatencyRequirement;
  costSensitivity: 'high' | 'medium' | 'low';
  estimatedTokens: number;
  requiredCapabilities: string[];
  contextLength?: number;
  priority: number;
}

export class TaskAnalyzer {
  analyzeTask(
    prompt: string,
    taskType?: TaskType,
    context?: TaskContext
  ): TaskAnalysis {
    // Determine task type if not provided
    const detectedTaskType = taskType || this.detectTaskType(prompt);
    
    // Analyze complexity
    const complexity = this.estimateComplexity(prompt, detectedTaskType);
    
    // Determine domain
    const domain = this.determineDomain(context?.agentRole || '', detectedTaskType);
    
    // Determine output type
    const outputType = this.determineOutputType(detectedTaskType, prompt);
    
    // Estimate token count
    const estimatedTokens = this.estimateTokenCount(prompt);
    
    // Determine latency requirement (enhanced with prompt analysis)
    const latencyRequirement = this.determineLatencyRequirement(detectedTaskType, prompt);
    
    // Determine cost sensitivity (enhanced with prompt analysis)
    const costSensitivity = this.determineCostSensitivity(context, prompt);
    
    // Identify required capabilities (enhanced with prompt analysis)
    const requiredCapabilities = this.identifyRequiredCapabilities(
      detectedTaskType, 
      outputType,
      context?.tools,
      prompt
    );
    
    // Determine priority
    const priority = this.determinePriority(complexity, context);

    return {
      taskType: detectedTaskType,
      agentRole: context?.agentRole,
      complexity,
      domain,
      outputType,
      latencyRequirement,
      costSensitivity,
      estimatedTokens,
      requiredCapabilities,
      priority
    };
  }

  private detectTaskType(prompt: string): TaskType {
    const lowerPrompt = prompt.toLowerCase();
    
    if (lowerPrompt.includes('chat') || lowerPrompt.includes('conversation')) {
      return 'chat';
    }
    if (lowerPrompt.includes('code') || lowerPrompt.includes('generate') || lowerPrompt.includes('implement')) {
      return 'code-generation';
    }
    if (lowerPrompt.includes('preview') || lowerPrompt.includes('project brief')) {
      return 'project-preview';
    }
    if (lowerPrompt.includes('document') || lowerPrompt.includes('write')) {
      return 'documentation';
    }
    if (lowerPrompt.includes('analyze') || lowerPrompt.includes('evaluate')) {
      return 'analysis';
    }
    
    return 'conversation';
  }

  private estimateComplexity(prompt: string, taskType: TaskType): TaskComplexity {
    const promptLength = prompt.length;
    const wordCount = prompt.split(/\s+/).length;
    
    // Complex indicators
    const complexIndicators = [
      'architecture', 'system design', 'complex', 'multiple',
      'integration', 'analysis', 'evaluate', 'structured output',
      'schema', 'diagram', 'prototype'
    ];
    
    const hasComplexIndicators = complexIndicators.some(indicator => 
      prompt.toLowerCase().includes(indicator)
    );
    
    // Simple indicators
    const simpleIndicators = ['yes', 'no', 'hello', 'hi', 'help'];
    const isSimple = simpleIndicators.some(indicator => 
      prompt.toLowerCase().trim().startsWith(indicator)
    );
    
    if (isSimple || (wordCount < 20 && promptLength < 200)) {
      return 'simple';
    }
    
    if (hasComplexIndicators || wordCount > 200 || promptLength > 2000) {
      return 'complex';
    }
    
    // Task type complexity
    const complexTaskTypes: TaskType[] = ['project-preview', 'code-generation', 'structured-output'];
    if (complexTaskTypes.includes(taskType)) {
      return 'complex';
    }
    
    return 'moderate';
  }

  private determineDomain(agentRole: string, taskType: TaskType): TaskDomain {
    const roleLower = agentRole.toLowerCase();
    
    if (roleLower.includes('implementation') || roleLower.includes('code')) {
      return 'code';
    }
    if (roleLower.includes('design') || roleLower.includes('ux')) {
      return 'design';
    }
    if (roleLower.includes('qa') || roleLower.includes('audit') || roleLower.includes('test')) {
      return 'analysis';
    }
    if (roleLower.includes('requirement') || roleLower.includes('documentation')) {
      return 'documentation';
    }
    if (roleLower.includes('orchestrator') || roleLower.includes('architect')) {
      return 'planning';
    }
    
    if (taskType === 'code-generation') return 'code';
    if (taskType === 'documentation') return 'documentation';
    if (taskType === 'analysis') return 'analysis';
    
    return 'conversation';
  }

  private determineOutputType(taskType: TaskType, prompt: string): OutputType {
    const lowerPrompt = prompt.toLowerCase();
    
    // Check for structured output requirements
    if (
      taskType === 'project-preview' || 
      taskType === 'structured-output' ||
      lowerPrompt.includes('schema') || 
      lowerPrompt.includes('json') ||
      lowerPrompt.includes('respond with valid json') ||
      lowerPrompt.includes('json format') ||
      lowerPrompt.includes('structured output') ||
      (taskType === 'analysis' && (lowerPrompt.includes('decision') || lowerPrompt.includes('assessment') || lowerPrompt.includes('evaluate')))
    ) {
      return 'structured';
    }
    if (taskType === 'code-generation' || lowerPrompt.includes('code') || lowerPrompt.includes('function')) {
      return 'code';
    }
    if (lowerPrompt.includes('diagram') || lowerPrompt.includes('mermaid')) {
      return 'diagram';
    }
    
    return 'text';
  }

  private estimateTokenCount(text: string): number {
    // Rough estimation: ~4 characters per token, or ~0.75 words per token
    const charCount = text.length;
    const wordCount = text.split(/\s+/).length;
    
    // Use average of both methods
    const charEstimate = Math.ceil(charCount / 4);
    const wordEstimate = Math.ceil(wordCount / 0.75);
    
    return Math.ceil((charEstimate + wordEstimate) / 2);
  }

  private determineLatencyRequirement(taskType: TaskType, prompt?: string): LatencyRequirement {
    const lowerPrompt = (prompt || '').toLowerCase();
    
    // Detect real-time language in prompt
    const realtimeKeywords = ['real-time', 'realtime', 'instant', 'immediate', 'asap', 'urgent', 'live', 'streaming'];
    if (realtimeKeywords.some(keyword => lowerPrompt.includes(keyword))) {
      return 'real-time';
    }
    
    // Detect fast language in prompt
    const fastKeywords = ['fast', 'quick', 'quickly', 'speed', 'rapid', 'low latency', 'responsive'];
    if (fastKeywords.some(keyword => lowerPrompt.includes(keyword))) {
      return 'fast';
    }
    
    const fastTaskTypes: TaskType[] = ['chat', 'conversation', 'prompt-enhancement', 'analysis'];
    if (fastTaskTypes.includes(taskType)) {
      return 'fast';
    }
    
    const realtimeTaskTypes: TaskType[] = [];
    if (realtimeTaskTypes.includes(taskType)) {
      return 'real-time';
    }
    
    return 'normal';
  }

  private determineCostSensitivity(context?: TaskContext, prompt?: string): 'high' | 'medium' | 'low' {
    const lowerPrompt = (prompt || '').toLowerCase();
    
    // Detect cost-sensitive language in prompt
    const costSensitiveKeywords = ['budget', 'cost-effective', 'cheap', 'affordable', 'low cost', 'economical', 'minimize cost'];
    const costInsensitiveKeywords = ['premium', 'best quality', 'highest quality', 'no budget limit', 'cost is not a concern'];
    
    if (costSensitiveKeywords.some(keyword => lowerPrompt.includes(keyword))) {
      return 'high';
    }
    if (costInsensitiveKeywords.some(keyword => lowerPrompt.includes(keyword))) {
      return 'low';
    }
    
    if (!context) return 'medium';
    
    // High sensitivity if budget is low or mostly used
    if (context.projectBudget && context.budgetUsed) {
      const budgetUsage = context.budgetUsed / context.projectBudget;
      if (budgetUsage > 0.8) return 'high';
      if (context.projectBudget < 100) return 'high';
    }
    
    // Low sensitivity for enterprise packages
    if (context.userPackage === 'Enterprise') {
      return 'low';
    }
    
    return 'medium';
  }

  private identifyRequiredCapabilities(
    taskType: TaskType, 
    outputType: OutputType,
    tools?: any[],
    prompt?: string
  ): string[] {
    const capabilities: string[] = [];
    const lowerPrompt = (prompt || '').toLowerCase();
    
    // CRITICAL: If tools are provided, function calling is required
    if (tools && Array.isArray(tools) && tools.length > 0) {
      // Check if tools actually require function calling
      const hasValidTools = tools.some((tool: any) => {
        if (!tool || typeof tool !== 'object') return false;
        return tool.googleSearch !== undefined || 
               (Array.isArray(tool.functionDeclarations) && tool.functionDeclarations.length > 0);
      });
      
      if (hasValidTools) {
        capabilities.push('functionCalling');
      }
    }
    
    if (outputType === 'structured') {
      capabilities.push('structuredOutput');
    }
    
    if (taskType === 'code-generation') {
      capabilities.push('codeGeneration');
    }
    
    // Detect long-context requirements from prompt
    const longContextKeywords = ['long context', 'large document', 'entire file', 'full codebase', 'comprehensive', 'extensive'];
    if (taskType === 'documentation' || taskType === 'long-context' || 
        longContextKeywords.some(keyword => lowerPrompt.includes(keyword))) {
      capabilities.push('longContext');
    }
    
    // Detect reasoning-intensive work
    const reasoningKeywords = ['reasoning', 'analyze', 'evaluate', 'think through', 'step by step', 'chain of thought', 'logical'];
    if (reasoningKeywords.some(keyword => lowerPrompt.includes(keyword))) {
      capabilities.push('reasoning'); // Note: This may need to map to a model capability
    }
    
    if (taskType === 'chat' || taskType === 'conversation') {
      capabilities.push('fastResponse');
    }
    
    return capabilities;
  }

  private determinePriority(complexity: TaskComplexity, context?: TaskContext): number {
    // Higher priority for complex tasks
    let priority = complexity === 'complex' ? 3 : complexity === 'moderate' ? 2 : 1;
    
    // Higher priority for critical roles
    if (context?.agentRole?.includes('Orchestrator')) {
      priority += 1;
    }
    
    return Math.min(priority, 5);
  }
}

/**
 * Routing Signals - Normalized values for routing decisions
 */
export interface RoutingSignals {
  costPressure: number; // 0-1, higher = more cost-sensitive
  qualityNeed: number; // 0-1, higher = need for high-quality output
  latencyTarget: number; // milliseconds, target latency
  budgetRemaining?: number; // remaining budget
  budgetUsageRatio?: number; // 0-1, how much budget is used
  agentRolePriority?: number; // priority boost for agent role
}

/**
 * Build routing signals from task analysis and routing context
 */
export function buildRoutingSignals(
  task: TaskAnalysis,
  routingContext?: {
    userId?: string;
    projectId?: string;
    packageLimits?: {
      maxMonthlyBudget?: number;
      maxAPICalls?: number;
      maxTokensPerMonth?: number;
    };
    userPreferences?: {
      preferredModels?: string[];
      costPreference?: 'low' | 'balanced' | 'quality';
    };
    projectState?: {
      currentPhase: string;
      budgetUsed: number;
      tokensUsed: number;
    };
  }
): RoutingSignals {
  // Calculate cost pressure (0-1)
  let costPressure = 0.5; // default medium
  
  if (task.costSensitivity === 'high') {
    costPressure = 0.9;
  } else if (task.costSensitivity === 'low') {
    costPressure = 0.1;
  }
  
  // Adjust based on budget remaining
  if (routingContext?.packageLimits?.maxMonthlyBudget && routingContext?.projectState?.budgetUsed !== undefined) {
    // const _budgetRemaining = routingContext.packageLimits.maxMonthlyBudget - routingContext.projectState.budgetUsed;
    const budgetUsageRatio = routingContext.projectState.budgetUsed / routingContext.packageLimits.maxMonthlyBudget;
    
    // Increase cost pressure if budget is low
    if (budgetUsageRatio > 0.8) {
      costPressure = Math.max(costPressure, 0.9);
    } else if (budgetUsageRatio > 0.5) {
      costPressure = Math.max(costPressure, 0.7);
    }
    
    // Adjust based on user preference
    if (routingContext.userPreferences?.costPreference === 'low') {
      costPressure = Math.max(costPressure, 0.8);
    } else if (routingContext.userPreferences?.costPreference === 'quality') {
      costPressure = Math.min(costPressure, 0.3);
    }
  }
  
  // Calculate quality need (0-1)
  let qualityNeed = 0.5; // default medium
  
  if (task.complexity === 'complex') {
    qualityNeed = 0.9;
  } else if (task.complexity === 'moderate') {
    qualityNeed = 0.6;
  } else {
    qualityNeed = 0.3;
  }
  
  // Boost quality need for critical tasks
  if (task.priority >= 4) {
    qualityNeed = Math.min(qualityNeed + 0.2, 1.0);
  }
  
  // Boost quality for structured output or code generation
  if (task.outputType === 'structured' || task.taskType === 'code-generation') {
    qualityNeed = Math.min(qualityNeed + 0.1, 1.0);
  }
  
  // Calculate latency target (milliseconds)
  let latencyTarget = 2000; // default 2 seconds
  
  if (task.latencyRequirement === 'real-time') {
    latencyTarget = 500;
  } else if (task.latencyRequirement === 'fast') {
    latencyTarget = 1000;
  } else if (task.latencyRequirement === 'batch') {
    latencyTarget = 5000;
  }
  
  // Calculate budget metrics
  const budgetRemaining = routingContext?.packageLimits?.maxMonthlyBudget && routingContext?.projectState?.budgetUsed !== undefined
    ? routingContext.packageLimits.maxMonthlyBudget - routingContext.projectState.budgetUsed
    : undefined;
  
  const budgetUsageRatio = routingContext?.packageLimits?.maxMonthlyBudget && routingContext?.projectState?.budgetUsed !== undefined
    ? routingContext.projectState.budgetUsed / routingContext.packageLimits.maxMonthlyBudget
    : undefined;
  
  // Agent role priority boost
  let agentRolePriority = 1.0;
  if (task.agentRole?.includes('Orchestrator')) {
    agentRolePriority = 1.5;
  } else if (task.agentRole?.includes('Implementation') || task.agentRole?.includes('Architecture')) {
    agentRolePriority = 1.3;
  }
  
  return {
    costPressure,
    qualityNeed,
    latencyTarget,
    budgetRemaining,
    budgetUsageRatio,
    agentRolePriority
  };
}

export const taskAnalyzer = new TaskAnalyzer();

