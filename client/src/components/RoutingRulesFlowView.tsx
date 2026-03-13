/**
 * Routing Rules Flow View Component
 * Visual representation of routing rules as flow/block diagram
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Route, Play, Edit2, Trash2, X, CheckCircle, XCircle,
  ArrowDown, Zap, DollarSign, Clock, Shield, Filter,
  ChevronRight, ChevronDown, Eye, EyeOff
} from 'lucide-react';
import { RoutingRule } from '../services/adminLLMRouterApi';

interface RoutingRulesFlowViewProps {
  rules: RoutingRule[];
  onEditRule: (rule: RoutingRule) => void;
  onDeleteRule: (ruleId: string) => void;
  onTestRule: (rule: RoutingRule) => void;
}

const RoutingRulesFlowView: React.FC<RoutingRulesFlowViewProps> = ({
  rules,
  onEditRule,
  onDeleteRule,
  onTestRule
}) => {
  const [selectedRule, setSelectedRule] = useState<RoutingRule | null>(null);
  const [expandedRules, setExpandedRules] = useState<Set<string>>(new Set());
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Sort rules by priority (higher priority first)
  const sortedRules = [...rules].sort((a, b) => (b.priority || 0) - (a.priority || 0));

  const toggleExpand = (ruleId: string) => {
    setExpandedRules(prev => {
      const next = new Set(prev);
      if (next.has(ruleId)) {
        next.delete(ruleId);
      } else {
        next.add(ruleId);
      }
      return next;
    });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) { // Left mouse button
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prev => Math.max(0.5, Math.min(2, prev * delta)));
  };

  const getConditionSummary = (conditions: any): string => {
    const parts: string[] = [];
    if (conditions.taskTypes?.length) parts.push(`Task: ${conditions.taskTypes.join(', ')}`);
    if (conditions.agentRoles?.length) parts.push(`Role: ${conditions.agentRoles.join(', ')}`);
    if (conditions.complexity?.length) parts.push(`Complexity: ${conditions.complexity.join(', ')}`);
    if (conditions.minTokens) parts.push(`Min Tokens: ${conditions.minTokens}`);
    if (conditions.maxTokens) parts.push(`Max Tokens: ${conditions.maxTokens}`);
    return parts.length > 0 ? parts.join(' • ') : 'No conditions';
  };

  const getActionSummary = (actions: any): string => {
    const parts: string[] = [];
    if (actions.preferredModel) parts.push(`Model: ${actions.preferredModel}`);
    if (actions.preferredProvider) parts.push(`Provider: ${actions.preferredProvider}`);
    if (actions.costPreference) parts.push(`Cost: ${actions.costPreference}`);
    if (actions.maxLatency) parts.push(`Max Latency: ${actions.maxLatency}ms`);
    return parts.length > 0 ? parts.join(' • ') : 'No actions';
  };

  const getRuleColor = (rule: RoutingRule): string => {
    if (!rule.enabled) return 'bg-gray-100 border-gray-300';
    const priority = rule.priority || 0;
    if (priority >= 80) return 'bg-red-50 border-red-300';
    if (priority >= 50) return 'bg-orange-50 border-orange-300';
    if (priority >= 20) return 'bg-yellow-50 border-yellow-300';
    return 'bg-blue-50 border-blue-300';
  };

  if (rules.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-500">
        <Route className="w-16 h-16 mb-4 text-gray-400" />
        <p className="text-lg font-medium">No routing rules configured</p>
        <p className="text-sm mt-2">Create a rule to see it visualized here</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full min-h-[600px] bg-gray-50 rounded-lg overflow-hidden border border-gray-200">
      {/* Controls */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2 bg-white rounded-lg shadow-lg p-2 border border-gray-200">
        <button
          onClick={() => setZoom(prev => Math.min(2, prev + 0.1))}
          className="p-1.5 hover:bg-gray-100 rounded"
          title="Zoom In"
        >
          <Zap className="w-4 h-4" />
        </button>
        <button
          onClick={() => setZoom(prev => Math.max(0.5, prev - 0.1))}
          className="p-1.5 hover:bg-gray-100 rounded"
          title="Zoom Out"
        >
          <Eye className="w-4 h-4" />
        </button>
        <button
          onClick={() => {
            setZoom(1);
            setPan({ x: 0, y: 0 });
          }}
          className="p-1.5 hover:bg-gray-100 rounded text-xs font-medium"
          title="Reset View"
        >
          Reset
        </button>
      </div>

      {/* Flow Diagram */}
      <div
        ref={containerRef}
        className="w-full h-full overflow-hidden cursor-move"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <div
          className="relative"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
            minHeight: '100%',
            padding: '40px'
          }}
        >
          {/* Flow Lines */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
            <defs>
              <marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="7"
                refX="9"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" />
              </marker>
            </defs>
            {sortedRules.map((rule, index) => {
              if (index === sortedRules.length - 1) return null;
              const y1 = index * 200 + 120;
              const y2 = (index + 1) * 200 + 80;
              return (
                <line
                  key={`line-${rule._id}`}
                  x1="50%"
                  y1={y1}
                  x2="50%"
                  y2={y2}
                  stroke={rule.enabled ? '#3b82f6' : '#94a3b8'}
                  strokeWidth="2"
                  strokeDasharray={rule.enabled ? '0' : '5,5'}
                  markerEnd="url(#arrowhead)"
                  opacity={rule.enabled ? 0.6 : 0.3}
                />
              );
            })}
          </svg>

          {/* Rule Blocks */}
          <div className="relative z-10 space-y-4">
            {sortedRules.map((rule, index) => {
              const isExpanded = expandedRules.has(rule._id || '');
              const isSelected = selectedRule?._id === rule._id;
              const blockColor = getRuleColor(rule);

              return (
                <div
                  key={rule._id || index}
                  className={`relative mx-auto transition-all duration-200 ${
                    isSelected ? 'ring-2 ring-blue-500 ring-offset-2' : ''
                  }`}
                  style={{ width: '600px' }}
                >
                  {/* Rule Block */}
                  <div
                    className={`${blockColor} rounded-lg border-2 shadow-lg hover:shadow-xl transition-all cursor-pointer`}
                    onClick={() => setSelectedRule(rule)}
                  >
                    {/* Header */}
                    <div className="p-4 flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                            rule.enabled ? 'bg-green-500 text-white' : 'bg-gray-400 text-white'
                          }`}>
                            {index + 1}
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                              {rule.name}
                              {rule.enabled ? (
                                <CheckCircle className="w-4 h-4 text-green-600" />
                              ) : (
                                <XCircle className="w-4 h-4 text-gray-400" />
                              )}
                            </h4>
                            <div className="flex items-center gap-4 mt-1 text-xs text-gray-600">
                              <span className="flex items-center gap-1">
                                <Zap className="w-3 h-3" />
                                Priority: {rule.priority || 0}
                              </span>
                              {rule.description && (
                                <span className="text-gray-500">{rule.description}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Conditions Preview */}
                        <div className="mt-3 p-2 bg-white/60 rounded text-xs">
                          <div className="flex items-center gap-2 text-gray-700 mb-1">
                            <Filter className="w-3 h-3" />
                            <span className="font-medium">Conditions:</span>
                          </div>
                          <p className="text-gray-600 ml-5">
                            {getConditionSummary(rule.conditions || {})}
                          </p>
                        </div>

                        {/* Actions Preview */}
                        <div className="mt-2 p-2 bg-white/60 rounded text-xs">
                          <div className="flex items-center gap-2 text-gray-700 mb-1">
                            <Play className="w-3 h-3" />
                            <span className="font-medium">Actions:</span>
                          </div>
                          <p className="text-gray-600 ml-5">
                            {getActionSummary(rule.actions || {})}
                          </p>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 ml-4">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExpand(rule._id || '');
                          }}
                          className="p-1.5 hover:bg-white/80 rounded transition-colors"
                          title={isExpanded ? 'Collapse' : 'Expand'}
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-gray-600" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-600" />
                          )}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onTestRule(rule);
                          }}
                          className="p-1.5 hover:bg-blue-100 rounded transition-colors"
                          title="Test Rule"
                        >
                          <Play className="w-4 h-4 text-blue-600" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditRule(rule);
                          }}
                          className="p-1.5 hover:bg-gray-200 rounded transition-colors"
                          title="Edit Rule"
                        >
                          <Edit2 className="w-4 h-4 text-gray-600" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (rule._id) onDeleteRule(rule._id);
                          }}
                          className="p-1.5 hover:bg-red-100 rounded transition-colors"
                          title="Delete Rule"
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </button>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="border-t border-gray-300 p-4 bg-white/40">
                        <div className="grid grid-cols-2 gap-4 text-xs">
                          {/* Conditions Details */}
                          <div>
                            <h5 className="font-semibold text-gray-700 mb-2 flex items-center gap-1">
                              <Filter className="w-3 h-3" />
                              Conditions
                            </h5>
                            <div className="space-y-1 text-gray-600">
                              {rule.conditions?.taskTypes && (
                                <div>
                                  <span className="font-medium">Task Types:</span>{' '}
                                  {rule.conditions.taskTypes.join(', ')}
                                </div>
                              )}
                              {rule.conditions?.agentRoles && (
                                <div>
                                  <span className="font-medium">Agent Roles:</span>{' '}
                                  {rule.conditions.agentRoles.join(', ')}
                                </div>
                              )}
                              {rule.conditions?.complexity && (
                                <div>
                                  <span className="font-medium">Complexity:</span>{' '}
                                  {rule.conditions.complexity.join(', ')}
                                </div>
                              )}
                              {rule.conditions?.minTokens && (
                                <div>
                                  <span className="font-medium">Min Tokens:</span>{' '}
                                  {rule.conditions.minTokens}
                                </div>
                              )}
                              {rule.conditions?.maxTokens && (
                                <div>
                                  <span className="font-medium">Max Tokens:</span>{' '}
                                  {rule.conditions.maxTokens}
                                </div>
                              )}
                              {!rule.conditions || Object.keys(rule.conditions).length === 0 && (
                                <div className="text-gray-400 italic">No conditions specified</div>
                              )}
                            </div>
                          </div>

                          {/* Actions Details */}
                          <div>
                            <h5 className="font-semibold text-gray-700 mb-2 flex items-center gap-1">
                              <Play className="w-3 h-3" />
                              Actions
                            </h5>
                            <div className="space-y-1 text-gray-600">
                              {rule.actions?.preferredModel && (
                                <div>
                                  <span className="font-medium">Preferred Model:</span>{' '}
                                  {rule.actions.preferredModel}
                                </div>
                              )}
                              {rule.actions?.preferredProvider && (
                                <div>
                                  <span className="font-medium">Preferred Provider:</span>{' '}
                                  {rule.actions.preferredProvider}
                                </div>
                              )}
                              {rule.actions?.costPreference && (
                                <div>
                                  <span className="font-medium">Cost Preference:</span>{' '}
                                  {rule.actions.costPreference}
                                </div>
                              )}
                              {rule.actions?.maxLatency && (
                                <div>
                                  <span className="font-medium">Max Latency:</span>{' '}
                                  {rule.actions.maxLatency}ms
                                </div>
                              )}
                              {rule.actions?.costLimit && (
                                <div>
                                  <span className="font-medium">Cost Limit:</span>{' '}
                                  ${rule.actions.costLimit}
                                </div>
                              )}
                              {!rule.actions || Object.keys(rule.actions).length === 0 && (
                                <div className="text-gray-400 italic">No actions specified</div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Flow Indicator */}
                  {index < sortedRules.length - 1 && (
                    <div className="flex justify-center my-2">
                      <ArrowDown className="w-5 h-5 text-gray-400" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* End Node */}
          <div className="relative z-10 mx-auto mt-8" style={{ width: '600px' }}>
            <div className="bg-gray-200 border-2 border-gray-400 rounded-lg p-4 text-center">
              <div className="flex items-center justify-center gap-2 text-gray-700">
                <Route className="w-5 h-5" />
                <span className="font-semibold">Default Model Selection</span>
              </div>
              <p className="text-xs text-gray-600 mt-1">
                If no rules match, use default routing logic
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 z-10 bg-white rounded-lg shadow-lg p-3 border border-gray-200 text-xs">
        <div className="font-semibold text-gray-700 mb-2">Legend</div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-red-500"></div>
            <span>High Priority (80+)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-orange-500"></div>
            <span>Medium Priority (50-79)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-yellow-500"></div>
            <span>Low Priority (20-49)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-blue-500"></div>
            <span>Default Priority (&lt;20)</span>
          </div>
          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-200">
            <div className="w-4 h-4 rounded bg-gray-300"></div>
            <span>Disabled Rule</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoutingRulesFlowView;




