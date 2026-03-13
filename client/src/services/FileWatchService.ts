import { WebContainer } from '@webcontainer/api';
import { apiRequest } from './api';

/**
 * Service to watch for file changes in the WebContainer and sync them back to the server.
 * Implements a debounce mechanism to avoid flooding the API.
 */
class FileWatchService {
    private container: WebContainer | null = null;
    private watchers: Function[] = []; // Unsubscribe functions
    private pendingChanges: Map<string, { content: string | null; deleted: boolean }> = new Map(); // path -> { content, deleted }
    private debounceTimer: NodeJS.Timeout | null = null;
    private isSyncing = false;
    private projectId: string | null = null;

    /**
     * Initialize watchers on the container
     */
    async attach(container: WebContainer, projectId: string) {
        if (this.container === container && this.projectId === projectId) return;

        // Cleanup old watchers
        this.detach();

        this.container = container;
        this.projectId = projectId;

        console.log(`[FileWatchService] 👁️ Watching for changes in project: ${projectId}`);

        // Watch root directory recursively
        // Note: WebContainer's fs.watch is standard Node.js style
        try {
            const watcher = container.fs.watch('/', { recursive: true }, (eventType, filename) => {
                if (filename && !this.isIgnored(filename)) {
                    this.handleFileChange(filename);
                }
            });

            // Store close function
            this.watchers.push(() => watcher.close());

        } catch (err) {
            console.warn('[FileWatchService] Failed to attach watcher:', err);
        }
    }

    /**
     * Stop watching
     */
    detach() {
        this.watchers.forEach(unsub => unsub());
        this.watchers = [];
        this.container = null;
        this.projectId = null;
        this.pendingChanges.clear();
    }

    /**
     * Ignore node_modules, .git, dist, etc.
     */
    private isIgnored(filename: string): boolean {
        return filename.includes('node_modules') ||
            filename.includes('.git') ||
            filename.includes('dist') ||
            filename.includes('.cache');
    }

    /**
     * Handle a file change event
     */
    private async handleFileChange(filename: string) {
        if (!this.container) return;

        // Read the new content
        try {
            // Check if it's a directory (naive check, fs.stat is better but overhead)
            // For now, we just try to read. If it fails, it might be a deletion or directory.
            const content = await this.container.fs.readFile(filename, 'utf-8');

            // Add to pending changes
            this.pendingChanges.set(filename, { content, deleted: false });

            // Debounce sync
            this.scheduleSync();

        } catch (err) {
            // If read fails, it might be deleted OR it might be a directory.
            try {
                // Try to read as directory to check existence
                await this.container.fs.readdir(filename);
                // If this succeeds, it is a directory. We ignore directories.
            } catch (e) {
                // If readdir also fails, we assume it is deleted.
                this.pendingChanges.set(filename, { content: null, deleted: true });
                this.scheduleSync();
            }
        }
    }

    /**
     * Schedule the API sync call
     */
    private scheduleSync() {
        if (this.debounceTimer) clearTimeout(this.debounceTimer);

        this.debounceTimer = setTimeout(() => {
            this.syncPendingChanges();
        }, 2000); // 2 second debounce
    }

    /**
     * Send pending changes to the backend
     */
    private async syncPendingChanges() {
        if (this.pendingChanges.size === 0 || !this.projectId || this.isSyncing) return;

        this.isSyncing = true;
        const changes = Array.from(this.pendingChanges.entries()).map(([path, data]) => ({
            path,
            content: data.content,
            deleted: data.deleted
        }));

        // Clear pending immediately (optimistic). 
        // If fail, we arguably should restore them, but for strict debounce logic we clear.
        this.pendingChanges.clear();

        console.log(`[FileWatchService] 🔄 Syncing ${changes.length} files to cloud...`);

        try {
            await apiRequest('/api/sync/files', {
                method: 'POST',
                body: JSON.stringify({
                    projectId: this.projectId,
                    files: changes
                })
            });
            console.log(`[FileWatchService] ✅ Sync complete`);
        } catch (err) {
            console.error(`[FileWatchService] ❌ Sync failed:`, err);
            // TODO: Re-queue failed changes?
        } finally {
            this.isSyncing = false;
        }
    }
}

export const fileWatchService = new FileWatchService();
