import React, { useState, useEffect } from 'react';
import { Users, TrendingDown, AlertTriangle, BarChart3, PieChart, Activity, RefreshCw, Loader2, Target, Clock } from 'lucide-react';
import { getChurnPrediction, getUserSegmentation, getUserLifecycle, ChurnPrediction, UserSegmentationResponse, UserLifecycleResponse } from '../services/userAnalyticsApi';

interface UserAnalyticsDeepDiveProps {
  token: string;
}

const UserAnalyticsDeepDive: React.FC<UserAnalyticsDeepDiveProps> = ({ token }) => {
  const [activeView, setActiveView] = useState<'churn' | 'segmentation' | 'lifecycle'>('churn');
  const [churnData, setChurnData] = useState<{ predictions: ChurnPrediction[]; summary: any } | null>(null);
  const [segmentationData, setSegmentationData] = useState<UserSegmentationResponse | null>(null);
  const [lifecycleData, setLifecycleData] = useState<UserLifecycleResponse | null>(null);
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
        case 'churn':
          const churn = await getChurnPrediction(token);
          setChurnData(churn);
          break;
        case 'segmentation':
          const seg = await getUserSegmentation(token);
          setSegmentationData(seg);
          break;
        case 'lifecycle':
          const life = await getUserLifecycle(token);
          setLifecycleData(life);
          break;
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load analytics');
      console.error('Failed to load user analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-300';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      default: return 'bg-green-100 text-green-800 border-green-300';
    }
  };

  if (loading && !churnData && !segmentationData && !lifecycleData) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600">Loading user analytics...</p>
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
          { id: 'churn', label: 'Churn Prediction', icon: TrendingDown },
          { id: 'segmentation', label: 'User Segmentation', icon: PieChart },
          { id: 'lifecycle', label: 'Lifecycle Analysis', icon: Activity }
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

      {/* Churn Prediction View */}
      {activeView === 'churn' && churnData && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {[
              { label: 'Total Users', value: churnData.summary.total, color: 'bg-blue-100 text-blue-800' },
              { label: 'Critical Risk', value: churnData.summary.critical, color: 'bg-red-100 text-red-800' },
              { label: 'High Risk', value: churnData.summary.high, color: 'bg-orange-100 text-orange-800' },
              { label: 'Medium Risk', value: churnData.summary.medium, color: 'bg-yellow-100 text-yellow-800' },
              { label: 'Low Risk', value: churnData.summary.low, color: 'bg-green-100 text-green-800' }
            ].map((stat) => (
              <div key={stat.label} className={`p-4 rounded-lg ${stat.color}`}>
                <p className="text-xs font-semibold uppercase mb-1">{stat.label}</p>
                <p className="text-2xl font-bold">{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Churn Predictions Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50">
              <h3 className="font-bold text-slate-800">Churn Risk Analysis</h3>
              <p className="text-xs text-slate-500 mt-1">Users sorted by churn risk score</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase">User</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase">Plan</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase">Risk Level</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase">Risk Score</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase">Days Inactive</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase">Predicted Churn</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {churnData.predictions.slice(0, 50).map((prediction, index) => (
                    <tr key={prediction.userId || `prediction-${index}`} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-slate-800">{prediction.name}</p>
                          <p className="text-xs text-slate-500">{prediction.email}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">{prediction.plan}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${getRiskColor(prediction.riskLevel)}`}>
                          {prediction.riskLevel}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-slate-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${
                                prediction.riskScore >= 70 ? 'bg-red-600' :
                                prediction.riskScore >= 50 ? 'bg-orange-600' :
                                prediction.riskScore >= 30 ? 'bg-yellow-600' : 'bg-green-600'
                              }`}
                              style={{ width: `${prediction.riskScore}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium text-slate-700">{prediction.riskScore}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{prediction.daysSinceLastActivity}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {prediction.predictedChurnDate
                          ? new Date(prediction.predictedChurnDate).toLocaleDateString()
                          : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Segmentation View */}
      {activeView === 'segmentation' && segmentationData && (
        <div className="space-y-6">
          {/* Segment Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(segmentationData.segmentStats).map(([segment, stats]: [string, any]) => (
              <div key={segment} className="bg-white p-6 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-slate-800 capitalize">{segment.replace(/([A-Z])/g, ' $1').trim()}</h3>
                  <span className="text-2xl font-bold text-blue-600">{stats.count}</span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Percentage</span>
                    <span className="font-medium">{stats.percentage.toFixed(1)}%</span>
                  </div>
                  {stats.avgProjects !== undefined && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Avg Projects</span>
                      <span className="font-medium">{stats.avgProjects.toFixed(1)}</span>
                    </div>
                  )}
                  {stats.avgActivity !== undefined && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Avg Activity</span>
                      <span className="font-medium">{stats.avgActivity.toFixed(1)}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Segment Details */}
          <div className="bg-white rounded-xl border border-slate-200">
            <div className="p-4 border-b border-slate-200 bg-slate-50">
              <h3 className="font-bold text-slate-800">User Segments</h3>
            </div>
            <div className="p-4 space-y-4">
              {Object.entries(segmentationData.segments).map(([segment, users]: [string, any[]]) => (
                <div key={segment} className="border border-slate-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-slate-800 capitalize">{segment.replace(/([A-Z])/g, ' $1').trim()}</h4>
                    <span className="text-sm text-slate-500">{users.length} users</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {users.slice(0, 9).map((user, index) => (
                      <div key={user.userId || `user-${segment}-${index}`} className="p-2 bg-slate-50 rounded text-sm">
                        <p className="font-medium text-slate-800">{user.name}</p>
                        <p className="text-xs text-slate-500">{user.email}</p>
                        <p className="text-xs text-slate-400 mt-1">{user.plan} • {user.projectCount} projects</p>
                      </div>
                    ))}
                  </div>
                  {users.length > 9 && (
                    <p className="text-xs text-slate-500 mt-2">+{users.length - 9} more users</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Lifecycle View */}
      {activeView === 'lifecycle' && lifecycleData && (
        <div className="space-y-6">
          {/* Stage Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {lifecycleData.stageStats.map((stat) => (
              <div key={stat.stage} className="bg-white p-4 rounded-xl border border-slate-200 text-center">
                <p className="text-xs font-semibold text-slate-500 uppercase mb-2">{stat.stage}</p>
                <p className="text-2xl font-bold text-blue-600 mb-1">{stat.count}</p>
                <p className="text-xs text-slate-400">{stat.percentage.toFixed(1)}%</p>
              </div>
            ))}
          </div>

          {/* Lifecycle Stages */}
          <div className="bg-white rounded-xl border border-slate-200">
            <div className="p-4 border-b border-slate-200 bg-slate-50">
              <h3 className="font-bold text-slate-800">User Lifecycle Stages</h3>
            </div>
            <div className="p-4 space-y-4">
              {Object.entries(lifecycleData.lifecycleStages).map(([stage, users]: [string, any[]]) => (
                <div key={stage} className="border border-slate-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-slate-800 capitalize">{stage}</h4>
                    <span className="text-sm text-slate-500">{users.length} users</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
                    {users.slice(0, 8).map((user, index) => (
                      <div key={user.userId || `user-${stage}-${index}`} className="p-2 bg-slate-50 rounded text-sm">
                        <p className="font-medium text-slate-800">{user.name}</p>
                        <p className="text-xs text-slate-500">{user.email}</p>
                        <div className="flex gap-2 mt-1 text-xs text-slate-400">
                          <span>{user.daysSinceSignup}d old</span>
                          <span>•</span>
                          <span>{user.activityCount} activities</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {users.length > 8 && (
                    <p className="text-xs text-slate-500 mt-2">+{users.length - 8} more users</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserAnalyticsDeepDive;



