/**
 * Rate Limiting Management Component
 * Admin interface for rate limit rules
 */

import React, { useState, useEffect } from 'react';
import { Shield, Plus, Edit2, Trash2, CheckCircle2, XCircle, TrendingUp } from 'lucide-react';
import { showAlert, showConfirm } from '../utils/browserUtils';
import { toast } from '../services/toastService';
import {
  getRateLimitRules,
  createRateLimitRule,
  updateRateLimitRule,
  deleteRateLimitRule,
  getRateLimitStats,
  RateLimitRule,
  RateLimitStats
} from '../services/adminRateLimitingApi';

interface RateLimitingManagementProps {
  token: string;
}

const RateLimitingManagement: React.FC<RateLimitingManagementProps> = ({ token }) => {
  const [rules, setRules] = useState<RateLimitRule[]>([]);
  const [stats, setStats] = useState<RateLimitStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState<RateLimitRule | null>(null);
  const [filterScope, setFilterScope] = useState<string>('');
  const [filterActive, setFilterActive] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    loadData();
  }, [filterScope, filterActive]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [rulesData, statsData] = await Promise.all([
        getRateLimitRules(token, {
          scope: filterScope || undefined,
          isActive: filterActive
        }),
        getRateLimitStats(token)
      ]);
      setRules(rulesData);
      setStats(statsData);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load rate limit rules');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!(await showConfirm('Are you sure you want to delete this rate limit rule?'))) return;
    try {
      await deleteRateLimitRule(token, id);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to delete rule');
    }
  };

  const formatWindow = (windowMs: number) => {
    if (windowMs < 1000) return `${windowMs}ms`;
    if (windowMs < 60000) return `${windowMs / 1000}s`;
    if (windowMs < 3600000) return `${windowMs / 60000}min`;
    return `${windowMs / 3600000}h`;
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Rate Limiting Management
          </h2>
          {stats && (
            <div className="flex gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-slate-600">Total:</span>
                <span className="font-semibold">{stats.total}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-600">Active:</span>
                <span className="font-semibold text-green-600">{stats.active}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-600">Inactive:</span>
                <span className="font-semibold text-slate-400">{stats.inactive}</span>
              </div>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="flex gap-4 mb-6">
          <select
            value={filterScope}
            onChange={(e) => setFilterScope(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg"
          >
            <option value="">All Scopes</option>
            <option value="global">Global</option>
            <option value="user">User</option>
            <option value="plan">Plan</option>
            <option value="ip">IP</option>
            <option value="endpoint">Endpoint</option>
          </select>
          <select
            value={filterActive === undefined ? '' : filterActive.toString()}
            onChange={(e) =>
              setFilterActive(e.target.value === '' ? undefined : e.target.value === 'true')
            }
            className="px-4 py-2 border border-slate-300 rounded-lg"
          >
            <option value="">All Status</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
          <button
            onClick={() => {
              setEditingRule(null);
              setShowForm(true);
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 ml-auto"
          >
            <Plus className="w-4 h-4" />
            Add Rule
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* Rules List */}
        {loading ? (
          <div className="text-center py-8 text-slate-500">Loading...</div>
        ) : rules.length === 0 ? (
          <div className="text-center py-8 text-slate-500">No rate limit rules found</div>
        ) : (
          <div className="space-y-3">
            {rules.map((rule) => (
              <div
                key={rule._id}
                className="border border-slate-200 rounded-lg p-4 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-slate-800">{rule.name}</h3>
                      <span
                        className={`px-2 py-1 text-xs rounded ${
                          rule.isActive
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {rule.isActive ? 'Active' : 'Inactive'}
                      </span>
                      <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded">
                        {rule.scope}
                        {rule.scopeValue && `: ${rule.scopeValue}`}
                      </span>
                      {rule.priority !== 0 && (
                        <span className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded">
                          Priority: {rule.priority}
                        </span>
                      )}
                    </div>
                    {rule.description && (
                      <p className="text-sm text-slate-600 mb-2">{rule.description}</p>
                    )}
                    <div className="flex gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <TrendingUp className="w-4 h-4 text-slate-500" />
                        <span className="text-slate-700">
                          {rule.limit} requests per {formatWindow(rule.windowMs)}
                        </span>
                      </div>
                      <span className="text-slate-500">
                        Created: {new Date(rule.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setEditingRule(rule);
                        setShowForm(true);
                      }}
                      className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(rule._id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Rate Limit Rule Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-bold mb-4">
                {editingRule ? 'Edit Rate Limit Rule' : 'Add Rate Limit Rule'}
              </h3>
              <RateLimitForm
                rule={editingRule}
                onSave={async (ruleData) => {
                  try {
                    if (editingRule) {
                      await updateRateLimitRule(token, editingRule._id, ruleData);
                    } else {
                      await createRateLimitRule(token, ruleData);
                    }
                    setShowForm(false);
                    setEditingRule(null);
                    loadData();
                  } catch (err: any) {
                    setError(err.message || 'Failed to save rate limit rule');
                  }
                }}
                onCancel={() => {
                  setShowForm(false);
                  setEditingRule(null);
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Pre-configured DDoS Protection Rules */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Shield className="w-5 h-5 text-red-600" />
            DDoS Protection Rules
          </h3>
          <button
            onClick={async () => {
              try {
                setLoading(true);
                await createDDoSProtectionRules(token);
                showAlert('DDoS protection rules have been created successfully!', 'success');
                loadData();
              } catch (err: any) {
                setError(err.message || 'Failed to create DDoS protection rules');
              } finally {
                setLoading(false);
              }
            }}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
            disabled={loading}
          >
            <Shield className="w-4 h-4" />
            Add DDoS Protection Rules
          </button>
        </div>
        <p className="text-sm text-slate-600 mb-4">
          Pre-configured rules to protect against abuse and DDoS attacks. These rules will be created with high priority to ensure they are checked first. Click on any existing rule below to edit it.
        </p>
        
        {/* Show existing DDoS protection rules */}
        {(() => {
          const ddosRuleNames = [
            'Global Rate Limit - DDoS Protection',
            'Burst Protection - DDoS Prevention',
            'API Endpoint Protection',
            'Authentication Protection - Brute Force Prevention'
          ];
          const ddosRules = rules.filter(rule => ddosRuleNames.includes(rule.name));
          
          if (ddosRules.length > 0) {
            return (
              <div className="mb-6">
                <h4 className="text-md font-semibold text-slate-800 mb-3">Existing DDoS Protection Rules</h4>
                <div className="space-y-3">
                  {ddosRules.map((rule) => (
                    <div
                      key={rule._id}
                      className="border border-red-200 bg-red-50 rounded-lg p-4 hover:bg-red-100 transition-colors cursor-pointer"
                      onClick={() => {
                        setEditingRule(rule);
                        setShowForm(true);
                      }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-semibold text-slate-800">{rule.name}</h4>
                            <span
                              className={`px-2 py-1 text-xs rounded ${
                                rule.isActive
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-gray-100 text-gray-700'
                              }`}
                            >
                              {rule.isActive ? 'Active' : 'Inactive'}
                            </span>
                            <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded">
                              {rule.scope}
                              {rule.scopeValue && `: ${rule.scopeValue}`}
                            </span>
                            {rule.priority !== 0 && (
                              <span className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded">
                                Priority: {rule.priority}
                              </span>
                            )}
                          </div>
                          {rule.description && (
                            <p className="text-sm text-slate-600 mb-2">{rule.description}</p>
                          )}
                          <div className="flex gap-4 text-sm">
                            <div className="flex items-center gap-1">
                              <TrendingUp className="w-4 h-4 text-slate-500" />
                              <span className="text-slate-700">
                                {rule.limit} requests per {formatWindow(rule.windowMs)}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => {
                              setEditingRule(rule);
                              setShowForm(true);
                            }}
                            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(rule._id)}
                            className="p-2 text-red-600 hover:bg-red-100 rounded-lg"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          }
          return null;
        })()}

        {/* Template descriptions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border border-slate-200 rounded-lg p-4">
            <h4 className="font-semibold text-slate-800 mb-2">Global Rate Limit - DDoS Protection</h4>
            <p className="text-sm text-slate-600 mb-2">1000 requests per minute (global)</p>
            <p className="text-xs text-slate-500">Protects against DDoS by limiting all requests globally</p>
            <p className="text-xs text-purple-600 mt-1 font-semibold">Priority: 100 (Highest)</p>
          </div>
          <div className="border border-slate-200 rounded-lg p-4">
            <h4 className="font-semibold text-slate-800 mb-2">Burst Protection - DDoS Prevention</h4>
            <p className="text-sm text-slate-600 mb-2">50 requests per 10 seconds (global)</p>
            <p className="text-xs text-slate-500">Prevents rapid-fire request bursts - common DDoS pattern</p>
            <p className="text-xs text-purple-600 mt-1 font-semibold">Priority: 95</p>
          </div>
          <div className="border border-slate-200 rounded-lg p-4">
            <h4 className="font-semibold text-slate-800 mb-2">API Endpoint Protection</h4>
            <p className="text-sm text-slate-600 mb-2">100 requests per minute per /api endpoint</p>
            <p className="text-xs text-slate-500">Protects API endpoints from abuse</p>
            <p className="text-xs text-purple-600 mt-1 font-semibold">Priority: 90</p>
          </div>
          <div className="border border-slate-200 rounded-lg p-4">
            <h4 className="font-semibold text-slate-800 mb-2">Authentication Protection</h4>
            <p className="text-sm text-slate-600 mb-2">10 login attempts per 5 minutes</p>
            <p className="text-xs text-slate-500">Prevents brute force attacks on login endpoints</p>
            <p className="text-xs text-purple-600 mt-1 font-semibold">Priority: 85</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Rate Limit Form Component
interface RateLimitFormProps {
  rule: RateLimitRule | null;
  onSave: (data: {
    name: string;
    description?: string;
    scope: 'global' | 'user' | 'plan' | 'ip' | 'endpoint';
    scopeValue?: string;
    limit: number;
    windowMs: number;
    priority?: number;
  }) => void;
  onCancel: () => void;
}

const RateLimitForm: React.FC<RateLimitFormProps> = ({ rule, onSave, onCancel }) => {
  const [name, setName] = useState(rule?.name || '');
  const [description, setDescription] = useState(rule?.description || '');
  const [scope, setScope] = useState<'global' | 'user' | 'plan' | 'ip' | 'endpoint'>(rule?.scope || 'global');
  const [scopeValue, setScopeValue] = useState(rule?.scopeValue || '');
  const [limit, setLimit] = useState(rule?.limit || 100);
  const [windowMs, setWindowMs] = useState(rule?.windowMs || 60000);
  const [windowType, setWindowType] = useState<'seconds' | 'minutes' | 'hours'>(() => {
    if (rule?.windowMs) {
      if (rule.windowMs < 60000) return 'seconds';
      if (rule.windowMs < 3600000) return 'minutes';
      return 'hours';
    }
    return 'minutes';
  });
  const [windowValue, setWindowValue] = useState(() => {
    if (rule?.windowMs) {
      if (rule.windowMs < 60000) return rule.windowMs / 1000;
      if (rule.windowMs < 3600000) return rule.windowMs / 60000;
      return rule.windowMs / 3600000;
    }
    return 1;
  });
  const [priority, setPriority] = useState(rule?.priority || 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    let calculatedWindowMs = windowMs;
    if (windowType === 'seconds') {
      calculatedWindowMs = windowValue * 1000;
    } else if (windowType === 'minutes') {
      calculatedWindowMs = windowValue * 60000;
    } else if (windowType === 'hours') {
      calculatedWindowMs = windowValue * 3600000;
    }

    // Validate scope-specific requirements
    if ((scope === 'user' || scope === 'plan' || scope === 'ip' || scope === 'endpoint') && !scopeValue.trim()) {
      toast.warning(`Scope value is required for ${scope} scope`);
      return;
    }

    onSave({
      name,
      description: description || undefined,
      scope,
      scopeValue: (scope === 'global' || !scopeValue.trim()) ? undefined : scopeValue.trim(),
      limit,
      windowMs: calculatedWindowMs,
      priority: priority || 0
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Scope *</label>
        <select
          value={scope}
          onChange={(e) => setScope(e.target.value as any)}
          required
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="global">Global (All Users/IPs)</option>
          <option value="user">User (Specific User ID)</option>
          <option value="plan">Plan (Specific Plan)</option>
          <option value="ip">IP Address (Specific IP)</option>
          <option value="endpoint">Endpoint (Specific API Path)</option>
        </select>
      </div>

      {(scope === 'user' || scope === 'plan' || scope === 'ip' || scope === 'endpoint') && (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Scope Value * ({scope === 'user' ? 'User ID' : scope === 'plan' ? 'Plan Name' : scope === 'ip' ? 'IP Address' : 'Endpoint Path'})
          </label>
          <input
            type="text"
            value={scopeValue}
            onChange={(e) => setScopeValue(e.target.value)}
            required
            placeholder={scope === 'user' ? 'user123' : scope === 'plan' ? 'Pro' : scope === 'ip' ? '192.168.1.1' : '/api/endpoint'}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Request Limit *</label>
          <input
            type="number"
            value={limit}
            onChange={(e) => setLimit(parseInt(e.target.value) || 0)}
            required
            min={1}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Time Window *</label>
          <div className="flex gap-2">
            <input
              type="number"
              value={windowValue}
              onChange={(e) => setWindowValue(parseFloat(e.target.value) || 0)}
              required
              min={0.1}
              step={0.1}
              className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <select
              value={windowType}
              onChange={(e) => setWindowType(e.target.value as any)}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="seconds">Seconds</option>
              <option value="minutes">Minutes</option>
              <option value="hours">Hours</option>
            </select>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
        <input
          type="number"
          value={priority}
          onChange={(e) => setPriority(parseInt(e.target.value) || 0)}
          min={0}
          max={100}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="text-xs text-slate-500 mt-1">Higher priority rules are checked first (0-100)</p>
      </div>

      <div className="flex gap-3 justify-end pt-4 border-t">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          {rule ? 'Update' : 'Create'}
        </button>
      </div>
    </form>
  );
};

// Function to create pre-configured DDoS protection rules
async function createDDoSProtectionRules(token: string) {
  const { createRateLimitRule, getRateLimitRules } = await import('../services/adminRateLimitingApi');
  
  // Check if rules already exist before creating
  const existingRules = await getRateLimitRules(token);
  const existingNames = new Set(existingRules.map(r => r.name));

  const rules = [
    {
      name: 'Global Rate Limit - DDoS Protection',
      description: 'Protects against DDoS by limiting all requests globally (1000 req/min)',
      scope: 'global' as const,
      limit: 1000,
      windowMs: 60000, // 1 minute
      priority: 100 // Highest priority
    },
    {
      name: 'Burst Protection - DDoS Prevention',
      description: 'Prevents rapid-fire request bursts (50 req/10sec) - common DDoS pattern',
      scope: 'global' as const,
      limit: 50,
      windowMs: 10000, // 10 seconds
      priority: 95
    },
    {
      name: 'API Endpoint Protection',
      description: 'Protects API endpoints from abuse (100 req/min per endpoint)',
      scope: 'endpoint' as const,
      scopeValue: '/api',
      limit: 100,
      windowMs: 60000, // 1 minute
      priority: 90
    },
    {
      name: 'Authentication Protection - Brute Force Prevention',
      description: 'Prevents brute force attacks on authentication endpoints (10 attempts/5min)',
      scope: 'endpoint' as const,
      scopeValue: '/api/auth/login',
      limit: 10,
      windowMs: 300000, // 5 minutes
      priority: 85
    }
  ];

  let createdCount = 0;
  for (const rule of rules) {
    // Skip if rule with same name already exists
    if (existingNames.has(rule.name)) {
      continue;
    }
    
    try {
      await createRateLimitRule(token, rule);
      createdCount++;
    } catch (error: any) {
      // If rule already exists or other error, continue with next rule
      console.warn(`Failed to create rule "${rule.name}":`, error.message);
    }
  }

  if (createdCount === 0) {
    throw new Error('All DDoS protection rules already exist');
  }
}

export default RateLimitingManagement;




