import React, { useState, useEffect } from 'react';
import { Bot, Zap, X, Users, Rocket, Clock, Sparkles, CheckSquare, ArrowRight } from 'lucide-react';

interface PathChoiceModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectPath: (path: 'agents' | 'quick') => void;
    ideaCount: number;
    maturityScore: number;
}

/**
 * PathChoiceModal - Modal for choosing between AI Agents Path and Direct Quick Path
 * 
 * Appears after feature selection and before Mission Control starts the Blueprint generation.
 * Users can choose:
 * - AI Agents Path: Full multi-agent orchestration (thorough, involves specialized agents)
 * - Direct Quick Path: Fast generation without agent collaboration
 */
const PathChoiceModal: React.FC<PathChoiceModalProps> = ({
    isOpen,
    onClose,
    onSelectPath,
    ideaCount,
    maturityScore
}) => {
    const [selectedPath, setSelectedPath] = useState<'agents' | 'quick' | null>(null);
    const [dontAskAgain, setDontAskAgain] = useState(false);
    const [isAnimating, setIsAnimating] = useState(false);

    // Reset selection when modal opens
    useEffect(() => {
        if (isOpen) {
            setSelectedPath(null);
            setIsAnimating(true);
        }
    }, [isOpen]);

    // Handle path selection with animation
    const handleSelectPath = (path: 'agents' | 'quick') => {
        setSelectedPath(path);

        // Save preference if "Don't ask again" is checked
        if (dontAskAgain) {
            try {
                localStorage.setItem('orbitai_path_preference', path);
            } catch (e) {
                // Ignore localStorage errors
            }
        }

        // Small delay for visual feedback before closing
        setTimeout(() => {
            onSelectPath(path);
        }, 300);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300"
                onClick={onClose}
            />

            {/* Modal */}
            <div
                className={`relative w-full max-w-2xl bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/60 overflow-hidden transform transition-all duration-300 ${isAnimating ? 'animate-in zoom-in-95 fade-in' : ''
                    }`}
            >
                {/* Header */}
                <div className="relative px-6 pt-6 pb-4 border-b border-slate-200/60">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary via-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
                            <Rocket size={20} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-800">Choose Your Path</h2>
                            <p className="text-sm text-slate-500">
                                {ideaCount} ideas • {Math.round(maturityScore)}% maturity
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-700 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    <p className="text-sm text-slate-600 mb-6 text-center">
                        Your project is ready! Choose how you'd like to generate the blueprint.
                    </p>

                    {/* Path Options */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* AI Agents Path */}
                        <button
                            onClick={() => handleSelectPath('agents')}
                            className={`group relative p-5 rounded-xl border-2 text-left transition-all duration-300 ${selectedPath === 'agents'
                                    ? 'border-primary bg-primary/5 shadow-lg shadow-primary/20 scale-[1.02]'
                                    : 'border-slate-200 hover:border-primary/50 hover:bg-slate-50 hover:shadow-md'
                                }`}
                        >
                            {/* Selection indicator */}
                            {selectedPath === 'agents' && (
                                <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-primary flex items-center justify-center animate-in zoom-in">
                                    <CheckSquare size={14} className="text-white" />
                                </div>
                            )}

                            <div className="flex items-start gap-4">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${selectedPath === 'agents'
                                        ? 'bg-primary text-white'
                                        : 'bg-gradient-to-br from-purple-500 to-indigo-600 text-white'
                                    }`}>
                                    <Users size={24} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-bold text-slate-800 mb-1 flex items-center gap-2">
                                        AI Agents Path
                                        <span className="text-[10px] px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full font-semibold uppercase">
                                            Thorough
                                        </span>
                                    </h3>
                                    <p className="text-sm text-slate-600 mb-3">
                                        Specialized AI agents collaborate to analyze and enhance your project.
                                    </p>

                                    {/* Features */}
                                    <div className="space-y-1.5">
                                        <div className="flex items-center gap-2 text-xs text-slate-500">
                                            <Bot size={12} className="text-purple-500" />
                                            <span>Requirements, UX, Architecture agents</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-slate-500">
                                            <Sparkles size={12} className="text-purple-500" />
                                            <span>Deep analysis & recommendations</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-slate-500">
                                            <Clock size={12} className="text-amber-500" />
                                            <span>~2-5 minutes</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Hover arrow */}
                            <ArrowRight
                                size={20}
                                className={`absolute right-4 bottom-4 transition-all ${selectedPath === 'agents'
                                        ? 'text-primary translate-x-1'
                                        : 'text-slate-300 group-hover:text-slate-500 group-hover:translate-x-1'
                                    }`}
                            />
                        </button>

                        {/* Direct Quick Path */}
                        <button
                            onClick={() => handleSelectPath('quick')}
                            className={`group relative p-5 rounded-xl border-2 text-left transition-all duration-300 ${selectedPath === 'quick'
                                    ? 'border-emerald-500 bg-emerald-50 shadow-lg shadow-emerald-500/20 scale-[1.02]'
                                    : 'border-slate-200 hover:border-emerald-400 hover:bg-slate-50 hover:shadow-md'
                                }`}
                        >
                            {/* Selection indicator */}
                            {selectedPath === 'quick' && (
                                <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center animate-in zoom-in">
                                    <CheckSquare size={14} className="text-white" />
                                </div>
                            )}

                            <div className="flex items-start gap-4">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${selectedPath === 'quick'
                                        ? 'bg-emerald-500 text-white'
                                        : 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white'
                                    }`}>
                                    <Zap size={24} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-bold text-slate-800 mb-1 flex items-center gap-2">
                                        Direct Quick Path
                                        <span className="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full font-semibold uppercase">
                                            Fast
                                        </span>
                                    </h3>
                                    <p className="text-sm text-slate-600 mb-3">
                                        Jump straight to blueprint generation with your current ideas.
                                    </p>

                                    {/* Features */}
                                    <div className="space-y-1.5">
                                        <div className="flex items-center gap-2 text-xs text-slate-500">
                                            <Rocket size={12} className="text-emerald-500" />
                                            <span>Immediate generation</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-slate-500">
                                            <Sparkles size={12} className="text-emerald-500" />
                                            <span>Based on your brainstorming</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-slate-500">
                                            <Clock size={12} className="text-emerald-500" />
                                            <span>~30-60 seconds</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Hover arrow */}
                            <ArrowRight
                                size={20}
                                className={`absolute right-4 bottom-4 transition-all ${selectedPath === 'quick'
                                        ? 'text-emerald-500 translate-x-1'
                                        : 'text-slate-300 group-hover:text-slate-500 group-hover:translate-x-1'
                                    }`}
                            />
                        </button>
                    </div>

                    {/* Don't ask again checkbox */}
                    <div className="mt-6 flex items-center justify-center gap-2">
                        <label className="flex items-center gap-2 cursor-pointer group">
                            <input
                                type="checkbox"
                                checked={dontAskAgain}
                                onChange={(e) => setDontAskAgain(e.target.checked)}
                                className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary/50 cursor-pointer"
                            />
                            <span className="text-xs text-slate-500 group-hover:text-slate-700 transition-colors">
                                Remember my choice
                            </span>
                        </label>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 pb-6">
                    <button
                        onClick={onClose}
                        className="w-full px-4 py-2 text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        Cancel - Return to Brainstorming
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PathChoiceModal;
