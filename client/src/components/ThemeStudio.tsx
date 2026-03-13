import React from 'react';
import { Palette, X, Loader2, Wand2, Dices } from 'lucide-react';
import { ProjectState } from '@orbitai/shared';

interface ThemeStudioProps {
    isOpen: boolean;
    onClose: () => void;
    themeInput: string;
    setThemeInput: (val: string) => void;
    handleAiThemeGen: (e: React.FormEvent) => void;
    handleRandomTheme: () => void;
    isGeneratingTheme: boolean;
    availableThemes: any[];
    selectedTheme: string | null;
    setSelectedTheme: (id: string) => void;
    dispatch: any;
    state: ProjectState;
}

const ThemeStudio: React.FC<ThemeStudioProps> = ({
    isOpen,
    onClose,
    themeInput,
    setThemeInput,
    handleAiThemeGen,
    handleRandomTheme,
    isGeneratingTheme,
    availableThemes,
    selectedTheme,
    setSelectedTheme,
    dispatch,
    state
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-300 p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-300" onClick={(e) => e.stopPropagation()}>
                <div className="p-6 border-b border-slate-200 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <Palette size={20} className="text-purple-500" /> Theme Studio
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                        <X size={20} className="text-slate-400" />
                    </button>
                </div>
                <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                    <div className="space-y-6">
                        {/* AI Generator */}
                        <div>
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">AI Theme Generator</label>
                            <p className="text-xs text-slate-500 mb-3">Describe any theme concept - seasonal, aesthetic, era-based, or creative!</p>
                            <form onSubmit={handleAiThemeGen} className="flex gap-2">
                                <input
                                    type="text"
                                    value={themeInput}
                                    onChange={(e) => setThemeInput(e.target.value)}
                                    placeholder="Describe any theme: Halloween, Cyberpunk, 1950s Diner, Ocean, Minimalist..."
                                    className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50"
                                    disabled={isGeneratingTheme}
                                />
                                <button
                                    type="submit"
                                    disabled={!themeInput.trim() || isGeneratingTheme}
                                    className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50 shadow-sm flex items-center gap-2"
                                >
                                    {isGeneratingTheme ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                                    Generate
                                </button>
                            </form>
                        </div>

                        {/* Presets */}
                        <div>
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 block">Available Themes</label>
                            <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
                                {availableThemes.map(theme => (
                                    <button
                                        key={theme.id}
                                        onClick={() => {
                                            setSelectedTheme(theme.id);
                                            dispatch({ type: 'SET_THEME', payload: theme.id });
                                        }}
                                        className={`aspect-square rounded-xl border-2 transition-all relative group overflow-hidden ${(state.selectedTheme || selectedTheme) === theme.id ? 'ring-2 ring-primary ring-offset-2 scale-105 shadow-md border-primary' : 'hover:scale-105 opacity-80 hover:opacity-100 hover:shadow-sm border-slate-200'}`}
                                        style={{ backgroundColor: theme.primary }}
                                        title={theme.label}
                                    >
                                        {(state.selectedTheme || selectedTheme) === theme.id && (
                                            <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                                                <div className="w-2 h-2 bg-white rounded-full shadow-sm" />
                                            </div>
                                        )}
                                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] font-bold px-1 py-0.5 truncate">
                                            {theme.label}
                                        </div>
                                    </button>
                                ))}
                                <button
                                    onClick={handleRandomTheme}
                                    disabled={isGeneratingTheme}
                                    className="aspect-square rounded-xl border-2 border-slate-200 bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed relative group"
                                    title={isGeneratingTheme ? "Generating..." : "Generate Random Theme"}
                                >
                                    {isGeneratingTheme ? (
                                        <Loader2 size={20} className="animate-spin text-primary" />
                                    ) : (
                                        <Dices size={20} className="group-hover:rotate-180 transition-transform duration-500" />
                                    )}
                                </button>
                            </div>
                        </div>

                        <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl text-blue-800 text-xs leading-relaxed">
                            <strong>Pro Tip:</strong> Themes are applied instantly to your preview. Changes are saved automatically with your project.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ThemeStudio;
