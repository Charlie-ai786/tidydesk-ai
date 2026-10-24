import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import {
  FileEntry, FileSuggestion, FileOperation, OllamaStatus, AppSettings,
  AppView, ScanOptions, DuplicateGroup
} from '../types';
import { analyzeFiles, detectDuplicatesByNameSize, buildOperations } from '../services/analyzer';

// ─── Default Settings ─────────────────────────────────────────────────────────

const defaultSettings: AppSettings = {
  selectedModel: 'qwen2.5:3b',
  scanDepth: 5,
  includeHidden: false,
  includeSubfolders: true,
  theme: 'dark',
  ollamaBaseUrl: 'http://localhost:11434',
};

const defaultScanOptions: ScanOptions = {
  depth: 5,
  includeHidden: false,
  includeSubfolders: true,
  skipPaths: [],
  filterExtensions: [],
  filterMinSize: 0,
  filterMaxSize: 0,
};

// ─── Store Shape ──────────────────────────────────────────────────────────────

interface AppState {
  // Navigation
  currentView: AppView;
  setView: (view: AppView) => void;

  // Ollama
  ollamaStatus: OllamaStatus;
  setOllamaStatus: (status: OllamaStatus) => void;
  checkOllama: () => Promise<void>;

  // Settings
  settings: AppSettings;
  updateSettings: (patch: Partial<AppSettings>) => void;

  // Folder selection
  selectedFolder: string | null;
  selectFolder: () => Promise<void>;

  // Scanner
  scanOptions: ScanOptions;
  updateScanOptions: (patch: Partial<ScanOptions>) => void;
  scannedFiles: FileEntry[];
  isScanning: boolean;
  scanError: string | null;
  scanFolder: () => Promise<void>;

  // Analysis
  suggestions: FileSuggestion[];
  isAnalyzing: boolean;
  analysisProgress: { processed: number; total: number; current: string; phase: string };
  analyzedAt: string | null;
  analyzeFiles: () => Promise<void>;

  // Suggestion editing
  toggleSuggestion: (fileId: string, selected: boolean) => void;
  toggleAllSuggestions: (selected: boolean) => void;
  updateSuggestionName: (fileId: string, name: string) => void;
  updateSuggestionFolder: (fileId: string, folder: string) => void;
  rejectSuggestion: (fileId: string) => void;

  // Operations
  isApplying: boolean;
  applyResults: { success: number; failed: number; operations: { id: string; success: boolean; error?: string }[] } | null;
  applyApproved: () => Promise<void>;

  // History
  history: FileOperation[];
  loadHistory: () => Promise<void>;
  undoOperation: (id: string) => Promise<void>;
  clearHistory: () => Promise<void>;

  // Duplicates
  duplicates: DuplicateGroup[];
  isDetectingDuplicates: boolean;
  detectDuplicates: () => void;

  // Notifications
  notification: { message: string; type: 'success' | 'error' | 'info' } | null;
  showNotification: (message: string, type: 'success' | 'error' | 'info') => void;
  clearNotification: () => void;
}

// ─── Store Implementation ─────────────────────────────────────────────────────

export const useAppStore = create<AppState>()(
  immer((set, get) => ({
    // Navigation
    currentView: 'dashboard',
    setView: (view) => set(s => { s.currentView = view; }),

    // Ollama
    ollamaStatus: { running: false, models: [] },
    setOllamaStatus: (status) => set(s => { s.ollamaStatus = status; }),
    checkOllama: async () => {
      if (!window.tidydesk) return;
      try {
        const status = await window.tidydesk.checkOllama();
        set(s => { s.ollamaStatus = status; });
      } catch {
        set(s => { s.ollamaStatus = { running: false, models: [] }; });
      }
    },

    // Settings
    settings: defaultSettings,
    updateSettings: (patch) => set(s => { Object.assign(s.settings, patch); }),

    // Folder selection
    selectedFolder: null,
    selectFolder: async () => {
      if (!window.tidydesk) return;
      const folder = await window.tidydesk.openFolder();
      if (folder) {
        set(s => {
          s.selectedFolder = folder;
          s.scannedFiles = [];
          s.suggestions = [];
          s.applyResults = null;
          s.duplicates = [];
        });
        get().showNotification(`Folder selected: ${folder}`, 'info');
      }
    },

    // Scanner
    scanOptions: defaultScanOptions,
    updateScanOptions: (patch) => set(s => { Object.assign(s.scanOptions, patch); }),
    scannedFiles: [],
    isScanning: false,
    scanError: null,
    scanFolder: async () => {
      const { selectedFolder, scanOptions } = get();
      if (!selectedFolder || !window.tidydesk) return;

      set(s => {
        s.isScanning = true;
        s.scanError = null;
        s.scannedFiles = [];
        s.suggestions = [];
      });

      try {
        const files = await window.tidydesk.scanFolder(selectedFolder, {
          ...scanOptions,
          depth: get().settings.scanDepth,
          includeHidden: get().settings.includeHidden,
          includeSubfolders: get().settings.includeSubfolders,
        });
        set(s => {
          s.scannedFiles = files;
          s.isScanning = false;
        });
        get().showNotification(`Found ${files.length} files`, 'success');
        // Auto-detect duplicates
        get().detectDuplicates();
      } catch (e: any) {
        set(s => {
          s.isScanning = false;
          s.scanError = e.message;
        });
        get().showNotification(`Scan failed: ${e.message}`, 'error');
      }
    },

    // Analysis
    suggestions: [],
    isAnalyzing: false,
    analysisProgress: { processed: 0, total: 0, current: '', phase: 'rule' },
    analyzedAt: null,
    analyzeFiles: async () => {
      const { scannedFiles, settings, ollamaStatus, selectedFolder } = get();
      if (!scannedFiles.length || !selectedFolder) return;

      set(s => {
        s.isAnalyzing = true;
        s.suggestions = [];
        s.analysisProgress = { processed: 0, total: scannedFiles.length, current: '', phase: 'rule' };
      });

      try {
        const suggestions = await analyzeFiles(
          scannedFiles,
          settings.selectedModel,
          ollamaStatus.running,
          selectedFolder,
          (progress) => set(s => { s.analysisProgress = progress; })
        );
        set(s => {
          s.suggestions = suggestions;
          s.isAnalyzing = false;
          s.analyzedAt = new Date().toISOString();
        });
        get().showNotification(`Analysis complete — ${suggestions.length} suggestions generated`, 'success');
      } catch (e: any) {
        set(s => { s.isAnalyzing = false; });
        get().showNotification(`Analysis failed: ${e.message}`, 'error');
      }
    },

    // Suggestion editing
    toggleSuggestion: (fileId, selected) =>
      set(s => {
        const idx = s.suggestions.findIndex(sg => sg.fileId === fileId);
        if (idx !== -1) s.suggestions[idx].selected = selected;
      }),
    toggleAllSuggestions: (selected) =>
      set(s => { s.suggestions.forEach(sg => { if (sg.status === 'pending') sg.selected = selected; }); }),
    updateSuggestionName: (fileId, name) =>
      set(s => {
        const idx = s.suggestions.findIndex(sg => sg.fileId === fileId);
        if (idx !== -1) s.suggestions[idx].userSuggestedName = name;
      }),
    updateSuggestionFolder: (fileId, folder) =>
      set(s => {
        const idx = s.suggestions.findIndex(sg => sg.fileId === fileId);
        if (idx !== -1) s.suggestions[idx].userSuggestedFolder = folder;
      }),
    rejectSuggestion: (fileId) =>
      set(s => {
        const idx = s.suggestions.findIndex(sg => sg.fileId === fileId);
        if (idx !== -1) { s.suggestions[idx].selected = false; s.suggestions[idx].status = 'rejected'; }
      }),

    // Operations
    isApplying: false,
    applyResults: null,
    applyApproved: async () => {
      const { suggestions, selectedFolder } = get();
      if (!selectedFolder || !window.tidydesk) return;

      const operations = buildOperations(suggestions, selectedFolder);
      if (!operations.length) {
        get().showNotification('No approved operations to apply', 'info');
        return;
      }

      set(s => { s.isApplying = true; });

      try {
        const results = await window.tidydesk.executeOperations(operations);
        const successCount = results.filter(r => r.success).length;
        const failCount = results.filter(r => !r.success).length;

        // Update suggestion statuses
        set(s => {
          for (const result of results) {
            const op = operations.find(o => o.id === result.operationId);
            if (op) {
              const sgIdx = s.suggestions.findIndex(sg => sg.file.absolutePath === op.sourcePath);
              if (sgIdx !== -1) {
                s.suggestions[sgIdx].status = result.success ? 'applied' : 'failed';
                s.suggestions[sgIdx].operationId = result.operationId;
              }
            }
          }
          s.isApplying = false;
          s.applyResults = { success: successCount, failed: failCount, operations: results.map(r => ({ id: r.operationId, success: r.success, error: r.error })) };
        });

        await get().loadHistory();
        get().showNotification(
          `${successCount} files organized${failCount > 0 ? `, ${failCount} failed` : ''}`,
          failCount > 0 ? 'error' : 'success'
        );
      } catch (e: any) {
        set(s => { s.isApplying = false; });
        get().showNotification(`Apply failed: ${e.message}`, 'error');
      }
    },

    // History
    history: [],
    loadHistory: async () => {
      if (!window.tidydesk) return;
      try {
        const history = await window.tidydesk.getHistory();
        set(s => { s.history = history; });
      } catch { /* ignore */ }
    },
    undoOperation: async (id) => {
      if (!window.tidydesk) return;
      try {
        await window.tidydesk.undoOperation(id);
        await get().loadHistory();
        get().showNotification('Operation undone successfully', 'success');
      } catch (e: any) {
        get().showNotification(`Undo failed: ${e.message}`, 'error');
      }
    },
    clearHistory: async () => {
      if (!window.tidydesk) return;
      await window.tidydesk.clearHistory();
      set(s => { s.history = []; });
      get().showNotification('History cleared', 'info');
    },

    // Duplicates
    duplicates: [],
    isDetectingDuplicates: false,
    detectDuplicates: () => {
      const { scannedFiles } = get();
      const groups = detectDuplicatesByNameSize(scannedFiles);
      set(s => { s.duplicates = groups; });
    },

    // Notifications
    notification: null,
    showNotification: (message, type) => {
      set(s => { s.notification = { message, type }; });
      setTimeout(() => {
        set(s => { if (s.notification?.message === message) s.notification = null; });
      }, 4000);
    },
    clearNotification: () => set(s => { s.notification = null; }),
  }))
);
