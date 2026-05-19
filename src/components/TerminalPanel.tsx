'use client';

import React, { useEffect, useRef, useState } from 'react';
import 'xterm/css/xterm.css';

interface TerminalPanelProps {
    height?: number | string;
    terminalUrl?: string;
}

export default function TerminalPanel({ height = '100%', terminalUrl }: TerminalPanelProps) {
    const terminalRef = useRef<HTMLDivElement>(null);
    const xtermRef = useRef<any>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const fitAddonRef = useRef<any>(null);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        if (!terminalRef.current) return;

        let isMounted = true;
        let cleanupFn: (() => void) | undefined;

        const initTerminal = async () => {
            try {
                if (!isMounted) return;

                const { Terminal } = await import('xterm');
                const { FitAddon } = await import('xterm-addon-fit');
                if (!isMounted) return;

                const term = new Terminal({
                    cursorBlink: true,
                    fontSize: 14,
                    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
                    theme: {
                        background: '#1e1e1e',
                        foreground: '#d4d4d4',
                        cursor: '#ffffff',
                    },
                    scrollback: 5000,
                    scrollOnInput: true,
                    allowProposedApi: true
                });

                const fitAddon = new FitAddon();
                term.loadAddon(fitAddon);

                if (terminalRef.current) {
                    term.open(terminalRef.current);
                    setTimeout(() => {
                        try {
                            fitAddon.fit();
                        } catch (e) {
                            console.error('Fit error:', e);
                        }
                    }, 50);
                }

                xtermRef.current = term;
                fitAddonRef.current = fitAddon;

                let retryTimeout: NodeJS.Timeout;
                let ws: WebSocket | null = null;

                const connect = () => {
                    if (!isMounted) return;

                    if (wsRef.current) {
                        try {
                            wsRef.current.close();
                        } catch (e) {
                        }
                        wsRef.current = null;
                    }

                    if (!terminalUrl) {
                        term.writeln('\x1b[33mWaiting for terminal URL...\x1b[0m');
                        return;
                    }

                    const wsUrl = terminalUrl.endsWith('/') ? terminalUrl.slice(0, -1) : terminalUrl;
                    ws = new WebSocket(`${wsUrl}/terminal`);
                    wsRef.current = ws;

                    ws.onopen = () => {
                        if (!isMounted) {
                            ws?.close();
                            return;
                        }
                        setIsConnected(true);
                        fitAddon.fit();
                        term.writeln('\x1b[32m✓ Terminal connected\x1b[0m');
                        term.writeln('Type commands and press Enter...');

                        ws?.send(JSON.stringify({
                            type: 'resize',
                            cols: term.cols,
                            rows: term.rows
                        }));
                    };

                    ws.onmessage = (event: MessageEvent) => {
                        if (!isMounted) return;
                        term.write(event.data);
                    };

                    ws.onerror = () => {
                        if (!isMounted) return;
                        term.writeln('\r\n\x1b[31m✗ Connection error, retrying in 3s...\x1b[0m');
                        setIsConnected(false);
                    };

                    ws.onclose = () => {
                        if (!isMounted) return;
                        term.writeln('\r\n\x1b[33m⚠ Connection closed, retrying in 3s...\x1b[0m');
                        setIsConnected(false);
                        retryTimeout = setTimeout(connect, 3000);
                    };
                };

                connect();

                term.onData((data: string) => {
                    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                        wsRef.current.send(JSON.stringify({ type: 'input', data }));
                    }
                });

                const handleResize = () => {
                    if (!isMounted) return
                    try {
                        fitAddon.fit()
                        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                            wsRef.current.send(JSON.stringify({
                                type: 'resize',
                                cols: term.cols,
                                rows: term.rows,
                            }))
                        }
                    } catch (err) {
                        console.error('Resize error:', err)
                    }
                }

                window.addEventListener('resize', handleResize)

                cleanupFn = () => {
                    clearTimeout(retryTimeout)
                    window.removeEventListener('resize', handleResize)
                    if (wsRef.current) {
                        wsRef.current.close()
                        wsRef.current = null
                    }
                    term.dispose()
                    xtermRef.current = null
                };

            } catch (err) {
                console.error('Failed to init terminal:', err)
            }
        };

        initTerminal()

        return () => {
            isMounted = false
            if (cleanupFn) {
                cleanupFn()
            }
        }
    }, [terminalUrl])

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
            <div style={{ flex: 1, position: 'relative', backgroundColor: '#1e1e1e', overflow: 'hidden' }}>
                <div ref={terminalRef} style={{ position: 'absolute', top: '4px', left: '4px', right: '4px', bottom: '4px' }} />
            </div>
        </div>
    );
}
