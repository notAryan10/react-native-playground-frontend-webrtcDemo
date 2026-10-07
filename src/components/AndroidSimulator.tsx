'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';

/**
 * AndroidSimulator panel.
 *
 * Owns one Android runtime (emulator + ws-scrcpy) for this browser user:
 *  - Start:    POST /android/runtime/start on the orchestrator
 *  - Stream:   iframe on the orchestrator's /android/stream/:runtimeId proxy
 *              (same-origin-shape route; ws-scrcpy's index.html uses relative
 *              asset paths, so everything resolves under the prefix). The
 *              deep-link hash enables chromeless mode so the video canvas
 *              fills the iframe exactly - the panel maps pointer input
 *              against the full iframe rect.
 *  - Control:  WS /android/runtime/:id/control relays tap/swipe/text/key to
 *              adb input on the device (ws-scrcpy's own input path is dead on
 *              Android 14 - see the runbook).
 *
 * The runtime intentionally outlives this component (tab switching, page
 * navigations within the SPA); "Stop" tears it down explicitly. Persistence
 * across browser reconnects is a later milestone - restarting the frontend
 * orphans the runtime until the orchestrator restarts.
 */

export interface AndroidSimulatorProps {
    orchestratorUrl: string;
    userId: string;
    colors: {
        bg: string;
        bgSecondary: string;
        border: string;
        text: string;
        textSecondary: string;
    };
}

interface StartResponse {
    runtimeId: string;
    status: string;
    stream?: { type: string; url: string };
    error?: string;
    detail?: string;
}

type Phase = 'idle' | 'starting' | 'ready' | 'error';

const CONTROL_KEYS = ['BACK', 'HOME', 'APP_SWITCH'] as const;

interface RuntimeStatusResponse {
    runtimeId: string;
    status: 'starting' | 'ready' | 'stopping' | 'stopped' | 'error' | string;
    avdName?: string;
    stream?: { type: string; url: string };
    streamUrl?: string;
    display?: { width: number; height: number };
    error?: string;
}

export default function AndroidSimulator({ orchestratorUrl, userId, colors }: AndroidSimulatorProps) {
    const [phase, setPhase] = useState<Phase>('idle');
    const [error, setError] = useState<string | null>(null);
    const [runtimeId, setRuntimeId] = useState<string | null>(null);
    const [streamSrc, setStreamSrc] = useState<string | null>(null);
    const [iframeLoaded, setIframeLoaded] = useState(false);
    const [controlOpen, setControlOpen] = useState(false);
    const [display, setDisplay] = useState<{ width: number; height: number } | null>(null);
    const [textValue, setTextValue] = useState('');
    const [lastEvent, setLastEvent] = useState<string | null>(null);
    const [box, setBox] = useState({ w: 0, h: 0 });

    const wsRef = useRef<WebSocket | null>(null);
    const stoppedByUserRef = useRef(false);
    const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const areaRef = useRef<HTMLDivElement | null>(null);
    const dragRef = useRef<{ x0: number; y0: number; x1: number; y1: number; moved: boolean; t0: number } | null>(null);
    const msgIdRef = useRef(0);

    const httpBase = orchestratorUrl || (typeof window !== 'undefined' ? window.location.origin : '');

    const teardownControlSocket = useCallback(() => {
        if (reconnectTimerRef.current) {
            clearTimeout(reconnectTimerRef.current);
            reconnectTimerRef.current = null;
        }
        stoppedByUserRef.current = true;
        const ws = wsRef.current;
        wsRef.current = null;
        if (ws && ws.readyState <= WebSocket.OPEN) ws.close(1000, 'panel stop');
        setControlOpen(false);
    }, []);

    const connectControl = useCallback((rtId: string) => {
        if (typeof window === 'undefined') return;
        teardownControlSocket();
        stoppedByUserRef.current = false;
        const u = new URL(httpBase);
        const scheme = u.protocol === 'https:' ? 'wss' : 'ws';
        const ws = new WebSocket(`${scheme}://${u.host}/android/runtime/${rtId}/control`);
        wsRef.current = ws;
        ws.onopen = () => setControlOpen(true);
        ws.onclose = () => {
            if (wsRef.current !== ws) return; // superseded
            setControlOpen(false);
            wsRef.current = null;
            // The backend closes control sockets when the runtime stops, so
            // only retry while we still believe the runtime is alive.
            if (!stoppedByUserRef.current) {
                reconnectTimerRef.current = setTimeout(() => connectControl(rtId), 2000);
            }
        };
        ws.onerror = () => { /* close follows */ };
        ws.onmessage = (ev) => {
            let msg: { type?: string; display?: { width: number; height: number }; error?: string; serial?: string };
            try { msg = JSON.parse(String(ev.data)); } catch { return; }
            if (msg.type === 'hello' && msg.display) {
                setDisplay(msg.display);
            } else if (msg.type === 'error') {
                setLastEvent(`error: ${msg.error || 'unknown'}`);
            }
        };
    }, [httpBase, teardownControlSocket]);

    const sendControl = useCallback((payload: Record<string, unknown>) => {
        const ws = wsRef.current;
        if (!ws || ws.readyState !== WebSocket.OPEN) return false;
        const id = String(++msgIdRef.current);
        ws.send(JSON.stringify({ ...payload, id }));
        setLastEvent(`${payload.type}${payload.key ? ` ${payload.key}` : ''} -> sent`);
        return true;
    }, []);

    /** Rewrite the server's direct deep link into the panel's proxy shape:
     *  iframe + video WS both on /android/stream/:runtimeId, chromeless so
     *  the canvas fills the iframe. */
    const applyStream = useCallback((rtId: string, deepUrl: string) => {
        const deep = new URL(deepUrl);
        const hashParams = new URLSearchParams(deep.hash.replace(/^#!?/, ''));
        const origWs = hashParams.get('ws');
        const origSearch = origWs ? new URL(origWs).search : '';
        const serial = hashParams.get('udid') || '';
        const streamPath = `/android/stream/${rtId}`;
        const u = new URL(httpBase);
        const wsScheme = u.protocol === 'https:' ? 'wss' : 'ws';
        const videoWs = `${wsScheme}://${u.host}${streamPath}/${origSearch}`;
        const hash = `#!action=stream&udid=${encodeURIComponent(serial)}` +
            `&ws=${encodeURIComponent(videoWs)}&player=WebCodecs&chromeless=1`;
        setRuntimeId(rtId);
        setStreamSrc(`${httpBase}${streamPath}/index.html${hash}`);
        setPhase('ready');
    }, [httpBase]);

    const start = useCallback(async () => {
        if (!userId || phase === 'starting') return;
        setPhase('starting');
        setError(null);
        setLastEvent(null);
        setIframeLoaded(false);
        try {
            const res = await fetch(`${httpBase}/android/runtime/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId }),
            });
            const data: StartResponse = await res.json();
            if (!res.ok || !data.stream?.url || !data.runtimeId) {
                throw new Error(data.detail || data.error || `start failed (HTTP ${res.status})`);
            }
            applyStream(data.runtimeId, data.stream.url);
            connectControl(data.runtimeId);
        } catch (e) {
            setPhase('error');
            setError(String(e instanceof Error ? e.message : e));
        }
    }, [userId, phase, httpBase, connectControl, applyStream]);

    // Remount == potential browser refresh: reattach to a surviving session.
    // While a boot is in flight (start clicked, page refreshed mid-boot), poll
    // instead of double-starting; the backend start is idempotent but polling
    // avoids a pointless 60s request hang.
    const reconnect = useCallback(async (attempt = 0): Promise<void> => {
        if (!userId) return;
        let live: { runtimeId: string; streamUrl: string } | null = null;
        try {
            const res = await fetch(`${httpBase}/android/runtime/rt_${userId}`);
            if (res.ok) {
                const info: RuntimeStatusResponse = await res.json();
                const url = info.stream?.url || info.streamUrl;
                if (info.status === 'ready' && info.runtimeId && url) {
                    live = { runtimeId: info.runtimeId, streamUrl: url };
                } else if (info.status === 'starting' && attempt < 150) {
                    setTimeout(() => void reconnect(attempt + 1), 4000);
                    setPhase('starting');
                    return;
                }
            }
        } catch { /* orchestrator unreachable; Start button still works */ }
        if (live) {
            setIframeLoaded(false);
            applyStream(live.runtimeId, live.streamUrl);
            connectControl(live.runtimeId);
        }
    }, [userId, httpBase, connectControl, applyStream]);

    useEffect(() => {
        void reconnect();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const stop = useCallback(async () => {
        if (!runtimeId) return;
        teardownControlSocket();
        const rtId = runtimeId;
        setPhase('idle');
        setStreamSrc(null);
        setIframeLoaded(false);
        setRuntimeId(null);
        setDisplay(null);
        setLastEvent(null);
        try {
            await fetch(`${httpBase}/android/runtime/${rtId}/stop`, { method: 'POST' });
        } catch (e) {
            console.warn('[AndroidSimulator] stop request failed:', e);
        }
    }, [runtimeId, httpBase, teardownControlSocket]);

    // Keep the runtime alive across tab switches; only disconnect our socket.
    useEffect(() => teardownControlSocket, [teardownControlSocket]);

    // Fit the phone box (device aspect) inside the available area.
    useEffect(() => {
        const area = areaRef.current;
        if (!area || typeof ResizeObserver === 'undefined') return;
        const ro = new ResizeObserver((entries) => {
            const r = entries[0].contentRect;
            setBox({ w: r.width, h: r.height });
        });
        ro.observe(area);
        return () => ro.disconnect();
    }, []);

    const aspect = display && display.height > 0 ? display.width / display.height : 320 / 640;
    let phoneW = box.w;
    let phoneH = phoneW / aspect;
    if (box.h > 0 && phoneH > box.h) {
        phoneH = box.h;
        phoneW = phoneH * aspect;
    }

    const norm = (clientX: number, clientY: number, rect: DOMRect) => ({
        x: Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)),
        y: Math.min(1, Math.max(0, (clientY - rect.top) / rect.height)),
    });

    const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const { x, y } = norm(e.clientX, e.clientY, rect);
        e.currentTarget.setPointerCapture(e.pointerId);
        dragRef.current = { x0: x, y0: y, x1: x, y1: y, moved: false, t0: performance.now() };
    };

    const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        const drag = dragRef.current;
        if (!drag) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const { x, y } = norm(e.clientX, e.clientY, rect);
        drag.x1 = x;
        drag.y1 = y;
        if (Math.abs(x - drag.x0) * rect.width + Math.abs(y - drag.y0) * rect.height > 6) {
            drag.moved = true;
        }
    };

    const onPointerUp = () => {
        const drag = dragRef.current;
        dragRef.current = null;
        if (!drag) return;
        if (!drag.moved) {
            sendControl({ type: 'tap', x: drag.x0, y: drag.y0 });
        } else {
            const durationMs = Math.round(Math.min(10_000, Math.max(50, performance.now() - drag.t0)));
            sendControl({ type: 'swipe', x1: drag.x0, y1: drag.y0, x2: drag.x1, y2: drag.y1, durationMs });
        }
    };

    const sendText = () => {
        const t = textValue.trim();
        if (!t) return;
        if (sendControl({ type: 'text', text: t })) setTextValue('');
    };

    const inputStyle: React.CSSProperties = {
        padding: '3px 8px',
        fontSize: 12,
        borderRadius: 4,
        border: `1px solid ${colors.border}`,
        backgroundColor: colors.bg,
        color: colors.text,
        width: 150,
    };
    const btnStyle = (disabled: boolean): React.CSSProperties => ({
        padding: '3px 10px',
        fontSize: 12,
        borderRadius: 4,
        border: `1px solid ${colors.border}`,
        backgroundColor: colors.bgSecondary,
        color: disabled ? colors.textSecondary : colors.text,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
    });

    return (
        <div className="h-full flex flex-col" style={{ backgroundColor: colors.bgSecondary }}>
            <div
                className="flex items-center gap-2 flex-wrap"
                style={{ padding: '6px 10px', borderBottom: `1px solid ${colors.border}` }}
            >
                {phase === 'ready' ? (
                    <button onClick={stop} style={btnStyle(false)} title="Stop the emulator and release resources">
                        Stop
                    </button>
                ) : (
                    <button
                        onClick={start}
                        disabled={phase === 'starting' || !userId}
                        style={btnStyle(phase === 'starting' || !userId)}
                    >
                        {phase === 'starting' ? 'Starting...' : 'Start Android'}
                    </button>
                )}
                <button onClick={() => sendControl({ type: 'key', key: 'BACK' })} disabled={!controlOpen} style={btnStyle(!controlOpen)}>
                    Back
                </button>
                <button onClick={() => sendControl({ type: 'key', key: 'HOME' })} disabled={!controlOpen} style={btnStyle(!controlOpen)}>
                    Home
                </button>
                <button onClick={() => sendControl({ type: 'key', key: 'APP_SWITCH' })} disabled={!controlOpen} style={btnStyle(!controlOpen)}>
                    Recents
                </button>
                <input
                    value={textValue}
                    onChange={(e) => setTextValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') sendText(); }}
                    placeholder="Type text, press Enter"
                    style={inputStyle}
                    disabled={!controlOpen}
                />
                <div className="flex items-center gap-1.5 text-xs" style={{ color: colors.textSecondary }}>
                    <div
                        className={`w-2 h-2 rounded-full ${controlOpen ? 'bg-green-500' : phase === 'ready' ? 'bg-amber-500 animate-pulse' : 'bg-gray-500'}`}
                    />
                    <span>{phase === 'ready' ? (controlOpen ? 'Control ready' : 'Control connecting...') : phase === 'starting' ? 'Booting emulator...' : 'Stopped'}</span>
                </div>
                {display && (
                    <span className="text-xs" style={{ color: colors.textSecondary }}>
                        {display.width}x{display.height}
                    </span>
                )}
            </div>

            {(error || lastEvent) && (
                <div
                    className="text-xs px-2.5 py-1"
                    style={{ color: error ? '#f87171' : colors.textSecondary, borderBottom: `1px solid ${colors.border}` }}
                >
                    {error || lastEvent}
                </div>
            )}

            <div ref={areaRef} className="flex-1 flex items-center justify-center overflow-hidden" style={{ backgroundColor: colors.bg }}>
                {phase !== 'ready' ? (
                    <div className="text-xs text-center px-6" style={{ color: colors.textSecondary }}>
                        {phase === 'error'
                            ? 'Starting the Android runtime failed. Check that the orchestrator runs with ANDROID_RUNTIME_ALLOWED=true, then retry.'
                            : 'Start Android to boot an emulator and stream its screen here. Tap, swipe and type through the toolbar.'}
                    </div>
                ) : (
                    phoneW > 0 && (
                        <div
                            style={{
                                position: 'relative',
                                width: phoneW,
                                height: phoneH,
                                border: `1px solid ${colors.border}`,
                                backgroundColor: '#000',
                            }}
                        >
                            <iframe
                                src={streamSrc || undefined}
                                title="Android screen"
                                onLoad={() => setIframeLoaded(true)}
                                style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
                            />
                            {!iframeLoaded && (
                                <div
                                    className="absolute inset-0 flex items-center justify-center text-xs"
                                    style={{ color: colors.textSecondary, backgroundColor: '#000' }}
                                >
                                    Connecting to the Android stream...
                                </div>
                            )}
                            {/* Input surface. Sits above the iframe and owns ALL pointer
                                interaction: ws-scrcpy's own touch path cannot work on this
                                guest, and the canvas fills the iframe (chromeless), so
                                normalized coords vs this rect are exact device coords. */}
                            <div
                                style={{ position: 'absolute', inset: 0, touchAction: 'none', cursor: 'pointer' }}
                                onPointerDown={onPointerDown}
                                onPointerMove={onPointerMove}
                                onPointerUp={onPointerUp}
                                onPointerCancel={() => { dragRef.current = null; }}
                            />
                        </div>
                    )
                )}
            </div>
        </div>
    );
}
