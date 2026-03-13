import React, { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, TrendingDown, Users, AlertTriangle, RefreshCw, Loader2, Calendar, BarChart3 } from 'lucide-react';
import { getRevenueForecast, getLTV, getChurnImpact, ForecastResponse, LTVResponse, ChurnImpactResponse } from '../services/financialAdvancedApi';

interface EnhancedFinancialDashboardProps {
  token: string;
}

const EnhancedFinancialDashboard: React.FC<EnhancedFinancialDashboardProps> = ({ token }) => {
  const [activeView, setActiveView] = useState<'forecast' | 'ltv' | 'churn-impact'>('forecast');
  const [forecastData, setForecastData] = useState<ForecastResponse | null>(null);
  const [ltvData, setLtvData] = useState<LTVResponse | null>(null);
  const [churnImpactData, setChurnImpactData] = useState<ChurnImpactResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [activeView, token]);

  const loadData = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      switch (activeView) {
        case 'forecast':
          const forecast = await getRevenueForecast(token);
          setForecastData(forecast);
          break;
        case 'ltv':
          const ltv = await getLTV(token);
          setLtvData(ltv);
          break;
        case 'churn-impact':
          const churn = await getChurnImpact(token);
          setChurnImpactData(churn);
          break;
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load financial data');
      console.error('Failed to load financial data:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
  };

  if (loading && !forecastData && !ltvData && !churnImpactData) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600">Loading financial data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <p className="text-red-600 font-semibold">{error}</p>
        <button
          onClick={loadData}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* View Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        {[
          { id: 'forecast', label: 'Revenue Forecast', icon: TrendingUp },
          { id: 'ltv', label: 'Lifetime Value', icon: DollarSign },
          { id: 'churn-impact', label: 'Churn Impact', icon: AlertTriangle }
        ].map((view) => (
          <button
            key={view.id}
            onClick={() => setActiveView(view.id as any)}
            className={`px-4 py-2 font-medium text-sm transition-colors border-b-2 ${
              activeView === view.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <view.icon size={16} className="inline mr-2" />
            {view.label}
          </button>
        ))}
        <button
          onClick={loadData}
          className="ml-auto px-3 py-2 text-slate-500 hover:text-slate-700 transition-colors"
          title="Refresh"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Forecast View */}
      {activeView === 'forecast' && forecastData && (
        <div className="space-y-6">
          {/* Current Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-6 rounded-xl border border-slate-200">
              <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Current MRR</p>
              <p className="text-2xl font-bold text-slate-800">{formatCurrency(forecastData.currentMRR)}</p>
            </div>
            <div className="bg-white p-6 rounded-xl border border-slate-200">
              <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Current ARR</p>
              <p className="text-2xl font-bold text-slate-800">{formatCurrency(forecastData.currentARR)}</p>
            </div>
            <div className="bg-white p-6 rounded-xl border border-slate-200">
              <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Current Users</p>
              <p className="text-2xl font-bold text-slate-800">{forecastData.currentUsers.toLocaleString()}</p>
            </div>
            <div className="bg-white p-6 rounded-xl border border-slate-200">
              <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Avg Growth Rate</p>
              <p className="text-2xl font-bold text-slate-800">{forecastData.avgGrowthRate.toFixed(1)}%</p>
            </div>
          </div>

          {/* Forecast Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50">
              <h3 className="font-bold text-slate-800">12-Month Revenue Forecast</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase">Month</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-slate-600 uppercase">Projected MRR</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-slate-600 uppercase">Projected ARR</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-slate-600 uppercase">Projected Users</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-slate-600 uppercase">Growth Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {forecastData.forecast.map((month, index) => (
                    <tr key={month.month} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-800">{month.monthName}</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-800">{formatCurrency(month.projectedMRR)}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(month.projectedARR)}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{month.projectedUsers.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`inline-flex items-center gap-1 ${month.growthRate >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {month.growthRate >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                          {month.growthRate.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* LTV View */}
      {activeView === 'ltv' && ltvData && (
        <div className="space-y-6">
          {/* Overall LTV */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-6 rounded-xl border border-slate-200">
              <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Average Lifespan</p>
              <p className="text-2xl font-bold text-slate-800">{ltvData.avgLifespan.toFixed(1)} months</p>
            </div>
            <div className="bg-white p-6 rounded-xl border border-slate-200">
              <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Overall LTV</p>
              <p className="text-2xl font-bold text-blue-600">{formatCurrency(ltvData.overallLTV)}</p>
            </div>
            <div className="bg-white p-6 rounded-xl border border-slate-200">
              <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Total Potential LTV</p>
              <p className="text-2xl font-bold text-emerald-600">{formatCurrency(ltvData.totalPotentialLTV)}</p>
            </div>
          </div>

          {/* LTV by Plan */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50">
              <h3 className="font-bold text-slate-800">Lifetime Value by Plan</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase">Plan</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-slate-600 uppercase">Monthly Price</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-slate-600 uppercase">Avg Lifespan</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-slate-600 uppercase">Avg LTV</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-slate-600 uppercase">Users</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-slate-600 uppercase">Total LTV</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {Object.entries(ltvData.ltvByPlan).map(([plan, data]: [string, any]) => (
                    <tr key={plan} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-800">{plan}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(data.monthlyPrice)}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{data.avgLifespan.toFixed(1)} months</td>
                      <td className="px-4 py-3 text-right font-semibold text-blue-600">{formatCurrency(data.avgLTV)}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{data.userCount}</td>
                      <td className="px-4 py-3 text-right font-semibold text-emerald-600">{formatCurrency(data.totalLTV)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Churn Impact View */}
      {activeView === 'churn-impact' && churnImpactData && (
        <div className="space-y-6">
          {/* Current Scenario */}
          <div className="bg-white p-6 rounded-xl border border-slate-200">
            <h3 className="font-bold text-slate-800 mb-4">Current Churn Impact</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Churned Users</p>
                <p className="text-2xl font-bold text-red-600">{churnImpactData.scenarios.current.churnedUsers}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Lost MRR</p>
                <p className="text-2xl font-bold text-red-600">{formatCurrency(churnImpactData.scenarios.current.lostMRR)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Lost ARR</p>
                <p className="text-2xl font-bold text-red-600">{formatCurrency(churnImpactData.scenarios.current.lostARR)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Churn Rate</p>
                <p className="text-2xl font-bold text-red-600">{churnImpactData.scenarios.current.churnRate.toFixed(1)}%</p>
              </div>
            </div>
          </div>

          {/* At-Risk Scenario */}
          <div className="bg-orange-50 border border-orange-200 p-6 rounded-xl">
            <h3 className="font-bold text-orange-800 mb-4">If At-Risk Users Churn</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs font-semibold text-orange-700 uppercase mb-1">Potential Churned</p>
                <p className="text-2xl font-bold text-orange-800">{churnImpactData.scenarios.ifAtRiskChurn.potentialChurnedUsers}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-orange-700 uppercase mb-1">Potential Lost MRR</p>
                <p className="text-2xl font-bold text-orange-800">{formatCurrency(churnImpactData.scenarios.ifAtRiskChurn.potentialLostMRR)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-orange-700 uppercase mb-1">Total Impact MRR</p>
                <p className="text-2xl font-bold text-orange-800">{formatCurrency(churnImpactData.scenarios.ifAtRiskChurn.totalImpactMRR)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-orange-700 uppercase mb-1">Total Impact ARR</p>
                <p className="text-2xl font-bold text-orange-800">{formatCurrency(churnImpactData.scenarios.ifAtRiskChurn.totalImpactARR)}</p>
              </div>
            </div>
          </div>

          {/* Churn by Plan */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50">
              <h3 className="font-bold text-slate-800">Churn by Plan</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase">Plan</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-slate-600 uppercase">Churned Users</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-slate-600 uppercase">Lost MRR</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-slate-600 uppercase">Lost ARR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {Object.entries(churnImpactData.churnByPlan).map(([plan, data]: [string, any]) => (
                    <tr key={plan} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-800">{plan}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{data.count}</td>
                      <td className="px-4 py-3 text-right font-semibold text-red-600">{formatCurrency(data.lostMRR)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-red-600">{formatCurrency(data.lostARR)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recommendations */}
          {churnImpactData.recommendations.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 p-6 rounded-xl">
              <h3 className="font-bold text-blue-800 mb-3">Recommendations</h3>
              <ul className="space-y-2">
                {churnImpactData.recommendations.map((rec, index) => (
                  <li key={index} className="flex items-start gap-2 text-blue-700">
                    <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EnhancedFinancialDashboard;
















