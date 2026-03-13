import React from 'react';
import { Rocket, CheckCircle2 } from 'lucide-react';

interface LaunchCardProps {
    onLaunch: () => void;
    projectName: string;
}

export const LaunchCard: React.FC<LaunchCardProps> = ({ onLaunch, projectName }) => {
    return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-white p-8 text-center relative overflow-hidden animate-in fade-in duration-700">
            {/* Background Effects */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/20 blur-[120px] rounded-full animate-pulse"></div>
            </div>

            <div className="z-10 flex flex-col items-center max-w-2xl">
                <div className="w-24 h-24 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center shadow-lg shadow-green-500/30 mb-8 animate-in zoom-in duration-500">
                    <CheckCircle2 size={48} className="text-white" />
                </div>

                <h1 className="text-5xl font-bold mb-6 tracking-tight animate-in slide-in-from-bottom-4 duration-500 delay-100 fill-mode-backwards">Project Ready!</h1>

                <div className="p-6 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 mb-10 w-full animate-in slide-in-from-bottom-4 duration-500 delay-200 fill-mode-backwards">
                    <p className="text-white/60 text-sm uppercase tracking-widest font-bold mb-2">PROJECT NAME</p>
                    <h2 className="text-3xl font-bold text-white">{projectName}</h2>
                </div>

                <p className="text-lg text-white/70 mb-10 max-w-lg animate-in slide-in-from-bottom-4 duration-500 delay-300 fill-mode-backwards">
                    Your project environment has been configured. The workspace is ready for development.
                </p>

                <button
                    onClick={onLaunch}
                    className="group relative px-10 py-5 bg-white text-slate-900 rounded-full font-bold text-xl shadow-2xl hover:shadow-[0_0_40px_rgba(255,255,255,0.3)] transition-all hover:-translate-y-1 overflow-hidden animate-in zoom-in duration-500 delay-400 fill-mode-backwards"
                >
                    <span className="relative z-10 flex items-center gap-3">
                        Launch Workspace <Rocket className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                    </span>
                </button>
            </div>
        </div>
    );
};
