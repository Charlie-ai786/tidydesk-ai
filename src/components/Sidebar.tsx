import React from 'react';
import { useAppStore } from '../store/appStore';
import type { AppView } from '../types';

const NAV_ITEMS: { view: AppView; icon: string; label: string }[] = [
  { view: 'dashboard', icon: '⊡', label: 'Dashboard' },
  { view: 'scanner', icon: '⌕', label: 'File Scanner' },
  { view: 'suggestions', icon: '✦', label: 'AI Suggestions' },
  { view: 'history', icon: '⟳', label: 'History & Undo' },
  { view: 'settings', icon: '⚙', label: 'Settings' },
];

export const Sidebar: React.FC = () => {
  const { currentView, setView, ollamaStatus, selectedFolder, scannedFiles, suggestions } = useAppStore();

  return (
    <aside className="sidebar z-20">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-sm font-bold shadow-lg shadow-emerald-500/20">
          T
        </div>
        <div>
          <div className="text-sm font-bold text-slate-100 leading-tight">TidyDesk AI</div>
          <div className="text-[10px] text-slate-500 leading-tight">File Organizer</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 overflow-y-auto">
        <div className="sidebar-section-label">Navigation</div>
        {NAV_ITEMS.map(item => (
          <button
            key={item.view}
            onClick={() => setView(item.view)}
            className={`nav-item w-full text-left ${currentView === item.view ? 'active' : ''}`}
            aria-current={currentView === item.view ? 'page' : undefined}
          >
            <span className="nav-icon w-5 text-center">{item.icon}</span>
            <span>{item.label}</span>
            {item.view === 'scanner' && scannedFiles.length > 0 && (
              <span className="ml-auto badge-slate text-[10px] px-1.5 py-0.5 rounded">{scannedFiles.length}</span>
            )}
            {item.view === 'suggestions' && suggestions.length > 0 && (
              <span className="ml-auto badge-emerald text-[10px] px-1.5 py-0.5 rounded">{suggestions.filter(s => s.selected && s.status === 'pending').length}</span>
            )}
          </button>
        ))}
      </nav>

      {/* Status Panel */}
      <div className="border-t border-slate-800/60 p-4 space-y-2">
        {/* Ollama status */}
        <div className="flex items-center gap-2 text-xs">
          <span className={`status-dot ${ollamaStatus.running ? 'online' : 'offline'}`} />
          <span className="text-slate-500">Ollama</span>
          <span className={`ml-auto font-medium ${ollamaStatus.running ? 'text-emerald-400' : 'text-slate-600'}`}>
            {ollamaStatus.running ? 'Running' : 'Offline'}
          </span>
        </div>

        {/* Selected folder */}
        {selectedFolder && (
          <div className="text-[10px] text-slate-600 truncate" title={selectedFolder}>
            📁 {selectedFolder.split(/[\\/]/).pop()}
          </div>
        )}

        {/* Version */}
        <div className="text-[10px] text-slate-700 pt-1 border-t border-slate-800/40">
          TidyDesk AI v1.0.0 · Open Source
        </div>
      </div>
    </aside>
  );
};
