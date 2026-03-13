import React, { useMemo, useState, useEffect } from 'react';
import { Agent, Task, ProjectBudget, TaskStatus } from '@orbitai/shared';
import { DollarSign, Cpu, TrendingUp, BarChart2, CreditCard, Activity, Zap, AlertTriangle, Edit2, Check, X, RefreshCw } from 'lucide-react';
import { getProjectUsageStats } from '../services/llmUsageApi';
import { isValidObjectId, isProjectNotFound } from '../services/projectStorage';

interface CostEstimatorProps {
  agents: Agent[];
  tasks: Task[];
  budget: ProjectBudget;
  projectId?: string; // Project ID for fetching real costs
  onUpdateBudget?: (newTotal: number) => void;
}

const CostEstimator: React.FC<CostEstimatorProps> = ({ agents, tasks, budget, projectId, onUpdateBudget }) => {
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [newBudgetVal, setNewBudgetVal] = useState((budget?.total ?? 50.00).toString());
  const [realCosts, setRealCosts] = useState<{ totalCost: number; byModel: Record<string, any>; byAgent: Record<string, any> } | null>(null);
  const [loadingCosts, setLoadingCosts] = useState(false);
  const [costsError, setCostsError] = useState<string | null>(null);
  
  // Fetch real costs from API if projectId is provided
  useEffect(() => {
    if (projectId && isValidObjectId(projectId)) {
      // CRITICAL: Skip API call if project is known to not exist (prevents 404 errors)
      if (isProjectNotFound(projectId)) {
        // Project doesn't exist - skip API call and use estimated costs
        setLoadingCosts(false);
        setCostsError(null);
        return;
      }
      
      setLoadingCosts(true);
      setCostsError(null);
      getProjectUsageStats(projectId)
        .then((stats) => {
          // Transform API response to match our format
          const byModel: Record<string, { count: number; cost: number; tokens: number }> = {};
          const byAgent: Record<string, { cost: number; tokens: number }> = {};
          
          // Process byModel data
          Object.entries(stats.byModel || {}).forEach(([model, data]: [string, any]) => {
            byModel[model] = {
              count: data.calls || 0,
              cost: data.cost || 0,
              tokens: data.tokens || 0
            };
          });
          
          // Process byAgent data (from recentCalls if available)
          stats.recentCalls?.forEach((call: any) => {
            const agentRole = call.agentRole || 'Unknown';
            if (!byAgent[agentRole]) {
              byAgent[agentRole] = { cost: 0, tokens: 0 };
            }
            byAgent[agentRole].cost += call.totalCost || 0;
            byAgent[agentRole].tokens += call.totalTokens || 0;
          });
          
          setRealCosts({
            totalCost: stats.totalCost || 0,
            byModel,
            byAgent
          });
          setLoadingCosts(false);
        })
        .catch((error) => {
          // Only log in development mode to reduce console noise
          if (import.meta.env.DEV) {
            console.debug('Failed to fetch real costs, using estimated costs:', error);
          }
          setCostsError(null); // Don't show error - estimated costs are fine
          setLoadingCosts(false);
        });
    } else if (projectId && !isValidObjectId(projectId)) {
      // Invalid project ID (e.g., demo projects like "p159a", local projects) - skip API call and use estimated costs
      // This is expected behavior for non-database projects, so don't log warnings
      setCostsError(null); // Don't show error for expected cases (demo/local projects)
      setLoadingCosts(false);
    }
  }, [projectId]);
  
  // --- LLM KPI Calculations ---
  // Use real costs if available, otherwise fall back to estimated costs from tasks
  
  const tokenStats = useMemo(() => {
      let input = 0;
      let output = 0;
      let totalCost = 0;
      
      const modelUsage: Record<string, { count: number, cost: number, tokens: number }> = {};
      const agentUsage: Record<string, { cost: number, tokens: number }> = {};

      // Calculate from tasks (estimated costs)
      tasks.forEach(t => {
          if (t.tokenUsage) {
              input += t.tokenUsage.promptTokens;
              output += t.tokenUsage.candidatesTokens;
              
              if (t.cost) totalCost += t.cost;

              // Model Breakdown
              const model = t.modelUsed || 'gemini-3-pro-preview';
              if (!modelUsage[model]) modelUsage[model] = { count: 0, cost: 0, tokens: 0 };
              modelUsage[model].count++;
              modelUsage[model].cost += (t.cost || 0);
              modelUsage[model].tokens += t.tokenUsage.totalTokens;

              // Agent Breakdown
              const agentName = t.assignedTo;
              if (!agentUsage[agentName]) agentUsage[agentName] = { cost: 0, tokens: 0 };
              agentUsage[agentName].cost += (t.cost || 0);
              agentUsage[agentName].tokens += t.tokenUsage.totalTokens;
          }
      });

      // Merge with real costs if available (real costs take precedence)
      if (realCosts) {
        totalCost = realCosts.totalCost;
        
        // Merge model usage (real costs override estimated)
        Object.entries(realCosts.byModel).forEach(([model, data]) => {
          modelUsage[model] = {
            count: data.count,
            cost: data.cost,
            tokens: data.tokens
          };
        });
        
        // Merge agent usage (real costs override estimated)
        Object.entries(realCosts.byAgent).forEach(([agent, data]) => {
          agentUsage[agent] = {
            cost: data.cost,
            tokens: data.tokens
          };
        });
      }

      return { input, output, total: input + output, totalCost, modelUsage, agentUsage };
  }, [tasks, realCosts]);

  const budgetTotal = budget?.total ?? 50.00;
  const spentPercentage = budgetTotal > 0 ? Math.round((tokenStats.totalCost / budgetTotal) * 100) : 0;
  const remainingBudget = budgetTotal - tokenStats.totalCost;
  const isOverBudget = remainingBudget < 0;

  // Projection Logic
  const completedCount = tasks.filter(t => t.status === TaskStatus.COMPLETED).length;
  // const pendingCount = tasks.filter(t => t.status === TaskStatus.PENDING || t.status === TaskStatus.IN_PROGRESS).length;
  
  const avgCostPerTask = completedCount > 0 ? tokenStats.totalCost / completedCount : 0;

  const handleSaveBudget = () => {
      const val = parseFloat(newBudgetVal);
      if (!isNaN(val) && val > 0) {
          onUpdateBudget?.(val);
          setIsEditingBudget(false);
      }
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 bg-white border-b border-slate-200 flex items-center justify-between shrink-0 z-10 shadow-sm">
           <div>
               <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                   <CreditCard size={16} className="text-primary" /> Financial Control Center
                   {realCosts && (
                     <span className="text-[9px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded font-semibold">
                       Real Costs
                     </span>
                   )}
                   {!realCosts && projectId && (
                     <span className="text-[9px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded font-semibold">
                       Estimated
                     </span>
                   )}
               </h2>
           </div>
           <div className="flex items-center gap-3">
                {projectId && (
                  <button
                    onClick={() => {
                      // Skip if project is known to not exist
                      if (isProjectNotFound(projectId)) {
                        return; // Don't make API call
                      }
                      setLoadingCosts(true);
                      getProjectUsageStats(projectId)
                        .then((stats) => {
                          const byModel: Record<string, { count: number; cost: number; tokens: number }> = {};
                          const byAgent: Record<string, { cost: number; tokens: number }> = {};
                          
                          Object.entries(stats.byModel || {}).forEach(([model, data]: [string, any]) => {
                            byModel[model] = {
                              count: data.calls || 0,
                              cost: data.cost || 0,
                              tokens: data.tokens || 0
                            };
                          });
                          
                          stats.recentCalls?.forEach((call: any) => {
                            const agentRole = call.agentRole || 'Unknown';
                            if (!byAgent[agentRole]) {
                              byAgent[agentRole] = { cost: 0, tokens: 0 };
                            }
                            byAgent[agentRole].cost += call.totalCost || 0;
                            byAgent[agentRole].tokens += call.totalTokens || 0;
                          });
                          
                          setRealCosts({
                            totalCost: stats.totalCost || 0,
                            byModel,
                            byAgent
                          });
                          setLoadingCosts(false);
                          setCostsError(null);
                        })
                        .catch((error) => {
                          setCostsError('Failed to refresh costs');
                          setLoadingCosts(false);
                        });
                    }}
                    disabled={loadingCosts}
                    className="p-1.5 text-slate-400 hover:text-primary transition-colors disabled:opacity-50"
                    title="Refresh costs from database"
                  >
                    <RefreshCw size={14} className={loadingCosts ? 'animate-spin' : ''} />
                  </button>
                )}
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Spend:</div>
                    <div className="text-xs font-mono font-bold text-slate-800">
                      {loadingCosts ? '...' : `$${tokenStats.totalCost.toFixed(4)}`}
                    </div>
                </div>
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${isOverBudget ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
                    <div className="text-[10px] font-bold uppercase tracking-wider">Remaining:</div>
                    <div className="text-xs font-mono font-bold">${remainingBudget.toFixed(4)}</div>
                </div>
           </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
            
            {/* Budget Overview Card */}
            <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <DollarSign size={14} className="text-green-500" /> Budget Utilization
                    </h3>
                    <div className="flex items-center gap-2">
                        {isEditingBudget ? (
                            <div className="flex items-center gap-1.5">
                                <input 
                                    type="number" 
                                    value={newBudgetVal}
                                    onChange={(e) => setNewBudgetVal(e.target.value)}
                                    className="w-20 px-2 py-0.5 text-xs border border-slate-300 rounded focus:outline-none focus:border-primary"
                                    step="0.01"
                                />
                                <button onClick={handleSaveBudget} className="p-0.5 bg-green-100 text-green-600 rounded hover:bg-green-200"><Check size={12} /></button>
                                <button onClick={() => setIsEditingBudget(false)} className="p-0.5 bg-red-100 text-red-600 rounded hover:bg-red-200"><X size={12} /></button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-1.5 group">
                                <span className="text-lg font-bold text-slate-800">${budgetTotal.toFixed(2)}</span>
                                <button onClick={() => setIsEditingBudget(true)} className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-primary transition-opacity">
                                    <Edit2 size={12} />
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="relative pt-2 pb-1">
                    <div className="flex mb-1.5 items-center justify-between">
                        <div>
                            <span className="text-[10px] font-semibold inline-block py-0.5 px-1.5 uppercase rounded-full text-blue-600 bg-blue-200">
                                Usage
                            </span>
                        </div>
                        <div className="text-right">
                            <span className="text-[10px] font-semibold inline-block text-blue-600">
                                {spentPercentage}%
                            </span>
                        </div>
                    </div>
                    <div className="overflow-hidden h-1.5 mb-2 text-xs flex rounded bg-blue-100">
                        <div style={{ width: `${Math.min(spentPercentage, 100)}%` }} className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center ${isOverBudget ? 'bg-red-500' : 'bg-blue-500'} transition-all duration-500`}></div>
                    </div>
                    {isOverBudget && (
                        <div className="flex items-center gap-1.5 text-[10px] text-red-600 font-bold mt-0.5">
                            <AlertTriangle size={10} /> Budget Cap Exceeded! System may halt non-critical tasks.
                        </div>
                    )}
                </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm flex items-center gap-3">
                    <div className="p-2 bg-purple-50 border border-purple-100 rounded-full text-purple-600">
                        <Cpu size={18} />
                    </div>
                    <div>
                        <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Total Tokens</div>
                        <div className="text-base font-bold text-slate-800">{(tokenStats.total / 1000).toFixed(1)}k</div>
                        <div className="text-[9px] text-slate-400">
                            {tokenStats.input.toLocaleString()} in / {tokenStats.output.toLocaleString()} out
                        </div>
                    </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm flex items-center gap-3">
                    <div className="p-2 bg-orange-50 border border-orange-100 rounded-full text-orange-600">
                        <TrendingUp size={18} />
                    </div>
                    <div>
                        <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Avg Cost / Task</div>
                        <div className="text-base font-bold text-slate-800">${avgCostPerTask.toFixed(4)}</div>
                        <div className="text-[9px] text-slate-400">
                            Based on {completedCount} completed tasks
                        </div>
                    </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm flex items-center gap-3">
                    <div className="p-2 bg-blue-50 border border-blue-100 rounded-full text-blue-600">
                        <Activity size={18} />
                    </div>
                    <div>
                        <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Run Efficiency</div>
                        <div className="text-base font-bold text-slate-800">{(tokenStats.totalCost / (tokenStats.total || 1) * 1000).toFixed(4)}</div>
                        <div className="text-[9px] text-slate-400">
                            $ per 1k tokens (avg)
                        </div>
                    </div>
                </div>
            </div>

            {/* Detailed Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                
                {/* Model Usage */}
                <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                    <div className="px-3 py-2 border-b border-slate-100 bg-slate-50 flex items-center gap-1.5">
                        <Zap size={12} className="text-amber-500" />
                        <h3 className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">Consumption by Model</h3>
                    </div>
                    <div className="p-0">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-slate-50/50 text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                                    <th className="px-2 py-1.5 pl-3">Model</th>
                                    <th className="px-2 py-1.5 text-right">Reqs</th>
                                    <th className="px-2 py-1.5 text-right">Tokens</th>
                                    <th className="px-2 py-1.5 text-right pr-3">Cost</th>
                                </tr>
                            </thead>
                            <tbody className="text-[11px] text-slate-700 divide-y divide-slate-100">
                                {Object.entries(tokenStats.modelUsage).map(([model, stats]: [string, { count: number, cost: number, tokens: number }]) => (
                                    <tr key={model}>
                                        <td className="px-2 py-1.5 pl-3 font-medium truncate max-w-[120px]">{model}</td>
                                        <td className="px-2 py-1.5 text-right font-mono">{stats.count}</td>
                                        <td className="px-2 py-1.5 text-right font-mono">{(stats.tokens / 1000).toFixed(1)}k</td>
                                        <td className="px-2 py-1.5 text-right pr-3 font-mono text-slate-900 font-bold">${stats.cost.toFixed(4)}</td>
                                    </tr>
                                ))}
                                {Object.keys(tokenStats.modelUsage).length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="px-3 py-2 text-center text-slate-400 italic text-[10px]">No metrics recorded yet.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Agent Usage */}
                <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                    <div className="px-3 py-2 border-b border-slate-100 bg-slate-50 flex items-center gap-1.5">
                        <BarChart2 size={12} className="text-indigo-500" />
                        <h3 className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">Consumption by Agent</h3>
                    </div>
                    <div className="p-0">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-slate-50/50 text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                                    <th className="px-2 py-1.5 pl-3">Agent Role</th>
                                    <th className="px-2 py-1.5 text-right">Tokens</th>
                                    <th className="px-2 py-1.5 text-right pr-3">Cost</th>
                                </tr>
                            </thead>
                            <tbody className="text-[11px] text-slate-700 divide-y divide-slate-100">
                                {Object.entries(tokenStats.agentUsage).map(([agent, stats]: [string, { cost: number, tokens: number }]) => (
                                    <tr key={agent}>
                                        <td className="px-2 py-1.5 pl-3 font-medium truncate max-w-[120px]">{agent}</td>
                                        <td className="px-2 py-1.5 text-right font-mono">{(stats.tokens / 1000).toFixed(1)}k</td>
                                        <td className="px-2 py-1.5 text-right pr-3 font-mono text-slate-900 font-bold">${stats.cost.toFixed(4)}</td>
                                    </tr>
                                ))}
                                {Object.keys(tokenStats.agentUsage).length === 0 && (
                                    <tr>
                                        <td colSpan={3} className="px-3 py-2 text-center text-slate-400 italic text-[10px]">No metrics recorded yet.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>
        </div>
    </div>
  );
};

export default CostEstimator;