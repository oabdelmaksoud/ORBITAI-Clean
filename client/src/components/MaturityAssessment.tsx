import React, { useState } from 'react';
import { TrendingUp, Target, CheckCircle2, Shield, Search, Info, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { MaturityAssessment as MaturityAssessmentType, getCriteriaDescription } from '@src/utils/maturityAssessment';

interface MaturityAssessmentProps {
  assessment: MaturityAssessmentType;
  showDetails?: boolean;
  compact?: boolean;
}

const MaturityAssessment: React.FC<MaturityAssessmentProps> = ({
  assessment,
  showDetails = true,
  compact = false
}) => {
  const [showAIInsights, setShowAIInsights] = useState(false);
  const criteriaConfig = [
    {
      key: 'clarity' as const,
      label: 'Clarity',
      icon: Target,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200'
    },
    {
      key: 'feasibility' as const,
      label: 'Feasibility',
      icon: CheckCircle2,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200'
    },
    {
      key: 'completeness' as const,
      label: 'Completeness',
      icon: TrendingUp,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200'
    },
    {
      key: 'standards' as const,
      label: 'Standards',
      icon: Shield,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
      borderColor: 'border-indigo-200'
    },
    {
      key: 'research' as const,
      label: 'Research',
      icon: Search,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-200'
    }
  ];

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-600';
    if (score >= 60) return 'text-blue-600';
    if (score >= 40) return 'text-amber-600';
    return 'text-slate-400';
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 80) return 'bg-emerald-50';
    if (score >= 60) return 'bg-blue-50';
    if (score >= 40) return 'bg-amber-50';
    return 'bg-slate-50';
  };

  if (compact) {
    return (
      <div className={`${assessment.bgColor} ${assessment.borderColor} border rounded-lg p-3`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <TrendingUp size={16} className={assessment.color} />
            <span className={`text-xs font-bold ${assessment.color} uppercase tracking-wider`}>
              Maturity: {assessment.level.replace('-', ' ')}
            </span>
          </div>
          <span className={`text-sm font-bold ${assessment.color}`}>
            {assessment.overall}%
          </span>
        </div>
        <div className="grid grid-cols-5 gap-1">
          {criteriaConfig.map((config) => {
            const score = assessment.criteria[config.key];
            return (
              <div
                key={config.key}
                className="text-center"
                title={`${config.label}: ${score}% - ${getCriteriaDescription(config.key)}`}
              >
                <div className={`text-[10px] font-semibold ${getScoreColor(score)}`}>
                  {score}%
                </div>
                <div className="text-[8px] text-slate-500 mt-0.5">{config.label.substring(0, 3)}</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className={`${assessment.bgColor} ${assessment.borderColor} border rounded-xl shadow-sm overflow-visible`}>
      {/* Header */}
      <div className="p-3 bg-white/50 border-b border-slate-200/50 flex items-center justify-between rounded-t-xl overflow-hidden">
        <div className="flex items-center gap-2">
          <TrendingUp size={16} className={assessment.color} />
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Live Maturity Assessment
          </h3>
          {assessment.isAIPowered && (
            <div className="flex items-center gap-1 px-1.5 py-0.5 bg-purple-50 border border-purple-200 rounded text-[8px] font-semibold text-purple-700">
              <Sparkles size={10} />
              AI
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-lg font-bold ${assessment.color}`}>
            {assessment.overall}%
          </span>
          <span className={`text-xs font-semibold ${assessment.color} px-2 py-0.5 rounded ${assessment.bgColor} border ${assessment.borderColor}`}>
            {assessment.level.replace('-', ' ').toUpperCase()}
          </span>
        </div>
      </div>

      {/* Criteria Details */}
      {showDetails && (
        <div className="p-4 space-y-3 relative">
          {criteriaConfig.map((config, index) => {
            const score = assessment.criteria[config.key];
            const Icon = config.icon;
            const percentage = score;
            const isLastItem = index === criteriaConfig.length - 1;
            
            return (
              <div key={config.key} className="space-y-1.5 group/item">
                <div className="flex items-center justify-between">
                  <div className="relative flex items-center gap-2">
                    <Icon size={14} className={config.color} />
                    <span className="text-xs font-semibold text-slate-700 cursor-help">
                      {config.label}
                    </span>
                    <Info size={12} className="text-slate-400 group-hover/item:text-slate-600 transition-colors" />
                    {/* Tooltip on hover - positioned above for last item, below for others */}
                    <div className={`absolute left-0 w-72 p-3 bg-slate-900 text-white text-[10px] leading-relaxed rounded-lg shadow-xl opacity-0 group-hover/item:opacity-100 transition-opacity duration-200 z-[9999] pointer-events-none whitespace-normal ${
                      isLastItem ? 'bottom-6' : 'top-6'
                    }`}>
                      <div className="font-semibold mb-1.5 text-white border-b border-slate-700 pb-1">
                        {config.label}
                      </div>
                      <div className="text-slate-300">
                        {assessment.aiInsights?.[config.key] || getCriteriaDescription(config.key)}
                      </div>
                    </div>
                  </div>
                  <span className={`text-xs font-bold ${getScoreColor(score)}`}>
                    {percentage}%
                  </span>
                </div>
                <div className="relative h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`absolute inset-y-0 left-0 ${getScoreBgColor(score)} transition-all duration-500 ease-out`}
                    style={{ width: `${percentage}%` }}
                  >
                    <div
                      className={`h-full ${getScoreColor(score).replace('text-', 'bg-')} opacity-60`}
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>
              </div>
            );
          })}

          {/* AI-Powered Insights and Recommendations */}
          {(assessment.aiInsights || assessment.aiRecommendations || assessment.aiReasoning) && (
            <div className="mt-4 pt-4 border-t border-slate-200">
              <button
                onClick={() => setShowAIInsights(!showAIInsights)}
                className="w-full flex items-center justify-between p-2 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors group"
              >
                <div className="flex items-center gap-2">
                  <Sparkles size={14} className="text-purple-600" />
                  <span className="text-xs font-semibold text-purple-700">
                    AI Insights & Recommendations
                  </span>
                </div>
                {showAIInsights ? (
                  <ChevronUp size={14} className="text-purple-600" />
                ) : (
                  <ChevronDown size={14} className="text-purple-600" />
                )}
              </button>

              {showAIInsights && (
                <div className="mt-2 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                  {/* AI Reasoning */}
                  {assessment.aiReasoning && (
                    <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                      <div className="text-[10px] font-semibold text-purple-700 mb-1.5">
                        Overall Assessment
                      </div>
                      <div className="text-xs text-slate-700 leading-relaxed">
                        {assessment.aiReasoning}
                      </div>
                    </div>
                  )}

                  {/* Recommendations */}
                  {assessment.aiRecommendations && assessment.aiRecommendations.length > 0 && (
                    <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="text-[10px] font-semibold text-blue-700 mb-2">
                        Recommendations
                      </div>
                      <ul className="space-y-1.5">
                        {assessment.aiRecommendations.map((rec, index) => (
                          <li key={index} className="flex items-start gap-2 text-xs text-slate-700">
                            <span className="text-blue-500 mt-0.5">•</span>
                            <span className="leading-relaxed">{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MaturityAssessment;

