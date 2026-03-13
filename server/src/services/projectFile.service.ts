/**
 * Service to manage project files on the server.
 * Currently uses in-memory storage, but designed to be replaced with DB/S3.
 */
import path from 'path';
import fs from 'fs';
import os from 'os';

export interface ProjectFile {
    path: string;
    content: string | null;
    deleted?: boolean;
}

class ProjectFileService {
    // In-memory store: projectId -> Map<filePath, content>
    private fileStore: Map<string, Map<string, string>> = new Map();
    private tempDirs: Map<string, string> = new Map();

    /**
     * Save/Update files for a project
     */
    async saveFiles(projectId: string, files: ProjectFile[]): Promise<void> {
        if (!this.fileStore.has(projectId)) {
            this.fileStore.set(projectId, new Map());
        }

        const projectFiles = this.fileStore.get(projectId)!;

        for (const file of files) {
            if (file.deleted) {
                projectFiles.delete(file.path);
            } else if (file.content !== null) {
                projectFiles.set(file.path, file.content);
            }
        }

        console.log(`[ProjectFileService] Processed ${files.length} file updates for ${projectId}. Total files: ${projectFiles.size}`);
    }

    /**
     * Get all files for a project
     */
    getFiles(projectId: string): ProjectFile[] {
        const projectFiles = this.fileStore.get(projectId);
        if (!projectFiles) return [];

        return Array.from(projectFiles.entries()).map(([path, content]) => ({
            path,
            content
        }));
    }

    /**
     * Get a specific file
     */
    getFile(projectId: string, filePath: string): string | null {
        return this.fileStore.get(projectId)?.get(filePath) || null;
    }

    /**
     * Write project files to a temporary directory on disk (for CUA/Playwright)
     * Returns the absolute path to the directory
     */
    async writeToTempDir(projectId: string): Promise<string> {
        const files = this.getFiles(projectId);
        if (files.length === 0) {
            throw new Error(`No files found for project ${projectId}`);
        }

        // Create temp dir if not already tracked
        // We reuse dirs to simulate persistent workspace? No, fresh for test is safer usually.
        // But for speed, let's create unique per request or per session.
        // Let's create a fresh one for now to ensure clean state.

        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `orbit-${projectId}-`));

        for (const file of files) {
            // Remove leading slash if present
            const safePath = file.path.startsWith('/') ? file.path.slice(1) : file.path;
            const fullPath = path.join(tmpDir, safePath);
            const dirName = path.dirname(fullPath);

            if (!fs.existsSync(dirName)) {
                fs.mkdirSync(dirName, { recursive: true });
            }

            fs.writeFileSync(fullPath, file.content);
        }

        return tmpDir;
    }
}

export const projectFileService = new ProjectFileService();
