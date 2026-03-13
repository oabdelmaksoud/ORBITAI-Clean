import React, { useState } from 'react';
import { DollarSign, TrendingUp } from 'lucide-react';
import LiveFinancialMetrics from './LiveFinancialMetrics';
import EnhancedFinancialDashboard from './EnhancedFinancialDashboard';
import SystemCostsDashboard from './SystemCostsDashboard';

interface FinancialsTabProps {
  token?: string;
}

const FinancialsTab: React.FC<FinancialsTabProps> = ({ token }) => {
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'advanced' | 'costs'>('overview');

  return (
    <div className="space-y-6">
      {/* Sub-tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-4">
          {[
            { id: 'overview', label: 'Financial Overview', icon: DollarSign },
            { id: 'advanced', label: 'Advanced Analytics', icon: TrendingUp },
            { id: 'costs', label: 'System Costs', icon: DollarSign },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveSubTab(id as any)}
              className={`
                flex items-center gap-2 py-2 px-3 border-b-2 font-medium text-sm
                ${activeSubTab === id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Sub-tab Content */}
      <div className="mt-6">
        {activeSubTab === 'overview' && <LiveFinancialMetrics token={token} />}
        {activeSubTab === 'advanced' && <EnhancedFinancialDashboard token={token} />}
        {activeSubTab === 'costs' && <SystemCostsDashboard token={token} />}
      </div>
    </div>
  );
};

export default FinancialsTab;




