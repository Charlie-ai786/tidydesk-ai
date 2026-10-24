import React, { useState } from 'react';
import { useAppStore } from '../store/appStore';

const RECOMMENDED_MODELS = [
  { id: 'qwen2.5:3b', label: 'Qwen 2.5 3B', size: '~2 GB', notes: 'Fast, recommended for most hardware' },
  { id: 'qwen2.5:7b', label: 'Qwen 2.5 7B', size: '~4.7 GB', notes: 'Better accuracy, needs 8 GB RAM' },
  { id: 'gemma3:4b', label: 'Gemma 3 4B', size: '~3 GB', notes: 'Google open-weight, good accuracy' },
  { id: 'llama3.2:3b', label: 'Llama 3.2 3B', size: '~2 GB', notes: 'Meta open-weight, lightweight' },
];

export const Settings: React.FC = () => {
  const { settings, updateSettings, ollamaStatus, checkOllama } = useAppStore();
  const [checking, setChecking] = useState(false);

  const handleCheckOllama = async () => {
    setChecking(true);
    await checkOllama();
    setChecking(false);
  };

  return (
    <div className="min-h-screen animate-fade-in">
      <div className="page-header">
        <h1 className="text-lg font-semibold text-slate-100">Settings</h1>
      </div>

      <div className="page-body space-y-6 max-w-2xl">
        {/* AI / Ollama */}
        <div className="card">
          <div className="card-header">
            <h2 className="font-semibold text-slate-200">🤖 AI Runtime (Ollama)</h2>
            <div className="flex items-center gap-2">
              <span className={`status-dot ${ollamaStatus.running ? 'online' : 'offline'}`} />
              <span className={`text-xs ${ollamaStatus.running ? 'text-emerald-400' : 'text-rose-400'}`}>
                {ollamaStatus.running ? 'Connected' : 'Not running'}
              </span>
            </div>
          </div>
          <div className="card-body space-y-4">
            <div>
              <label className="label">Ollama Base URL</label>
              <input
                type="text"
                value={settings.ollamaBaseUrl}
                onChange={e => updateSettings({ ollamaBaseUrl: e.target.value })}
                className="input"
                placeholder="http://localhost:11434"
                id="setting-ollama-url"
              />
            </div>

            <div>
              <label className="label">Active Model</label>
              <input
                type="text"
                value={settings.selectedModel}
                onChange={e => updateSettings({ selectedModel: e.target.value })}
                className="input font-mono"
                placeholder="qwen2.5:3b"
                id="setting-model"
              />
              {ollamaStatus.running && ollamaStatus.models.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {ollamaStatus.models.map(m => (
                    <button
                      key={m}
                      onClick={() => updateSettings({ selectedModel: m })}
                      className={`badge cursor-pointer transition-all ${settings.selectedModel === m ? 'badge-emerald border border-emerald-500/40' : 'badge-slate hover:bg-slate-600/60'}`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={handleCheckOllama}
              disabled={checking}
              className="btn-secondary btn-sm"
              id="btn-check-ollama"
            >
              {checking ? '⟳ Checking…' : '⟳ Test Connection'}
            </button>

            {/* Recommended models */}
            <div className="border-t border-slate-800/50 pt-4">
              <div className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wide">
                Recommended Models
              </div>
              <div className="space-y-2">
                {RECOMMENDED_MODELS.map(m => (
                  <div key={m.id} className={`flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer
                    ${settings.selectedModel === m.id ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-slate-800/60 hover:border-slate-700/60'}`}
                    onClick={() => updateSettings({ selectedModel: m.id })}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-200">{m.label}</span>
                        <span className="badge-slate text-[10px]">{m.size}</span>
                        {settings.selectedModel === m.id && <span className="badge-emerald text-[10px]">Active</span>}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">{m.notes}</div>
                    </div>
                    <div className="text-xs font-mono text-slate-600">{m.id}</div>
                  </div>
                ))}
              </div>

              {/* Pull command */}
              {!ollamaStatus.models.includes(settings.selectedModel) && settings.selectedModel && (
                <div className="mt-3 p-3 rounded-lg bg-slate-900/50 border border-slate-800/50">
                  <div className="text-xs text-slate-400 mb-1.5">Pull this model with:</div>
                  <code className="text-xs text-emerald-400 font-mono">
                    ollama pull {settings.selectedModel}
                  </code>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Scanner Settings */}
        <div className="card">
          <div className="card-header">
            <h2 className="font-semibold text-slate-200">⌕ Scanner Defaults</h2>
          </div>
          <div className="card-body space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Max Scan Depth</label>
                <input
                  type="number"
                  min={1} max={20}
                  value={settings.scanDepth}
                  onChange={e => updateSettings({ scanDepth: +e.target.value })}
                  className="input"
                  id="setting-scan-depth"
                />
                <p className="text-[11px] text-slate-600 mt-1">How many folder levels to descend (1–20)</p>
              </div>
              <div className="space-y-2 pt-5">
                <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.includeSubfolders}
                    onChange={e => updateSettings({ includeSubfolders: e.target.checked })}
                    className="accent-emerald-500 w-4 h-4"
                    id="setting-include-subfolders"
                  />
                  Include subfolders by default
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.includeHidden}
                    onChange={e => updateSettings({ includeHidden: e.target.checked })}
                    className="accent-emerald-500 w-4 h-4"
                    id="setting-include-hidden"
                  />
                  Include hidden files
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Appearance */}
        <div className="card">
          <div className="card-header">
            <h2 className="font-semibold text-slate-200">🎨 Appearance</h2>
          </div>
          <div className="card-body">
            <div>
              <label className="label">Theme</label>
              <div className="flex gap-2">
                {(['dark', 'light'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => updateSettings({ theme: t })}
                    className={`btn-sm capitalize ${settings.theme === t ? 'btn-primary' : 'btn-secondary'}`}
                  >
                    {t === 'dark' ? '🌙 Dark' : '☀ Light'}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-slate-600 mt-2">Light theme coming in a future update.</p>
            </div>
          </div>
        </div>

        {/* About */}
        <div className="card">
          <div className="card-header">
            <h2 className="font-semibold text-slate-200">ℹ About TidyDesk AI</h2>
          </div>
          <div className="card-body space-y-2 text-sm text-slate-400">
            <div className="flex justify-between"><span>Version</span><span className="text-slate-300">1.0.0</span></div>
            <div className="flex justify-between"><span>License</span><span className="text-slate-300">MIT</span></div>
            <div className="flex justify-between"><span>Built with</span><span className="text-slate-300">Electron · React · TypeScript · Ollama</span></div>
            <div className="flex justify-between"><span>AI Runtime</span><span className="text-slate-300">Ollama (local, open-weight models)</span></div>
            <div className="flex justify-between"><span>Hacktoberfest</span><span className="text-slate-300">Week 3 — Slow and Steady</span></div>
            <div className="border-t border-slate-800/50 pt-2 text-xs text-slate-600">
              TidyDesk AI is open source and privacy-first. No telemetry, no cloud, no file uploads.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
