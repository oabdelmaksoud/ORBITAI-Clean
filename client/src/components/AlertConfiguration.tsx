import React, { useState, useEffect } from 'react';
import { Bell, Plus, Trash2, Edit, X, Loader2, TestTube, CheckCircle } from 'lucide-react';
import { getAlertRules, createAlertRule, updateAlertRule, deleteAlertRule, testAlertRule, AlertRule } from '../services/alertsApi';

import { showAlert, showConfirm } from '../utils/browserUtils';
interface AlertConfigurationProps {
  token: string;
}

const AlertConfiguration: React.FC<AlertConfigurationProps> = ({ token }) => {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);
  const [ruleData, setRuleData] = useState({
    name: '',
    description: '',
    condition: {
      metric: 'error_rate',
      operator: 'gt' as 'gt' | 'lt' | 'eq' | 'gte' | 'lte',
      threshold: 10,
      timeWindow: 5
    },
    channels: {
      email: [] as string[],
      slack: [] as string[],
      sms: [] as string[],
      webhook: ''
    },
    severity: 'medium' as 'low' | 'medium' | 'high' | 'critical',
    escalation: {
      enabled: false,
      delayMinutes: 60,
      escalateTo: [] as string[]
    }
  });

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getAlertRules(token);
      setRules(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load alert rules');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRule = async () => {
    if (!token || !ruleData.name) return;
    setLoading(true);
    setError(null);
    try {
      await createAlertRule(token, ruleData);
      setShowCreateModal(false);
      setRuleData({
        name: '',
        description: '',
        condition: { metric: 'error_rate', operator: 'gt', threshold: 10, timeWindow: 5 },
        channels: { email: [], slack: [], sms: [], webhook: '' },
        severity: 'medium',
        escalation: { enabled: false, delayMinutes: 60, escalateTo: [] }
      });
      await loadRules();
    } catch (err: any) {
      setError(err.message || 'Failed to create alert rule');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRule = async () => {
    if (!token || !editingRule) return;
    setLoading(true);
    setError(null);
    try {
      await updateAlertRule(token, editingRule.id, ruleData);
      setEditingRule(null);
      await loadRules();
    } catch (err: any) {
      setError(err.message || 'Failed to update alert rule');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!token) return;
    if (!(await showConfirm('Are you sure you want to delete this alert rule?'))) return;
    
    try {
      await deleteAlertRule(token, ruleId);
      await loadRules();
    } catch (err: any) {
      setError(err.message || 'Failed to delete alert rule');
    }
  };

  const handleTestRule = async (ruleId: string) => {
    if (!token) return;
    try {
      await testAlertRule(token, ruleId);
      showAlert('Test alert sent successfully');
    } catch (err: any) {
      setError(err.message || 'Failed to test alert rule');
    }
  };

  const openEditModal = (rule: AlertRule) => {
    setEditingRule(rule);
    setRuleData({
      name: rule.name,
      description: rule.description || '',
      condition: rule.condition,
      channels: rule.channels,
      severity: rule.severity,
      escalation: rule.escalation || { enabled: false, delayMinutes: 60, escalateTo: [] }
    });
  };

  const getMetricLabel = (metric: string) => {
    const labels: Record<string, string> = {
      'error_rate': 'Error Rate',
      'cpu_usage': 'CPU Usage',
      'memory_usage': 'Memory Usage',
      'disk_usage': 'Disk Usage',
      'api_response_time': 'API Response Time',
      'failed_logins': 'Failed Logins',
      'revenue_drop': 'Revenue Drop',
      'user_churn': 'User Churn'
    };
    return labels[metric] || metric;
  };

  const getOperatorLabel = (operator: string) => {
    const labels: Record<string, string> = {
      'gt': 'Greater Than',
      'lt': 'Less Than',
      'eq': 'Equal To',
      'gte': 'Greater Than or Equal',
      'lte': 'Less Than or Equal'
    };
    return labels[operator] || operator;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Alert Configuration</h2>
          <p className="text-sm text-slate-500 mt-1">Configure alerts and notifications</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <Plus size={16} /> Create Alert Rule
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {loading && !rules.length ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={32} className="animate-spin text-blue-600" />
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="divide-y divide-slate-100">
            {rules.length === 0 ? (
              <div className="p-8 text-center">
                <Bell size={48} className="mx-auto mb-4 text-slate-300" />
                <p className="text-slate-400 font-semibold mb-2">No alert rules configured</p>
                <p className="text-xs text-slate-500 mb-4">Create alert rules to monitor system metrics and get notified of important events.</p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
                >
                  Create Your First Alert Rule
                </button>
              </div>
            ) : (
              rules.map((rule) => (
                <div key={rule.id} className="p-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Bell size={20} className="text-blue-600" />
                        <span className="font-semibold text-slate-800">{rule.name}</span>
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                          rule.severity === 'critical' ? 'bg-red-100 text-red-700' :
                          rule.severity === 'high' ? 'bg-orange-100 text-orange-700' :
                          rule.severity === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {rule.severity.toUpperCase()}
                        </span>
                        {rule.isActive ? (
                          <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded">
                            Active
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-slate-100 text-slate-700 text-xs font-bold rounded">
                            Inactive
                          </span>
                        )}
                      </div>
                      {rule.description && (
                        <div className="text-sm text-slate-600 mb-2">{rule.description}</div>
                      )}
                      <div className="text-sm text-slate-600 space-y-1">
                        <div>
                          <strong>Condition:</strong> {getMetricLabel(rule.condition.metric)} {getOperatorLabel(rule.condition.operator)} {rule.condition.threshold}
                          {rule.condition.timeWindow && ` (within ${rule.condition.timeWindow} minutes)`}
                        </div>
                        <div>
                          <strong>Channels:</strong> {
                            [
                              rule.channels.email?.length ? `${rule.channels.email.length} email(s)` : null,
                              rule.channels.slack?.length ? `${rule.channels.slack.length} Slack channel(s)` : null,
                              rule.channels.sms?.length ? `${rule.channels.sms.length} SMS` : null,
                              rule.channels.webhook ? 'Webhook' : null
                            ].filter(Boolean).join(', ') || 'None'
                          }
                        </div>
                        {rule.triggerCount > 0 && (
                          <div className="text-xs text-slate-400">
                            Triggered {rule.triggerCount} time(s) • Last: {rule.lastTriggered ? new Date(rule.lastTriggered).toLocaleString() : 'Never'}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleTestRule(rule.id)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Test Alert"
                      >
                        <TestTube size={16} />
                      </button>
                      <button
                        onClick={() => openEditModal(rule)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit Rule"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteRule(rule.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete Rule"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {(showCreateModal || editingRule) && (
        <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => { setShowCreateModal(false); setEditingRule(null); }}>
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-800">{editingRule ? 'Edit Alert Rule' : 'Create Alert Rule'}</h2>
              <button onClick={() => { setShowCreateModal(false); setEditingRule(null); }} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Rule Name *</label>
                <input
                  type="text"
                  value={ruleData.name}
                  onChange={(e) => setRuleData({ ...ruleData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="High Error Rate Alert"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Description</label>
                <textarea
                  value={ruleData.description}
                  onChange={(e) => setRuleData({ ...ruleData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  rows={2}
                  placeholder="Alert when error rate exceeds threshold"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Metric *</label>
                  <select
                    value={ruleData.condition.metric}
                    onChange={(e) => setRuleData({ ...ruleData, condition: { ...ruleData.condition, metric: e.target.value } })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="error_rate">Error Rate</option>
                    <option value="cpu_usage">CPU Usage</option>
                    <option value="memory_usage">Memory Usage</option>
                    <option value="disk_usage">Disk Usage</option>
                    <option value="api_response_time">API Response Time</option>
                    <option value="failed_logins">Failed Logins</option>
                    <option value="revenue_drop">Revenue Drop</option>
                    <option value="user_churn">User Churn</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Operator *</label>
                  <select
                    value={ruleData.condition.operator}
                    onChange={(e) => setRuleData({ ...ruleData, condition: { ...ruleData.condition, operator: e.target.value as any } })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="gt">Greater Than</option>
                    <option value="lt">Less Than</option>
                    <option value="eq">Equal To</option>
                    <option value="gte">Greater Than or Equal</option>
                    <option value="lte">Less Than or Equal</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Threshold *</label>
                  <input
                    type="number"
                    value={ruleData.condition.threshold}
                    onChange={(e) => setRuleData({ ...ruleData, condition: { ...ruleData.condition, threshold: parseFloat(e.target.value) || 0 } })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Time Window (minutes)</label>
                  <input
                    type="number"
                    value={ruleData.condition.timeWindow}
                    onChange={(e) => setRuleData({ ...ruleData, condition: { ...ruleData.condition, timeWindow: parseInt(e.target.value) || undefined } })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="5"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Severity *</label>
                <select
                  value={ruleData.severity}
                  onChange={(e) => setRuleData({ ...ruleData, severity: e.target.value as any })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Email Addresses (comma-separated)</label>
                <input
                  type="text"
                  value={ruleData.channels.email.join(', ')}
                  onChange={(e) => setRuleData({ ...ruleData, channels: { ...ruleData.channels, email: e.target.value.split(',', 'error').map(s => s.trim()).filter(Boolean) } })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="admin@example.com, team@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Slack Webhook URL</label>
                <input
                  type="text"
                  value={ruleData.channels.webhook}
                  onChange={(e) => setRuleData({ ...ruleData, channels: { ...ruleData.channels, webhook: e.target.value } })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="https://hooks.slack.com/services/..."
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={ruleData.escalation.enabled}
                  onChange={(e) => setRuleData({ ...ruleData, escalation: { ...ruleData.escalation, enabled: e.target.checked } })}
                  className="rounded"
                />
                <label className="text-sm text-slate-700">Enable Escalation</label>
              </div>

              {ruleData.escalation.enabled && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Escalation Delay (minutes)</label>
                    <input
                      type="number"
                      value={ruleData.escalation.delayMinutes}
                      onChange={(e) => setRuleData({ ...ruleData, escalation: { ...ruleData.escalation, delayMinutes: parseInt(e.target.value) || 60 } })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => { setShowCreateModal(false); setEditingRule(null); }}
                  className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg font-semibold hover:bg-slate-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={editingRule ? handleUpdateRule : handleCreateRule}
                  disabled={loading || !ruleData.name}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                  {editingRule ? 'Update Rule' : 'Create Rule'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AlertConfiguration;

