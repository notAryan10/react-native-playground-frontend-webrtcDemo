'use client';

import React, { useEffect, useRef, useState } from 'react';

interface TerminalPanelProps {
    height?: number;
}

export default function TerminalPanel({ height = 300 }: TerminalPanelProps) {
    const terminalRef = useRef<HTMLDivElement>(null);
    const xtermRef = useRef<any>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const fitAddonRef = useRef<any>(null);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        if (!terminalRef.current) return;

        let term: any;
        let ws: WebSocket;
        let fitAddon: any;
        let handleResize: (() => void) | null = null;

        const initTerminal = async () => {
            await import('xterm/css/xterm.css');

            const { Terminal } = await import('xterm');
            const { FitAddon } = await import('xterm-addon-fit');

            term = new Terminal({
                cursorBlink: true,
                fontSize: 14,
                fontFamily: 'Menlo, Monaco, "Courier New", monospace',
                theme: {
                    background: '#1e1e1e',
                    foreground: '#d4d4d4',
                    cursor: '#ffffff',
                },
                rows: 20,
            });

            fitAddon = new FitAddon();
            term.loadAddon(fitAddon);

            if (!terminalRef.current) return;
            term.open(terminalRef.current);
            fitAddon.fit();

            xtermRef.current = term;
            fitAddonRef.current = fitAddon;


            let retryTimeout: NodeJS.Timeout;
            let isUnmounted = false;

            const connect = () => {
                if (isUnmounted) return;

                if (wsRef.current) {
                    wsRef.current.close();
                    wsRef.current = null;
                }

                ws = new WebSocket('ws://localhost:3000/terminal');
                wsRef.current = ws;

                ws.onopen = () => {
                    setIsConnected(true);
                    term.writeln('\\x1b[32m✓ Terminal connected\\x1b[0m');
                    term.writeln('Type commands and press Enter...');
                    term.write('\\r\\n$ ');
                };

                ws.onmessage = (event: MessageEvent) => {
                    term.write(event.data);
                };

                ws.onerror = () => {
                    if (!isUnmounted) {
                        term.writeln('\\r\\n\\x1b[31m✗ Connection error, retrying in 3s...\\x1b[0m');
                        setIsConnected(false);
                    }
                };

                ws.onclose = () => {
                    if (!isUnmounted) {
                        term.writeln('\\r\\n\\x1b[33m⚠ Connection closed, retrying in 3s...\\x1b[0m');
                        setIsConnected(false);
                        retryTimeout = setTimeout(connect, 3000);
                    }
                };
            };

            connect();

            term.onData((data: string) => {
                if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                    wsRef.current.send(JSON.stringify({ type: 'input', data }));
                }
            });

            handleResize = () => {
                fitAddon.fit();
                if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                    wsRef.current.send(JSON.stringify({
                        type: 'resize',
                        cols: term.cols,
                        rows: term.rows,
                    }));
                }
            };

            window.addEventListener('resize', handleResize);

            return () => {
                isUnmounted = true;
                clearTimeout(retryTimeout);
                if (handleResize) {
                    window.removeEventListener('resize', handleResize);
                }
                if (wsRef.current) {
                    wsRef.current.close();
                }
                if (xtermRef.current) {
                    xtermRef.current.dispose();
                }
            };
        };

        let cleanup: (() => void) | undefined;
        initTerminal().then(c => { cleanup = c; });

        return () => {
            if (cleanup) cleanup()
        }
    }, [])

    return (
        <div style={{ height, display: 'flex', flexDirection: 'column', backgroundColor: '#1e1e1e' }}>
            <div style={{
                padding: '8px 12px',
                backgroundColor: '#2d2d30',
                borderBottom: '1px solid #3e3e42',
                color: '#cccccc',
                fontSize: '12px',
                fontFamily: 'sans-serif',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
            }}>
                <span style={{ fontWeight: '600' }}>Terminal</span>
                <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: isConnected ? '#4caf50' : '#f44336',
                }} />
                <span style={{ fontSize: '11px', color: '#858585' }}>
                    {isConnected ? 'Connected' : 'Disconnected'}
                </span>
            </div>
            <div ref={terminalRef} style={{ flex: 1, padding: '8px' }} />
        </div>
    );
}
