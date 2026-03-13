import React from 'react';
import { MessageSquarePlus, Sparkles, ArrowRight } from 'lucide-react';

interface ExplorationCardProps {
    onStartChat: () => void;
    isProcessing?: boolean;
}

export const ExplorationCard: React.FC<ExplorationCardProps> = ({
    onStartChat,
    isProcessing = false
}) => {
    return (
        <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center max-w-4xl mx-auto animate-in fade-in zoom-in-95 duration-500">
            <div className="mb-8 relative">
                <div className="w-24 h-24 bg-gradient-to-br from-primary to-purple-600 rounded-3xl flex items-center justify-center shadow-xl shadow-primary/30 z-10 relative">
                    <MessageSquarePlus size={48} className="text-white" />
                </div>
                <div className="absolute inset-0 bg-primary/20 blur-3xl -z-10 rounded-full scale-150 animate-pulse"></div>
            </div>

            <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4 tracking-tight">
                What would you like to <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-600">build today?</span>
            </h1>

            <p className="text-lg text-slate-500 mb-10 max-w-xl leading-relaxed">
                Start a new project by describing your idea. Our AI agents will help you research, define, and prototype your vision.
            </p>

            <button
                onClick={onStartChat}
                disabled={isProcessing}
                className="group relative px-8 py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-full font-medium text-lg transition-all shadow-lg hover:shadow-xl hover:-translate-y-1 flex items-center gap-3 overflow-hidden"
            >
                <span className="relative z-10 flex items-center gap-2">
                    Start New Chat <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-primary to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            </button>

            <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-3xl">
                {[
                    { icon: <Sparkles size={20} />, label: "Smart Ideation", desc: "Brainstorm with AI" },
                    { icon: <ArrowRight size={20} />, label: "Instant Prototype", desc: "Visualize in seconds" },
                    { icon: <Sparkles size={20} />, label: "Full Roadmap", desc: "Plan from A to Z" },
                ].map((item, i) => (
                    <div key={i} className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-md transition-shadow flex flex-col items-center gap-2 delay-[100ms * i] animate-in slide-in-from-bottom-4 duration-700 fill-mode-backwards" style={{ animationDelay: `${i * 100}ms` }}>
                        <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-primary mb-1">
                            {item.icon}
                        </div>
                        <h3 className="font-bold text-slate-800">{item.label}</h3>
                        <p className="text-xs text-slate-400">{item.desc}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};
