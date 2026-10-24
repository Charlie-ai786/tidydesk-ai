import React, { useEffect } from 'react';
import { useAppStore } from '../store/appStore';
import { formatRelativeDate } from '../services/categorizer';

export const History: React.FC = () => {
  const { history, loadHistory, undoOperation, clearHistory } = useAppStore();

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const successOps = history.filter(h => h.status === 'success');
  const failedOps  = history.filter(h => h.status === 'failed');
  const undoneOps  = history.filter(h => h.status === 'undone');

  const statusBadge = (status: string) => {
    switch (status) {
      case 'success': return <span className="badge-emerald">✓ Success</span>;
      case 'failed':  return <span className="badge-rose">✕ Failed</span>;
      case 'undone':  return <span className="badge-slate">↩ Undone</span>;
      case 'pending': return <span className="badge-amber">… Pending</span>;
      default: return <span className="badge-slate">{status}</span>;
    }
  };

  return (
    <div className="min-h-screen animate-fade-in">
      <div className="page-header">
        <div className="flex-1">
          <h1 className="text-lg font-semibold text-slate-100">History & Undo</h1>
          <p className="text-xs text-slate-500 mt-0.5">Operation log with undo support</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadHistory} className="btn-ghost btn-sm">⟳ Refresh</button>
          {history.length > 0 && (
            <button onClick={clearHistory} className="btn-danger btn-sm">
              ✕ Clear History
            </button>
          )}
        </div>
      </div>

      <div className="page-body space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="stat-card">
            <div className="stat-value text-emerald-400">{successOps.length}</div>
            <div className="stat-label">Successful</div>
          </div>
          <div className="stat-card">
            <div className="stat-value text-rose-400">{failedOps.length}</div>
            <div className="stat-label">Failed</div>
          </div>
          <div className="stat-card">
            <div className="stat-value text-slate-400">{undoneOps.length}</div>
            <div className="stat-label">Undone</div>
          </div>
        </div>

        {/* Privacy notice */}
        <div className="flex items-start gap-3 px-3 py-2.5 rounded-lg bg-slate-800/30 border border-slate-800/40 text-xs text-slate-500">
          <span className="text-emerald-400">🔒</span>
          Operation history is stored locally in SQLite. It records paths and operation types — never file contents.
          Use "Clear History" to remove all records.
        </div>

        {/* Operations table */}
        {history.length > 0 ? (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Type</th>
                    <th>Original</th>
                    <th>Destination</th>
                    <th>Status</th>
                    <th>Undo</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map(op => (
                    <tr key={op.id}>
                      <td className="text-xs text-slate-500 whitespace-nowrap" title={new Date(op.timestamp).toLocaleString()}>
                        {formatRelativeDate(op.timestamp)}
                      </td>
                      <td>
                        <span className={`badge text-[10px] ${op.type === 'move' ? 'badge-blue' : 'badge-slate'}`}>
                          {op.type === 'move' ? '→ Move' : '✎ Rename'}
                        </span>
                      </td>
                      <td>
                        <div className="max-w-[200px]">
                          <div className="text-xs font-medium text-slate-300 truncate" title={op.originalName}>
                            {op.originalName}
                          </div>
                          <div className="text-[10px] text-slate-600 truncate font-mono" title={op.sourcePath}>
                            {op.sourcePath}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="max-w-[200px]">
                          <div className="text-xs font-medium text-slate-300 truncate" title={op.newName}>
                            {op.newName}
                          </div>
                          <div className="text-[10px] text-slate-600 truncate font-mono" title={op.destinationPath}>
                            {op.destinationPath}
                          </div>
                        </div>
                      </td>
                      <td>{statusBadge(op.status)}</td>
                      <td>
                        {op.status === 'success' && (
                          <button
                            onClick={() => undoOperation(op.id)}
                            className="btn-ghost btn-sm text-xs"
                            title="Undo this operation"
                            id={`btn-undo-${op.id}`}
                          >
                            ↩ Undo
                          </button>
                        )}
                        {op.status === 'undone' && (
                          <span className="text-xs text-slate-600">↩ Done</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="text-4xl opacity-30">⟳</div>
            <div className="text-slate-500 text-sm">No operations recorded yet.</div>
            <div className="text-slate-600 text-xs">
              Apply changes in the Suggestions view to see history here.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
