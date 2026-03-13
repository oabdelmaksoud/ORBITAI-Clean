import React, { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebContainer } from '@webcontainer/api';
import 'xterm/css/xterm.css';

interface WebTerminalProps {
    webContainerInstance: WebContainer | null;
}

const WebTerminal: React.FC<WebTerminalProps> = ({ webContainerInstance }) => {
    const terminalRef = useRef<HTMLDivElement>(null);
    const xtermRef = useRef<Terminal | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    const shellProcessRef = useRef<any>(null);
    const isInitializedRef = useRef(false);

    useEffect(() => {
        if (!terminalRef.current || !webContainerInstance || isInitializedRef.current) return;

        console.log('[WebTerminal] Initializing...');

        // 1. Initialize xterm.js
        const term = new Terminal({
            cursorBlink: true,
            theme: {
                background: '#0f172a', // Slate 900
                foreground: '#e2e8f0', // Slate 200
                cursor: '#22d3ee', // Cyan 400
                selectionBackground: '#334155', // Slate 700
            },
            fontFamily: 'Menlo, Monaco, "Courier New", monospace',
            fontSize: 13,
            rows: 24,
            cols: 80
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);

        term.open(terminalRef.current);
        fitAddon.fit();

        xtermRef.current = term;
        fitAddonRef.current = fitAddon;

        // 2. Spawn shell process (jsh)
        startShell(webContainerInstance, term);

        isInitializedRef.current = true;

        // Handle resize
        const handleResize = () => {
            fitAddon.fit();
            if (shellProcessRef.current) {
                const { cols, rows } = term;
                shellProcessRef.current.resize({ cols, rows });
            }
        };

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            if (shellProcessRef.current) {
                shellProcessRef.current.kill();
            }
            term.dispose();
            isInitializedRef.current = false;
        };
    }, [webContainerInstance]);

    const startShell = async (container: WebContainer, term: Terminal) => {
        try {
            console.log('[WebTerminal] Spawning jsh...');
            const process = await container.spawn('jsh', {
                terminal: {
                    cols: term.cols,
                    rows: term.rows,
                },
            });

            shellProcessRef.current = process;

            // Pipe stream to terminal
            process.output.pipeTo(
                new WritableStream({
                    write(data) {
                        term.write(data);
                    },
                })
            );

            // Pipe terminal input to process
            const inputWriter = process.input.getWriter();
            term.onData((data) => {
                inputWriter.write(data);
            });

            console.log('[WebTerminal] Shell started.');
        } catch (error) {
            console.error('[WebTerminal] Failed to start shell:', error);
            term.write('\r\n\x1b[31mFailed to start shell process.\x1b[0m\r\n');
        }
    };

    return (
        <div
            className="w-full h-full bg-slate-900 border-t border-slate-700/50 p-2 overflow-hidden"
            style={{ minHeight: '300px' }}
        >
            <div ref={terminalRef} className="w-full h-full" />
        </div>
    );
};

export default WebTerminal;
