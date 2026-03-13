/**
 * Game Asset Service (Client)
 * API wrapper and WebSocket manager for game asset generation
 */

import { io, Socket } from 'socket.io-client';
import type {
    GameAsset,
    AssetGenerationJob,
    GenerateAssetsRequest
} from '../../../shared/types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3002';

interface AssetFilters {
    type?: '2D' | '3D';
    category?: 'character' | 'prop' | 'environment' | 'ui';
    status?: 'generating' | 'ready' | 'failed';
}

interface GenerationCallbacks {
    onStarted?: (data: any) => void;
    onProgress?: (data: any) => void;
    onAssetComplete?: (data: any) => void;
    onComplete?: (data: any) => void;
    onError?: (data: any) => void;
}

class GameAssetClientService {
    private socket: Socket | null = null;
    private activeJobId: string | null = null;

    /**
     * Get auth token from localStorage
     */
    private getAuthToken(): string | null {
        return localStorage.getItem('token');
    }

    /**
     * Get auth headers for API requests
     */
    private getHeaders(): HeadersInit {
        const token = this.getAuthToken();
        return {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` })
        };
    }

    /**
     * Start asset generation for a project
     */
    async generateAssets(request: GenerateAssetsRequest): Promise<{ jobId: string; status: string }> {
        const response = await fetch(`${API_BASE}/api/game-assets/generate`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(request)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to start asset generation');
        }

        return response.json();
    }

    /**
     * Get job status and progress
     */
    async getJobStatus(jobId: string): Promise<AssetGenerationJob> {
        const response = await fetch(`${API_BASE}/api/game-assets/status/${jobId}`, {
            headers: this.getHeaders()
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to get job status');
        }

        return response.json();
    }

    /**
     * Get single asset metadata
     */
    async getAsset(assetId: string): Promise<GameAsset> {
        const response = await fetch(`${API_BASE}/api/game-assets/${assetId}`, {
            headers: this.getHeaders()
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to get asset');
        }

        return response.json();
    }

    /**
     * List all assets for a project
     */
    async listAssets(projectId: string, filters?: AssetFilters): Promise<{ assets: GameAsset[]; total: number }> {
        const params = new URLSearchParams();
        if (filters?.type) params.append('type', filters.type);
        if (filters?.category) params.append('category', filters.category);
        if (filters?.status) params.append('status', filters.status);

        const url = `${API_BASE}/api/game-assets/list/${projectId}${params.toString() ? `?${params}` : ''}`;
        const response = await fetch(url, {
            headers: this.getHeaders()
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to list assets');
        }

        return response.json();
    }

    /**
     * Download asset file
     */
    async downloadAsset(assetId: string): Promise<Blob> {
        const response = await fetch(`${API_BASE}/api/game-assets/download/${assetId}`, {
            headers: { 'Authorization': `Bearer ${this.getAuthToken()}` }
        });

        if (!response.ok) {
            throw new Error('Failed to download asset');
        }

        return response.blob();
    }

    /**
     * Download asset and trigger browser download
     */
    async downloadAssetFile(assetId: string, filename: string): Promise<void> {
        const blob = await this.downloadAsset(assetId);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    }

    /**
     * Delete an asset
     */
    async deleteAsset(assetId: string): Promise<void> {
        const response = await fetch(`${API_BASE}/api/game-assets/${assetId}`, {
            method: 'DELETE',
            headers: this.getHeaders()
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to delete asset');
        }
    }

    /**
     * Regenerate an asset with optional new prompt
     */
    async regenerateAsset(assetId: string, newPrompt?: string): Promise<{ jobId: string }> {
        const response = await fetch(`${API_BASE}/api/game-assets/${assetId}/regenerate`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({ newPrompt })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to regenerate asset');
        }

        return response.json();
    }

    /**
     * Connect to WebSocket for real-time updates
     */
    connectToGenerationSession(jobId: string, callbacks: GenerationCallbacks): void {
        // Disconnect existing connection if any
        this.disconnectFromGenerationSession();

        this.activeJobId = jobId;
        this.socket = io(API_BASE, {
            auth: {
                token: this.getAuthToken()
            },
            transports: ['websocket', 'polling']
        });

        // Join the asset generation room
        this.socket.emit('join-asset-generation-session', { jobId });

        // Listen for events
        this.socket.on('gameAssets:generation:started', (data) => {
            console.log('[GameAssets] Generation started:', data);
            callbacks.onStarted?.(data);
        });

        this.socket.on('gameAssets:generation:progress', (data) => {
            console.log('[GameAssets] Progress update:', data);
            callbacks.onProgress?.(data);
        });

        this.socket.on('gameAssets:generation:assetComplete', (data) => {
            console.log('[GameAssets] Asset complete:', data);
            callbacks.onAssetComplete?.(data);
        });

        this.socket.on('gameAssets:generation:complete', (data) => {
            console.log('[GameAssets] Generation complete:', data);
            callbacks.onComplete?.(data);
            this.disconnectFromGenerationSession();
        });

        this.socket.on('gameAssets:generation:error', (data) => {
            console.error('[GameAssets] Generation error:', data);
            callbacks.onError?.(data);
        });

        this.socket.on('connect', () => {
            console.log('[GameAssets] WebSocket connected');
        });

        this.socket.on('disconnect', () => {
            console.log('[GameAssets] WebSocket disconnected');
        });
    }

    /**
     * Disconnect from WebSocket
     */
    disconnectFromGenerationSession(): void {
        if (this.socket && this.activeJobId) {
            this.socket.emit('leave-asset-generation-session', { jobId: this.activeJobId });
            this.socket.disconnect();
            this.socket = null;
            this.activeJobId = null;
        }
    }

    /**
     * Check if currently connected to a generation session
     */
    isConnected(): boolean {
        return this.socket?.connected || false;
    }
}

export const gameAssetClientService = new GameAssetClientService();
export default gameAssetClientService;
