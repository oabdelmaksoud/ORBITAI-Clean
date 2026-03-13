import React from 'react';
import { ProjectPreview, Phase } from '@orbitai/shared';
import PreviewFrame from '../PreviewFrame';
import { Loader2, Rocket, Code, Layout } from 'lucide-react';

interface PrototypingCardProps {
    projectPreview: ProjectPreview | null;
    isGenerating: boolean;
    progress: number;
    onGenerate: () => void;
    onLaunch: () => void;
    onBack: () => void;
}

export const PrototypingCard: React.FC<PrototypingCardProps> = ({
    projectPreview,
    isGenerating,
    progress,
    onGenerate,
    onLaunch,
    onBack
}) => {
    return (
        <div className="w-full h-full flex flex-col bg-white animate-in zoom-in-95 duration-500">
            {/* Header */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-white shrink-0">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="text-slate-400 hover:text-slate-600 text-sm font-medium">
                        ← Back
                    </button>
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <Layout className="text-primary" size={20} />
                        Rapid Prototype
                    </h2>
                </div>
                <div className="flex items-center gap-3">
                    {!projectPreview && !isGenerating && (
                        <button
                            onClick={onGenerate}
                            className="px-4 py-2 bg-primary text-white rounded-lg font-medium text-sm flex items-center gap-2 hover:bg-primary/90 transition-colors"
                        >
                            <Code size={16} /> Generate Prototype
                        </button>
                    )}
                    {projectPreview && (
                        <button
                            onClick={onLaunch}
                            className="px-6 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg font-bold text-sm flex items-center gap-2 hover:shadow-lg transition-all hover:-translate-y-0.5"
                        >
                            <Rocket size={16} /> Launch Project
                        </button>
                    )}
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 relative bg-slate-100 overflow-hidden">
                {isGenerating ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-white/80 backdrop-blur-sm z-10 animate-in fade-in duration-300">
                        <div className="w-24 h-24 relative mb-6">
                            <svg className="w-full h-full" viewBox="0 0 100 100">
                                <circle cx="50" cy="50" r="45" fill="none" stroke="#F1F5F9" strokeWidth="8" />
                                <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="8" className="text-primary" strokeDasharray="283" strokeDashoffset={283 - (283 * progress / 100)} transform="rotate(-90 50 50)" style={{ transition: 'stroke-dashoffset 0.5s ease-out' }} />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center font-bold text-xl text-primary">
                                {Math.round(progress)}%
                            </div>
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 mb-2">Generating Prototype</h3>
                        <p className="text-slate-500 max-w-md animate-pulse">
                            AI Agents are writing code, generating layouts, and assembling your application structure...
                        </p>
                    </div>
                ) : projectPreview ? (
                    <div className="w-full h-full p-4 animate-in zoom-in-95 duration-500">
                        <div className="w-full h-full bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden relative">
                            <PreviewFrame
                                artifact={{
                                    id: 'prototype',
                                    title: projectPreview.projectName || projectPreview.appName || 'Prototype',
                                    content: projectPreview.wireframeCode || '',
                                    type: 'code',
                                    phase: Phase.IMPLEMENTATION,
                                    createdBy: 'Orchestrator',
                                    timestamp: Date.now(),
                                    tags: []
                                }}
                                theme={null}
                            />
                        </div>
                    </div>
                ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 p-8">
                        <div className="w-20 h-20 rounded-2xl bg-slate-200 mb-4 flex items-center justify-center">
                            <Code size={32} />
                        </div>
                        <p className="font-medium">Ready to generate prototype</p>
                    </div>
                )}
            </div>
        </div>
    );
};
