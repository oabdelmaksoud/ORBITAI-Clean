'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  Plus,
  Trash2,
  Edit2,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  DollarSign,
  Hash,
  Zap,
  User,
  Folder,
  Globe,
  Bell,
  BellOff,
  ChevronDown,
  ChevronUp,
  Save,
  X,
} from 'lucide-react';
import { getQuotas, createQuota, updateQuota, deleteQuota, UsageQuota } from '../services/routerEnhancedApi';

interface QuotaManagerProps {
  token?: string;
}

interface QuotaFormData {
  targetType: 'user' | 'project' | 'global';
  targetId?: string;
  targetName?: string;
  dailyLimit?: number;
  monthlyLimit?: number;
  dailyTokenLimit?: number;
  monthlyTokenLimit?: number;
  dailyRequestLimit?: number;
  monthlyRequestLimit?: number;
  hardLimit: boolean;
  alerts: {
    threshold50: boolean;
    threshold75: boolean;
    threshold90: boolean;
  };
}

const defaultFormData: QuotaFormData = {
  targetType: 'user',
  targetId: '',
  targetName: '',
  dailyLimit: undefined,
  monthlyLimit: undefined,
  dailyTokenLimit: undefined,
  monthlyTokenLimit: undefined,
  dailyRequestLimit: undefined,
  monthlyRequestLimit: undefined,
  hardLimit: false,
  alerts: {
    threshold50: true,
    threshold75: true,
    threshold90: true,
  },
};

export default function QuotaManager({ token }: QuotaManagerProps) {
  const [quotas, setQuotas] = useState<UsageQuota[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<QuotaFormData>(defaultFormData);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedQuota, setExpandedQuota] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchQuotas = useCallback(async () => {
    try {
      setError(null);
      const data = await getQuotas(token);
      setQuotas(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch quotas');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchQuotas();
  }, [fetchQuotas]);

  const handleSubmit = async () => {
    if (!formData.targetType) {
      setError('Target type is required');
      return;
    }

    if (formData.targetType !== 'global' && !formData.targetId) {
      setError('Target ID is required for user/project quotas');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      if (editingId) {
        await updateQuota(editingId, formData, token);
      } else {
        await createQuota(formData, token);
      }

      setShowForm(false);
      setFormData(defaultFormData);
      setEditingId(null);
      await fetchQuotas();
    } catch (err: any) {
      setError(err.message || 'Failed to save quota');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (quota: UsageQuota) => {
    setFormData({
      targetType: quota.targetType,
      targetId: quota.targetId,
      targetName: quota.targetName,
      dailyLimit: quota.dailyLimit,
      monthlyLimit: quota.monthlyLimit,
      dailyTokenLimit: undefined,
      monthlyTokenLimit: undefined,
      dailyRequestLimit: undefined,
      monthlyRequestLimit: undefined,
      hardLimit: false,
      alerts: quota.alerts,
    });
    setEditingId(quota.id);
    setShowForm(true);
  };

  const handleDelete = async (quotaId: string) => {
    if (!confirm('Are you sure you want to delete this quota?')) return;

    try {
      setError(null);
      await deleteQuota(quotaId, token);
      await fetchQuotas();
    } catch (err: any) {
      setError(err.message || 'Failed to delete quota');
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US').format(value);
  };

  const getTargetIcon = (type: string) => {
    switch (type) {
      case 'user':
        return <User className="w-4 h-4" />;
      case 'project':
        return <Folder className="w-4 h-4" />;
      case 'global':
        return <Globe className="w-4 h-4" />;
      default:
        return <Shield className="w-4 h-4" />;
    }
  };

  const getTargetColor = (type: string) => {
    switch (type) {
      case 'user':
        return 'bg-blue-100 text-blue-700';
      case 'project':
        return 'bg-purple-100 text-purple-700';
      case 'global':
        return 'bg-green-100 text-green-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  const getUsagePercent = (current: number, limit?: number) => {
    if (!limit) return 0;
    return Math.min((current / limit) * 100, 100);
  };

  const getUsageColor = (percent: number) => {
    if (percent >= 90) return 'bg-red-500';
    if (percent >= 75) return 'bg-orange-500';
    if (percent >= 50) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const renderProgressBar = (current: number, limit?: number, label: string) => {
    if (!limit) return null;
    const percent = getUsagePercent(current, limit);

    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">{label}</span>
          <span className="text-slate-700 font-medium">
            {formatNumber(current)} / {formatNumber(limit)}
          </span>
        </div>
        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
          <div
            className={`h-full ${getUsageColor(percent)} transition-all`}
            style={{ width: `${percent}%` }}
          />
        </div>
        <div className="text-right text-xs text-slate-400">{percent.toFixed(1)}%</div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Shield className="w-6 h-6 text-blue-600" />
            Usage Quotas
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Manage cost and usage limits for users, projects, and globally
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchQuotas}
            disabled={loading}
            className="p-2 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => {
              setFormData(defaultFormData);
              setEditingId(null);
              setShowForm(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Quota
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600" />
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100">
              <User className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">User Quotas</p>
              <p className="text-xl font-bold text-slate-800">
                {quotas.filter(q => q.targetType === 'user').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-100">
              <Folder className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Project Quotas</p>
              <p className="text-xl font-bold text-slate-800">
                {quotas.filter(q => q.targetType === 'project').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-100">
              <Globe className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Global Quotas</p>
              <p className="text-xl font-bold text-slate-800">
                {quotas.filter(q => q.targetType === 'global').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-100">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Near Limit</p>
              <p className="text-xl font-bold text-slate-800">
                {quotas.filter(q => {
                  const usage = q.currentUsage;
                  return (q.monthlyLimit && (usage.monthly / q.monthlyLimit) > 0.75);
                }).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Quotas list */}
      <div className="space-y-4">
        {quotas.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <Shield className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <p className="text-slate-500 mb-4">No quotas configured</p>
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Create First Quota
            </button>
          </div>
        ) : (
          quotas.map(quota => (
            <div
              key={quota.id}
              className="bg-white rounded-xl border border-slate-200 overflow-hidden"
            >
              {/* Quota header */}
              <div
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => setExpandedQuota(expandedQuota === quota.id ? null : quota.id)}
              >
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-lg ${getTargetColor(quota.targetType)}`}>
                    {getTargetIcon(quota.targetType)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800">
                      {quota.targetName || quota.targetId || 'Global Quota'}
                    </h3>
                    <p className="text-sm text-slate-500 capitalize">{quota.targetType}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {quota.monthlyLimit && (
                    <div className="text-right">
                      <p className="text-xs text-slate-500">Monthly Usage</p>
                      <p className="text-sm font-medium text-slate-800">
                        {formatCurrency(quota.currentUsage.monthly)} / {formatCurrency(quota.monthlyLimit)}
                      </p>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(quota);
                      }}
                      className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(quota.id);
                      }}
                      className="p-2 text-slate-400 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    {expandedQuota === quota.id ? (
                      <ChevronUp className="w-5 h-5 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-slate-400" />
                    )}
                  </div>
                </div>
              </div>

              {/* Expanded content */}
              {expandedQuota === quota.id && (
                <div className="border-t border-slate-200 p-4 space-y-4 bg-slate-50">
                  <div className="grid grid-cols-2 gap-6">
                    {/* Daily usage */}
                    <div className="space-y-3">
                      <h4 className="font-medium text-slate-700">Daily Usage</h4>
                      {renderProgressBar(quota.currentUsage.daily, quota.dailyLimit, 'Cost')}
                    </div>

                    {/* Monthly usage */}
                    <div className="space-y-3">
                      <h4 className="font-medium text-slate-700">Monthly Usage</h4>
                      {renderProgressBar(quota.currentUsage.monthly, quota.monthlyLimit, 'Cost')}
                    </div>
                  </div>

                  {/* Alert settings */}
                  <div className="flex items-center gap-4 pt-4 border-t border-slate-200">
                    <span className="text-sm text-slate-600">Alerts:</span>
                    {quota.alerts.threshold50 && (
                      <span className="flex items-center gap-1 text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full">
                        <Bell className="w-3 h-3" /> 50%
                      </span>
                    )}
                    {quota.alerts.threshold75 && (
                      <span className="flex items-center gap-1 text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full">
                        <Bell className="w-3 h-3" /> 75%
                      </span>
                    )}
                    {quota.alerts.threshold90 && (
                      <span className="flex items-center gap-1 text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full">
                        <Bell className="w-3 h-3" /> 90%
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Add/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-800">
                {editingId ? 'Edit Quota' : 'Create Quota'}
              </h3>
              <button
                onClick={() => {
                  setShowForm(false);
                  setFormData(defaultFormData);
                  setEditingId(null);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Target type */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Quota Type
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['user', 'project', 'global'] as const).map(type => (
                    <button
                      key={type}
                      onClick={() => setFormData({ ...formData, targetType: type })}
                      className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all ${
                        formData.targetType === type
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {getTargetIcon(type)}
                      <span className="capitalize font-medium">{type}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Target ID (for user/project) */}
              {formData.targetType !== 'global' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      {formData.targetType === 'user' ? 'User ID' : 'Project ID'}
                    </label>
                    <input
                      type="text"
                      value={formData.targetId || ''}
                      onChange={(e) => setFormData({ ...formData, targetId: e.target.value })}
                      placeholder="Enter ID"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Display Name
                    </label>
                    <input
                      type="text"
                      value={formData.targetName || ''}
                      onChange={(e) => setFormData({ ...formData, targetName: e.target.value })}
                      placeholder="Optional name"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}

              {/* Limits */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-3">
                  Cost Limits (USD)
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Daily Limit</label>
                    <input
                      type="number"
                      value={formData.dailyLimit || ''}
                      onChange={(e) => setFormData({ ...formData, dailyLimit: parseFloat(e.target.value) || undefined })}
                      placeholder="No limit"
                      min={0}
                      step={0.01}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Monthly Limit</label>
                    <input
                      type="number"
                      value={formData.monthlyLimit || ''}
                      onChange={(e) => setFormData({ ...formData, monthlyLimit: parseFloat(e.target.value) || undefined })}
                      placeholder="No limit"
                      min={0}
                      step={0.01}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Hard limit toggle */}
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <div>
                  <p className="font-medium text-slate-800">Hard Limit</p>
                  <p className="text-sm text-slate-500">Block requests when limit is reached</p>
                </div>
                <button
                  onClick={() => setFormData({ ...formData, hardLimit: !formData.hardLimit })}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    formData.hardLimit ? 'bg-blue-600' : 'bg-slate-300'
                  }`}
                >
                  <div
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                      formData.hardLimit ? 'translate-x-7' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Alert thresholds */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-3">
                  Alert Thresholds
                </label>
                <div className="flex gap-4">
                  {([50, 75, 90] as const).map(threshold => (
                    <label
                      key={threshold}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={formData.alerts[`threshold${threshold}` as keyof typeof formData.alerts]}
                        onChange={(e) => setFormData({
                          ...formData,
                          alerts: {
                            ...formData.alerts,
                            [`threshold${threshold}`]: e.target.checked,
                          },
                        })}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-slate-600">{threshold}%</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowForm(false);
                  setFormData(defaultFormData);
                  setEditingId(null);
                }}
                className="px-4 py-2 text-slate-600 hover:text-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    {editingId ? 'Update' : 'Create'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

