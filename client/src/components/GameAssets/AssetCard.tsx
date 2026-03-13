/**
 * AssetCard Component
 * Displays individual game asset with metadata, actions, and status
 */

import React from 'react';
import type { GameAsset } from '../../../../shared/types';
import { Download, RefreshCw, Trash2, Image, Box } from 'lucide-react';

interface AssetCardProps {
    asset: GameAsset;
    onDownload: (asset: GameAsset) => void;
    onRegenerate: (asset: GameAsset) => void;
    onDelete: (asset: GameAsset) => void;
    onPreview?: (asset: GameAsset) => void;
}

export const AssetCard: React.FC<AssetCardProps> = ({
    asset,
    onDownload,
    onRegenerate,
    onDelete,
    onPreview
}) => {
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'ready':
                return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
            case 'generating':
                return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
            case 'failed':
                return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
            default:
                return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
        }
    };

    const getCategoryIcon = () => {
        return asset.assetType === '3D' ? (
            <Box className="w-4 h-4" />
        ) : (
            <Image className="w-4 h-4" />
        );
    };

    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const getMetadataText = (): string => {
        if (asset.assetType === '3D' && 'polyCount' in asset.metadata) {
            return `${asset.metadata.polyCount?.toLocaleString() || 'N/A'} polys`;
        } else if (asset.assetType === '2D' && 'width' in asset.metadata) {
            return `${asset.metadata.width}x${asset.metadata.height}`;
        }
        return '';
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow">
            {/* Thumbnail */}
            <div
                className="relative h-48 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 cursor-pointer group"
                onClick={() => onPreview?.(asset)}
            >
                {asset.thumbnailUrl ? (
                    <img
                        src={asset.thumbnailUrl}
                        alt={asset.prompt}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        {asset.assetType === '3D' ? (
                            <Box className="w-16 h-16 text-gray-400" />
                        ) : (
                            <Image className="w-16 h-16 text-gray-400" />
                        )}
                    </div>
                )}

                {/* Status Badge */}
                <div className="absolute top-2 right-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(asset.status)}`}>
                        {asset.status}
                    </span>
                </div>

                {/* Type Badge */}
                <div className="absolute top-2 left-2 bg-black/50 backdrop-blur-sm px-2 py-1 rounded-md flex items-center gap-1 text-white text-xs">
                    {getCategoryIcon()}
                    <span>{asset.assetType}</span>
                </div>

                {/* Hover Overlay */}
                {onPreview && asset.status === 'ready' && (
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                        <span className="text-white opacity-0 group-hover:opacity-100 transition-opacity font-medium">
                            Click to Preview
                        </span>
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="p-4">
                <div className="mb-3">
                    <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className="font-medium text-gray-900 dark:text-gray-100 text-sm line-clamp-2 flex-1">
                            {asset.prompt}
                        </h3>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                        <span className="capitalize">{asset.category}</span>
                        <span>•</span>
                        <span>{asset.format}</span>
                        {getMetadataText() && (
                            <>
                                <span>•</span>
                                <span>{getMetadataText()}</span>
                            </>
                        )}
                    </div>

                    <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        {formatFileSize(asset.metadata.fileSize)}
                        {asset.provider && (
                            <>
                                <span className="mx-1">•</span>
                                <span className="capitalize">{asset.provider}</span>
                            </>
                        )}
                    </div>
                </div>

                {/* Actions */}
                {asset.status === 'ready' && (
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => onDownload(asset)}
                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors"
                        >
                            <Download className="w-4 h-4" />
                            Download
                        </button>

                        <button
                            onClick={() => onRegenerate(asset)}
                            className="px-3 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-md transition-colors"
                            title="Regenerate"
                        >
                            <RefreshCw className="w-4 h-4" />
                        </button>

                        <button
                            onClick={() => onDelete(asset)}
                            className="px-3 py-2 bg-gray-100 hover:bg-red-100 dark:bg-gray-700 dark:hover:bg-red-900/30 text-gray-700 hover:text-red-600 dark:text-gray-300 dark:hover:text-red-400 rounded-md transition-colors"
                            title="Delete"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                )}

                {asset.status === 'generating' && (
                    <div className="flex items-center justify-center py-2">
                        <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 dark:border-blue-400"></div>
                            Generating...
                        </div>
                    </div>
                )}

                {asset.status === 'failed' && (
                    <button
                        onClick={() => onRegenerate(asset)}
                        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-700 dark:text-red-400 rounded-md text-sm font-medium transition-colors"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Retry Generation
                    </button>
                )}
            </div>
        </div>
    );
};

export default AssetCard;
