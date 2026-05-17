'use client';

import { useEffect, useRef, useState } from 'react';

export interface WebRTCViewerProps {
  signalingUrl: string;
}

export default function WebRTCViewer({ signalingUrl }: WebRTCViewerProps) {
  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState('idle');

  useEffect(() => {
    if (!signalingUrl) return;

    const ws = new WebSocket(signalingUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('✅ WebRTC Viewer connected to signaling');
      setStatus('signaling-connected');
      ws.send(JSON.stringify({
        type: 'register',
        clientType: 'web',
      }));
    };

    ws.onmessage = async (event) => {
      const msg = JSON.parse(event.data);

      if (msg.type === 'offer') {
        setStatus('offer-received');

        const pc = new RTCPeerConnection({
          iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
        });
        pcRef.current = pc;

        pc.ontrack = (event) => {
          if (videoRef.current) {
            videoRef.current.srcObject = event.streams[0];
          }
        };

        pc.onicecandidate = (e) => {
          if (e.candidate) {
            ws.send(JSON.stringify({
              type: 'ice-candidate',
              candidate: e.candidate,
            }));
          }
        };

        await pc.setRemoteDescription(msg.offer);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        ws.send(JSON.stringify({
          type: 'answer',
          answer,
        }));

        setStatus('connected');
      }

      if (msg.type === 'ice-candidate') {
        await pcRef.current?.addIceCandidate(msg.candidate);
      }
    };

    return () => ws.close();
  }, [signalingUrl]);

  return (
    <div style={{ background: '#000', padding: 20 }}>
      <h3 style={{ color: 'white' }}>WebRTC Viewer</h3>
      <p style={{ color: 'gray' }}>Status: {status}</p>

      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{ width: '100%', maxWidth: 500 }}
      />
    </div>
  );
}
