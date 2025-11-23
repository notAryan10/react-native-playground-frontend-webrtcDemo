'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Wifi, WifiOff, RefreshCw, Video, VideoOff } from 'lucide-react';

interface WebRTCViewerProps {
  serverUrl?: string;
  signalingUrl?: string;
  theme?: 'dark' | 'light';
}

export default function WebRTCViewer({ 
  serverUrl = 'http://localhost:3000',
  signalingUrl = 'ws://localhost:3002',
  theme = 'dark' 
}: WebRTCViewerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [streamingUrl, setStreamingUrl] = useState(signalingUrl);
  const [connectionState, setConnectionState] = useState<string>('disconnected');

  const themeColors = theme === 'dark'
    ? {
      bg: '#1e1e1e',
      bgSecondary: '#252526',
      border: '#3e3e42',
      text: '#ffffff',
      textSecondary: '#9ca3af'
    }
    : {
      bg: '#ffffff',
      bgSecondary: '#f3f4f6',
      border: '#d1d5db',
      text: '#111827',
      textSecondary: '#6b7280'
    };

  const checkServerStatus = async () => {
    try {
      const response = await fetch(`${serverUrl}/status`);
      if (response.ok) {
        const data = await response.json();
        return data;
      } else {
        setError('Server not responding');
        return null;
      }
    } catch (err) {
      setError('Cannot connect to server');
      return null;
    }
  };

  const initializeWebRTC = async () => {
    if (connecting || connected) return;

    setConnecting(true);
    setError(null);
    setConnectionState('connecting');

    try {
      // Check if WebRTC is supported
      if (!window.RTCPeerConnection) {
        throw new Error('WebRTC is not supported in this browser');
      }

      // Create RTCPeerConnection with STUN servers
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          // Add TURN server here if needed for production
          // {
          //   urls: 'turn:your-turn-server.com:3478',
          //   username: 'user',
          //   credential: 'pass'
          // }
        ],
        iceCandidatePoolSize: 10
      });

      pcRef.current = pc;

      // Handle incoming stream
      pc.ontrack = (event) => {
        console.log('Received remote stream:', event.streams);
        if (videoRef.current && event.streams[0]) {
          videoRef.current.srcObject = event.streams[0];
          setConnected(true);
          setConnectionState('connected');
          setError(null);
        }
      };

      // Handle ICE connection state changes
      pc.oniceconnectionstatechange = () => {
        const state = pc.iceConnectionState;
        setConnectionState(state);
        console.log('ICE connection state:', state);

        if (state === 'connected' || state === 'completed') {
          setConnected(true);
        } else if (state === 'disconnected' || state === 'failed' || state === 'closed') {
          setConnected(false);
          if (state === 'failed') {
            setError('Connection failed. Check network and try again.');
          }
        }
      };

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          console.log('Sending ICE candidate');
          wsRef.current.send(JSON.stringify({
            type: 'ice-candidate',
            candidate: event.candidate,
            targetId: null // Broadcast to all
          }));
        }
      };

      // Connect to signaling server
      const ws = new WebSocket(streamingUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('Signaling WebSocket connected');
        setConnectionState('signaling-connected');
      };

      ws.onmessage = async (event) => {
        try {
          const message = JSON.parse(event.data);

          switch (message.type) {
            case 'client-id':
              setClientId(message.clientId);
              // Register as web client
              ws.send(JSON.stringify({
                type: 'register',
                clientType: 'web'
              }));
              break;

            case 'offer':
              // Received offer from mobile client
              console.log('Received offer from:', message.fromId);
              if (pc.remoteDescription === null) {
                await pc.setRemoteDescription(new RTCSessionDescription(message.offer));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                
                ws.send(JSON.stringify({
                  type: 'answer',
                  answer: answer,
                  targetId: message.fromId
                }));
                console.log('Sent answer to:', message.fromId);
              }
              break;

            case 'ice-candidate':
              // Received ICE candidate
              if (message.candidate) {
                try {
                  await pc.addIceCandidate(new RTCIceCandidate(message.candidate));
                  console.log('Added ICE candidate from:', message.fromId);
                } catch (err) {
                  console.error('Error adding ICE candidate:', err);
                }
              }
              break;

            case 'client-connected':
              console.log('Client connected:', message.clientId, message.clientType);
              // If mobile client connected, we can request connection
              if (message.clientType === 'mobile') {
                // Mobile will initiate, we just wait for offer
              }
              break;

            case 'client-disconnected':
              console.log('Client disconnected:', message.clientId);
              break;

            default:
              console.log('Unknown message type:', message.type);
          }
        } catch (err) {
          console.error('Error processing signaling message:', err);
        }
      };

      ws.onerror = (err) => {
        console.error('Signaling WebSocket error:', err);
        setError('Failed to connect to signaling server');
        setConnecting(false);
        setConnectionState('error');
      };

      ws.onclose = () => {
        console.log('Signaling WebSocket closed');
        setConnected(false);
        setConnecting(false);
        setConnectionState('disconnected');
        if (pcRef.current) {
          pcRef.current.close();
          pcRef.current = null;
        }
      };

    } catch (err: any) {
      console.error('Error initializing WebRTC:', err);
      setError(err.message || 'Failed to initialize WebRTC');
      setConnecting(false);
      setConnectionState('error');
    }
  };

  const disconnect = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setConnected(false);
    setConnecting(false);
    setConnectionState('disconnected');
    setClientId(null);
  };

  useEffect(() => {
    checkServerStatus();
    return () => {
      disconnect();
    };
  }, []);

  const getConnectionStatusColor = () => {
    switch (connectionState) {
      case 'connected':
      case 'completed':
        return '#10b981';
      case 'connecting':
      case 'checking':
        return '#f59e0b';
      case 'failed':
      case 'disconnected':
      case 'closed':
        return '#ef4444';
      default:
        return themeColors.textSecondary;
    }
  };

  return (
    <div 
      className="h-full flex flex-col"
      style={{ backgroundColor: themeColors.bg }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center justify-between border-b"
        style={{
          backgroundColor: themeColors.bgSecondary,
          borderColor: themeColors.border
        }}
      >
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-sm" style={{ color: themeColors.text }}>
            WebRTC Stream Viewer
          </h3>
          <div className="flex items-center gap-2">
            {connected ? (
              <Video className="w-4 h-4 text-green-500" />
            ) : (
              <VideoOff className="w-4 h-4 text-red-500" />
            )}
            <span 
              className="text-xs"
              style={{ color: getConnectionStatusColor() }}
            >
              {connectionState.charAt(0).toUpperCase() + connectionState.slice(1)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {clientId && (
            <span className="text-xs" style={{ color: themeColors.textSecondary }}>
              ID: {clientId.substring(0, 8)}...
            </span>
          )}
          <button
            onClick={connected ? disconnect : initializeWebRTC}
            disabled={connecting}
            className="p-1.5 rounded hover:opacity-80 transition-opacity disabled:opacity-50"
            style={{ color: themeColors.textSecondary }}
            title={connected ? "Disconnect" : "Connect"}
          >
            <RefreshCw className={`w-4 h-4 ${connecting ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Video Display */}
      <div className="flex-1 flex items-center justify-center p-4 overflow-auto">
        {error ? (
          <div className="text-center">
            <div 
              className="text-sm mb-2"
              style={{ color: themeColors.textSecondary }}
            >
              {error}
            </div>
            <div 
              className="text-xs mb-4"
              style={{ color: themeColors.textSecondary }}
            >
              Make sure the backend server is running and the mobile app is streaming.
            </div>
            <button
              onClick={initializeWebRTC}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
            >
              Retry Connection
            </button>
          </div>
        ) : (
          <div className="relative">
            <div
              className="relative rounded-2xl overflow-hidden shadow-2xl"
              style={{
                backgroundColor: themeColors.bgSecondary,
                border: `8px solid ${themeColors.border}`,
                maxWidth: '400px',
                maxHeight: '800px'
              }}
            >
              <div
                className="absolute top-0 left-1/2 transform -translate-x-1/2 h-6 w-40 rounded-b-2xl z-10"
                style={{ backgroundColor: themeColors.border }}
              />
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-contain"
                style={{
                  backgroundColor: themeColors.bg,
                  minHeight: '600px',
                  minWidth: '360px'
                }}
              />
              {!connected && (
                <div
                  className="absolute inset-0 flex items-center justify-center"
                  style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
                >
                  <div className="text-center">
                    {connecting ? (
                      <>
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4" />
                        <div className="text-white text-sm">Connecting via WebRTC...</div>
                        <div className="text-white text-xs mt-2">{connectionState}</div>
                      </>
                    ) : (
                      <>
                        <VideoOff className="w-12 h-12 text-white mx-auto mb-4" />
                        <div className="text-white text-sm">Not Connected</div>
                        <div className="text-white text-xs mt-2">Click connect to start</div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div
              className="mt-4 p-3 rounded text-xs text-center"
              style={{
                backgroundColor: themeColors.bgSecondary,
                color: themeColors.textSecondary
              }}
            >
              <div>Stream: WebRTC • {connectionState}</div>
              <div className="mt-1">Signaling: {streamingUrl}</div>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div
        className="px-4 py-3 border-t"
        style={{
          backgroundColor: themeColors.bgSecondary,
          borderColor: themeColors.border
        }}
      >
        <label 
          className="text-xs font-medium mb-2 block"
          style={{ color: themeColors.textSecondary }}
        >
          Signaling Server URL
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={streamingUrl}
            onChange={(e) => setStreamingUrl(e.target.value)}
            placeholder="ws://localhost:3002"
            disabled={connected || connecting}
            className="flex-1 px-3 py-2 rounded text-sm"
            style={{
              backgroundColor: themeColors.bg,
              border: `1px solid ${themeColors.border}`,
              color: themeColors.text,
              opacity: (connected || connecting) ? 0.6 : 1
            }}
          />
          <button
            onClick={connected ? disconnect : initializeWebRTC}
            disabled={connecting}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 disabled:cursor-not-allowed text-white rounded text-sm"
          >
            {connected ? 'Disconnect' : connecting ? 'Connecting...' : 'Connect'}
          </button>
        </div>
        <div className="mt-2 text-xs" style={{ color: themeColors.textSecondary }}>
          <div>Backend: {serverUrl}</div>
          <div className="mt-1">
            WebRTC provides lower latency (~50-150ms) compared to MJPEG streaming
          </div>
        </div>
      </div>
    </div>
  );
}

