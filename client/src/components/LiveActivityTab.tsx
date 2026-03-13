/**
 * Live Activity Tab Component
 * Advanced visualization of real-time LLM usage and user activity
 */

import React, { useState, useMemo } from 'react';
import {
  Activity,
  Brain,
  Users,
  Zap,
  AlertTriangle,
  TrendingUp,
  Clock,
  Filter,
  Search,
  RefreshCw,
  PlayCircle,
  User,
  FileText,
  CreditCard,
  Shield,
  XCircle,
  CheckCircle
} from 'lucide-react';
import { useLiveActivityData } from '../hooks/useLiveActivityData';
import { LiveSparkline } from './charts/LiveSparkline';
import { StackedBar, StackedBarSeries } from './charts/StackedBar';
import { ActivityEvent } from '../services/activityApi';

interface LiveActivityTabProps {
  token: string;
}

const LiveActivityTab: React.FC<LiveActivityTabProps> = ({ token }) => {
  const { liveLLMUsage, recentActivity, trends, lastUpdate, loading, error, timeRange, setTimeRange } = useLiveActivityData(token, 10000, '5min');
  const [filterType, setFilterType] = useState<'all' | 'llm' | 'user' | 'agent'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Filter activities
  const filteredActivities = useMemo(() => {
    let activities = recentActivity;

    // Filter by type
    if (filterType === 'llm') {
      activities = activities.filter(a => a.type === 'api_call');
    } else if (filterType === 'user') {
      activities = activities.filter(a => 
        !a.type.includes('api_call') && !a.type.includes('agent_')
      );
    } else if (filterType === 'agent') {
      activities = activities.filter(a => a.type.includes('agent_'));
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      activities = activities.filter(a =>
        a.userEmail?.toLowerCase().includes(query) ||
        a.type?.toLowerCase().includes(query) ||
        JSON.stringify(a.details).toLowerCase().includes(query)
      );
    }

    return activities.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [recentActivity, filterType, searchQuery]);

  // Prepare chart data
  const modelUsageData: StackedBarSeries[] = useMemo(() => {
    if (!liveLLMUsage) return [];
    return trends.topModels.slice(0, 8).map((model, idx) => ({
      label: model.model,
      value: model.calls,
      color: `hsl(${idx * 45}, 70%, 50%)`
    }));
  }, [trends.topModels, liveLLMUsage]);

  const userActivityData: StackedBarSeries[] = useMemo(() => {
    return trends.topUsers.slice(0, 8).map((user, idx) => ({
      label: user.userId.substring(0, 8) + '...',
      value: user.count,
      color: `hsl(${idx * 30 + 180}, 70%, 50%)`
    }));
  }, [trends.topUsers]);

  // Activity type icons
  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'user_login':
      case 'user_logout':
        return <User className="w-4 h-4" />;
      case 'project_created':
      case 'project_updated':
      case 'project_deleted':
        return <FileText className="w-4 h-4" />;
      case 'payment_success':
      case 'payment_failed':
        return <CreditCard className="w-4 h-4" />;
      case 'api_call':
        return <Brain className="w-4 h-4" />;
      case 'error':
        return <AlertTriangle className="w-4 h-4" />;
      case 'admin_action':
        return <Shield className="w-4 h-4" />;
      case 'agent_assessment_started':
      case 'agent_refinement_started':
        return <PlayCircle className="w-4 h-4" />;
      case 'agent_assessment_completed':
      case 'agent_refinement_completed':
        return <CheckCircle className="w-4 h-4" />;
      case 'agent_assessment_failed':
        return <XCircle className="w-4 h-4" />;
      default:
        return <Activity className="w-4 h-4" />;
    }
  };

  // Activity type colors
  const getActivityColor = (type: string) => {
    switch (type) {
      case 'user_login':
        return 'bg-green-100 text-green-700';
      case 'user_logout':
        return 'bg-slate-100 text-slate-700';
      case 'project_created':
        return 'bg-blue-100 text-blue-700';
      case 'project_updated':
        return 'bg-indigo-100 text-indigo-700';
      case 'project_deleted':
        return 'bg-red-100 text-red-700';
      case 'payment_success':
        return 'bg-emerald-100 text-emerald-700';
      case 'payment_failed':
        return 'bg-red-100 text-red-700';
      case 'api_call':
        return 'bg-purple-100 text-purple-700';
      case 'error':
        return 'bg-red-100 text-red-700';
      case 'admin_action':
        return 'bg-yellow-100 text-yellow-700';
      case 'agent_assessment_started':
      case 'agent_refinement_started':
        return 'bg-cyan-100 text-cyan-700';
      case 'agent_assessment_completed':
      case 'agent_refinement_completed':
        return 'bg-teal-100 text-teal-700';
      case 'agent_assessment_failed':
        return 'bg-orange-100 text-orange-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <AlertTriangle className="w-8 h-8 text-red-600 mx-auto mb-2" />
        <p className="text-red-700 font-semibold">Error loading live activity</p>
        <p className="text-red-600 text-sm mt-1">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Activity className="w-6 h-6 text-blue-600" />
            Live Activity Monitor
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Real-time platform activity • Last updated: {lastUpdate.toLocaleTimeString()}
            {loading && <span className="ml-2 text-blue-600">Updating...</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
            {(['5min', '15min', '30min', '1hr', '1day'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
                  timeRange === range
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                {range === '1day' ? '1 Day' : range === '1hr' ? '1 Hour' : range}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Real-time KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl border border-blue-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-blue-600" />
              <span className="text-xs font-bold text-slate-600 uppercase">Call Rate</span>
            </div>
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          </div>
          <div className="text-3xl font-bold text-slate-800 mb-1">
            {trends.callRate.toFixed(1)}
          </div>
          <div className="text-xs text-slate-600">calls per minute</div>
          <div className="mt-3">
            <LiveSparkline
              data={[trends.callRate * 0.8, trends.callRate * 0.9, trends.callRate, trends.callRate * 1.1]}
              color="#3b82f6"
              showArea
            />
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-xl border border-purple-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-purple-600" />
              <span className="text-xs font-bold text-slate-600 uppercase">Token Throughput</span>
            </div>
          </div>
          <div className="text-3xl font-bold text-slate-800 mb-1">
            {(trends.tokenThroughput / 1000).toFixed(1)}K
          </div>
          <div className="text-xs text-slate-600">tokens ({timeRange === '1day' ? 'last 24h' : timeRange === '1hr' ? 'last 1h' : `last ${timeRange}`})</div>
          <div className="mt-3">
            <LiveSparkline
              data={[
                trends.tokenThroughput * 0.7 / 1000,
                trends.tokenThroughput * 0.85 / 1000,
                trends.tokenThroughput / 1000,
                trends.tokenThroughput * 1.15 / 1000
              ]}
              color="#9333ea"
              showArea
            />
          </div>
        </div>

        {/* Running Cost KPI */}
        <div className="bg-gradient-to-br from-amber-50 to-amber-100 p-6 rounded-xl border border-amber-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-amber-600" />
              <span className="text-xs font-bold text-slate-600 uppercase">Running Cost</span>
            </div>
            <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
          </div>
          <div className="text-3xl font-bold text-slate-800 mb-1">
            ${liveLLMUsage?.cost?.toFixed(4) || '0.0000'}
          </div>
          <div className="text-xs text-slate-600">cost ({timeRange === '1day' ? 'last 24h' : timeRange === '1hr' ? 'last 1h' : `last ${timeRange}`})</div>
          <div className="mt-3">
            <LiveSparkline
              data={[
                (liveLLMUsage?.cost || 0) * 0.6,
                (liveLLMUsage?.cost || 0) * 0.8,
                (liveLLMUsage?.cost || 0),
                (liveLLMUsage?.cost || 0) * 1.1
              ]}
              color="#d97706"
              showArea
            />
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 p-6 rounded-xl border border-emerald-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-600" />
              <span className="text-xs font-bold text-slate-600 uppercase">Active Users</span>
            </div>
          </div>
          <div className="text-3xl font-bold text-slate-800 mb-1">
            {trends.activeUsers.size}
          </div>
          <div className="text-xs text-slate-600">users ({timeRange === '1day' ? 'last 24h' : timeRange === '1hr' ? 'last 1h' : `last ${timeRange}`})</div>
          <div className="mt-3 flex items-center gap-2">
            {Array.from(trends.activeUsers).slice(0, 5).map((userId, idx) => (
              <div
                key={userId}
                className="w-8 h-8 rounded-full bg-emerald-200 flex items-center justify-center text-xs font-semibold text-emerald-800"
                title={userId}
              >
                {userId.substring(0, 2).toUpperCase()}
              </div>
            ))}
            {trends.activeUsers.size > 5 && (
              <div className="text-xs text-slate-500">+{trends.activeUsers.size - 5}</div>
            )}
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-50 to-red-100 p-6 rounded-xl border border-red-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <span className="text-xs font-bold text-slate-600 uppercase">Error Rate</span>
            </div>
          </div>
          <div className="text-3xl font-bold text-slate-800 mb-1">
            {(trends.errorRate * 100).toFixed(1)}%
          </div>
          <div className="text-xs text-slate-600">
            {recentActivity.filter(e => e.type === 'error').length} errors
          </div>
          <div className="mt-3">
            <div className="w-full bg-red-200 rounded-full h-2">
              <div
                className="bg-red-600 h-2 rounded-full transition-all"
                style={{ width: `${trends.errorRate * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Model Usage Chart */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Brain className="w-5 h-5" />
            Top Models by Usage
          </h3>
          {modelUsageData.length > 0 ? (
            <StackedBar
              data={modelUsageData}
              width={400}
              height={300}
              orientation="horizontal"
              showLabels
            />
          ) : (
            <div className="text-center py-12 text-slate-400">
              No model usage data available
            </div>
          )}
        </div>

        {/* User Activity Chart */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Users className="w-5 h-5" />
            Top Active Users
          </h3>
          {userActivityData.length > 0 ? (
            <StackedBar
              data={userActivityData}
              width={400}
              height={300}
              orientation="horizontal"
              showLabels
            />
          ) : (
            <div className="text-center py-12 text-slate-400">
              No user activity data available
            </div>
          )}
        </div>
      </div>

      {/* Activity Timeline & Event Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity Timeline */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Activity Timeline
            </h3>
            <div className="flex items-center gap-2">
              <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
                {(['all', 'llm', 'user', 'agent'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setFilterType(type)}
                    className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                      filterType === type
                        ? 'bg-white text-slate-800 shadow-sm'
                        : 'text-slate-600 hover:text-slate-800'
                    }`}
                  >
                    {type === 'all' ? 'All' : type === 'llm' ? 'LLM' : type === 'user' ? 'User' : 'Agent'}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filteredActivities.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                No activities found
              </div>
            ) : (
              filteredActivities.map((activity, idx) => (
                <div
                  key={activity.id || idx}
                  className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100 hover:bg-slate-100 transition-colors"
                >
                  <div className={`p-2 rounded-lg ${getActivityColor(activity.type)}`}>
                    {getActivityIcon(activity.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold text-slate-800 capitalize">
                        {activity.type.replace(/_/g, ' ')}
                      </span>
                      <span className="text-xs text-slate-500">
                        {new Date(activity.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    {activity.userEmail && (
                      <div className="text-xs text-slate-600 mb-1">
                        User: {activity.userEmail}
                      </div>
                    )}
                    {activity.entityType && (
                      <div className="text-xs text-slate-500">
                        {activity.entityType}: {activity.entityId}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Event Stream Summary */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Event Summary
          </h3>
          <div className="space-y-4">
            <div>
              <div className="text-xs text-slate-500 mb-2">Activity Types</div>
              <div className="space-y-2">
                {Object.entries(
                  filteredActivities.reduce((acc, event) => {
                    acc[event.type] = (acc[event.type] || 0) + 1;
                    return acc;
                  }, {} as Record<string, number>)
                )
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 5)
                  .map(([type, count]) => (
                    <div key={type} className="flex items-center justify-between">
                      <span className="text-sm text-slate-700 capitalize">
                        {type.replace(/_/g, ' ')}
                      </span>
                      <span className="text-sm font-semibold text-slate-800">{count}</span>
                    </div>
                  ))}
              </div>
            </div>
            <div className="pt-4 border-t border-slate-200">
              <div className="text-xs text-slate-500 mb-2">Status</div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-700">Total Events</span>
                  <span className="text-sm font-semibold text-slate-800">
                    {filteredActivities.length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-700">LLM Calls</span>
                  <span className="text-sm font-semibold text-purple-600">
                    {filteredActivities.filter(e => e.type === 'api_call').length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-700">Errors</span>
                  <span className="text-sm font-semibold text-red-600">
                    {filteredActivities.filter(e => e.type === 'error').length}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search activities by user, type, or details..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="p-2 text-slate-400 hover:text-slate-600"
            >
              <XCircle className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default LiveActivityTab;

