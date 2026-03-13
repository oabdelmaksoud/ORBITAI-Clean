/**
 * System Costs Dashboard Component
 * Shows comprehensive API usage and costs - both user-initiated and system-initiated
 */

import React, { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, TrendingDown, Users, Database, Activity, Loader2, Calendar, Filter } from 'lucide-react';
import { getSystemCostBreakdown, getCurrentPeriodCosts, SystemCostBreakdown, CurrentPeriodCosts } from '../services/adminSystemCostsApi';

interface SystemCostsDashboardProps {
  token: string;
}

const SystemCostsDashboard: React.FC<SystemCostsDashboardProps> = ({ token }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [breakdown, setBreakdown] = useState<SystemCostBreakdown | null>(null);
  const [currentPeriod, setCurrentPeriod] = useState<CurrentPeriodCosts | null>(null);
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'custom'>('month');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [includeSystemCalls, setIncludeSystemCalls] = useState(true);
  const [includeUserCalls, setIncludeUserCalls] = useState(true);

  useEffect(() => {
    loadData();
  }, [token, dateRange, startDate, endDate, includeSystemCalls, includeUserCalls]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load current period costs
      const periodData = await getCurrentPeriodCosts(token);
      setCurrentPeriod(periodData);

      // Calculate date range
      let start: Date | undefined;
      let end: Date | undefined;

      if (dateRange === 'custom') {
        if (startDate && endDate) {
          start = new Date(startDate);
          end = new Date(endDate);
        }
      } else {
        const now = new Date();
        end = now;
        if (dateRange === 'today') {
          start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        } else if (dateRange === 'week') {
          start = new Date(now);
          start.setDate(now.getDate() - 7);
        } else if (dateRange === 'month') {
          start = new Date(now.getFullYear(), now.getMonth(), 1);
        }
      }

      if (start && end) {
        const breakdownData = await getSystemCostBreakdown(token, {
          startDate: start.toISOString(),
          endDate: end.toISOString(),
          includeSystemCalls,
          includeUserCalls,
          groupBy: 'day'
        });
        setBreakdown(breakdownData);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load system costs');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 4
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  if (loading && !breakdown) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <p className="text-red-800">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-slate-800">System API Costs</h2>
          <div className="flex items-center gap-2">
            <Filter size={18} className="text-slate-500" />
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as any)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
            >
              <option value="today">Today</option>
              <option value="week">Last 7 Days</option>
              <option value="month">This Month</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>
        </div>

        {dateRange === 'custom' && (
          <div className="flex items-center gap-4 mb-4">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
          </div>
        )}

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={includeUserCalls}
              onChange={(e) => setIncludeUserCalls(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm text-slate-700">Include User Calls</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={includeSystemCalls}
              onChange={(e) => setIncludeSystemCalls(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm text-slate-700">Include System Calls</span>
          </label>
        </div>
      </div>

      {/* Current Period Summary */}
      {currentPeriod && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-600">Today</span>
              <Calendar size={18} className="text-slate-400" />
            </div>
            <div className="text-2xl font-bold text-slate-800 mb-1">
              {formatCurrency(currentPeriod.today.totalCost)}
            </div>
            <div className="text-xs text-slate-500">
              {formatNumber(currentPeriod.today.totalCalls)} calls
              {' • '}
              {formatNumber(currentPeriod.today.systemCalls)} system
            </div>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-600">This Week</span>
              <TrendingUp size={18} className="text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-slate-800 mb-1">
              {formatCurrency(currentPeriod.week.totalCost)}
            </div>
            <div className="text-xs text-slate-500">
              {formatNumber(currentPeriod.week.totalCalls)} calls
              {' • '}
              {formatCurrency(currentPeriod.week.costPerDay)}/day avg
            </div>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-600">This Month</span>
              <DollarSign size={18} className="text-green-400" />
            </div>
            <div className="text-2xl font-bold text-slate-800 mb-1">
              {formatCurrency(currentPeriod.month.totalCost)}
            </div>
            <div className="text-xs text-slate-500">
              {formatNumber(currentPeriod.month.totalCalls)} calls
              {' • '}
              {formatCurrency(currentPeriod.month.costPerDay)}/day avg
            </div>
          </div>
        </div>
      )}

      {/* Cost Breakdown */}
      {breakdown && (
        <>
          {/* Total Cost Breakdown */}
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Total Cost Breakdown</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-50 rounded-lg p-4">
                <div className="text-sm text-slate-600 mb-1">Total Cost</div>
                <div className="text-2xl font-bold text-slate-800">
                  {formatCurrency(breakdown.totalCost)}
                </div>
              </div>
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="text-sm text-blue-600 mb-1">User-Initiated</div>
                <div className="text-2xl font-bold text-blue-700">
                  {formatCurrency(breakdown.userInitiatedCost)}
                </div>
                <div className="text-xs text-blue-600 mt-1">
                  {((breakdown.userInitiatedCost / breakdown.totalCost) * 100).toFixed(1)}% of total
                </div>
              </div>
              <div className="bg-purple-50 rounded-lg p-4">
                <div className="text-sm text-purple-600 mb-1">System-Initiated</div>
                <div className="text-2xl font-bold text-purple-700">
                  {formatCurrency(breakdown.systemInitiatedCost)}
                </div>
                <div className="text-xs text-purple-600 mt-1">
                  {((breakdown.systemInitiatedCost / breakdown.totalCost) * 100).toFixed(1)}% of total
                </div>
              </div>
            </div>
          </div>

          {/* By Provider */}
          {Object.keys(breakdown.byProvider).length > 0 && (
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h3 className="text-lg font-bold text-slate-800 mb-4">Costs by Provider</h3>
              <div className="space-y-3">
                {Object.entries(breakdown.byProvider)
                  .sort((a, b) => b[1].totalCost - a[1].totalCost)
                  .map(([provider, data]) => (
                    <div key={provider} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div className="flex-1">
                        <div className="font-medium text-slate-800 capitalize">{provider}</div>
                        <div className="text-xs text-slate-500 mt-1">
                          {formatNumber(data.calls)} calls • {formatNumber(data.tokens)} tokens
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-slate-800">{formatCurrency(data.totalCost)}</div>
                        <div className="text-xs text-slate-500">
                          User: {formatCurrency(data.userInitiatedCost)} • System: {formatCurrency(data.systemInitiatedCost)}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* System Operations */}
          {breakdown.systemOperations.length > 0 && (
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h3 className="text-lg font-bold text-slate-800 mb-4">System Operations Costs</h3>
              <div className="space-y-2">
                {breakdown.systemOperations.map((op) => (
                  <div key={op.operation} className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                    <div>
                      <div className="font-medium text-slate-800">{op.operation}</div>
                      <div className="text-xs text-slate-500">{formatNumber(op.calls)} calls</div>
                    </div>
                    <div className="font-bold text-purple-700">{formatCurrency(op.totalCost)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top Users */}
          {breakdown.topUsers.length > 0 && (
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h3 className="text-lg font-bold text-slate-800 mb-4">Top Users by Cost</h3>
              <div className="space-y-2">
                {breakdown.topUsers.map((user) => (
                  <div key={user.userId} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                    <div>
                      <div className="font-medium text-slate-800">{user.userId}</div>
                      <div className="text-xs text-slate-500">
                        {formatNumber(user.calls)} calls • {formatNumber(user.tokens)} tokens
                      </div>
                    </div>
                    <div className="font-bold text-blue-700">{formatCurrency(user.totalCost)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SystemCostsDashboard;




