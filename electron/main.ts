import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import isDev from 'electron-is-dev';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FileEntry {
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

interface ScanOptions {
  depth: number;
  includeHidden: boolean;
  includeSubfolders: boolean;
  skipPaths: string[];
  filterExtensions: string[];
  filterMinSize: number;
  filterMaxSize: number;
}

interface FileOperation {
  id: string;
  type: 'move' | 'rename';
  sourcePath: string;
  destinationPath: string;
  originalName: string;
  newName: string;
  timestamp: string;
  status: 'pending' | 'success' | 'failed';
  error?: string;
}

interface OperationResult {
  operationId: string;
  success: boolean;
  error?: string;
  sourcePath: string;
  destinationPath: string;
}

// ─── Security: Approved Roots ─────────────────────────────────────────────────

const approvedRoots: Set<string> = new Set();

function isPathSafe(p: string, allowedRoot?: string): boolean {
  const resolved = path.resolve(p);
  const root = allowedRoot ? path.resolve(allowedRoot) : null;
  if (root && !resolved.startsWith(root + path.sep) && resolved !== root) {
    return false;
  }
  // Block known dangerous system paths on Windows
  const dangerousPaths = [
    process.env.SystemRoot,
    process.env.windir,
    process.env.PROGRAMFILES,
    'C:\\Windows',
    'C:\\Program Files',
    'C:\\Program Files (x86)',
  ].filter(Boolean);
  for (const dp of dangerousPaths) {
    if (resolved.toLowerCase().startsWith(dp!.toLowerCase())) {
      return false;
    }
  }
  return true;
}

function isInApprovedRoot(p: string): boolean {
  const resolved = path.resolve(p);
  for (const root of approvedRoots) {
    if (resolved === root || resolved.startsWith(root + path.sep)) {
      return true;
    }
  }
  return false;
}

// ─── MIME Type Detection ──────────────────────────────────────────────────────

const MIME_MAP: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain',
  md: 'text/markdown',
  csv: 'text/csv',
  json: 'application/json',
  xml: 'application/xml',
  html: 'text/html',
  css: 'text/css',
  js: 'text/javascript',
  ts: 'text/typescript',
  tsx: 'text/typescript-jsx',
  jsx: 'text/javascript-jsx',
  py: 'text/x-python',
  rs: 'text/x-rust',
  go: 'text/x-go',
  java: 'text/x-java',
  cpp: 'text/x-c++',
  c: 'text/x-c',
  h: 'text/x-c',
  sh: 'text/x-sh',
  bat: 'text/x-bat',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
  tiff: 'image/tiff',
  mp4: 'video/mp4',
  avi: 'video/x-msvideo',
  mov: 'video/quicktime',
  mkv: 'video/x-matroska',
  webm: 'video/webm',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  flac: 'audio/flac',
  aac: 'audio/aac',
  zip: 'application/zip',
  rar: 'application/x-rar-compressed',
  '7z': 'application/x-7z-compressed',
  tar: 'application/x-tar',
  gz: 'application/gzip',
  exe: 'application/x-msdownload',
  dmg: 'application/x-apple-diskimage',
  iso: 'application/x-iso9660-image',
};

function getMimeType(ext: string): string {
  return MIME_MAP[ext.toLowerCase()] || 'application/octet-stream';
}

// ─── Text-extractable types ───────────────────────────────────────────────────

const TEXT_EXTRACTABLE = new Set(['txt', 'md', 'csv', 'json', 'xml', 'html', 'css',
  'js', 'ts', 'tsx', 'jsx', 'py', 'rs', 'go', 'java', 'cpp', 'c', 'h', 'sh', 'bat', 'log']);

async function extractTextPreview(filePath: string, ext: string, maxChars = 800): Promise<string | undefined> {
  if (!TEXT_EXTRACTABLE.has(ext.toLowerCase())) return undefined;
  try {
    const stat = await fsp.stat(filePath);
    if (stat.size > 500_000) return undefined; // skip large files
    const buffer = Buffer.alloc(Math.min(stat.size, 4096));
    const fd = await fsp.open(filePath, 'r');
    await fd.read(buffer, 0, buffer.length, 0);
    await fd.close();
    return buffer.toString('utf8', 0, Math.min(buffer.length, maxChars))
      .replace(/\0/g, '')
      .trim();
  } catch {
    return undefined;
  }
}

// ─── Folder Scanner ───────────────────────────────────────────────────────────

const HIDDEN_PREFIXES = ['.', '$', '~'];
const SYSTEM_NAMES = new Set(['node_modules', '__pycache__', '.git', '.svn', '.hg',
  'Thumbs.db', 'desktop.ini', '.DS_Store', 'System Volume Information']);

async function scanFolder(
  folderPath: string,
  options: ScanOptions,
  currentDepth = 0,
  rootPath?: string
): Promise<FileEntry[]> {
  const root = rootPath ?? folderPath;
  const results: FileEntry[] = [];

  if (currentDepth > options.depth) return results;

  let entries: fs.Dirent[];
  try {
    entries = await fsp.readdir(folderPath, { withFileTypes: true });
  } catch (e) {
    return results;
  }

  for (const entry of entries) {
    const fullPath = path.join(folderPath, entry.name);

    // Skip hidden unless requested
    if (!options.includeHidden && HIDDEN_PREFIXES.some(p => entry.name.startsWith(p))) continue;
    // Skip system names
    if (SYSTEM_NAMES.has(entry.name)) continue;
    // Skip user-excluded paths
    if (options.skipPaths.some(sp => fullPath.startsWith(sp))) continue;
    // Never follow symlinks
    if (entry.isSymbolicLink()) continue;

    if (entry.isDirectory()) {
      if (!options.includeSubfolders && currentDepth > 0) continue;
      const subResults = await scanFolder(fullPath, options, currentDepth + 1, root);
      results.push(...subResults);
      continue;
    }

    if (!entry.isFile()) continue;

    const ext = path.extname(entry.name).replace('.', '').toLowerCase();

    // Extension filter
    if (options.filterExtensions.length > 0 && !options.filterExtensions.includes(ext)) continue;

    let stat: fs.Stats;
    try {
      stat = await fsp.stat(fullPath);
    } catch {
      continue;
    }

    // Size filter
    if (options.filterMinSize > 0 && stat.size < options.filterMinSize) continue;
    if (options.filterMaxSize > 0 && stat.size > options.filterMaxSize) continue;

    const relativePath = path.relative(root, fullPath);
    const preview = await extractTextPreview(fullPath, ext);

    results.push({
      id: uuidv4(),
      name: entry.name,
      extension: ext,
      size: stat.size,
      modifiedAt: stat.mtime.toISOString(),
      createdAt: stat.birthtime.toISOString(),
      absolutePath: fullPath,
      relativePath,
      mimeType: getMimeType(ext),
      isDirectory: false,
      isSymlink: false,
      contentPreview: preview,
    });
  }

  return results;
}

// ─── Duplicate Detection ──────────────────────────────────────────────────────

async function computeFileHash(filePath: string): Promise<string | null> {
  try {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath, { highWaterMark: 64 * 1024 });
    for await (const chunk of stream) {
      hash.update(chunk as Buffer);
    }
    return hash.digest('hex');
  } catch {
    return null;
  }
}

// ─── Database (SQLite for operation history) ──────────────────────────────────

let db: import('better-sqlite3').Database | null = null;

function initDB() {
  try {
    const Database = require('better-sqlite3');
    const dbPath = path.join(app.getPath('userData'), 'tidydesk.db');
    db = new Database(dbPath);
    db!.exec(`
      CREATE TABLE IF NOT EXISTS operations (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        source_path TEXT NOT NULL,
        destination_path TEXT NOT NULL,
        original_name TEXT NOT NULL,
        new_name TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        status TEXT NOT NULL,
        error TEXT,
        undone INTEGER DEFAULT 0
      );
    `);
  } catch (e) {
    console.warn('SQLite not available, operation history will be in-memory only:', e);
  }
}

function saveOperation(op: FileOperation): void {
  if (!db) return;
  try {
    db.prepare(`
      INSERT OR REPLACE INTO operations
        (id, type, source_path, destination_path, original_name, new_name, timestamp, status, error, undone)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(op.id, op.type, op.sourcePath, op.destinationPath,
      op.originalName, op.newName, op.timestamp, op.status, op.error ?? null, 0);
  } catch { /* ignore */ }
}

function updateOperationStatus(id: string, status: string, error?: string): void {
  if (!db) return;
  try {
    db.prepare('UPDATE operations SET status = ?, error = ? WHERE id = ?')
      .run(status, error ?? null, id);
  } catch { /* ignore */ }
}

function markOperationUndone(id: string): void {
  if (!db) return;
  try {
    db.prepare('UPDATE operations SET undone = 1, status = ? WHERE id = ?')
      .run('undone', id);
  } catch { /* ignore */ }
}

function getOperationHistory(): FileOperation[] {
  if (!db) return inMemoryHistory;
  try {
    const rows = db.prepare('SELECT * FROM operations ORDER BY timestamp DESC').all() as any[];
    return rows.map(r => ({
      id: r.id,
      type: r.type,
      sourcePath: r.source_path,
      destinationPath: r.destination_path,
      originalName: r.original_name,
      newName: r.new_name,
      timestamp: r.timestamp,
      status: r.undone ? 'undone' : r.status,
      error: r.error ?? undefined,
    }));
  } catch {
    return inMemoryHistory;
  }
}

const inMemoryHistory: FileOperation[] = [];

// ─── Filename Collision Resolution ───────────────────────────────────────────

async function resolveCollision(destPath: string): Promise<string> {
  const dir = path.dirname(destPath);
  const ext = path.extname(destPath);
  const base = path.basename(destPath, ext);
  let counter = 1;
  let candidate = destPath;
  while (true) {
    try {
      await fsp.access(candidate);
      candidate = path.join(dir, `${base}_${counter}${ext}`);
      counter++;
    } catch {
      return candidate;
    }
  }
}

// ─── IPC Handlers ────────────────────────────────────────────────────────────

// Pick folder
ipcMain.handle('dialog:open-folder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    title: 'Select a folder to organize',
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  const chosen = result.filePaths[0];
  approvedRoots.add(chosen);
  return chosen;
});

// Scan folder
ipcMain.handle('fs:scan-folder', async (_event, folderPath: string, options: ScanOptions) => {
  if (!approvedRoots.has(folderPath) && !isInApprovedRoot(folderPath)) {
    throw new Error('PERMISSION_DENIED: Folder not in approved roots');
  }
  if (!isPathSafe(folderPath)) {
    throw new Error('SECURITY_ERROR: Path is in a protected system directory');
  }
  return scanFolder(folderPath, options);
});

// Compute hash
ipcMain.handle('fs:compute-hash', async (_event, filePath: string) => {
  if (!isInApprovedRoot(filePath)) throw new Error('PERMISSION_DENIED');
  return computeFileHash(filePath);
});

// Execute file operations (after user approval)
ipcMain.handle('fs:execute-operations', async (_event, operations: FileOperation[]) => {
  const results: OperationResult[] = [];

  for (const op of operations) {
    // Security checks
    if (!isInApprovedRoot(op.sourcePath)) {
      results.push({ operationId: op.id, success: false, error: 'PERMISSION_DENIED: source not in approved root', sourcePath: op.sourcePath, destinationPath: op.destinationPath });
      continue;
    }

    const destDir = path.dirname(op.destinationPath);
    // Destination must be in an approved root
    if (!isInApprovedRoot(op.destinationPath) && !Array.from(approvedRoots).some(r => op.destinationPath.startsWith(r))) {
      // Destination might be a subfolder of approved root — allow if destDir starts with approved root
      const destInRoot = Array.from(approvedRoots).some(r => destDir.startsWith(r) || destDir === r);
      if (!destInRoot) {
        results.push({ operationId: op.id, success: false, error: 'PERMISSION_DENIED: destination not in approved root', sourcePath: op.sourcePath, destinationPath: op.destinationPath });
        continue;
      }
    }

    // Prevent path traversal
    if (op.sourcePath.includes('..') || op.destinationPath.includes('..')) {
      results.push({ operationId: op.id, success: false, error: 'SECURITY: path traversal detected', sourcePath: op.sourcePath, destinationPath: op.destinationPath });
      continue;
    }

    // Check source exists
    try {
      await fsp.access(op.sourcePath);
    } catch {
      results.push({ operationId: op.id, success: false, error: 'Source file not found', sourcePath: op.sourcePath, destinationPath: op.destinationPath });
      updateOperationStatus(op.id, 'failed', 'Source not found');
      continue;
    }

    // Resolve collision
    const safeDest = await resolveCollision(op.destinationPath);

    // Ensure destination directory exists
    await fsp.mkdir(path.dirname(safeDest), { recursive: true });

    try {
      await fsp.rename(op.sourcePath, safeDest);
      const finalOp: FileOperation = { ...op, destinationPath: safeDest, status: 'success', timestamp: new Date().toISOString() };
      saveOperation(finalOp);
      if (!db) inMemoryHistory.unshift(finalOp);
      results.push({ operationId: op.id, success: true, sourcePath: op.sourcePath, destinationPath: safeDest });
    } catch (e: any) {
      updateOperationStatus(op.id, 'failed', e.message);
      results.push({ operationId: op.id, success: false, error: e.message, sourcePath: op.sourcePath, destinationPath: op.destinationPath });
    }
  }

  return results;
});

// Undo operation
ipcMain.handle('fs:undo-operation', async (_event, operationId: string) => {
  const history = getOperationHistory();
  const op = history.find(o => o.id === operationId);
  if (!op) throw new Error('Operation not found');
  if (op.status !== 'success') throw new Error('Cannot undo: operation was not successful');

  // Check current file exists at destination
  try {
    await fsp.access(op.destinationPath);
  } catch {
    throw new Error('Cannot undo: file no longer exists at destination');
  }

  // Check original location is free
  try {
    await fsp.access(op.sourcePath);
    throw new Error('CONFLICT: A file already exists at the original location. Cannot undo without overwriting.');
  } catch (e: any) {
    if (e.message.startsWith('CONFLICT')) throw e;
    // Good — original location is free
  }

  await fsp.mkdir(path.dirname(op.sourcePath), { recursive: true });
  await fsp.rename(op.destinationPath, op.sourcePath);
  markOperationUndone(op.id);
  return { success: true };
});

// Get operation history
ipcMain.handle('db:get-history', async () => {
  return getOperationHistory();
});

// Clear history
ipcMain.handle('db:clear-history', async () => {
  if (db) {
    db.prepare('DELETE FROM operations').run();
  } else {
    inMemoryHistory.length = 0;
  }
  return true;
});

// Check Ollama status
ipcMain.handle('ollama:check-status', async () => {
  try {
    const resp = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(3000) });
    if (!resp.ok) return { running: false, models: [] };
    const data = await resp.json() as { models: { name: string }[] };
    return { running: true, models: data.models.map((m: any) => m.name) };
  } catch {
    return { running: false, models: [] };
  }
});

// Classify file via Ollama
ipcMain.handle('ollama:classify', async (_event, payload: {
  model: string;
  fileName: string;
  extension: string;
  size: number;
  modifiedAt: string;
  contentPreview?: string;
}) => {
  const { model, fileName, extension, size, modifiedAt, contentPreview } = payload;

  const systemPrompt = `You are a file organization assistant. Classify the given file and suggest an organized name and folder.
Return ONLY valid JSON matching this exact schema:
{
  "category": string,
  "suggestedName": string,
  "suggestedFolder": string,
  "explanation": string,
  "confidence": number (0.0-1.0),
  "needsReview": boolean
}
Categories: Documents, Academic Notes, Assignments and Reports, Invoices and Receipts, Career and Resume, Images and Screenshots, Videos, Audio, Archives, Code and Development, Miscellaneous
Rules:
- Never invent dates, IDs, or invoice numbers not present in the metadata/content
- If uncertain, set needsReview: true and keep the original filename
- suggestedName must preserve the original file extension
- suggestedFolder should be a relative path like "Documents/Invoices"
- Confidence should reflect your actual certainty`;

  const userPrompt = `File: ${fileName}
Extension: .${extension}
Size: ${size} bytes
Modified: ${modifiedAt}
${contentPreview ? `Content preview:\n${contentPreview.substring(0, 500)}` : ''}

Classify and suggest organization for this file.`;

  try {
    const response = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(30000),
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        stream: false,
        format: 'json',
        options: { temperature: 0.1 },
      }),
    });

    if (!response.ok) throw new Error(`Ollama responded ${response.status}`);
    const data = await response.json() as any;
    const content = data.message?.content ?? data.response ?? '{}';

    // Parse and validate
    const parsed = JSON.parse(content);
    const valid = {
      category: typeof parsed.category === 'string' ? parsed.category : 'Miscellaneous',
      suggestedName: typeof parsed.suggestedName === 'string' ? parsed.suggestedName : fileName,
      suggestedFolder: typeof parsed.suggestedFolder === 'string' ? parsed.suggestedFolder : 'Miscellaneous',
      explanation: typeof parsed.explanation === 'string' ? parsed.explanation : '',
      confidence: typeof parsed.confidence === 'number' ? Math.min(1, Math.max(0, parsed.confidence)) : 0.5,
      needsReview: typeof parsed.needsReview === 'boolean' ? parsed.needsReview : true,
    };
    return { success: true, result: valid };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
});

// Open file in system explorer
ipcMain.handle('shell:show-in-folder', async (_event, filePath: string) => {
  if (!isInApprovedRoot(filePath)) throw new Error('PERMISSION_DENIED');
  shell.showItemInFolder(filePath);
});

// ─── Window ───────────────────────────────────────────────────────────────────

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    title: 'TidyDesk AI',
    backgroundColor: '#0f1117',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    titleBarStyle: 'hiddenInset',
    show: false,
  });

  win.once('ready-to-show', () => win.show());

  if (isDev) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

app.whenReady().then(() => {
  initDB();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
