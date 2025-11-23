import React, { useMemo, useState } from 'react';

export type LogLevel = 'log' | 'info' | 'warn' | 'error';
export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
}

interface ConsolePanelProps {
  logs: LogEntry[];
  builderLogs: LogEntry[];
  onClearLogs: () => void;
  onClearBuilderLogs: () => void;
}

export default function ConsolePanel({
  logs,
  builderLogs,
  onClearLogs,
  onClearBuilderLogs,
}: ConsolePanelProps) {
  const [tab, setTab] = useState<'console' | 'builder'>('console');
  const [level, setLevel] = useState<'all' | LogLevel>('all');
  const [query, setQuery] = useState('');

  const tabStyles = (active: boolean) =>
    `px-3 py-1 text-xs font-medium rounded ${active ? 'bg-[#2d2d30] text-white' : 'text-gray-300 hover:text-white'}`;

  const colorClass = (lvl: LogLevel) =>
    ({ log: 'text-gray-200', info: 'text-blue-300', warn: 'text-yellow-300', error: 'text-red-300' }[lvl]);

  const active = tab === 'console' ? logs : builderLogs;
  const filtered = useMemo(() => {
    return active.filter(l => (level === 'all' || l.level === level) && (!query || l.message.toLowerCase().includes(query.toLowerCase())));
  }, [active, level, query]);

  return (
    <div className="bg-[#1e1e1e] text-[12px] text-white font-mono border-t border-[#3e3e42] h-64 flex flex-col">
      <div className="flex items-center justify-between px-2 py-1 border-b border-[#3e3e42]">
        <div className="flex items-center gap-2">
          <button className={tabStyles(tab === 'console')} onClick={() => setTab('console')}>CONSOLE</button>
          <button className={tabStyles(tab === 'builder')} onClick={() => setTab('builder')}>BUILDER LOGS</button>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="bg-[#1e1e1e] border border-[#3e3e42] rounded px-2 py-1 text-xs text-gray-300"
            value={level}
            onChange={e => setLevel(e.target.value as any)}
          >
            <option value="all">All</option>
            <option value="log">Log</option>
            <option value="info">Info</option>
            <option value="warn">Warn</option>
            <option value="error">Error</option>
          </select>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Filter..."
            className="bg-[#1e1e1e] border border-[#3e3e42] rounded px-2 py-1 text-xs text-gray-300 w-40"
          />
          <button
            className="text-red-400 hover:text-red-500 text-xs"
            onClick={() => (tab === 'console' ? onClearLogs() : onClearBuilderLogs())}
          >
            Clear
          </button>
        </div>
      </div>
      <div className="overflow-y-auto px-3 py-2 flex-1 space-y-1">
        {filtered.length === 0 && (
          <div className="text-gray-400">No logs</div>
        )}
        {filtered.map((log, i) => (
          <div key={i} className={colorClass(log.level)}>
            [{log.timestamp.toLocaleTimeString()}] {log.message}
          </div>
        ))}
      </div>
    </div>
  );
}
