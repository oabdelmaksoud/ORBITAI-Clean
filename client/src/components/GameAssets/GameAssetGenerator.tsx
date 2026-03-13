/**
 * GameAssetGenerator Component
 * Main UI for AI-powered game asset generation with real-time progress
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Box, Wand2, Image, Download, Filter, Search, X } from 'lucide-react';
import gameAssetClientService from '../../services/gameAssetService';
import { AssetCard } from './AssetCard';
import type { GameAsset, AssetGenerationJob } from '../../../../shared/types';

interface GameAssetGeneratorProps {
    projectId: string;
    onClose?: () => void;
}

const GAME_TYPES = ['2D', '3D'] as const;
const GENRES = ['platformer', 'rpg', 'shooter', 'puzzle', 'racing', 'strategy', 'adventure'];
const THEMES = ['sci-fi', 'fantasy', 'medieval', 'modern', 'cyberpunk', 'post-apocalyptic', 'cartoon'];

export const GameAssetGenerator: React.FC<GameAssetGeneratorProps> = ({
    projectId,
    onClose
}) => {
    // Form state
    const [gameType, setGameType] = useState<'2D' | '3D'>('3D');
    const [genre, setGenre] = useState('platformer');
    const [theme, setTheme] = useState('sci-fi');

    // Generation state
    const [isGenerating, setIsGenerating] = useState(false);
    const [currentJobId, setCurrentJobId] = useState<string | null>(null);
    const [progress, setProgress] = useState(0);
    const [currentAsset, setCurrentAsset] = useState<string>('');
    const [completedCount, setCompletedCount] = useState(0);
    const [totalCount, setTotalCount] = useState(0);

    // Assets state
    const [assets, setAssets] = useState<GameAsset[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filter state
    const [filterType, setFilterType] = useState<'2D' | '3D' | 'all'>('all');
    const [filterCategory, setFilterCategory] = useState<string>('all');
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');

    // Load existing assets
    const loadAssets = useCallback(async () => {
        try {
            setLoading(true);
            const filters: any = {};
            if (filterType !== 'all') filters.type = filterType;
            if (filterCategory !== 'all') filters.category = filterCategory;
            if (filterStatus !== 'all') filters.status = filterStatus;

            const response = await gameAssetClientService.listAssets(projectId, filters);
            setAssets(response.assets);
            setError(null);
        } catch (err: any) {
            setError(err.message || 'Failed to load assets');
        } finally {
            setLoading(false);
        }
    }, [projectId, filterType, filterCategory, filterStatus]);

    useEffect(() => {
        loadAssets();
    }, [loadAssets]);

    // Handle generation
    const handleGenerate = async () => {
        try {
            setIsGenerating(true);
            setProgress(0);
            setError(null);

            const response = await gameAssetClientService.generateAssets({
                projectId,
                gameType,
                genre,
                theme
            });

            setCurrentJobId(response.jobId);
            setTotalCount(0);

            // Connect to WebSocket for real-time updates
            gameAssetClientService.connectToGenerationSession(response.jobId, {
                onStarted: (data) => {
                    console.log('Generation started:', data);
                    setTotalCount(data.totalAssets);
                },
                onProgress: (data) => {
                    console.log('Progress:', data);
                    setProgress(data.progress);
                    setCurrentAsset(data.currentAsset || '');
                    setCompletedCount(data.completedCount);
                    setTotalCount(data.totalCount);
                },
                onAssetComplete: (data) => {
                    console.log('Asset complete:', data);
                    // Refresh assets list
                    loadAssets();
                },
                onComplete: (data) => {
                    console.log('Generation complete:', data);
                    setIsGenerating(false);
                    setProgress(100);
                    setCurrentJobId(null);
                    loadAssets();
                },
                onError: (data) => {
                    console.error('Generation error:', data);
                    setError(data.error || 'Generation failed');
                    setIsGenerating(false);
                    setCurrentJobId(null);
                }
            });

        } catch (err: any) {
            setError(err.message || 'Failed to start generation');
            setIsGenerating(false);
        }
    };

    // Handle asset download
    const handleDownload = async (asset: GameAsset) => {
        try {
            const filename = `${asset.category}_${asset.assetType}_${asset.id}.${asset.format.toLowerCase()}`;
            await gameAssetClientService.downloadAssetFile(asset.id, filename);
        } catch (err: any) {
            setError(err.message || 'Failed to download asset');
        }
    };

    // Handle asset regeneration
    const handleRegenerate = async (asset: GameAsset) => {
        try {
            const response = await gameAssetClientService.regenerateAsset(asset.id);
            setCurrentJobId(response.jobId);

            // Connect to WebSocket
            gameAssetClientService.connectToGenerationSession(response.jobId, {
                onComplete: () => {
                    loadAssets();
                    setCurrentJobId(null);
                },
                onError: (data) => {
                    setError(data.error);
                    setCurrentJobId(null);
                }
            });
        } catch (err: any) {
            setError(err.message || 'Failed to regenerate asset');
        }
    };

    // Handle asset deletion
    const handleDelete = async (asset: GameAsset) => {
        if (!confirm(`Delete "${asset.prompt}"?`)) return;

        try {
            await gameAssetClientService.deleteAsset(asset.id);
            loadAssets();
        } catch (err: any) {
            setError(err.message || 'Failed to delete asset');
        }
    };

    // Bulk download
    const handleBulkDownload = async () => {
        const readyAssets = filteredAssets.filter(a => a.status === 'ready');

        for (const asset of readyAssets) {
            await handleDownload(asset);
            // Small delay to avoid overwhelming browser
            await new Promise(resolve => setTimeout(resolve, 200));
        }
    };

    // Filter assets
    const filteredAssets = assets.filter(asset => {
        if (searchQuery && !asset.prompt.toLowerCase().includes(searchQuery.toLowerCase())) {
            return false;
        }
        return true;
    });

    const readyCount = assets.filter(a => a.status === 'ready').length;
    const generatingCount = assets.filter(a => a.status === 'generating').length;
    const failedCount = assets.filter(a => a.status === 'failed').length;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-2xl max-w-7xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
                                <Wand2 className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                                    AI Game Asset Generator
                                </h2>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Generate high-quality 2D sprites and 3D models with AI
                                </p>
                            </div>
                        </div>
                        {onClose && (
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        )}
                    </div>

                    {/* Generation Form */}
                    {!isGenerating && (
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Game Type
                                </label>
                                <div className="flex gap-2">
                                    {GAME_TYPES.map(type => (
                                        <button
                                            key={type}
                                            onClick={() => setGameType(type)}
                                            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${gameType === type
                                                    ? 'bg-blue-600 text-white shadow-lg'
                                                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                                                }`}
                                        >
                                            {type === '3D' ? <Box className="w-4 h-4 inline mr-1" /> : <Image className="w-4 h-4 inline mr-1" />}
                                            {type}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Genre
                                </label>
                                <select
                                    value={genre}
                                    onChange={(e) => setGenre(e.target.value)}
                                    className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                >
                                    {GENRES.map(g => (
                                        <option key={g} value={g}>{g.charAt(0).toUpperCase() + g.slice(1)}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Theme
                                </label>
                                <select
                                    value={theme}
                                    onChange={(e) => setTheme(e.target.value)}
                                    className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                >
                                    {THEMES.map(t => (
                                        <option key={t} value={t}>{t.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex items-end">
                                <button
                                    onClick={handleGenerate}
                                    className="w-full px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg font-medium transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
                                >
                                    <Wand2 className="w-5 h-5" />
                                    Generate Assets
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Progress Bar */}
                    {isGenerating && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-700 dark:text-gray-300 font-medium">
                                    Generating {currentAsset || 'assets'}...
                                </span>
                                <span className="text-gray-500 dark:text-gray-400">
                                    {completedCount} / {totalCount} complete
                                </span>
                            </div>
                            <div className="relative h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                <div
                                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full transition-all duration-500 ease-out"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                            <div className="text-center text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
                                {progress}%
                            </div>
                        </div>
                    )}

                    {/* Error */}
                    {error && (
                        <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                            <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
                        </div>
                    )}
                </div>

                {/* Stats and Filters */}
                <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        {/* Stats */}
                        <div className="flex items-center gap-4 text-sm">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                <span className="text-gray-700 dark:text-gray-300">{readyCount} Ready</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                                <span className="text-gray-700 dark:text-gray-300">{generatingCount} Generating</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                                <span className="text-gray-700 dark:text-gray-300">{failedCount} Failed</span>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleBulkDownload}
                                disabled={readyCount === 0}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                            >
                                <Download className="w-4 h-4" />
                                Download All ({readyCount})
                            </button>
                        </div>
                    </div>

                    {/* Search and Filters */}
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search assets..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>

                        <select
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value as any)}
                            className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                            <option value="all">All Types</option>
                            <option value="2D">2D Only</option>
                            <option value="3D">3D Only</option>
                        </select>

                        <select
                            value={filterCategory}
                            onChange={(e) => setFilterCategory(e.target.value)}
                            className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                            <option value="all">All Categories</option>
                            <option value="character">Character</option>
                            <option value="prop">Prop</option>
                            <option value="environment">Environment</option>
                            <option value="ui">UI</option>
                        </select>

                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                            <option value="all">All Status</option>
                            <option value="ready">Ready</option>
                            <option value="generating">Generating</option>
                            <option value="failed">Failed</option>
                        </select>
                    </div>
                </div>

                {/* Asset Grid */}
                <div className="flex-1 overflow-auto p-6">
                    {loading ? (
                        <div className="flex items-center justify-center h-64">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                        </div>
                    ) : filteredAssets.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-gray-500 dark:text-gray-400">
                            <Wand2 className="w-16 h-16 mb-4 opacity-50" />
                            <p className="text-lg font-medium">No assets yet</p>
                            <p className="text-sm">Generate your first asset pack to get started</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {filteredAssets.map(asset => (
                                <AssetCard
                                    key={asset.id}
                                    asset={asset}
                                    onDownload={handleDownload}
                                    onRegenerate={handleRegenerate}
                                    onDelete={handleDelete}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default GameAssetGenerator;
