
import React, { useEffect, useRef, memo } from 'react';
import { LogEntry } from '@orbitai/shared';
import { Terminal, Info, CheckCircle, AlertTriangle, AlertCircle, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';

interface LogConsoleProps {
  logs: LogEntry[];
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

const LogConsole: React.FC<LogConsoleProps> = memo(({ logs, isCollapsed, onToggleCollapse }) => {
  const endRef = useRef<HTMLDivElement>(null);
  
  // Performance optimization: Only render the last 150 logs in DOM to prevent lag
  // The full logs are still in state, just not rendered here.
  const visibleLogs = logs.slice(-150);

  useEffect(() => {
    if (!isCollapsed) {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs.length, isCollapsed]);

  const getIcon = (type: LogEntry['type']) => {
    switch (type) {
      case 'success': return <CheckCircle size={12} className="text-success" />;
      case 'error': return <AlertTriangle size={12} className="text-error" />;
      case 'warning': return <AlertCircle size={12} className="text-warning" />;
      case 'action': return <ChevronRight size={12} className="text-primary" />;
      default: return <Info size={12} className="text-slate-500" />;
    }
  };

  return (
    <div className="h-full flex flex-col font-mono text-sm border-t border-slate-200 relative group bg-white">
      {/* Header */}
      <div 
        className="bg-slate-50 p-2 flex justify-between items-center border-b border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors shrink-0 h-9"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onToggleCollapse();
        }}
        onFocus={(e) => e.stopPropagation()}
        onBlur={(e) => e.stopPropagation()}
      >
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2 pl-2">
          <Terminal size={12} className="text-primary" /> System Output
        </span>
        <div className="flex items-center gap-2">
            <span className="text-[9px] text-slate-500 font-medium px-2 py-0.5 rounded bg-white border border-slate-200 shadow-sm">{logs.length} EVENTS</span>
            <button className="text-slate-400 hover:text-slate-600 transition-colors p-1">
                {isCollapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
        </div>
      </div>

      {/* Log Stream */}
      {!isCollapsed && (
          <div className="overflow-y-auto p-4 space-y-1.5 flex-1 custom-scrollbar bg-slate-50/50">
            {logs.length > 150 && (
                <div className="text-center py-2 mb-2">
                    <span className="text-[9px] text-slate-400 bg-slate-100 px-2 py-1 rounded-full">
                        ... {logs.length - 150} earlier logs hidden for performance ...
                    </span>
                </div>
            )}
            
            {visibleLogs.map((log) => (
              <div key={log.id} className="flex gap-3 text-[11px] leading-relaxed font-medium group/line hover:bg-slate-200/50 p-1 rounded transition-colors -mx-2 px-2">
                <span className="text-slate-500 shrink-0 select-none opacity-80 font-mono w-16 text-right">
                  {new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
                <div className="mt-0.5 shrink-0 opacity-90 group-hover/line:opacity-100 transition-opacity">{getIcon(log.type)}</div>
                <div className="break-words whitespace-pre-wrap flex-1 min-w-0">
                  <span className={`font-bold mr-2 uppercase tracking-wide text-[9px] px-1.5 py-0.5 rounded-sm border ${
                      log.agent.includes('Orchestrator') ? 'text-blue-700 border-blue-200 bg-blue-50' : 
                      log.agent.includes('Audit') ? 'text-red-700 border-red-200 bg-red-50' : 
                      'text-slate-600 border-slate-200 bg-slate-100'
                  }`}>
                    {log.agent}
                  </span>
                  <span className={`break-words
                    ${
                      log.type === 'error' ? 'text-red-700' : 
                      log.type === 'success' ? 'text-emerald-700' : 
                      log.type === 'warning' ? 'text-amber-700' :
                      log.type === 'action' ? 'text-blue-700' :
                      'text-slate-700'
                    }
                  `}>
                    {log.message}
                  </span>
                </div>
              </div>
            ))}
            <div ref={endRef} />
            
            {/* Blinking Cursor at bottom */}
            <div className="h-4 w-2 bg-primary/70 animate-pulse mt-2 ml-20"></div>
          </div>
      )}
    </div>
  );
});

export default LogConsole;
