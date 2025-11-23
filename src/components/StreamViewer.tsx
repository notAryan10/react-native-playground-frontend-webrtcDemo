'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Play, Square, RefreshCw, Wifi, WifiOff } from 'lucide-react';

interface StreamViewerProps {
  serverUrl?: string;
  theme?: 'dark' | 'light';
}

export default function StreamViewer({ 
  serverUrl = 'http://localhost:3000', 
  theme = 'dark' 
}: StreamViewerProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamUrl, setStreamUrl] = useState(serverUrl);
  const imgRef = useRef<HTMLImageElement>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

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
      const response = await fetch(`${streamUrl}/status`);
      if (response.ok) {
        const data = await response.json();
        setIsConnected(data.ffmpegRunning);
        setError(null);
        return data;
      } else {
        setError('Server not responding');
        setIsConnected(false);
      }
    } catch (err) {
      setError('Cannot connect to server');
      setIsConnected(false);
    }
  };

  const handleRefresh = () => {
    if (imgRef.current) {
      const baseUrl = `${streamUrl}/stream.mjpeg`;
      imgRef.current.src = `${baseUrl}?t=${Date.now()}`;
      setLastUpdate(new Date());
    }
  };

  useEffect(() => {
    const interval = setInterval(checkServerStatus, 3000);
    checkServerStatus();

    return () => clearInterval(interval);
  }, [streamUrl]);

  useEffect(() => {
    const img = imgRef.current;
    if (img) {
      const handleLoad = () => {
        setLastUpdate(new Date());
        setIsConnected(true);
        setError(null);
      };

      const handleError = () => {
        setError('Stream not available');
        setIsConnected(false);
      };

      img.addEventListener('load', handleLoad);
      img.addEventListener('error', handleError);

      return () => {
        img.removeEventListener('load', handleLoad);
        img.removeEventListener('error', handleError);
      };
    }
  }, []);

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
            Live Stream Preview
          </h3>
          <div className="flex items-center gap-2">
            {isConnected ? (
              <Wifi className="w-4 h-4 text-green-500" />
            ) : (
              <WifiOff className="w-4 h-4 text-red-500" />
            )}
            <span 
              className="text-xs"
              style={{ color: isConnected ? '#10b981' : '#ef4444' }}
            >
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {lastUpdate && (
            <span className="text-xs" style={{ color: themeColors.textSecondary }}>
              Updated {lastUpdate.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={handleRefresh}
            className="p-1.5 rounded hover:opacity-80 transition-opacity"
            style={{ color: themeColors.textSecondary }}
            title="Refresh stream"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>
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
              className="text-xs"
              style={{ color: themeColors.textSecondary }}
            >
              Make sure the backend server is running and the mobile app is streaming.
            </div>
            <button
              onClick={checkServerStatus}
              className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
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
              <img
                ref={imgRef}
                src={`${streamUrl}/stream.mjpeg`}
                alt="Live stream from mobile app"
                className="w-full h-full object-contain"
                style={{
                  backgroundColor: themeColors.bg,
                  minHeight: '600px',
                  minWidth: '360px'
                }}
              />
              {!isConnected && (
                <div
                  className="absolute inset-0 flex items-center justify-center"
                  style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
                >
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4" />
                    <div className="text-white text-sm">Waiting for stream...</div>
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
              <div>Stream URL: {streamUrl}/stream.mjpeg</div>
              <div className="mt-1">Format: MJPEG • ~10 FPS</div>
            </div>
          </div>
        )}
      </div>
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
          Backend Server URL
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={streamUrl}
            onChange={(e) => setStreamUrl(e.target.value)}
            placeholder="http://localhost:3000"
            className="flex-1 px-3 py-2 rounded text-sm"
            style={{
              backgroundColor: themeColors.bg,
              border: `1px solid ${themeColors.border}`,
              color: themeColors.text
            }}
          />
          <button
            onClick={checkServerStatus}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
          >
            Connect
          </button>
        </div>
        <div className="mt-2">
          <a
            href={`${streamUrl}/stream.mjpeg`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-500 hover:text-blue-600 underline"
          >
            Open stream in new tab (for testing)
          </a>
        </div>
      </div>
    </div>
  );
}
