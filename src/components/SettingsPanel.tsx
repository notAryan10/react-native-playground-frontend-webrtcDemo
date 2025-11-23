import React, { useState } from 'react';
interface Settings {
  fontSize: number;
  theme: 'light' | 'dark';
  lineNumbers: boolean;
  autoSave: boolean;
  formatOnSave: boolean;
  minimap: boolean;
  autoRefresh: boolean;
  showConsoleErrors: boolean;
}

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  initialSettings?: Partial<Settings>;
  onSave?: (settings: Settings) => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({
  isOpen,
  onClose,
  initialSettings = {},
  onSave
}) => {
  const [fontSize, setFontSize] = useState<number>(initialSettings.fontSize || 14);
  const [theme, setTheme] = useState<'light' | 'dark'>(initialSettings.theme || 'dark');
  const [lineNumbers, setLineNumbers] = useState<boolean>(initialSettings.lineNumbers !== undefined ? initialSettings.lineNumbers : true);
  const [autoSave, setAutoSave] = useState<boolean>(initialSettings.autoSave !== undefined ? initialSettings.autoSave : true);
  const [formatOnSave, setFormatOnSave] = useState<boolean>(initialSettings.formatOnSave || false);
  const [minimap, setMinimap] = useState<boolean>(initialSettings.minimap || false);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(initialSettings.autoRefresh !== undefined ? initialSettings.autoRefresh : true);
  const [showConsoleErrors, setShowConsoleErrors] = useState<boolean>(initialSettings.showConsoleErrors !== undefined ? initialSettings.showConsoleErrors : true);

  const fontSizes = [12, 14, 16, 18, 20, 22];

  const handleSave = () => {
    const settings: Settings = {
      fontSize,
      theme,
      lineNumbers,
      autoSave,
      formatOnSave,
      minimap,
      autoRefresh,
      showConsoleErrors
    };

    if (onSave) {
      onSave(settings);
    }

    onClose();
  };

  const handleCancel = () => {
    setFontSize(initialSettings.fontSize || 14);
    setTheme(initialSettings.theme || 'dark');
    setLineNumbers(initialSettings.lineNumbers !== undefined ? initialSettings.lineNumbers : true);
    setAutoSave(initialSettings.autoSave !== undefined ? initialSettings.autoSave : true);
    setFormatOnSave(initialSettings.formatOnSave || false);
    setMinimap(initialSettings.minimap || false);
    setAutoRefresh(initialSettings.autoRefresh !== undefined ? initialSettings.autoRefresh : true);
    setShowConsoleErrors(initialSettings.showConsoleErrors !== undefined ? initialSettings.showConsoleErrors : true);

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-[#252526] rounded-lg shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden border border-[#3e3e42]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#3e3e42]">
          <h2 className="text-lg font-semibold text-white">Configuration</h2>
          <button
            onClick={handleCancel}
            className="p-1 hover:bg-[#2d2d30] rounded transition-colors"
          >
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6 space-y-8 overflow-auto max-h-[calc(80vh-140px)]">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Editor Font Size
            </label>
            <div className="relative">
              <select
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                className="w-full bg-[#1e1e1e] border border-[#3e3e42] rounded-lg px-4 py-3 text-white appearance-none cursor-pointer hover:border-[#4e4e52] focus:outline-none focus:border-blue-500 transition-colors"
              >
                {fontSizes.map(size => (
                  <option key={size} value={size}>{size}px</option>
                ))}
              </select>
              <svg className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Theme
            </label>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setTheme('light')}
                className={`relative rounded-lg overflow-hidden border-2 transition-all ${theme === 'light'
                    ? 'border-blue-500 ring-2 ring-blue-500 ring-opacity-50'
                    : 'border-[#3e3e42] hover:border-[#4e4e52]'
                  }`}
              >
                <div className="aspect-video bg-white p-3">
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-400"></div>
                      <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                      <div className="w-3 h-3 rounded-full bg-green-400"></div>
                    </div>
                    <div className="space-y-1">
                      <div className="h-2 bg-gray-300 rounded w-3/4"></div>
                      <div className="h-2 bg-blue-400 rounded w-1/2"></div>
                      <div className="h-2 bg-gray-300 rounded w-2/3"></div>
                    </div>
                  </div>
                </div>
                {theme === 'light' && (
                  <div className="absolute top-2 right-2 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </button>
              <button
                onClick={() => setTheme('dark')}
                className={`relative rounded-lg overflow-hidden border-2 transition-all ${theme === 'dark'
                    ? 'border-blue-500 ring-2 ring-blue-500 ring-opacity-50'
                    : 'border-[#3e3e42] hover:border-[#4e4e52]'
                  }`}
              >
                <div className="aspect-video bg-[#1e1e1e] p-3">
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-400"></div>
                      <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                      <div className="w-3 h-3 rounded-full bg-green-400"></div>
                    </div>
                    <div className="space-y-1">
                      <div className="h-2 bg-gray-700 rounded w-3/4"></div>
                      <div className="h-2 bg-blue-500 rounded w-1/2"></div>
                      <div className="h-2 bg-gray-700 rounded w-2/3"></div>
                    </div>
                  </div>
                </div>
                {theme === 'dark' && (
                  <div className="absolute top-2 right-2 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </button>
            </div>
          </div>
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-300">Editor Options</h3>

            <label className="flex items-center justify-between cursor-pointer group">
              <span className="text-sm text-gray-400 group-hover:text-gray-300 transition-colors">Line Numbers</span>
              <div className="relative">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={lineNumbers}
                  onChange={(e) => setLineNumbers(e.target.checked)}
                />
                <div className="w-11 h-6 bg-[#3e3e42] rounded-full peer peer-checked:bg-blue-600 transition-colors"></div>
                <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5"></div>
              </div>
            </label>

            <label className="flex items-center justify-between cursor-pointer group">
              <span className="text-sm text-gray-400 group-hover:text-gray-300 transition-colors">Auto Save</span>
              <div className="relative">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={autoSave}
                  onChange={(e) => setAutoSave(e.target.checked)}
                />
                <div className="w-11 h-6 bg-[#3e3e42] rounded-full peer peer-checked:bg-blue-600 transition-colors"></div>
                <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5"></div>
              </div>
            </label>

            <label className="flex items-center justify-between cursor-pointer group">
              <span className="text-sm text-gray-400 group-hover:text-gray-300 transition-colors">Format on Save</span>
              <div className="relative">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={formatOnSave}
                  onChange={(e) => setFormatOnSave(e.target.checked)}
                />
                <div className="w-11 h-6 bg-[#3e3e42] rounded-full peer peer-checked:bg-blue-600 transition-colors"></div>
                <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5"></div>
              </div>
            </label>

            <label className="flex items-center justify-between cursor-pointer group">
              <span className="text-sm text-gray-400 group-hover:text-gray-300 transition-colors">Minimap</span>
              <div className="relative">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={minimap}
                  onChange={(e) => setMinimap(e.target.checked)}
                />
                <div className="w-11 h-6 bg-[#3e3e42] rounded-full peer peer-checked:bg-blue-600 transition-colors"></div>
                <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5"></div>
              </div>
            </label>
          </div>
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-300">Preview Options</h3>

            <label className="flex items-center justify-between cursor-pointer group">
              <span className="text-sm text-gray-400 group-hover:text-gray-300 transition-colors">Auto Refresh</span>
              <div className="relative">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                />
                <div className="w-11 h-6 bg-[#3e3e42] rounded-full peer peer-checked:bg-blue-600 transition-colors"></div>
                <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5"></div>
              </div>
            </label>

            <label className="flex items-center justify-between cursor-pointer group">
              <span className="text-sm text-gray-400 group-hover:text-gray-300 transition-colors">Show Console Errors</span>
              <div className="relative">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={showConsoleErrors}
                  onChange={(e) => setShowConsoleErrors(e.target.checked)}
                />
                <div className="w-11 h-6 bg-[#3e3e42] rounded-full peer peer-checked:bg-blue-600 transition-colors"></div>
                <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5"></div>
              </div>
            </label>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#3e3e42] bg-[#1e1e1e]">
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded font-medium transition-colors"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};
export default function SettingsPanelDemo() {
  const [showSettings, setShowSettings] = useState(false);
  const [currentSettings, setCurrentSettings] = useState<Settings>({
    fontSize: 14,
    theme: 'dark',
    lineNumbers: true,
    autoSave: true,
    formatOnSave: false,
    minimap: false,
    autoRefresh: true,
    showConsoleErrors: true
  });

  const handleSaveSettings = (newSettings: Settings) => {
    setCurrentSettings(newSettings);
    console.log('Settings saved:', newSettings);
  };

  return (
    <div className="min-h-screen bg-[#1e1e1e] text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Settings Panel Component Demo</h1>

        <div className="bg-[#252526] rounded-lg p-6 mb-6 border border-[#3e3e42]">
          <h2 className="text-xl font-semibold mb-4">Current Settings</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-400">Font Size:</span>
              <span className="ml-2 text-white">{currentSettings.fontSize}px</span>
            </div>
            <div>
              <span className="text-gray-400">Theme:</span>
              <span className="ml-2 text-white capitalize">{currentSettings.theme}</span>
            </div>
            <div>
              <span className="text-gray-400">Line Numbers:</span>
              <span className="ml-2 text-white">{currentSettings.lineNumbers ? 'On' : 'Off'}</span>
            </div>
            <div>
              <span className="text-gray-400">Auto Save:</span>
              <span className="ml-2 text-white">{currentSettings.autoSave ? 'On' : 'Off'}</span>
            </div>
            <div>
              <span className="text-gray-400">Format on Save:</span>
              <span className="ml-2 text-white">{currentSettings.formatOnSave ? 'On' : 'Off'}</span>
            </div>
            <div>
              <span className="text-gray-400">Minimap:</span>
              <span className="ml-2 text-white">{currentSettings.minimap ? 'On' : 'Off'}</span>
            </div>
            <div>
              <span className="text-gray-400">Auto Refresh:</span>
              <span className="ml-2 text-white">{currentSettings.autoRefresh ? 'On' : 'Off'}</span>
            </div>
            <div>
              <span className="text-gray-400">Console Errors:</span>
              <span className="ml-2 text-white">{currentSettings.showConsoleErrors ? 'On' : 'Off'}</span>
            </div>
          </div>
        </div>

        <button
          onClick={() => setShowSettings(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-medium transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Open Settings
        </button>

        <SettingsPanel
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          initialSettings={currentSettings}
          onSave={handleSaveSettings}
        />
      </div>
    </div>
  );
}
export { SettingsPanel };
export type { Settings, SettingsPanelProps };