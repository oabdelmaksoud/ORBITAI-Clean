
import React, { useState, memo, useMemo } from 'react';
import { Task, TaskStatus, AgentRole, MCPServer } from '@orbitai/shared';
import { CheckCircle2, Circle, Clock, AlertCircle, Play, ArrowRight, User, Layers, RefreshCcw, Link, Trash2, Edit2, Lock, ShieldCheck, XCircle, Timer, GitGraph, Layout, List, PauseCircle, Medal } from 'lucide-react';
import TaskDetailModal from './TaskDetailModal';
import TaskDependencyGraph from './TaskDependencyGraph';
import { FixedSizeList } from 'react-window';

interface KanbanBoardProps {
  tasks: Task[];
  currentSprint: number;
  estimatedSprints?: number; // Total estimated sprints for the project
  onExecuteTask: (taskId: string) => void;
  isProcessing: boolean;
  onRunAll?: () => void;
  onDeleteTask: (taskId: string) => void;
  onEditTask: (task: Task) => void;
  onApproveTask?: (taskId: string) => void;
  onRejectTask?: (taskId: string) => void;
  mcpServers?: MCPServer[]; // Optional: MCP servers for the project
}

const ColumnHeader = ({ title, count, icon: Icon, colorClass, action }: { title: string, count: number, icon: any, colorClass: string, action?: React.ReactNode }) => (
  <div className={`flex items-center justify-between p-3 rounded-t-xl bg-white border-b border-slate-200 shadow-sm shrink-0 z-10`}>
    <div className={`flex items-center gap-2 ${colorClass}`}>
      <Icon size={14} className="opacity-90" />
      <span className="text-[10px] font-bold uppercase tracking-widest">{title}</span>
    </div>
    <div className="flex items-center gap-2">
        {action}
        <span className="text-[9px] font-mono font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full min-w-[18px] text-center border border-slate-200">{count}</span>
    </div>
  </div>
);

const formatAssignee = (role: string) => {
    if (!role) return "Unassigned";
    const r = role.toLowerCase();
    if (r.includes('orchestrator')) return 'Orchestrator';
    if (r.includes('requirements')) return 'Requirements';
    if (r.includes('design') || r.includes('architect')) return 'Architecture';
    if (r.includes('test req')) return 'Test Specs';
    if (r.includes('implementation') || r.includes('developer')) return 'Development';
    if (r.includes('integration')) return 'DevOps';
    if (r.includes('test agent')) return 'QA Testing';
    if (r.includes('qa') || r.includes('audit')) return 'QA & Audit';
    if (r.includes('ux')) return 'Design';
    if (r.includes('remediation')) return 'Fixes';
    return role.replace(' Agent', '').replace('Engineer', 'Eng');
};

// Memoized Task Card to prevent re-renders of individual cards when others update
const TaskCard: React.FC<{ 
    task: Task; 
    onExecute: () => void; 
    disabled: boolean; 
    onSelect: () => void;
    onDelete: () => void;
    onEdit: () => void;
    onApprove?: () => void;
    onReject?: () => void;
    blockedByCount: number;
}> = memo(({ task, onExecute, disabled, onSelect, onDelete, onEdit, onApprove, onReject, blockedByCount }) => {
  const isReview = task.status === TaskStatus.REVIEW;
  const isPaused = task.status === TaskStatus.PAUSED;

  // Calculate actual duration if completed, or estimate if pending
  const timeLabel = useMemo(() => {
      if (task.status === TaskStatus.COMPLETED && task.startTime && task.endTime) {
          const ms = task.endTime - task.startTime;
          if (ms < 1000) return "< 1s";
          return `${Math.round(ms / 1000)}s`;
      }
      // Heuristic estimate for pending tasks (matching MilestoneTracker logic slightly)
      if (task.status === TaskStatus.PENDING) {
          // Base estimate
          return "~15s"; 
      }
      return null;
  }, [task.status, task.startTime, task.endTime]);

  return (
  <div 
    onClick={onSelect}
    onKeyDown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onSelect();
      }
    }}
    tabIndex={0}
    role="button"
    aria-label={`Task: ${task.title}. Status: ${task.status}. ${task.assignee ? `Assigned to: ${formatAssignee(task.assignee)}` : 'Unassigned'}`}
    className={`
    group relative p-2.5 rounded-lg border mb-2 transition-all duration-300 shrink-0 cursor-pointer min-w-0 z-[9999] hover:z-[9999]
    ${task.status === TaskStatus.COMPLETED ? 'bg-slate-50 border-slate-200 opacity-80 hover:opacity-100' : 'bg-white border-slate-200 hover:border-primary/50 hover:shadow-xl hover:-translate-y-1 shadow-sm'}
    ${task.status === TaskStatus.IN_PROGRESS ? 'border-primary shadow-[0_0_15px_rgba(37,99,235,0.1)] ring-1 ring-primary/20 bg-white z-[9999]' : ''}
    ${task.status === TaskStatus.FAILED ? 'border-error ring-1 ring-error/20 bg-error/5' : ''}
    ${isReview ? 'border-amber-400 ring-1 ring-amber-400/30 bg-amber-50/30 shadow-[0_0_15px_rgba(251,191,36,0.1)] z-[9999]' : ''}
    ${isPaused ? 'border-orange-300 border-dashed bg-orange-50/50' : ''}
  `}
        style={{ 
          width: '100%',
          maxWidth: '100%',
          minHeight: 'fit-content'
        }}
  >
    {task.status === TaskStatus.IN_PROGRESS && (
       <div className="absolute top-0 left-0 bottom-0 w-1 bg-primary animate-pulse rounded-l-lg" />
    )}
    {isReview && (
       <div className="absolute top-0 left-0 bottom-0 w-1 bg-amber-400 rounded-l-lg" />
    )}
    {isPaused && (
       <div className="absolute top-0 left-0 bottom-0 w-1 bg-orange-400 rounded-l-lg" />
    )}

    {/* Actions (Visible on Hover for non-active tasks) */}
    {task.status !== TaskStatus.IN_PROGRESS && !isReview && task.status !== TaskStatus.COMPLETED && (
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-[10000] bg-white/95 backdrop-blur-sm rounded-md shadow-md p-0.5">
            <button 
                onClick={(e) => {
                    e.stopPropagation();
                    onEdit();
                }}
                className="p-1 text-slate-400 hover:text-primary hover:bg-blue-50 rounded transition-all"
                title="Edit Task"
            >
                <Edit2 size={10} />
            </button>
            <button 
                onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                }}
                className="p-1 text-slate-400 hover:text-error hover:bg-red-50 rounded transition-all"
                title="Delete Task"
            >
                <Trash2 size={10} />
            </button>
        </div>
    )}

    {/* Review Badge */}
    {isReview && (
        <div className="absolute top-2 right-2">
            <span className="flex items-center gap-1 px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-md text-[8px] font-bold uppercase tracking-wider border border-amber-200">
                <ShieldCheck size={8} /> Review
            </span>
        </div>
    )}
    
    {/* Paused Badge */}
    {isPaused && (
        <div className="absolute top-2 right-2">
            <span className="flex items-center gap-1 px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded-md text-[8px] font-bold uppercase tracking-wider border border-orange-200">
                <PauseCircle size={8} /> Paused
            </span>
        </div>
    )}

    {/* Time Badge (Completed or Estimate) */}
    {timeLabel && !isReview && !isPaused && (
        <div className="absolute top-2 right-2 opacity-80 group-hover:opacity-100 transition-opacity">
            <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[8px] font-mono font-bold border ${task.status === TaskStatus.COMPLETED ? 'bg-slate-100 text-slate-500 border-slate-200' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                {task.status === TaskStatus.COMPLETED ? <Clock size={8} /> : <Timer size={8} />} {timeLabel}
            </span>
        </div>
    )}

    <div className="flex justify-between items-start mb-1.5 pr-12 min-w-0">
      <h4 className={`text-xs font-bold leading-tight group-hover:text-primary transition-colors break-words w-full overflow-hidden ${task.status === TaskStatus.COMPLETED ? 'text-slate-500 decoration-slate-400 line-through' : 'text-slate-800'}`}>
        {task.title || "Untitled Task"}
      </h4>
    </div>
    
    <p className="text-[10px] text-slate-600 mb-2 leading-relaxed font-normal break-words whitespace-pre-wrap line-clamp-2 overflow-hidden">
      {task.description || "No description provided."}
    </p>

    {/* Traceability Tags */}
    {task.traceRefs && task.traceRefs.length > 0 && (
      <div className="flex flex-wrap gap-1 mb-2 min-w-0">
        {task.traceRefs.map(ref => (
          <span key={ref} className="text-[8px] font-mono font-medium bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200 flex items-center gap-0.5 max-w-full break-all overflow-hidden">
            <Link size={6} className="shrink-0" /> <span className="truncate">{ref}</span>
          </span>
        ))}
      </div>
    )}

    {/* Dependency Block Indicator */}
    {blockedByCount > 0 && task.status === TaskStatus.PENDING && (
        <div className="mb-2">
            <span className="text-[8px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 flex items-center gap-1 w-fit">
                <Lock size={8} /> Blocked ({blockedByCount})
            </span>
        </div>
    )}

    {/* Live Progress Bar */}
    {(task.status === TaskStatus.IN_PROGRESS) && (
        <div className="mb-2">
            <div className="flex justify-between items-center text-[8px] text-primary font-mono font-bold mb-1">
                <span className="animate-pulse">WORKING...</span>
                <span>{Math.round(task.progress || 0)}%</span>
            </div>
            <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                <div 
                    className="h-full bg-primary transition-all duration-300 ease-out" 
                    style={{ width: `${task.progress || 0}%` }}
                />
            </div>
        </div>
    )}

    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
       <div className="flex items-center gap-1.5 text-[9px] text-slate-600 font-medium min-w-0">
         <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200 shrink-0">
             <User size={8} className="text-slate-400" />
         </div>
         <span className="truncate max-w-[100px]">{formatAssignee(task.assignedTo)}</span>
       </div>

       {/* REVIEW CONTROLS */}
       {isReview ? (
           <div className="flex items-center gap-1.5">
               <button 
                   onClick={(e) => { e.stopPropagation(); onReject && onReject(); }}
                   className="p-1 bg-white border border-red-200 text-red-500 rounded-md hover:bg-red-50 transition-colors"
                   title="Reject & Retry"
               >
                   <XCircle size={10} />
               </button>
               <button 
                   onClick={(e) => { e.stopPropagation(); onApprove && onApprove(); }}
                   className="flex items-center gap-1 px-2 py-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-md text-[8px] font-bold uppercase tracking-wider transition-all shadow-sm border border-emerald-600"
                   title="Approve Quality Gate"
               >
                   <CheckCircle2 size={8} /> Pass
               </button>
           </div>
       ) : (task.status === TaskStatus.PENDING || task.status === TaskStatus.FAILED || task.status === TaskStatus.PAUSED) ? (
        <button 
          onClick={(e) => {
              e.stopPropagation();
              onExecute();
          }}
          disabled={disabled || blockedByCount > 0}
          className={`flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-bold uppercase tracking-wider transition-all shadow-sm shrink-0 ${
              blockedByCount > 0 
              ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed' 
              : 'bg-slate-50 hover:bg-primary hover:text-white border border-slate-200 hover:border-primary text-slate-600'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
          title={blockedByCount > 0 ? "Blocked by dependencies" : "Execute Task"}
        >
          {task.status === TaskStatus.FAILED ? <><RefreshCcw size={8} /> Retry</> : task.status === TaskStatus.PAUSED ? <><Play size={8} className="fill-current" /> Resume</> : blockedByCount > 0 ? <><Lock size={8} /> Wait</> : <><Play size={8} className="fill-current" /> Run</>}
        </button>
       ) : null}

       {task.status === TaskStatus.IN_PROGRESS && (
         <span className="text-[9px] text-primary flex items-center gap-1 font-bold animate-pulse px-1.5 py-0.5 bg-primary/5 rounded-md border border-primary/20 shrink-0">
            <Clock size={8} /> BUSY
         </span>
       )}
       {task.status === TaskStatus.COMPLETED && (
          <div className="flex items-center gap-1.5 shrink-0">
             {task.evaluation && task.evaluation.score > 0 && (
                <span className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5 border ${
                    task.evaluation.score >= 90 ? 'bg-green-50 text-green-700 border-green-200' :
                    task.evaluation.score >= 70 ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                    'bg-red-50 text-red-700 border-red-200'
                }`} title={`AI Quality Score: ${task.evaluation.score}/100`}>
                    <Medal size={8} /> {task.evaluation.score}
                </span>
             )}
             {task.cost != null && typeof task.cost === 'number' && (
                <span className="text-[8px] font-mono text-slate-500 bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded font-medium flex items-center gap-0.5">
                    ${task.cost.toFixed(3)}
                </span>
             )}
            <span className="text-[9px] text-success flex items-center gap-1 font-bold px-1.5 py-0.5 bg-success/5 rounded-md border border-success/20">
                <CheckCircle2 size={8} /> DONE
            </span>
          </div>
       )}
    </div>
  </div>
)});

const KanbanBoard: React.FC<KanbanBoardProps> = ({ tasks, currentSprint, estimatedSprints, onExecuteTask, isProcessing, onRunAll, onDeleteTask, onEditTask, onApproveTask, onRejectTask, mcpServers = [] }) => {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [viewMode, setViewMode] = useState<'board' | 'graph'>('board');

  // FILTER Logic: Only show tasks from the current sprint to keep the board clean for the agile cycle
  const sprintTasks = useMemo(() => {
      return tasks.filter(t => (t.sprint === currentSprint) || (!t.sprint && currentSprint === 1));
  }, [tasks, currentSprint]);

  const pendingTasks = sprintTasks.filter(t => t.status === TaskStatus.PENDING || t.status === TaskStatus.FAILED || t.status === TaskStatus.PAUSED);
  const activeTasks = sprintTasks.filter(t => t.status === TaskStatus.IN_PROGRESS || t.status === TaskStatus.REVIEW);
  const completedTasks = sprintTasks.filter(t => t.status === TaskStatus.COMPLETED);

  const getBlockedCount = (task: Task) => {
      if (!task.dependencies || task.dependencies.length === 0) return 0;
      return task.dependencies.filter(depId => {
          const depTask = tasks.find(t => t.id === depId);
          return depTask && depTask.status !== TaskStatus.COMPLETED;
      }).length;
  };

  return (
    <>
      {selectedTask && (
          <TaskDetailModal 
            task={selectedTask} 
            onClose={() => setSelectedTask(null)} 
            onApprove={onApproveTask ? () => { onApproveTask(selectedTask.id); setSelectedTask(null); } : undefined}
            onReject={onRejectTask ? () => { onRejectTask(selectedTask.id); setSelectedTask(null); } : undefined}
            mcpServers={mcpServers}
          />
      )}
      
      {/* View Toggle Header */}
      <div className="flex items-center justify-between mb-3 px-1 shrink-0">
          <h3 className="text-xs font-bold text-slate-700 flex items-center gap-2">
              <Layers size={14} className="text-primary" /> Task Execution
          </h3>
          <div className="bg-white border border-slate-200 rounded-lg p-0.5 flex gap-0.5 shadow-sm">
              <button 
                onClick={() => setViewMode('board')}
                className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-all ${viewMode === 'board' ? 'bg-primary text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                  <Layout size={10} /> Board
              </button>
              <button 
                onClick={() => setViewMode('graph')}
                className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-all ${viewMode === 'graph' ? 'bg-primary text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                  <GitGraph size={10} /> Graph
              </button>
          </div>
      </div>

      {viewMode === 'board' ? (
      <div className="h-full grid grid-cols-3 gap-3 w-full max-w-full overflow-hidden">
        {/* Ready Column */}
        <div className="flex flex-col h-full min-h-0 min-w-0 bg-slate-100/50 rounded-xl border border-slate-200 overflow-hidden">
          <ColumnHeader 
              title={`Sprint ${currentSprint}${estimatedSprints ? ` / ${estimatedSprints}` : ''} Queue`} 
              count={pendingTasks.length} 
              icon={List} 
              colorClass="text-slate-600"
              action={
                  pendingTasks.length > 0 && onRunAll ? (
                      <button 
                          onClick={onRunAll}
                          disabled={isProcessing}
                          className={`flex items-center gap-1.5 px-2 py-1 rounded border transition-all group shadow-sm ${
                              isProcessing 
                                  ? 'bg-primary text-white border-primary cursor-not-allowed opacity-75' 
                                  : 'bg-white hover:bg-primary hover:text-white border-slate-200 hover:border-primary text-slate-500'
                          }`}
                          title={isProcessing ? "Running tasks..." : "Run All Pending Tasks"}
                      >
                          {isProcessing ? (
                              <>
                                  <RefreshCcw size={8} className="animate-spin" />
                                  <span className="text-[9px] font-bold uppercase tracking-wider">Running...</span>
                              </>
                          ) : (
                              <>
                                  <Play size={8} className="fill-current group-hover:text-white transition-colors" />
                                  <span className="text-[9px] font-bold uppercase tracking-wider">Run All</span>
                              </>
                          )}
                      </button>
                  ) : null
              } 
          />
          <div className="flex-1 p-2 overflow-y-auto custom-scrollbar space-y-2 min-h-0 min-w-0 relative flex flex-col items-center w-full">
            {pendingTasks.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center opacity-40">
                    <Layers size={24} className="mb-2 text-slate-300" />
                    <span className="text-[10px] font-mono text-slate-400">Queue Empty</span>
                </div>
            )}
            {pendingTasks.map(task => (
              <TaskCard 
                  key={task.id} 
                  task={task} 
                  onExecute={() => onExecuteTask(task.id)} 
                  disabled={isProcessing} 
                  onSelect={() => setSelectedTask(task)}
                  onDelete={() => onDeleteTask(task.id)}
                  onEdit={() => onEditTask(task)}
                  blockedByCount={getBlockedCount(task)}
              />
            ))}
          </div>
        </div>

        {/* In Progress Column */}
        <div className="flex flex-col h-full min-h-0 min-w-0 bg-primary/5 rounded-xl border border-primary/10 overflow-hidden">
          <ColumnHeader title="Processing / Review" count={activeTasks.length} icon={Clock} colorClass="text-primary" />
          <div className="flex-1 p-2 overflow-y-auto custom-scrollbar space-y-2 min-h-0 min-w-0 relative flex flex-col items-center w-full">
             {activeTasks.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center opacity-40 text-primary">
                    <Clock size={24} className="mb-2" />
                    <span className="text-[10px] font-mono">Idle State</span>
                </div>
             )}
             {activeTasks.map(task => (
              <TaskCard 
                key={task.id} 
                task={task} 
                onExecute={() => {}} 
                disabled={true} 
                onSelect={() => setSelectedTask(task)} 
                onDelete={() => onDeleteTask(task.id)}
                onEdit={() => onEditTask(task)}
                onApprove={onApproveTask ? () => onApproveTask(task.id) : undefined}
                onReject={onRejectTask ? () => onRejectTask(task.id) : undefined}
                blockedByCount={0}
              />
            ))}
          </div>
        </div>

        {/* Done Column */}
        <div className="flex flex-col h-full min-h-0 min-w-0 bg-slate-100/50 rounded-xl border border-slate-200 overflow-hidden">
          <ColumnHeader title="Completed" count={completedTasks.length} icon={CheckCircle2} colorClass="text-success" />
          <div className="flex-1 p-2 overflow-y-auto custom-scrollbar space-y-2 min-h-0 min-w-0 relative flex flex-col items-center w-full">
            {completedTasks.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center opacity-40 text-success">
                    <CheckCircle2 size={24} className="mb-2" />
                    <span className="text-[10px] font-mono">No Output</span>
                </div>
            )}
            {completedTasks.map(task => (
              <TaskCard 
                key={task.id} 
                task={task} 
                onExecute={() => {}} 
                disabled={true} 
                onSelect={() => setSelectedTask(task)} 
                onDelete={() => onDeleteTask(task.id)}
                onEdit={() => onEditTask(task)}
                blockedByCount={0}
              />
            ))}
          </div>
        </div>
      </div>
      ) : (
          <div className="h-full border border-slate-200 rounded-xl overflow-hidden bg-white shadow-inner relative">
              {sprintTasks.length === 0 ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
                      <GitGraph size={32} className="mb-3 opacity-50" />
                      <p className="text-xs font-bold">No Tasks to Visualize</p>
                      <p className="text-[10px] opacity-70">Add tasks to see the dependency graph.</p>
                  </div>
              ) : (
                  <TaskDependencyGraph 
                    tasks={sprintTasks} 
                    onSelectTask={setSelectedTask} 
                    onExecuteTask={onExecuteTask} 
                  />
              )}
          </div>
      )}
    </>
  );
};

export default memo(KanbanBoard);
