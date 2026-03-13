import React, { useState, useEffect, useRef } from 'react';
import { Activity, RefreshCw, Filter, X } from 'lucide-react';
import { getActivityEvents, getActivityStats, ActivityEvent, ActivityStats } from '../services/activityApi';
import { Loader2 } from 'lucide-react';

interface ActivityFeedProps {
  token: string;
}

const ActivityFeed: React.FC<ActivityFeedProps> = ({ token }) => {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [stats, setStats] = useState<ActivityStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    type: '',
    userId: '',
    entityType: ''
  });
  const [autoRefresh, setAutoRefresh] = useState(true);
  const lastEventIdRef = useRef<string | null>(null);

  useEffect(() => {
    loadData();
    if (autoRefresh) {
      const interval = setInterval(loadData, 5000); // Refresh every 5 seconds
      return () => clearInterval(interval);
    }
  }, [filters, autoRefresh]);

  const loadData = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [eventsData, statsData] = await Promise.all([
        getActivityEvents(token, { limit: 100, ...filters }),
        getActivityStats(token)
      ]);
      
      // Only update if we have new events
      if (eventsData.length > 0 && eventsData[0].id !== lastEventIdRef.current) {
        setEvents(eventsData);
        lastEventIdRef.current = eventsData[0].id;
      }
      setStats(statsData);
    } catch (err: any) {
      setError(err.message || 'Failed to load activity');
      console.error('Failed to load activity:', err);
    } finally {
      setLoading(false);
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'user_login': return '🟢';
      case 'user_logout': return '🔴';
      case 'project_created': return '➕';
      case 'project_updated': return '✏️';
      case 'project_deleted': return '🗑️';
      case 'payment_success': return '💰';
      case 'payment_failed': return '❌';
      case 'api_call': return '📡';
      case 'error': return '⚠️';
      case 'admin_action': return '⚙️';
      default: return '📋';
    }
  };

  const getEventLabel = (type: string) => {
    const labels: Record<string, string> = {
      'user_login': 'User Login',
      'user_logout': 'User Logout',
      'project_created': 'Project Created',
      'project_updated': 'Project Updated',
      'project_deleted': 'Project Deleted',
      'payment_success': 'Payment Success',
      'payment_failed': 'Payment Failed',
      'api_call': 'API Call',
      'error': 'Error',
      'admin_action': 'Admin Action'
    };
    return labels[type] || type;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Live Activity Feed</h2>
          <p className="text-sm text-slate-500 mt-1">Real-time platform activity monitoring</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
              autoRefresh
                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
            }`}
          >
            {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
          </button>
          <button
            onClick={loadData}
            className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            title="Refresh"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="text-xs font-bold text-slate-400 uppercase mb-1">Last 24h</div>
            <div className="text-2xl font-bold text-slate-800">{stats.last24Hours}</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="text-xs font-bold text-slate-400 uppercase mb-1">Last 7 Days</div>
            <div className="text-2xl font-bold text-slate-800">{stats.last7Days}</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="text-xs font-bold text-slate-400 uppercase mb-1">Last 30 Days</div>
            <div className="text-2xl font-bold text-slate-800">{stats.last30Days}</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="text-xs font-bold text-slate-400 uppercase mb-1">Active Events</div>
            <div className="text-2xl font-bold text-blue-600">{events.length}</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex gap-4">
        <select
          value={filters.type}
          onChange={(e) => setFilters({ ...filters, type: e.target.value })}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
        >
          <option value="">All Types</option>
          <option value="user_login">User Login</option>
          <option value="user_logout">User Logout</option>
          <option value="project_created">Project Created</option>
          <option value="project_updated">Project Updated</option>
          <option value="payment_success">Payment Success</option>
          <option value="error">Errors</option>
          <option value="admin_action">Admin Actions</option>
        </select>
        <input
          type="text"
          value={filters.userId}
          onChange={(e) => setFilters({ ...filters, userId: e.target.value })}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          placeholder="Filter by User ID"
        />
        <input
          type="text"
          value={filters.entityType}
          onChange={(e) => setFilters({ ...filters, entityType: e.target.value })}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          placeholder="Filter by Entity Type"
        />
        {(filters.type || filters.userId || filters.entityType) && (
          <button
            onClick={() => setFilters({ type: '', userId: '', entityType: '' })}
            className="px-3 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-300 transition-colors flex items-center gap-1"
          >
            <X size={14} /> Clear
          </button>
        )}
      </div>

      {/* Activity Feed */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden max-h-[600px] overflow-y-auto">
        {loading && events.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={32} className="animate-spin text-blue-600" />
          </div>
        ) : events.length === 0 ? (
          <div className="p-8 text-center">
            <Activity size={48} className="mx-auto mb-4 text-slate-300" />
            <p className="text-slate-400 font-semibold mb-2">No activity events found</p>
            <p className="text-xs text-slate-500">Activity events will appear here as users interact with the platform. This is normal if the system is new or has low activity.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {events.map((event) => (
              <div key={event.id} className="p-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="text-2xl">{getEventIcon(event.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-slate-800">{getEventLabel(event.type)}</span>
                      {event.userEmail && (
                        <span className="text-sm text-slate-600">by {event.userEmail}</span>
                      )}
                    </div>
                    {event.entityType && event.entityId && (
                      <div className="text-sm text-slate-600 mb-1">
                        {event.entityType}: {event.entityId}
                      </div>
                    )}
                    {event.ipAddress && (
                      <div className="text-xs text-slate-400">
                        IP: {event.ipAddress}
                        {event.location?.country && ` • ${event.location.city}, ${event.location.country}`}
                      </div>
                    )}
                    <div className="text-xs text-slate-400 mt-1">
                      {new Date(event.timestamp).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivityFeed;

