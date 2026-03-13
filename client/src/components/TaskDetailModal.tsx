
import React, { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Task, TaskStatus, MCPServer } from '@orbitai/shared';
import { X, User, Link, FileText, Terminal, ExternalLink, Layers, Globe, BrainCircuit, Sparkles, CheckCircle2, AlertCircle, Clock, Coins, Cpu, Zap, MessageSquare, Medal, Flag, ShieldAlert, ThumbsUp, ThumbsDown, Server } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface TaskDetailModalProps {
  task: Task;
  onClose: () => void;
  onApprove?: () => void;
  onReject?: () => void;
  mcpServers?: MCPServer[]; // Optional: MCP servers for the project
}

const TaskDetailModal: React.FC<TaskDetailModalProps> = ({ task, onClose, onApprove, onReject, mcpServers = [] }) => {
  if (!task) return null;

  const isPlannerMessage = (sender: string) => sender.includes('(Planner)');
  const isReview = task.status === TaskStatus.REVIEW;

  // Extract MCP information from collaboration events and logs
  const mcpInfo = useMemo(() => {
    // Filter active servers - treat undefined/null status as 'active' for system servers
    const activeServers = mcpServers.filter(s => {
      if (!s) return false;
      // System servers (source: 'system') default to active if status is missing
      if (s.source === 'system' && (!s.status || s.status === 'active')) return true;
      // Other servers must explicitly have status: 'active'
      return s.status === 'active';
    });
    const hasMCPMessage = task.collaboration?.some(e => 
      e.message.toLowerCase().includes('mcp') || 
      e.message.includes('🔧') ||
      e.message.toLowerCase().includes('file/command access')
    ) || task.logs?.some(log => 
      log.toLowerCase().includes('mcp') || 
      log.toLowerCase().includes('enabling mcp')
    );

    if (!hasMCPMessage && activeServers.length === 0) return null;

    return {
      hasMCPMessage,
      activeServers,
      totalTools: activeServers.reduce((sum, s) => sum + (s.tools?.length || 0), 0)
    };
  }, [task.collaboration, task.logs, mcpServers]);

  // Extract reasoning from logs when collaboration is empty
  const extractReasoningFromLogs = () => {
    if (!task.logs || task.logs.length === 0) return null;
    
    // Look for reasoning patterns in logs
    const reasoningKeywords = ['reasoning', 'thinking', 'analyze', 'consider', 'plan', 'approach', 'strategy', 'decide', 'conclusion', 'understand', 'evaluate'];
    
    const reasoningLogs = task.logs
      .map(log => {
        const content = log.replace(/^\[.*?\]\s*/, '').trim();
        const lowerContent = content.toLowerCase();
        
        // Filter out system messages, errors, and very short messages
        if (content.length < 30) return null;
        if (lowerContent.includes('error') || lowerContent.includes('failed') || lowerContent.includes('exception')) return null;
        if (content.match(/^(GET|POST|PUT|DELETE|HTTP|API|Request|Response|Status|Code)/i)) return null;
        if (content.match(/^\[.*?\]/)) return null; // Skip logs that are just timestamps/formatting
        
        // Prioritize logs that contain reasoning keywords, but also include other meaningful content
        const hasReasoningKeyword = reasoningKeywords.some(keyword => lowerContent.includes(keyword));
        const looksLikeReasoning = hasReasoningKeyword || 
          (content.length > 50 && !content.match(/^[A-Z_]+:/) && !content.includes('://'));
        
        return looksLikeReasoning ? content : null;
      })
      .filter((log): log is string => log !== null && log.length > 0);
    
    if (reasoningLogs.length === 0) return null;
    
    // Combine reasoning logs into a single message
    return reasoningLogs.join('\n\n');
  };

  const reasoningFromLogs = extractReasoningFromLogs();

  const modalContent = (
    <div 
      className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 p-4" 
      onClick={onClose}
      style={{ 
        zIndex: 99999,
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0
      }}
    >
      <div 
        className={`bg-white rounded-xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border ${isReview ? 'border-amber-400 ring-2 ring-amber-200' : 'border-slate-200'}`}
        onClick={e => e.stopPropagation()}
        style={{ 
          width: '90%',
          maxWidth: '600px',
          minWidth: '500px',
          zIndex: 100000,
          position: 'relative'
        }}
      >
        
        {/* Header */}
        <div className={`p-5 border-b flex items-start justify-between shrink-0 ${isReview ? 'bg-amber-50 border-amber-100' : 'bg-slate-50 border-slate-200'}`}>
            <div className="flex-1 min-w-0 mr-4">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border flex items-center gap-1 ${
                        task.status === TaskStatus.COMPLETED ? 'bg-success/10 text-success border-success/20' :
                        task.status === TaskStatus.IN_PROGRESS ? 'bg-primary/10 text-primary border-primary/20' :
                        task.status === TaskStatus.REVIEW ? 'bg-amber-100 text-amber-700 border-amber-200' :
                        task.status === TaskStatus.FAILED ? 'bg-error/10 text-error border-error/20' :
                        'bg-slate-100 text-slate-500 border-slate-200'
                    }`}>
                        {task.status === TaskStatus.COMPLETED && <CheckCircle2 size={10} />}
                        {task.status === TaskStatus.IN_PROGRESS && <Clock size={10} className="animate-pulse" />}
                        {task.status === TaskStatus.REVIEW && <ShieldAlert size={10} className="animate-bounce" />}
                        {task.status === TaskStatus.FAILED && <AlertCircle size={10} />}
                        {task.status}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">ID: {task.id.substring(0, 8)}</span>
                    
                    {/* Cost Metric Badge */}
                    {(task.cost != null && typeof task.cost === 'number') && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-yellow-50 text-yellow-700 border border-yellow-200 flex items-center gap-1" title="Estimated API Cost">
                            <Coins size={10} /> ${task.cost.toFixed(4)}
                        </span>
                    )}
                    {/* Token Metric Badge - Show as "Estimated Time" */}
                    {(task.tokenUsage?.totalTokens != null && typeof task.tokenUsage.totalTokens === 'number') && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1" title="Total Tokens">
                            <Clock size={10} /> {(task.tokenUsage.totalTokens / 1000).toFixed(1)}k
                        </span>
                    )}
                </div>
                <h2 className="text-lg font-bold text-slate-800 leading-tight">{task.title}</h2>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors p-1 hover:bg-slate-200 rounded shrink-0">
                <X size={20} />
            </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50/30">
            {isReview && (
                <div className="mx-6 mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl shadow-sm flex items-start gap-3">
                    <div className="p-2 bg-amber-100 rounded-full text-amber-600 shrink-0">
                        <ShieldAlert size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold text-amber-800 mb-1">Quality Gate Triggered</h3>
                        <p className="text-xs text-amber-700 leading-relaxed mb-3">
                            The automated evaluation score ({task.evaluation?.score || 0}/100) is below the safety threshold (70/100). 
                            Human intervention is required to verify the output quality before proceeding.
                        </p>
                        <div className="flex gap-3">
                            <button 
                                onClick={onApprove}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-colors shadow-sm"
                            >
                                <ThumbsUp size={12} /> Force Approve
                            </button>
                            <button 
                                onClick={onReject}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-red-200 text-red-600 hover:bg-red-50 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors"
                            >
                                <ThumbsDown size={12} /> Reject & Retry
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="p-6 space-y-6">
                
                {/* Info Grid */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-sm">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                            <User size={12} /> Assignee
                        </div>
                        <div className="text-sm font-bold text-slate-700 flex items-center gap-2">
                            {task.assignedTo}
                            {task.modelUsed && <span className="text-[9px] font-mono font-normal text-slate-400 bg-slate-100 px-1.5 rounded">({task.modelUsed})</span>}
                        </div>
                    </div>
                    <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-sm">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                            <Layers size={12} /> Phase
                        </div>
                        <div className="text-sm font-bold text-slate-700">{task.phase}</div>
                    </div>
                </div>

                {/* Genkit Evaluation Card */}
                {task.evaluation && (
                    <div className={`p-4 rounded-xl border shadow-sm ${
                        task.evaluation.score === 0 ? 'bg-slate-50 border-slate-200' :
                        task.evaluation.score >= 90 ? 'bg-green-50 border-green-200' :
                        task.evaluation.score >= 70 ? 'bg-yellow-50 border-yellow-200' :
                        'bg-red-50 border-red-200'
                    }`}>
                        <div className="flex justify-between items-start mb-2">
                            <h3 className={`text-xs font-bold uppercase tracking-widest flex items-center gap-2 ${
                                task.evaluation.score === 0 ? 'text-slate-600' :
                                task.evaluation.score >= 90 ? 'text-green-700' :
                                task.evaluation.score >= 70 ? 'text-yellow-700' :
                                'text-red-700'
                            }`}>
                                <Medal size={14} /> AI Quality Score: {task.evaluation.score === 0 ? 'Pending' : `${task.evaluation.score}/100`}
                            </h3>
                            <span className="text-[9px] font-mono text-slate-500 opacity-70">Genkit Eval</span>
                        </div>
                        <p className="text-sm leading-relaxed text-slate-700 font-medium mb-2">
                            {task.evaluation.reasoning || 'Quality score will be calculated when task is executed.'}
                        </p>
                        {task.evaluation.criteria && (
                            <div className="flex gap-2 mt-2">
                                {task.evaluation.criteria.map(crit => (
                                    <span key={crit} className="text-[9px] px-1.5 py-0.5 bg-white rounded border border-black/10 opacity-70">
                                        {crit}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Description */}
                <div>
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-2 flex items-center gap-2">
                        <FileText size={14} className="text-primary" /> Task Scope
                    </h3>
                    <div className="p-5 bg-white border border-slate-200 rounded-lg shadow-sm">
                        <div className="prose prose-sm max-w-none 
                            text-slate-600 font-normal leading-relaxed
                            prose-headings:font-bold prose-headings:text-slate-800
                            prose-p:mb-3
                            prose-strong:font-semibold prose-strong:text-slate-900
                            prose-ul:list-disc prose-ul:pl-5
                            prose-li:marker:text-slate-300
                            prose-code:text-primary prose-code:bg-primary/5 prose-code:px-1 prose-code:rounded
                        ">
                            <ReactMarkdown>{task.description}</ReactMarkdown>
                        </div>
                    </div>
                </div>

                {/* MCP Tools Information */}
                {mcpInfo && (
                    <div className="mb-6">
                        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-2 flex items-center gap-2">
                            <Server size={14} className="text-purple-500" /> MCP Tools & Servers
                        </h3>
                        <div className="bg-purple-50/50 border border-purple-200 rounded-lg p-4 space-y-3">
                            {mcpInfo.hasMCPMessage && (
                                <div className="flex items-start gap-2 text-xs text-purple-800">
                                    <Zap size={14} className="text-purple-500 shrink-0 mt-0.5" />
                                    <span className="font-medium">MCP tools were automatically enabled for this task</span>
                                </div>
                            )}
                            {mcpInfo.activeServers.length > 0 ? (
                                <div className="space-y-2">
                                    <div className="text-[10px] font-bold text-purple-700 uppercase tracking-widest">
                                        Active Servers ({mcpInfo.activeServers.length})
                                    </div>
                                    {mcpInfo.activeServers.map((server) => (
                                        <div key={server.id} className="bg-white/60 rounded-lg p-2.5 border border-purple-100">
                                            <div className="flex items-start justify-between mb-1.5">
                                                <div className="flex items-center gap-2">
                                                    <Server size={12} className="text-purple-500" />
                                                    <span className="text-xs font-bold text-purple-800">{server.name}</span>
                                                </div>
                                                <span className="text-[9px] font-mono text-purple-600 bg-purple-100 px-1.5 py-0.5 rounded">
                                                    {server.tools?.length || 0} tools
                                                </span>
                                            </div>
                                            {server.description && (
                                                <p className="text-[10px] text-purple-700 mt-1 leading-relaxed">{server.description}</p>
                                            )}
                                            {server.tools && server.tools.length > 0 && (
                                                <div className="mt-2 flex flex-wrap gap-1">
                                                    {server.tools.slice(0, 5).map((tool, i) => (
                                                        <span key={i} className="text-[9px] px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded border border-purple-200 font-mono">
                                                            {tool}
                                                        </span>
                                                    ))}
                                                    {server.tools.length > 5 && (
                                                        <span className="text-[9px] px-1.5 py-0.5 bg-purple-100 text-purple-600 rounded border border-purple-200">
                                                            +{server.tools.length - 5} more
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    {mcpInfo.totalTools > 0 && (
                                        <div className="text-[10px] text-purple-600 font-medium pt-1 border-t border-purple-200">
                                            Total: {mcpInfo.totalTools} MCP tool{mcpInfo.totalTools !== 1 ? 's' : ''} available
                                        </div>
                                    )}
                                </div>
                            ) : mcpInfo.hasMCPMessage && (
                                <div className="text-xs text-purple-700">
                                    MCP tools were requested, but no active MCP servers are configured for this project.
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Multi-Layer Collaboration Trace */}
                {task.collaboration && task.collaboration.length > 0 ? (
                     <div>
                        <h3 className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <BrainCircuit size={12} /> Agent Cognition
                        </h3>
                        <div className="space-y-2 relative">
                            <div className="absolute top-3 left-3 bottom-3 w-0.5 bg-indigo-100 -z-10"></div>
                            
                            {(() => {
                                // Deduplicate collaboration events by ID (if available) or by message content + sender + timestamp (within 5 seconds)
                                const seen = new Set<string>();
                                const deduplicated = task.collaboration.filter((event) => {
                                    // Use event ID if available, otherwise use message + sender + timestamp bucket
                                    const key = event.id || `${event.message}|${event.sender}|${Math.floor(event.timestamp / 5000)}`;
                                    if (seen.has(key)) {
                                        return false; // Duplicate found
                                    }
                                    seen.add(key);
                                    return true;
                                });
                                return deduplicated;
                            })().map((event, idx) => {
                                const isPlan = isPlannerMessage(event.sender);
                                const isEval = event.sender.includes('Evaluator');
                                
                                return (
                                    <div key={idx} className={`relative pl-8 animate-in fade-in slide-in-from-bottom-2 duration-500`}>
                                        <div className={`absolute left-0 top-0 w-6 h-6 rounded-full border-2 flex items-center justify-center z-10 bg-white ${
                                            isEval ? 'border-green-500 text-green-600 shadow-green-200' : 
                                            isPlan ? 'border-indigo-500 text-indigo-600 shadow-indigo-200' : 
                                            'border-slate-300 text-slate-400'
                                        }`}>
                                            {isEval ? <Flag size={12} /> : isPlan ? <BrainCircuit size={12} /> : <MessageSquare size={12} />}
                                        </div>
                                        
                                        <div className={`p-2.5 rounded-lg border shadow-sm ${
                                            isEval 
                                                ? 'bg-green-50/50 border-green-200'
                                                : isPlan 
                                                ? 'bg-indigo-50/50 border-indigo-200' 
                                                : 'bg-white border-slate-200'
                                        }`}>
                                            <div className="flex items-center justify-between mb-1.5">
                                                <span className={`text-[9px] font-bold uppercase tracking-wider truncate ${
                                                    isEval ? 'text-green-700' : 
                                                    isPlan ? 'text-indigo-700' : 'text-slate-600'
                                                }`}>
                                                    {event.sender}
                                                </span>
                                                <span className="text-[8px] font-mono text-slate-400 shrink-0 ml-1">
                                                    {new Date(event.timestamp).toLocaleTimeString()}
                                                </span>
                                            </div>
                                            
                                            <div className={`prose prose-sm max-w-none text-[10px] leading-relaxed ${
                                                isEval ? 'text-green-900' :
                                                isPlan ? 'text-indigo-900 prose-strong:text-indigo-900' : 'text-slate-600'
                                            } prose-p:mb-1 prose-p:text-[10px] prose-headings:text-xs`}>
                                                <ReactMarkdown>{event.message}</ReactMarkdown>
                                            </div>
                                            
                                            {isPlan && (
                                                <div className="mt-1.5 flex items-center gap-1 text-[8px] font-bold text-indigo-500 uppercase tracking-wider">
                                                    <Zap size={8} className="fill-current" /> Optimization Active
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                     </div>
                ) : reasoningFromLogs ? (
                    // Show reasoning extracted from logs
                    <div>
                        <h3 className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <BrainCircuit size={12} /> Agent Reasoning
                        </h3>
                        <div className="space-y-2 relative">
                            <div className="absolute top-3 left-3 bottom-3 w-0.5 bg-indigo-100 -z-10"></div>
                            <div className="relative pl-8">
                                <div className="absolute left-0 top-0 w-6 h-6 rounded-full border-2 flex items-center justify-center z-10 bg-white border-indigo-500 text-indigo-600 shadow-indigo-200">
                                    <BrainCircuit size={12} />
                                </div>
                                <div className="p-2.5 rounded-lg border shadow-sm bg-indigo-50/50 border-indigo-200">
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-[9px] font-bold uppercase tracking-wider text-indigo-700 truncate">
                                            {task.assignedTo}
                                        </span>
                                        {task.startTime && (
                                            <span className="text-[8px] font-mono text-slate-400 shrink-0 ml-1">
                                                {new Date(task.startTime).toLocaleTimeString()}
                                            </span>
                                        )}
                                    </div>
                                    <div className="prose prose-sm max-w-none text-[10px] leading-relaxed text-indigo-900 prose-strong:text-indigo-900 prose-p:mb-1 prose-p:text-[10px]">
                                        <ReactMarkdown>{reasoningFromLogs}</ReactMarkdown>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : task.status === TaskStatus.COMPLETED || task.status === TaskStatus.IN_PROGRESS ? (
                    // Fallback: Show message that no reasoning is available, but try to extract from logs first
                    reasoningFromLogs ? (
                        <div>
                            <h3 className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                <BrainCircuit size={12} /> Agent Reasoning (from logs)
                            </h3>
                            <div className="space-y-2 relative">
                                <div className="absolute top-3 left-3 bottom-3 w-0.5 bg-indigo-100 -z-10"></div>
                                <div className="relative pl-8">
                                    <div className="absolute left-0 top-0 w-6 h-6 rounded-full border-2 flex items-center justify-center z-10 bg-white border-indigo-500 text-indigo-600 shadow-indigo-200">
                                        <BrainCircuit size={12} />
                                    </div>
                                    <div className="p-2.5 rounded-lg border shadow-sm bg-indigo-50/50 border-indigo-200">
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="text-[9px] font-bold uppercase tracking-wider text-indigo-700 truncate">
                                                {task.assignedTo}
                                            </span>
                                            {task.startTime && (
                                                <span className="text-[8px] font-mono text-slate-400 shrink-0 ml-1">
                                                    {new Date(task.startTime).toLocaleTimeString()}
                                                </span>
                                            )}
                                        </div>
                                        <div className="prose prose-sm max-w-none text-[10px] leading-relaxed text-indigo-900 prose-strong:text-indigo-900 prose-p:mb-1 prose-p:text-[10px]">
                                            <ReactMarkdown>{reasoningFromLogs}</ReactMarkdown>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div>
                            <h3 className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                <BrainCircuit size={12} /> Agent Reasoning
                            </h3>
                            <div className="bg-slate-50 border border-slate-200 rounded-md p-3 relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-2 opacity-10">
                                    <BrainCircuit size={40} />
                                </div>
                                <div className="text-[10px] text-slate-500 relative z-10">
                                    {task.status === TaskStatus.IN_PROGRESS 
                                        ? 'Reasoning trace will be captured when task completes.'
                                        : 'No reasoning trace was captured for this task. This may occur if the agent completed the task without explicit reasoning markers.'}
                                </div>
                            </div>
                        </div>
                    )
                ) : null}

                {/* Traceability & Resources Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {task.traceRefs && task.traceRefs.length > 0 && (
                        <div>
                            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-2 flex items-center gap-2">
                                <Link size={14} className="text-secondary" /> Trace References
                            </h3>
                            <div className="flex flex-wrap gap-2">
                                {task.traceRefs.map(ref => (
                                    <span key={ref} className="px-2 py-1 bg-slate-100 text-slate-600 text-xs font-mono rounded border border-slate-200 flex items-center gap-1">
                                        <Link size={10} className="opacity-50" /> {ref}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {task.resources && task.resources.length > 0 && (
                        <div>
                            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-2 flex items-center gap-2">
                                <ExternalLink size={14} className="text-success" /> Resources Found
                            </h3>
                            <div className="space-y-1">
                                {task.resources.map((url, idx) => (
                                    <a key={idx} href={url} target="_blank" rel="noreferrer" className="flex items-center gap-2 p-1.5 hover:bg-slate-100 rounded text-xs text-primary transition-colors truncate group">
                                        <Globe size={12} className="shrink-0 text-slate-400 group-hover:text-primary" />
                                        <span className="truncate underline decoration-slate-200 group-hover:decoration-primary underline-offset-2">{url}</span>
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Execution Logs */}
                <div>
                     <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-2 flex items-center gap-2">
                        <Terminal size={14} className="text-slate-500" /> System Execution Log
                    </h3>
                    <div className="bg-slate-900 rounded-lg p-4 font-mono text-[10px] text-slate-300 h-40 overflow-y-auto custom-scrollbar shadow-inner border border-slate-800 leading-relaxed">
                        {(!task.logs || task.logs.length === 0) ? (
                            <span className="text-slate-600 italic">No low-level system logs available.</span>
                        ) : (
                            <div className="space-y-1">
                                {task.logs.map((log, i) => (
                                    <div key={i} className="flex gap-2 border-b border-white/5 pb-0.5 last:border-0">
                                        <span className="text-slate-500 shrink-0 select-none w-16">
                                            {log.match(/^\[(.*?)\]/)?.[1] || '00:00:00'}
                                        </span>
                                        <span className={`break-all ${
                                            log.toLowerCase().includes('error') || log.toLowerCase().includes('fail') ? 'text-red-400' :
                                            log.toLowerCase().includes('success') || log.toLowerCase().includes('complete') ? 'text-emerald-400' :
                                            log.toLowerCase().includes('resource') ? 'text-blue-400' :
                                            'text-slate-300'
                                        }`}>
                                            {log.replace(/^\[.*?\]\s*/, '')}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-2">
            {isReview && onApprove && onReject && (
                <>
                    <button onClick={onReject} className="px-6 py-2 bg-white border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors shadow-sm">
                        Reject & Retry
                    </button>
                    <button onClick={onApprove} className="px-6 py-2 bg-emerald-600 border border-emerald-700 hover:bg-emerald-700 text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-colors shadow-sm">
                        Approve Output
                    </button>
                </>
            )}
            <button onClick={onClose} className="px-6 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors shadow-sm">
                Close Details
            </button>
        </div>
      </div>
    </div>
  );

  // Render modal in a portal at document body level to ensure it's on top
  if (typeof document !== 'undefined') {
    return createPortal(modalContent, document.body);
  }
  
  return modalContent;
};

export default TaskDetailModal;
