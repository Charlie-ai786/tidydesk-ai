import React, { useState } from 'react';
import { useAppStore } from '../store/appStore';
import { formatFileSize, formatRelativeDate, getCategoryIcon } from '../services/categorizer';

export const Scanner: React.FC = () => {
  const {
    selectedFolder, selectFolder, scanFolder, isScanning, scanError,
    scannedFiles, isAnalyzing, analyzeFiles: runAnalyze, analysisProgress,
    duplicates, setView, scanOptions, updateScanOptions, settings, updateSettings,
  } = useAppStore();

  const [filterText, setFilterText] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'size' | 'date' | 'ext'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [showOptions, setShowOptions] = useState(false);

  const filtered = scannedFiles
    .filter(f => !filterText || f.name.toLowerCase().includes(filterText.toLowerCase()))
    .sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortBy === 'size') cmp = a.size - b.size;
      else if (sortBy === 'date') cmp = new Date(a.modifiedAt).getTime() - new Date(b.modifiedAt).getTime();
      else if (sortBy === 'ext') cmp = a.extension.localeCompare(b.extension);
      return sortDir === 'asc' ? cmp : -cmp;
    });

  const handleSort = (col: typeof sortBy) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('asc'); }
  };

  const extGroups = scannedFiles.reduce<Record<string, number>>((acc, f) => {
    acc[f.extension || 'no-ext'] = (acc[f.extension || 'no-ext'] || 0) + 1;
    return acc;
  }, {});

  const totalSize = scannedFiles.reduce((s, f) => s + f.size, 0);

  return (
    <div className="min-h-screen animate-fade-in">
      <div className="page-header">
        <div className="flex-1">
          <h1 className="text-lg font-semibold text-slate-100">File Scanner</h1>
          <p className="text-xs text-slate-500 mt-0.5">Select a folder and scan its contents</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={selectFolder} className="btn-secondary btn-sm">
            📁 {selectedFolder ? 'Change Folder' : 'Select Folder'}
          </button>
          {selectedFolder && (
            <button
              onClick={scanFolder}
              disabled={isScanning}
              className="btn-primary btn-sm"
              id="btn-scan-folder"
            >
              {isScanning ? '⟳ Scanning…' : '⌕ Scan Files'}
            </button>
          )}
        </div>
      </div>

      <div className="page-body space-y-5">
        {/* Selected folder + scan options */}
        {selectedFolder ? (
          <div className="card">
            <div className="card-body space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center text-lg">📁</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-200 truncate">{selectedFolder}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {scannedFiles.length > 0 ? `${scannedFiles.length} files · ${formatFileSize(totalSize)}` : 'Not yet scanned'}
                  </div>
                </div>
                <button onClick={() => setShowOptions(v => !v)} className="btn-ghost btn-sm">
                  ⚙ Options
                </button>
              </div>

              {showOptions && (
                <div className="border-t border-slate-800/50 pt-3 grid grid-cols-3 gap-4">
                  <div>
                    <label className="label">Scan Depth</label>
                    <input
                      type="number"
                      min={1} max={20}
                      value={settings.scanDepth}
                      onChange={e => updateSettings({ scanDepth: +e.target.value })}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">Options</label>
                    <div className="space-y-1.5">
                      <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
                        <input type="checkbox" checked={settings.includeSubfolders}
                          onChange={e => updateSettings({ includeSubfolders: e.target.checked })}
                          className="accent-emerald-500 w-3.5 h-3.5"
                        />
                        Include subfolders
                      </label>
                      <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
                        <input type="checkbox" checked={settings.includeHidden}
                          onChange={e => updateSettings({ includeHidden: e.target.checked })}
                          className="accent-emerald-500 w-3.5 h-3.5"
                        />
                        Include hidden files
                      </label>
                    </div>
                  </div>
                  <div>
                    <label className="label">Filter Extensions (comma-separated)</label>
                    <input
                      type="text"
                      placeholder="pdf, docx, jpg …"
                      value={scanOptions.filterExtensions.join(', ')}
                      onChange={e => updateScanOptions({
                        filterExtensions: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                      })}
                      className="input"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div
            className="folder-zone"
            onClick={selectFolder}
            role="button"
            tabIndex={0}
            onKeyDown={e => e.key === 'Enter' && selectFolder()}
            id="folder-drop-zone"
          >
            <div className="w-16 h-16 rounded-2xl bg-slate-800/60 flex items-center justify-center text-4xl">
              📁
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-slate-300 mb-1">Select a folder to scan</div>
              <div className="text-sm text-slate-500">Click to open the folder picker</div>
            </div>
            <button className="btn-primary">Open Folder Picker</button>
          </div>
        )}

        {/* Scan progress */}
        {isScanning && (
          <div className="card">
            <div className="card-body space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-sm text-slate-300">Scanning files…</span>
              </div>
              <div className="progress-bar-track">
                <div className="progress-bar-fill animate-pulse" style={{ width: '60%' }} />
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {scanError && (
          <div className="px-4 py-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
            ✕ {scanError}
          </div>
        )}

        {/* Results summary + analyse button */}
        {scannedFiles.length > 0 && (
          <>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex-1 flex items-center gap-3 flex-wrap">
                {Object.entries(extGroups).slice(0, 8).map(([ext, count]) => (
                  <span key={ext} className="badge-slate">
                    .{ext} ({count})
                  </span>
                ))}
                {duplicates.length > 0 && (
                  <span className="badge-amber">
                    ⚠ {duplicates.length} duplicate group{duplicates.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <button
                onClick={runAnalyze}
                disabled={isAnalyzing}
                className="btn-primary"
                id="btn-analyze-files"
              >
                {isAnalyzing ? `⟳ Analyzing… ${analysisProgress.processed}/${analysisProgress.total}` : '✦ Analyze Files with AI'}
              </button>
              <button onClick={() => setView('suggestions')} className="btn-secondary">
                View Suggestions →
              </button>
            </div>

            {/* Analysis progress */}
            {isAnalyzing && (
              <div className="card">
                <div className="card-body space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>
                      {analysisProgress.phase === 'ai' ? '🤖 AI Classification' : '⚡ Rule-based'} · {analysisProgress.current}
                    </span>
                    <span>{analysisProgress.processed}/{analysisProgress.total}</span>
                  </div>
                  <div className="progress-bar-track">
                    <div className="progress-bar-fill"
                      style={{ width: `${analysisProgress.total ? (analysisProgress.processed / analysisProgress.total) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Filter bar */}
            <div className="flex items-center gap-3">
              <input
                type="search"
                placeholder="Filter files…"
                value={filterText}
                onChange={e => setFilterText(e.target.value)}
                className="input max-w-xs"
                id="scanner-filter"
              />
              <span className="text-xs text-slate-500">
                Showing {filtered.length} of {scannedFiles.length} files
              </span>
            </div>

            {/* File table */}
            <div className="card overflow-hidden">
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="cursor-pointer hover:text-slate-200 transition-colors" onClick={() => handleSort('name')}>
                        Name {sortBy === 'name' && (sortDir === 'asc' ? '↑' : '↓')}
                      </th>
                      <th className="cursor-pointer hover:text-slate-200 transition-colors" onClick={() => handleSort('ext')}>
                        Type {sortBy === 'ext' && (sortDir === 'asc' ? '↑' : '↓')}
                      </th>
                      <th className="cursor-pointer hover:text-slate-200 transition-colors" onClick={() => handleSort('size')}>
                        Size {sortBy === 'size' && (sortDir === 'asc' ? '↑' : '↓')}
                      </th>
                      <th className="cursor-pointer hover:text-slate-200 transition-colors" onClick={() => handleSort('date')}>
                        Modified {sortBy === 'date' && (sortDir === 'asc' ? '↑' : '↓')}
                      </th>
                      <th>Path</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(file => (
                      <tr key={file.id} className="group">
                        <td>
                          <div className="flex items-center gap-2">
                            <span className="text-base leading-none">{getCategoryIcon('Miscellaneous')}</span>
                            <span className="font-medium text-slate-200 text-xs">{file.name}</span>
                            {file.contentPreview && (
                              <span className="badge-slate text-[9px]">text</span>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className="badge-slate">.{file.extension || '—'}</span>
                        </td>
                        <td className="text-slate-400 text-xs">{formatFileSize(file.size)}</td>
                        <td className="text-slate-400 text-xs">{formatRelativeDate(file.modifiedAt)}</td>
                        <td>
                          <span className="text-xs text-slate-600 truncate-path max-w-[200px] block" title={file.relativePath}>
                            {file.relativePath}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filtered.length === 0 && !isScanning && (
                <div className="text-center py-8 text-slate-500 text-sm">
                  {filterText ? 'No files match your filter.' : 'Scan a folder to see files here.'}
                </div>
              )}
            </div>

            {/* Duplicates panel */}
            {duplicates.length > 0 && (
              <div className="card border-amber-500/20">
                <div className="card-header">
                  <h3 className="font-semibold text-amber-400">⚠ Duplicate Candidates ({duplicates.length} groups)</h3>
                  <span className="text-xs text-slate-500">Same name + size — review before organizing</span>
                </div>
                <div className="card-body divide-y divide-slate-800/40 max-h-48 overflow-y-auto">
                  {duplicates.map(group => (
                    <div key={group.id} className="py-3">
                      <div className="text-xs text-amber-400 mb-1.5 font-medium">
                        {group.files[0].name} · {formatFileSize(group.files[0].size)} · {group.files.length} copies
                      </div>
                      <div className="space-y-1">
                        {group.files.map(f => (
                          <div key={f.id} className="text-[11px] text-slate-500 font-mono truncate">
                            {f.absolutePath}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
