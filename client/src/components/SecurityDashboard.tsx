import React, { useState, useEffect } from 'react';
import { Shield, AlertTriangle, Ban, CheckCircle, Globe, Clock, X, Eye, Trash2, Plus, Filter } from 'lucide-react';
import { getSecurityEvents, getSecurityEventStats, resolveSecurityEvent, getSessions, revokeSession, getIPWhitelist, addIPWhitelist, removeIPWhitelist, SecurityEvent, Session, IPWhitelistEntry } from '../services/securityApi';
import { Loader2 } from 'lucide-react';

interface SecurityDashboardProps {
  token: string;
}

const SecurityDashboard: React.FC<SecurityDashboardProps> = ({ token }) => {
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [ipWhitelist, setIPWhitelist] = useState<IPWhitelistEntry[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'events' | 'sessions' | 'ip-management'>('events');
  const [filters, setFilters] = useState({
    type: '',
    severity: '',
    resolved: ''
  });
  const [showAddIPModal, setShowAddIPModal] = useState(false);
  const [newIPData, setNewIPData] = useState({
    ipAddress: '',
    type: 'blacklist' as 'whitelist' | 'blacklist',
    reason: '',
    expiresAt: ''
  });

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [activeTab, filters]);

  const loadData = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      if (activeTab === 'events') {
        const [eventsData, statsData] = await Promise.all([
          getSecurityEvents(token, { limit: 50, ...filters }),
          getSecurityEventStats(token)
        ]);
        setEvents(eventsData.events);
        setStats(statsData);
      } else if (activeTab === 'sessions') {
        const sessionsData = await getSessions(token);
        setSessions(sessionsData);
      } else if (activeTab === 'ip-management') {
        const ipData = await getIPWhitelist(token);
        setIPWhitelist(ipData);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load security data');
      console.error('Failed to load security data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleResolveEvent = async (eventId: string) => {
    if (!token) return;
    try {
      await resolveSecurityEvent(token, eventId);
      setEvents(events.map(e => e.id === eventId ? { ...e, resolved: true, resolvedAt: new Date().toISOString() } : e));
    } catch (err: any) {
      setError(err.message || 'Failed to resolve event');
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    if (!token) return;
    try {
      await revokeSession(token, sessionId);
      setSessions(sessions.filter(s => s.id !== sessionId));
    } catch (err: any) {
      setError(err.message || 'Failed to revoke session');
    }
  };

  const handleAddIP = async () => {
    if (!token || !newIPData.ipAddress) return;
    try {
      const ip = await addIPWhitelist(token, {
        ...newIPData,
        expiresAt: newIPData.expiresAt || undefined
      });
      setIPWhitelist([...ipWhitelist, ip]);
      setShowAddIPModal(false);
      setNewIPData({ ipAddress: '', type: 'blacklist', reason: '', expiresAt: '' });
    } catch (err: any) {
      setError(err.message || 'Failed to add IP');
    }
  };

  const handleRemoveIP = async (ipId: string) => {
    if (!token) return;
    try {
      await removeIPWhitelist(token, ipId);
      setIPWhitelist(ipWhitelist.filter(ip => ip.id !== ipId));
    } catch (err: any) {
      setError(err.message || 'Failed to remove IP');
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-700 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'low': return 'bg-blue-100 text-blue-700 border-blue-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getEventTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'failed_login': 'Failed Login',
      'suspicious_activity': 'Suspicious Activity',
      'brute_force': 'Brute Force Attack',
      'unauthorized_access': 'Unauthorized Access',
      'data_breach_attempt': 'Data Breach Attempt',
      'rate_limit_exceeded': 'Rate Limit Exceeded'
    };
    return labels[type] || type;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Security Dashboard</h2>
          <p className="text-sm text-slate-500 mt-1">Monitor and manage security threats</p>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="text-xs font-bold text-slate-400 uppercase mb-1">Total Events</div>
            <div className="text-2xl font-bold text-slate-800">{stats.total}</div>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="text-xs font-bold text-red-400 uppercase mb-1">Unresolved</div>
            <div className="text-2xl font-bold text-red-600">{stats.unresolved}</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="text-xs font-bold text-slate-400 uppercase mb-1">Last 24h</div>
            <div className="text-2xl font-bold text-slate-800">{stats.last24Hours}</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="text-xs font-bold text-slate-400 uppercase mb-1">Last 7 Days</div>
            <div className="text-2xl font-bold text-slate-800">{stats.last7Days}</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('events')}
            className={`px-4 py-2 font-semibold border-b-2 transition-colors ${
              activeTab === 'events'
                ? 'border-red-600 text-red-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Security Events
          </button>
          <button
            onClick={() => setActiveTab('sessions')}
            className={`px-4 py-2 font-semibold border-b-2 transition-colors ${
              activeTab === 'sessions'
                ? 'border-red-600 text-red-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Active Sessions
          </button>
          <button
            onClick={() => setActiveTab('ip-management')}
            className={`px-4 py-2 font-semibold border-b-2 transition-colors ${
              activeTab === 'ip-management'
                ? 'border-red-600 text-red-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            IP Management
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={32} className="animate-spin text-blue-600" />
        </div>
      ) : (
        <>
          {/* Security Events Tab */}
          {activeTab === 'events' && (
            <div className="space-y-4">
              {/* Filters */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 flex gap-4">
                <select
                  value={filters.type}
                  onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                >
                  <option value="">All Types</option>
                  <option value="failed_login">Failed Login</option>
                  <option value="suspicious_activity">Suspicious Activity</option>
                  <option value="brute_force">Brute Force</option>
                  <option value="unauthorized_access">Unauthorized Access</option>
                </select>
                <select
                  value={filters.severity}
                  onChange={(e) => setFilters({ ...filters, severity: e.target.value })}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                >
                  <option value="">All Severities</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
                <select
                  value={filters.resolved}
                  onChange={(e) => setFilters({ ...filters, resolved: e.target.value })}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                >
                  <option value="">All</option>
                  <option value="false">Unresolved</option>
                  <option value="true">Resolved</option>
                </select>
              </div>

              {/* Events List */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="divide-y divide-slate-100">
                  {events.length === 0 ? (
                    <div className="p-8 text-center">
                      <Shield size={48} className="mx-auto mb-4 text-slate-300" />
                      <p className="text-slate-400 font-semibold mb-2">No security events found</p>
                      <p className="text-xs text-slate-500">Security events will appear here when detected. This is normal if your system hasn't encountered any security issues yet.</p>
                    </div>
                  ) : (
                    events.map((event) => (
                      <div
                        key={event.id}
                        className={`p-4 hover:bg-slate-50 transition-colors ${
                          !event.resolved ? 'bg-red-50/30' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <span className={`px-2 py-1 rounded text-xs font-bold border ${getSeverityColor(event.severity)}`}>
                                {event.severity.toUpperCase()}
                              </span>
                              <span className="font-semibold text-slate-800">
                                {getEventTypeLabel(event.type)}
                              </span>
                              {!event.resolved && (
                                <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-bold rounded">
                                  UNRESOLVED
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-slate-600 space-y-1">
                              {event.email && <div>Email: {event.email}</div>}
                              <div>IP: {event.ipAddress}</div>
                              {event.location?.country && (
                                <div>Location: {event.location.city}, {event.location.country}</div>
                              )}
                              <div className="text-xs text-slate-400">
                                {new Date(event.createdAt).toLocaleString()}
                              </div>
                            </div>
                          </div>
                          {!event.resolved && (
                            <button
                              onClick={() => handleResolveEvent(event.id)}
                              className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-colors"
                            >
                              Mark Resolved
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Sessions Tab */}
          {activeTab === 'sessions' && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                <h3 className="font-bold text-slate-800">Active Sessions ({sessions.length})</h3>
              </div>
              <div className="divide-y divide-slate-100">
                {sessions.length === 0 ? (
                  <div className="p-8 text-center">
                    <Globe size={48} className="mx-auto mb-4 text-slate-300" />
                    <p className="text-slate-400 font-semibold mb-2">No active sessions</p>
                    <p className="text-xs text-slate-500">Active user sessions will appear here when users are logged in.</p>
                  </div>
                ) : (
                  sessions.map((session) => (
                    <div key={session.id} className="p-4 hover:bg-slate-50 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-semibold text-slate-800">{session.email}</div>
                          <div className="text-sm text-slate-600 space-y-1 mt-1">
                            <div>IP: {session.ipAddress}</div>
                            {session.location?.country && (
                              <div>Location: {session.location.city}, {session.location.country}</div>
                            )}
                            <div className="text-xs text-slate-400">
                              Last Activity: {new Date(session.lastActivity).toLocaleString()}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRevokeSession(session.id)}
                          className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 transition-colors"
                        >
                          Revoke
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* IP Management Tab */}
          {activeTab === 'ip-management' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-800">IP Whitelist/Blacklist</h3>
                <button
                  onClick={() => setShowAddIPModal(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <Plus size={16} /> Add IP
                </button>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="divide-y divide-slate-100">
                  {ipWhitelist.length === 0 ? (
                    <div className="p-8 text-center">
                      <Shield size={48} className="mx-auto mb-4 text-slate-300" />
                      <p className="text-slate-400 font-semibold mb-2">No IP entries</p>
                      <p className="text-xs text-slate-500 mb-4">Add IP addresses to whitelist or blacklist to control access.</p>
                      <button
                        onClick={() => setShowAddIPModal(true)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
                      >
                        Add Your First IP
                      </button>
                    </div>
                  ) : (
                    ipWhitelist.map((ip) => (
                      <div key={ip.id} className="p-4 hover:bg-slate-50 transition-colors">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <span className={`px-2 py-1 rounded text-xs font-bold ${
                                ip.type === 'whitelist' 
                                  ? 'bg-green-100 text-green-700 border border-green-200'
                                  : 'bg-red-100 text-red-700 border border-red-200'
                              }`}>
                                {ip.type.toUpperCase()}
                              </span>
                              <span className="font-semibold text-slate-800 font-mono">{ip.ipAddress}</span>
                            </div>
                            {ip.reason && (
                              <div className="text-sm text-slate-600">Reason: {ip.reason}</div>
                            )}
                            <div className="text-xs text-slate-400 mt-1">
                              Added: {new Date(ip.createdAt).toLocaleString()}
                              {ip.expiresAt && ` • Expires: ${new Date(ip.expiresAt).toLocaleString()}`}
                            </div>
                          </div>
                          <button
                            onClick={() => handleRemoveIP(ip.id)}
                            className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 transition-colors"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Add IP Modal */}
      {showAddIPModal && (
        <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowAddIPModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-800">Add IP Address</h2>
              <button onClick={() => setShowAddIPModal(false)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">IP Address *</label>
                <input
                  type="text"
                  value={newIPData.ipAddress}
                  onChange={(e) => setNewIPData({ ...newIPData, ipAddress: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="192.168.1.1"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Type *</label>
                <select
                  value={newIPData.type}
                  onChange={(e) => setNewIPData({ ...newIPData, type: e.target.value as 'whitelist' | 'blacklist' })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="whitelist">Whitelist (Allow)</option>
                  <option value="blacklist">Blacklist (Block)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Reason</label>
                <input
                  type="text"
                  value={newIPData.reason}
                  onChange={(e) => setNewIPData({ ...newIPData, reason: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="Optional reason for this entry"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Expires At (Optional)</label>
                <input
                  type="datetime-local"
                  value={newIPData.expiresAt}
                  onChange={(e) => setNewIPData({ ...newIPData, expiresAt: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => setShowAddIPModal(false)}
                  className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg font-semibold hover:bg-slate-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddIP}
                  disabled={!newIPData.ipAddress}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add IP
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SecurityDashboard;

