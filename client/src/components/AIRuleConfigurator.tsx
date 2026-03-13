/**
 * AI Rule Configurator Component
 * Hexagonal Architecture: High-level parameter configuration → AI interpretation → Rule generation
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Sparkles, Zap, Target, TrendingUp, TrendingDown, DollarSign,
  Clock, Shield, Brain, Settings, Play, RefreshCw,
  Info, AlertCircle, CheckCircle, ArrowRight, ArrowLeft, ArrowDown,
  Activity, BarChart3, Gauge, Layers, Eye, X, Edit2,
  Cpu, Code, ShieldCheck, GitBranch, AlertTriangle, Wrench, Bug, Lock as LockIcon
} from 'lucide-react';
import { RoutingRule, getGlobalSettings, updateGlobalSettings, RouterSettings, deleteRoutingRule } from '../services/adminLLMRouterApi';
import { showAlert } from '../utils/browserUtils';
import { getLLMModels, LLMModel } from '../services/adminApiExtended';

interface AIRuleConfiguratorProps {
  rules: RoutingRule[];
  editingRule: RoutingRule | null;
  onEditRule: (rule: RoutingRule | null) => void;
  onSaveRule: (rule: RoutingRule) => Promise<RoutingRule>;
  onDeleteRule: (ruleId: string) => void;
  onTestRule: (rule: RoutingRule) => void;
  onRulesChange?: (rules: RoutingRule[]) => void;
  token?: string;
}

interface ConfigurationParameters {
  // Performance Parameters
  speed: number; // 0-100: How fast responses should be
  quality: number; // 0-100: How high quality responses should be
  cost: number; // 0-100: Cost sensitivity (0 = don't care, 100 = very cost-sensitive)

  // Task-Specific Parameters
  codeGeneration: number; // 0-100: Priority for code generation tasks
  documentation: number; // 0-100: Priority for documentation tasks
  analysis: number; // 0-100: Priority for analysis tasks
  creative: number; // 0-100: Priority for creative tasks

  // Agent Role Priorities
  orchestrator: number; // 0-100: Priority for orchestrator role
  implementation: number; // 0-100: Priority for implementation agent
  requirements: number; // 0-100: Priority for requirements agent

  // Advanced Parameters
  reliability: number; // 0-100: How reliable models should be
  contextLength: number; // 0-100: Need for long context
  reasoning: number; // 0-100: Need for complex reasoning

  // Prototype & UI/UX Parameters (Brainstorming/Blueprint Phase)
  prototypeQuality: number; // 0-100: Quality of generated prototypes
  uiUxDesign: number; // 0-100: Priority for UI/UX design tasks
  visualDesign: number; // 0-100: Emphasis on visual aesthetics
  wireframeGeneration: number; // 0-100: Quality of wireframe/diagram generation

  // Build Phase Parameters (Workspace)
  testAgent: number; // 0-100: Testing quality priority
  qaAgent: number; // 0-100: QA/Audit thoroughness
  integrationAgent: number; // 0-100: Integration quality priority
  remediationAgent: number; // 0-100: Bug fixing priority
  bugDetection: number; // 0-100: Bug detection sensitivity
  codeReviewQuality: number; // 0-100: Code review thoroughness
  securityPriority: number; // 0-100: Security scanning priority
}

const AIRuleConfigurator: React.FC<AIRuleConfiguratorProps> = ({
  rules,
  editingRule,
  onEditRule,
  onSaveRule,
  onDeleteRule,
  onTestRule,
  onRulesChange,
  token
}) => {
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
    reasoning: 50,
    prototypeQuality: 50,
    uiUxDesign: 50,
    visualDesign: 50,
    wireframeGeneration: 50,
    // Build Phase Parameters
    testAgent: 50,
    qaAgent: 50,
    integrationAgent: 50,
    remediationAgent: 50,
    bugDetection: 50,
    codeReviewQuality: 50,
    securityPriority: 50
  });

  const [models, setModels] = useState<LLMModel[]>([]);
  const [generatedRules, setGeneratedRules] = useState<RoutingRule[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeView, setActiveView] = useState<'config' | 'hexagon'>('config');
  const [aiInsights, setAiInsights] = useState<string[]>([]);
  const [parameterHistory, setParameterHistory] = useState<ConfigurationParameters[]>([]);
  const [scoringMode, setScoringMode] = useState<'high-performance' | 'low-cost' | 'balance' | 'custom'>('balance');
  const [isAIOptimizing, setIsAIOptimizing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isLoadingParams, setIsLoadingParams] = useState(true);
  const [viewingRule, setViewingRule] = useState<RoutingRule | null>(null);

  // Router Settings State (consolidated from Settings tab)
  const [routerSettings, setRouterSettings] = useState({
    enabled: true,
    enableIntelligentRouting: true,
    enableCostOptimization: true,
    enablePerformanceOptimization: true
  });

  useEffect(() => {
    if (token) {
      loadModels();
      loadSavedParameters();
      loadSavedRules();
    }
  }, [token]);

  // Load saved rules from database
  const loadSavedRules = async () => {
    if (!token) return;
    try {
      // Use rules prop which comes from database
      if (rules && rules.length > 0) {
        setGeneratedRules(rules);
      }
    } catch (err: any) {
      console.warn('Failed to load saved rules:', err);
    }
  };

  // Update generatedRules when rules prop changes (from database)
  useEffect(() => {
    if (rules && rules.length > 0) {
      setGeneratedRules(rules);
    }
  }, [rules]);

  const loadSavedParameters = async () => {
    if (!token) return;
    setIsLoadingParams(true);
    try {
      const settings = await getGlobalSettings(token);
      if (settings?.metadata?.aiRuleConfigurator) {
        const savedParams = settings.metadata.aiRuleConfigurator.parameters as ConfigurationParameters;
        const savedScoringMode = settings.metadata.aiRuleConfigurator.scoringMode as 'high-performance' | 'low-cost' | 'balance' | 'custom';
        const savedLastUpdated = settings.metadata.aiRuleConfigurator.lastUpdated;
        const savedModelAnalysis = settings.metadata.aiRuleConfigurator.lastModelAnalysis;

        if (savedParams) {
          setParameters(savedParams);
          if (savedScoringMode) {
            setScoringMode(savedScoringMode);
          } else {
            // Detect mode from parameters if not saved
            const detectedMode = detectScoringMode(savedParams);
            setScoringMode(detectedMode);
          }
        }

        // Restore last saved timestamp so it persists across refresh
        if (savedLastUpdated) {
          setLastSaved(new Date(savedLastUpdated));
        }

        // Restore AI insights if available
        if (savedModelAnalysis) {
          const insights = [
            `Last optimization: ${savedModelAnalysis.enabledModels || 0} enabled models (${savedModelAnalysis.totalModels || 0} total)`,
            `Analyzed at: ${savedModelAnalysis.analyzedAt ? new Date(savedModelAnalysis.analyzedAt).toLocaleString() : 'Unknown'}`
          ];
          setAiInsights(insights);
        }
      }
      // Load router settings
      if (settings) {
        setRouterSettings({
          enabled: settings.enabled ?? true,
          enableIntelligentRouting: settings.enableIntelligentRouting ?? true,
          enableCostOptimization: settings.enableCostOptimization ?? true,
          enablePerformanceOptimization: settings.enablePerformanceOptimization ?? true
        });
      }
    } catch (err: any) {
      // Silently fail - use defaults
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
      // Silently fail
    }
  };

  // Re-fetch models when tab becomes visible (for live summary updates)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && token) {
        loadModels();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Also refresh when window regains focus
    const handleFocus = () => {
      if (token) {
        loadModels();
      }
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [token]);

  const generateRulesFromParameters = useCallback(async (): Promise<RoutingRule[]> => {
    setIsGenerating(true);
    try {
      // Simulate AI processing
      await new Promise(resolve => setTimeout(resolve, 800));

      const newRules: RoutingRule[] = [];
      const insights: string[] = [];

      // Get all models (enabled and disabled) to generate resilient rules
      // Consider ALL models regardless of enabled state for comprehensive rule generation
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

      // Helper function to find best models with fallbacks (considers ALL models, not just enabled)
      const findBestModelsWithFallbacks = (
        criteria: {
          fastResponse?: boolean;
          codeGeneration?: boolean;
          longContext?: boolean;
          lowCost?: boolean;
          highQuality?: boolean;
          provider?: string;
        }
      ): {
        primary: { provider: string; modelId?: string } | null;
        fallbacks: Array<{ provider: string; modelId?: string }>;
        allOptions: Array<{ provider: string; modelId?: string; score: number }>;
      } => {
        // Consider ALL models (enabled and disabled) for rule generation
        // Rules will work regardless of current enabled state
        let candidates = allModels.filter(m => m.status === 'active'); // Only exclude deprecated

        // Filter by provider if specified, but still consider alternatives
        if (criteria.provider) {
          const providerModels = candidates.filter(m => m.provider === criteria.provider);
          if (providerModels.length > 0) {
            candidates = providerModels;
          }
          // Keep all candidates for fallback options
        }

        // Score ALL models based on criteria
        const scored = candidates.map(model => {
          let score = 0;
          if (criteria.fastResponse && model.capabilities?.fastResponse) score += 30;
          if (criteria.fastResponse) {
            const latency = model.performance?.avgLatencyMs || 500;
            score += Math.max(0, 20 - (latency / 25));
          }
          if (criteria.codeGeneration && model.capabilities?.codeGeneration) score += 30;
          if (criteria.longContext && model.capabilities?.longContext) score += 30;
          if (criteria.longContext && model.limits?.maxContextLength) {
            score += Math.min(20, (model.limits.maxContextLength / 100000) * 20);
          }
          if (criteria.lowCost && model.pricing) {
            const totalCost = (model.pricing.inputCostPer1MTokens || 0) + (model.pricing.outputCostPer1MTokens || 0);
            score += Math.max(0, 30 - (totalCost / 10));
          }
          if (criteria.highQuality) {
            score += (model.performance?.reliability || 0.8) * 30;
            if (model.capabilities?.structuredOutput) score += 10;
          }
          return { model, score };
        });

        // Sort by score
        scored.sort((a, b) => b.score - a.score);

        // Get primary (best match)
        const primary = scored[0] ? {
          provider: scored[0].model.provider,
          modelId: scored[0].model.id
        } : null;

        // Get fallbacks - ALL remaining enabled models (no limit)
        const fallbacks: Array<{ provider: string; modelId?: string }> = [];
        const seenProviders = new Set<string>();
        const seenModelIds = new Set<string>();
        if (primary) {
          seenProviders.add(primary.provider);
          if (primary.modelId) seenModelIds.add(primary.modelId);
        }

        // First, add best model from each different provider
        for (const item of scored) {
          if (!seenProviders.has(item.model.provider)) {
            fallbacks.push({ provider: item.model.provider, modelId: item.model.id });
            seenProviders.add(item.model.provider);
            if (item.model.id) seenModelIds.add(item.model.id);
          }
        }

        // Then add ALL remaining models not yet included
        for (const item of scored) {
          if (item.model.id && !seenModelIds.has(item.model.id)) {
            fallbacks.push({ provider: item.model.provider, modelId: item.model.id });
            seenModelIds.add(item.model.id);
          }
        }

        // All options for reference
        const allOptions = scored.slice(0, 10).map(item => ({
          provider: item.model.provider,
          modelId: item.model.id,
          score: item.score
        }));

        return { primary, fallbacks, allOptions };
      };

      // Rule 1: Speed-focused tasks (with fallbacks)
      if (parameters.speed > 30) {
        const speedOptions = findBestModelsWithFallbacks({ fastResponse: true, lowCost: true });
        if (speedOptions.primary) {
          // Primary rule for best speed provider
          newRules.push({
            name: 'Fast Response Priority',
            priority: Math.round(parameters.speed / 10),
            enabled: true,
            conditions: {
              taskTypes: ['chat', 'conversation', 'simple-tasks'],
              complexity: ['simple']
            },
            actions: {
              preferredProvider: speedOptions.primary.provider as any,
              preferredModel: speedOptions.primary.modelId,
              costPreference: 'low',
              maxLatency: Math.round(300 - (parameters.speed * 2))
            },
            description: `Optimized for fast responses (${parameters.speed}% speed priority). Fallbacks: ${speedOptions.fallbacks.map(f => f.provider).join(', ') || 'auto'}`
          });

          // Fallback rules for alternative providers (lower priority)
          speedOptions.fallbacks.forEach((fallback, idx) => {
            newRules.push({
              name: `Fast Response Fallback ${idx + 1}`,
              priority: Math.round(parameters.speed / 10) - (idx + 1),
              enabled: true,
              conditions: {
                taskTypes: ['chat', 'conversation', 'simple-tasks'],
                complexity: ['simple']
              },
              actions: {
                preferredProvider: fallback.provider as any,
                preferredModel: fallback.modelId,
                blockedProviders: [speedOptions.primary!.provider], // Block primary to use fallback
                costPreference: 'low',
                maxLatency: Math.round(300 - (parameters.speed * 2))
              },
              description: `Fast response fallback option ${idx + 1} (${fallback.provider})`
            });
          });

          insights.push(`High speed priority (${parameters.speed}%) → Fast models (${speedOptions.primary.provider} + ${Math.min(speedOptions.fallbacks.length, 5)} fallbacks for maximum coverage)`);
        }
      }

      // Rule 2: Quality-focused tasks (with fallbacks)
      if (parameters.quality > 30) {
        const qualityOptions = findBestModelsWithFallbacks({ highQuality: true, codeGeneration: true });
        if (qualityOptions.primary) {
          newRules.push({
            name: 'High Quality Priority',
            priority: Math.round(parameters.quality / 10),
            enabled: true,
            conditions: {
              complexity: ['complex'],
              taskTypes: ['code-generation', 'analysis']
            },
            actions: {
              preferredProvider: qualityOptions.primary.provider as any,
              preferredModel: qualityOptions.primary.modelId,
              costPreference: 'quality'
            },
            description: `Optimized for high quality (${parameters.quality}% quality priority). Fallbacks: ${qualityOptions.fallbacks.map(f => f.provider).join(', ') || 'auto'}`
          });

          qualityOptions.fallbacks.forEach((fallback, idx) => {
            newRules.push({
              name: `High Quality Fallback ${idx + 1}`,
              priority: Math.round(parameters.quality / 10) - (idx + 1),
              enabled: true,
              conditions: {
                complexity: ['complex'],
                taskTypes: ['code-generation', 'analysis']
              },
              actions: {
                preferredProvider: fallback.provider as any,
                preferredModel: fallback.modelId,
                blockedProviders: [qualityOptions.primary!.provider],
                costPreference: 'quality'
              },
              description: `High quality fallback option ${idx + 1} (${fallback.provider})`
            });
          });

          insights.push(`High quality priority (${parameters.quality}%) → Premium models (${qualityOptions.primary.provider} + ${Math.min(qualityOptions.fallbacks.length, 5)} fallbacks for maximum coverage)`);
        }
      }

      // Rule 3: Cost-sensitive tasks (with fallbacks)
      if (parameters.cost > 30) {
        const costOptions = findBestModelsWithFallbacks({ lowCost: true });
        if (costOptions.primary) {
          newRules.push({
            name: 'Cost Optimization',
            priority: Math.round(parameters.cost / 10),
            enabled: true,
            conditions: {
              taskTypes: ['documentation', 'simple-tasks'],
              complexity: ['simple', 'moderate']
            },
            actions: {
              preferredProvider: costOptions.primary.provider as any,
              preferredModel: costOptions.primary.modelId,
              costPreference: 'low'
            },
            description: `Optimized for cost efficiency (${parameters.cost}% cost sensitivity). Fallbacks: ${costOptions.fallbacks.map(f => f.provider).join(', ') || 'auto'}`
          });

          costOptions.fallbacks.forEach((fallback, idx) => {
            newRules.push({
              name: `Cost Optimization Fallback ${idx + 1}`,
              priority: Math.round(parameters.cost / 10) - (idx + 1),
              enabled: true,
              conditions: {
                taskTypes: ['documentation', 'simple-tasks'],
                complexity: ['simple', 'moderate']
              },
              actions: {
                preferredProvider: fallback.provider as any,
                preferredModel: fallback.modelId,
                blockedProviders: [costOptions.primary!.provider],
                costPreference: 'low'
              },
              description: `Cost optimization fallback option ${idx + 1} (${fallback.provider})`
            });
          });

          insights.push(`High cost sensitivity (${parameters.cost}%) → Cost-efficient models (${costOptions.primary.provider} + ${Math.min(costOptions.fallbacks.length, 5)} fallbacks for maximum coverage)`);
        }
      }

      // Helper to create rule with cascading fallbacks (each fallback blocks previous ones)
      const createRuleWithFallbacks = (
        name: string,
        priority: number,
        conditions: any,
        options: ReturnType<typeof findBestModelsWithFallbacks>,
        costPreference: 'low' | 'balanced' | 'quality',
        description: string,
        additionalActions?: Partial<RoutingRule['actions']>
      ) => {
        if (!options.primary) return;

        // Primary rule
        newRules.push({
          name,
          priority,
          enabled: true,
          conditions,
          actions: {
            preferredProvider: options.primary.provider as any,
            preferredModel: options.primary.modelId,
            costPreference,
            ...additionalActions
          },
          description: `${description}. Fallbacks: ${options.fallbacks.map(f => f.provider).join(', ') || 'auto'}`
        });

        // Fallback rules
        options.fallbacks.forEach((fallback, idx) => {
          newRules.push({
            name: `${name} Fallback ${idx + 1}`,
            priority: priority - (idx + 1),
            enabled: true,
            conditions,
            actions: {
              preferredProvider: fallback.provider as any,
              preferredModel: fallback.modelId,
              blockedProviders: [options.primary!.provider],
              costPreference
            },
            description: `${name} fallback option ${idx + 1} (${fallback.provider})`
          });
        });
      };

      // Rule 4: Code generation priority (with fallbacks)
      if (parameters.codeGeneration > 30) {
        const codeGenOptions = findBestModelsWithFallbacks({ codeGeneration: true });
        createRuleWithFallbacks(
          'Code Generation Optimization',
          Math.round(parameters.codeGeneration / 10),
          { taskTypes: ['code-generation'], agentRoles: ['Implementation Agent'] },
          codeGenOptions,
          parameters.cost > 50 ? 'balanced' : 'quality',
          `Optimized for code generation (${parameters.codeGeneration}% priority)`
        );
        if (codeGenOptions.primary) {
          insights.push(`Code generation priority (${parameters.codeGeneration}%) → Code-optimized models (${codeGenOptions.primary.provider} + ${Math.min(codeGenOptions.fallbacks.length, 5)} fallbacks for maximum coverage)`);
        }
      }

      // Rule 5: Documentation priority (with fallbacks)
      if (parameters.documentation > 30) {
        const docOptions = findBestModelsWithFallbacks({ longContext: true });
        createRuleWithFallbacks(
          'Documentation Optimization',
          Math.round(parameters.documentation / 10),
          { taskTypes: ['documentation', 'writing'] },
          docOptions,
          parameters.cost > 50 ? 'balanced' : 'quality',
          `Optimized for documentation (${parameters.documentation}% priority)`
        );
        if (docOptions.primary) {
          insights.push(`Documentation priority (${parameters.documentation}%) → Writing-optimized models (${docOptions.primary.provider} + ${Math.min(docOptions.fallbacks.length, 5)} fallbacks for maximum coverage)`);
        }
      }

      // Rule 6: Agent role priorities (with fallbacks)
      if (parameters.orchestrator > 30) {
        const orchOptions = findBestModelsWithFallbacks({ lowCost: true, provider: 'gemini' });
        if (!orchOptions.primary || orchOptions.primary.provider !== 'gemini') {
          const altOrchOptions = findBestModelsWithFallbacks({ lowCost: true });
          createRuleWithFallbacks(
            'Orchestrator Optimization',
            Math.round(parameters.orchestrator / 10),
            { agentRoles: ['Orchestrator'] },
            altOrchOptions,
            'balanced',
            `Optimized for orchestrator role (${parameters.orchestrator}% priority)`
          );
        } else {
          createRuleWithFallbacks(
            'Orchestrator Optimization',
            Math.round(parameters.orchestrator / 10),
            { agentRoles: ['Orchestrator'] },
            orchOptions,
            'balanced',
            `Optimized for orchestrator role (${parameters.orchestrator}% priority)`
          );
        }
      }

      if (parameters.implementation > 30) {
        const implOptions = findBestModelsWithFallbacks({ codeGeneration: true });
        createRuleWithFallbacks(
          'Implementation Agent Optimization',
          Math.round(parameters.implementation / 10),
          { agentRoles: ['Implementation Agent'] },
          implOptions,
          parameters.cost > 50 ? 'balanced' : 'quality',
          `Optimized for implementation agent (${parameters.implementation}% priority)`
        );
      }

      // Rule 7: Long context needs (with fallbacks)
      if (parameters.contextLength > 30) {
        const longContextOptions = findBestModelsWithFallbacks({ longContext: true });
        createRuleWithFallbacks(
          'Long Context Priority',
          Math.round(parameters.contextLength / 10),
          { taskTypes: ['long-context', 'analysis'], complexity: ['complex'] },
          longContextOptions,
          'quality',
          `Optimized for long context (${parameters.contextLength}% priority)`
        );
        if (longContextOptions.primary) {
          insights.push(`Long context priority (${parameters.contextLength}%) → Models with large context windows (${longContextOptions.primary.provider} + ${Math.min(longContextOptions.fallbacks.length, 5)} fallbacks for maximum coverage)`);
        }
      }

      // Rule 8: Complex reasoning (with fallbacks)
      if (parameters.reasoning > 30) {
        const reasoningOptions = findBestModelsWithFallbacks({ highQuality: true, provider: 'anthropic' });
        if (!reasoningOptions.primary || reasoningOptions.primary.provider !== 'anthropic') {
          const altReasoningOptions = findBestModelsWithFallbacks({ highQuality: true, provider: 'openai' });
          if (!altReasoningOptions.primary || altReasoningOptions.primary.provider !== 'openai') {
            const finalReasoningOptions = findBestModelsWithFallbacks({ highQuality: true });
            createRuleWithFallbacks(
              'Complex Reasoning Priority',
              Math.round(parameters.reasoning / 10),
              { complexity: ['complex'], taskTypes: ['analysis', 'code-generation'] },
              finalReasoningOptions,
              'quality',
              `Optimized for complex reasoning (${parameters.reasoning}% priority)`
            );
            if (finalReasoningOptions.primary) {
              insights.push(`Complex reasoning priority (${parameters.reasoning}%) → Advanced reasoning models (${finalReasoningOptions.primary.provider} + ${Math.min(finalReasoningOptions.fallbacks.length, 5)} fallbacks for maximum coverage)`);
            }
          } else {
            createRuleWithFallbacks(
              'Complex Reasoning Priority',
              Math.round(parameters.reasoning / 10),
              { complexity: ['complex'], taskTypes: ['analysis', 'code-generation'] },
              altReasoningOptions,
              'quality',
              `Optimized for complex reasoning (${parameters.reasoning}% priority)`
            );
            if (altReasoningOptions.primary) {
              insights.push(`Complex reasoning priority (${parameters.reasoning}%) → Advanced reasoning models (${altReasoningOptions.primary.provider} + ${Math.min(altReasoningOptions.fallbacks.length, 5)} fallbacks for maximum coverage)`);
            }
          }
        } else {
          createRuleWithFallbacks(
            'Complex Reasoning Priority',
            Math.round(parameters.reasoning / 10),
            { complexity: ['complex'], taskTypes: ['analysis', 'code-generation'] },
            reasoningOptions,
            'quality',
            `Optimized for complex reasoning (${parameters.reasoning}% priority)`
          );
          if (reasoningOptions.primary) {
            insights.push(`Complex reasoning priority (${parameters.reasoning}%) → Advanced reasoning models (${reasoningOptions.primary.provider} + ${Math.min(reasoningOptions.fallbacks.length, 5)} fallbacks for maximum coverage)`);
          }
        }
      }

      // Rule 9: Analysis tasks (moderate priority) - with fallbacks
      if (parameters.analysis > 50) {
        const analysisOptions = findBestModelsWithFallbacks({ highQuality: true });
        createRuleWithFallbacks(
          'Analysis Task Optimization',
          Math.round(parameters.analysis / 12),
          { taskTypes: ['analysis', 'structured-output'], complexity: ['moderate', 'complex'] },
          analysisOptions,
          parameters.cost > 60 ? 'balanced' : 'quality',
          `Optimized for analysis tasks (${parameters.analysis}% priority)`
        );
      }

      // Rule 10: Creative tasks - with fallbacks
      if (parameters.creative > 50) {
        const creativeOptions = findBestModelsWithFallbacks({ highQuality: true });
        createRuleWithFallbacks(
          'Creative Task Optimization',
          Math.round(parameters.creative / 12),
          { taskTypes: ['creative', 'writing'], complexity: ['moderate', 'complex'] },
          creativeOptions,
          parameters.cost > 60 ? 'balanced' : 'quality',
          `Optimized for creative tasks (${parameters.creative}% priority)`
        );
      }

      // Rule 11: Requirements Agent - with fallbacks
      if (parameters.requirements > 50) {
        const reqOptions = findBestModelsWithFallbacks({ longContext: true, highQuality: true });
        createRuleWithFallbacks(
          'Requirements Agent Optimization',
          Math.round(parameters.requirements / 12),
          { agentRoles: ['Requirements Agent'] },
          reqOptions,
          parameters.cost > 60 ? 'balanced' : 'quality',
          `Optimized for requirements agent (${parameters.requirements}% priority)`
        );
      }

      // Rule 12: UX Designer Agent - with fallbacks
      if (parameters.creative > 50 || parameters.quality > 50) {
        const uxOptions = findBestModelsWithFallbacks({ highQuality: true });
        createRuleWithFallbacks(
          'UX Designer Optimization',
          Math.round(Math.max(parameters.creative, parameters.quality) / 12),
          { agentRoles: ['UX Designer', 'UI/UX Designer', 'Design Agent'] },
          uxOptions,
          parameters.cost > 60 ? 'balanced' : 'quality',
          `Optimized for UX/Design tasks (${Math.max(parameters.creative, parameters.quality)}% priority)`
        );
      }

      // Rule 13: QA/Audit Agent - with fallbacks
      if (parameters.analysis > 50 || parameters.reliability > 50) {
        const qaOptions = findBestModelsWithFallbacks({ highQuality: true, codeGeneration: true });
        createRuleWithFallbacks(
          'QA/Audit Agent Optimization',
          Math.round(Math.max(parameters.analysis, parameters.reliability) / 12),
          { agentRoles: ['QA Agent', 'QA/Audit Agent', 'Audit Agent'] },
          qaOptions,
          parameters.cost > 60 ? 'balanced' : 'quality',
          `Optimized for QA/Audit tasks (${Math.max(parameters.analysis, parameters.reliability)}% priority)`
        );
      }

      // Rule 18: Integration Agent - with fallbacks
      if (parameters.implementation > 50 || parameters.codeGeneration > 50) {
        const integrationOptions = findBestModelsWithFallbacks({ codeGeneration: true, highQuality: true });
        createRuleWithFallbacks(
          'Integration Agent Optimization',
          Math.round(Math.max(parameters.implementation, parameters.codeGeneration) / 12),
          { agentRoles: ['Integration Agent'] },
          integrationOptions,
          parameters.cost > 60 ? 'balanced' : 'quality',
          `Optimized for integration tasks (${Math.max(parameters.implementation, parameters.codeGeneration)}% priority)`
        );
      }

      // Rule 19: Test Agent - with fallbacks
      if (parameters.analysis > 50 || parameters.reliability > 50) {
        const testOptions = findBestModelsWithFallbacks({ highQuality: true, codeGeneration: true });
        createRuleWithFallbacks(
          'Test Agent Optimization',
          Math.round(Math.max(parameters.analysis, parameters.reliability) / 12),
          { agentRoles: ['Test Agent'] },
          testOptions,
          parameters.cost > 60 ? 'balanced' : 'quality',
          `Optimized for test execution (${Math.max(parameters.analysis, parameters.reliability)}% priority)`
        );
      }

      // Rule 20: Remediation/Bug Agent - with fallbacks
      if (parameters.codeGeneration > 50 || parameters.analysis > 50) {
        const remediationOptions = findBestModelsWithFallbacks({ codeGeneration: true, highQuality: true });
        createRuleWithFallbacks(
          'Remediation/Bug Agent Optimization',
          Math.round(Math.max(parameters.codeGeneration, parameters.analysis) / 12),
          { agentRoles: ['Remediation Agent', 'Remediation/Bug Agent', 'Bug Agent'] },
          remediationOptions,
          parameters.cost > 60 ? 'balanced' : 'quality',
          `Optimized for bug fixing and remediation (${Math.max(parameters.codeGeneration, parameters.analysis)}% priority)`
        );
      }

      // Rule 21: Design/Architecture Agent - with fallbacks
      if (parameters.quality > 50 || parameters.reasoning > 50) {
        const designArchOptions = findBestModelsWithFallbacks({ highQuality: true, longContext: true });
        createRuleWithFallbacks(
          'Design/Architecture Agent Optimization',
          Math.round(Math.max(parameters.quality, parameters.reasoning) / 12),
          { agentRoles: ['Design/Architecture Agent', 'Design Agent', 'Architecture Agent'] },
          designArchOptions,
          parameters.cost > 60 ? 'balanced' : 'quality',
          `Optimized for design and architecture (${Math.max(parameters.quality, parameters.reasoning)}% priority)`
        );
      }

      // Rule 22: Test Requirements Engineer - with fallbacks
      if (parameters.requirements > 50 || parameters.analysis > 50) {
        const testReqOptions = findBestModelsWithFallbacks({ longContext: true, highQuality: true });
        createRuleWithFallbacks(
          'Test Requirements Engineer Optimization',
          Math.round(Math.max(parameters.requirements, parameters.analysis) / 12),
          { agentRoles: ['Test Requirements Engineer'] },
          testReqOptions,
          parameters.cost > 60 ? 'balanced' : 'quality',
          `Optimized for test requirements (${Math.max(parameters.requirements, parameters.analysis)}% priority)`
        );
      }

      // Rule 14: Moderate complexity tasks (balanced approach) - with fallbacks
      if (parameters.speed > 40 && parameters.cost > 40) {
        const moderateOptions = findBestModelsWithFallbacks({ lowCost: true, fastResponse: true });
        createRuleWithFallbacks(
          'Moderate Complexity Optimization',
          5,
          { complexity: ['moderate'], taskTypes: ['chat', 'conversation', 'simple-tasks'] },
          moderateOptions,
          'balanced',
          `Balanced optimization for moderate complexity tasks`
        );
      }

      // Rule 15: Structured output tasks - with fallbacks
      const structuredModels = allModels.filter(m =>
        m.status === 'active' &&
        m.capabilities?.structuredOutput
      );
      if (structuredModels.length > 0 && (parameters.analysis > 40 || parameters.codeGeneration > 40)) {
        const structuredOptions = findBestModelsWithFallbacks({ highQuality: true });
        createRuleWithFallbacks(
          'Structured Output Optimization',
          6,
          { taskTypes: ['structured-output', 'analysis'] },
          structuredOptions,
          parameters.cost > 60 ? 'balanced' : 'quality',
          `Optimized for structured output tasks`
        );
      }

      // Rule 23: Prompt enhancement tasks - with fallbacks
      if (parameters.speed > 50 || parameters.quality > 50) {
        const promptEnhancementOptions = findBestModelsWithFallbacks({ fastResponse: true, highQuality: true });
        createRuleWithFallbacks(
          'Prompt Enhancement Optimization',
          Math.round(Math.max(parameters.speed, parameters.quality) / 12),
          { taskTypes: ['prompt-enhancement'] },
          promptEnhancementOptions,
          parameters.cost > 60 ? 'balanced' : 'quality',
          `Optimized for prompt enhancement (${Math.max(parameters.speed, parameters.quality)}% priority)`
        );
      }

      // Rule 24: Project preview tasks - with fallbacks (needs long context and quality)
      if (parameters.contextLength > 50 || parameters.quality > 50) {
        const projectPreviewOptions = findBestModelsWithFallbacks({ longContext: true, highQuality: true });
        createRuleWithFallbacks(
          'Project Preview Optimization',
          Math.round(Math.max(parameters.contextLength, parameters.quality) / 12),
          { taskTypes: ['project-preview'] },
          projectPreviewOptions,
          parameters.cost > 60 ? 'balanced' : 'quality',
          `Optimized for project preview generation (${Math.max(parameters.contextLength, parameters.quality)}% priority)`
        );
      }

      // Rule 25: Large token requests (minTokens > 50k) - prefer long context models
      if (parameters.contextLength > 50) {
        const largeTokenOptions = findBestModelsWithFallbacks({ longContext: true });
        createRuleWithFallbacks(
          'Large Token Request Optimization',
          Math.round(parameters.contextLength / 10),
          { minTokens: 50000 }, // Requests with 50k+ tokens
          largeTokenOptions,
          parameters.cost > 60 ? 'balanced' : 'quality',
          `Optimized for large token requests (${parameters.contextLength}% context priority)`,
          { costLimit: parameters.cost > 70 ? 0.01 : undefined } // Lower cost limit if cost-sensitive
        );
      }

      // Rule 26: Small token requests (maxTokens < 2k) - prefer fast/cheap models
      if (parameters.speed > 50 || parameters.cost > 50) {
        const smallTokenOptions = findBestModelsWithFallbacks({ fastResponse: true, lowCost: true });
        createRuleWithFallbacks(
          'Small Token Request Optimization',
          Math.round(Math.max(parameters.speed, parameters.cost) / 12),
          { maxTokens: 2000 }, // Requests with < 2k tokens
          smallTokenOptions,
          'low',
          `Optimized for small token requests (${Math.max(parameters.speed, parameters.cost)}% priority)`,
          { maxLatency: 500 } // Fast response required
        );
      }

      // Rule 16: High reliability requirement - with fallbacks
      if (parameters.reliability > 70) {
        const reliableOptions = findBestModelsWithFallbacks({ highQuality: true });
        createRuleWithFallbacks(
          'High Reliability Priority',
          Math.round(parameters.reliability / 10),
          { complexity: ['complex'], taskTypes: ['code-generation', 'analysis'] },
          reliableOptions,
          'quality',
          `Optimized for high reliability (${parameters.reliability}% priority)`
        );
      }

      // Rule 27: Project phase-specific rules (Planning phase - prefer fast/cheap)
      if (parameters.speed > 40 || parameters.cost > 40) {
        const planningOptions = findBestModelsWithFallbacks({ fastResponse: true, lowCost: true });
        createRuleWithFallbacks(
          'Planning Phase Optimization',
          4,
          { projectPhases: ['Planning', 'Requirements'] },
          planningOptions,
          'balanced',
          `Optimized for planning phase tasks`
        );
      }

      // Rule 28: Project phase-specific rules (Implementation phase - prefer quality)
      if (parameters.quality > 50 || parameters.codeGeneration > 50) {
        const implementationPhaseOptions = findBestModelsWithFallbacks({ codeGeneration: true, highQuality: true });
        createRuleWithFallbacks(
          'Implementation Phase Optimization',
          5,
          { projectPhases: ['Implementation', 'Development'] },
          implementationPhaseOptions,
          parameters.cost > 60 ? 'balanced' : 'quality',
          `Optimized for implementation phase tasks`
        );
      }

      // Rule 29: Project phase-specific rules (Testing phase - prefer reliability)
      if (parameters.reliability > 50 || parameters.analysis > 50) {
        const testingPhaseOptions = findBestModelsWithFallbacks({ highQuality: true });
        createRuleWithFallbacks(
          'Testing Phase Optimization',
          5,
          { projectPhases: ['Testing', 'QA'] },
          testingPhaseOptions,
          parameters.cost > 60 ? 'balanced' : 'quality',
          `Optimized for testing phase tasks`
        );
      }

      // Rule 30: Prototype Quality Optimization
      if (parameters.prototypeQuality > 50) {
        const prototypeOptions = findBestModelsWithFallbacks({ highQuality: true, longContext: true });
        createRuleWithFallbacks(
          'Prototype Quality Optimization',
          Math.round(parameters.prototypeQuality / 10),
          { taskTypes: ['project-preview', 'code-generation'], agentRoles: ['Implementation Agent'] },
          prototypeOptions,
          parameters.cost > 60 ? 'balanced' : 'quality',
          `Optimized for high-quality prototype generation (${parameters.prototypeQuality}% priority)`
        );
        if (prototypeOptions.primary) {
          insights.push(`Prototype quality priority (${parameters.prototypeQuality}%) → High-quality models (${prototypeOptions.primary.provider} + fallbacks)`);
        }
      }

      // Rule 31: UI/UX Design Optimization
      if (parameters.uiUxDesign > 50) {
        const uiUxOptions = findBestModelsWithFallbacks({ highQuality: true });
        createRuleWithFallbacks(
          'UI/UX Design Optimization',
          Math.round(parameters.uiUxDesign / 10),
          { agentRoles: ['UX Designer', 'UI/UX Designer', 'Design Agent'], taskTypes: ['creative', 'writing'] },
          uiUxOptions,
          parameters.cost > 60 ? 'balanced' : 'quality',
          `Optimized for UI/UX design tasks (${parameters.uiUxDesign}% priority)`
        );
        if (uiUxOptions.primary) {
          insights.push(`UI/UX design priority (${parameters.uiUxDesign}%) → Design-optimized models (${uiUxOptions.primary.provider} + fallbacks)`);
        }
      }

      // Rule 32: Visual Design Optimization
      if (parameters.visualDesign > 50) {
        const visualOptions = findBestModelsWithFallbacks({ highQuality: true });
        createRuleWithFallbacks(
          'Visual Design Optimization',
          Math.round(parameters.visualDesign / 10),
          { taskTypes: ['creative', 'prompt-enhancement'], agentRoles: ['Design Agent', 'UX Designer'] },
          visualOptions,
          parameters.cost > 60 ? 'balanced' : 'quality',
          `Optimized for visual design and aesthetics (${parameters.visualDesign}% priority)`
        );
        if (visualOptions.primary) {
          insights.push(`Visual design priority (${parameters.visualDesign}%) → Aesthetic-focused models (${visualOptions.primary.provider} + fallbacks)`);
        }
      }

      // Rule 33: Wireframe Generation Optimization
      if (parameters.wireframeGeneration > 50) {
        const wireframeOptions = findBestModelsWithFallbacks({ longContext: true, highQuality: true });
        createRuleWithFallbacks(
          'Wireframe Generation Optimization',
          Math.round(parameters.wireframeGeneration / 10),
          { taskTypes: ['project-preview', 'structured-output', 'analysis'] },
          wireframeOptions,
          parameters.cost > 60 ? 'balanced' : 'quality',
          `Optimized for wireframe and architecture diagram generation (${parameters.wireframeGeneration}% priority)`
        );
        if (wireframeOptions.primary) {
          insights.push(`Wireframe generation priority (${parameters.wireframeGeneration}%) → Architecture-focused models (${wireframeOptions.primary.provider} + fallbacks)`);
        }
      }

      // Rule 34: Test Agent Optimization
      if (parameters.testAgent > 50) {
        const testOptions = findBestModelsWithFallbacks({ highQuality: true });
        createRuleWithFallbacks(
          'Test Agent Optimization',
          Math.round(parameters.testAgent / 10),
          { agentRoles: ['Test Agent', 'Test Requirements Engineer'], taskTypes: ['analysis', 'code-generation'] },
          testOptions,
          parameters.cost > 60 ? 'balanced' : 'quality',
          `Optimized for testing tasks (${parameters.testAgent}% priority)`
        );
        if (testOptions.primary) {
          insights.push(`Test agent priority (${parameters.testAgent}%) → Quality-focused models (${testOptions.primary.provider} + fallbacks)`);
        }
      }

      // Rule 35: QA Agent Optimization
      if (parameters.qaAgent > 50) {
        const qaOptions = findBestModelsWithFallbacks({ highQuality: true });
        createRuleWithFallbacks(
          'QA Agent Optimization',
          Math.round(parameters.qaAgent / 10),
          { agentRoles: ['QA/Audit Agent'], taskTypes: ['analysis', 'structured-output'] },
          qaOptions,
          parameters.cost > 60 ? 'balanced' : 'quality',
          `Optimized for QA/Audit tasks (${parameters.qaAgent}% priority)`
        );
        if (qaOptions.primary) {
          insights.push(`QA agent priority (${parameters.qaAgent}%) → Audit-focused models (${qaOptions.primary.provider} + fallbacks)`);
        }
      }

      // Rule 36: Integration Agent Optimization
      if (parameters.integrationAgent > 50) {
        const integrationOptions = findBestModelsWithFallbacks({ longContext: true, highQuality: true });
        createRuleWithFallbacks(
          'Integration Agent Optimization',
          Math.round(parameters.integrationAgent / 10),
          { agentRoles: ['Integration Agent'], taskTypes: ['code-generation', 'analysis'] },
          integrationOptions,
          parameters.cost > 60 ? 'balanced' : 'quality',
          `Optimized for integration tasks (${parameters.integrationAgent}% priority)`
        );
        if (integrationOptions.primary) {
          insights.push(`Integration agent priority (${parameters.integrationAgent}%) → Context-aware models (${integrationOptions.primary.provider} + fallbacks)`);
        }
      }

      // Rule 37: Remediation/Bug Agent Optimization
      if (parameters.remediationAgent > 50) {
        const remediationOptions = findBestModelsWithFallbacks({ highQuality: true });
        createRuleWithFallbacks(
          'Remediation Agent Optimization',
          Math.round(parameters.remediationAgent / 10),
          { agentRoles: ['Remediation/Bug Agent'], taskTypes: ['code-generation', 'analysis'] },
          remediationOptions,
          parameters.cost > 60 ? 'balanced' : 'quality',
          `Optimized for bug fixing tasks (${parameters.remediationAgent}% priority)`
        );
        if (remediationOptions.primary) {
          insights.push(`Remediation agent priority (${parameters.remediationAgent}%) → Bug-fixing models (${remediationOptions.primary.provider} + fallbacks)`);
        }
      }

      // Rule 38: Bug Detection Optimization
      if (parameters.bugDetection > 50) {
        const bugDetectionOptions = findBestModelsWithFallbacks({ highQuality: true });
        createRuleWithFallbacks(
          'Bug Detection Optimization',
          Math.round(parameters.bugDetection / 10),
          { taskTypes: ['analysis', 'structured-output'], agentRoles: ['QA/Audit Agent', 'Test Agent'] },
          bugDetectionOptions,
          'quality',
          `Optimized for bug detection (${parameters.bugDetection}% sensitivity)`
        );
        if (bugDetectionOptions.primary) {
          insights.push(`Bug detection priority (${parameters.bugDetection}%) → Analysis-focused models (${bugDetectionOptions.primary.provider} + fallbacks)`);
        }
      }

      // Rule 39: Code Review Quality Optimization
      if (parameters.codeReviewQuality > 50) {
        const codeReviewOptions = findBestModelsWithFallbacks({ longContext: true, highQuality: true });
        createRuleWithFallbacks(
          'Code Review Optimization',
          Math.round(parameters.codeReviewQuality / 10),
          { taskTypes: ['analysis', 'code-generation'], agentRoles: ['QA/Audit Agent', 'Design/Architecture Agent'] },
          codeReviewOptions,
          'quality',
          `Optimized for code review (${parameters.codeReviewQuality}% thoroughness)`
        );
        if (codeReviewOptions.primary) {
          insights.push(`Code review priority (${parameters.codeReviewQuality}%) → High-quality models (${codeReviewOptions.primary.provider} + fallbacks)`);
        }
      }

      // Rule 40: Security Priority Optimization
      if (parameters.securityPriority > 50) {
        const securityOptions = findBestModelsWithFallbacks({ highQuality: true });
        createRuleWithFallbacks(
          'Security Scanning Optimization',
          Math.round(parameters.securityPriority / 10),
          { taskTypes: ['analysis', 'structured-output'], agentRoles: ['QA/Audit Agent'] },
          securityOptions,
          'quality',
          `Optimized for security scanning (${parameters.securityPriority}% priority)`
        );
        if (securityOptions.primary) {
          insights.push(`Security priority (${parameters.securityPriority}%) → Security-focused models (${securityOptions.primary.provider} + fallbacks)`);
        }
      }

      // COMPREHENSIVE RULE GENERATION: Create rules for ALL variable combinations
      // This ensures complete coverage regardless of parameter values

      // Generate rules for each taskType × complexity combination
      for (const taskType of allTaskTypes) {
        for (const complexity of allComplexityLevels) {
          // Determine criteria based on task type and complexity
          let criteria: any = {};
          let costPreference: 'low' | 'balanced' | 'quality' = 'balanced';

          if (taskType === 'code-generation') {
            criteria = { codeGeneration: true };
            costPreference = complexity === 'complex' ? 'quality' : 'balanced';
          } else if (taskType === 'long-context' || taskType === 'project-preview') {
            criteria = { longContext: true };
            costPreference = 'quality';
          } else if (taskType === 'chat' || taskType === 'conversation' || taskType === 'simple-tasks') {
            criteria = { fastResponse: true, lowCost: true };
            costPreference = 'low';
          } else if (taskType === 'analysis' || taskType === 'structured-output') {
            criteria = { highQuality: true };
            costPreference = complexity === 'complex' ? 'quality' : 'balanced';
          } else if (taskType === 'documentation' || taskType === 'writing' || taskType === 'creative') {
            criteria = { longContext: true, highQuality: true };
            costPreference = 'balanced';
          } else {
            criteria = { fastResponse: true };
            costPreference = 'balanced';
          }

          if (complexity === 'complex') {
            criteria.highQuality = true;
            if (costPreference === 'low') costPreference = 'balanced';
          }

          const options = findBestModelsWithFallbacks(criteria);
          if (options.primary) {
            const priority = complexity === 'complex' ? 8 : complexity === 'moderate' ? 6 : 4;

            // Primary rule
            newRules.push({
              name: `${taskType} - ${complexity} Priority`,
              priority: priority,
              enabled: true,
              conditions: {
                taskTypes: [taskType],
                complexity: [complexity]
              },
              actions: {
                preferredProvider: options.primary.provider as any,
                preferredModel: options.primary.modelId,
                costPreference: costPreference
              },
              description: `Optimized for ${taskType} tasks with ${complexity} complexity. Fallbacks: ${options.fallbacks.map(f => f.provider).join(', ') || 'auto'}`
            });

            // Fallback rules for alternative providers
            options.fallbacks.forEach((fallback, idx) => {
              newRules.push({
                name: `${taskType} - ${complexity} Fallback ${idx + 1}`,
                priority: priority - (idx + 1) * 0.5,
                enabled: true,
                conditions: {
                  taskTypes: [taskType],
                  complexity: [complexity]
                },
                actions: {
                  preferredProvider: fallback.provider as any,
                  preferredModel: fallback.modelId,
                  blockedProviders: [options.primary!.provider],
                  costPreference: costPreference
                },
                description: `${taskType} - ${complexity} fallback option ${idx + 1} (${fallback.provider})`
              });
            });
          }
        }
      }

      // Generate rules for each agentRole
      for (const agentRole of allAgentRoles) {
        let criteria: any = {};
        let costPreference: 'low' | 'balanced' | 'quality' = 'balanced';

        // Determine criteria based on agent role
        if (agentRole === 'Orchestrator') {
          criteria = { lowCost: true, fastResponse: true };
          costPreference = 'balanced';
        } else if (agentRole.includes('Implementation') || agentRole.includes('Code')) {
          criteria = { codeGeneration: true };
          costPreference = 'balanced';
        } else if (agentRole.includes('Requirements') || agentRole.includes('Test Requirements')) {
          criteria = { longContext: true, highQuality: true };
          costPreference = 'balanced';
        } else if (agentRole.includes('UX') || agentRole.includes('Design')) {
          criteria = { highQuality: true };
          costPreference = 'quality';
        } else if (agentRole.includes('QA') || agentRole.includes('Audit') || agentRole.includes('Test')) {
          criteria = { highQuality: true, codeGeneration: true };
          costPreference = 'quality';
        } else if (agentRole.includes('Remediation') || agentRole.includes('Bug')) {
          criteria = { codeGeneration: true, highQuality: true };
          costPreference = 'balanced';
        } else {
          criteria = { highQuality: true };
          costPreference = 'balanced';
        }

        const options = findBestModelsWithFallbacks(criteria);
        if (options.primary) {
          const priority = 7;

          // Primary rule
          newRules.push({
            name: `${agentRole} Optimization`,
            priority: priority,
            enabled: true,
            conditions: {
              agentRoles: [agentRole]
            },
            actions: {
              preferredProvider: options.primary.provider as any,
              preferredModel: options.primary.modelId,
              costPreference: costPreference
            },
            description: `Optimized for ${agentRole}. Fallbacks: ${options.fallbacks.map(f => f.provider).join(', ') || 'auto'}`
          });

          // Fallback rules
          options.fallbacks.forEach((fallback, idx) => {
            newRules.push({
              name: `${agentRole} Fallback ${idx + 1}`,
              priority: priority - (idx + 1) * 0.5,
              enabled: true,
              conditions: {
                agentRoles: [agentRole]
              },
              actions: {
                preferredProvider: fallback.provider as any,
                preferredModel: fallback.modelId,
                blockedProviders: [options.primary!.provider],
                costPreference: costPreference
              },
              description: `${agentRole} fallback option ${idx + 1} (${fallback.provider})`
            });
          });
        }
      }

      // Generate rules for each projectPhase
      for (const phase of allProjectPhases) {
        let criteria: any = {};
        let costPreference: 'low' | 'balanced' | 'quality' = 'balanced';

        if (phase === 'Planning' || phase === 'Requirements') {
          criteria = { fastResponse: true, lowCost: true };
          costPreference = 'balanced';
        } else if (phase === 'Implementation' || phase === 'Development') {
          criteria = { codeGeneration: true, highQuality: true };
          costPreference = 'balanced';
        } else if (phase === 'Testing' || phase === 'QA') {
          criteria = { highQuality: true };
          costPreference = 'quality';
        } else {
          criteria = { highQuality: true };
          costPreference = 'balanced';
        }

        const options = findBestModelsWithFallbacks(criteria);
        if (options.primary) {
          const priority = 5;

          newRules.push({
            name: `${phase} Phase Optimization`,
            priority: priority,
            enabled: true,
            conditions: {
              projectPhases: [phase]
            },
            actions: {
              preferredProvider: options.primary.provider as any,
              preferredModel: options.primary.modelId,
              costPreference: costPreference
            },
            description: `Optimized for ${phase} phase. Fallbacks: ${options.fallbacks.map(f => f.provider).join(', ') || 'auto'}`
          });

          options.fallbacks.forEach((fallback, idx) => {
            newRules.push({
              name: `${phase} Phase Fallback ${idx + 1}`,
              priority: priority - (idx + 1) * 0.5,
              enabled: true,
              conditions: {
                projectPhases: [phase]
              },
              actions: {
                preferredProvider: fallback.provider as any,
                preferredModel: fallback.modelId,
                blockedProviders: [options.primary!.provider],
                costPreference: costPreference
              },
              description: `${phase} phase fallback option ${idx + 1} (${fallback.provider})`
            });
          });
        }
      }

      // Generate rules for token ranges
      const tokenRanges = [
        { maxTokens: 2000, name: 'Small', criteria: { fastResponse: true, lowCost: true }, costPreference: 'low' as const },
        { minTokens: 50000, name: 'Large', criteria: { longContext: true }, costPreference: 'quality' as const }
      ];

      for (const range of tokenRanges) {
        const options = findBestModelsWithFallbacks(range.criteria);
        if (options.primary) {
          const priority = 6;

          newRules.push({
            name: `${range.name} Token Request Optimization`,
            priority: priority,
            enabled: true,
            conditions: range.maxTokens ? { maxTokens: range.maxTokens } : { minTokens: range.minTokens },
            actions: {
              preferredProvider: options.primary.provider as any,
              preferredModel: options.primary.modelId,
              costPreference: range.costPreference
            },
            description: `Optimized for ${range.name.toLowerCase()} token requests. Fallbacks: ${options.fallbacks.map(f => f.provider).join(', ') || 'auto'}`
          });

          options.fallbacks.forEach((fallback, idx) => {
            newRules.push({
              name: `${range.name} Token Fallback ${idx + 1}`,
              priority: priority - (idx + 1) * 0.5,
              enabled: true,
              conditions: range.maxTokens ? { maxTokens: range.maxTokens } : { minTokens: range.minTokens },
              actions: {
                preferredProvider: fallback.provider as any,
                preferredModel: fallback.modelId,
                blockedProviders: [options.primary!.provider],
                costPreference: range.costPreference
              },
              description: `${range.name.toLowerCase()} token fallback option ${idx + 1} (${fallback.provider})`
            });
          });
        }
      }

      // Rule 30: Fallback rule for unmatched scenarios (lowest priority) - considers ALL models
      const fallbackOptions = findBestModelsWithFallbacks({ lowCost: true });
      if (fallbackOptions.primary && newRules.length > 0) {
        newRules.push({
          name: 'Default Fallback Rule',
          priority: 0.5,
          enabled: true,
          conditions: {},
          actions: {
            preferredProvider: fallbackOptions.primary.provider as any,
            preferredModel: fallbackOptions.primary.modelId,
            costPreference: 'balanced'
          },
          description: `Default fallback for unmatched scenarios. Alternative providers: ${fallbackOptions.fallbacks.map(f => f.provider).join(', ') || 'auto'}`
        });
      }

      insights.push(`Generated ${newRules.length} comprehensive rules covering all task types, agent roles, complexity levels, project phases, and token ranges with fallbacks for all models (active and disabled)`);

      setGeneratedRules(newRules);
      setAiInsights(insights);
      return newRules;
    } catch (err: any) {
      showAlert('Failed to generate rules: ' + err.message, 'error');
      return [];
    } finally {
      setIsGenerating(false);
    }
  }, [parameters, models]);

  const handleParameterChange = async (key: keyof ConfigurationParameters, value: number) => {
    const newParams = { ...parameters, [key]: value };
    setParameters(newParams);
    // Auto-switch scoring mode based on dominant parameters
    updateScoringModeFromParameters(newParams);

    // Save to database immediately
    if (token && !isLoadingParams) {
      try {
        const currentSettings = await getGlobalSettings(token);
        const updatedSettings: Partial<RouterSettings> = {
          ...currentSettings,
          metadata: {
            ...(currentSettings?.metadata || {}),
            aiRuleConfigurator: {
              parameters: newParams,
              scoringMode: scoringMode,
              lastUpdated: new Date().toISOString()
            }
          }
        };
        await updateGlobalSettings(updatedSettings, token);
      } catch (err) {
        // Silently fail - don't interrupt user
        console.warn('Failed to auto-save parameters:', err);
      }
    }
  };

  const detectScoringMode = (params: ConfigurationParameters): 'high-performance' | 'low-cost' | 'balance' | 'custom' => {
    const speedQualityAvg = (params.speed + params.quality) / 2;
    const costValue = params.cost;

    // Check if parameters match preset modes (with some tolerance)
    const matchesHighPerf = speedQualityAvg > 70 && costValue < 40 &&
      params.speed > 75 && params.quality > 80;
    const matchesLowCost = costValue > 70 && speedQualityAvg < 50 &&
      params.cost > 75 && params.speed < 65 && params.quality < 60;
    const matchesBalance = Math.abs(params.speed - 60) < 15 &&
      Math.abs(params.quality - 65) < 15 &&
      Math.abs(params.cost - 55) < 15;

    if (matchesHighPerf) {
      return 'high-performance';
    } else if (matchesLowCost) {
      return 'low-cost';
    } else if (matchesBalance) {
      return 'balance';
    } else {
      return 'custom';
    }
  };

  const updateScoringModeFromParameters = (params: ConfigurationParameters) => {
    const detectedMode = detectScoringMode(params);
    setScoringMode(detectedMode);
  };

  const applyScoringMode = (mode: 'high-performance' | 'low-cost' | 'balance' | 'custom') => {
    setScoringMode(mode);

    // Don't change parameters if custom mode is selected
    if (mode === 'custom') {
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
          reasoning: 90,
          prototypeQuality: 85,
          uiUxDesign: 80,
          visualDesign: 80,
          wireframeGeneration: 85,
          testAgent: 85,
          qaAgent: 85,
          integrationAgent: 80,
          remediationAgent: 85,
          bugDetection: 85,
          codeReviewQuality: 90,
          securityPriority: 85
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
          reasoning: 50,
          prototypeQuality: 50,
          uiUxDesign: 50,
          visualDesign: 50,
          wireframeGeneration: 50,
          testAgent: 50,
          qaAgent: 50,
          integrationAgent: 50,
          remediationAgent: 50,
          bugDetection: 50,
          codeReviewQuality: 50,
          securityPriority: 50
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
          reasoning: 65,
          prototypeQuality: 65,
          uiUxDesign: 60,
          visualDesign: 60,
          wireframeGeneration: 65,
          testAgent: 65,
          qaAgent: 65,
          integrationAgent: 60,
          remediationAgent: 65,
          bugDetection: 65,
          codeReviewQuality: 70,
          securityPriority: 65
        };
        break;
    }
    setParameters(newParams);
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
      const currentScoringMode = scoringMode;

      console.log('[AI Optimize - End User] Using scoring mode from state:', currentScoringMode);

      // Get current settings to check for mismatch
      const currentSettings = await getGlobalSettings(token);
      const dbScoringMode = currentSettings?.metadata?.aiRuleConfigurator?.scoringMode;
      if (dbScoringMode !== currentScoringMode) {
        console.warn('[AI Optimize - End User] Scoring mode mismatch - State:', currentScoringMode, 'DB:', dbScoringMode, '- Using state value');
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

      // Filter only enabled and active models
      const availableModels = latestModels.filter(m =>
        m.isEnabled &&
        m.status === 'active' &&
        m.apiKeyConfigured !== false
      );

      if (availableModels.length === 0) {
        throw new Error('No enabled models available. Please enable at least one model in LLM Manager.');
      }

      // Analyze current models with real pricing, performance, and capabilities (now includes online updates)
      const modelAnalysis = analyzeModels(availableModels);

      // Get base parameters for the current scoring mode
      let baseParams: ConfigurationParameters;
      switch (scoringMode) {
        case 'high-performance':
          baseParams = {
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
            reasoning: 90,
            prototypeQuality: 85,
            uiUxDesign: 80,
            visualDesign: 80,
            wireframeGeneration: 85,
            testAgent: 85,
            qaAgent: 85,
            integrationAgent: 80,
            remediationAgent: 85,
            bugDetection: 85,
            codeReviewQuality: 90,
            securityPriority: 85
          };
          break;
        case 'low-cost':
          baseParams = {
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
            reasoning: 50,
            prototypeQuality: 50,
            uiUxDesign: 50,
            visualDesign: 50,
            wireframeGeneration: 50,
            testAgent: 50,
            qaAgent: 50,
            integrationAgent: 50,
            remediationAgent: 50,
            bugDetection: 50,
            codeReviewQuality: 50,
            securityPriority: 50
          };
          break;
        case 'balance':
          baseParams = {
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
            reasoning: 65,
            prototypeQuality: 65,
            uiUxDesign: 60,
            visualDesign: 60,
            wireframeGeneration: 65,
            testAgent: 65,
            qaAgent: 65,
            integrationAgent: 60,
            remediationAgent: 65,
            bugDetection: 65,
            codeReviewQuality: 70,
            securityPriority: 65
          };
          break;
        case 'custom':
        default:
          // For custom mode, use current parameters as base
          baseParams = parameters;
          break;
      }

      // Blend base mode parameters with AI recommendations (60% mode base, 40% AI)
      // This keeps the mode's characteristics while adapting to real model data
      const optimizedParams: ConfigurationParameters = {
        speed: Math.round(baseParams.speed * 0.6 + modelAnalysis.avgSpeed * 0.4),
        quality: Math.round(baseParams.quality * 0.6 + modelAnalysis.avgQuality * 0.4),
        cost: Math.round(baseParams.cost * 0.6 + modelAnalysis.avgCostEfficiency * 0.4),
        codeGeneration: Math.round(baseParams.codeGeneration * 0.6 + modelAnalysis.codeGenScore * 0.4),
        documentation: Math.round(baseParams.documentation * 0.6 + modelAnalysis.documentationScore * 0.4),
        analysis: Math.round(baseParams.analysis * 0.6 + modelAnalysis.analysisScore * 0.4),
        creative: Math.round(baseParams.creative * 0.6 + modelAnalysis.creativeScore * 0.4),
        orchestrator: Math.round(baseParams.orchestrator * 0.6 + modelAnalysis.orchestratorScore * 0.4),
        implementation: Math.round(baseParams.implementation * 0.6 + modelAnalysis.codeGenScore * 0.4),
        requirements: Math.round(baseParams.requirements * 0.6 + modelAnalysis.documentationScore * 0.4),
        reliability: Math.round(baseParams.reliability * 0.6 + modelAnalysis.avgReliability * 0.4),
        contextLength: Math.round(baseParams.contextLength * 0.6 + modelAnalysis.avgContextLength * 0.4),
        reasoning: Math.round(baseParams.reasoning * 0.6 + modelAnalysis.avgReasoning * 0.4),
        prototypeQuality: Math.round(baseParams.prototypeQuality * 0.6 + modelAnalysis.avgQuality * 0.4),
        uiUxDesign: Math.round(baseParams.uiUxDesign * 0.6 + modelAnalysis.creativeScore * 0.4),
        visualDesign: Math.round(baseParams.visualDesign * 0.6 + modelAnalysis.creativeScore * 0.4),
        wireframeGeneration: Math.round(baseParams.wireframeGeneration * 0.6 + modelAnalysis.avgContextLength * 0.4),
        testAgent: Math.round(baseParams.testAgent * 0.6 + modelAnalysis.avgQuality * 0.4),
        qaAgent: Math.round(baseParams.qaAgent * 0.6 + modelAnalysis.avgQuality * 0.4),
        integrationAgent: Math.round(baseParams.integrationAgent * 0.6 + modelAnalysis.codeGenScore * 0.4),
        remediationAgent: Math.round(baseParams.remediationAgent * 0.6 + modelAnalysis.codeGenScore * 0.4),
        bugDetection: Math.round(baseParams.bugDetection * 0.6 + modelAnalysis.analysisScore * 0.4),
        codeReviewQuality: Math.round(baseParams.codeReviewQuality * 0.6 + modelAnalysis.avgQuality * 0.4),
        securityPriority: Math.round(baseParams.securityPriority * 0.6 + modelAnalysis.avgReliability * 0.4)
      };

      setParameters(optimizedParams);

      // Update models state with latest data
      setModels(availableModels);

      // Keep the selected scoring mode (don't change to custom)
      // Use currentScoringMode from state (captured at start) to preserve user's selection
      let finalScoringMode = currentScoringMode;
      if (currentScoringMode === 'custom') {
        // If custom mode, detect if it now matches a preset
        const detectedMode = detectScoringMode(optimizedParams);
        if (detectedMode !== 'custom') {
          setScoringMode(detectedMode);
          finalScoringMode = detectedMode;
        }
      }
      // Otherwise, keep the current mode (balance, high-performance, or low-cost)

      console.log('[AI Optimize - End User] Saving with scoringMode:', finalScoringMode);

      // Save parameters to database
      // Note: currentSettings was already fetched at the start
      const updatedSettings: Partial<RouterSettings> = {
        ...currentSettings,
        metadata: {
          ...(currentSettings?.metadata || {}),
          aiRuleConfigurator: {
            ...(currentSettings?.metadata?.aiRuleConfigurator || {}), // Preserve other aiRuleConfigurator fields
            parameters: optimizedParams,
            scoringMode: finalScoringMode, // ALWAYS use state value
            lastUpdated: new Date().toISOString(),
            lastModelAnalysis: {
              totalModels: latestModels.length,
              enabledModels: availableModels.length,
              analyzedAt: new Date().toISOString()
            }
          }
        }
      };
      const savedSettings = await updateGlobalSettings(updatedSettings, token);

      // Verify what was actually saved
      const savedScoringMode = savedSettings?.metadata?.aiRuleConfigurator?.scoringMode;
      console.log('[AI Optimize - End User] Config saved. Requested scoringMode:', finalScoringMode, 'Saved scoringMode:', savedScoringMode);

      if (savedScoringMode !== finalScoringMode) {
        console.error('[AI Optimize - End User] WARNING: Scoring mode mismatch after save! Requested:', finalScoringMode, 'Got:', savedScoringMode);
        // Force update the saved settings with the correct scoring mode
        const correctedSettings = {
          ...savedSettings,
          metadata: {
            ...(savedSettings?.metadata || {}),
            aiRuleConfigurator: {
              ...(savedSettings?.metadata?.aiRuleConfigurator || {}),
              scoringMode: finalScoringMode
            }
          }
        };
        await updateGlobalSettings(correctedSettings, token);
        console.log('[AI Optimize - End User] Corrected scoring mode in database');
      }

      // CRITICAL: Ensure scoringMode state matches what we saved
      setScoringMode(finalScoringMode);

      // Generate rules based on optimized parameters
      // IMPORTANT: Capture returned rules directly to avoid stale closure issue with React state
      const newlyGeneratedRules = await generateRulesFromParameters();

      // Generate comprehensive insights based on real model data (including online updates)
      const insights = [
        `Analyzed ${availableModels.length} enabled models (${latestModels.length} total)`,
        `✓ Fetched latest pricing & capabilities from online sources`,
        `Best provider: ${modelAnalysis.recommendedProvider} (${modelAnalysis.recommendedProviderReason})`,
        `Average latency: ${modelAnalysis.avgLatency}ms`,
        `Cost range: $${modelAnalysis.minCostPer1M.toFixed(2)}-$${modelAnalysis.maxCostPer1M.toFixed(2)} per 1M tokens`,
        `Context length: up to ${modelAnalysis.maxContextLength.toLocaleString()} tokens`,
        `Reliability: ${modelAnalysis.avgReliability}%`,
        modelAnalysis.disabledModelsCount > 0
          ? `Note: ${modelAnalysis.disabledModelsCount} models are disabled and excluded from rules`
          : 'All enabled models included in optimization'
      ];
      setAiInsights(insights);

      // Delete all existing rules first (only when optimizing)
      // Use the API directly to avoid confirmation dialogs
      if (rules && rules.length > 0 && token) {
        for (const rule of rules) {
          if (rule._id) {
            try {
              await deleteRoutingRule(rule._id, token);
            } catch (err) {
              // Ignore errors for individual deletions
              console.warn('Failed to delete rule:', err);
            }
          }
        }
        // Update local rules state via callback
        if (onRulesChange) {
          onRulesChange([]);
        }
      }

      // Wait a bit for deletions to complete
      await new Promise(resolve => setTimeout(resolve, 500));

      // Automatically save all newly generated rules to database
      // Use newlyGeneratedRules directly (not generatedRules state which has stale closure value)
      if (newlyGeneratedRules.length > 0) {
        const savedRules: RoutingRule[] = [];
        for (const rule of newlyGeneratedRules) {
          try {
            // Ensure routerType is set to 'end-user' for End User Router rules
            const ruleWithRouterType: RoutingRule = {
              ...rule,
              routerType: 'end-user'
            };
            const savedRule = await onSaveRule(ruleWithRouterType);
            savedRules.push(savedRule);
          } catch (err: any) {
            console.error('Failed to save rule:', err);
            showAlert(`Warning: Failed to save rule "${rule.name}": ${err.message}`, 'error');
          }
        }

        // Update local state with saved rules (they now have _id from database)
        setGeneratedRules(savedRules);

        // Also save the generated rules list to metadata for persistence
        if (token) {
          try {
            const currentSettings = await getGlobalSettings(token);
            const updatedSettings: Partial<RouterSettings> = {
              ...currentSettings,
              metadata: {
                ...(currentSettings?.metadata || {}),
                aiRuleConfigurator: {
                  ...(currentSettings?.metadata?.aiRuleConfigurator || {}),
                  parameters: optimizedParams,
                  scoringMode: finalScoringMode, // Use the same finalScoringMode from above
                  lastUpdated: new Date().toISOString(),
                  lastGeneratedRulesCount: savedRules.length,
                  lastModelAnalysis: {
                    totalModels: latestModels.length,
                    enabledModels: availableModels.length,
                    analyzedAt: new Date().toISOString()
                  }
                }
              }
            };
            await updateGlobalSettings(updatedSettings, token);
            // Ensure state matches
            setScoringMode(finalScoringMode);
          } catch (err) {
            console.warn('Failed to save rules metadata:', err);
          }
        }

        setLastSaved(new Date());
        showAlert(`AI optimization complete! ${savedRules.length} rules adjusted and saved to database based on latest model pricing and capabilities.`, 'success');
      } else {
        showAlert('AI optimization complete! Parameters adjusted based on latest model data.', 'success');
      }
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
        avgSpeed: 50,
        avgQuality: 50,
        avgCostEfficiency: 50,
        codeGenScore: 50,
        documentationScore: 50,
        analysisScore: 50,
        creativeScore: 50,
        orchestratorScore: 50,
        avgReliability: 50,
        avgContextLength: 50,
        avgReasoning: 50,
        avgLatency: 500,
        minCostPer1M: 0,
        maxCostPer1M: 0,
        maxContextLength: 0,
        recommendedProvider: 'openai',
        recommendedProviderReason: 'No models available',
        disabledModelsCount: 0
      };
    }

    // Filter only enabled and active models
    const enabledModels = modelList.filter(m => m.isEnabled && m.status === 'active');

    if (enabledModels.length === 0) {
      return {
        avgSpeed: 50,
        avgQuality: 50,
        avgCostEfficiency: 50,
        codeGenScore: 50,
        documentationScore: 50,
        analysisScore: 50,
        creativeScore: 50,
        orchestratorScore: 50,
        avgReliability: 50,
        avgContextLength: 50,
        avgReasoning: 50,
        avgLatency: 500,
        minCostPer1M: 0,
        maxCostPer1M: 0,
        maxContextLength: 0,
        recommendedProvider: 'openai',
        recommendedProviderReason: 'No enabled models',
        disabledModelsCount: modelList.length
      };
    }

    // Calculate real pricing metrics
    const allInputCosts = enabledModels.map(m => m.pricing?.inputCostPer1MTokens || 0).filter(c => c > 0);
    const allOutputCosts = enabledModels.map(m => m.pricing?.outputCostPer1MTokens || 0).filter(c => c > 0);
    const minCostPer1M = Math.min(...allInputCosts, ...allOutputCosts);
    const maxCostPer1M = Math.max(...allInputCosts, ...allOutputCosts);
    const avgCostPer1M = allInputCosts.length > 0
      ? allInputCosts.reduce((a, b) => a + b, 0) / allInputCosts.length
      : 0;

    // Analyze models by provider with real data
    const providerStats: Record<string, {
      count: number;
      speed: number;
      quality: number;
      costScore: number;
      latency: number;
      reliability: number;
      contextLength: number;
      codeGen: number;
      reasoning: number;
      totalCost: number;
    }> = {};

    enabledModels.forEach(model => {
      if (!providerStats[model.provider]) {
        providerStats[model.provider] = {
          count: 0,
          speed: 0,
          quality: 0,
          costScore: 0,
          latency: 0,
          reliability: 0,
          contextLength: 0,
          codeGen: 0,
          reasoning: 0,
          totalCost: 0
        };
      }
      const stats = providerStats[model.provider];
      stats.count++;

      // Speed: based on latency (lower is better) and fastResponse capability
      const latency = model.performance?.avgLatencyMs || 500;
      const speedScore = model.capabilities?.fastResponse
        ? Math.max(0, 100 - (latency / 10))
        : Math.max(0, 80 - (latency / 12));
      stats.speed += speedScore;

      // Quality: based on capabilities and reliability
      const qualityScore = (model.capabilities?.codeGeneration ? 20 : 0) +
        (model.capabilities?.structuredOutput ? 20 : 0) +
        (model.capabilities?.longContext ? 15 : 0) +
        ((model.performance?.reliability || 0.8) * 45);
      stats.quality += qualityScore;

      // Cost efficiency: lower cost = higher score (inverted)
      const modelCost = (model.pricing?.inputCostPer1MTokens || 0) + (model.pricing?.outputCostPer1MTokens || 0);
      const costScore = modelCost > 0
        ? Math.max(0, 100 - ((modelCost / maxCostPer1M) * 100))
        : 50;
      stats.costScore += costScore;
      stats.totalCost += modelCost;

      // Latency
      stats.latency += latency;

      // Reliability
      stats.reliability += (model.performance?.reliability || 0.8) * 100;

      // Context length
      stats.contextLength += model.limits?.maxContextLength || 0;

      // Code generation capability
      stats.codeGen += model.capabilities?.codeGeneration ? 1 : 0;

      // Reasoning capability (anthropic/openai typically better)
      stats.reasoning += (model.provider === 'anthropic' || model.provider === 'openai') ? 1 : 0;
    });

    // Calculate averages per provider
    const providers = Object.keys(providerStats);
    const providerAverages = providers.map(provider => {
      const stats = providerStats[provider];
      return {
        provider,
        avgSpeed: stats.speed / stats.count,
        avgQuality: stats.quality / stats.count,
        avgCostScore: stats.costScore / stats.count,
        avgLatency: stats.latency / stats.count,
        avgReliability: stats.reliability / stats.count,
        avgContextLength: stats.contextLength / stats.count,
        codeGenRatio: stats.codeGen / stats.count,
        reasoningRatio: stats.reasoning / stats.count,
        avgCost: stats.totalCost / stats.count
      };
    });

    // Overall averages across all providers
    const avgSpeed = providerAverages.reduce((sum, p) => sum + p.avgSpeed, 0) / providers.length;
    const avgQuality = providerAverages.reduce((sum, p) => sum + p.avgQuality, 0) / providers.length;
    const avgCostEfficiency = providerAverages.reduce((sum, p) => sum + p.avgCostScore, 0) / providers.length;
    const avgLatency = providerAverages.reduce((sum, p) => sum + p.avgLatency, 0) / providers.length;
    const avgReliability = providerAverages.reduce((sum, p) => sum + p.avgReliability, 0) / providers.length;
    const maxContextLength = Math.max(...enabledModels.map(m => m.limits?.maxContextLength || 0));

    // Find best provider based on balanced score
    const bestProviderData = providerAverages.reduce((best, current) => {
      const bestScore = (best.avgSpeed * 0.3 + best.avgQuality * 0.4 + best.avgCostScore * 0.2 + best.avgReliability * 0.1);
      const currentScore = (current.avgSpeed * 0.3 + current.avgQuality * 0.4 + current.avgCostScore * 0.2 + current.avgReliability * 0.1);
      return currentScore > bestScore ? current : best;
    }, providerAverages[0]);

    // Task-specific scores based on real model capabilities
    const codeGenModels = enabledModels.filter(m => m.capabilities?.codeGeneration);
    const docModels = enabledModels.filter(m => m.capabilities?.longContext || m.capabilities?.structuredOutput);
    const analysisModels = enabledModels.filter(m => m.capabilities?.structuredOutput);
    const reasoningModels = enabledModels.filter(m =>
      m.provider === 'anthropic' ||
      (m.provider === 'openai' && m.name.includes('4'))
    );

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

  const saveParametersToDatabase = async () => {
    if (!token || isLoadingParams) return;
    try {
      const currentSettings = await getGlobalSettings(token);
      const updatedSettings: Partial<RouterSettings> = {
        ...currentSettings,
        metadata: {
          ...(currentSettings?.metadata || {}),
          aiRuleConfigurator: {
            parameters,
            scoringMode,
            lastUpdated: new Date().toISOString()
          }
        }
      };
      await updateGlobalSettings(updatedSettings, token);
      setLastSaved(new Date());
    } catch (err: any) {
      console.error('Failed to save parameters:', err);
      // Don't show error to user for auto-save
    }
  };

  // Save router settings changes
  const handleRouterSettingChange = async (key: keyof typeof routerSettings, value: boolean) => {
    const newSettings = { ...routerSettings, [key]: value };
    setRouterSettings(newSettings);

    try {
      const currentSettings = await getGlobalSettings(token);
      const updatedSettings: Partial<RouterSettings> = {
        ...currentSettings,
        ...newSettings
      };
      await updateGlobalSettings(updatedSettings, token);
      setLastSaved(new Date());
    } catch (err: any) {
      console.error('Failed to save router settings:', err);
    }
  };

  // Save scoring mode changes to database immediately
  useEffect(() => {
    if (isLoadingParams || !token) return; // Don't save while loading
    const timeoutId = setTimeout(async () => {
      try {
        const currentSettings = await getGlobalSettings(token);
        const updatedSettings: Partial<RouterSettings> = {
          ...currentSettings,
          metadata: {
            ...(currentSettings?.metadata || {}),
            aiRuleConfigurator: {
              parameters,
              scoringMode,
              lastUpdated: new Date().toISOString()
            }
          }
        };
        await updateGlobalSettings(updatedSettings, token);
      } catch (err) {
        console.warn('Failed to save scoring mode:', err);
      }
    }, 1000); // Save after 1 second

    return () => clearTimeout(timeoutId);
  }, [scoringMode, isLoadingParams, token]);

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Brain className="w-6 h-6 text-blue-600" />
            AI Rule Configurator
          </h3>
          <p className="text-sm text-slate-400 mt-1">
            Configure high-level parameters and let AI generate optimal routing rules
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Scoring System */}
          <div className="flex items-center gap-2 bg-white rounded-lg p-1 border border-slate-200 shadow-sm">
            <button
              onClick={() => applyScoringMode('high-performance')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors flex items-center gap-1.5 ${scoringMode === 'high-performance'
                ? 'bg-red-500/20 text-red-400 border-2 border-red-500/50'
                : 'text-slate-500 hover:text-slate-700'
                }`}
            >
              <Zap className="w-4 h-4" />
              High Performance
            </button>
            <button
              onClick={() => applyScoringMode('balance')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors flex items-center gap-1.5 ${scoringMode === 'balance'
                ? 'bg-blue-500/20 text-blue-400 border-2 border-blue-500/50'
                : 'text-slate-500 hover:text-slate-700'
                }`}
            >
              <Target className="w-4 h-4" />
              Balance
            </button>
            <button
              onClick={() => applyScoringMode('low-cost')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors flex items-center gap-1.5 ${scoringMode === 'low-cost'
                ? 'bg-emerald-500/20 text-emerald-400 border-2 border-emerald-500/50'
                : 'text-slate-500 hover:text-slate-700'
                }`}
            >
              <DollarSign className="w-4 h-4" />
              Low Cost
            </button>
            <button
              onClick={() => applyScoringMode('custom')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors flex items-center gap-1.5 ${scoringMode === 'custom'
                ? 'bg-blue-500/20 text-blue-400 border-2 border-blue-500/50'
                : 'text-slate-500 hover:text-slate-700'
                }`}
            >
              <Settings className="w-4 h-4" />
              Custom
            </button>
          </div>

          {/* AI Optimize Button - Handles optimization and saving */}
          <button
            onClick={handleAIOptimize}
            disabled={isAIOptimizing || models.length === 0}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${isAIOptimizing || isSaving
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
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors flex items-center gap-1.5 ${activeView === 'config'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
                }`}
            >
              <Settings className="w-4 h-4" />
              Config
            </button>
            <button
              onClick={() => setActiveView('hexagon')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors flex items-center gap-1.5 ${activeView === 'hexagon'
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
      <div className={`rounded-xl p-4 border-2 ${scoringMode === 'high-performance'
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
              These rules will automatically route LLM requests when conditions match. Rules are evaluated by priority (higher priority = evaluated first).
            </p>
          </div>
        )}
      </div>

      {/* Live Model Summary - What is used for what */}
      {models.filter(m => m.isEnabled && m.status === 'active').length > 0 && (
        <div className="bg-gradient-to-r from-slate-50 to-blue-50 rounded-xl border-2 border-slate-200 p-4 shadow-sm">
          <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-500" />
            🎯 AI Routing Summary - What Model Handles What
            <span className="ml-auto text-xs bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full">
              {models.filter(m => m.isEnabled && m.status === 'active').length} models active
            </span>
          </h4>

          {generatedRules.length > 0 ? (
            <div className="space-y-4">
              {/* Task Type Routing Table with Fallbacks */}
              <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                <div className="bg-slate-100 px-3 py-2 border-b border-slate-200">
                  <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">📋 Task Type Routing</span>
                </div>
                {/* Table Header */}
                <div className="grid grid-cols-4 gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500">
                  <div>Task</div>
                  <div className="text-center">🥇 Primary</div>
                  <div className="text-center">🥈 Fallback 1</div>
                  <div className="text-center">🥉 Fallback 2</div>
                </div>
                <div className="divide-y divide-slate-100">
                  {(() => {
                    // Get enabled model identifiers for STRICT filtering
                    const enabledModels = models.filter(m => m.isEnabled && m.status === 'active');

                    // Helper to extract core model name (strips prefixes)
                    const extractCoreName = (str: string) => {
                      if (!str) return '';
                      return str.toLowerCase()
                        .replace(/^models\//, '')
                        .replace(/^vertex-/, '')
                        .replace(/^openai-/, '')
                        .replace(/^anthropic-/, '')
                        .trim();
                    };

                    // Build lookup with both exact and core names
                    const enabledCoreNames = new Set(
                      enabledModels.flatMap(m => [
                        extractCoreName(m.modelIdentifier || ''),
                        extractCoreName(m.name || ''),
                        m.modelIdentifier?.toLowerCase(),
                        m.name?.toLowerCase()
                      ].filter(Boolean))
                    );

                    const isModelEnabled = (modelStr: string) => {
                      if (!modelStr || modelStr === '-') return false;
                      const modelLower = modelStr.toLowerCase();
                      const coreName = extractCoreName(modelStr);
                      return enabledCoreNames.has(modelLower) ||
                        enabledCoreNames.has(coreName) ||
                        enabledModels.some(m =>
                          extractCoreName(m.modelIdentifier || '') === coreName ||
                          extractCoreName(m.name || '') === coreName
                        );
                    };

                    // Group rules by task type, collecting primary and fallbacks
                    const taskToModels: Record<string, Array<{ model: string; priority: number; isFallback: boolean }>> = {};

                    generatedRules.forEach(rule => {
                      const model = rule.actions?.preferredModel || rule.actions?.preferredProvider || '';
                      const priority = rule.priority || 0;
                      const isFallback = rule.description?.toLowerCase().includes('fallback') || false;

                      rule.conditions?.taskTypes?.forEach((task: string) => {
                        if (!taskToModels[task]) taskToModels[task] = [];
                        taskToModels[task].push({ model, priority, isFallback });
                      });
                    });

                    // Sort each task's models: primary first (higher priority, not fallback), then fallbacks
                    // Also filter to only enabled models
                    Object.keys(taskToModels).forEach(task => {
                      taskToModels[task] = taskToModels[task]
                        .filter(m => isModelEnabled(m.model))
                        .sort((a, b) => {
                          if (a.isFallback !== b.isFallback) return a.isFallback ? 1 : -1;
                          return b.priority - a.priority;
                        });
                    });

                    const taskLabels: Record<string, string> = {
                      'code-generation': '💻 Code Gen',
                      'analysis': '🔍 Analysis',
                      'chat': '💬 Chat',
                      'documentation': '📝 Docs',
                      'creative': '🎨 Creative',
                      'structured-output': '📊 Structured',
                      'long-context': '📚 Long Context',
                      'project-preview': '🖼️ Preview'
                    };

                    return Object.entries(taskToModels)
                      .filter(([_, models]) => models.length > 0)
                      .slice(0, 8)
                      .map(([task, taskModels]) => {
                        // Show actual rule-based models (no hardcoded gap-filling)
                        const primary = taskModels[0]?.model || '-';
                        const fb1 = taskModels[1]?.model || '-';
                        const fb2 = taskModels[2]?.model || '-';

                        return (
                          <div key={task} className="grid grid-cols-4 gap-2 px-3 py-2 hover:bg-slate-50 text-sm">
                            <div className="text-slate-700 truncate">{taskLabels[task] || task}</div>
                            <div className="text-center">
                              <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-medium truncate inline-block max-w-full">
                                {primary}
                              </span>
                            </div>
                            <div className="text-center">
                              <span className={`px-2 py-0.5 rounded text-xs truncate inline-block max-w-full ${fb1 !== '-' ? 'bg-slate-100 text-slate-600' : 'text-slate-300'}`}>
                                {fb1}
                              </span>
                            </div>
                            <div className="text-center">
                              <span className={`px-2 py-0.5 rounded text-xs truncate inline-block max-w-full ${fb2 !== '-' ? 'bg-slate-100 text-slate-600' : 'text-slate-300'}`}>
                                {fb2}
                              </span>
                            </div>
                          </div>
                        );
                      });
                  })()}
                </div>
              </div>

              {/* Agent Role Routing Table with Fallbacks */}
              <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                <div className="bg-emerald-50 px-3 py-2 border-b border-slate-200">
                  <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">🤖 Agent Role Routing</span>
                </div>
                {/* Table Header */}
                <div className="grid grid-cols-4 gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500">
                  <div>Agent</div>
                  <div className="text-center">🥇 Primary</div>
                  <div className="text-center">🥈 Fallback 1</div>
                  <div className="text-center">🥉 Fallback 2</div>
                </div>
                <div className="divide-y divide-slate-100">
                  {(() => {
                    // Get enabled model identifiers for STRICT filtering
                    const enabledModels = models.filter(m => m.isEnabled && m.status === 'active');

                    // Helper to extract core model name (strips prefixes)
                    const extractCoreName = (str: string) => {
                      if (!str) return '';
                      return str.toLowerCase()
                        .replace(/^models\//, '')
                        .replace(/^vertex-/, '')
                        .replace(/^openai-/, '')
                        .replace(/^anthropic-/, '')
                        .trim();
                    };

                    // Build lookup with both exact and core names
                    const enabledCoreNames = new Set(
                      enabledModels.flatMap(m => [
                        extractCoreName(m.modelIdentifier || ''),
                        extractCoreName(m.name || ''),
                        m.modelIdentifier?.toLowerCase(),
                        m.name?.toLowerCase()
                      ].filter(Boolean))
                    );

                    const isModelEnabled = (modelStr: string) => {
                      if (!modelStr || modelStr === '-') return false;
                      const modelLower = modelStr.toLowerCase();
                      const coreName = extractCoreName(modelStr);
                      return enabledCoreNames.has(modelLower) ||
                        enabledCoreNames.has(coreName) ||
                        enabledModels.some(m =>
                          extractCoreName(m.modelIdentifier || '') === coreName ||
                          extractCoreName(m.name || '') === coreName
                        );
                    };

                    // Group rules by agent role, collecting primary and fallbacks
                    const agentToModels: Record<string, Array<{ model: string; priority: number; isFallback: boolean }>> = {};

                    generatedRules.forEach(rule => {
                      const model = rule.actions?.preferredModel || rule.actions?.preferredProvider || '';
                      const priority = rule.priority || 0;
                      const isFallback = rule.description?.toLowerCase().includes('fallback') || false;

                      rule.conditions?.agentRoles?.forEach((agent: string) => {
                        if (!agentToModels[agent]) agentToModels[agent] = [];
                        agentToModels[agent].push({ model, priority, isFallback });
                      });
                    });

                    // Sort each agent's models and filter to only enabled models
                    Object.keys(agentToModels).forEach(agent => {
                      agentToModels[agent] = agentToModels[agent]
                        .filter(m => isModelEnabled(m.model))
                        .sort((a, b) => {
                          if (a.isFallback !== b.isFallback) return a.isFallback ? 1 : -1;
                          return b.priority - a.priority;
                        });
                    });

                    return Object.entries(agentToModels)
                      .filter(([_, agentModels]) => agentModels.length > 0)
                      .slice(0, 8)
                      .map(([agent, agentModels]) => {
                        // Show actual rule-based models (no hardcoded gap-filling)
                        const primary = agentModels[0]?.model || '-';
                        const fb1 = agentModels[1]?.model || '-';
                        const fb2 = agentModels[2]?.model || '-';
                        const shortAgent = agent.replace(' Agent', '').replace('Requirements Engineer', 'Req Eng');

                        return (
                          <div key={agent} className="grid grid-cols-4 gap-2 px-3 py-2 hover:bg-slate-50 text-sm">
                            <div className="text-slate-700 truncate" title={agent}>{shortAgent}</div>
                            <div className="text-center">
                              <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-xs font-medium truncate inline-block max-w-full">
                                {primary}
                              </span>
                            </div>
                            <div className="text-center">
                              <span className={`px-2 py-0.5 rounded text-xs truncate inline-block max-w-full ${fb1 !== '-' ? 'bg-slate-100 text-slate-600' : 'text-slate-300'}`}>
                                {fb1}
                              </span>
                            </div>
                            <div className="text-center">
                              <span className={`px-2 py-0.5 rounded text-xs truncate inline-block max-w-full ${fb2 !== '-' ? 'bg-slate-100 text-slate-600' : 'text-slate-300'}`}>
                                {fb2}
                              </span>
                            </div>
                          </div>
                        );
                      });
                  })()}
                </div>
              </div>

              {/* Active Models List */}
              <div className="flex flex-wrap gap-2">
                <span className="text-xs text-slate-500">Active Models:</span>
                {models
                  .filter(m => m.isEnabled && m.status === 'active')
                  .slice(0, 6)
                  .map(m => (
                    <span key={m.id} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                      {m.name}
                    </span>
                  ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-slate-400">
              <p className="text-sm mb-2">No routing rules generated yet</p>
              <p className="text-xs">Click "AI Optimize & Save" to generate task-to-model assignments</p>
            </div>
          )}
        </div>
      )}

      {/* Router Settings Section */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <Settings className="w-4 h-4 text-blue-500" />
          Router Settings
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <label className="flex items-center gap-2 cursor-pointer bg-slate-50 rounded-lg p-3 hover:bg-slate-100 transition-colors">
            <input
              type="checkbox"
              checked={routerSettings.enabled}
              onChange={(e) => handleRouterSettingChange('enabled', e.target.checked)}
              className="w-4 h-4 text-blue-600 bg-white border-slate-300 rounded focus:ring-blue-500"
            />
            <div>
              <span className="text-sm font-medium text-slate-700">Enable Router</span>
              <p className="text-xs text-slate-400">Master switch</p>
            </div>
          </label>
          <label className="flex items-center gap-2 cursor-pointer bg-slate-50 rounded-lg p-3 hover:bg-slate-100 transition-colors">
            <input
              type="checkbox"
              checked={routerSettings.enableIntelligentRouting}
              onChange={(e) => handleRouterSettingChange('enableIntelligentRouting', e.target.checked)}
              className="w-4 h-4 text-blue-600 bg-white border-slate-300 rounded focus:ring-blue-500"
            />
            <div>
              <span className="text-sm font-medium text-slate-700">Intelligent Routing</span>
              <p className="text-xs text-slate-400">AI/ML selection</p>
            </div>
          </label>
          <label className="flex items-center gap-2 cursor-pointer bg-slate-50 rounded-lg p-3 hover:bg-slate-100 transition-colors">
            <input
              type="checkbox"
              checked={routerSettings.enableCostOptimization}
              onChange={(e) => handleRouterSettingChange('enableCostOptimization', e.target.checked)}
              className="w-4 h-4 text-blue-600 bg-white border-slate-300 rounded focus:ring-blue-500"
            />
            <div>
              <span className="text-sm font-medium text-slate-700">Cost Optimization</span>
              <p className="text-xs text-slate-400">Prefer cheaper models</p>
            </div>
          </label>
          <label className="flex items-center gap-2 cursor-pointer bg-slate-50 rounded-lg p-3 hover:bg-slate-100 transition-colors">
            <input
              type="checkbox"
              checked={routerSettings.enablePerformanceOptimization}
              onChange={(e) => handleRouterSettingChange('enablePerformanceOptimization', e.target.checked)}
              className="w-4 h-4 text-blue-600 bg-white border-slate-300 rounded focus:ring-blue-500"
            />
            <div>
              <span className="text-sm font-medium text-slate-700">Performance Opt</span>
              <p className="text-xs text-slate-400">Prefer faster models</p>
            </div>
          </label>
        </div>
      </div>

      {/* Impact Indicator */}
      {generatedRules.length > 0 && (
        <div className="bg-gradient-to-r from-emerald-500/10 to-blue-500/10 rounded-xl border-2 border-emerald-500/30 p-4">
          <div className="flex items-start gap-3">
            <div className="bg-emerald-500/20 rounded-full p-2">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-slate-800 mb-1">✓ Rules Are Active & Impacting Routing</h4>
              <p className="text-xs text-slate-600 mb-2">
                When you save rules using "AI Optimize & Save", they are immediately applied to the routing engine.
              </p>
              <div className="text-xs text-slate-600 space-y-1">
                <p>• Rules are evaluated in priority order (higher priority = checked first)</p>
                <p>• When a task matches rule conditions, the preferred model/provider is used</p>
                <p>• Rules override default routing behavior</p>
                <p>• Changes take effect immediately after saving</p>
              </div>
            </div>
          </div>
        </div>
      )}

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
        <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm">
          <h4 className="text-lg font-semibold text-slate-800 mb-6 text-center">
            Hexagonal Architecture and Rules Flow
          </h4>
          <div className="flex flex-col items-center space-y-6">
            {/* Layer 1: Configuration Parameters */}
            <div className="bg-blue-500/10 rounded-xl p-6 border-2 border-blue-500/30 w-full max-w-2xl">
              <h5 className="text-md font-semibold text-blue-300 mb-3 flex items-center gap-2">
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
              <h5 className="text-md font-semibold text-blue-600 mb-3 flex items-center gap-2">
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
              <div className="text-sm text-slate-300">
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
            <div className="bg-blue-500/10 rounded-xl p-6 border-2 border-blue-500/30 w-full max-w-2xl">
              <h5 className="text-md font-semibold text-blue-600 mb-3 flex items-center gap-2">
                <Play className="w-5 h-5" />
                Execution Layer (Router)
              </h5>
              <div className="text-sm text-slate-300">
                Rules are automatically applied to route LLM requests based on task analysis
              </div>
            </div>
          </div>
        </div>
      )}

      {activeView === 'config' ? (
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
              <Shield className="w-5 h-5 text-blue-600" />
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
              <Settings className="w-5 h-5 text-blue-600" />
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

          {/* Prototype & UI/UX Parameters */}
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
            <h4 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-500" />
              Prototype & UI/UX
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <ParameterSlider
                label="Prototype Quality"
                value={parameters.prototypeQuality}
                onChange={(v) => handleParameterChange('prototypeQuality', v)}
                icon={<Target className="w-4 h-4" />}
                description="Quality of generated prototypes"
              />
              <ParameterSlider
                label="UI/UX Design"
                value={parameters.uiUxDesign}
                onChange={(v) => handleParameterChange('uiUxDesign', v)}
                icon={<Layers className="w-4 h-4" />}
                description="Priority for UI/UX design tasks"
              />
              <ParameterSlider
                label="Visual Design"
                value={parameters.visualDesign}
                onChange={(v) => handleParameterChange('visualDesign', v)}
                icon={<Eye className="w-4 h-4" />}
                description="Emphasis on visual aesthetics"
              />
              <ParameterSlider
                label="Wireframe Generation"
                value={parameters.wireframeGeneration}
                onChange={(v) => handleParameterChange('wireframeGeneration', v)}
                icon={<BarChart3 className="w-4 h-4" />}
                description="Quality of architecture diagrams"
              />
            </div>
          </div>

          {/* Build Phase (Workspace) Parameters */}
          <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl p-6 border-2 border-orange-200 shadow-sm">
            <h4 className="text-lg font-semibold text-slate-800 mb-2 flex items-center gap-2">
              <Cpu className="w-5 h-5 text-orange-500" />
              🔨 Build Phase (Workspace)
            </h4>
            <p className="text-xs text-slate-500 mb-4">Controls for implementation, testing, QA, and deployment</p>

            {/* Implementation & Testing */}
            <div className="mb-4">
              <h5 className="text-sm font-medium text-slate-600 mb-3 flex items-center gap-2">
                <Code className="w-4 h-4 text-blue-500" />
                Testing & QA Agents
              </h5>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <ParameterSlider
                  label="Test Agent"
                  value={parameters.testAgent}
                  onChange={(v) => handleParameterChange('testAgent', v)}
                  icon={<CheckCircle className="w-4 h-4" />}
                  description="Testing quality priority"
                />
                <ParameterSlider
                  label="QA Agent"
                  value={parameters.qaAgent}
                  onChange={(v) => handleParameterChange('qaAgent', v)}
                  icon={<ShieldCheck className="w-4 h-4" />}
                  description="QA/Audit thoroughness"
                />
                <ParameterSlider
                  label="Integration Agent"
                  value={parameters.integrationAgent}
                  onChange={(v) => handleParameterChange('integrationAgent', v)}
                  icon={<GitBranch className="w-4 h-4" />}
                  description="Integration quality priority"
                />
              </div>
            </div>

            {/* Bug Fixing & Security */}
            <div>
              <h5 className="text-sm font-medium text-slate-600 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                Bug Fixing & Security
              </h5>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <ParameterSlider
                  label="Remediation Agent"
                  value={parameters.remediationAgent}
                  onChange={(v) => handleParameterChange('remediationAgent', v)}
                  icon={<Wrench className="w-4 h-4" />}
                  description="Bug fixing priority"
                />
                <ParameterSlider
                  label="Bug Detection"
                  value={parameters.bugDetection}
                  onChange={(v) => handleParameterChange('bugDetection', v)}
                  icon={<Bug className="w-4 h-4" />}
                  description="Detection sensitivity"
                />
                <ParameterSlider
                  label="Code Review"
                  value={parameters.codeReviewQuality}
                  onChange={(v) => handleParameterChange('codeReviewQuality', v)}
                  icon={<Eye className="w-4 h-4" />}
                  description="Review thoroughness"
                />
                <ParameterSlider
                  label="Security Priority"
                  value={parameters.securityPriority}
                  onChange={(v) => handleParameterChange('securityPriority', v)}
                  icon={<LockIcon className="w-4 h-4" />}
                  description="Security scanning priority"
                />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-lg font-semibold text-white">
              Generated Rules ({generatedRules.length})
            </h4>
            {isGenerating && (
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <RefreshCw className="w-4 h-4 animate-spin" />
                AI is generating rules...
              </div>
            )}
          </div>
          {generatedRules.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Brain className="w-12 h-12 mx-auto mb-4 text-slate-500" />
              <p>Adjust parameters above to generate rules</p>
              <p className="text-xs mt-2 text-slate-500">Rules will automatically affect routing decisions when saved</p>
            </div>
          ) : (
            <div className="space-y-3">
              {generatedRules.map((rule, idx) => (
                <div
                  key={idx}
                  className="bg-slate-800/50 rounded-xl border border-slate-700 p-4 hover:border-slate-600 transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-medium text-white">{rule.name}</span>
                        <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded">
                          Priority: {rule.priority}
                        </span>
                        {rule.enabled && (
                          <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded">
                            ✓ Active
                          </span>
                        )}
                        <span className="text-xs bg-blue-500/20 text-blue-600 px-2 py-1 rounded flex items-center gap-1">
                          <Zap className="w-3 h-3" />
                          Affects Routing
                        </span>
                      </div>
                      {rule.description && (
                        <p className="text-sm text-slate-400 mb-3">{rule.description}</p>
                      )}
                      <div className="mb-2">
                        <p className="text-xs font-medium text-slate-400 mb-1">When:</p>
                        <div className="flex flex-wrap gap-2">
                          {rule.conditions?.taskTypes?.map((type: string) => (
                            <span key={type} className="text-xs bg-blue-500/20 text-blue-600 px-2 py-1 rounded">
                              Task: {type.replace(/-/g, ' ')}
                            </span>
                          ))}
                          {rule.conditions?.agentRoles?.map((role: string) => (
                            <span key={role} className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded">
                              Role: {role}
                            </span>
                          ))}
                          {rule.conditions?.complexity?.map((comp: string) => (
                            <span key={comp} className="text-xs bg-blue-500/20 text-blue-600 px-2 py-1 rounded">
                              Complexity: {comp}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-400 mb-1">Then:</p>
                        <div className="flex flex-wrap gap-2">
                          {rule.actions?.preferredProvider && (
                            <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded">
                              → Use {rule.actions.preferredProvider}
                            </span>
                          )}
                          {rule.actions?.preferredModel && (
                            <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded">
                              → Model: {models.find(m => m.id === rule.actions?.preferredModel)?.name || rule.actions.preferredModel}
                            </span>
                          )}
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
                        className="p-2 text-blue-600 hover:bg-blue-500/10 rounded transition-colors"
                        title="View Rule Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onEditRule(rule)}
                        className="p-2 text-orange-400 hover:bg-orange-500/10 rounded transition-colors"
                        title="Edit Rule"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onTestRule(rule)}
                        className="p-2 text-blue-400 hover:bg-blue-500/10 rounded transition-colors"
                        title="Test Rule - Simulates rule against sample tasks"
                      >
                        <Play className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
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
                  {viewingRule.actions?.preferredProvider && (
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-medium text-emerald-400">Preferred Provider:</span>
                      <span className="text-sm font-medium text-emerald-300 bg-emerald-500/20 px-2 py-1 rounded">
                        {viewingRule.actions.preferredProvider}
                      </span>
                    </div>
                  )}
                  {viewingRule.actions?.preferredModel && (
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-medium text-emerald-400">Preferred Model:</span>
                      <span className="text-sm font-medium text-emerald-300 bg-emerald-500/20 px-2 py-1 rounded">
                        {models.find(m => m.id === viewingRule.actions?.preferredModel)?.name || viewingRule.actions.preferredModel}
                      </span>
                    </div>
                  )}
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
                  {viewingRule.actions?.blockedProviders && viewingRule.actions.blockedProviders.length > 0 && (
                    <div>
                      <span className="text-xs font-medium text-emerald-400">Blocked Providers:</span>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {viewingRule.actions.blockedProviders.map((provider: string) => (
                          <span key={provider} className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded">
                            {provider}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {viewingRule.actions?.blockedModels && viewingRule.actions.blockedModels.length > 0 && (
                    <div>
                      <span className="text-xs font-medium text-emerald-400">Blocked Models:</span>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {viewingRule.actions.blockedModels.map((modelId: string) => (
                          <span key={modelId} className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded">
                            {models.find(m => m.id === modelId)?.name || modelId}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Help Text */}
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <Info className="w-5 h-5 text-yellow-400 mt-0.5" />
                  <div className="text-sm text-yellow-300">
                    <p className="font-semibold mb-1">About Rule Actions:</p>
                    <ul className="list-disc list-inside space-y-1 text-xs text-yellow-400/80">
                      <li><strong>Test Button:</strong> Simulates this rule against sample tasks to see which model would be selected</li>
                      <li><strong>Edit Button:</strong> Opens edit modal to manually modify rule properties. Changes are saved when you click "Save Changes" in the edit modal</li>
                      <li><strong>Priority:</strong> Higher priority rules are evaluated first. If multiple rules match, the highest priority rule wins</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-slate-800 border-t border-slate-700 px-6 py-4 flex justify-end gap-2">
              <button
                onClick={() => {
                  onEditRule(viewingRule);
                  setViewingRule(null);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Edit Rule
              </button>
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

      {/* Edit Rule Modal */}
      {editingRule && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-700">
            <div className="sticky top-0 bg-slate-900 border-b border-slate-700 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">Edit Rule</h3>
              <button
                onClick={() => onEditRule(null)}
                className="p-2 text-slate-400 hover:text-white rounded transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Rule Name */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Rule Name</label>
                <input
                  type="text"
                  value={editingRule.name || ''}
                  onChange={(e) => onEditRule({ ...editingRule, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Priority */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Priority: <span className="text-blue-400">{editingRule.priority}</span>
                </label>
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={editingRule.priority || 10}
                  onChange={(e) => onEditRule({ ...editingRule, priority: parseInt(e.target.value) })}
                  className="w-full accent-blue-500"
                />
                <p className="text-xs text-slate-500 mt-1">Higher priority rules are evaluated first</p>
              </div>

              {/* Enabled Toggle */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="enabled"
                  checked={editingRule.enabled ?? true}
                  onChange={(e) => onEditRule({ ...editingRule, enabled: e.target.checked })}
                  className="w-4 h-4 text-blue-500 bg-slate-700 border-slate-600 rounded focus:ring-blue-500 focus:ring-offset-slate-800"
                />
                <label htmlFor="enabled" className="text-sm font-medium text-slate-300">
                  Rule Enabled
                </label>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Description</label>
                <textarea
                  value={editingRule.description || ''}
                  onChange={(e) => onEditRule({ ...editingRule, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={2}
                />
              </div>

              {/* Conditions */}
              <div className="border-t border-slate-700 pt-4">
                <h4 className="text-sm font-semibold text-slate-300 mb-3">Conditions (When this rule applies)</h4>

                {/* Task Types */}
                <div className="mb-3">
                  <label className="block text-xs font-medium text-slate-400 mb-1">Task Types</label>
                  <div className="flex flex-wrap gap-2">
                    {['chat', 'conversation', 'code-generation', 'documentation', 'analysis', 'creative', 'writing', 'simple-tasks', 'long-context', 'structured-output'].map((type) => {
                      const isSelected = editingRule.conditions?.taskTypes?.includes(type);
                      return (
                        <button
                          key={type}
                          onClick={() => {
                            const currentTypes = editingRule.conditions?.taskTypes || [];
                            const newTypes = isSelected
                              ? currentTypes.filter(t => t !== type)
                              : [...currentTypes, type];
                            onEditRule({
                              ...editingRule,
                              conditions: {
                                ...editingRule.conditions,
                                taskTypes: newTypes.length > 0 ? newTypes : undefined
                              }
                            });
                          }}
                          className={`text-xs px-2 py-1 rounded transition-colors ${isSelected
                            ? 'bg-blue-500/20 text-blue-600 border border-blue-500/50'
                            : 'bg-slate-700 text-slate-400 border border-slate-600 hover:bg-slate-600'
                            }`}
                        >
                          {type.replace(/-/g, ' ')}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Agent Roles */}
                <div className="mb-3">
                  <label className="block text-xs font-medium text-slate-400 mb-1">Agent Roles</label>
                  <div className="flex flex-wrap gap-2">
                    {['Orchestrator', 'Implementation Agent', 'Requirements Agent', 'UX Designer', 'QA Agent', 'Audit Agent', 'Design Agent'].map((role) => {
                      const isSelected = editingRule.conditions?.agentRoles?.includes(role);
                      return (
                        <button
                          key={role}
                          onClick={() => {
                            const currentRoles = editingRule.conditions?.agentRoles || [];
                            const newRoles = isSelected
                              ? currentRoles.filter(r => r !== role)
                              : [...currentRoles, role];
                            onEditRule({
                              ...editingRule,
                              conditions: {
                                ...editingRule.conditions,
                                agentRoles: newRoles.length > 0 ? newRoles : undefined
                              }
                            });
                          }}
                          className={`text-xs px-2 py-1 rounded transition-colors ${isSelected
                            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50'
                            : 'bg-slate-700 text-slate-400 border border-slate-600 hover:bg-slate-600'
                            }`}
                        >
                          {role}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Complexity */}
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Complexity</label>
                  <div className="flex flex-wrap gap-2">
                    {['simple', 'moderate', 'complex'].map((comp) => {
                      const isSelected = editingRule.conditions?.complexity?.includes(comp as any);
                      return (
                        <button
                          key={comp}
                          onClick={() => {
                            const currentComplexity = editingRule.conditions?.complexity || [];
                            const newComplexity = isSelected
                              ? currentComplexity.filter(c => c !== comp)
                              : [...currentComplexity, comp as any];
                            onEditRule({
                              ...editingRule,
                              conditions: {
                                ...editingRule.conditions,
                                complexity: newComplexity.length > 0 ? newComplexity : undefined
                              }
                            });
                          }}
                          className={`text-xs px-2 py-1 rounded transition-colors ${isSelected
                            ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/50'
                            : 'bg-slate-700 text-slate-400 border border-slate-600 hover:bg-slate-600'
                            }`}
                        >
                          {comp}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="border-t border-slate-700 pt-4">
                <h4 className="text-sm font-semibold text-slate-300 mb-3">Actions (What this rule does)</h4>

                {/* Preferred Provider */}
                <div className="mb-3">
                  <label className="block text-xs font-medium text-slate-400 mb-1">Preferred Provider</label>
                  <select
                    value={editingRule.actions?.preferredProvider || ''}
                    onChange={(e) => onEditRule({
                      ...editingRule,
                      actions: {
                        ...editingRule.actions,
                        preferredProvider: e.target.value || undefined
                      }
                    })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">None</option>
                    {['openai', 'anthropic', 'gemini', 'groq', 'deepseek', 'mistral', 'qwen'].map(provider => (
                      <option key={provider} value={provider}>{provider}</option>
                    ))}
                  </select>
                </div>

                {/* Preferred Model */}
                <div className="mb-3">
                  <label className="block text-xs font-medium text-slate-400 mb-1">Preferred Model</label>
                  <select
                    value={editingRule.actions?.preferredModel || ''}
                    onChange={(e) => onEditRule({
                      ...editingRule,
                      actions: {
                        ...editingRule.actions,
                        preferredModel: e.target.value || undefined
                      }
                    })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">None</option>
                    {models.filter(m => m.isEnabled && m.status === 'active').map(model => (
                      <option key={model.id} value={model.id}>{model.name} ({model.provider})</option>
                    ))}
                  </select>
                </div>

                {/* Cost Preference */}
                <div className="mb-3">
                  <label className="block text-xs font-medium text-slate-400 mb-1">Cost Preference</label>
                  <select
                    value={editingRule.actions?.costPreference || 'balanced'}
                    onChange={(e) => onEditRule({
                      ...editingRule,
                      actions: {
                        ...editingRule.actions,
                        costPreference: e.target.value as 'low' | 'balanced' | 'quality'
                      }
                    })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="low">Low Cost</option>
                    <option value="balanced">Balanced</option>
                    <option value="quality">Quality</option>
                  </select>
                </div>

                {/* Max Latency */}
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Max Latency (ms) {editingRule.actions?.maxLatency && <span className="text-blue-400">: {editingRule.actions.maxLatency}</span>}
                  </label>
                  <input
                    type="number"
                    value={editingRule.actions?.maxLatency || ''}
                    onChange={(e) => onEditRule({
                      ...editingRule,
                      actions: {
                        ...editingRule.actions,
                        maxLatency: e.target.value ? parseInt(e.target.value) : undefined
                      }
                    })}
                    placeholder="Optional"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-slate-800 border-t border-slate-700 px-6 py-4 flex justify-end gap-2">
              <button
                onClick={() => onEditRule(null)}
                className="px-4 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  try {
                    await onSaveRule(editingRule);
                    onEditRule(null);
                    showAlert('Rule saved to database successfully', 'success');
                  } catch (err: any) {
                    showAlert('Failed to save rule: ' + err.message, 'error');
                  }
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIRuleConfigurator;

