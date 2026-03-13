/**
 * Internal AI Rule Configurator Component
 * Clone of AIRuleConfigurator adapted for Internal Router Settings
 * Hexagonal Architecture: High-level parameter configuration → AI interpretation → Rule generation
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Sparkles, Zap, Target, TrendingUp, TrendingDown, DollarSign,
  Clock, Shield, Brain, Settings, Play, RefreshCw,
  Info, AlertCircle, CheckCircle, ArrowRight, ArrowLeft, ArrowDown,
  Activity, BarChart3, Gauge, Layers, Eye, X, Edit2, Cpu
} from 'lucide-react';
import { showAlert } from '../utils/browserUtils';
import { getLLMModels, LLMModel } from '../services/adminApiExtended';
import {
  getInternalRouterConfig,
  updateInternalRouterConfig,
  InternalRoutingConfig,
  AvailableModel,
  TierConfig,
  TaskTypeOverride,
  ContextOverride,
  ModelTier,
  testRouting,
  RoutingDecision
} from '../services/adminInternalRouterApi';

// Internal Routing Rule structure (mirrors End User Router's RoutingRule)
interface InternalRoutingRule {
  _id?: string;
  name: string;
  priority: number;
  enabled: boolean;
  conditions: {
    taskTypes?: string[];
    agentRoles?: string[];
    complexity?: ('simple' | 'moderate' | 'complex')[];
    contexts?: string[];
    minTokens?: number;
    maxTokens?: number;
    projectPhases?: string[];
  };
  actions: {
    preferredTier: ModelTier;
    preferredProvider?: string;
    preferredModel?: string;
    blockedProviders?: string[];
    blockedModels?: string[];
    costPreference?: 'low' | 'balanced' | 'quality';
    maxLatency?: number;
    costLimit?: number;
  };
  description?: string;
}

interface InternalAIRuleConfiguratorProps {
  token?: string;
  onConfigChange?: (config: InternalRoutingConfig) => void;
}

interface ConfigurationParameters {
  // Performance Parameters
  speed: number;
  quality: number;
  cost: number;
  
  // Task-Specific Parameters
  codeGeneration: number;
  documentation: number;
  analysis: number;
  creative: number;
  
  // Agent Role Priorities
  orchestrator: number;
  implementation: number;
  requirements: number;
  
  // Advanced Parameters
  reliability: number;
  contextLength: number;
  reasoning: number;
}

const InternalAIRuleConfigurator: React.FC<InternalAIRuleConfiguratorProps> = ({ token, onConfigChange }) => {
  const [parameters, setParameters] = useState<ConfigurationParameters>({
    speed: 50,
    quality: 50,
    cost: 50,
    codeGeneration: 50,
    documentation: 50,
    analysis: 50,
    creative: 50,
    orchestrator: 50,
    implementation: 50,
    requirements: 50,
    reliability: 50,
    contextLength: 50,
    reasoning: 50
  });

  const [models, setModels] = useState<LLMModel[]>([]);
  const [generatedRules, setGeneratedRules] = useState<InternalRoutingRule[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeView, setActiveView] = useState<'config' | 'rules' | 'hexagon'>('config');
  const [aiInsights, setAiInsights] = useState<string[]>([]);
  const [scoringMode, setScoringMode] = useState<'high-performance' | 'low-cost' | 'balance' | 'custom'>('balance');
  const [isAIOptimizing, setIsAIOptimizing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isLoadingParams, setIsLoadingParams] = useState(true);
  const [viewingRule, setViewingRule] = useState<InternalRoutingRule | null>(null);
  const [editingRule, setEditingRule] = useState<InternalRoutingRule | null>(null);
  const [config, setConfig] = useState<InternalRoutingConfig | null>(null);

  useEffect(() => {
    if (token) {
      loadModels();
      loadSavedParameters();
    }
  }, [token]);

  const loadSavedParameters = async () => {
    if (!token) return;
    setIsLoadingParams(true);
    try {
      const data = await getInternalRouterConfig(token);
      setConfig(data.config);
      
      if ((data.config as any).metadata?.aiRuleConfigurator) {
        const savedParams = (data.config as any).metadata.aiRuleConfigurator.parameters as ConfigurationParameters;
        const savedScoringMode = (data.config as any).metadata.aiRuleConfigurator.scoringMode;
        const savedRules = (data.config as any).metadata.aiRuleConfigurator.generatedRules;
        
        if (savedParams) {
          setParameters(savedParams);
          // Always load scoring mode from database on initial load
          // But don't override if user has made a selection (state will be preserved)
          if (savedScoringMode) {
            console.log('[Load] Loading scoring mode from database:', savedScoringMode);
            setScoringMode(savedScoringMode);
          } else {
            const detectedMode = detectScoringMode(savedParams);
            console.log('[Load] No saved scoring mode, detecting from parameters:', detectedMode);
            setScoringMode(detectedMode);
          }
        }
        if (savedRules) {
          setGeneratedRules(savedRules);
        }
      }
    } catch (err: any) {
      console.warn('Failed to load saved parameters:', err);
    } finally {
      setIsLoadingParams(false);
    }
  };

  const loadModels = async () => {
    if (!token) return;
    try {
      const data = await getLLMModels(token);
      setModels(data.models.filter(m => m.status === 'active'));
    } catch (err: any) {
      console.warn('Failed to load models:', err);
    }
  };

  // Determine tier based on model characteristics
  const getModelTier = (model: LLMModel): ModelTier => {
    const totalCost = (model.pricing?.inputCostPer1MTokens || 0) + (model.pricing?.outputCostPer1MTokens || 0);
    if (totalCost < 1) return 'economy';
    if (totalCost < 10) return 'standard';
    return 'premium';
  };

  const generateRulesFromParameters = useCallback(async () => {
    setIsGenerating(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 800));

      const newRules: InternalRoutingRule[] = [];
      const insights: string[] = [];

      // Consider ALL models (enabled and disabled) for comprehensive rule generation
      const allModels = models.filter(m => m.status === 'active'); // Only exclude deprecated
      const enabledModels = models.filter(m => m.isEnabled && m.status === 'active');
      
      // Define all possible variable values for comprehensive rule generation
      const allTaskTypes = ['chat', 'conversation', 'simple-tasks', 'code-generation', 'analysis', 
                            'documentation', 'writing', 'long-context', 'structured-output', 
                            'creative', 'prompt-enhancement', 'project-preview'];
      const allAgentRoles = ['Orchestrator', 'Implementation Agent', 'Requirements Agent', 
                            'UX Designer', 'UI/UX Designer', 'Design Agent', 'QA Agent', 
                            'QA/Audit Agent', 'Audit Agent', 'Integration Agent', 'Test Agent',
                            'Remediation Agent', 'Remediation/Bug Agent', 'Bug Agent',
                            'Design/Architecture Agent', 'Design Agent', 'Architecture Agent',
                            'Test Requirements Engineer'];
      const allComplexityLevels: ('simple' | 'moderate' | 'complex')[] = ['simple', 'moderate', 'complex'];
      const allProjectPhases = ['Planning', 'Requirements', 'Implementation', 'Development', 'Testing', 'QA'];
      
      // Helper function to find best tier based on criteria
      const findBestTier = (
        criteria: {
          fastResponse?: boolean;
          codeGeneration?: boolean;
          longContext?: boolean;
          lowCost?: boolean;
          highQuality?: boolean;
        }
      ): ModelTier => {
        if (criteria.lowCost) return 'economy';
        if (criteria.highQuality || criteria.longContext) return 'premium';
        if (criteria.codeGeneration) return 'standard';
        if (criteria.fastResponse) return 'economy';
        return 'standard';
      };

      // Rule 1: Speed-focused tasks
      if (parameters.speed > 60) {
        const tier = parameters.cost > 60 ? 'economy' : 'standard';
        newRules.push({
          name: 'Fast Response Priority',
          priority: Math.round(parameters.speed / 10),
          enabled: true,
          conditions: {
            taskTypes: ['chat', 'conversation', 'simple-tasks'],
            complexity: ['simple']
          },
          actions: {
            preferredTier: tier,
            costPreference: 'low',
            maxLatency: Math.round(300 - (parameters.speed * 2))
          },
          description: `Optimized for fast responses (${parameters.speed}% speed priority)`
        });
        insights.push(`High speed priority (${parameters.speed}%) → Fast ${tier} tier models`);
      }

      // Rule 2: Quality-focused tasks
      if (parameters.quality > 60) {
        const tier = parameters.cost < 40 ? 'premium' : 'standard';
        newRules.push({
          name: 'High Quality Priority',
          priority: Math.round(parameters.quality / 10),
          enabled: true,
          conditions: {
            complexity: ['complex'],
            taskTypes: ['code-generation', 'analysis']
          },
          actions: {
            preferredTier: tier,
            costPreference: 'quality'
          },
          description: `Optimized for high quality (${parameters.quality}% quality priority)`
        });
        insights.push(`High quality priority (${parameters.quality}%) → ${tier} tier models`);
      }

      // Rule 3: Cost-sensitive tasks
      if (parameters.cost > 60) {
        newRules.push({
          name: 'Cost Optimization',
          priority: Math.round(parameters.cost / 10),
          enabled: true,
          conditions: {
            taskTypes: ['documentation', 'simple-tasks'],
            complexity: ['simple', 'moderate']
          },
          actions: {
            preferredTier: 'economy',
            costPreference: 'low'
          },
          description: `Optimized for cost efficiency (${parameters.cost}% cost sensitivity)`
        });
        insights.push(`High cost sensitivity (${parameters.cost}%) → Economy tier models`);
      }

      // Rule 4: Code generation priority
      if (parameters.codeGeneration > 60) {
        const tier = parameters.cost > 50 ? 'standard' : 'premium';
        newRules.push({
          name: 'Code Generation Optimization',
          priority: Math.round(parameters.codeGeneration / 10),
          enabled: true,
          conditions: {
            taskTypes: ['code-generation'],
            agentRoles: ['Implementation Agent']
          },
          actions: {
            preferredTier: tier,
            costPreference: parameters.cost > 50 ? 'balanced' : 'quality'
          },
          description: `Optimized for code generation (${parameters.codeGeneration}% priority)`
        });
        insights.push(`Code generation priority (${parameters.codeGeneration}%) → ${tier} tier`);
      }

      // Rule 5: Documentation priority
      if (parameters.documentation > 60) {
        const tier = parameters.cost > 50 ? 'economy' : 'standard';
        newRules.push({
          name: 'Documentation Optimization',
          priority: Math.round(parameters.documentation / 10),
          enabled: true,
          conditions: {
            taskTypes: ['documentation', 'writing']
          },
          actions: {
            preferredTier: tier,
            costPreference: parameters.cost > 50 ? 'balanced' : 'quality'
          },
          description: `Optimized for documentation (${parameters.documentation}% priority)`
        });
        insights.push(`Documentation priority (${parameters.documentation}%) → ${tier} tier`);
      }

      // Rule 6: Orchestrator role
      if (parameters.orchestrator > 60) {
        newRules.push({
          name: 'Orchestrator Optimization',
          priority: Math.round(parameters.orchestrator / 10),
          enabled: true,
          conditions: {
            agentRoles: ['Orchestrator']
          },
          actions: {
            preferredTier: 'economy',
            costPreference: 'balanced'
          },
          description: `Optimized for orchestrator role (${parameters.orchestrator}% priority)`
        });
      }

      // Rule 7: Implementation agent
      if (parameters.implementation > 60) {
        const tier = parameters.cost > 50 ? 'standard' : 'premium';
        newRules.push({
          name: 'Implementation Agent Optimization',
          priority: Math.round(parameters.implementation / 10),
          enabled: true,
          conditions: {
            agentRoles: ['Implementation Agent']
          },
          actions: {
            preferredTier: tier,
            costPreference: parameters.cost > 50 ? 'balanced' : 'quality'
          },
          description: `Optimized for implementation agent (${parameters.implementation}% priority)`
        });
      }

      // Rule 8: Long context needs
      if (parameters.contextLength > 60) {
        newRules.push({
          name: 'Long Context Priority',
          priority: Math.round(parameters.contextLength / 10),
          enabled: true,
          conditions: {
            taskTypes: ['long-context', 'analysis'],
            complexity: ['complex']
          },
          actions: {
            preferredTier: 'premium',
            costPreference: 'quality'
          },
          description: `Optimized for long context (${parameters.contextLength}% priority)`
        });
        insights.push(`Long context priority (${parameters.contextLength}%) → Premium tier`);
      }

      // Rule 9: Complex reasoning
      if (parameters.reasoning > 60) {
        newRules.push({
          name: 'Complex Reasoning Priority',
          priority: Math.round(parameters.reasoning / 10),
          enabled: true,
          conditions: {
            complexity: ['complex'],
            taskTypes: ['analysis', 'code-generation']
          },
          actions: {
            preferredTier: 'premium',
            costPreference: 'quality'
          },
          description: `Optimized for complex reasoning (${parameters.reasoning}% priority)`
        });
        insights.push(`Complex reasoning priority (${parameters.reasoning}%) → Premium tier`);
      }

      // Rule 10: Analysis tasks
      if (parameters.analysis > 50) {
        const tier = parameters.cost > 60 ? 'standard' : 'premium';
        newRules.push({
          name: 'Analysis Task Optimization',
          priority: Math.round(parameters.analysis / 12),
          enabled: true,
          conditions: {
            taskTypes: ['analysis', 'structured-output'],
            complexity: ['moderate', 'complex']
          },
          actions: {
            preferredTier: tier,
            costPreference: parameters.cost > 60 ? 'balanced' : 'quality'
          },
          description: `Optimized for analysis tasks (${parameters.analysis}% priority)`
        });
      }

      // Rule 11: Creative tasks
      if (parameters.creative > 50) {
        const tier = parameters.cost > 60 ? 'standard' : 'premium';
        newRules.push({
          name: 'Creative Task Optimization',
          priority: Math.round(parameters.creative / 12),
          enabled: true,
          conditions: {
            taskTypes: ['creative', 'writing'],
            complexity: ['moderate', 'complex']
          },
          actions: {
            preferredTier: tier,
            costPreference: parameters.cost > 60 ? 'balanced' : 'quality'
          },
          description: `Optimized for creative tasks (${parameters.creative}% priority)`
        });
      }

      // Rule 12: Requirements Agent
      if (parameters.requirements > 50) {
        const tier = parameters.cost > 60 ? 'standard' : 'premium';
        newRules.push({
          name: 'Requirements Agent Optimization',
          priority: Math.round(parameters.requirements / 12),
          enabled: true,
          conditions: {
            agentRoles: ['Requirements Agent']
          },
          actions: {
            preferredTier: tier,
            costPreference: parameters.cost > 60 ? 'balanced' : 'quality'
          },
          description: `Optimized for requirements agent (${parameters.requirements}% priority)`
        });
      }

      // Rule 13: UX Designer Agent
      if (parameters.creative > 50 || parameters.quality > 50) {
        const tier = parameters.cost > 60 ? 'standard' : 'premium';
        newRules.push({
          name: 'UX Designer Optimization',
          priority: Math.round(Math.max(parameters.creative, parameters.quality) / 12),
          enabled: true,
          conditions: {
            agentRoles: ['UX Designer', 'UI/UX Designer', 'Design Agent']
          },
          actions: {
            preferredTier: tier,
            costPreference: parameters.cost > 60 ? 'balanced' : 'quality'
          },
          description: `Optimized for UX/Design tasks`
        });
      }

      // Rule 14: QA/Audit Agent
      if (parameters.analysis > 50 || parameters.reliability > 50) {
        const tier = parameters.cost > 60 ? 'standard' : 'premium';
        newRules.push({
          name: 'QA/Audit Agent Optimization',
          priority: Math.round(Math.max(parameters.analysis, parameters.reliability) / 12),
          enabled: true,
          conditions: {
            agentRoles: ['QA Agent', 'QA/Audit Agent', 'Audit Agent']
          },
          actions: {
            preferredTier: tier,
            costPreference: parameters.cost > 60 ? 'balanced' : 'quality'
          },
          description: `Optimized for QA/Audit tasks`
        });
      }

      // Rule 15: Integration Agent
      if (parameters.implementation > 50 || parameters.codeGeneration > 50) {
        const tier = parameters.cost > 60 ? 'standard' : 'premium';
        newRules.push({
          name: 'Integration Agent Optimization',
          priority: Math.round(Math.max(parameters.implementation, parameters.codeGeneration) / 12),
          enabled: true,
          conditions: {
            agentRoles: ['Integration Agent']
          },
          actions: {
            preferredTier: tier,
            costPreference: parameters.cost > 60 ? 'balanced' : 'quality'
          },
          description: `Optimized for integration tasks`
        });
      }

      // Rule 16: Test Agent
      if (parameters.analysis > 50 || parameters.reliability > 50) {
        const tier = parameters.cost > 60 ? 'standard' : 'premium';
        newRules.push({
          name: 'Test Agent Optimization',
          priority: Math.round(Math.max(parameters.analysis, parameters.reliability) / 12),
          enabled: true,
          conditions: {
            agentRoles: ['Test Agent']
          },
          actions: {
            preferredTier: tier,
            costPreference: parameters.cost > 60 ? 'balanced' : 'quality'
          },
          description: `Optimized for test execution`
        });
      }

      // Rule 17: Remediation/Bug Agent
      if (parameters.codeGeneration > 50 || parameters.analysis > 50) {
        const tier = parameters.cost > 60 ? 'standard' : 'premium';
        newRules.push({
          name: 'Remediation/Bug Agent Optimization',
          priority: Math.round(Math.max(parameters.codeGeneration, parameters.analysis) / 12),
          enabled: true,
          conditions: {
            agentRoles: ['Remediation Agent', 'Remediation/Bug Agent', 'Bug Agent']
          },
          actions: {
            preferredTier: tier,
            costPreference: parameters.cost > 60 ? 'balanced' : 'quality'
          },
          description: `Optimized for bug fixing and remediation`
        });
      }

      // Rule 18: Design/Architecture Agent
      if (parameters.quality > 50 || parameters.reasoning > 50) {
        newRules.push({
          name: 'Design/Architecture Agent Optimization',
          priority: Math.round(Math.max(parameters.quality, parameters.reasoning) / 12),
          enabled: true,
          conditions: {
            agentRoles: ['Design/Architecture Agent', 'Design Agent', 'Architecture Agent']
          },
          actions: {
            preferredTier: 'premium',
            costPreference: parameters.cost > 60 ? 'balanced' : 'quality'
          },
          description: `Optimized for design and architecture`
        });
      }

      // Rule 19: Test Requirements Engineer
      if (parameters.requirements > 50 || parameters.analysis > 50) {
        const tier = parameters.cost > 60 ? 'standard' : 'premium';
        newRules.push({
          name: 'Test Requirements Engineer Optimization',
          priority: Math.round(Math.max(parameters.requirements, parameters.analysis) / 12),
          enabled: true,
          conditions: {
            agentRoles: ['Test Requirements Engineer']
          },
          actions: {
            preferredTier: tier,
            costPreference: parameters.cost > 60 ? 'balanced' : 'quality'
          },
          description: `Optimized for test requirements`
        });
      }

      // Rule 20: Moderate complexity tasks
      if (parameters.speed > 40 && parameters.cost > 40) {
        newRules.push({
          name: 'Moderate Complexity Optimization',
          priority: 5,
          enabled: true,
          conditions: {
            complexity: ['moderate'],
            taskTypes: ['chat', 'conversation', 'simple-tasks']
          },
          actions: {
            preferredTier: 'standard',
            costPreference: 'balanced'
          },
          description: `Balanced optimization for moderate complexity tasks`
        });
      }

      // Rule 21: Structured output tasks
      if (parameters.analysis > 40 || parameters.codeGeneration > 40) {
        const tier = parameters.cost > 60 ? 'standard' : 'premium';
        newRules.push({
          name: 'Structured Output Optimization',
          priority: 6,
          enabled: true,
          conditions: {
            taskTypes: ['structured-output', 'analysis']
          },
          actions: {
            preferredTier: tier,
            costPreference: parameters.cost > 60 ? 'balanced' : 'quality'
          },
          description: `Optimized for structured output tasks`
        });
      }

      // Rule 22: Prompt enhancement tasks
      if (parameters.speed > 50 || parameters.quality > 50) {
        const tier = parameters.cost > 60 ? 'economy' : 'standard';
        newRules.push({
          name: 'Prompt Enhancement Optimization',
          priority: Math.round(Math.max(parameters.speed, parameters.quality) / 12),
          enabled: true,
          conditions: {
            taskTypes: ['prompt-enhancement']
          },
          actions: {
            preferredTier: tier,
            costPreference: parameters.cost > 60 ? 'balanced' : 'quality'
          },
          description: `Optimized for prompt enhancement`
        });
      }

      // Rule 23: Project preview tasks
      if (parameters.contextLength > 50 || parameters.quality > 50) {
        newRules.push({
          name: 'Project Preview Optimization',
          priority: Math.round(Math.max(parameters.contextLength, parameters.quality) / 12),
          enabled: true,
          conditions: {
            taskTypes: ['project-preview']
          },
          actions: {
            preferredTier: 'premium',
            costPreference: parameters.cost > 60 ? 'balanced' : 'quality'
          },
          description: `Optimized for project preview generation`
        });
      }

      // Rule 24: Large token requests
      if (parameters.contextLength > 50) {
        newRules.push({
          name: 'Large Token Request Optimization',
          priority: Math.round(parameters.contextLength / 10),
          enabled: true,
          conditions: {
            minTokens: 50000
          },
          actions: {
            preferredTier: 'premium',
            costPreference: parameters.cost > 60 ? 'balanced' : 'quality',
            costLimit: parameters.cost > 70 ? 0.01 : undefined
          },
          description: `Optimized for large token requests (${parameters.contextLength}% context priority)`
        });
      }

      // Rule 25: Small token requests
      if (parameters.speed > 50 || parameters.cost > 50) {
        newRules.push({
          name: 'Small Token Request Optimization',
          priority: Math.round(Math.max(parameters.speed, parameters.cost) / 12),
          enabled: true,
          conditions: {
            maxTokens: 2000
          },
          actions: {
            preferredTier: 'economy',
            costPreference: 'low',
            maxLatency: 500
          },
          description: `Optimized for small token requests`
        });
      }

      // Rule 26: High reliability requirement
      if (parameters.reliability > 70) {
        newRules.push({
          name: 'High Reliability Priority',
          priority: Math.round(parameters.reliability / 10),
          enabled: true,
          conditions: {
            complexity: ['complex'],
            taskTypes: ['code-generation', 'analysis']
          },
          actions: {
            preferredTier: 'premium',
            costPreference: 'quality'
          },
          description: `Optimized for high reliability (${parameters.reliability}% priority)`
        });
      }

      // Rule 27: Planning phase
      if (parameters.speed > 40 || parameters.cost > 40) {
        newRules.push({
          name: 'Planning Phase Optimization',
          priority: 4,
          enabled: true,
          conditions: {
            projectPhases: ['Planning', 'Requirements']
          },
          actions: {
            preferredTier: 'economy',
            costPreference: 'balanced'
          },
          description: `Optimized for planning phase tasks`
        });
      }

      // Rule 28: Implementation phase
      if (parameters.quality > 50 || parameters.codeGeneration > 50) {
        const tier = parameters.cost > 60 ? 'standard' : 'premium';
        newRules.push({
          name: 'Implementation Phase Optimization',
          priority: 5,
          enabled: true,
          conditions: {
            projectPhases: ['Implementation', 'Development']
          },
          actions: {
            preferredTier: tier,
            costPreference: parameters.cost > 60 ? 'balanced' : 'quality'
          },
          description: `Optimized for implementation phase tasks`
        });
      }

      // Rule 29: Testing phase
      if (parameters.reliability > 50 || parameters.analysis > 50) {
        const tier = parameters.cost > 60 ? 'standard' : 'premium';
        newRules.push({
          name: 'Testing Phase Optimization',
          priority: 5,
          enabled: true,
          conditions: {
            projectPhases: ['Testing', 'QA']
          },
          actions: {
            preferredTier: tier,
            costPreference: parameters.cost > 60 ? 'balanced' : 'quality'
          },
          description: `Optimized for testing phase tasks`
        });
      }

      // COMPREHENSIVE RULE GENERATION: Create rules for ALL variable combinations
      // This ensures complete coverage regardless of parameter values
      
      // Generate rules for each taskType × complexity combination
      for (const taskType of allTaskTypes) {
        for (const complexity of allComplexityLevels) {
          let preferredTier: ModelTier = 'standard';
          let costPreference: 'low' | 'balanced' | 'quality' = 'balanced';
          
          // Determine tier and cost preference based on task type and complexity
          if (taskType === 'code-generation') {
            preferredTier = complexity === 'complex' ? 'premium' : 'standard';
            costPreference = complexity === 'complex' ? 'quality' : 'balanced';
          } else if (taskType === 'long-context' || taskType === 'project-preview') {
            preferredTier = 'premium';
            costPreference = 'quality';
          } else if (taskType === 'chat' || taskType === 'conversation' || taskType === 'simple-tasks') {
            preferredTier = 'economy';
            costPreference = 'low';
          } else if (taskType === 'analysis' || taskType === 'structured-output') {
            preferredTier = complexity === 'complex' ? 'premium' : 'standard';
            costPreference = complexity === 'complex' ? 'quality' : 'balanced';
          } else if (taskType === 'documentation' || taskType === 'writing' || taskType === 'creative') {
            preferredTier = complexity === 'complex' ? 'premium' : 'standard';
            costPreference = 'balanced';
          } else {
            preferredTier = 'standard';
            costPreference = 'balanced';
          }
          
          if (complexity === 'complex' && preferredTier === 'economy') {
            preferredTier = 'standard';
          }
          
          const priority = complexity === 'complex' ? 8 : complexity === 'moderate' ? 6 : 4;
          
          newRules.push({
            name: `${taskType} - ${complexity} Priority`,
            priority: priority,
            enabled: true,
            conditions: {
              taskTypes: [taskType],
              complexity: [complexity]
            },
            actions: {
              preferredTier: preferredTier,
              costPreference: costPreference
            },
            description: `Optimized for ${taskType} tasks with ${complexity} complexity`
          });
        }
      }
      
      // Generate rules for each agentRole
      for (const agentRole of allAgentRoles) {
        let preferredTier: ModelTier = 'standard';
        let costPreference: 'low' | 'balanced' | 'quality' = 'balanced';
        
        // Determine tier based on agent role
        if (agentRole === 'Orchestrator') {
          preferredTier = 'economy';
          costPreference = 'balanced';
        } else if (agentRole.includes('Implementation') || agentRole.includes('Code')) {
          preferredTier = 'standard';
          costPreference = 'balanced';
        } else if (agentRole.includes('Requirements') || agentRole.includes('Test Requirements')) {
          preferredTier = 'premium';
          costPreference = 'balanced';
        } else if (agentRole.includes('UX') || agentRole.includes('Design')) {
          preferredTier = 'premium';
          costPreference = 'quality';
        } else if (agentRole.includes('QA') || agentRole.includes('Audit') || agentRole.includes('Test')) {
          preferredTier = 'premium';
          costPreference = 'quality';
        } else if (agentRole.includes('Remediation') || agentRole.includes('Bug')) {
          preferredTier = 'standard';
          costPreference = 'balanced';
        } else {
          preferredTier = 'standard';
          costPreference = 'balanced';
        }
        
        const priority = 7;
        
        newRules.push({
          name: `${agentRole} Optimization`,
          priority: priority,
          enabled: true,
          conditions: {
            agentRoles: [agentRole]
          },
          actions: {
            preferredTier: preferredTier,
            costPreference: costPreference
          },
          description: `Optimized for ${agentRole}`
        });
      }
      
      // Generate rules for each projectPhase
      for (const phase of allProjectPhases) {
        let preferredTier: ModelTier = 'standard';
        let costPreference: 'low' | 'balanced' | 'quality' = 'balanced';
        
        if (phase === 'Planning' || phase === 'Requirements') {
          preferredTier = 'economy';
          costPreference = 'balanced';
        } else if (phase === 'Implementation' || phase === 'Development') {
          preferredTier = 'standard';
          costPreference = 'balanced';
        } else if (phase === 'Testing' || phase === 'QA') {
          preferredTier = 'premium';
          costPreference = 'quality';
        } else {
          preferredTier = 'standard';
          costPreference = 'balanced';
        }
        
        const priority = 5;
        
        newRules.push({
          name: `${phase} Phase Optimization`,
          priority: priority,
          enabled: true,
          conditions: {
            projectPhases: [phase]
          },
          actions: {
            preferredTier: preferredTier,
            costPreference: costPreference
          },
          description: `Optimized for ${phase} phase`
        });
      }
      
      // Generate rules for token ranges
      const tokenRanges = [
        { maxTokens: 2000, name: 'Small', tier: 'economy' as ModelTier, costPreference: 'low' as const },
        { minTokens: 50000, name: 'Large', tier: 'premium' as ModelTier, costPreference: 'quality' as const }
      ];
      
      for (const range of tokenRanges) {
        const priority = 6;
        
        newRules.push({
          name: `${range.name} Token Request Optimization`,
          priority: priority,
          enabled: true,
          conditions: range.maxTokens ? { maxTokens: range.maxTokens } : { minTokens: range.minTokens },
          actions: {
            preferredTier: range.tier,
            costPreference: range.costPreference
          },
          description: `Optimized for ${range.name.toLowerCase()} token requests`
        });
      }
      
      // Rule 30: Default fallback rule
      if (newRules.length > 0) {
        newRules.push({
          name: 'Default Fallback Rule',
          priority: 0.5,
          enabled: true,
          conditions: {},
          actions: {
            preferredTier: parameters.cost > 70 ? 'economy' : parameters.cost < 30 ? 'premium' : 'standard',
            costPreference: 'balanced'
          },
          description: `Default fallback for unmatched scenarios`
        });
      }
      
      insights.push(`Generated ${newRules.length} comprehensive rules covering all task types (${allTaskTypes.length}), agent roles (${allAgentRoles.length}), complexity levels (${allComplexityLevels.length}), project phases (${allProjectPhases.length}), and token ranges, considering all models (active and disabled)`);

      setGeneratedRules(newRules);
      setAiInsights(insights);
    } catch (err: any) {
      showAlert('Failed to generate rules: ' + err.message, 'error');
    } finally {
      setIsGenerating(false);
    }
  }, [parameters, models]);

  // Convert InternalRoutingRule[] to TaskTypeOverride[] and ContextOverride[]
  const convertRulesToOverrides = (rules: InternalRoutingRule[]): {
    taskTypeOverrides: TaskTypeOverride[];
    contextOverrides: ContextOverride[];
  } => {
    const taskTypeOverrides: TaskTypeOverride[] = [];
    const contextOverrides: ContextOverride[] = [];
    const seenTaskTypes = new Set<string>();
    const seenContexts = new Set<string>();

    for (const rule of rules) {
      // Extract task type overrides from rules with taskTypes conditions
      if (rule.conditions.taskTypes && rule.conditions.taskTypes.length > 0) {
        for (const taskType of rule.conditions.taskTypes) {
          if (!seenTaskTypes.has(taskType)) {
            seenTaskTypes.add(taskType);
            
            // Get preferred models from the tier
            const preferredModels = models
              .filter(m => {
                const tier = getModelTier(m);
                return tier === rule.actions.preferredTier && m.isEnabled && m.status === 'active';
              })
              .slice(0, 3)
              .map(m => m.id);

            // Determine required capabilities based on task type
            const requiredCapabilities: string[] = [];
            if (taskType.includes('code') || taskType === 'code-generation') {
              requiredCapabilities.push('codeGeneration');
            }
            if (taskType.includes('analysis') || taskType === 'structured-output') {
              requiredCapabilities.push('structuredOutput');
            }
            if (taskType.includes('long-context') || taskType === 'project-preview') {
              requiredCapabilities.push('longContext');
            }

            taskTypeOverrides.push({
              taskType,
              preferredTier: rule.actions.preferredTier,
              preferredModels: preferredModels.length > 0 ? preferredModels : undefined,
              requiredCapabilities: requiredCapabilities.length > 0 ? requiredCapabilities : undefined
            });
          }
        }
      }

      // Extract context overrides from rules with agentRoles or projectPhases
      if (rule.conditions.agentRoles && rule.conditions.agentRoles.length > 0) {
        for (const agentRole of rule.conditions.agentRoles) {
          const contextKey = `agent:${agentRole}`;
          if (!seenContexts.has(contextKey)) {
            seenContexts.add(contextKey);
            
            const preferredModels = models
              .filter(m => {
                const tier = getModelTier(m);
                return tier === rule.actions.preferredTier && m.isEnabled && m.status === 'active';
              })
              .slice(0, 3)
              .map(m => m.id);

            contextOverrides.push({
              context: agentRole,
              preferredTier: rule.actions.preferredTier,
              preferredModels: preferredModels.length > 0 ? preferredModels : undefined
            });
          }
        }
      }

      if (rule.conditions.projectPhases && rule.conditions.projectPhases.length > 0) {
        for (const phase of rule.conditions.projectPhases) {
          const contextKey = `phase:${phase}`;
          if (!seenContexts.has(contextKey)) {
            seenContexts.add(contextKey);
            
            const preferredModels = models
              .filter(m => {
                const tier = getModelTier(m);
                return tier === rule.actions.preferredTier && m.isEnabled && m.status === 'active';
              })
              .slice(0, 3)
              .map(m => m.id);

            contextOverrides.push({
              context: `phase:${phase}`,
              preferredTier: rule.actions.preferredTier,
              preferredModels: preferredModels.length > 0 ? preferredModels : undefined
            });
          }
        }
      }

      // Extract complexity-based context overrides
      if (rule.conditions.complexity && rule.conditions.complexity.length > 0) {
        for (const complexity of rule.conditions.complexity) {
          const contextKey = `complexity:${complexity}`;
          if (!seenContexts.has(contextKey)) {
            seenContexts.add(contextKey);
            
            const preferredModels = models
              .filter(m => {
                const tier = getModelTier(m);
                return tier === rule.actions.preferredTier && m.isEnabled && m.status === 'active';
              })
              .slice(0, 3)
              .map(m => m.id);

            contextOverrides.push({
              context: `complexity:${complexity}`,
              preferredTier: rule.actions.preferredTier,
              preferredModels: preferredModels.length > 0 ? preferredModels : undefined
            });
          }
        }
      }
    }

    return { taskTypeOverrides, contextOverrides };
  };

  const handleParameterChange = async (key: keyof ConfigurationParameters, value: number) => {
    const newParams = { ...parameters, [key]: value };
    setParameters(newParams);
    const detectedMode = detectScoringMode(newParams);
    setScoringMode(detectedMode);
    
    // Auto-save to database and notify parent
    if (token && !isLoadingParams) {
      try {
        // Get current config to preserve all settings
        const currentConfigData = await getInternalRouterConfig(token);
        const currentConfig = currentConfigData.config;
        
        // Build updated config with new parameters
        const updatedConfig: Partial<InternalRoutingConfig> = {
          ...currentConfig,
          metadata: {
            ...(currentConfig as any).metadata,
            aiRuleConfigurator: {
              ...((currentConfig as any).metadata?.aiRuleConfigurator || {}),
              parameters: newParams,
              scoringMode: detectedMode,
              lastUpdated: new Date().toISOString()
            }
          }
        } as any;
        
        // Save to database
        await updateInternalRouterConfig(updatedConfig, token);
        
        // Update local config state
        const newConfig: InternalRoutingConfig = {
          ...currentConfig,
          ...updatedConfig
        } as InternalRoutingConfig;
        setConfig(newConfig);
        
        // Notify parent component
        if (onConfigChange) {
          onConfigChange(newConfig);
        }
        
        setLastSaved(new Date());
      } catch (err) {
        console.warn('Failed to auto-save parameters:', err);
      }
    }
  };

  const detectScoringMode = (params: ConfigurationParameters): 'high-performance' | 'low-cost' | 'balance' | 'custom' => {
    const speedQualityAvg = (params.speed + params.quality) / 2;
    const costValue = params.cost;
    
    const matchesHighPerf = speedQualityAvg > 70 && costValue < 40 && 
                            params.speed > 75 && params.quality > 80;
    const matchesLowCost = costValue > 70 && speedQualityAvg < 50 && 
                           params.cost > 75 && params.speed < 65 && params.quality < 60;
    const matchesBalance = Math.abs(params.speed - 60) < 15 && 
                          Math.abs(params.quality - 65) < 15 && 
                          Math.abs(params.cost - 55) < 15;
    
    if (matchesHighPerf) return 'high-performance';
    if (matchesLowCost) return 'low-cost';
    if (matchesBalance) return 'balance';
    return 'custom';
  };


  const applyScoringMode = async (mode: 'high-performance' | 'low-cost' | 'balance' | 'custom') => {
    setScoringMode(mode);
    
    if (mode === 'custom') {
      // Save scoring mode change even for custom mode
      if (token && !isLoadingParams) {
        try {
          // Get current config to preserve all settings
          const currentConfigData = await getInternalRouterConfig(token);
          const currentConfig = currentConfigData.config;
          
          // Build updated config with new scoring mode
          const updatedConfig: Partial<InternalRoutingConfig> = {
            ...currentConfig,
            metadata: {
              ...(currentConfig as any).metadata,
              aiRuleConfigurator: {
                ...((currentConfig as any).metadata?.aiRuleConfigurator || {}),
                parameters: parameters,
                scoringMode: mode,
                lastUpdated: new Date().toISOString()
              }
            }
          } as any;
          
          // Save to database
          await updateInternalRouterConfig(updatedConfig, token);
          
          // Update local config state
          const newConfig: InternalRoutingConfig = {
            ...currentConfig,
            ...updatedConfig
          } as InternalRoutingConfig;
          setConfig(newConfig);
          
          // Notify parent component
          if (onConfigChange) {
            onConfigChange(newConfig);
          }
          
          setLastSaved(new Date());
        } catch (err) {
          console.warn('Failed to auto-save scoring mode:', err);
        }
      }
      return;
    }
    
    let newParams: ConfigurationParameters;

    switch (mode) {
      case 'high-performance':
        newParams = {
          speed: 85,
          quality: 90,
          cost: 20,
          codeGeneration: 80,
          documentation: 70,
          analysis: 85,
          creative: 75,
          orchestrator: 70,
          implementation: 85,
          requirements: 75,
          reliability: 90,
          contextLength: 80,
          reasoning: 90
        };
        break;
      case 'low-cost':
        newParams = {
          speed: 60,
          quality: 50,
          cost: 90,
          codeGeneration: 50,
          documentation: 60,
          analysis: 50,
          creative: 50,
          orchestrator: 60,
          implementation: 50,
          requirements: 60,
          reliability: 70,
          contextLength: 50,
          reasoning: 50
        };
        break;
      case 'balance':
      default:
        newParams = {
          speed: 60,
          quality: 65,
          cost: 55,
          codeGeneration: 65,
          documentation: 60,
          analysis: 65,
          creative: 60,
          orchestrator: 60,
          implementation: 65,
          requirements: 60,
          reliability: 75,
          contextLength: 60,
          reasoning: 65
        };
        break;
    }
    setParameters(newParams);
    
    // Auto-save scoring mode and parameters to database and notify parent
    if (token && !isLoadingParams) {
      try {
        // Get current config to preserve all settings
        const currentConfigData = await getInternalRouterConfig(token);
        const currentConfig = currentConfigData.config;
        
        // Build updated config with new parameters
        const updatedConfig: Partial<InternalRoutingConfig> = {
          ...currentConfig,
          metadata: {
            ...(currentConfig as any).metadata,
            aiRuleConfigurator: {
              ...((currentConfig as any).metadata?.aiRuleConfigurator || {}),
              parameters: newParams,
              scoringMode: mode,
              lastUpdated: new Date().toISOString()
            }
          }
        } as any;
        
        // Save to database
        await updateInternalRouterConfig(updatedConfig, token);
        
        // Update local config state
        const newConfig: InternalRoutingConfig = {
          ...currentConfig,
          ...updatedConfig
        } as InternalRoutingConfig;
        setConfig(newConfig);
        
        // Notify parent component
        if (onConfigChange) {
          onConfigChange(newConfig);
        }
        
        setLastSaved(new Date());
      } catch (err) {
        console.warn('Failed to auto-save scoring mode:', err);
      }
    }
  };

  const handleAIOptimize = async () => {
    setIsAIOptimizing(true);
    setIsSaving(true);
    try {
      if (!token) {
        throw new Error('Authentication token required');
      }

      // CRITICAL: Use the current scoringMode from React state FIRST
      // This ensures we capture the user's latest selection even if database hasn't updated yet
      // React state updates are synchronous, so this will have the latest value
      const currentScoringMode = scoringMode;
      
      console.log('[AI Optimize] Using scoring mode from state:', currentScoringMode);
      
      // Get current config to preserve other settings (but we'll override scoringMode with state value)
      const currentConfigData = await getInternalRouterConfig(token);
      const currentConfig = currentConfigData.config;
      
      // Log what's in database vs state for debugging
      const dbScoringMode = (currentConfig as any).metadata?.aiRuleConfigurator?.scoringMode;
      if (dbScoringMode !== currentScoringMode) {
        console.warn('[AI Optimize] Scoring mode mismatch - State:', currentScoringMode, 'DB:', dbScoringMode, '- Using state value');
      }

      // Fetch latest model information with real-time pricing and status
      const latestData = await getLLMModels(token);
      let latestModels = latestData.models;
      
      // Fetch latest model data from online sources (pricing, capabilities, performance)
      try {
        const { fetchLatestModelData, applyModelDataUpdates } = await import('../services/modelDataFetcher');
        const onlineUpdates = await fetchLatestModelData();
        
        // Apply online updates to models
        latestModels = applyModelDataUpdates(latestModels, onlineUpdates);
        
        // Show update status in insights
        const updateCount = onlineUpdates.pricing.length + onlineUpdates.capabilities.length;
        if (updateCount > 0) {
          showAlert(`Fetched latest data for ${updateCount} models from online sources`, 'info');
        }
      } catch (err) {
        console.warn('Failed to fetch online model updates, using database data:', err);
        // Continue with database data if online fetch fails
      }
      
      const availableModels = latestModels.filter(m => 
        m.isEnabled && 
        m.status === 'active' && 
        m.apiKeyConfigured !== false
      );

      if (availableModels.length === 0) {
        throw new Error('No enabled models available. Please enable at least one model in LLM Manager.');
      }

      const modelAnalysis = analyzeModels(availableModels);
      
      // Always use current parameters as base to preserve manual changes
      // This ensures that any manual adjustments the user made are preserved and optimized
      const baseParams: ConfigurationParameters = parameters;
      
      // Blend current parameters with AI recommendations (70% current, 30% AI)
      // This preserves user's manual changes while incorporating AI insights
      const optimizedParams: ConfigurationParameters = {
        speed: Math.round(baseParams.speed * 0.7 + modelAnalysis.avgSpeed * 0.3),
        quality: Math.round(baseParams.quality * 0.7 + modelAnalysis.avgQuality * 0.3),
        cost: Math.round(baseParams.cost * 0.7 + modelAnalysis.avgCostEfficiency * 0.3),
        codeGeneration: Math.round(baseParams.codeGeneration * 0.7 + modelAnalysis.codeGenScore * 0.3),
        documentation: Math.round(baseParams.documentation * 0.7 + modelAnalysis.documentationScore * 0.3),
        analysis: Math.round(baseParams.analysis * 0.7 + modelAnalysis.analysisScore * 0.3),
        creative: Math.round(baseParams.creative * 0.7 + modelAnalysis.creativeScore * 0.3),
        orchestrator: Math.round(baseParams.orchestrator * 0.7 + modelAnalysis.orchestratorScore * 0.3),
        implementation: Math.round(baseParams.implementation * 0.7 + modelAnalysis.codeGenScore * 0.3),
        requirements: Math.round(baseParams.requirements * 0.7 + modelAnalysis.documentationScore * 0.3),
        reliability: Math.round(baseParams.reliability * 0.7 + modelAnalysis.avgReliability * 0.3),
        contextLength: Math.round(baseParams.contextLength * 0.7 + modelAnalysis.avgContextLength * 0.3),
        reasoning: Math.round(baseParams.reasoning * 0.7 + modelAnalysis.avgReasoning * 0.3)
      };

      // Update parameters with optimized values (preserving user's manual changes)
      setParameters(optimizedParams);
      setModels(availableModels);
      
      // Generate rules based on optimized parameters
      await generateRulesFromParameters();
      
      // Wait for rules to be generated
      await new Promise(resolve => setTimeout(resolve, 500));

      // Convert generated rules to TaskTypeOverride and ContextOverride for the API
      const { taskTypeOverrides, contextOverrides } = convertRulesToOverrides(generatedRules);

      // Generate comprehensive insights (including online updates)
      const insights = [
        `Analyzed ${availableModels.length} enabled models (${latestModels.length} total)`,
        `✓ Fetched latest pricing & capabilities from online sources`,
        `Best provider: ${modelAnalysis.recommendedProvider} (${modelAnalysis.recommendedProviderReason})`,
        `Average latency: ${modelAnalysis.avgLatency}ms`,
        `Cost range: $${modelAnalysis.minCostPer1M.toFixed(2)}-$${modelAnalysis.maxCostPer1M.toFixed(2)} per 1M tokens`,
        `Context length: up to ${modelAnalysis.maxContextLength.toLocaleString()} tokens`,
        `Reliability: ${modelAnalysis.avgReliability}%`,
        `Generated ${taskTypeOverrides.length} task type overrides and ${contextOverrides.length} context overrides`
      ];
      setAiInsights(insights);

      // Note: currentConfig was already fetched at the start of the function

      // Build tier configurations based on available models
      const tierConfigs: TierConfig[] = [
        {
          name: 'economy' as ModelTier,
          models: availableModels
            .filter(m => {
              const cost = (m.pricing?.inputCostPer1MTokens || 0) + (m.pricing?.outputCostPer1MTokens || 0);
              return cost < 1;
            })
            .map(m => m.id),
          maxComplexity: 'simple',
          maxTokens: 4000,
          capabilities: ['chat', 'simple-tasks'],
          costMultiplier: 0.5
        },
        {
          name: 'standard' as ModelTier,
          models: availableModels
            .filter(m => {
              const cost = (m.pricing?.inputCostPer1MTokens || 0) + (m.pricing?.outputCostPer1MTokens || 0);
              return cost >= 1 && cost < 10;
            })
            .map(m => m.id),
          maxComplexity: 'moderate',
          maxTokens: 16000,
          capabilities: ['chat', 'code-generation', 'analysis', 'documentation'],
          costMultiplier: 1.0
        },
        {
          name: 'premium' as ModelTier,
          models: availableModels
            .filter(m => {
              const cost = (m.pricing?.inputCostPer1MTokens || 0) + (m.pricing?.outputCostPer1MTokens || 0);
              return cost >= 10;
            })
            .map(m => m.id),
          maxComplexity: 'complex',
          maxTokens: 128000,
          capabilities: ['chat', 'code-generation', 'analysis', 'documentation', 'long-context', 'reasoning'],
          costMultiplier: 2.0
        }
      ];

      // Build complete updated config with all fields
      // CRITICAL: Always use scoringMode from React state, never from database
      const updatedConfig: Partial<InternalRoutingConfig> = {
        // Preserve existing settings
        enabled: currentConfig.enabled,
        isActive: currentConfig.isActive,
        defaultTier: currentConfig.defaultTier || 'standard',
        preferLocalModels: currentConfig.preferLocalModels,
        enableLearning: currentConfig.enableLearning,
        minConfidenceThreshold: currentConfig.minConfidenceThreshold,
        budgetLimits: currentConfig.budgetLimits,
        escalationRules: currentConfig.escalationRules,
        // Update tier configurations with current models
        tiers: tierConfigs,
        // Clear existing overrides and set new ones
        taskTypeOverrides: taskTypeOverrides,
        contextOverrides: contextOverrides,
        // Preserve metadata with AI configurator state
        // CRITICAL: Always use currentScoringMode from React state to preserve user's latest selection
        metadata: {
          ...(currentConfig as any).metadata,
          aiRuleConfigurator: {
            ...((currentConfig as any).metadata?.aiRuleConfigurator || {}), // Preserve other aiRuleConfigurator fields
            parameters: optimizedParams,
            scoringMode: currentScoringMode, // ALWAYS use state value, never database value
            generatedRules: generatedRules,
            lastUpdated: new Date().toISOString(),
            lastModelAnalysis: {
              totalModels: latestModels.length,
              enabledModels: availableModels.length,
              analyzedAt: new Date().toISOString()
            }
          }
        }
      } as any;
      
      console.log('[AI Optimize] Saving config with scoringMode:', currentScoringMode);

      // Save to database with complete config
      const savedConfig = await updateInternalRouterConfig(updatedConfig, token);
      
      // Verify what was actually saved
      const savedScoringMode = (savedConfig as any).metadata?.aiRuleConfigurator?.scoringMode;
      console.log('[AI Optimize] Config saved. Requested scoringMode:', currentScoringMode, 'Saved scoringMode:', savedScoringMode);
      
      if (savedScoringMode !== currentScoringMode) {
        console.error('[AI Optimize] WARNING: Scoring mode mismatch after save! Requested:', currentScoringMode, 'Got:', savedScoringMode);
        // Force update the saved config with the correct scoring mode
        const correctedConfig = {
          ...savedConfig,
          metadata: {
            ...(savedConfig as any).metadata,
            aiRuleConfigurator: {
              ...((savedConfig as any).metadata?.aiRuleConfigurator || {}),
              scoringMode: currentScoringMode
            }
          }
        };
        await updateInternalRouterConfig(correctedConfig, token);
        console.log('[AI Optimize] Corrected scoring mode in database');
      }
      
      // Update local config state with complete config
      const newConfig: InternalRoutingConfig = {
        ...currentConfig,
        ...updatedConfig,
        taskTypeOverrides,
        contextOverrides,
        tiers: tierConfigs,
        metadata: {
          ...(currentConfig as any).metadata,
          aiRuleConfigurator: {
            ...((currentConfig as any).metadata?.aiRuleConfigurator || {}),
            parameters: optimizedParams,
            scoringMode: currentScoringMode, // Ensure state matches
            generatedRules: generatedRules,
            lastUpdated: new Date().toISOString()
          }
        }
      } as any;
      setConfig(newConfig);
      
      // CRITICAL: Ensure scoringMode state matches what we saved
      // This prevents any UI reversion
      setScoringMode(currentScoringMode);
      
      // Notify parent component of config change
      if (onConfigChange) {
        onConfigChange(newConfig);
      }
      
      setLastSaved(new Date());
      
      // Log what was saved for debugging
      console.log('[AI Optimize] Internal Router Config Saved:', {
        taskTypeOverrides: taskTypeOverrides.length,
        contextOverrides: contextOverrides.length,
        tiers: tierConfigs.map(t => ({ name: t.name, models: t.models.length })),
        parameters: optimizedParams,
        scoringMode: currentScoringMode, // Log the actual saved value
        stateScoringMode: scoringMode // Log what's in state
      });
      
      showAlert(`AI optimization complete! Saved to database: ${taskTypeOverrides.length} task overrides, ${contextOverrides.length} context overrides, ${tierConfigs.reduce((sum, t) => sum + t.models.length, 0)} models across 3 tiers.`, 'success');
    } catch (err: any) {
      showAlert('Failed to optimize: ' + err.message, 'error');
    } finally {
      setIsAIOptimizing(false);
      setIsSaving(false);
    }
  };

  const analyzeModels = (modelList: LLMModel[]) => {
    if (modelList.length === 0) {
      return {
        avgSpeed: 50, avgQuality: 50, avgCostEfficiency: 50, codeGenScore: 50,
        documentationScore: 50, analysisScore: 50, creativeScore: 50, orchestratorScore: 50,
        avgReliability: 50, avgContextLength: 50, avgReasoning: 50, avgLatency: 500,
        minCostPer1M: 0, maxCostPer1M: 0, maxContextLength: 0,
        recommendedProvider: 'gemini', recommendedProviderReason: 'No models available',
        disabledModelsCount: 0
      };
    }

    const enabledModels = modelList.filter(m => m.isEnabled && m.status === 'active');
    
    if (enabledModels.length === 0) {
      return {
        avgSpeed: 50, avgQuality: 50, avgCostEfficiency: 50, codeGenScore: 50,
        documentationScore: 50, analysisScore: 50, creativeScore: 50, orchestratorScore: 50,
        avgReliability: 50, avgContextLength: 50, avgReasoning: 50, avgLatency: 500,
        minCostPer1M: 0, maxCostPer1M: 0, maxContextLength: 0,
        recommendedProvider: 'gemini', recommendedProviderReason: 'No enabled models',
        disabledModelsCount: modelList.length
      };
    }

    const allInputCosts = enabledModels.map(m => m.pricing?.inputCostPer1MTokens || 0).filter(c => c > 0);
    const allOutputCosts = enabledModels.map(m => m.pricing?.outputCostPer1MTokens || 0).filter(c => c > 0);
    const minCostPer1M = Math.min(...allInputCosts, ...allOutputCosts);
    const maxCostPer1M = Math.max(...allInputCosts, ...allOutputCosts);

    const providerStats: Record<string, { count: number; speed: number; quality: number; costScore: number; latency: number; reliability: number }> = {};
    
    enabledModels.forEach(model => {
      if (!providerStats[model.provider]) {
        providerStats[model.provider] = { count: 0, speed: 0, quality: 0, costScore: 0, latency: 0, reliability: 0 };
      }
      const stats = providerStats[model.provider];
      stats.count++;
      
      const latency = model.performance?.avgLatencyMs || 500;
      const speedScore = model.capabilities?.fastResponse ? Math.max(0, 100 - (latency / 10)) : Math.max(0, 80 - (latency / 12));
      stats.speed += speedScore;
      
      const qualityScore = (model.capabilities?.codeGeneration ? 20 : 0) +
                          (model.capabilities?.structuredOutput ? 20 : 0) +
                          (model.capabilities?.longContext ? 15 : 0) +
                          ((model.performance?.reliability || 0.8) * 45);
      stats.quality += qualityScore;
      
      const modelCost = (model.pricing?.inputCostPer1MTokens || 0) + (model.pricing?.outputCostPer1MTokens || 0);
      const costScore = modelCost > 0 ? Math.max(0, 100 - ((modelCost / maxCostPer1M) * 100)) : 50;
      stats.costScore += costScore;
      stats.latency += latency;
      stats.reliability += (model.performance?.reliability || 0.8) * 100;
    });

    const providers = Object.keys(providerStats);
    const providerAverages = providers.map(provider => {
      const stats = providerStats[provider];
      return {
        provider,
        avgSpeed: stats.speed / stats.count,
        avgQuality: stats.quality / stats.count,
        avgCostScore: stats.costScore / stats.count,
        avgLatency: stats.latency / stats.count,
        avgReliability: stats.reliability / stats.count
      };
    });

    const avgSpeed = providerAverages.reduce((sum, p) => sum + p.avgSpeed, 0) / providers.length;
    const avgQuality = providerAverages.reduce((sum, p) => sum + p.avgQuality, 0) / providers.length;
    const avgCostEfficiency = providerAverages.reduce((sum, p) => sum + p.avgCostScore, 0) / providers.length;
    const avgLatency = providerAverages.reduce((sum, p) => sum + p.avgLatency, 0) / providers.length;
    const avgReliability = providerAverages.reduce((sum, p) => sum + p.avgReliability, 0) / providers.length;
    const maxContextLength = Math.max(...enabledModels.map(m => m.limits?.maxContextLength || 0));

    const bestProviderData = providerAverages.reduce((best, current) => {
      const bestScore = (best.avgSpeed * 0.3 + best.avgQuality * 0.4 + best.avgCostScore * 0.2 + best.avgReliability * 0.1);
      const currentScore = (current.avgSpeed * 0.3 + current.avgQuality * 0.4 + current.avgCostScore * 0.2 + current.avgReliability * 0.1);
      return currentScore > bestScore ? current : best;
    }, providerAverages[0]);

    const codeGenModels = enabledModels.filter(m => m.capabilities?.codeGeneration);
    const docModels = enabledModels.filter(m => m.capabilities?.longContext || m.capabilities?.structuredOutput);
    const analysisModels = enabledModels.filter(m => m.capabilities?.structuredOutput);
    const reasoningModels = enabledModels.filter(m => m.provider === 'anthropic' || (m.provider === 'openai' && m.name.includes('4')));

    return {
      avgSpeed: Math.round(avgSpeed),
      avgQuality: Math.round(avgQuality),
      avgCostEfficiency: Math.round(avgCostEfficiency),
      codeGenScore: codeGenModels.length > 0 ? Math.min(95, 50 + (codeGenModels.length * 10)) : 30,
      documentationScore: docModels.length > 0 ? Math.min(90, 50 + (docModels.length * 8)) : 30,
      analysisScore: analysisModels.length > 0 ? Math.min(90, 50 + (analysisModels.length * 8)) : 30,
      creativeScore: 65,
      orchestratorScore: 60,
      avgReliability: Math.round(avgReliability),
      avgContextLength: maxContextLength > 100000 ? 85 : maxContextLength > 32000 ? 70 : 50,
      avgReasoning: reasoningModels.length > 0 ? Math.min(95, 60 + (reasoningModels.length * 10)) : 40,
      avgLatency: Math.round(avgLatency),
      minCostPer1M,
      maxCostPer1M,
      maxContextLength,
      recommendedProvider: bestProviderData.provider,
      recommendedProviderReason: `Best balance of speed (${Math.round(bestProviderData.avgSpeed)}%), quality (${Math.round(bestProviderData.avgQuality)}%), and cost efficiency (${Math.round(bestProviderData.avgCostScore)}%)`,
      disabledModelsCount: modelList.length - enabledModels.length
    };
  };

  const ParameterSlider: React.FC<{
    label: string;
    value: number;
    onChange: (value: number) => void;
    icon: React.ReactNode;
    description?: string;
  }> = ({ label, value, onChange, icon, description }) => (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="text-blue-600">{icon}</div>
          <label className="text-sm font-medium text-slate-700">{label}</label>
        </div>
        <span className="text-lg font-bold text-blue-600">{value}%</span>
      </div>
      <input
        type="range"
        min="0"
        max="100"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
      />
      {description && (
        <p className="text-xs text-slate-500 mt-2">{description}</p>
      )}
    </div>
  );

  if (isLoadingParams) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-3 text-slate-500">Loading configuration...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Cpu className="w-6 h-6 text-blue-600" />
            Internal AI Rule Configurator
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            Configure high-level parameters and let AI generate optimal internal routing rules
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Scoring System */}
          <div className="flex items-center gap-2 bg-white rounded-lg p-1 border border-slate-200 shadow-sm">
            <button
              onClick={() => applyScoringMode('high-performance')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors flex items-center gap-1.5 ${
                scoringMode === 'high-performance'
                  ? 'bg-red-500/20 text-red-400 border-2 border-red-500/50'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Zap className="w-4 h-4" />
              High Performance
            </button>
            <button
              onClick={() => applyScoringMode('balance')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors flex items-center gap-1.5 ${
                scoringMode === 'balance'
                  ? 'bg-blue-500/20 text-blue-400 border-2 border-blue-500/50'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Target className="w-4 h-4" />
              Balance
            </button>
            <button
              onClick={() => applyScoringMode('low-cost')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors flex items-center gap-1.5 ${
                scoringMode === 'low-cost'
                  ? 'bg-emerald-500/20 text-emerald-400 border-2 border-emerald-500/50'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <DollarSign className="w-4 h-4" />
              Low Cost
            </button>
            <button
              onClick={() => applyScoringMode('custom')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors flex items-center gap-1.5 ${
                scoringMode === 'custom'
                  ? 'bg-blue-500/20 text-blue-400 border-2 border-blue-500/50'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Settings className="w-4 h-4" />
              Custom
            </button>
          </div>
          
          {/* AI Optimize Button */}
          <button
            onClick={handleAIOptimize}
            disabled={isAIOptimizing || models.length === 0}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
              isAIOptimizing || isSaving
                ? 'bg-blue-500/50 text-white cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white hover:from-blue-500 hover:to-cyan-500'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            title="Optimize rules based on latest model data and your settings, then save automatically"
          >
            {isAIOptimizing || isSaving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                {isAIOptimizing ? 'Optimizing...' : 'Saving...'}
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                AI Optimize & Save
              </>
            )}
          </button>
          <div className="flex items-center gap-1 bg-white rounded-lg p-1 border border-slate-200 shadow-sm">
            <button
              onClick={() => setActiveView('config')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors flex items-center gap-1.5 ${
                activeView === 'config'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Settings className="w-4 h-4" />
              Config
            </button>
            <button
              onClick={() => setActiveView('hexagon')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors flex items-center gap-1.5 ${
                activeView === 'hexagon'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Layers className="w-4 h-4" />
              Architecture and Rules
            </button>
          </div>
          {lastSaved && (
            <div className="text-xs text-slate-500 flex items-center gap-1">
              <CheckCircle className="w-3 h-3 text-emerald-600" />
              Last optimized: {lastSaved.toLocaleTimeString()}
            </div>
          )}
        </div>
      </div>

      {/* Scoring Mode Indicator */}
      <div className={`rounded-xl p-4 border-2 ${
        scoringMode === 'high-performance'
          ? 'bg-red-500/10 border-red-500/30'
          : scoringMode === 'low-cost'
          ? 'bg-emerald-500/10 border-emerald-500/30'
          : 'bg-blue-500/10 border-blue-500/30'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {scoringMode === 'high-performance' && (
              <>
                <Zap className="w-5 h-5 text-red-400" />
                <div>
                  <h4 className="text-md font-semibold text-red-300">High Performance Mode</h4>
                  <p className="text-sm text-red-400/80">Optimized for speed and quality, cost is secondary</p>
                </div>
              </>
            )}
            {scoringMode === 'low-cost' && (
              <>
                <DollarSign className="w-5 h-5 text-emerald-400" />
                <div>
                  <h4 className="text-md font-semibold text-emerald-300">Low Cost Mode</h4>
                  <p className="text-sm text-emerald-400/80">Optimized for cost efficiency, balanced performance</p>
                </div>
              </>
            )}
            {scoringMode === 'balance' && (
              <>
                <Target className="w-5 h-5 text-blue-400" />
                <div>
                  <h4 className="text-md font-semibold text-blue-300">Balance Mode</h4>
                  <p className="text-sm text-blue-400/80">Balanced optimization across all parameters</p>
                </div>
              </>
            )}
            {scoringMode === 'custom' && (
              <>
                <Settings className="w-5 h-5 text-blue-400" />
                <div>
                  <h4 className="text-md font-semibold text-blue-300">Custom Mode</h4>
                  <p className="text-sm text-blue-400/80">Custom parameter configuration</p>
                </div>
              </>
            )}
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-500 mb-1">Current Settings</div>
            <div className="text-sm font-medium text-slate-800">
              Speed: {parameters.speed}% | Quality: {parameters.quality}% | Cost: {parameters.cost}%
            </div>
          </div>
        </div>
        
        {/* Rules Active Indicator */}
        {generatedRules.length > 0 && (
          <div className="mt-4 bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
            <div className="flex items-center gap-2 text-sm text-blue-300">
              <Zap className="w-4 h-4" />
              <span className="font-semibold">{generatedRules.length} Rules Active</span>
            </div>
            <p className="text-xs text-blue-400/80 mt-1">
              These rules will automatically route internal LLM requests when conditions match. Rules are evaluated by priority (higher priority = evaluated first).
            </p>
          </div>
        )}
      </div>

      {/* AI Insights Panel */}
      {aiInsights.length > 0 && (
        <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-xl border-2 border-blue-500/30 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-5 h-5 text-blue-400" />
            <h4 className="text-md font-semibold text-slate-800">AI Insights</h4>
          </div>
          <div className="space-y-2">
            {aiInsights.map((insight, idx) => (
              <div key={idx} className="flex items-start gap-2 text-sm text-slate-600">
                <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                {insight}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeView === 'hexagon' && (
        <div className="space-y-6">
          {/* Architecture Flow */}
          <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm">
            <h4 className="text-lg font-semibold text-slate-800 mb-6 text-center">
              Internal Routing Architecture Flow
            </h4>
            <div className="flex flex-col items-center space-y-6">
              {/* Layer 1: Configuration Parameters */}
              <div className="bg-blue-500/10 rounded-xl p-6 border-2 border-blue-500/30 w-full max-w-2xl">
                <h5 className="text-md font-semibold text-blue-600 mb-3 flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Configuration Layer (Parameters)
                </h5>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div className="bg-slate-50 rounded p-2 text-slate-800 border border-slate-200">Speed: {parameters.speed}%</div>
                  <div className="bg-slate-50 rounded p-2 text-slate-800 border border-slate-200">Quality: {parameters.quality}%</div>
                  <div className="bg-slate-50 rounded p-2 text-slate-800 border border-slate-200">Cost: {parameters.cost}%</div>
                </div>
              </div>

              <ArrowDown className="w-6 h-6 text-slate-500" />

              {/* Layer 2: AI Interpretation */}
              <div className="bg-blue-500/10 rounded-xl p-6 border-2 border-blue-500/30 w-full max-w-2xl">
                <h5 className="text-md font-semibold text-blue-300 mb-3 flex items-center gap-2">
                  <Brain className="w-5 h-5" />
                  AI Interpretation Layer
                </h5>
                <div className="space-y-2">
                  {aiInsights.slice(0, 3).map((insight, idx) => (
                    <div key={idx} className="bg-slate-50 rounded p-2 text-sm text-slate-700 border border-slate-200">
                      {insight}
                    </div>
                  ))}
                </div>
              </div>

              <ArrowDown className="w-6 h-6 text-slate-500" />

              {/* Layer 3: Rule Generation */}
              <div className="bg-emerald-500/10 rounded-xl p-6 border-2 border-emerald-500/30 w-full max-w-2xl">
                <h5 className="text-md font-semibold text-emerald-300 mb-3 flex items-center gap-2">
                  <Zap className="w-5 h-5" />
                  Rule Generation Layer
                </h5>
                <div className="text-sm text-slate-600">
                  <p className="mb-2">Generated {generatedRules.length} routing rules</p>
                  <div className="grid grid-cols-2 gap-2">
                    {generatedRules.slice(0, 4).map((rule, idx) => (
                      <div key={idx} className="bg-slate-50 rounded p-2 text-xs text-slate-800 border border-slate-200">
                        {rule.name}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <ArrowDown className="w-6 h-6 text-slate-500" />

              {/* Layer 4: Execution */}
              <div className="bg-cyan-500/10 rounded-xl p-6 border-2 border-cyan-500/30 w-full max-w-2xl">
                <h5 className="text-md font-semibold text-cyan-300 mb-3 flex items-center gap-2">
                  <Play className="w-5 h-5" />
                  Execution Layer (Internal Router)
                </h5>
                <div className="text-sm text-slate-600">
                  Rules are automatically applied to route internal LLM requests based on task analysis
                </div>
              </div>
            </div>
          </div>

          {/* Generated Rules List */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <Zap className="w-5 h-5 text-blue-600" />
                Generated Rules ({generatedRules.length})
              </h4>
              {isGenerating && (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  AI is generating rules...
                </div>
              )}
            </div>
            {generatedRules.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <Brain className="w-12 h-12 mx-auto mb-4 text-slate-400" />
                <p>Click "AI Optimize & Save" to generate rules</p>
                <p className="text-xs mt-2 text-slate-500">Rules will automatically affect internal routing decisions when saved</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {generatedRules.map((rule, idx) => (
                  <div
                    key={idx}
                    className="bg-white rounded-xl border border-slate-200 p-4 hover:border-slate-300 transition-all shadow-sm"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-medium text-slate-800">{rule.name}</span>
                          <span className="text-xs bg-blue-500/20 text-blue-600 px-2 py-1 rounded">
                            Priority: {rule.priority}
                          </span>
                          {rule.enabled && (
                            <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded">
                              ✓ Active
                            </span>
                          )}
                          <span className={`text-xs px-2 py-1 rounded ${
                            rule.actions.preferredTier === 'economy' ? 'bg-emerald-500/20 text-emerald-600' :
                            rule.actions.preferredTier === 'standard' ? 'bg-blue-500/20 text-blue-600' :
                            'bg-blue-500/20 text-blue-600'
                          }`}>
                            → {rule.actions.preferredTier}
                          </span>
                        </div>
                        {rule.description && (
                          <p className="text-sm text-slate-400 mb-3">{rule.description}</p>
                        )}
                        <div className="mb-2">
                          <p className="text-xs font-medium text-slate-400 mb-1">When:</p>
                          <div className="flex flex-wrap gap-2">
                            {rule.conditions?.taskTypes?.map((type: string) => (
                              <span key={type} className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded">
                                Task: {type.replace(/-/g, ' ')}
                              </span>
                            ))}
                            {rule.conditions?.agentRoles?.map((role: string) => (
                              <span key={role} className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded">
                                Role: {role}
                              </span>
                            ))}
                            {rule.conditions?.complexity?.map((comp: string) => (
                              <span key={comp} className="text-xs bg-cyan-500/20 text-cyan-400 px-2 py-1 rounded">
                                Complexity: {comp}
                              </span>
                            ))}
                            {rule.conditions?.projectPhases?.map((phase: string) => (
                              <span key={phase} className="text-xs bg-cyan-500/20 text-cyan-400 px-2 py-1 rounded">
                                Phase: {phase}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-slate-400 mb-1">Then:</p>
                          <div className="flex flex-wrap gap-2">
                            <span className={`text-xs px-2 py-1 rounded ${
                              rule.actions.preferredTier === 'economy' ? 'bg-emerald-500/20 text-emerald-400' :
                              rule.actions.preferredTier === 'standard' ? 'bg-blue-500/20 text-blue-400' :
                              'bg-blue-500/20 text-blue-400'
                            }`}>
                              → Use {rule.actions.preferredTier} tier
                            </span>
                            {rule.actions?.costPreference && (
                              <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded">
                                → Cost: {rule.actions.costPreference}
                              </span>
                            )}
                            {rule.actions?.maxLatency && (
                              <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-1 rounded">
                                → Max Latency: {rule.actions.maxLatency}ms
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <button
                          onClick={() => setViewingRule(rule)}
                          className="p-2 text-blue-400 hover:bg-blue-500/10 rounded transition-colors"
                          title="View Rule Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeView === 'config' && (
        <div className="space-y-6">
          {/* Performance Parameters */}
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
            <h4 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Gauge className="w-5 h-5 text-blue-400" />
              Performance Parameters
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <ParameterSlider
                label="Speed"
                value={parameters.speed}
                onChange={(v) => handleParameterChange('speed', v)}
                icon={<Zap className="w-4 h-4" />}
                description="Prioritize fast response times"
              />
              <ParameterSlider
                label="Quality"
                value={parameters.quality}
                onChange={(v) => handleParameterChange('quality', v)}
                icon={<Target className="w-4 h-4" />}
                description="Prioritize high-quality outputs"
              />
              <ParameterSlider
                label="Cost Sensitivity"
                value={parameters.cost}
                onChange={(v) => handleParameterChange('cost', v)}
                icon={<DollarSign className="w-4 h-4" />}
                description="How cost-sensitive should routing be"
              />
            </div>
          </div>

          {/* Task-Specific Parameters */}
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
            <h4 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-emerald-400" />
              Task-Specific Priorities
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <ParameterSlider
                label="Code Generation"
                value={parameters.codeGeneration}
                onChange={(v) => handleParameterChange('codeGeneration', v)}
                icon={<Zap className="w-4 h-4" />}
              />
              <ParameterSlider
                label="Documentation"
                value={parameters.documentation}
                onChange={(v) => handleParameterChange('documentation', v)}
                icon={<Target className="w-4 h-4" />}
              />
              <ParameterSlider
                label="Analysis"
                value={parameters.analysis}
                onChange={(v) => handleParameterChange('analysis', v)}
                icon={<BarChart3 className="w-4 h-4" />}
              />
              <ParameterSlider
                label="Creative"
                value={parameters.creative}
                onChange={(v) => handleParameterChange('creative', v)}
                icon={<Sparkles className="w-4 h-4" />}
              />
            </div>
          </div>

          {/* Agent Role Priorities */}
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
            <h4 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-400" />
              Agent Role Priorities
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <ParameterSlider
                label="Orchestrator"
                value={parameters.orchestrator}
                onChange={(v) => handleParameterChange('orchestrator', v)}
                icon={<Brain className="w-4 h-4" />}
              />
              <ParameterSlider
                label="Implementation Agent"
                value={parameters.implementation}
                onChange={(v) => handleParameterChange('implementation', v)}
                icon={<Zap className="w-4 h-4" />}
              />
              <ParameterSlider
                label="Requirements Agent"
                value={parameters.requirements}
                onChange={(v) => handleParameterChange('requirements', v)}
                icon={<Target className="w-4 h-4" />}
              />
            </div>
          </div>

          {/* Advanced Parameters */}
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
            <h4 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Settings className="w-5 h-5 text-cyan-400" />
              Advanced Parameters
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <ParameterSlider
                label="Reliability"
                value={parameters.reliability}
                onChange={(v) => handleParameterChange('reliability', v)}
                icon={<Shield className="w-4 h-4" />}
                description="Prioritize reliable, stable models"
              />
              <ParameterSlider
                label="Context Length"
                value={parameters.contextLength}
                onChange={(v) => handleParameterChange('contextLength', v)}
                icon={<Layers className="w-4 h-4" />}
                description="Need for long context windows"
              />
              <ParameterSlider
                label="Complex Reasoning"
                value={parameters.reasoning}
                onChange={(v) => handleParameterChange('reasoning', v)}
                icon={<Brain className="w-4 h-4" />}
                description="Need for advanced reasoning capabilities"
              />
            </div>
          </div>
        </div>
      )}

      {/* Rule Details Modal */}
      {viewingRule && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-slate-700">
            <div className="sticky top-0 bg-slate-900 border-b border-slate-700 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">Rule Details</h3>
              <button
                onClick={() => setViewingRule(null)}
                className="p-2 text-slate-400 hover:text-white rounded transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Basic Info */}
              <div>
                <h4 className="text-sm font-semibold text-slate-300 mb-2">Basic Information</h4>
                <div className="bg-slate-800/50 rounded-lg p-4 space-y-2 border border-slate-700">
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-400">Name:</span>
                    <span className="text-sm font-medium text-white">{viewingRule.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-400">Priority:</span>
                    <span className="text-sm font-medium text-white">{viewingRule.priority}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-400">Status:</span>
                    <span className={`text-sm font-medium ${viewingRule.enabled ? 'text-emerald-400' : 'text-red-400'}`}>
                      {viewingRule.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-400">Preferred Tier:</span>
                    <span className={`text-sm font-medium ${
                      viewingRule.actions.preferredTier === 'economy' ? 'text-emerald-400' :
                      viewingRule.actions.preferredTier === 'standard' ? 'text-blue-400' :
                      'text-blue-400'
                    }`}>
                      {viewingRule.actions.preferredTier}
                    </span>
                  </div>
                  {viewingRule.description && (
                    <div className="pt-2 border-t border-slate-700">
                      <span className="text-sm text-slate-400">Description:</span>
                      <p className="text-sm text-white mt-1">{viewingRule.description}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Conditions */}
              <div>
                <h4 className="text-sm font-semibold text-slate-300 mb-2">Conditions (When this rule applies)</h4>
                <div className="bg-blue-500/10 rounded-lg p-4 space-y-3 border border-blue-500/30">
                  {viewingRule.conditions?.taskTypes && viewingRule.conditions.taskTypes.length > 0 && (
                    <div>
                      <span className="text-xs font-medium text-blue-400">Task Types:</span>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {viewingRule.conditions.taskTypes.map((type: string) => (
                          <span key={type} className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded">
                            {type.replace(/-/g, ' ')}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {viewingRule.conditions?.agentRoles && viewingRule.conditions.agentRoles.length > 0 && (
                    <div>
                      <span className="text-xs font-medium text-blue-400">Agent Roles:</span>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {viewingRule.conditions.agentRoles.map((role: string) => (
                          <span key={role} className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded">
                            {role}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {viewingRule.conditions?.complexity && viewingRule.conditions.complexity.length > 0 && (
                    <div>
                      <span className="text-xs font-medium text-blue-400">Complexity:</span>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {viewingRule.conditions.complexity.map((comp: string) => (
                          <span key={comp} className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded">
                            {comp}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {(!viewingRule.conditions?.taskTypes?.length && 
                    !viewingRule.conditions?.agentRoles?.length && 
                    !viewingRule.conditions?.complexity?.length) && (
                    <p className="text-sm text-blue-400 italic">No specific conditions (applies to all tasks)</p>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div>
                <h4 className="text-sm font-semibold text-slate-300 mb-2">Actions (What this rule does)</h4>
                <div className="bg-emerald-500/10 rounded-lg p-4 space-y-3 border border-emerald-500/30">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium text-emerald-400">Preferred Tier:</span>
                    <span className={`text-sm font-medium px-2 py-1 rounded ${
                      viewingRule.actions.preferredTier === 'economy' ? 'bg-emerald-500/20 text-emerald-400' :
                      viewingRule.actions.preferredTier === 'standard' ? 'bg-blue-500/20 text-blue-400' :
                      'bg-blue-500/20 text-blue-400'
                    }`}>
                      {viewingRule.actions.preferredTier}
                    </span>
                  </div>
                  {viewingRule.actions?.costPreference && (
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-medium text-emerald-400">Cost Preference:</span>
                      <span className="text-sm font-medium text-emerald-300 bg-emerald-500/20 px-2 py-1 rounded">
                        {viewingRule.actions.costPreference}
                      </span>
                    </div>
                  )}
                  {viewingRule.actions?.maxLatency && (
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-medium text-emerald-400">Max Latency:</span>
                      <span className="text-sm font-medium text-emerald-300 bg-emerald-500/20 px-2 py-1 rounded">
                        {viewingRule.actions.maxLatency}ms
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-slate-800 border-t border-slate-700 px-6 py-4 flex justify-end gap-2">
              <button
                onClick={() => setViewingRule(null)}
                className="px-4 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InternalAIRuleConfigurator;
