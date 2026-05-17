'use client';

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { SettingsPanel, Settings } from './SettingsPanel';
import ConsolePanel, { LogEntry, LogLevel } from './ConsolePanel';
import { ArrowLeft, Clock, Download, Settings as SettingsIcon, HelpCircle, FileText } from 'lucide-react';
import { WebRTCViewerProps } from './WebRTCViewer';
import { MonacoPlaygroundProps } from './MonacoPlayground';
import { FileExplorer, File } from './FileExplorer';
import * as Babel from '@babel/standalone';
import TerminalPanel from './TerminalPanel';

const MonacoPlayground = dynamic<MonacoPlaygroundProps>(() => import('./MonacoPlayground'), { ssr: false });
const WebRTCViewer = dynamic<WebRTCViewerProps>(() => import('./WebRTCViewer'), { ssr: false });

const DEFAULT_APP_CODE = `import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Hello World 👋</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "white"
  },
  text: {
    fontSize: 24,
  },
});
`

export default function PlaygroundLayout() {
  const [workspaceStatus, setWorkspaceStatus] = useState<'idle' | 'provisioning' | 'ready' | 'error'>('idle');
  const [workspaceUrl, setWorkspaceUrl] = useState<string | null>(null);
  const [userId] = useState(() => {
    if (typeof window !== 'undefined') {
      const savedId = localStorage.getItem('playground-user-id');
      if (savedId) return savedId;
      const newId = `user-${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('playground-user-id', newId);
      return newId;
    }
    return 'default-user';
  });

  const [showSettings, setShowSettings] = useState(false);
  const [activeBottomTab, setActiveBottomTab] = useState<'console' | 'terminal'>('console');
  
  useEffect(() => {
    const provisionWorkspace = async () => {
      setWorkspaceStatus('provisioning');
      try {
        const orchestratorUrl = process.env.NEXT_PUBLIC_ORCHESTRATOR_URL || 'http://localhost:4000';
        const res = await fetch(`${orchestratorUrl}/workspaces`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId })
        });
        const data = await res.json();
        if (data.status === 'ready') {
          setWorkspaceUrl(data.url);
          setWorkspaceStatus('ready');
        } else {
          setWorkspaceStatus('error');
        }
      } catch (e) {
        console.error('Provisioning error:', e);
        setWorkspaceStatus('error');
      }
    };
    provisionWorkspace();
  }, [userId]);

  const [currentSettings, setCurrentSettings] = useState<Settings>({
    fontSize: 14,
    theme: 'dark',
    lineNumbers: true,
    autoSave: true,
    formatOnSave: false,
    minimap: false,
    autoRefresh: true,
    showConsoleErrors: true,
  });

  const [files, setFiles] = useState<Record<string, File>>({
    'src/App.tsx': { name: 'App.tsx', content: DEFAULT_APP_CODE, language: 'typescript' },
    'package.json': { name: 'package.json', content: '{\n  "name": "my-app",\n  "version": "1.0.0"\n}', language: 'json' },
    'README.md': { name: 'README.md', content: '# My App\n\nEdit src/App.tsx to see changes.', language: 'markdown' },
    'public/index.html': {
      name: 'index.html',
      content: '<html> <body> <div id="root"></div> </body> </html>', language: 'html'
    }
  });
  const [activeFile, setActiveFile] = useState<string>('src/App.tsx');
  const [dependencies, setDependencies] = useState<Record<string, string>>({});

  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [builderLogs, setBuilderLogs] = useState<LogEntry[]>([]);

  const pushLog = (level: LogLevel, message: string) => {
    setLogs((prev: any) => [...prev, { level, message, timestamp: new Date() }]);
  };
  const pushBuilderLog = (level: LogLevel, message: string) => {
    setBuilderLogs((prev: any) => [...prev, { level, message, timestamp: new Date() }]);
  };

  useEffect(() => {
    if (currentSettings.autoSave) {
      const timer = setTimeout(() => {
        localStorage.setItem('playground-files', JSON.stringify(files));
        localStorage.setItem('playground-deps', JSON.stringify(dependencies));
        setLastSaved(new Date());
        console.log('Auto-saved at:', new Date().toLocaleTimeString());
        pushBuilderLog('info', `Auto - saved at: ${new Date().toLocaleTimeString()} `);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [files, dependencies, currentSettings.autoSave]);

  useEffect(() => {
    const savedFiles = localStorage.getItem('playground-files');
    if (savedFiles) {
      try {
        const parsed = JSON.parse(savedFiles);
        if (parsed['App.tsx'] && !parsed['src/App.tsx']) {
          console.log('Migrating file structure...');
          const migrated: Record<string, File> = {
            'src/App.tsx': { ...parsed['App.tsx'], name: 'App.tsx' },
            'package.json': { name: 'package.json', content: '{\n  "name": "my-app",\n  "version": "1.0.0"\n}', language: 'json' },
            'README.md': { name: 'README.md', content: '# My App\n\nEdit src/App.tsx to see changes.', language: 'markdown' },
            'public/index.html': { name: 'index.html', content: '<html><body><div id="root"></div></body></html>', language: 'html' }
          };
          Object.keys(parsed).forEach(key => {
            if (key !== 'App.tsx') {
              migrated[key] = parsed[key];
            }
          });
          setFiles(migrated);
          setActiveFile('src/App.tsx');
        } else {
          setFiles(parsed);
        }
      } catch (e) {
        console.error('Failed to parse saved files', e);
      }
    }

    const savedDeps = localStorage.getItem('playground-deps');
    if (savedDeps) setDependencies(JSON.parse(savedDeps));

    const savedSettings = localStorage.getItem('playground-settings');
    if (savedSettings) setCurrentSettings(JSON.parse(savedSettings));
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', currentSettings.theme);
  }, [currentSettings.theme]);

  const handleSaveSettings = (newSettings: Settings) => {
    setCurrentSettings(newSettings);
    localStorage.setItem('playground-settings', JSON.stringify(newSettings));
    console.log('Settings updated:', newSettings);
    pushBuilderLog('info', 'Settings updated');
  };

  const handleCreateFile = (path: string) => {
    if (files[path]) {
      alert('File already exists!');
      return;
    }
    const name = path.split('/').pop() || path;
    const newFile: File = {
      name,
      content: '// New file\n',
      language: name.endsWith('.json') ? 'json' : (name.endsWith('.md') ? 'markdown' : (name.endsWith('.html') ? 'html' : 'typescript'))
    };
    setFiles((prev: any) => ({ ...prev, [path]: newFile }));
    setActiveFile(path);
  };

  const handleDeleteFile = (path: string) => {
    if (path === 'src/App.tsx') return;
    const newFiles = { ...files };
    delete newFiles[path];

    setFiles(newFiles);
    if (activeFile === path) {
      setActiveFile('src/App.tsx');
    }
  };

  const handleCodeChange = (newContent: string) => {
    setFiles((prev: { [x: string]: any; }) => ({
      ...prev,
      [activeFile]: { ...prev[activeFile], content: newContent }
    }));
  };

  const handleAddDependency = (name: string, version: string) => {
    setDependencies((prev: any) => ({ ...prev, [name]: version }));
    pushBuilderLog('info', `Added dependency: ${name} @${version} `);
  };

  const handleRemoveDependency = (name: string) => {
    const newDeps = { ...dependencies };
    delete newDeps[name];
    setDependencies(newDeps);
    pushBuilderLog('info', `Removed dependency: ${name} `);
  };

  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!workspaceUrl) return;

    const ws = new WebSocket(workspaceUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('📝 Web Editor connected to signaling server');
      ws.send(JSON.stringify({ type: 'register', clientType: 'web' }));
      sendCodeUpdate();
    };

    ws.onclose = () => {
      console.log('Web Editor disconnected');
    };

    return () => {
      ws.close();
    };
  }, [workspaceUrl]);

  const sendCodeUpdate = () => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN && files['src/App.tsx']) {
      try {
        const compiled = Babel.transform(files['src/App.tsx'].content, {
          presets: ['env', 'react', 'typescript'],
          filename: 'App.tsx',
        }).code;

        console.log('Sending transpiled code update...');

        ws.send(JSON.stringify({
          type: 'code-update',
          code: compiled
        }));
        pushBuilderLog('info', 'Code successfully compiled and sent');
      } catch (err: any) {
        console.error('Compilation error:', err);
        pushBuilderLog('error', `Compilation error: ${err.message} `);
      }
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      sendCodeUpdate();
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [files]);


  const themeColors = currentSettings.theme === 'dark' ? {
    bg: '#1e1e1e', bgSecondary: '#252526', bgTertiary: '#2d2d30', bgPrimary: '#007acc',
    border: '#3e3e42', text: '#d4d4d4', textSecondary: '#858585'
  } : {
    bg: '#ffffff', bgSecondary: '#f3f4f6', bgTertiary: '#e5e7eb', bgPrimary: '#3b82f6',
    border: '#d1d5db',
    text: '#111827', textSecondary: '#6b7280'
  };

  return (
    <div className="h-screen w-screen flex flex-col" style={{ backgroundColor: themeColors.bg, color: themeColors.text }}>
      <div className="h-14 flex items-center justify-between px-4" style={{ backgroundColor: themeColors.bgSecondary, borderBottom: `1px solid ${themeColors.border} ` }}>
        <div className="flex items-center gap-4">
          <button className="flex items-center gap-2 hover:opacity-80 transition-opacity" style={{ color: themeColors.textSecondary }}>
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back</span>
          </button>
          <div className="h-6 w-px" style={{ backgroundColor: themeColors.border }}></div>
          <h1 className="text-sm font-medium">React Native Playground</h1>
        </div>
        <div className="flex items-center gap-3">
          {currentSettings.autoSave && lastSaved && (
            <div className="text-xs" style={{ color: themeColors.textSecondary }}>
              Saved {lastSaved.toLocaleTimeString()}
            </div>
          )}
          <button onClick={() => setShowSettings(!showSettings)} className="w-9 h-9 flex items-center justify-center rounded hover:opacity-80 transition-opacity" style={{ color: themeColors.textSecondary }}>
            <SettingsIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-64 flex flex-col border-r" style={{ backgroundColor: themeColors.bgTertiary, borderColor: themeColors.border }}>
          <FileExplorer
            files={files}
            activeFile={activeFile}
            onFileSelect={setActiveFile}
            onCreateFile={handleCreateFile}
            onDeleteFile={handleDeleteFile}
            dependencies={dependencies}
            onAddDependency={handleAddDependency}
            onRemoveDependency={handleRemoveDependency}
          />
        </div>

        <PanelGroup id="main-editor-panel-group" direction="horizontal" className="flex-1">
          <Panel defaultSize={60} minSize={30}>
            <div className="h-full flex flex-col" style={{ backgroundColor: themeColors.bg }}>
              <div className="px-4 py-2 flex items-center justify-between text-sm" style={{ backgroundColor: themeColors.bgSecondary, borderBottom: `1px solid ${themeColors.border} ` }}>
                <span className="font-medium">{activeFile}</span>
                <div className="flex items-center gap-2">
                  <span style={{ color: themeColors.textSecondary }}>
                    Font: {currentSettings.fontSize}px
                  </span>
                </div>
              </div>
              <div className="flex-1 overflow-hidden">
                <MonacoPlayground
                  value={files[activeFile]?.content || ''}
                  onChange={handleCodeChange}
                  settings={currentSettings}
                  language={files[activeFile]?.language || 'typescript'}
                  dependencies={dependencies}
                />
              </div>
            </div>
          </Panel>
          <PanelResizeHandle className="w-1 hover:bg-blue-500 transition-colors cursor-col-resize" style={{ backgroundColor: themeColors.border }} />
          <Panel defaultSize={40} minSize={20} maxSize={50}>
            <div className="h-full flex flex-col" style={{ backgroundColor: themeColors.bgSecondary }}>
              <div className="px-4 py-2 flex items-center justify-between text-sm" style={{ backgroundColor: themeColors.bgSecondary, borderBottom: `1px solid ${themeColors.border} ` }}>
                <span className="font-medium">Preview</span>
                <div className="flex items-center gap-2">
                  {currentSettings.autoRefresh && (
                    <span className="text-xs px-2 py-0.5 rounded bg-green-600 text-white">
                      Auto Refresh
                    </span>
                  )}
                </div>
              </div>
              <div className="flex-1 overflow-hidden">
                <WebRTCViewer signalingUrl={workspaceUrl || ''} />
              </div>

              <div style={{ height: '30%', display: 'flex', flexDirection: 'column', borderTop: `1px solid ${themeColors.border} ` }}>
                <div style={{
                  display: 'flex',
                  gap: '8px',
                  padding: '8px 12px',
                  backgroundColor: themeColors.bgSecondary,
                  borderBottom: `1px solid ${themeColors.border} `
                }}>
                  <button
                    onClick={() => setActiveBottomTab('console')}
                    style={{
                      padding: '4px 12px',
                      fontSize: '12px',
                      backgroundColor: activeBottomTab === 'console' ? themeColors.bgPrimary : 'transparent',
                      color: themeColors.text,
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    Console
                  </button>
                  <button
                    onClick={() => setActiveBottomTab('terminal')}
                    style={{
                      padding: '4px 12px',
                      fontSize: '12px',
                      backgroundColor: activeBottomTab === 'terminal' ? themeColors.bgPrimary : 'transparent',
                      color: themeColors.text,
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    Terminal
                  </button>
                </div>

                <div style={{ flex: 1, overflow: 'hidden' }}>
                  {activeBottomTab === 'console' ? (
                    <ConsolePanel
                      logs={logs}
                      builderLogs={builderLogs}
                      onClearLogs={() => setLogs([])}
                      onClearBuilderLogs={() => setBuilderLogs([])}
                    />
                  ) : (
                    <TerminalPanel terminalUrl={workspaceUrl || undefined} />
                  )}
                </div>
              </div>
            </div>
          </Panel>
        </PanelGroup>
      </div>
      <SettingsPanel
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        initialSettings={currentSettings}
        onSave={handleSaveSettings}
      />
      {workspaceStatus !== 'ready' && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-white font-medium text-lg">
            {workspaceStatus === 'provisioning' ? 'Provisioning your private workspace...' : 'Failed to start workspace.'}
          </p>
          {workspaceStatus === 'error' && (
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              Retry
            </button>
          )}
        </div>
      )}
    </div>
  );
}
