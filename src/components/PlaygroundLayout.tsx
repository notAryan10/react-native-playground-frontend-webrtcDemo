'use client';

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { SettingsPanel, Settings } from './SettingsPanel';
import ConsolePanel, { LogEntry, LogLevel } from './ConsolePanel';
import { ArrowLeft, Clock, Download, Settings as SettingsIcon, HelpCircle, FileText, Smartphone } from 'lucide-react';
import { WebRTCViewerProps } from './WebRTCViewer';
import { MonacoPlaygroundProps } from './MonacoPlayground';
import { FileExplorer, File } from './FileExplorer';
import * as Babel from '@babel/standalone';
import TerminalPanel from './TerminalPanel';
import { QRCodeSVG } from 'qrcode.react';

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
  const [userId, setUserId] = useState<string>('');
  const [showPairingModal, setShowPairingModal] = useState(false);
  const [pairingModalTab, setPairingModalTab] = useState<'pair' | 'download'>('pair');
  const isSyncingFromBackend = useRef(false);

  // The Orchestrator URL:
  // 1. First choice: Environment Variable (set this in Vercel!)
  // 2. Fallback: Localhost (for development)
  const orchestratorUrl = process.env.NEXT_PUBLIC_ORCHESTRATOR_URL || '';
  useEffect(() => {
    const savedId = localStorage.getItem('playground-user-id');
    if (savedId) {
      setUserId(savedId);
    } else {
      const newId = `user-${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('playground-user-id', newId);
      setUserId(newId);
    }
  }, []);

  const [showSettings, setShowSettings] = useState(false);
  const [activeBottomTab, setActiveBottomTab] = useState<'console' | 'terminal'>('console');
  
  useEffect(() => {
    if (!userId) return;

    const provisionWorkspace = async () => {
      setWorkspaceStatus('provisioning');
      try {
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
    orchestratorUrl: orchestratorUrl,
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
    let finalFiles = files;
    let finalDeps = dependencies;

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
          finalFiles = migrated;
          setActiveFile('src/App.tsx');
        } else {
          finalFiles = parsed;
        }
      } catch (e) {
        console.error('Failed to parse saved files', e);
      }
    }

    const savedDeps = localStorage.getItem('playground-deps');
    if (savedDeps) {
      try {
        finalDeps = JSON.parse(savedDeps);
        setDependencies(finalDeps);
      } catch (e) {
        console.error('Failed to parse saved dependencies', e);
      }
    }

    // Sync package.json content with loaded dependencies
    if (finalFiles['package.json']) {
      try {
        const pkg = JSON.parse(finalFiles['package.json'].content);
        pkg.dependencies = {
          ...(pkg.dependencies || {}),
          ...finalDeps
        };
        // Clean up any leading spaces (like the one reported by the user)
        const cleanDeps: Record<string, string> = {};
        Object.entries(pkg.dependencies as Record<string, string>).forEach(([k, v]) => {
          cleanDeps[k.trim()] = v;
        });
        pkg.dependencies = cleanDeps;
        
        finalFiles['package.json'] = {
          ...finalFiles['package.json'],
          content: JSON.stringify(pkg, null, 2)
        };
      } catch (e) {
        console.error('Failed to sync package.json on load', e);
      }
    }

    setFiles(finalFiles);

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
    const cleanName = name.trim();
    setDependencies((prev: any) => {
      const newDeps = { ...prev, [cleanName]: version };
      
      // Also update package.json in files state for UI consistency
      setFiles(prevFiles => {
        if (prevFiles['package.json']) {
          try {
            const pkg = JSON.parse(prevFiles['package.json'].content);
            pkg.dependencies = {
              ...(pkg.dependencies || {}),
              ...newDeps
            };
            return {
              ...prevFiles,
              'package.json': {
                ...prevFiles['package.json'],
                content: JSON.stringify(pkg, null, 2)
              }
            };
          } catch (e) {
            console.error('Failed to update package.json file content', e);
          }
        }
        return prevFiles;
      });
      
      return newDeps;
    });
    pushBuilderLog('info', `Added dependency: ${cleanName} @${version} `);
  };

  const handleRemoveDependency = (name: string) => {
    setDependencies((prev: any) => {
      const newDeps = { ...prev };
      delete newDeps[name];

      // Also update package.json in files state for UI consistency
      setFiles(prevFiles => {
        if (prevFiles['package.json']) {
          try {
            const pkg = JSON.parse(prevFiles['package.json'].content);
            if (pkg.dependencies) {
              delete pkg.dependencies[name];
            }
            return {
              ...prevFiles,
              'package.json': {
                ...prevFiles['package.json'],
                content: JSON.stringify(pkg, null, 2)
              }
            };
          } catch (e) {
            console.error('Failed to update package.json file content', e);
          }
        }
        return prevFiles;
      });

      return newDeps;
    });
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
      sendFileSync();
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'fs-sync') {
          isSyncingFromBackend.current = true;
          setFiles(prev => {
            const newFiles = { ...data.files };
            let hasChanged = false;
            
            // Check if backend has new/changed files
            Object.keys(newFiles).forEach(path => {
              if (!prev[path] || prev[path].content !== newFiles[path].content) {
                hasChanged = true;
              }
            });

            // Check if backend has deleted files
            Object.keys(prev).forEach(path => {
              if (!newFiles[path]) {
                hasChanged = true;
              }
            });

            if (!hasChanged) return prev;
            return newFiles;
          });
          setTimeout(() => { isSyncingFromBackend.current = false; }, 5000);
        }
      } catch (e) {
        console.error('Error parsing signaling message', e);
      }
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

  const sendFileSync = (specificFile?: string) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      if (specificFile && files[specificFile]) {
        console.log(`Syncing ${specificFile} to workspace...`);
        const fileData = files[specificFile];
        
        // If syncing package.json, ensure dependencies are included
        let content = fileData.content;
        if (specificFile === 'package.json') {
          try {
            const pkg = JSON.parse(content);
            pkg.dependencies = { ...(pkg.dependencies || {}), ...dependencies };
            content = JSON.stringify(pkg, null, 2);
          } catch (e) {}
        }

        ws.send(JSON.stringify({
          type: 'file-update',
          files: { [specificFile]: { ...fileData, content } }
        }));
        return;
      }

      console.log('Syncing all files to workspace...');
      const updatedFiles = { ...files };
      if (updatedFiles['package.json']) {
        try {
          const pkg = JSON.parse(updatedFiles['package.json'].content);
          pkg.dependencies = { ...(pkg.dependencies || {}), ...dependencies };
          updatedFiles['package.json'] = {
            ...updatedFiles['package.json'],
            content: JSON.stringify(pkg, null, 2)
          };
        } catch (e) {}
      }

      ws.send(JSON.stringify({
        type: 'file-update',
        files: updatedFiles
      }));
    }
  };

  useEffect(() => {
    if (isSyncingFromBackend.current) return;
    
    // Fast update for mobile preview
    const codeTimeout = setTimeout(() => {
      sendCodeUpdate();
    }, 300);

    // Slower update for disk persistence
    const fileTimeout = setTimeout(() => {
      sendFileSync(activeFile);
    }, 1000);

    return () => {
      clearTimeout(codeTimeout);
      clearTimeout(fileTimeout);
    };
  }, [files, dependencies, activeFile]);


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
          <div className="h-6 w-px" style={{ backgroundColor: themeColors.border }}></div>
          
          <button 
            onClick={() => {
              setPairingModalTab('pair');
              setShowPairingModal(true);
            }}
            className="flex items-center gap-2 px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 transition-colors text-white"
          >
            <Smartphone className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-tight">Pair Mobile</span>
          </button>

          <button 
            onClick={() => {
              setPairingModalTab('download');
              setShowPairingModal(true);
            }}
            className="flex items-center gap-2 px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 transition-colors text-white"
          >
            <Download className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-tight">Get APK</span>
          </button>
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
      
      {/* Pairing Modal */}
      {showPairingModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl p-8 max-w-sm w-full flex flex-col items-center gap-6 relative">
            <button 
              onClick={() => setShowPairingModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 p-1"
            >
              <ArrowLeft className="w-5 h-5 rotate-90" />
            </button>
            
            <div className="flex flex-col items-center gap-1 w-full">
              <h2 className="text-xl font-bold text-gray-900">Mobile Setup</h2>
              <div className="flex w-full bg-gray-100 rounded-lg p-1 mt-4">
                <button 
                  onClick={() => setPairingModalTab('pair')}
                  className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${pairingModalTab === 'pair' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Pair Device
                </button>
                <button 
                  onClick={() => setPairingModalTab('download')}
                  className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${pairingModalTab === 'download' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Download App
                </button>
              </div>
            </div>

            <div className="p-4 bg-white rounded-lg border-4 border-blue-500/10">
              {pairingModalTab === 'pair' ? (
                <QRCodeSVG 
                  value={JSON.stringify({ 
                    url: orchestratorUrl, 
                    id: userId 
                  })} 
                  size={200}
                />
              ) : (
                <QRCodeSVG 
                  value={process.env.NEXT_PUBLIC_APK_DOWNLOAD_URL || ""} 
                  size={200}
                />
              )}
            </div>

            <div className="flex flex-col items-center gap-2 w-full">
              {pairingModalTab === 'pair' ? (
                <>
                  <p className="text-sm text-gray-500 text-center mb-2">Scan to automatically connect your device</p>
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100 border border-gray-200 w-full justify-between">
                    <span className="text-[10px] uppercase font-bold text-gray-400">Workspace ID</span>
                    <span className="text-xs font-mono font-bold text-blue-600">{userId}</span>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-gray-500 text-center mb-2">Scan to download the Android APK</p>
                  <a 
                    href={process.env.NEXT_PUBLIC_APK_DOWNLOAD_URL || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-2 px-3 rounded-lg bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-100 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    <span className="text-xs font-bold">Open Download Link</span>
                  </a>
                </>
              )}

              <p className="text-[10px] text-gray-400 mt-4 italic text-center">
                {pairingModalTab === 'pair' 
                  ? "Make sure your phone is using mobile data if your local Wi-Fi has a firewall."
                  : "Scanning will take you to Google Drive to download the latest APK."}
              </p>
            </div>
            
            <button 
              onClick={() => setShowPairingModal(false)}
              className="w-full py-3 rounded-lg bg-gray-900 text-white font-bold text-sm hover:bg-black transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}

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
