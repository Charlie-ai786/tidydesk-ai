import React from 'react';
import { useAppStore } from '../store/appStore';

export const Dashboard: React.FC = () => {
  const {
    setView, selectFolder, selectedFolder, ollamaStatus,
    scannedFiles, suggestions, history, checkOllama, settings
  } = useAppStore();

  React.useEffect(() => { checkOllama(); }, [checkOllama]);

  const approvedCount = suggestions.filter(s => s.selected && s.status === 'pending').length;
  const appliedCount  = suggestions.filter(s => s.status === 'applied').length;
  const successOps    = history.filter(h => h.status === 'success').length;

  return (
    <div className="min-h-screen animate-fade-in">
      {/* Hero */}
      <div className="page-header">
        <div className="flex-1">
          <h1 className="text-lg font-semibold text-slate-100">Dashboard</h1>
        </div>
        <button onClick={checkOllama} className="btn-ghost btn-sm" title="Refresh Ollama status">
          ⟳ Refresh
        </button>
      </div>

      <div className="page-body space-y-8">
        {/* Hero section */}
        <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-[#161b22] via-[#161b22] to-[#0d1f1a] border border-slate-800/60 p-8">
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
          <div className="relative">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-emerald-400 mb-3">
              TidyDesk AI · Privacy-First File Organizer
            </div>
            <h2 className="text-3xl font-bold text-slate-100 leading-tight mb-2">
              Your files are a mess.
              <span className="text-gradient"> Let's fix that.</span>
            </h2>
            <p className="text-slate-400 text-base max-w-lg leading-relaxed mb-6">
              Scan a folder, review the AI-generated plan, and organize your files in a few clicks.
              All processing stays on your machine.
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={selectFolder}
                className="btn-primary btn-lg"
                id="btn-select-folder"
              >
                📁 Select Folder
              </button>
              {selectedFolder && (
                <button onClick={() => setView('scanner')} className="btn-secondary btn-lg">
                  ⌕ View Scanner
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-4">
          <div className="stat-card">
            <div className="stat-value">{scannedFiles.length}</div>
            <div className="stat-label">Files Scanned</div>
            <div className="text-[11px] text-slate-600 mt-1">
              {selectedFolder ? `in ${selectedFolder.split(/[\\/]/).pop()}` : 'No folder selected'}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-value text-emerald-400">{suggestions.length}</div>
            <div className="stat-label">AI Suggestions</div>
            <div className="text-[11px] text-slate-600 mt-1">
              {suggestions.filter(s => s.suggestion.source === 'ai').length} from AI,{' '}
              {suggestions.filter(s => s.suggestion.source === 'rule').length} by rules
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-value text-blue-400">{approvedCount}</div>
            <div className="stat-label">Pending Approval</div>
            <div className="text-[11px] text-slate-600 mt-1">
              {appliedCount} already applied
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-value text-teal-400">{successOps}</div>
            <div className="stat-label">Total Organized</div>
            <div className="text-[11px] text-slate-600 mt-1">across all sessions</div>
          </div>
        </div>

        {/* Workflow Steps */}
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-slate-200">How It Works</h3>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-4 gap-4">
              {[
                { step: '1', icon: '📁', title: 'Select Folder', desc: 'Choose any folder on your system using the native picker.', done: !!selectedFolder },
                { step: '2', icon: '⌕', title: 'Scan Files', desc: 'The app scans files, reads metadata, and extracts text previews.', done: scannedFiles.length > 0 },
                { step: '3', icon: '✦', title: 'AI Analysis', desc: 'Local AI (Ollama) classifies files and suggests organized names.', done: suggestions.length > 0 },
                { step: '4', icon: '✓', title: 'Review & Apply', desc: 'You approve the plan. Files are moved only after your confirmation.', done: appliedCount > 0 },
              ].map(({ step, icon, title, desc, done }) => (
                <div key={step} className={`relative p-4 rounded-xl border transition-all ${done ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-slate-800/60 bg-slate-800/20'}`}>
                  {done && (
                    <div className="absolute top-3 right-3 w-5 h-5 bg-emerald-500/20 rounded-full flex items-center justify-center">
                      <span className="text-emerald-400 text-[10px]">✓</span>
                    </div>
                  )}
                  <div className="text-2xl mb-2">{icon}</div>
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Step {step}</div>
                  <div className="font-semibold text-slate-200 text-sm mb-1">{title}</div>
                  <div className="text-xs text-slate-500 leading-relaxed">{desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Ollama status card */}
        <div className={`card border ${ollamaStatus.running ? 'border-emerald-500/20' : 'border-amber-500/20'}`}>
          <div className="card-body flex items-start gap-4">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl flex-shrink-0 ${ollamaStatus.running ? 'bg-emerald-500/10' : 'bg-amber-500/10'}`}>
              🤖
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-semibold text-slate-200">Local AI Runtime (Ollama)</h4>
                <span className={`status-dot ${ollamaStatus.running ? 'online' : 'offline'}`} />
                <span className={`text-xs font-medium ${ollamaStatus.running ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {ollamaStatus.running ? 'Connected' : 'Not detected'}
                </span>
              </div>
              {ollamaStatus.running ? (
                <div>
                  <p className="text-sm text-slate-400 mb-2">
                    {ollamaStatus.models.length} model{ollamaStatus.models.length !== 1 ? 's' : ''} available locally.
                    Selected: <span className="text-emerald-400 font-mono text-xs">{settings.selectedModel}</span>
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {ollamaStatus.models.slice(0, 8).map(m => (
                      <span key={m} className="badge-slate mono text-[10px]">{m}</span>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-slate-400 mb-3">
                    Ollama is not running. File organization still works with deterministic rules —
                    but AI-powered classification needs Ollama.
                  </p>
                  <div className="bg-slate-900/60 rounded-lg p-3 border border-slate-800/60">
                    <div className="text-xs font-semibold text-slate-400 mb-2">Quick Setup</div>
                    <div className="space-y-1 font-mono text-xs text-slate-400">
                      <div><span className="text-slate-600"># 1. Install Ollama from</span></div>
                      <div className="text-blue-400">https://ollama.com/download</div>
                      <div className="mt-2"><span className="text-slate-600"># 2. Pull a model</span></div>
                      <div className="text-emerald-400">ollama pull qwen2.5:3b</div>
                      <div className="mt-2"><span className="text-slate-600"># 3. Start Ollama (usually automatic)</span></div>
                      <div className="text-emerald-400">ollama serve</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <button onClick={() => setView('settings')} className="btn-ghost btn-sm flex-shrink-0">
              Configure →
            </button>
          </div>
        </div>

        {/* Privacy notice */}
        <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-slate-800/30 border border-slate-800/40">
          <span className="text-emerald-400 text-lg leading-none">🔒</span>
          <div className="text-xs text-slate-500 leading-relaxed">
            <span className="text-slate-400 font-medium">Privacy First.</span>{' '}
            TidyDesk AI processes everything locally. No files are uploaded. No telemetry is collected.
            File content is only read for classification and never logged. All AI inference runs on your machine via Ollama.
          </div>
        </div>
      </div>
    </div>
  );
};
