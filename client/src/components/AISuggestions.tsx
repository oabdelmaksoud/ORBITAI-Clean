import React, { useState, useEffect } from 'react';
import { Sparkles, Lightbulb, CheckCircle2, X, Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import { useFeatureAccess } from '../hooks/useFeatureAccess';
import { showAlert } from '../utils/browserUtils';

interface AISuggestion {
  id: string;
  type: 'optimization' | 'improvement' | 'best-practice' | 'security' | 'performance';
  title: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  effort: 'low' | 'medium' | 'high';
  category: string;
  actionable: boolean;
  createdAt: Date;
}

interface AISuggestionsProps {
  projectId?: string;
  projectContext?: string;
  artifacts?: any[];
  tasks?: any[];
  userRole?: string;
}

const AISuggestions: React.FC<AISuggestionsProps> = ({
  projectId,
  projectContext,
  artifacts = [],
  tasks = [],
  userRole = 'user'
}) => {
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'optimization' | 'improvement' | 'best-practice' | 'security' | 'performance'>('all');
  const [impactFilter, setImpactFilter] = useState<'all' | 'low' | 'medium' | 'high'>('all');
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const canAccessSuggestions = useFeatureAccess('ai_suggestions', userRole);

  useEffect(() => {
    if (canAccessSuggestions.enabled && projectId) {
      loadSuggestions();
    }
  }, [canAccessSuggestions.enabled, projectId, projectContext]);

  const loadSuggestions = async () => {
    if (!canAccessSuggestions.enabled) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3002'}/api/ai/suggestions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          projectId,
          projectContext,
          artifacts: artifacts.map(a => ({ id: a.id, type: a.type, title: a.title })),
          tasks: tasks.map(t => ({ id: t.id, title: t.title, status: t.status })),
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        setSuggestions(data.suggestions.map((s: any) => ({
          ...s,
          createdAt: new Date(s.createdAt),
        })));
      } else {
        throw new Error(data.message || 'Failed to load suggestions');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load AI suggestions');
      console.error('Failed to load suggestions:', err);
      
      // Fallback: Generate mock suggestions for demo
      setSuggestions(generateMockSuggestions());
    } finally {
      setLoading(false);
    }
  };

  const generateMockSuggestions = (): AISuggestion[] => {
    return [
      {
        id: '1',
        type: 'optimization',
        title: 'Optimize Code Structure',
        description: 'Consider refactoring the main component to improve maintainability and reduce complexity.',
        impact: 'high',
        effort: 'medium',
        category: 'Code Quality',
        actionable: true,
        createdAt: new Date(),
      },
      {
        id: '2',
        type: 'security',
        title: 'Add Input Validation',
        description: 'Implement input validation for user-generated content to prevent security vulnerabilities.',
        impact: 'high',
        effort: 'low',
        category: 'Security',
        actionable: true,
        createdAt: new Date(),
      },
      {
        id: '3',
        type: 'performance',
        title: 'Implement Caching',
        description: 'Add caching layer for frequently accessed data to improve response times.',
        impact: 'medium',
        effort: 'medium',
        category: 'Performance',
        actionable: true,
        createdAt: new Date(),
      },
      {
        id: '4',
        type: 'best-practice',
        title: 'Add Error Handling',
        description: 'Implement comprehensive error handling and user-friendly error messages.',
        impact: 'medium',
        effort: 'low',
        category: 'Best Practices',
        actionable: true,
        createdAt: new Date(),
      },
    ];
  };

  const handleDismiss = (id: string) => {
    setDismissedIds(prev => new Set(prev).add(id));
  };

  const handleApply = async (suggestion: AISuggestion) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3002'}/api/ai/suggestions/${suggestion.id}/apply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ projectId }),
      });

      const data = await response.json();
      
      if (data.success) {
        showAlert(`Applied suggestion: ${suggestion.title}`, 'success');
        loadSuggestions();
      } else {
        throw new Error(data.message || 'Failed to apply suggestion');
      }
    } catch (err: any) {
      showAlert(`Failed to apply suggestion: ${err.message}`, 'error');
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'optimization':
        return <RefreshCw size={16} className="text-blue-600" />;
      case 'improvement':
        return <Lightbulb size={16} className="text-yellow-600" />;
      case 'best-practice':
        return <CheckCircle2 size={16} className="text-green-600" />;
      case 'security':
        return <AlertCircle size={16} className="text-red-600" />;
      case 'performance':
        return <Sparkles size={16} className="text-purple-600" />;
      default:
        return <Sparkles size={16} className="text-slate-600" />;
    }
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'low':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const filteredSuggestions = suggestions.filter(s => {
    if (dismissedIds.has(s.id)) return false;
    if (filter !== 'all' && s.type !== filter) return false;
    if (impactFilter !== 'all' && s.impact !== impactFilter) return false;
    return true;
  });

  if (!canAccessSuggestions.enabled && !canAccessSuggestions.loading) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
        <AlertCircle size={32} className="mx-auto mb-2 text-yellow-600" />
        <h3 className="font-bold text-yellow-800 mb-1">AI Suggestions Disabled</h3>
        <p className="text-sm text-yellow-700">
          AI suggestions are not enabled for your role. Contact an administrator to enable this feature.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={20} className="text-purple-600" />
          <h2 className="text-xl font-bold text-slate-800">AI Suggestions</h2>
        </div>
        <button
          onClick={loadSuggestions}
          disabled={loading}
          className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-200 transition-colors flex items-center gap-2 disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as any)}
          className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
        >
          <option value="all">All Types</option>
          <option value="optimization">Optimization</option>
          <option value="improvement">Improvement</option>
          <option value="best-practice">Best Practice</option>
          <option value="security">Security</option>
          <option value="performance">Performance</option>
        </select>
        <select
          value={impactFilter}
          onChange={(e) => setImpactFilter(e.target.value as any)}
          className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
        >
          <option value="all">All Impact</option>
          <option value="high">High Impact</option>
          <option value="medium">Medium Impact</option>
          <option value="low">Low Impact</option>
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-red-700">
          <AlertCircle size={16} />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="animate-spin text-blue-600" size={32} />
        </div>
      )}

      {/* Suggestions List */}
      {!loading && filteredSuggestions.length === 0 && (
        <div className="text-center py-8 text-slate-500">
          <Sparkles size={32} className="mx-auto mb-2 opacity-50" />
          <p>No suggestions available</p>
        </div>
      )}

      {!loading && filteredSuggestions.length > 0 && (
        <div className="space-y-3">
          {filteredSuggestions.map((suggestion) => (
            <div
              key={suggestion.id}
              className="bg-white border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {getTypeIcon(suggestion.type)}
                    <h3 className="font-semibold text-slate-800">{suggestion.title}</h3>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getImpactColor(suggestion.impact)}`}>
                      {suggestion.impact} impact
                    </span>
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">
                      {suggestion.category}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 mb-3">{suggestion.description}</p>
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span>Effort: {suggestion.effort}</span>
                    <span>•</span>
                    <span>{suggestion.createdAt.toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {suggestion.actionable && (
                    <button
                      onClick={() => handleApply(suggestion)}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
                    >
                      Apply
                    </button>
                  )}
                  <button
                    onClick={() => handleDismiss(suggestion.id)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 transition-colors"
                    title="Dismiss"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AISuggestions;




