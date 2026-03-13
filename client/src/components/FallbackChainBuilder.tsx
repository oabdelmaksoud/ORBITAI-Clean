'use client';

import React, { useState, useCallback } from 'react';
import {
  Link2,
  Plus,
  Trash2,
  GripVertical,
  ChevronDown,
  ChevronUp,
  Clock,
  RefreshCw,
  AlertTriangle,
  Server,
  Settings,
  Zap,
  Shield,
} from 'lucide-react';

export interface FallbackStep {
  modelId: string;
  provider?: string;
  maxRetries: number;
  timeoutMs: number;
  circuitBreakerThreshold: number;
}

interface FallbackChainBuilderProps {
  chain: FallbackStep[];
  onChange: (chain: FallbackStep[]) => void;
  availableModels: Array<{
    id: string;
    name: string;
    provider: string;
  }>;
  disabled?: boolean;
}

export default function FallbackChainBuilder({
  chain,
  onChange,
  availableModels,
  disabled = false,
}: FallbackChainBuilderProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newChain = [...chain];
    const [draggedItem] = newChain.splice(draggedIndex, 1);
    newChain.splice(index, 0, draggedItem);
    onChange(newChain);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const addStep = () => {
    const usedModelIds = chain.map(s => s.modelId);
    const availableModel = availableModels.find(m => !usedModelIds.includes(m.id));
    
    if (!availableModel) {
      alert('All available models are already in the chain');
      return;
    }

    const newStep: FallbackStep = {
      modelId: availableModel.id,
      provider: availableModel.provider,
      maxRetries: 1,
      timeoutMs: 30000,
      circuitBreakerThreshold: 50,
    };

    onChange([...chain, newStep]);
    setExpandedIndex(chain.length);
  };

  const removeStep = (index: number) => {
    const newChain = chain.filter((_, i) => i !== index);
    onChange(newChain);
    if (expandedIndex === index) {
      setExpandedIndex(null);
    }
  };

  const updateStep = (index: number, updates: Partial<FallbackStep>) => {
    const newChain = chain.map((step, i) => 
      i === index ? { ...step, ...updates } : step
    );
    onChange(newChain);
  };

  const getModelName = (modelId: string) => {
    const model = availableModels.find(m => m.id === modelId);
    return model?.name || modelId;
  };

  const getProviderColor = (provider?: string) => {
    const colors: Record<string, string> = {
      openai: 'bg-green-100 text-green-700 border-green-200',
      anthropic: 'bg-orange-100 text-orange-700 border-orange-200',
      google: 'bg-blue-100 text-blue-700 border-blue-200',
      gemini: 'bg-blue-100 text-blue-700 border-blue-200',
      deepseek: 'bg-purple-100 text-purple-700 border-purple-200',
      grok: 'bg-slate-100 text-slate-700 border-slate-200',
    };
    return colors[provider?.toLowerCase() || ''] || 'bg-slate-100 text-slate-700 border-slate-200';
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link2 className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-slate-800">Fallback Chain</h3>
        </div>
        <button
          onClick={addStep}
          disabled={disabled || chain.length >= availableModels.length}
          className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" />
          Add Step
        </button>
      </div>

      {/* Description */}
      <p className="text-sm text-slate-500">
        Define the order of models to try if the primary model fails. Drag to reorder.
      </p>

      {/* Chain visualization */}
      {chain.length === 0 ? (
        <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center">
          <Link2 className="w-10 h-10 mx-auto mb-3 text-slate-300" />
          <p className="text-slate-500 mb-3">No fallback chain configured</p>
          <button
            onClick={addStep}
            disabled={disabled}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            Add First Step
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {chain.map((step, index) => (
            <div
              key={`${step.modelId}-${index}`}
              draggable={!disabled}
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              className={`border rounded-xl transition-all ${
                draggedIndex === index
                  ? 'opacity-50 border-blue-400 bg-blue-50'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              {/* Step header */}
              <div
                className="flex items-center gap-3 p-3 cursor-pointer"
                onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
              >
                {/* Drag handle */}
                <div
                  className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <GripVertical className="w-5 h-5" />
                </div>

                {/* Step number */}
                <div className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-sm font-bold">
                  {index + 1}
                </div>

                {/* Model selector */}
                <select
                  value={step.modelId}
                  onChange={(e) => {
                    const model = availableModels.find(m => m.id === e.target.value);
                    updateStep(index, { 
                      modelId: e.target.value,
                      provider: model?.provider
                    });
                  }}
                  onClick={(e) => e.stopPropagation()}
                  disabled={disabled}
                  className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {availableModels.map(model => (
                    <option key={model.id} value={model.id}>
                      {model.name} ({model.provider})
                    </option>
                  ))}
                </select>

                {/* Provider badge */}
                <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${getProviderColor(step.provider)}`}>
                  {step.provider || 'Unknown'}
                </span>

                {/* Quick settings preview */}
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <RefreshCw className="w-3 h-3" />
                    {step.maxRetries}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {(step.timeoutMs / 1000).toFixed(0)}s
                  </span>
                </div>

                {/* Expand/collapse */}
                {expandedIndex === index ? (
                  <ChevronUp className="w-5 h-5 text-slate-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-slate-400" />
                )}

                {/* Delete button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeStep(index);
                  }}
                  disabled={disabled}
                  className="p-1 text-slate-400 hover:text-red-500 transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Expanded settings */}
              {expandedIndex === index && (
                <div className="border-t border-slate-200 p-4 space-y-4 bg-slate-50">
                  <div className="grid grid-cols-3 gap-4">
                    {/* Max retries */}
                    <div>
                      <label className="flex items-center gap-1 text-xs font-medium text-slate-600 mb-1">
                        <RefreshCw className="w-3 h-3" />
                        Max Retries
                      </label>
                      <input
                        type="number"
                        value={step.maxRetries}
                        onChange={(e) => updateStep(index, { maxRetries: parseInt(e.target.value) || 0 })}
                        min={0}
                        max={5}
                        disabled={disabled}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <p className="text-xs text-slate-400 mt-1">Attempts before fallback</p>
                    </div>

                    {/* Timeout */}
                    <div>
                      <label className="flex items-center gap-1 text-xs font-medium text-slate-600 mb-1">
                        <Clock className="w-3 h-3" />
                        Timeout (ms)
                      </label>
                      <input
                        type="number"
                        value={step.timeoutMs}
                        onChange={(e) => updateStep(index, { timeoutMs: parseInt(e.target.value) || 30000 })}
                        min={1000}
                        max={120000}
                        step={1000}
                        disabled={disabled}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <p className="text-xs text-slate-400 mt-1">Max wait per attempt</p>
                    </div>

                    {/* Circuit breaker threshold */}
                    <div>
                      <label className="flex items-center gap-1 text-xs font-medium text-slate-600 mb-1">
                        <Shield className="w-3 h-3" />
                        Circuit Breaker (%)
                      </label>
                      <input
                        type="number"
                        value={step.circuitBreakerThreshold}
                        onChange={(e) => updateStep(index, { circuitBreakerThreshold: parseInt(e.target.value) || 50 })}
                        min={10}
                        max={100}
                        disabled={disabled}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <p className="text-xs text-slate-400 mt-1">Error rate to trip</p>
                    </div>
                  </div>

                  {/* Info box */}
                  <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg">
                    <AlertTriangle className="w-4 h-4 text-blue-600 mt-0.5" />
                    <div className="text-xs text-blue-700">
                      <p className="font-medium">How this step works:</p>
                      <ul className="mt-1 space-y-0.5 list-disc list-inside">
                        <li>Will attempt up to {step.maxRetries + 1} times (1 initial + {step.maxRetries} retries)</li>
                        <li>Each attempt times out after {(step.timeoutMs / 1000).toFixed(0)} seconds</li>
                        <li>Circuit breaker trips at {step.circuitBreakerThreshold}% error rate</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Connection line to next step */}
              {index < chain.length - 1 && (
                <div className="flex justify-center -mb-2">
                  <div className="w-0.5 h-4 bg-slate-300" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Summary */}
      {chain.length > 0 && (
        <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg text-sm">
          <div className="flex items-center gap-2 text-slate-600">
            <Zap className="w-4 h-4 text-yellow-500" />
            <span>{chain.length} model{chain.length > 1 ? 's' : ''} in chain</span>
          </div>
          <div className="flex items-center gap-2 text-slate-600">
            <RefreshCw className="w-4 h-4 text-blue-500" />
            <span>Max {chain.reduce((sum, s) => sum + s.maxRetries + 1, 0)} total attempts</span>
          </div>
          <div className="flex items-center gap-2 text-slate-600">
            <Clock className="w-4 h-4 text-purple-500" />
            <span>Max {(chain.reduce((sum, s) => sum + s.timeoutMs * (s.maxRetries + 1), 0) / 1000).toFixed(0)}s total timeout</span>
          </div>
        </div>
      )}
    </div>
  );
}

