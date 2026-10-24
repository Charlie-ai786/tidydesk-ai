import { describe, it, expect } from 'vitest';
import { detectDuplicatesByNameSize, buildOperations } from '../services/analyzer';
import type { FileEntry, FileSuggestion } from '../types';

function makeFile(overrides: Partial<FileEntry> = {}): FileEntry {
  return {
    id: `id-${Math.random()}`,
    name: 'test.pdf',
    extension: 'pdf',
    size: 1024,
    modifiedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    absolutePath: '/home/user/Downloads/test.pdf',
    relativePath: 'test.pdf',
    mimeType: 'application/pdf',
    isDirectory: false,
    isSymlink: false,
    ...overrides,
  };
}

function makeSuggestion(file: FileEntry, overrides: Partial<FileSuggestion> = {}): FileSuggestion {
  return {
    fileId: file.id,
    file,
    suggestion: {
      category: 'Documents',
      suggestedName: 'Suggested_Name.pdf',
      suggestedFolder: 'Documents',
      explanation: 'Test suggestion',
      confidence: 0.9,
      needsReview: false,
      source: 'rule',
    },
    userSuggestedName: 'Suggested_Name.pdf',
    userSuggestedFolder: '/home/user/Downloads/Documents',
    selected: true,
    status: 'pending',
    ...overrides,
  };
}

// ─── detectDuplicatesByNameSize ───────────────────────────────────────────────

describe('detectDuplicatesByNameSize', () => {
  it('detects files with identical name and size', () => {
    const f1 = makeFile({ name: 'dup.pdf', size: 2048, absolutePath: '/a/dup.pdf' });
    const f2 = makeFile({ name: 'dup.pdf', size: 2048, absolutePath: '/b/dup.pdf' });
    const f3 = makeFile({ name: 'unique.pdf', size: 100, absolutePath: '/c/unique.pdf' });

    const groups = detectDuplicatesByNameSize([f1, f2, f3]);
    expect(groups).toHaveLength(1);
    expect(groups[0].files).toHaveLength(2);
    expect(groups[0].type).toBe('name-size');
  });

  it('returns empty for all unique files', () => {
    const files = [
      makeFile({ name: 'a.pdf', size: 100 }),
      makeFile({ name: 'b.pdf', size: 200 }),
      makeFile({ name: 'a.pdf', size: 200 }), // same name, different size — not a dup
    ];
    const groups = detectDuplicatesByNameSize(files);
    expect(groups).toHaveLength(0);
  });

  it('handles empty file list', () => {
    expect(detectDuplicatesByNameSize([])).toHaveLength(0);
  });

  it('detects multiple duplicate groups', () => {
    const f1 = makeFile({ name: 'x.png', size: 50, absolutePath: '/a/x.png' });
    const f2 = makeFile({ name: 'x.png', size: 50, absolutePath: '/b/x.png' });
    const f3 = makeFile({ name: 'y.mp4', size: 999, absolutePath: '/a/y.mp4' });
    const f4 = makeFile({ name: 'y.mp4', size: 999, absolutePath: '/c/y.mp4' });
    const groups = detectDuplicatesByNameSize([f1, f2, f3, f4]);
    expect(groups).toHaveLength(2);
  });

  it('is case-insensitive for filenames', () => {
    const f1 = makeFile({ name: 'Document.PDF', size: 100, absolutePath: '/a/Document.PDF' });
    const f2 = makeFile({ name: 'document.pdf', size: 100, absolutePath: '/b/document.pdf' });
    const groups = detectDuplicatesByNameSize([f1, f2]);
    expect(groups).toHaveLength(1);
  });
});

// ─── buildOperations ─────────────────────────────────────────────────────────

describe('buildOperations', () => {
  const baseFolder = '/home/user/Downloads';

  it('builds operations only for selected pending suggestions', () => {
    const f1 = makeFile({ absolutePath: '/home/user/Downloads/a.pdf' });
    const f2 = makeFile({ id: 'id-2', absolutePath: '/home/user/Downloads/b.pdf', name: 'b.pdf' });
    const suggestions: FileSuggestion[] = [
      makeSuggestion(f1, { selected: true, status: 'pending' }),
      makeSuggestion(f2, { selected: false, status: 'pending' }),
    ];
    const ops = buildOperations(suggestions, baseFolder);
    expect(ops).toHaveLength(1);
    expect(ops[0].sourcePath).toBe(f1.absolutePath);
  });

  it('skips already applied suggestions', () => {
    const f = makeFile({ absolutePath: '/home/user/Downloads/a.pdf' });
    const suggestions = [makeSuggestion(f, { selected: true, status: 'applied' })];
    const ops = buildOperations(suggestions, baseFolder);
    expect(ops).toHaveLength(0);
  });

  it('skips rejected suggestions', () => {
    const f = makeFile({ absolutePath: '/home/user/Downloads/a.pdf' });
    const suggestions = [makeSuggestion(f, { selected: true, status: 'rejected' })];
    const ops = buildOperations(suggestions, baseFolder);
    expect(ops).toHaveLength(0);
  });

  it('uses user-edited name in destination', () => {
    const f = makeFile({ absolutePath: '/home/user/Downloads/old.pdf', name: 'old.pdf' });
    const sg = makeSuggestion(f, {
      selected: true,
      status: 'pending',
      userSuggestedName: 'Invoice_2026.pdf',
      userSuggestedFolder: `${baseFolder}/Documents/Invoices`,
    });
    const ops = buildOperations([sg], baseFolder);
    expect(ops[0].newName).toBe('Invoice_2026.pdf');
    expect(ops[0].destinationPath).toContain('Invoice_2026.pdf');
  });

  it('assigns a unique UUID per operation', () => {
    const f1 = makeFile({ id: 'x1', absolutePath: '/home/user/Downloads/a.pdf' });
    const f2 = makeFile({ id: 'x2', absolutePath: '/home/user/Downloads/b.pdf', name: 'b.pdf' });
    const ops = buildOperations([
      makeSuggestion(f1, { selected: true }),
      makeSuggestion(f2, { selected: true }),
    ], baseFolder);
    expect(ops[0].id).not.toBe(ops[1].id);
  });

  it('sets status to pending', () => {
    const f = makeFile({ absolutePath: '/home/user/Downloads/a.pdf' });
    const ops = buildOperations([makeSuggestion(f, { selected: true })], baseFolder);
    expect(ops[0].status).toBe('pending');
  });
});
