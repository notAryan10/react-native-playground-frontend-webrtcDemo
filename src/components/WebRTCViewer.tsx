'use client';

import { useEffect, useRef, useState } from 'react';

export interface WebRTCViewerProps {
  signalingUrl: string;
}

export default function WebRTCViewer({ signalingUrl }: WebRTCViewerProps) {
  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  // The mobile peer's id for the current session; updated on each offer so ICE
  // candidates from a reused connection still route to the right device.
  const fromIdRef = useRef<string | undefined>(undefined);
  const [status, setStatus] = useState('idle');
  const [inspectMode, setInspectMode] = useState(false);
  // Last tap marker, shown briefly so the user sees where they clicked.
  const [tapMark, setTapMark] = useState<{ x: number; y: number } | null>(null);

  // Tap-to-source: translate a click on the streamed video into a normalized
  // [0,1] coordinate and ask the device to resolve it. The video element has no
  // explicit height (auto by aspect ratio), so its rect equals the content rect
  // with no letterboxing to compensate for.
  const handleInspectClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const rect = videoRef.current!.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    // Visual tap marker: position within the video element box (the overlay).
    const boxX = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const boxY = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    setTapMark({ x: boxX, y: boxY });
    setTimeout(() => setTapMark(null), 1200);

    // Device hit-test coordinate: normalize against the actual video frame, not
    // the element box. With object-fit: contain the frame is letterboxed inside
    // the element, so subtract that offset/scale or every tap is skewed toward an
    // edge. Falls back to the box when intrinsic size is unknown (no-op letterbox).
    const vw = video.videoWidth || rect.width;
    const vh = video.videoHeight || rect.height;
    const scale = Math.min(rect.width / vw, rect.height / vh);
    const contentW = vw * scale;
    const contentH = vh * scale;
    const offX = (rect.width - contentW) / 2;
    const offY = (rect.height - contentH) / 2;
    const nx = Math.min(1, Math.max(0, (e.clientX - rect.left - offX) / contentW));
    const ny = Math.min(1, Math.max(0, (e.clientY - rect.top - offY) / contentH));


    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'inspect-at', x: nx, y: ny, requestId: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}` }));
    }
  };

  useEffect(() => {
    if (!signalingUrl) return;

    const ws = new WebSocket(signalingUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('signaling-connected');
      ws.send(JSON.stringify({
        type: 'register',
        clientType: 'web',
      }));
    };

    ws.onmessage = async (event) => {
      const msg = JSON.parse(event.data);

      if (msg.type === 'offer') {
        fromIdRef.current = msg.fromId;

        // Reuse a single peer connection. The mobile re-offers on every
        // client-connected (editor sync socket, this viewer, each frontend
        // hot-reload), so building a fresh pc per offer churned ontrack and
        // reassigned srcObject repeatedly, aborting play() before any frame
        // rendered (black video). Renegotiation offers now apply to the
        // existing connection instead.
        let pc = pcRef.current;
        if (!pc) {
          pc = new RTCPeerConnection({
            iceServers: [
              { urls: process.env.NEXT_PUBLIC_STUN_SERVER || 'stun:stun.l.google.com:19302' },
              ...(process.env.NEXT_PUBLIC_TURN_URL ? [{
                urls: process.env.NEXT_PUBLIC_TURN_URL,
                username: process.env.NEXT_PUBLIC_TURN_USERNAME,
                credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL,
              }] : []),
            ],
          });
          pcRef.current = pc;

          pc.ontrack = (event) => {
            const stream = event.streams[0];
            const v = videoRef.current;
            if (v && stream && v.srcObject !== stream) {
              v.srcObject = stream;
              v.play().catch((err) => console.warn('[WebRTC] video.play() rejected:', err));
            }
          };

          // The real signal that media can flow; the SDP answer being sent does
          // not mean ICE succeeded (it may still fail, e.g. needs TURN).
          pc.oniceconnectionstatechange = () => {
            setStatus('ice-' + pc!.iceConnectionState);
          };

          pc.onicecandidate = (e) => {
            if (e.candidate) {
              ws.send(JSON.stringify({
                type: 'ice-candidate',
                candidate: e.candidate,
                targetId: fromIdRef.current,
              }));
            }
          };
        }

        await pc.setRemoteDescription(msg.offer);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        ws.send(JSON.stringify({
          type: 'answer',
          answer,
          targetId: fromIdRef.current,
        }));
      }

      if (msg.type === 'ice-candidate') {
        await pcRef.current?.addIceCandidate(msg.candidate);
      }

      // The device left. Its media is dead, but a <video> holds its last frame
      // forever, which reads as "still streaming". Drop the connection and the
      // picture so the panel honestly shows there is nothing to watch.
      if (msg.type === 'client-disconnected' && msg.clientType === 'mobile') {
        pcRef.current?.close();
        pcRef.current = null;
        fromIdRef.current = undefined;
        const v = videoRef.current;
        if (v) {
          v.srcObject = null;
          v.removeAttribute('src');
          v.load();
        }
        setStatus('device-disconnected');
      }
    };

    // Closing the socket alone leaves the peer connection alive: it holds an ICE
    // agent and keeps receiving media into a component that no longer exists.
    // A changed signalingUrl re-runs this effect, so without it every switch
    // strands a connection.
    return () => {
      ws.close();
      pcRef.current?.close();
      pcRef.current = null;
    };
  }, [signalingUrl]);

  return (
    <div style={{ background: '#000', padding: 12, height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexShrink: 0 }}>
        <div>
          <h3 style={{ color: 'white', margin: 0 }}>WebRTC Viewer</h3>
          <p style={{ color: 'gray', margin: 0, fontSize: 12 }}>Status: {status}</p>
        </div>
        <button
          onClick={() => setInspectMode((v) => !v)}
          title="Tap an element on the device to jump to its source"
          style={{
            fontSize: 12,
            fontWeight: 700,
            padding: '6px 12px',
            borderRadius: 6,
            border: `1px solid ${inspectMode ? '#00e5ff' : '#333'}`,
            background: inspectMode ? 'rgba(0,229,255,0.15)' : 'transparent',
            color: inspectMode ? '#00e5ff' : '#aaa',
            cursor: 'pointer',
          }}
        >
          {inspectMode ? 'Inspecting' : 'Inspect'}
        </button>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ position: 'relative', height: '100%', display: 'flex' }}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{ height: '100%', width: 'auto', maxWidth: '100%', objectFit: 'contain', display: 'block' }}
          />
        {inspectMode && (
          <div
            onClick={handleInspectClick}
            style={{
              position: 'absolute',
              inset: 0,
              cursor: 'crosshair',
              outline: '2px solid rgba(0,229,255,0.6)',
              outlineOffset: '-2px',
            }}
          >
            {tapMark && (
              <div
                style={{
                  position: 'absolute',
                  left: `${tapMark.x * 100}%`,
                  top: `${tapMark.y * 100}%`,
                  width: 14,
                  height: 14,
                  marginLeft: -7,
                  marginTop: -7,
                  borderRadius: '50%',
                  border: '2px solid #00e5ff',
                  background: 'rgba(0,229,255,0.3)',
                  pointerEvents: 'none',
                }}
              />
            )}
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
