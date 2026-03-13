
import React, { useMemo } from 'react';
import { Check, Rocket, Target, Shield, Zap, Flag, Layers, Clock, TrendingUp, RefreshCw, GitBranch, FileSearch, Hexagon, FileText, Terminal, GitMerge, Activity, Lightbulb, Users } from 'lucide-react';
import { Task, TaskStatus, AppSettings, Methodology } from '@orbitai/shared';

interface MilestoneTrackerProps {
  currentSprint: number;
  tasks?: Task[];
  settings?: AppSettings;
  methodology?: Methodology;
  estimatedSprints?: number;
}

// Methodology-specific sprint milestones
// Enhanced to automatically adjust based on estimated sprints from SDLC analysis
const getMilestones = (methodology: Methodology = 'V-Model', estimatedSprints: number = 5) => {
  const baseMilestones = {
    'V-Model': [
      { sprint: 1, label: 'Initiation', icon: Lightbulb, desc: 'Project Start' },
      { sprint: 2, label: 'Requirements', icon: FileSearch, desc: 'Specification' },
      { sprint: 3, label: 'Architecture', icon: Hexagon, desc: 'Design Phase' },
      { sprint: 4, label: 'Test Planning', icon: FileText, desc: 'Test Strategy' },
      { sprint: 5, label: 'Implementation', icon: Terminal, desc: 'Development' },
      { sprint: 6, label: 'Integration', icon: GitMerge, desc: 'System Integration' },
      { sprint: 7, label: 'Acceptance', icon: Shield, desc: 'System Testing' },
      { sprint: 8, label: 'Release', icon: Flag, desc: 'Production' },
    ],
    'Agile': [
      { sprint: 1, label: 'Sprint 1', icon: Rocket, desc: 'MVP Foundation' },
      { sprint: 2, label: 'Sprint 2', icon: Layers, desc: 'Core Features' },
      { sprint: 3, label: 'Sprint 3', icon: Zap, desc: 'Enhancements' },
      { sprint: 4, label: 'Sprint 4', icon: Shield, desc: 'Release Ready' },
    ],
    'Scrum': [
      { sprint: 1, label: 'Sprint 1', icon: Rocket, desc: 'Sprint Planning' },
      { sprint: 2, label: 'Sprint 2', icon: Layers, desc: 'Development' },
      { sprint: 3, label: 'Sprint 3', icon: Zap, desc: 'Review & Retro' },
      { sprint: 4, label: 'Sprint 4', icon: Shield, desc: 'Release' },
    ],
    'DevOps': [
      { sprint: 1, label: 'Plan & Code', icon: GitBranch, desc: 'CI Setup' },
      { sprint: 2, label: 'Build & Test', icon: Terminal, desc: 'Automation' },
      { sprint: 3, label: 'Release', icon: Rocket, desc: 'Deploy' },
      { sprint: 4, label: 'Operate', icon: Shield, desc: 'Monitor' },
    ],
    'Spiral': [
      { sprint: 1, label: 'Planning', icon: Target, desc: 'Risk Analysis' },
      { sprint: 2, label: 'Engineering', icon: Terminal, desc: 'Development' },
      { sprint: 3, label: 'Evaluation', icon: Shield, desc: 'Testing' },
      { sprint: 4, label: 'Planning', icon: RefreshCw, desc: 'Next Iteration' },
      { sprint: 5, label: 'Engineering', icon: Terminal, desc: 'Refinement' },
      { sprint: 6, label: 'Release', icon: Flag, desc: 'Production' },
    ],
    'Iterative': [
      { sprint: 1, label: 'Iteration 1', icon: Layers, desc: 'Planning' },
      { sprint: 2, label: 'Iteration 2', icon: Layers, desc: 'Analysis' },
      { sprint: 3, label: 'Iteration 3', icon: Terminal, desc: 'Implementation' },
      { sprint: 4, label: 'Iteration 4', icon: Shield, desc: 'Testing' },
      { sprint: 5, label: 'Release', icon: Flag, desc: 'Production' },
    ],
    'Prototyping': [
      { sprint: 1, label: 'Prototype 1', icon: Zap, desc: 'Quick Design' },
      { sprint: 2, label: 'Prototype 2', icon: Zap, desc: 'User Feedback' },
      { sprint: 3, label: 'Release', icon: Flag, desc: 'Final Build' },
    ],
    'RAD': [
      { sprint: 1, label: 'Modeling', icon: Layers, desc: 'Business Model' },
      { sprint: 2, label: 'Generation', icon: Terminal, desc: 'Rapid Build' },
      { sprint: 3, label: 'Release', icon: Flag, desc: 'Quick Delivery' },
    ],
    'Lean': [
      { sprint: 1, label: 'Define Value', icon: Target, desc: 'MVP Focus' },
      { sprint: 2, label: 'Create Flow', icon: Zap, desc: 'Efficiency' },
      { sprint: 3, label: 'Release', icon: Flag, desc: 'Launch' },
    ],
    'Waterfall': [
      { sprint: 1, label: 'Requirements', icon: FileSearch, desc: 'Specification' },
      { sprint: 2, label: 'Design', icon: Hexagon, desc: 'Architecture' },
      { sprint: 3, label: 'Implementation', icon: Terminal, desc: 'Development' },
      { sprint: 4, label: 'Verification', icon: Shield, desc: 'Testing' },
      { sprint: 5, label: 'Maintenance', icon: Flag, desc: 'Deployment' },
    ],
    'ASD': [ // Adaptive Software Development
      { sprint: 1, label: 'Speculate', icon: Target, desc: 'Planning & Vision' },
      { sprint: 2, label: 'Collaborate', icon: Users, desc: 'Team Collaboration' },
      { sprint: 3, label: 'Learn', icon: TrendingUp, desc: 'Review & Adapt' },
      { sprint: 4, label: 'Refine', icon: RefreshCw, desc: 'Iteration' },
      { sprint: 5, label: 'Release', icon: Flag, desc: 'Delivery' },
    ],
  };

  let milestones = baseMilestones[methodology] || baseMilestones['V-Model'];
  
  // ENHANCEMENT: Smart milestone adjustment based on estimated sprints
  // Uses research-based phase distribution when available
  if (estimatedSprints && estimatedSprints !== milestones.length) {
    if (estimatedSprints > milestones.length) {
      // Add more sprints with intelligent phase distribution
      const lastMilestone = milestones[milestones.length - 1];
      const phaseDistribution: Record<Methodology, { phase: string; weight: number }[]> = {
        'V-Model': [
          { phase: 'Initiation', weight: 1 },
          { phase: 'Requirements', weight: 1 },
          { phase: 'Architecture', weight: 1 },
          { phase: 'Test Planning', weight: 1 },
          { phase: 'Implementation', weight: 2 },
          { phase: 'Integration', weight: 1 },
          { phase: 'Acceptance', weight: 1 },
          { phase: 'Release', weight: 0.5 },
        ],
        'Agile': [
          { phase: 'Sprint Planning', weight: 0.2 },
          { phase: 'Development', weight: 0.4 },
          { phase: 'Testing', weight: 0.2 },
          { phase: 'Review', weight: 0.1 },
          { phase: 'Retrospective', weight: 0.1 },
        ],
        'Waterfall': [
          { phase: 'Requirements', weight: 1 },
          { phase: 'Design', weight: 1 },
          { phase: 'Implementation', weight: 2 },
          { phase: 'Verification', weight: 1 },
          { phase: 'Maintenance', weight: 0 },
        ],
        'Spiral': [
          { phase: 'Planning', weight: 1 },
          { phase: 'Risk Analysis', weight: 1 },
          { phase: 'Engineering', weight: 2 },
          { phase: 'Evaluation', weight: 1 },
        ],
        'DevOps': [
          { phase: 'Plan & Code', weight: 1 },
          { phase: 'Build & Test', weight: 1.5 },
          { phase: 'Release', weight: 1 },
          { phase: 'Operate', weight: 0.5 },
        ],
        'Iterative': [
          { phase: 'Planning', weight: 1 },
          { phase: 'Analysis', weight: 1 },
          { phase: 'Implementation', weight: 2 },
          { phase: 'Testing', weight: 1 },
        ],
        'Prototyping': [
          { phase: 'Quick Design', weight: 1 },
          { phase: 'User Feedback', weight: 1 },
          { phase: 'Refinement', weight: 1 },
        ],
        'RAD': [
          { phase: 'Modeling', weight: 1 },
          { phase: 'Generation', weight: 2 },
          { phase: 'Release', weight: 0.5 },
        ],
        'Scrum': [
          { phase: 'Sprint Planning', weight: 0.2 },
          { phase: 'Development', weight: 0.4 },
          { phase: 'Review', weight: 0.2 },
          { phase: 'Retrospective', weight: 0.2 },
        ],
        'Lean': [
          { phase: 'Define Value', weight: 1 },
          { phase: 'Create Flow', weight: 1.5 },
          { phase: 'Release', weight: 0.5 },
        ],
        'ASD': [
          { phase: 'Speculate', weight: 1 },
          { phase: 'Collaborate', weight: 1.5 },
          { phase: 'Learn', weight: 1 },
          { phase: 'Refine', weight: 1.5 },
          { phase: 'Release', weight: 0.5 },
        ],
      };

      const distribution = phaseDistribution[methodology] || [];
      const totalWeight = distribution.reduce((sum, p) => sum + p.weight, 0);
      const additionalSprints = estimatedSprints - milestones.length;
      
      // Distribute additional sprints across phases based on weights
      let currentSprint = milestones.length + 1;
      for (let i = 0; i < additionalSprints && currentSprint <= estimatedSprints; i++) {
        // For Agile/iterative methodologies, add numbered sprints
        if (methodology === 'Agile' || methodology === 'Scrum' || methodology === 'DevOps' || methodology === 'ASD' || methodology === 'RAD' || methodology === 'Lean' || methodology === 'Prototyping') {
          milestones.push({
            sprint: currentSprint,
            label: `Sprint ${currentSprint}`,
            icon: lastMilestone.icon,
            desc: `Iteration ${currentSprint}`,
          });
        } else {
          // For sequential methodologies, extend the last phase
          milestones.push({
            sprint: currentSprint,
            label: `${lastMilestone.label} (Cont.)`,
            icon: lastMilestone.icon,
            desc: 'Continued Development',
          });
        }
        currentSprint++;
      }
    } else {
      // Trim to estimated sprints, but keep important phases
      // For V-Model, always keep Initiation, Requirements, Implementation, and Release
      if (methodology === 'V-Model' && estimatedSprints >= 4) {
        const essentialPhases = [0, 1, 4, milestones.length - 1]; // Initiation, Requirements, Implementation, Release
        const essential = essentialPhases.map(idx => milestones[idx]).filter(Boolean);
        const others = milestones.filter((_, idx) => !essentialPhases.includes(idx));
        milestones = [...essential.slice(0, Math.ceil(estimatedSprints * 0.5)), ...others.slice(0, estimatedSprints - essential.length)];
        milestones = milestones.slice(0, estimatedSprints).sort((a, b) => a.sprint - b.sprint);
      } else {
        milestones = milestones.slice(0, estimatedSprints);
      }
    }
  }

  // Ensure milestones are properly numbered
  milestones = milestones.map((m, idx) => ({
    ...m,
    sprint: idx + 1
  }));

  return milestones;
};

const formatDuration = (ms: number): string => {
    if (ms <= 0 || !isFinite(ms) || isNaN(ms)) return "--";
    if (ms < 1000) return "< 1s";
    
    // Ensure we're working with a valid number
    const totalMs = Math.max(0, Math.floor(ms));
    const seconds = Math.floor(totalMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
};

const MilestoneTracker: React.FC<MilestoneTrackerProps> = ({ currentSprint, tasks = [], settings, methodology = 'V-Model', estimatedSprints }) => {
  const MILESTONES = useMemo(() => getMilestones(methodology, estimatedSprints), [methodology, estimatedSprints]);
  // Estimation Logic (Forecasting)
  const forecast = useMemo(() => {
      // 1. Filter and Calculate Historical Average
      // We ignore tasks < 2s as they are likely cached, skipped, or errors, which skew the forecast for real work.
      const validCompletedTasks = tasks.filter(t => 
          t.status === TaskStatus.COMPLETED && 
          t.startTime && 
          t.endTime && 
          (t.endTime - t.startTime) > 2000
      );
      
      // Heuristic Base: Gemini Pro takes ~15-20s, Flash takes ~3-5s. 
      // We assume a mix, defaulting to a conservative 15s if no data.
      let baseHeuristic = 15000; 
      if (settings) {
          if (settings.executionSpeed === 'fast') baseHeuristic = 5000;
          else if (settings.executionSpeed === 'slow') baseHeuristic = 45000;
      }

      let estimatedTaskDuration = baseHeuristic;
      
      if (validCompletedTasks.length > 0) {
          const totalHistoryTime = validCompletedTasks.reduce((acc, t) => {
              const duration = (t.endTime || 0) - (t.startTime || 0);
              // Only include reasonable durations (between 1s and 5 minutes)
              if (duration >= 1000 && duration <= 300000) {
                  return acc + duration;
              }
              return acc;
          }, 0);
          
          // Recalculate valid count after filtering
          const validDurations = validCompletedTasks.filter(t => {
              const duration = (t.endTime || 0) - (t.startTime || 0);
              return duration >= 1000 && duration <= 300000;
          });
          
          if (validDurations.length > 0) {
              const historicalAvg = totalHistoryTime / validDurations.length;
              
              // Weighted Blend:
              // If we have few tasks (<5), trust the heuristic more to prevent volatility.
              // If we have many, trust history.
              const historyWeight = Math.min(1, validDurations.length / 5);
              estimatedTaskDuration = (historicalAvg * historyWeight) + (baseHeuristic * (1 - historyWeight));
          }
      }

      // Enforce a sane floor and ceiling (API calls typically take 3s-2min for complex tasks)
      estimatedTaskDuration = Math.max(estimatedTaskDuration, 3000);
      estimatedTaskDuration = Math.min(estimatedTaskDuration, 120000); // Cap at 2 minutes per task

      // 2. Determine Efficiency Factor
      // Parallel execution isn't perfectly linear due to rate limits and JS event loop overhead.
      // We apply an efficiency factor (e.g. 0.75) to the max parallelism.
      const maxParallel = settings?.maxParallelTasks || 5;
      const effectiveParallelism = Math.max(1, maxParallel * 0.75);

      // 3. Forecast Remaining Time
      // Only count tasks that are actually in the current sprint and not completed/paused
      const pendingInSprint = tasks.filter(t => 
        t.status !== TaskStatus.COMPLETED && 
        t.status !== TaskStatus.PAUSED &&
        (t.sprint === currentSprint || (t.sprint === undefined && currentSprint === 1))
      );
      
      // Count all pending tasks across all sprints (excluding paused)
      const allPending = tasks.filter(t => 
        t.status !== TaskStatus.COMPLETED && 
        t.status !== TaskStatus.PAUSED
      );

      // Formula: (Tasks * AvgDuration) / EffectiveParallelism
      // Ensure we don't divide by zero and handle edge cases
      const sprintForecast = pendingInSprint.length > 0 
        ? (pendingInSprint.length * estimatedTaskDuration) / effectiveParallelism
        : 0;
      const totalForecast = allPending.length > 0
        ? (allPending.length * estimatedTaskDuration) / effectiveParallelism
        : 0;

      // Debug logging (only in development)
      if (import.meta.env.DEV) {
        console.debug('[Sprint Forecast]', {
          pendingInSprint: pendingInSprint.length,
          allPending: allPending.length,
          estimatedTaskDuration: `${Math.round(estimatedTaskDuration / 1000)}s`,
          effectiveParallelism,
          sprintForecast: `${Math.round(sprintForecast / 1000)}s`,
          totalForecast: `${Math.round(totalForecast / 1000)}s`
        });
      }

      return {
          sprint: sprintForecast,
          total: totalForecast,
          avgPerTask: estimatedTaskDuration,
          taskCount: validCompletedTasks.length
      };
  }, [tasks, currentSprint, settings]);

  return (
    <div className="px-8 py-5 bg-white/80 backdrop-blur-md border-b border-slate-200 z-20 shrink-0">
      <div className="max-w-5xl mx-auto">
        
        <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Target size={12} className="text-primary" /> Product Roadmap
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-[9px] font-mono font-bold text-slate-500">
                    Sprint {currentSprint}{estimatedSprints ? ` / ${estimatedSprints}` : ` / ${MILESTONES.length}`}
                </span>
                {estimatedSprints && (
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                      <div 
                        className="h-full bg-primary transition-all duration-500 rounded-full"
                        style={{ width: `${Math.min(100, (currentSprint / estimatedSprints) * 100)}%` }}
                      ></div>
                    </div>
                    <span className="text-[8px] font-mono text-slate-400 font-bold">
                      {Math.round((currentSprint / estimatedSprints) * 100)}%
                    </span>
                  </div>
                )}
                {estimatedSprints && (
                  <span className="px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-[9px] font-mono font-bold text-primary">
                    {methodology}
                  </span>
                )}
            </div>
            
            {/* FORECAST HUD */}
            <div className="flex items-center gap-4 text-[10px] font-mono font-medium text-slate-500 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-lg shadow-sm">
                <div className="flex items-center gap-1.5" title={`Based on ${forecast.taskCount} completed tasks (Avg: ${formatDuration(forecast.avgPerTask)})`}>
                    <TrendingUp size={12} className={forecast.taskCount > 2 ? "text-emerald-500" : "text-slate-400"} />
                    <span>Sprint Forecast: <span className="text-slate-800 font-bold">{formatDuration(forecast.sprint)}</span></span>
                </div>
                <div className="w-px h-3 bg-slate-300"></div>
                <div className="flex items-center gap-1.5" title="Total estimated time for all pending tasks across all phases">
                    <Clock size={12} className="text-blue-500" />
                    <span>Total Remaining: <span className="text-slate-800 font-bold">{formatDuration(forecast.total)}</span></span>
                </div>
            </div>
        </div>

        <div className="flex items-center justify-between relative px-4">
            {/* Connecting Line Background */}
            <div className="absolute left-4 right-4 top-4 h-0.5 bg-slate-100 -z-10 rounded-full"></div>
            
            {/* Active Progress Line - Methodology-specific colors */}
            <div 
                className={`absolute left-4 top-4 h-0.5 -z-10 transition-all duration-1000 ease-out rounded-full ${
                  methodology === 'Agile' || methodology === 'Scrum' 
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]'
                    : methodology === 'DevOps'
                    ? 'bg-gradient-to-r from-green-500 to-emerald-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]'
                    : methodology === 'Spiral'
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]'
                    : methodology === 'Prototyping' || methodology === 'RAD'
                    ? 'bg-gradient-to-r from-purple-500 to-pink-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]'
                    : methodology === 'Lean'
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-500 shadow-[0_0_10px_rgba(6,182,212,0.5)]'
                    : methodology === 'Waterfall'
                    ? 'bg-gradient-to-r from-slate-500 to-gray-500 shadow-[0_0_10px_rgba(100,116,139,0.5)]'
                    : 'bg-gradient-to-r from-blue-500 to-indigo-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]'
                }`}
                style={{ width: `calc(${Math.min(100, estimatedSprints ? ((currentSprint - 1) / Math.max(1, estimatedSprints - 1)) * 100 : ((currentSprint - 1) / Math.max(1, MILESTONES.length - 1)) * 100)}% - 32px)` }}
            ></div>

            {MILESTONES.map((m, index) => {
            const isCompleted = currentSprint > m.sprint;
            const isCurrent = currentSprint === m.sprint;
            const Icon = m.icon;

            return (
                <div key={m.sprint} className="flex flex-col items-center group relative">
                <div 
                    className={`
                    w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-500 relative z-10
                    ${isCompleted 
                        ? 'bg-primary border-primary text-white shadow-lg shadow-blue-500/20 scale-90' 
                        : isCurrent 
                            ? 'bg-white border-primary text-primary shadow-[0_0_20px_rgba(37,99,235,0.4)] scale-110 ring-4 ring-primary/10' 
                            : 'bg-white border-slate-200 text-slate-300'}
                    `}
                >
                    {isCompleted ? <Check size={14} strokeWidth={3} /> : <Icon size={14} />}
                    
                    {/* Pulse Effect for Current */}
                    {isCurrent && (
                        <span className="absolute inset-0 rounded-full border border-primary animate-ping opacity-20"></span>
                    )}
                </div>
                
                <div className={`
                    mt-3 text-center transition-all duration-300 absolute top-full w-32
                    ${isCurrent ? 'opacity-100 translate-y-0' : isCompleted ? 'opacity-80' : 'opacity-40 grayscale'}
                `}>
                    <div className={`text-[9px] font-bold uppercase tracking-widest mb-0.5 ${isCurrent ? 'text-primary' : 'text-slate-500'}`}>
                    Sprint {m.sprint}
                    </div>
                    <div className={`text-[10px] font-bold leading-tight ${isCurrent ? 'text-slate-800' : 'text-slate-600'}`}>
                    {m.label}
                    </div>
                    <div className="text-[9px] text-slate-400 font-medium mt-0.5">
                        {m.desc}
                    </div>
                </div>
                </div>
            );
            })}
        </div>
        
        {/* Spacer for labels */}
        <div className="h-10"></div>
      </div>
    </div>
  );
};

export default MilestoneTracker;
