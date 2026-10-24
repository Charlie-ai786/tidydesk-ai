// ─── Core Domain Types ────────────────────────────────────────────────────────

export interface FileEntry {
  id: string;
  name: string;
  extension: string;
  size: number;
  modifiedAt: string;
  createdAt: string;
  absolutePath: string;
  relativePath: string;
  mimeType: string;
  isDirectory: boolean;
  isSymlink: boolean;
  contentPreview?: string;
}

export interface ScanOptions {
  depth: number;
  includeHidden: boolean;
  includeSubfolders: boolean;
  skipPaths: string[];
  filterExtensions: string[];
  filterMinSize: number;
  filterMaxSize: number;
}

export type OperationType = 'move' | 'rename';
export type OperationStatus = 'pending' | 'success' | 'failed' | 'undone' | 'skipped';

export interface FileOperation {
  id: string;
  type: OperationType;
  sourcePath: string;
  destinationPath: string;
  originalName: string;
  newName: string;
  timestamp: string;
  status: OperationStatus;
  error?: string;
}

export interface OperationResult {
  operationId: string;
  success: boolean;
  error?: string;
  sourcePath: string;
  destinationPath: string;
}

// ─── AI Types ─────────────────────────────────────────────────────────────────

export type FileCategory =
  | 'Documents'
  | 'Academic Notes'
  | 'Assignments and Reports'
  | 'Invoices and Receipts'
  | 'Career and Resume'
  | 'Images and Screenshots'
  | 'Videos'
  | 'Audio'
  | 'Archives'
  | 'Code and Development'
  | 'Miscellaneous';

export interface AISuggestion {
  category: FileCategory;
  suggestedName: string;
  suggestedFolder: string;
  explanation: string;
  confidence: number;
  needsReview: boolean;
  source: 'ai' | 'rule'; // Distinguish AI from deterministic
}

export interface FileSuggestion {
  fileId: string;
  file: FileEntry;
  suggestion: AISuggestion;
  // User-editable
  userSuggestedName: string;
  userSuggestedFolder: string;
  selected: boolean;
  status: 'pending' | 'approved' | 'rejected' | 'applied' | 'failed';
  operationId?: string;
}

// ─── Duplicate Detection ──────────────────────────────────────────────────────

export interface DuplicateGroup {
  id: string;
  type: 'name-size' | 'content-hash';
  hash?: string;
  files: FileEntry[];
}

// ─── Ollama Status ────────────────────────────────────────────────────────────

export interface OllamaStatus {
  running: boolean;
  models: string[];
}

// ─── App State ────────────────────────────────────────────────────────────────

export type AppView = 'dashboard' | 'scanner' | 'suggestions' | 'history' | 'settings';

export interface AppSettings {
  selectedModel: string;
  scanDepth: number;
  includeHidden: boolean;
  includeSubfolders: boolean;
  theme: 'dark' | 'light';
  ollamaBaseUrl: string;
}

// ─── Electron API Bridge ──────────────────────────────────────────────────────

export interface TidydeskAPI {
  openFolder: () => Promise<string | null>;
  scanFolder: (folderPath: string, options: ScanOptions) => Promise<FileEntry[]>;
  computeHash: (filePath: string) => Promise<string | null>;
  executeOperations: (operations: FileOperation[]) => Promise<OperationResult[]>;
  undoOperation: (operationId: string) => Promise<{ success: boolean }>;
  getHistory: () => Promise<FileOperation[]>;
  clearHistory: () => Promise<boolean>;
  checkOllama: () => Promise<OllamaStatus>;
  classify: (payload: {
    model: string;
    fileName: string;
    extension: string;
    size: number;
    modifiedAt: string;
    contentPreview?: string;
  }) => Promise<{ success: boolean; result?: AISuggestion; error?: string }>;
  showInFolder: (filePath: string) => Promise<void>;
}

declare global {
  interface Window {
    tidydesk: TidydeskAPI;
  }
}
