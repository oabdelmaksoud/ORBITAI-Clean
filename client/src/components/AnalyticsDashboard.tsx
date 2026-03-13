import React, { useState, useEffect } from 'react';
import { TrendingUp, Users, LayoutGrid, Activity, Calendar, BarChart3, ArrowUp, ArrowDown } from 'lucide-react';
import { getAnalyticsOverview, AnalyticsOverview } from '../services/adminApiExtended';

interface AnalyticsDashboardProps {
  token: string;
}

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ token }) => {
  const [data, setData] = useState<AnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAnalytics();
  }, [token]);

  const loadAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const analyticsData = await getAnalyticsOverview(token);
      setData(analyticsData);
    } catch (err: any) {
      setError(err.message || 'Failed to load analytics');
      console.error('Failed to load analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <p className="text-red-600 font-semibold">{error}</p>
        <button
          onClick={loadAnalytics}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <p className="text-slate-600">No analytics data available</p>
        </div>
      </div>
    );
  }

  // Calculate growth percentages with null safety
  const users = data.users || { total: 0, last30Days: 0, last7Days: 0, today: 0, active: 0, byPlan: {} };
  const projects = data.projects || { total: 0, last30Days: 0, last7Days: 0, active: 0, byPhase: {} };
  const dailyTrends = data.dailyTrends || [];
  
  const userGrowth30 = users.last30Days > 0 
    ? ((users.last30Days / Math.max(users.total - users.last30Days, 1)) * 100).toFixed(1)
    : '0';
  const projectGrowth30 = projects.last30Days > 0
    ? ((projects.last30Days / Math.max(projects.total - projects.last30Days, 1)) * 100).toFixed(1)
    : '0';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Analytics Dashboard</h2>
          <p className="text-sm text-slate-500 mt-1">Overview of user and project growth</p>
        </div>
        <button
          onClick={loadAnalytics}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <Activity size={16} />
          Refresh
        </button>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Users */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Users size={24} className="text-blue-600" />
            </div>
            {parseFloat(userGrowth30) > 0 && (
              <div className="flex items-center gap-1 text-green-600 text-sm font-semibold">
                <ArrowUp size={16} />
                {userGrowth30}%
              </div>
            )}
          </div>
          <h3 className="text-2xl font-bold text-slate-800">{(users.total || 0).toLocaleString()}</h3>
          <p className="text-sm text-slate-500 mt-1">Total Users</p>
          <div className="mt-4 pt-4 border-t border-slate-100">
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Last 30 days</span>
              <span className="font-semibold text-slate-700">{users.last30Days || 0}</span>
            </div>
            <div className="flex justify-between text-xs mt-1">
              <span className="text-slate-500">Last 7 days</span>
              <span className="font-semibold text-slate-700">{users.last7Days || 0}</span>
            </div>
            <div className="flex justify-between text-xs mt-1">
              <span className="text-slate-500">Today</span>
              <span className="font-semibold text-slate-700">{users.today || 0}</span>
            </div>
          </div>
        </div>

        {/* Total Projects */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <LayoutGrid size={24} className="text-purple-600" />
            </div>
            {parseFloat(projectGrowth30) > 0 && (
              <div className="flex items-center gap-1 text-green-600 text-sm font-semibold">
                <ArrowUp size={16} />
                {projectGrowth30}%
              </div>
            )}
          </div>
          <h3 className="text-2xl font-bold text-slate-800">{(projects.total || 0).toLocaleString()}</h3>
          <p className="text-sm text-slate-500 mt-1">Total Projects</p>
          <div className="mt-4 pt-4 border-t border-slate-100">
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Last 30 days</span>
              <span className="font-semibold text-slate-700">{projects.last30Days || 0}</span>
            </div>
            <div className="flex justify-between text-xs mt-1">
              <span className="text-slate-500">Last 7 days</span>
              <span className="font-semibold text-slate-700">{projects.last7Days || 0}</span>
            </div>
            <div className="flex justify-between text-xs mt-1">
              <span className="text-slate-500">Active</span>
              <span className="font-semibold text-slate-700">{projects.active || 0}</span>
            </div>
          </div>
        </div>

        {/* Active Users */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <Activity size={24} className="text-green-600" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-slate-800">{(users.active || 0).toLocaleString()}</h3>
          <p className="text-sm text-slate-500 mt-1">Active Users</p>
          <div className="mt-4 pt-4 border-t border-slate-100">
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Active rate</span>
              <span className="font-semibold text-slate-700">
                {users.total > 0 && users.active !== undefined
                  ? (((users.active || 0) / users.total) * 100).toFixed(1)
                  : '0'}%
              </span>
            </div>
          </div>
        </div>

        {/* Daily Trends */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <TrendingUp size={24} className="text-orange-600" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-slate-800">{dailyTrends.length}</h3>
          <p className="text-sm text-slate-500 mt-1">Days Tracked</p>
          <div className="mt-4 pt-4 border-t border-slate-100">
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Avg signups/day</span>
              <span className="font-semibold text-slate-700">
                {dailyTrends.length > 0
                  ? (dailyTrends.reduce((sum, day) => sum + (day.userSignups || 0), 0) / dailyTrends.length).toFixed(1)
                  : '0'}
              </span>
            </div>
            <div className="flex justify-between text-xs mt-1">
              <span className="text-slate-500">Avg projects/day</span>
              <span className="font-semibold text-slate-700">
                {dailyTrends.length > 0
                  ? (dailyTrends.reduce((sum, day) => sum + (day.projectCreations || 0), 0) / dailyTrends.length).toFixed(1)
                  : '0'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Users by Plan */}
        {users.byPlan && Object.keys(users.byPlan).length > 0 && (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Users size={20} />
              Users by Plan
            </h3>
            <div className="space-y-3">
              {Object.entries(users.byPlan).map(([plan, count]) => (
                <div key={plan}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-slate-700">{plan}</span>
                    <span className="font-bold text-slate-800">{count}</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 transition-all"
                      style={{
                        width: `${users.total > 0 ? (count / users.total) * 100 : 0}%`
                      }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Projects by Phase */}
        {projects.byPhase && Object.keys(projects.byPhase).length > 0 && (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <LayoutGrid size={20} />
              Projects by Phase
            </h3>
            <div className="space-y-3">
              {Object.entries(projects.byPhase).map(([phase, count]) => (
                <div key={phase}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-slate-700">{phase}</span>
                    <span className="font-bold text-slate-800">{count}</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-500 transition-all"
                      style={{
                        width: `${projects.total > 0 ? (count / projects.total) * 100 : 0}%`
                      }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Daily Trends Chart */}
      {dailyTrends && dailyTrends.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <BarChart3 size={20} />
            Daily Trends (Last 30 Days)
          </h3>
          <div className="overflow-x-auto">
            <div className="min-w-full">
              <div className="grid grid-cols-7 gap-2 mb-2">
                {dailyTrends.slice(-30).map((day, index) => {
                  const maxSignups = Math.max(...dailyTrends.map(d => d.userSignups || 0), 1);
                  const maxProjects = Math.max(...dailyTrends.map(d => d.projectCreations || 0), 1);
                  
                  return (
                    <div key={index} className="flex flex-col items-center">
                      <div className="w-full flex flex-col items-center gap-1">
                        <div
                          className="w-full bg-blue-500 rounded-t"
                          style={{
                            height: `${((day.userSignups || 0) / maxSignups) * 40}px`,
                            minHeight: (day.userSignups || 0) > 0 ? '4px' : '0'
                          }}
                          title={`${day.date || 'N/A'}: ${day.userSignups || 0} signups, ${day.projectCreations || 0} projects`}
                        ></div>
                        <div
                          className="w-full bg-purple-500 rounded-b"
                          style={{
                            height: `${((day.projectCreations || 0) / maxProjects) * 40}px`,
                            minHeight: (day.projectCreations || 0) > 0 ? '4px' : '0'
                          }}
                        ></div>
                      </div>
                      <span className="text-xs text-slate-500 mt-1">
                        {day.date ? new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'N/A'}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-center gap-4 mt-4 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-500 rounded"></div>
                  <span className="text-slate-600">User Signups</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-purple-500 rounded"></div>
                  <span className="text-slate-600">Project Creations</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalyticsDashboard;

