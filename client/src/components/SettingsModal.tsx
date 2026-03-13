import React, { useState } from 'react';
import { AppSettings } from '@orbitai/shared';
import { APIHealth, APIMetrics } from '../services/geminiService';
import { X, ShieldAlert, Trash2, Clock, Terminal, List, Layers, Server, Activity, Zap, BarChart3, CheckCircle, AlertTriangle, Cpu, UserCheck, Key, AlertCircle } from 'lucide-react';
import { LLMConfigSettings } from './LLMConfigSettings';
import { showAlert, showConfirm } from '../utils/browserUtils';
// Get auth token helper function
const getAuthToken = (): string | null => {
    try {
        if (typeof window !== 'undefined' && window.localStorage) {
            return localStorage.getItem('authToken');
        }
    } catch (error) {
        console.error('Error getting auth token:', error);
    }
    return null;
};

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    settings: AppSettings;
    onUpdateSettings: (newSettings: AppSettings) => void;
    onResetProject: () => void;
    apiHealth: { status: APIHealth, metrics: APIMetrics };
    projectId?: string;
    userRole?: string;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
    isOpen, onClose, settings, onUpdateSettings, onResetProject, apiHealth
}) => {
    const [activeTab, setActiveTab] = useState<'general' | 'api' | 'llm'>('general');

    if (!isOpen) return null;

    const errorRate = apiHealth.metrics.requests > 0
        ? Math.round((apiHealth.metrics.errors / apiHealth.metrics.requests) * 100)
        : 0;

    // Use real data or fallback to zeros if history is empty (should be init in service)
    const latencyData = apiHealth.metrics.latencyHistory || new Array(20).fill(0);
    const usageData = apiHealth.metrics.usageHistory || new Array(20).fill(0);

    // Normalize data for charts (0-100%)
    const maxLatency = Math.max(...latencyData, 2000); // Baseline max 2000ms
    const maxUsage = Math.max(...usageData, 5); // Baseline max 5 reqs

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-3xl h-[600px] overflow-hidden relative animate-in zoom-in-95 duration-200 flex flex-col md:flex-row">

                {/* Sidebar Navigation */}
                <div className="w-full md:w-64 bg-slate-50 border-b md:border-b-0 md:border-r border-slate-200 p-4 flex flex-col shrink-0">
                    <h2 className="text-sm font-bold uppercase tracking-widest text-slate-700 flex items-center gap-2 mb-6 px-2">
                        <Terminal size={16} className="text-primary" /> System Config
                    </h2>

                    <nav className="space-y-1 flex-1">
                        <button
                            onClick={() => setActiveTab('general')}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'general'
                                ? 'bg-white text-primary shadow-sm border border-slate-200'
                                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                                }`}
                        >
                            <Layers size={14} /> General
                        </button>
                        <button
                            onClick={() => setActiveTab('api')}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'api'
                                ? 'bg-white text-primary shadow-sm border border-slate-200'
                                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                                }`}
                        >
                            <Activity size={14} /> API Telemetry
                        </button>
                        <button
                            onClick={() => setActiveTab('llm')}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'llm'
                                ? 'bg-white text-primary shadow-sm border border-slate-200'
                                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                                }`}
                        >
                            <Key size={14} /> LLM Config
                        </button>
                    </nav>

                    <div className="pt-4 border-t border-slate-200 mt-auto">
                        <div className="bg-slate-100 rounded-lg p-3">
                            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">OrbitAI Core</div>
                            <div className="text-xs font-mono text-slate-600">v3.1.0 (Stable)</div>
                        </div>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 flex flex-col min-w-0 bg-white relative">
                    <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors p-1 rounded hover:bg-slate-100 z-10">
                        <X size={20} />
                    </button>

                    <div className="flex-1 overflow-y-auto custom-scrollbar p-8">

                        {/* TAB: GENERAL SETTINGS */}
                        {activeTab === 'general' && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-800 mb-1">Workflow Configuration</h3>
                                    <p className="text-sm text-slate-500 mb-6">Tune the simulation speed and concurrency limits.</p>

                                    <div className="space-y-6">
                                        {/* Human-in-the-Loop Toggle */}
                                        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm flex items-center justify-between">
                                            <div>
                                                <div className="flex items-center gap-2 text-slate-700 text-sm font-bold mb-1">
                                                    <UserCheck size={16} className="text-secondary" /> Human-in-the-Loop (HITL)
                                                </div>
                                                <p className="text-xs text-slate-500 max-w-[280px]">
                                                    If enabled, low-quality tasks will pause for manual user review.
                                                    If disabled, AI agents will auto-remediate issues.
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => onUpdateSettings({ ...settings, enableHumanInTheLoop: !settings.enableHumanInTheLoop })}
                                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${settings.enableHumanInTheLoop ? 'bg-primary' : 'bg-slate-200'}`}
                                            >
                                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.enableHumanInTheLoop ? 'translate-x-6' : 'translate-x-1'}`} />
                                            </button>
                                        </div>

                                        {/* Speed Control */}
                                        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm group hover:border-primary/30 transition-colors">
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="flex items-center gap-2 text-slate-700 text-sm font-bold">
                                                    <Clock size={16} className="text-primary" /> Execution Latency
                                                </div>
                                                <span className="text-[10px] font-mono font-bold bg-slate-100 px-2 py-1 rounded text-slate-600 uppercase border border-slate-200">
                                                    {settings.executionSpeed}
                                                </span>
                                            </div>
                                            <input
                                                type="range"
                                                min="0"
                                                max="2"
                                                step="1"
                                                value={settings.executionSpeed === 'slow' ? 0 : settings.executionSpeed === 'normal' ? 1 : 2}
                                                onChange={(e) => {
                                                    const val = parseInt(e.target.value);
                                                    const speed = val === 0 ? 'slow' : val === 1 ? 'normal' : 'fast';
                                                    onUpdateSettings({ ...settings, executionSpeed: speed });
                                                }}
                                                className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-primary"
                                            />
                                            <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-2 font-medium">
                                                <span>Simulation (4s)</span>
                                                <span>Balanced (2s)</span>
                                                <span>Turbo (0.5s)</span>
                                            </div>
                                        </div>

                                        {/* Parallel Tasks Control */}
                                        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm group hover:border-blue-400/30 transition-colors">
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="flex items-center gap-2 text-slate-700 text-sm font-bold">
                                                    <Layers size={16} className="text-blue-500" /> Concurrency Limit
                                                </div>
                                                <span className="text-[10px] font-mono font-bold bg-blue-50 text-blue-600 px-2 py-1 rounded border border-blue-100">
                                                    {settings.maxParallelTasks} Threads
                                                </span>
                                            </div>
                                            <input
                                                type="range"
                                                min="1"
                                                max="10"
                                                step="1"
                                                value={settings.maxParallelTasks || 5}
                                                onChange={(e) => {
                                                    onUpdateSettings({ ...settings, maxParallelTasks: parseInt(e.target.value) });
                                                }}
                                                className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                            />
                                            <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-2 font-medium">
                                                <span>Serial (1)</span>
                                                <span>Multi-Core (5)</span>
                                                <span>Swarm (10)</span>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm">
                                                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                                                    <ShieldAlert size={14} /> Max Retries
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <button
                                                        className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-sm transition-colors"
                                                        onClick={() => onUpdateSettings({ ...settings, maxRetries: Math.max(0, settings.maxRetries - 1) })}
                                                    >
                                                        -
                                                    </button>
                                                    <span className="text-lg font-mono font-bold w-6 text-center">{settings.maxRetries}</span>
                                                    <button
                                                        className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-sm transition-colors"
                                                        onClick={() => onUpdateSettings({ ...settings, maxRetries: Math.min(10, settings.maxRetries + 1) })}
                                                    >
                                                        +
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm">
                                                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                                                    <List size={14} /> Tasks / Phase
                                                </div>
                                                <input
                                                    type="number"
                                                    min="3"
                                                    max="200"
                                                    value={settings.maxTasksPerPhase}
                                                    onChange={(e) => onUpdateSettings({ ...settings, maxTasksPerPhase: Math.min(200, Math.max(3, parseInt(e.target.value) || 5)) })}
                                                    className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg font-mono font-bold text-center focus:outline-none focus:border-primary"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-6 border-t border-slate-200">
                                    <h3 className="text-sm font-bold text-error mb-4 uppercase tracking-wider flex items-center gap-2">
                                        <AlertTriangle size={16} /> Danger Zone
                                    </h3>
                                    <button
                                        onClick={async () => {
                                            if (await showConfirm("Are you sure you want to reset the entire project? This cannot be undone.")) {
                                                onResetProject();
                                                onClose();
                                            }
                                        }}
                                        className="w-full flex items-center justify-center gap-2 p-4 rounded-xl border border-error/30 bg-error/5 text-error hover:bg-error/10 transition-colors text-sm font-bold uppercase tracking-wider shadow-sm hover:shadow-md"
                                    >
                                        <Trash2 size={16} /> Factory Reset Project
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* TAB: API TELEMETRY */}
                        {activeTab === 'api' && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300 h-full flex flex-col">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-800 mb-1">Network Telemetry</h3>
                                        <p className="text-sm text-slate-500">Real-time Gemini API performance metrics.</p>
                                    </div>
                                    <div className={`px-4 py-2 rounded-full border flex items-center gap-2 text-xs font-bold uppercase tracking-wider shadow-sm ${apiHealth.status === 'healthy' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                                        apiHealth.status === 'paused' ? 'bg-red-50 text-red-600 border-red-200' :
                                            'bg-orange-50 text-orange-600 border-orange-200'
                                        }`}>
                                        <Activity size={14} className={apiHealth.status !== 'healthy' ? 'animate-pulse' : ''} />
                                        {apiHealth.status === 'healthy' ? 'Operational' : apiHealth.status === 'paused' ? 'Rate Limited' : 'Degraded'}
                                    </div>
                                </div>

                                {/* Metrics Grid */}
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
                                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-2">
                                            <Server size={12} /> Total Requests
                                        </div>
                                        <div className="text-2xl font-bold text-slate-800">{apiHealth.metrics.requests}</div>
                                    </div>
                                    <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
                                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-2">
                                            <Zap size={12} /> Last Latency
                                        </div>
                                        <div className="text-2xl font-bold text-slate-800">{apiHealth.metrics.lastLatency} <span className="text-sm text-slate-400 font-medium">ms</span></div>
                                    </div>
                                    <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
                                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-2">
                                            <ShieldAlert size={12} /> Error Rate
                                        </div>
                                        <div className={`text-2xl font-bold ${errorRate > 5 ? 'text-error' : 'text-slate-800'}`}>{errorRate}%</div>
                                    </div>
                                </div>

                                {/* Visualization Charts (Real Data) */}
                                <div className="space-y-4">
                                    <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl">
                                        <div className="flex items-center justify-between mb-3">
                                            <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-2">
                                                <BarChart3 size={14} /> Request Volume (RPM)
                                            </h4>
                                            <span className="text-[9px] text-slate-400 font-mono">Live Traffic</span>
                                        </div>
                                        <div className="flex items-end gap-1 h-24 w-full">
                                            {usageData.map((val, i) => (
                                                <div
                                                    key={i}
                                                    className={`flex-1 rounded-t-sm transition-all duration-500 ${val > 3 ? 'bg-orange-300' : 'bg-blue-300'}`}
                                                    style={{
                                                        height: `${Math.max(5, (val / (maxUsage || 1)) * 100)}%`,
                                                        opacity: 0.6 + (i / usageData.length)
                                                    }}
                                                />
                                            ))}
                                        </div>
                                    </div>

                                    <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl">
                                        <div className="flex items-center justify-between mb-3">
                                            <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-2">
                                                <Cpu size={14} /> Latency History
                                            </h4>
                                            <span className="text-[9px] text-slate-400 font-mono">Avg: {Math.round(latencyData.reduce((a, b) => a + b, 0) / latencyData.length)}ms</span>
                                        </div>
                                        <div className="flex items-end gap-1 h-24 w-full">
                                            {latencyData.map((val, i) => (
                                                <div
                                                    key={i}
                                                    className={`flex-1 rounded-t-sm transition-all duration-500 ${val > 2000 ? 'bg-red-300' : 'bg-emerald-300'}`}
                                                    style={{
                                                        height: `${Math.max(5, (val / (maxLatency || 1)) * 100)}%`,
                                                        opacity: 0.6 + (i / latencyData.length)
                                                    }}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Latest Log */}
                                <div className="mt-auto">
                                    <div className="bg-slate-900 text-slate-300 p-4 rounded-xl font-mono text-[10px] leading-relaxed shadow-inner border border-slate-800">
                                        <div className="flex items-center gap-2 text-slate-500 mb-2 border-b border-slate-800 pb-1">
                                            <Terminal size={10} /> System Log Stream
                                        </div>
                                        <p className="break-all">
                                            {apiHealth.metrics.msg ? `> ${apiHealth.metrics.msg}` : "> System initializing... Telemetry active."}
                                        </p>
                                        <p className="text-slate-500 mt-1">{'>'} Monitoring heartbeat...</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* TAB: LLM CONFIGURATION */}
                        {activeTab === 'llm' && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                                {getAuthToken() ? (
                                    <LLMConfigSettings token={getAuthToken()!} />
                                ) : (
                                    <div className="p-8 text-center text-slate-500">
                                        <AlertCircle className="mx-auto mb-4 text-slate-400" size={48} />
                                        <p className="font-medium mb-2">Authentication Required</p>
                                        <p className="text-sm">Please log in to configure LLM settings.</p>
                                    </div>
                                )}
                            </div>
                        )}

                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;