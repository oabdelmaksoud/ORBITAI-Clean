import JSZip from 'jszip';

/**
 * Download a single file to the user's device
 */
export function downloadFile(filename: string, content: string): void {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * Download all game mechanics files as a ZIP archive
 */
export async function downloadAllAsZip(
    files: Array<{ filename: string; content: string }>,
    projectName: string = 'project'
): Promise<void> {
    const zip = new JSZip();

    // Add all files to the ZIP
    files.forEach(file => {
        zip.file(file.filename, file.content);
    });

    // Generate the ZIP file
    const blob = await zip.generateAsync({ type: 'blob' });

    // Trigger download
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${projectName}-game-mechanics.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * Get Tailwind color classes for engine badge
 */
export function getEngineColor(engine: 'unity' | 'godot' | 'phaser'): {
    gradient: string;
    text: string;
    border: string;
} {
    switch (engine.toLowerCase()) {
        case 'unity':
            return {
                gradient: 'from-emerald-50 to-green-50',
                text: 'text-emerald-700',
                border: 'border-emerald-200',
            };
        case 'godot':
            return {
                gradient: 'from-blue-50 to-indigo-50',
                text: 'text-blue-700',
                border: 'border-blue-200',
            };
        case 'phaser':
            return {
                gradient: 'from-purple-50 to-pink-50',
                text: 'text-purple-700',
                border: 'border-purple-200',
            };
        default:
            return {
                gradient: 'from-slate-50 to-gray-50',
                text: 'text-slate-700',
                border: 'border-slate-200',
            };
    }
}

/**
 * Map file extensions to Prism.js language identifiers
 */
export function getLanguageForFile(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();

    switch (ext) {
        case 'cs':
            return 'csharp';
        case 'gd':
            return 'gdscript';
        case 'js':
            return 'javascript';
        case 'ts':
            return 'typescript';
        case 'json':
            return 'json';
        case 'xml':
            return 'xml';
        case 'html':
            return 'html';
        case 'css':
            return 'css';
        case 'py':
            return 'python';
        case 'java':
            return 'java';
        case 'cpp':
        case 'cc':
        case 'cxx':
            return 'cpp';
        case 'shader':
        case 'glsl':
            return 'glsl';
        default:
            return 'javascript'; // fallback
    }
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (error) {
        console.error('Failed to copy to clipboard:', error);
        return false;
    }
}
