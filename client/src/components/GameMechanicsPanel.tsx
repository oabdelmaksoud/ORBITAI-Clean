import React, { useState } from 'react';
import {
    Download,
    Copy,
    Check,
    ChevronDown,
    ChevronRight,
    Zap,
    Swords,
    Brain,
    TrendingUp,
    Package,
    Target,
    FileCode
} from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import {
    downloadFile,
    downloadAllAsZip,
    getEngineColor,
    getLanguageForFile,
    copyToClipboard
} from '../utils/gameMechanicsUtils';

interface GameMechanicsPanelProps {
    gameMechanics: {
        mechanicsId: string;
        engine: 'unity' | 'godot' | 'phaser';
        files: Array<{
            filename: string;
            content: string;
            language: string;
        }>;
        setupInstructions: string;
        mechanics: {
            movement?: boolean;
            combat?: boolean;
            ai?: boolean;
            progression?: {
                xp?: boolean;
                inventory?: boolean;
                quests?: boolean;
            };
        };
    };
}

const GameMechanicsPanel: React.FC<GameMechanicsPanelProps> = ({ gameMechanics }) => {
    const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
    const [copiedFiles, setCopiedFiles] = useState<Set<string>>(new Set());
    const [isDownloading, setIsDownloading] = useState(false);

    const engineColors = getEngineColor(gameMechanics.engine);

    const toggleFileExpansion = (filename: string) => {
        setExpandedFiles(prev => {
            const next = new Set(prev);
            if (next.has(filename)) {
                next.delete(filename);
            } else {
                next.add(filename);
            }
            return next;
        });
    };

    const handleCopyFile = async (filename: string, content: string) => {
        const success = await copyToClipboard(content);
        if (success) {
            setCopiedFiles(prev => new Set(prev).add(filename));
            setTimeout(() => {
                setCopiedFiles(prev => {
                    const next = new Set(prev);
                    next.delete(filename);
                    return next;
                });
            }, 2000);
        }
    };

    const handleDownloadAll = async () => {
        setIsDownloading(true);
        try {
            await downloadAllAsZip(gameMechanics.files, `${gameMechanics.engine}-mechanics`);
        } catch (error) {
            console.error('Failed to download ZIP:', error);
        } finally {
            setIsDownloading(false);
        }
    };

    // Get mechanics that are included
    const includedMechanics = [];
    if (gameMechanics.mechanics.movement) includedMechanics.push({ label: 'Movement', icon: Zap, color: 'text-yellow-600' });
    if (gameMechanics.mechanics.combat) includedMechanics.push({ label: 'Combat', icon: Swords, color: 'text-red-600' });
    if (gameMechanics.mechanics.ai) includedMechanics.push({ label: 'AI', icon: Brain, color: 'text-purple-600' });
    if (gameMechanics.mechanics.progression?.xp) includedMechanics.push({ label: 'XP System', icon: TrendingUp, color: 'text-green-600' });
    if (gameMechanics.mechanics.progression?.inventory) includedMechanics.push({ label: 'Inventory', icon: Package, color: 'text-blue-600' });
    if (gameMechanics.mechanics.progression?.quests) includedMechanics.push({ label: 'Quests', icon: Target, color: 'text-indigo-600' });

    return (
        <div className="space-y-4">
            {/* Header Section */}
            <div className={`bg-gradient-to-r ${engineColors.gradient} rounded-lg p-4 border ${engineColors.border} shadow-sm`}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`px-3 py-1.5 bg-white/80 ${engineColors.text} rounded-lg font-bold text-sm uppercase tracking-wider shadow-sm`}>
                            {gameMechanics.engine}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-600">
                            <FileCode size={14} />
                            <span>{gameMechanics.files.length} file{gameMechanics.files.length !== 1 ? 's' : ''}</span>
                        </div>
                    </div>
                    <button
                        onClick={handleDownloadAll}
                        disabled={isDownloading}
                        className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold border border-slate-200 shadow-sm transition-all hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Download size={14} />
                        {isDownloading ? 'Preparing...' : 'Download All (ZIP)'}
                    </button>
                </div>
            </div>

            {/* Mechanics Overview */}
            {includedMechanics.length > 0 && (
                <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider">Included Mechanics</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {includedMechanics.map((mechanic) => {
                            const Icon = mechanic.icon;
                            return (
                                <div
                                    key={mechanic.label}
                                    className="flex items-center gap-2 bg-white/60 backdrop-blur-sm px-3 py-2 rounded-lg border border-slate-200 shadow-sm"
                                >
                                    <Icon size={16} className={mechanic.color} />
                                    <span className="text-xs font-medium text-slate-700">{mechanic.label}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Files List */}
            <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider">Generated Files</h4>
                <div className="space-y-2">
                    {gameMechanics.files.map((file) => {
                        const isExpanded = expandedFiles.has(file.filename);
                        const isCopied = copiedFiles.has(file.filename);
                        const language = getLanguageForFile(file.filename);

                        return (
                            <div
                                key={file.filename}
                                className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden transition-all"
                            >
                                {/* File Header */}
                                <div className="flex items-center justify-between p-3 bg-slate-50/50 border-b border-slate-200">
                                    <button
                                        onClick={() => toggleFileExpansion(file.filename)}
                                        className="flex items-center gap-2 flex-1 text-left hover:text-indigo-600 transition-colors"
                                    >
                                        {isExpanded ? (
                                            <ChevronDown size={16} className="text-slate-400" />
                                        ) : (
                                            <ChevronRight size={16} className="text-slate-400" />
                                        )}
                                        <FileCode size={14} className="text-slate-500" />
                                        <span className="text-sm font-mono font-semibold text-slate-700">{file.filename}</span>
                                    </button>
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => handleCopyFile(file.filename, file.content)}
                                            className="p-1.5 hover:bg-slate-100 rounded transition-colors"
                                            title="Copy to clipboard"
                                        >
                                            {isCopied ? (
                                                <Check size={14} className="text-green-600" />
                                            ) : (
                                                <Copy size={14} className="text-slate-500" />
                                            )}
                                        </button>
                                        <button
                                            onClick={() => downloadFile(file.filename, file.content)}
                                            className="p-1.5 hover:bg-slate-100 rounded transition-colors"
                                            title="Download file"
                                        >
                                            <Download size={14} className="text-slate-500" />
                                        </button>
                                    </div>
                                </div>

                                {/* File Content - Expandable */}
                                {isExpanded && (
                                    <div className="max-h-96 overflow-auto">
                                        <SyntaxHighlighter
                                            language={language}
                                            style={vscDarkPlus}
                                            customStyle={{
                                                margin: 0,
                                                borderRadius: 0,
                                                fontSize: '11px',
                                                lineHeight: '1.5',
                                            }}
                                            showLineNumbers
                                        >
                                            {file.content}
                                        </SyntaxHighlighter>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Setup Instructions */}
            {gameMechanics.setupInstructions && (
                <div className="bg-amber-50/50 border border-amber-200 rounded-lg p-4">
                    <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-2 flex items-center gap-2">
                        <Target size={14} />
                        Setup Instructions
                    </h4>
                    <div className="prose prose-sm max-w-none text-slate-700 text-xs leading-relaxed">
                        <pre className="whitespace-pre-wrap font-sans text-xs">{gameMechanics.setupInstructions}</pre>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GameMechanicsPanel;
