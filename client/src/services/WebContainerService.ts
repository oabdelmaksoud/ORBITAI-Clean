import { WebContainer } from '@webcontainer/api';

class WebContainerService {
    private static instance: WebContainerService;
    private webContainerInstance: WebContainer | null = null;
    private bootPromise: Promise<WebContainer> | null = null;

    private constructor() {
        // Private constructor for singleton
    }

    public static getInstance(): WebContainerService {
        if (!WebContainerService.instance) {
            WebContainerService.instance = new WebContainerService();
        }
        return WebContainerService.instance;
    }

    /**
     * Boot the WebContainer instance.
     * This downloads the WASM binary and starts the virtual OS.
     * Guaranteed to only run once.
     */
    public async boot(): Promise<WebContainer> {
        if (this.webContainerInstance) {
            return this.webContainerInstance;
        }

        if (this.bootPromise) {
            return this.bootPromise;
        }

        this.bootPromise = (async () => {
            try {
                console.log('[WebContainer] Booting...');
                this.webContainerInstance = await WebContainer.boot();
                console.log('[WebContainer] Booted successfully!');
                return this.webContainerInstance;
            } catch (error) {
                console.error('[WebContainer] Boot failed:', error);
                this.bootPromise = null; // Allow retrying
                throw error;
            }
        })();

        return this.bootPromise;
    }

    public async getInstanceOrThrow(): Promise<WebContainer> {
        if (!this.webContainerInstance) {
            return this.boot();
        }
        return this.webContainerInstance;
    }

    /**
     * Mount files into the container.
     */
    public async mount(fileTree: any): Promise<void> {
        const container = await this.getInstanceOrThrow();
        console.log('[WebContainer] Mounting files...');
        await container.mount(fileTree);
        console.log('[WebContainer] Files mounted.');
    }

    /**
     * Run a command in the container.
     */
    public async run(command: string, args: string[] = [], onOutput?: (data: string) => void): Promise<number> {
        const container = await this.getInstanceOrThrow();
        console.log(`[WebContainer] Running: ${command} ${args.join(' ')}`);

        const process = await container.spawn(command, args);

        if (onOutput) {
            process.output.pipeTo(new WritableStream({
                write(data) {
                    onOutput(data);
                }
            }));
        }

        return process.exit;
    }

    /**
     * Check if the browser supports WebContainers (Cross-Origin Isolation)
     */
    public isSupported(): boolean {
        // Check for COOP/COEP isolation
        return window.crossOriginIsolated;
    }
}

export const webContainerService = WebContainerService.getInstance();
