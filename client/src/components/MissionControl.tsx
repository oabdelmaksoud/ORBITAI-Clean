import React, { useEffect, useRef } from 'react';
import { Sparkles, Terminal, Check, Brain, Zap, RefreshCw, BarChart3, Bug, XCircle, CheckCircle } from 'lucide-react';

// Generation status event type (matches backend)
export interface GenerationStatusEvent {
    type: 'ai_thought' | 'process_stage' | 'model_selection' | 'progress' | 'debug' | 'error' | 'complete';
    message: string;
    timestamp: number;
    metadata?: {
        model?: string;
        provider?: string;
        stage?: string;
        progress?: number;
        agentName?: string;
        duration?: number;
        tokenCount?: number;
        cost?: number;
        details?: string;
    };
}

// Support both string logs (legacy) and GenerationStatusEvent (new)
type LogEntry = string | GenerationStatusEvent;

interface MissionControlProps {
    progress: number;
    logs: LogEntry[];
    showMetadata?: boolean; // Show additional metadata for events
}

// Get styling for different event types
function getEventStyles(type: GenerationStatusEvent['type']): { textClass: string; icon: React.ReactNode } {
    switch (type) {
        case 'ai_thought':
            return {
                textClass: 'text-purple-600 font-medium',
                icon: <Brain size={12} className="text-purple-500" />
            };
        case 'model_selection':
            return {
                textClass: 'text-amber-600 font-semibold',
                icon: <Zap size={12} className="text-amber-500" />
            };
        case 'process_stage':
            return {
                textClass: 'text-blue-600',
                icon: <RefreshCw size={12} className="text-blue-500" />
            };
        case 'progress':
            return {
                textClass: 'text-green-600',
                icon: <BarChart3 size={12} className="text-green-500" />
            };
        case 'error':
            return {
                textClass: 'text-red-600 font-bold',
                icon: <XCircle size={12} className="text-red-500" />
            };
        case 'complete':
            return {
                textClass: 'text-green-700 font-bold',
                icon: <CheckCircle size={12} className="text-green-600" />
            };
        case 'debug':
        default:
            return {
                textClass: 'text-slate-500',
                icon: <Bug size={12} className="text-slate-400" />
            };
    }
}

// Parse log entry - handles both string and GenerationStatusEvent
function parseLogEntry(entry: LogEntry): { message: string; timestamp: number; type: GenerationStatusEvent['type']; metadata?: GenerationStatusEvent['metadata'] } {
    if (typeof entry === 'string') {
        // Legacy string format - infer type from content
        let type: GenerationStatusEvent['type'] = 'process_stage';
        if (entry.includes('Error') || entry.includes('❌')) type = 'error';
        else if (entry.includes('Success') || entry.includes('Complete') || entry.includes('✅')) type = 'complete';
        else if (entry.includes('🧠') || entry.includes('AI') || entry.includes('Thought')) type = 'ai_thought';
        else if (entry.includes('⚡') || entry.includes('Model') || entry.includes('Selected')) type = 'model_selection';
        else if (entry.includes('📊') || entry.includes('Progress')) type = 'progress';
        else if (entry.includes('🔧') || entry.includes('Debug')) type = 'debug';

        return {
            message: entry,
            timestamp: Date.now(),
            type,
        };
    }

    return {
        message: entry.message,
        timestamp: entry.timestamp,
        type: entry.type,
        metadata: entry.metadata,
    };
}

const MissionControl: React.FC<MissionControlProps> = ({ progress, logs, showMetadata = false }) => {
    const logsEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll terminal
    useEffect(() => {
        if (logsEndRef.current) {
            logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs]);

    return (
        <div className="w-full h-full bg-white text-slate-800 font-mono text-sm flex overflow-hidden rounded-xl shadow-2xl border border-slate-200">

            {/* Left Panel: Visual Progress (35% width) - Day Theme */}
            <div className="w-[35%] border-r border-slate-200 bg-slate-50 flex flex-col p-6">
                <div className="mb-6 text-center">
                    <div className="w-12 h-12 mx-auto mb-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg shadow-purple-500/20">
                        <Sparkles className="text-white animate-pulse" size={20} />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 mb-1 tracking-tight">System Building</h3>
                    <p className="text-xs text-slate-500">Constructing project blueprint...</p>
                </div>

                <div className="flex-1 space-y-3 overflow-y-auto custom-scrollbar pr-2">
                    {[
                        { name: 'Initializing Agent', threshold: 10, icon: '🤖' },
                        { name: 'Analyzing Context', threshold: 30, icon: '🔍' },
                        { name: 'Architecting System', threshold: 50, icon: '🏗️' },
                        { name: 'Generating Schema', threshold: 70, icon: '📊' },
                        { name: 'Building Interface', threshold: 85, icon: '🎨' },
                        { name: 'Finalizing Blueprint', threshold: 100, icon: '✨' },
                    ].map((phase, idx) => {
                        const isComplete = progress >= phase.threshold;
                        const isActive = progress >= (idx === 0 ? 0 : [10, 30, 50, 70, 85][idx - 1]) && progress < phase.threshold;

                        return (
                            <div
                                key={phase.name}
                                className={`flex items-center gap-3 p-3 rounded-lg border transition-all duration-300 ${isActive
                                    ? 'bg-white border-blue-500 shadow-md ring-1 ring-blue-500/20'
                                    : isComplete
                                        ? 'bg-green-50 border-green-200 opacity-80'
                                        : 'bg-slate-100 border-transparent opacity-50'
                                    }`}
                            >
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-lg ${isActive ? 'bg-blue-500 text-white shadow-lg' : isComplete ? 'bg-green-100 text-green-600' : 'bg-slate-200 text-slate-400'
                                    }`}>
                                    {isComplete ? <Check size={14} strokeWidth={3} /> : phase.icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className={`text-xs font-bold truncate ${isActive ? 'text-blue-600' : isComplete ? 'text-green-700' : 'text-slate-400'}`}>
                                        {phase.name}
                                    </p>
                                    {isActive && (
                                        <div className="h-1 w-full bg-slate-200 rounded-full mt-1.5 overflow-hidden">
                                            <div className="h-full bg-blue-500 animate-progress-indeterminate" />
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="mt-6 pt-4 border-t border-slate-200">
                    <div className="flex justify-between items-end mb-2">
                        <span className="text-xs text-slate-500 font-medium">Total Progress</span>
                        <span className="text-2xl font-black text-slate-800">
                            {progress < 1 ? progress.toFixed(1) : Math.round(progress)}%
                        </span>
                    </div>
                    <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 transition-all duration-200 ease-out"
                            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* Right Panel: Terminal (65% width) - Day Theme */}
            <div className="w-[65%] flex flex-col bg-white border-l border-slate-200">
                {/* Terminal Header */}
                <div className="bg-slate-50 p-3 flex items-center justify-between border-b border-slate-200">
                    <div className="flex items-center gap-2">
                        <div className="flex gap-1.5 hover:opacity-100 transition-opacity">
                            <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                            <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                            <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                        </div>
                        <div className="ml-3 flex items-center gap-1.5 px-2 py-0.5 rounded bg-white border border-slate-200 shadow-sm">
                            <Terminal size={10} className="text-slate-500" />
                            <span className="text-[10px] text-slate-600 font-mono">orbit-cli — watch</span>
                        </div>
                    </div>
                    <div className="text-[10px] text-slate-500 flex items-center gap-2 font-mono">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                        LIVE
                    </div>
                </div>

                {/* Terminal Content */}
                <div className="flex-1 p-4 overflow-y-auto custom-scrollbar font-mono bg-white" style={{ scrollBehavior: 'smooth' }}>
                    <div className="space-y-1.5">
                        <div className="text-slate-400 mb-4 text-xs">

                            (c) Orbit AI Corporation. All rights reserved.<br />
                            <br />
                            C:\Users\Orbit\Projects&gt; init-prototype --verbose
                        </div>

                        {logs.map((log, index) => {
                            const parsed = parseLogEntry(log);
                            const styles = getEventStyles(parsed.type);

                            return (
                                <div key={index} className="flex gap-3 text-xs animate-in fade-in slide-in-from-left-1 duration-150 group">
                                    <span className="text-slate-400 shrink-0 font-mono select-none w-14 text-right">
                                        {new Date(parsed.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                    </span>
                                    <div className="flex items-start gap-1.5 flex-1 min-w-0">
                                        <span className="shrink-0 mt-0.5">{styles.icon}</span>
                                        <div className="flex-1 break-words">
                                            <span className={styles.textClass}>
                                                {parsed.message}
                                            </span>
                                            {/* Show metadata if enabled */}
                                            {showMetadata && parsed.metadata && (
                                                <div className="text-[10px] text-slate-400 mt-0.5">
                                                    {parsed.metadata.model && <span className="mr-2">Model: {parsed.metadata.model}</span>}
                                                    {parsed.metadata.provider && <span className="mr-2">via {parsed.metadata.provider}</span>}
                                                    {parsed.metadata.duration && <span className="mr-2">({(parsed.metadata.duration / 1000).toFixed(1)}s)</span>}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                        {/* Active Line Indicator */}
                        <div className="flex items-center gap-3 mt-2 text-xs">
                            <span className="text-slate-400 shrink-0 w-14 text-right">
                                {new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                            <div className="flex items-center gap-1">
                                <span className="text-green-500">➜</span>
                                <span className="w-2 h-4 bg-slate-200 animate-pulse" />
                            </div>
                        </div>
                        <div ref={logsEndRef} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MissionControl;
