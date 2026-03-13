import React from 'react';
import { Bot } from 'lucide-react';

interface ProcessingOverlayProps {
  label: string;
  progress?: number;
  statusText?: string;
  estimatedTime?: number;
  taskCount?: number;
}

export const ProcessingOverlay: React.FC<ProcessingOverlayProps> = ({
  label,
  progress,
  statusText,
  estimatedTime,
  taskCount
}) => {
  // Calculate estimated time remaining based on progress and elapsed time
  const getEstimatedTimeText = () => {
    if (estimatedTime !== undefined && estimatedTime > 0) {
      return `~${estimatedTime}s remaining`;
    }
    // If no explicit estimate, don't show time estimate
    return '';
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/50 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white border border-slate-200 p-8 rounded-2xl shadow-2xl flex flex-col items-center gap-6 min-w-[320px] max-w-md relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-purple-500 to-primary animate-shimmer bg-[length:200%_100%]"></div>
        <div className="relative w-20 h-20 flex items-center justify-center">
          <div className="absolute inset-0 border-4 border-slate-100 rounded-full"></div>
          <div className={`absolute inset-0 border-4 border-primary border-t-transparent rounded-full ${progress !== undefined ? 'transition-all duration-500' : 'animate-spin'}`} style={progress !== undefined ? { transform: `rotate(${progress * 3.6}deg)` } : {}}></div>
          {progress !== undefined && (
            <div className="absolute inset-0 flex items-center justify-center font-bold text-sm text-primary font-mono">
              {Math.round(progress)}%
            </div>
          )}
          {progress === undefined && <Bot size={32} className="text-primary animate-pulse" />}
        </div>
        <div className="text-center space-y-2 z-10">
          <h3 className="text-lg font-bold text-slate-800 tracking-tight">{label}</h3>
          <p className="text-sm text-slate-500 font-medium">
            {statusText || 'AI Agents are analyzing requirements...'}
          </p>
          {taskCount !== undefined && taskCount > 0 && (
            <p className="text-xs text-slate-400 font-medium">
              Generated {taskCount} task{taskCount !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        <div className="w-full space-y-1.5">
          <div className="flex justify-between text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            <span>Progress</span>
            <span className={progress !== undefined ? "text-primary" : "animate-pulse"}>
              {progress !== undefined ? (progress >= 100 ? 'Complete' : 'Processing...') : 'Thinking...'}
            </span>
          </div>
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
            {progress !== undefined ? (
              <div
                className="h-full bg-gradient-to-r from-primary to-blue-400 transition-all duration-500 ease-out rounded-full"
                style={{ width: `${progress}%` }}
              />
            ) : (
              <div className="h-full bg-gradient-to-r from-primary to-blue-400 w-1/2 animate-[shimmer_1.5s_infinite] rounded-full"></div>
            )}
          </div>
          {(progress !== undefined && progress < 100) && getEstimatedTimeText() && (
            <div className="text-center">
              <p className="text-[10px] text-slate-400 font-medium">{getEstimatedTimeText()}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProcessingOverlay;
