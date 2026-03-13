/**
 * Scope Selector Component
 * Allows users to view auto-detected project scope and override it manually
 */

import React from 'react';

export type ProjectScope = 'mvp' | 'simple' | 'standard' | 'full';

interface ScopeSelectorProps {
    scope: ProjectScope;
    autoDetected: boolean;
    confidence?: number;
    reasoning?: string;
    onScopeChange: (scope: ProjectScope) => void;
    compact?: boolean;
}

const SCOPE_CONFIG: Record<ProjectScope, {
    label: string;
    emoji: string;
    features: string;
    description: string;
    color: string;
}> = {
    mvp: {
        label: 'MVP',
        emoji: '🚀',
        features: '3-5 features',
        description: 'Minimum viable product - core features only',
        color: 'emerald',
    },
    simple: {
        label: 'Simple',
        emoji: '🎯',
        features: '5-8 features',
        description: 'Personal project or learning - keep it focused',
        color: 'blue',
    },
    standard: {
        label: 'Standard',
        emoji: '⚙️',
        features: '8-15 features',
        description: 'Production-ready app with essential features',
        color: 'violet',
    },
    full: {
        label: 'Full',
        emoji: '🏢',
        features: '15+ features',
        description: 'Enterprise-grade with comprehensive coverage',
        color: 'amber',
    },
};

export const ScopeSelector: React.FC<ScopeSelectorProps> = ({
    scope,
    autoDetected,
    confidence,
    reasoning,
    onScopeChange,
    compact = false,
}) => {
    const [isExpanded, setIsExpanded] = React.useState(false);
    const config = SCOPE_CONFIG[scope];

    if (compact) {
        return (
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-slate-50 to-slate-100 rounded-lg px-3 py-1.5 border border-slate-200">
                <span className="text-sm font-medium text-slate-600">Scope:</span>
                <select
                    value={scope}
                    onChange={(e) => onScopeChange(e.target.value as ProjectScope)}
                    className="bg-white border border-slate-200 rounded-md px-2 py-0.5 text-sm font-medium text-slate-700 cursor-pointer hover:border-blue-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                >
                    {Object.entries(SCOPE_CONFIG).map(([key, cfg]) => (
                        <option key={key} value={key}>
                            {cfg.emoji} {cfg.label} ({cfg.features})
                        </option>
                    ))}
                </select>
                {autoDetected && (
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                        </svg>
                        auto
                    </span>
                )}
            </div>
        );
    }

    return (
        <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Header */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50/50 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg bg-${config.color}-100 flex items-center justify-center text-xl`}>
                        {config.emoji}
                    </div>
                    <div className="text-left">
                        <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-800">{config.label}</span>
                            <span className="text-xs px-2 py-0.5 bg-slate-200 rounded-full text-slate-600">
                                {config.features}
                            </span>
                            {autoDetected && (
                                <span className="text-xs px-2 py-0.5 bg-blue-100 rounded-full text-blue-600 flex items-center gap-1">
                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                                    </svg>
                                    auto-detected
                                    {confidence && <span className="opacity-75">({Math.round(confidence * 100)}%)</span>}
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">{config.description}</p>
                    </div>
                </div>
                <svg
                    className={`w-5 h-5 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {/* Expanded view with all options */}
            {isExpanded && (
                <div className="px-4 pb-4 border-t border-slate-200 pt-3">
                    {reasoning && (
                        <p className="text-xs text-slate-500 mb-3 italic bg-slate-50 p-2 rounded-lg">
                            💡 {reasoning}
                        </p>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                        {Object.entries(SCOPE_CONFIG).map(([key, cfg]) => {
                            const isSelected = key === scope;
                            return (
                                <button
                                    key={key}
                                    onClick={() => onScopeChange(key as ProjectScope)}
                                    className={`
                    p-3 rounded-lg border-2 text-left transition-all
                    ${isSelected
                                            ? `border-${cfg.color}-500 bg-${cfg.color}-50 ring-2 ring-${cfg.color}-200`
                                            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                                        }
                  `}
                                >
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-lg">{cfg.emoji}</span>
                                        <span className={`font-semibold ${isSelected ? `text-${cfg.color}-700` : 'text-slate-700'}`}>
                                            {cfg.label}
                                        </span>
                                    </div>
                                    <span className={`text-xs ${isSelected ? `text-${cfg.color}-600` : 'text-slate-500'}`}>
                                        {cfg.features}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                    <p className="text-xs text-center text-slate-400 mt-3">
                        ⚡ Scope affects how many features AI will suggest
                    </p>
                </div>
            )}
        </div>
    );
};

export default ScopeSelector;
