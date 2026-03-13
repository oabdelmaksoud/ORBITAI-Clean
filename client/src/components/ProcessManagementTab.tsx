import React, { useState } from 'react';
import { FileText, BarChart3, Workflow, Play, Database } from 'lucide-react';
import ProcessImprovementManager from './ProcessImprovementManager';
import ProcessAnalyticsDashboard from './ProcessAnalyticsDashboard';
import ProcessMiningVisualizer from './ProcessMiningVisualizer';
import ProcessSimulationDashboard from './ProcessSimulationDashboard';
import KnowledgeBaseManager from './KnowledgeBaseManager';

interface ProcessManagementTabProps {
  token?: string;
}

const ProcessManagementTab: React.FC<ProcessManagementTabProps> = ({ token }) => {
  const [activeSubTab, setActiveSubTab] = useState<'improvements' | 'analytics' | 'mining' | 'simulation' | 'knowledge-base'>('improvements');

  return (
    <div className="space-y-6">
      {/* Sub-tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-4">
          {[
            { id: 'improvements', label: 'Process Improvements', icon: FileText },
            { id: 'analytics', label: 'Process Analytics', icon: BarChart3 },
            { id: 'mining', label: 'Process Mining', icon: Workflow },
            { id: 'simulation', label: 'Process Simulation', icon: Play },
            { id: 'knowledge-base', label: 'Knowledge Base', icon: Database },
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
        {activeSubTab === 'improvements' && <ProcessImprovementManager token={token} />}
        {activeSubTab === 'analytics' && <ProcessAnalyticsDashboard token={token} />}
        {activeSubTab === 'mining' && <ProcessMiningVisualizer token={token} />}
        {activeSubTab === 'simulation' && <ProcessSimulationDashboard token={token} />}
        {activeSubTab === 'knowledge-base' && <KnowledgeBaseManager token={token} />}
      </div>
    </div>
  );
};

export default ProcessManagementTab;


