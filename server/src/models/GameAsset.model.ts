/**
 * Game Asset Model
 * Represents AI-generated game assets (2D sprites, 3D models, etc.)
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface IGameAsset extends Document {
    projectId: string;
    userId: string;
    assetType: '2D' | '3D';
    category: 'character' | 'prop' | 'environment' | 'ui';
    prompt: string;
    fileUrl: string;
    thumbnailUrl?: string;
    format: 'GLB' | 'PNG' | 'FBX' | 'GLTF' | 'JPG' | 'SVG';
    status: 'generating' | 'ready' | 'failed';
    metadata: {
        // 3D Metadata
        polyCount?: number;
        vertexCount?: number;
        triangleCount?: number;
        textures?: string[];
        animations?: string[];
        dimensions?: {
            width: number;
            height: number;
            depth: number;
        };
        // 2D Metadata
        width?: number;
        height?: number;
        hasTransparency?: boolean;
        colorDepth?: number;
        // Common
        fileSize: number;
    };
    generationJobId?: string;
    provider?: 'tripo' | 'flux' | 'sloyd' | 'dalle' | 'other';
    errorMessage?: string;
    retryCount?: number;
    createdAt: Date;
    updatedAt: Date;
}

const gameAssetSchema = new Schema<IGameAsset>(
    {
        projectId: {
            type: String,
            required: true,
            index: true
        },
        userId: {
            type: String,
            required: true,
            index: true
        },
        assetType: {
            type: String,
            enum: ['2D', '3D'],
            required: true
        },
        category: {
            type: String,
            enum: ['character', 'prop', 'environment', 'ui'],
            required: true
        },
        prompt: {
            type: String,
            required: true
        },
        fileUrl: {
            type: String,
            required: true
        },
        thumbnailUrl: {
            type: String
        },
        format: {
            type: String,
            enum: ['GLB', 'PNG', 'FBX', 'GLTF', 'JPG', 'SVG'],
            required: true
        },
        status: {
            type: String,
            enum: ['generating', 'ready', 'failed'],
            default: 'generating'
        },
        metadata: {
            // 3D Metadata
            polyCount: { type: Number },
            vertexCount: { type: Number },
            triangleCount: { type: Number },
            textures: [{ type: String }],
            animations: [{ type: String }],
            dimensions: {
                width: { type: Number },
                height: { type: Number },
                depth: { type: Number }
            },
            // 2D Metadata
            width: { type: Number },
            height: { type: Number },
            hasTransparency: { type: Boolean },
            colorDepth: { type: Number },
            // Common
            fileSize: { type: Number, required: true }
        },
        generationJobId: {
            type: String,
            index: true
        },
        provider: {
            type: String,
            enum: ['tripo', 'flux', 'sloyd', 'dalle', 'other']
        },
        errorMessage: {
            type: String
        },
        retryCount: {
            type: Number,
            default: 0
        }
    },
    {
        timestamps: true
    }
);

// Indexes for efficient queries
gameAssetSchema.index({ projectId: 1, assetType: 1 });
gameAssetSchema.index({ projectId: 1, category: 1 });
gameAssetSchema.index({ userId: 1, createdAt: -1 });
gameAssetSchema.index({ status: 1 });
gameAssetSchema.index({ generationJobId: 1 });

export const GameAsset = mongoose.model<IGameAsset>('GameAsset', gameAssetSchema);
