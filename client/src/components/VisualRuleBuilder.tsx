/**
 * Visual Rule Builder Component
 * AI-powered, visual interface for creating and managing routing rules
 */

import React, { useState, useEffect } from 'react';
import {
  Sparkles, Wand2, Zap, Target, Filter, ArrowRight, Plus, X,
  CheckCircle, AlertTriangle, Lightbulb, TrendingUp, Settings,
  Play, Save, Trash2, Edit2, Copy, Eye, ChevronDown, ChevronUp
} from 'lucide-react';
import { RoutingRule } from '../services/adminLLMRouterApi';
import { showAlert } from '../utils/browserUtils';
import { getLLMModels, LLMModel } from '../services/adminApiExtended';

interface VisualRuleBuilderProps {
  rules: RoutingRule[];
  editingRule: RoutingRule | null;
  onEditRule: (rule: RoutingRule | null) => void;
  onSaveRule: (rule: RoutingRule) => void;
  onDeleteRule: (ruleId: string) => void;
  onTestRule: (rule: RoutingRule) => void;
  token?: string;
}

type BuilderStep = 'start' | 'conditions' | 'actions' | 'review';

const VisualRuleBuilder: React.FC<VisualRuleBuilderProps> = ({
  rules,
  editingRule,
  onEditRule,
  onSaveRule,
  onDeleteRule,
  onTestRule,
  token
}) => {
  const [currentStep, setCurrentStep] = useState<BuilderStep>('start');
  const [ruleBuilder, setRuleBuilder] = useState<Partial<RoutingRule>>({
    name: '',
    priority: 0,
    enabled: true,
    conditions: {},
    actions: {},
    description: ''
  });
  const [models, setModels] = useState<LLMModel[]>([]);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [aiInput, setAiInput] = useState('');
  const [generating, setGenerating] = useState(false);
  const [selectedRule, setSelectedRule] = useState<RoutingRule | null>(null);
  const [viewMode, setViewMode] = useState<'visual' | 'list'>('visual');

  useEffect(() => {
    if (token) {
      loadModels();
    }
  }, [token]);

  useEffect(() => {
    if (editingRule) {
      setRuleBuilder(editingRule);
      setCurrentStep('conditions');
    } else {
      resetBuilder();
    }
  }, [editingRule]);

  const loadModels = async () => {
    if (!token) return;
    try {
      const data = await getLLMModels(token);
      setModels(data.models.filter(m => m.status === 'active'));
    } catch (err: any) {
      // Silently fail
    }
  };

  const resetBuilder = () => {
    setRuleBuilder({
      name: '',
      priority: 0,
      enabled: true,
      conditions: {},
      actions: {},
      description: ''
    });
    setCurrentStep('start');
    setSelectedRule(null);
  };

  const handleAIGenerate = async () => {
    if (!aiInput.trim()) {
      showAlert('Please enter a description', 'error');
      return;
    }

    setGenerating(true);
    try {
      // Simulate AI generation - in real implementation, call API
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Parse AI input and suggest rule structure
      const suggestions = [
        `Based on "${aiInput}", I suggest creating a rule that:`,
        `- Matches tasks with specific characteristics`,
        `- Routes to optimized models`,
        `- Considers cost and performance`
      ];
      setAiSuggestions(suggestions);
      
      // Auto-populate builder with AI suggestions
      const suggestedRule: Partial<RoutingRule> = {
        name: `AI Generated: ${aiInput.substring(0, 30)}...`,
        description: `Generated from: ${aiInput}`,
        priority: 50,
        enabled: true,
        conditions: {
          taskTypes: aiInput.toLowerCase().includes('chat') ? ['chat'] : [],
          complexity: aiInput.toLowerCase().includes('simple') ? ['simple'] : []
        },
        actions: {
          costPreference: aiInput.toLowerCase().includes('cheap') ? 'low' : 'balanced'
        }
      };
      
      setRuleBuilder(suggestedRule);
      setCurrentStep('conditions');
      showAlert('Rule structure generated! Review and adjust as needed.', 'success');
    } catch (err: any) {
      showAlert('Failed to generate rule: ' + err.message, 'error');
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = () => {
    if (!ruleBuilder.name) {
      showAlert('Rule name is required', 'error');
      return;
    }

    const ruleToSave: RoutingRule = {
      ...(editingRule?._id && { _id: editingRule._id }),
      name: ruleBuilder.name!,
      priority: ruleBuilder.priority || 0,
      enabled: ruleBuilder.enabled !== undefined ? ruleBuilder.enabled : true,
      conditions: ruleBuilder.conditions || {},
      actions: ruleBuilder.actions || {},
      description: ruleBuilder.description
    };

    onSaveRule(ruleToSave);
    resetBuilder();
    showAlert('Rule saved successfully!', 'success');
  };

  const addCondition = (type: string, value: any) => {
    setRuleBuilder(prev => ({
      ...prev,
      conditions: {
        ...prev.conditions,
        [type]: Array.isArray(prev.conditions?.[type as keyof typeof prev.conditions])
          ? [...(prev.conditions[type as keyof typeof prev.conditions] as any[]), value]
          : [value]
      }
    }));
  };

  const removeCondition = (type: string, value: any) => {
    setRuleBuilder(prev => ({
      ...prev,
      conditions: {
        ...prev.conditions,
        [type]: Array.isArray(prev.conditions?.[type as keyof typeof prev.conditions])
          ? (prev.conditions[type as keyof typeof prev.conditions] as any[]).filter(v => v !== value)
          : []
      }
    }));
  };

  return (
    <div className="space-y-6">
      {/* Header with AI Assistant */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Target className="w-6 h-6 text-blue-600" />
            Visual Rule Builder
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Create routing rules visually with AI assistance
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode(viewMode === 'visual' ? 'list' : 'visual')}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            {viewMode === 'visual' ? 'List View' : 'Visual Builder'}
          </button>
          <button
            onClick={() => setShowAIPanel(!showAIPanel)}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
              showAIPanel
                ? 'bg-purple-600 text-white'
                : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            AI Assistant
          </button>
        </div>
      </div>

      {/* AI Assistant Panel */}
      {showAIPanel && (
        <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg border-2 border-purple-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Wand2 className="text-purple-600" size={20} />
            <h4 className="text-md font-semibold text-gray-900">AI Rule Generator</h4>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Describe your routing rule in natural language:
              </label>
              <textarea
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                placeholder="e.g., Route all code generation tasks to GPT-4 when cost is not a concern"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                rows={3}
              />
            </div>
            <button
              onClick={handleAIGenerate}
              disabled={generating || !aiInput.trim()}
              className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {generating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate Rule
                </>
              )}
            </button>
            {aiSuggestions.length > 0 && (
              <div className="mt-4 p-4 bg-white rounded-lg border border-purple-200">
                <h5 className="text-sm font-semibold text-gray-900 mb-2">AI Suggestions:</h5>
                <ul className="space-y-1 text-sm text-gray-700">
                  {aiSuggestions.map((suggestion, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <Lightbulb className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                      {suggestion}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Visual Builder */}
      {viewMode === 'visual' && (
        <div className="space-y-6">
          {/* Step Indicator */}
          <div className="flex items-center justify-between">
            {(['start', 'conditions', 'actions', 'review'] as BuilderStep[]).map((step, idx) => (
              <React.Fragment key={step}>
                <button
                  onClick={() => setCurrentStep(step)}
                  className={`flex flex-col items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                    currentStep === step
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    currentStep === step
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-500'
                  }`}>
                    {idx + 1}
                  </div>
                  <span className="text-xs font-medium capitalize">{step}</span>
                </button>
                {idx < 3 && (
                  <div className={`flex-1 h-0.5 ${
                    ['start', 'conditions', 'actions'].indexOf(currentStep) >= idx
                      ? 'bg-blue-600'
                      : 'bg-gray-200'
                  }`} />
                )}
              </React.Fragment>
            ))}
          </div>

          {/* Step Content */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            {currentStep === 'start' && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Rule Name *
                  </label>
                  <input
                    type="text"
                    value={ruleBuilder.name || ''}
                    onChange={(e) => setRuleBuilder({ ...ruleBuilder, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Fast Chat Responses"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={ruleBuilder.description || ''}
                    onChange={(e) => setRuleBuilder({ ...ruleBuilder, description: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    placeholder="Describe what this rule does..."
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Priority
                    </label>
                    <input
                      type="number"
                      value={ruleBuilder.priority || 0}
                      onChange={(e) => setRuleBuilder({ ...ruleBuilder, priority: parseInt(e.target.value) || 0 })}
                      className="w-32 px-4 py-2 border border-gray-300 rounded-lg"
                      min="0"
                      max="100"
                    />
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={ruleBuilder.enabled !== undefined ? ruleBuilder.enabled : true}
                      onChange={(e) => setRuleBuilder({ ...ruleBuilder, enabled: e.target.checked })}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                    />
                    <span className="text-sm font-medium text-gray-700">Enabled</span>
                  </label>
                </div>
                <button
                  onClick={() => setCurrentStep('conditions')}
                  disabled={!ruleBuilder.name}
                  className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  Next: Define Conditions
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {currentStep === 'conditions' && (
              <div className="space-y-6">
                <div className="flex items-center gap-2 mb-4">
                  <Filter className="w-5 h-5 text-blue-600" />
                  <h4 className="text-lg font-semibold text-gray-900">When should this rule apply?</h4>
                </div>
                
                {/* Visual Condition Builder */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Task Types */}
                  <div className="p-4 border border-gray-200 rounded-lg">
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Task Types
                    </label>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {['chat', 'conversation', 'code-generation', 'documentation', 'analysis', 'creative', 'prompt-enhancement', 'project-preview', 'structured-output', 'long-context', 'writing', 'simple-tasks'].map(type => {
                        const isSelected = (ruleBuilder.conditions?.taskTypes || []).includes(type);
                        return (
                          <button
                            key={type}
                            onClick={() => {
                              if (isSelected) {
                                removeCondition('taskTypes', type);
                              } else {
                                addCondition('taskTypes', type);
                              }
                            }}
                            className={`w-full px-3 py-2 text-left text-sm rounded-lg transition-colors ${
                              isSelected
                                ? 'bg-blue-100 text-blue-700 border-2 border-blue-500'
                                : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border-2 border-transparent'
                            }`}
                          >
                            {type.replace(/-/g, ' ')}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Agent Roles */}
                  <div className="p-4 border border-gray-200 rounded-lg">
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Agent Roles
                    </label>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {['Orchestrator', 'Requirements Agent', 'UI/UX Designer', 'QA/Audit Agent', 'Design/Architecture Agent', 'Test Requirements Engineer', 'Implementation Agent', 'Integration Agent', 'Test Agent', 'Remediation/Bug Agent'].map(role => {
                        const isSelected = (ruleBuilder.conditions?.agentRoles || []).includes(role);
                        return (
                          <button
                            key={role}
                            onClick={() => {
                              if (isSelected) {
                                removeCondition('agentRoles', role);
                              } else {
                                addCondition('agentRoles', role);
                              }
                            }}
                            className={`w-full px-3 py-2 text-left text-sm rounded-lg transition-colors ${
                              isSelected
                                ? 'bg-blue-100 text-blue-700 border-2 border-blue-500'
                                : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border-2 border-transparent'
                            }`}
                          >
                            {role}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Complexity and Token Ranges */}
                <div className="grid grid-cols-3 gap-4 mt-4">
                  <div className="p-4 border border-gray-200 rounded-lg">
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Complexity
                    </label>
                    <div className="space-y-2">
                      {(['simple', 'moderate', 'complex'] as const).map(complexity => {
                        const isSelected = (ruleBuilder.conditions?.complexity || []).includes(complexity);
                        return (
                          <button
                            key={complexity}
                            onClick={() => {
                              if (isSelected) {
                                removeCondition('complexity', complexity);
                              } else {
                                addCondition('complexity', complexity);
                              }
                            }}
                            className={`w-full px-3 py-2 text-sm rounded-lg transition-colors ${
                              isSelected
                                ? 'bg-purple-100 text-purple-700 border-2 border-purple-500'
                                : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border-2 border-transparent'
                            }`}
                          >
                            {complexity.charAt(0).toUpperCase() + complexity.slice(1)}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="p-4 border border-gray-200 rounded-lg">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Min Tokens
                    </label>
                    <input
                      type="number"
                      value={ruleBuilder.conditions?.minTokens || ''}
                      onChange={(e) => setRuleBuilder({
                        ...ruleBuilder,
                        conditions: {
                          ...ruleBuilder.conditions,
                          minTokens: e.target.value ? parseInt(e.target.value) : undefined
                        }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="Optional"
                    />
                  </div>

                  <div className="p-4 border border-gray-200 rounded-lg">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Max Tokens
                    </label>
                    <input
                      type="number"
                      value={ruleBuilder.conditions?.maxTokens || ''}
                      onChange={(e) => setRuleBuilder({
                        ...ruleBuilder,
                        conditions: {
                          ...ruleBuilder.conditions,
                          maxTokens: e.target.value ? parseInt(e.target.value) : undefined
                        }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="Optional"
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentStep('start')}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => setCurrentStep('actions')}
                    className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                  >
                    Next: Define Actions
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {currentStep === 'actions' && (
              <div className="space-y-6">
                <div className="flex items-center gap-2 mb-4">
                  <Zap className="w-5 h-5 text-green-600" />
                  <h4 className="text-lg font-semibold text-gray-900">What should happen when conditions match?</h4>
                </div>

                {/* Visual Action Builder */}
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 border border-gray-200 rounded-lg">
                      <label className="block text-sm font-medium text-gray-700 mb-3">
                        Preferred Model
                      </label>
                      <select
                        value={ruleBuilder.actions?.preferredModel || ''}
                        onChange={(e) => setRuleBuilder({
                          ...ruleBuilder,
                          actions: { ...ruleBuilder.actions, preferredModel: e.target.value || undefined }
                        })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      >
                        <option value="">Select a model...</option>
                        {models.map(model => (
                          <option key={model.id} value={model.id}>
                            {model.name} ({model.provider})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="p-4 border border-gray-200 rounded-lg">
                      <label className="block text-sm font-medium text-gray-700 mb-3">
                        Preferred Provider
                      </label>
                      <select
                        value={ruleBuilder.actions?.preferredProvider || ''}
                        onChange={(e) => setRuleBuilder({
                          ...ruleBuilder,
                          actions: { ...ruleBuilder.actions, preferredProvider: e.target.value || undefined }
                        })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      >
                        <option value="">None</option>
                        <option value="gemini">Gemini</option>
                        <option value="openai">OpenAI</option>
                        <option value="anthropic">Anthropic</option>
                        <option value="deepseek">DeepSeek</option>
                        <option value="grok">Grok</option>
                        <option value="groq">Groq</option>
                        <option value="mistral">Mistral</option>
                      </select>
                    </div>
                  </div>

                  <div className="p-4 border border-gray-200 rounded-lg">
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Cost Preference
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['low', 'balanced', 'quality'] as const).map(pref => (
                        <button
                          key={pref}
                          onClick={() => setRuleBuilder({
                            ...ruleBuilder,
                            actions: { ...ruleBuilder.actions, costPreference: pref }
                          })}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            ruleBuilder.actions?.costPreference === pref
                              ? 'bg-green-100 text-green-700 border-2 border-green-500'
                              : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border-2 border-transparent'
                          }`}
                        >
                          {pref.charAt(0).toUpperCase() + pref.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 border border-gray-200 rounded-lg">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Max Latency (ms)
                      </label>
                      <input
                        type="number"
                        value={ruleBuilder.actions?.maxLatency || ''}
                        onChange={(e) => setRuleBuilder({
                          ...ruleBuilder,
                          actions: {
                            ...ruleBuilder.actions,
                            maxLatency: e.target.value ? parseInt(e.target.value) : undefined
                          }
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        placeholder="Optional"
                      />
                    </div>

                    <div className="p-4 border border-gray-200 rounded-lg">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Cost Limit ($)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={ruleBuilder.actions?.costLimit || ''}
                        onChange={(e) => setRuleBuilder({
                          ...ruleBuilder,
                          actions: {
                            ...ruleBuilder.actions,
                            costLimit: e.target.value ? parseFloat(e.target.value) : undefined
                          }
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        placeholder="Optional"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentStep('conditions')}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => setCurrentStep('review')}
                    className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                  >
                    Review Rule
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {currentStep === 'review' && (
              <div className="space-y-6">
                <div className="flex items-center gap-2 mb-4">
                  <Eye className="w-5 h-5 text-purple-600" />
                  <h4 className="text-lg font-semibold text-gray-900">Review Your Rule</h4>
                </div>

                {/* Rule Preview */}
                <div className="bg-gray-50 rounded-lg p-6 space-y-4">
                  <div>
                    <h5 className="text-sm font-semibold text-gray-700 mb-2">Rule Name</h5>
                    <p className="text-gray-900">{ruleBuilder.name || 'Untitled Rule'}</p>
                  </div>
                  <div>
                    <h5 className="text-sm font-semibold text-gray-700 mb-2">Conditions</h5>
                    <div className="flex flex-wrap gap-2">
                      {(ruleBuilder.conditions?.taskTypes || []).map((type: string) => (
                        <span key={type} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                          Task: {type.replace(/-/g, ' ')}
                        </span>
                      ))}
                      {(ruleBuilder.conditions?.agentRoles || []).map((role: string) => (
                        <span key={role} className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm">
                          Role: {role}
                        </span>
                      ))}
                      {(ruleBuilder.conditions?.complexity || []).map((complexity: string) => (
                        <span key={complexity} className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm">
                          Complexity: {complexity}
                        </span>
                      ))}
                      {ruleBuilder.conditions?.minTokens && (
                        <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm">
                          Min Tokens: {ruleBuilder.conditions.minTokens}
                        </span>
                      )}
                      {ruleBuilder.conditions?.maxTokens && (
                        <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm">
                          Max Tokens: {ruleBuilder.conditions.maxTokens}
                        </span>
                      )}
                      {(!ruleBuilder.conditions?.taskTypes?.length && 
                        !ruleBuilder.conditions?.agentRoles?.length && 
                        !ruleBuilder.conditions?.complexity?.length &&
                        !ruleBuilder.conditions?.minTokens &&
                        !ruleBuilder.conditions?.maxTokens) && (
                        <span className="text-gray-400 italic text-sm">No conditions specified (will match all)</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <h5 className="text-sm font-semibold text-gray-700 mb-2">Actions</h5>
                    <div className="space-y-2">
                      {ruleBuilder.actions?.preferredModel && (
                        <div className="flex items-center gap-2">
                          <Zap className="w-4 h-4 text-green-600" />
                          <span className="text-gray-900">Preferred Model: <strong>{models.find(m => m.id === ruleBuilder.actions?.preferredModel)?.name || ruleBuilder.actions.preferredModel}</strong></span>
                        </div>
                      )}
                      {ruleBuilder.actions?.preferredProvider && (
                        <div className="flex items-center gap-2">
                          <Settings className="w-4 h-4 text-blue-600" />
                          <span className="text-gray-900">Preferred Provider: <strong>{ruleBuilder.actions.preferredProvider}</strong></span>
                        </div>
                      )}
                      {ruleBuilder.actions?.costPreference && (
                        <div className="flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-green-600" />
                          <span className="text-gray-900">Cost Preference: <strong>{ruleBuilder.actions.costPreference}</strong></span>
                        </div>
                      )}
                      {ruleBuilder.actions?.maxLatency && (
                        <div className="flex items-center gap-2">
                          <Zap className="w-4 h-4 text-yellow-600" />
                          <span className="text-gray-900">Max Latency: <strong>{ruleBuilder.actions.maxLatency}ms</strong></span>
                        </div>
                      )}
                      {ruleBuilder.actions?.costLimit && (
                        <div className="flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-red-600" />
                          <span className="text-gray-900">Cost Limit: <strong>${ruleBuilder.actions.costLimit}</strong></span>
                        </div>
                      )}
                      {(!ruleBuilder.actions?.preferredModel && 
                        !ruleBuilder.actions?.preferredProvider && 
                        !ruleBuilder.actions?.costPreference &&
                        !ruleBuilder.actions?.maxLatency &&
                        !ruleBuilder.actions?.costLimit) && (
                        <span className="text-gray-400 italic text-sm">No actions specified (will use default routing)</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentStep('actions')}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleSave}
                    className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    Save Rule
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div className="space-y-2">
          {rules.map((rule) => (
            <div
              key={rule._id}
              className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-gray-900">{rule.name}</span>
                    <span className="text-xs text-gray-500">Priority: {rule.priority}</span>
                    {rule.enabled ? (
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Enabled</span>
                    ) : (
                      <span className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded">Disabled</span>
                    )}
                  </div>
                  {rule.description && (
                    <p className="text-sm text-gray-600 mt-1">{rule.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onTestRule(rule)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                    title="Test Rule"
                  >
                    <Play className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      onEditRule(rule);
                      setViewMode('visual');
                    }}
                    className="p-2 text-gray-600 hover:bg-gray-50 rounded"
                    title="Edit Rule"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => rule._id && onDeleteRule(rule._id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded"
                    title="Delete Rule"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default VisualRuleBuilder;

