import React, { useState } from 'react';
import { BarChart3, Users, Brain } from 'lucide-react';
import AnalyticsDashboard from './AnalyticsDashboard';
import UserAnalyticsDeepDive from './UserAnalyticsDeepDive';
import LLMAnalytics from './LLMAnalytics';

interface UnifiedAnalyticsProps {
  token: string;
}

const UnifiedAnalytics: React.FC<UnifiedAnalyticsProps> = ({ token }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'user' | 'llm'>('overview');

  const tabs = [
    { id: 'overview' as const, label: 'Overview', icon: BarChart3, component: AnalyticsDashboard },
    { id: 'user' as const, label: 'User Analytics', icon: Users, component: UserAnalyticsDeepDive },
    { id: 'llm' as const, label: 'LLM Analytics', icon: Brain, component: LLMAnalytics },
  ];

  const ActiveComponent = tabs.find(t => t.id === activeTab)?.component || AnalyticsDashboard;

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-slate-200 pb-4">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 font-medium text-sm transition-colors border-b-2 ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Active Tab Content */}
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        <ActiveComponent token={token} />
      </div>
    </div>
  );
};

export default UnifiedAnalytics;




