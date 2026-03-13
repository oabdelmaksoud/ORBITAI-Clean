import React, { useState } from 'react';
import { Smartphone, Globe, Monitor, Projector, ArrowRight, CheckCircle2, Rocket } from 'lucide-react';

interface SuggestionCardProps {
    suggestions: Array<{
        id: string;
        type: 'mobile-app' | 'web-app' | 'website' | 'presentation' | 'other';
        title: string;
        description: string;
        confidence: number;
    }>;
    onSelectProject: (projectId: string) => void;
    onBack: () => void;
}

const PROJECT_ICONS = {
    'mobile-app': <Smartphone size={24} />,
    'web-app': <Monitor size={24} />,
    'website': <Globe size={24} />,
    'presentation': <Projector size={24} />,
    'other': <Monitor size={24} />
};

export const SuggestionCard: React.FC<SuggestionCardProps> = ({
    suggestions,
    onSelectProject,
    onBack
}) => {
    const [selectedId, setSelectedId] = useState<string | null>(null);

    // Fallback if no suggestions
    const displaySuggestions = suggestions.length > 0 ? suggestions : [
        { id: '1', type: 'web-app', title: 'Web Application', description: 'A scalable web platform with React and Node.js', confidence: 0.9 },
        { id: '2', type: 'mobile-app', title: 'Mobile App', description: 'Native experience for iOS and Android', confidence: 0.85 },
        { id: '3', type: 'website', title: 'Landing Page', description: 'High-conversion marketing site', confidence: 0.8 }
    ];

    return (
        <div className="w-full h-full flex flex-col p-8 max-w-5xl mx-auto animate-in slide-in-from-right-8 duration-500">
            <div className="mb-8">
                <button onClick={onBack} className="text-slate-400 hover:text-slate-600 text-sm font-medium mb-4 flex items-center gap-1">
                    ← Back to Definition
                </button>
                <h2 className="text-3xl font-bold text-slate-800">AI-Powered Development</h2>
                <p className="text-slate-500 mt-2">Choose your preferred development path. OrbitAI will architect and prototype it for you.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {displaySuggestions.map((suggestion, i) => (
                    <div
                        key={suggestion.id}
                        className="relative p-6 rounded-2xl border border-slate-200 bg-white hover:border-primary/50 hover:shadow-lg transition-all duration-300 flex flex-col gap-4 animate-in zoom-in-95 fill-mode-backwards group"
                        style={{ animationDelay: `${i * 100}ms` }}
                    >
                        <div className="flex items-start justify-between">
                            <div className="w-12 h-12 rounded-xl bg-slate-50 text-slate-600 group-hover:bg-primary/10 group-hover:text-primary flex items-center justify-center transition-colors">
                                {PROJECT_ICONS[suggestion.type as keyof typeof PROJECT_ICONS] || <Monitor size={24} />}
                            </div>
                            <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                                {Math.round(suggestion.confidence * 100)}% Match
                            </span>
                        </div>

                        <div>
                            <h3 className="font-bold text-lg text-slate-900 mb-1">{suggestion.title}</h3>
                            <p className="text-sm text-slate-500 leading-relaxed mb-4 min-h-[40px]">
                                {suggestion.description}
                            </p>

                            <button
                                onClick={() => onSelectProject(suggestion.id)}
                                className="w-full py-2.5 bg-slate-900 text-white rounded-lg font-medium text-sm flex items-center justify-center gap-2 hover:bg-primary transition-colors group-hover:shadow-md"
                            >
                                <Rocket size={16} /> Start AI-Powered Build
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
