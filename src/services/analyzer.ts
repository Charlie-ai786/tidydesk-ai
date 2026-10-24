import { FileEntry, AISuggestion, FileSuggestion, DuplicateGroup } from '../types';
import { classifyByRules, buildDeterministicSuggestion } from './categorizer';
import { v4 as uuidv4 } from 'uuid';

// ─── AI Analysis Service ──────────────────────────────────────────────────────

export interface AnalysisProgress {
  total: number;
  processed: number;
  current: string;
  phase: 'rule' | 'ai';
}

type ProgressCallback = (progress: AnalysisProgress) => void;

const MAX_AI_BATCH = 20; // Limit concurrent AI calls to avoid overloading Ollama

export async function analyzeFiles(
  files: FileEntry[],
  model: string,
  ollamaAvailable: boolean,
  baseFolder: string,
  onProgress?: ProgressCallback
): Promise<FileSuggestion[]> {
  const suggestions: FileSuggestion[] = [];
  const total = files.length;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    onProgress?.({ total, processed: i, current: file.name, phase: 'rule' });

    const rules = classifyByRules(file);
    let suggestion: AISuggestion;

    if (ollamaAvailable && rules.needsAI && i < MAX_AI_BATCH && window.tidydesk) {
      onProgress?.({ total, processed: i, current: file.name, phase: 'ai' });
      const result = await window.tidydesk.classify({
        model,
        fileName: file.name,
        extension: file.extension,
        size: file.size,
        modifiedAt: file.modifiedAt,
        contentPreview: file.contentPreview,
      });

      if (result.success && result.result) {
        suggestion = { ...result.result, source: 'ai' };
      } else {
        suggestion = buildDeterministicSuggestion(file);
      }
    } else {
      suggestion = buildDeterministicSuggestion(file);
    }

    suggestions.push({
      fileId: file.id,
      file,
      suggestion,
      userSuggestedName: suggestion.suggestedName,
      userSuggestedFolder: `${baseFolder}/${suggestion.suggestedFolder}`,
      selected: !suggestion.needsReview,
      status: 'pending',
    });
  }

  onProgress?.({ total, processed: total, current: '', phase: 'rule' });
  return suggestions;
}

// ─── Duplicate Detection ──────────────────────────────────────────────────────

export function detectDuplicatesByNameSize(files: FileEntry[]): DuplicateGroup[] {
  const groups = new Map<string, FileEntry[]>();

  for (const file of files) {
    const key = `${file.name.toLowerCase()}::${file.size}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(file);
  }

  return Array.from(groups.entries())
    .filter(([, files]) => files.length > 1)
    .map(([key, files]) => ({
      id: uuidv4(),
      type: 'name-size' as const,
      hash: key,
      files,
    }));
}

export async function detectDuplicatesByHash(files: FileEntry[]): Promise<DuplicateGroup[]> {
  const hashMap = new Map<string, FileEntry[]>();

  for (const file of files) {
    if (!window.tidydesk) continue;
    try {
      const hash = await window.tidydesk.computeHash(file.absolutePath);
      if (!hash) continue;
      if (!hashMap.has(hash)) hashMap.set(hash, []);
      hashMap.get(hash)!.push(file);
    } catch { /* ignore individual errors */ }
  }

  return Array.from(hashMap.entries())
    .filter(([, files]) => files.length > 1)
    .map(([hash, files]) => ({
      id: uuidv4(),
      type: 'content-hash' as const,
      hash,
      files,
    }));
}

// ─── Operation Builder ────────────────────────────────────────────────────────

import type { FileOperation } from '../types';

function getDirname(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  const idx = normalized.lastIndexOf('/');
  return idx === -1 ? '' : normalized.substring(0, idx);
}

export function buildOperations(suggestions: FileSuggestion[], baseFolder: string): FileOperation[] {
  return suggestions
    .filter(s => s.selected && s.status === 'pending')
    .map(s => {
      const destFolder = s.userSuggestedFolder || `${baseFolder}/${s.suggestion.suggestedFolder}`;
      const newName = s.userSuggestedName || s.suggestion.suggestedName;
      const destPath = destFolder.endsWith('/') || destFolder.endsWith('\\')
        ? `${destFolder}${newName}`
        : `${destFolder}/${newName}`;

      const normalizedSourceDir = getDirname(s.file.absolutePath);
      const normalizedDestFolder = destFolder.replace(/\\/g, '/').replace(/\/$/, '');
      const isRename = normalizedSourceDir === normalizedDestFolder && newName !== s.file.name;
      const type: 'move' | 'rename' = isRename ? 'rename' : 'move';

      return {
        id: uuidv4(),
        type,
        sourcePath: s.file.absolutePath,
        destinationPath: destPath.replace(/\\/g, '/'),
        originalName: s.file.name,
        newName,
        timestamp: new Date().toISOString(),
        status: 'pending' as const,
      };
    });
}
