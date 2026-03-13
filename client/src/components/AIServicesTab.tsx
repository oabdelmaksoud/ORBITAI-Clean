import React, { useState } from 'react';
import { Brain, Workflow, Sparkles } from 'lucide-react';
import NLPServiceDashboard from './NLPServiceDashboard';
import WorkflowEngineDashboard from './WorkflowEngineDashboard';
import AIOptimizationDashboard from './AIOptimizationDashboard';

interface AIServicesTabProps {
  token?: string;
}

const AIServicesTab: React.FC<AIServicesTabProps> = ({ token }) => {
  const [activeSubTab, setActiveSubTab] = useState<'nlp' | 'workflow' | 'optimization'>('nlp');

  return (
    <div className="space-y-6">
      {/* Sub-tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-4">
          {[
            { id: 'nlp', label: 'NLP Service', icon: Brain },
            { id: 'workflow', label: 'Workflow Engine', icon: Workflow },
            { id: 'optimization', label: 'AI Optimization', icon: Sparkles },
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
        {activeSubTab === 'nlp' && <NLPServiceDashboard token={token} />}
        {activeSubTab === 'workflow' && <WorkflowEngineDashboard token={token} />}
        {activeSubTab === 'optimization' && <AIOptimizationDashboard token={token} />}
      </div>
    </div>
  );
};

export default AIServicesTab;




