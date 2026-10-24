import { describe, it, expect } from 'vitest';
import { classifyByRules, buildDeterministicSuggestion, formatFileSize, getConfidenceBadge } from '../services/categorizer';
import type { FileEntry } from '../types';

function makeFile(overrides: Partial<FileEntry> = {}): FileEntry {
  return {
    id: 'test-id',
    name: 'test.pdf',
    extension: 'pdf',
    size: 1024,
    modifiedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    absolutePath: '/tmp/test.pdf',
    relativePath: 'test.pdf',
    mimeType: 'application/pdf',
    isDirectory: false,
    isSymlink: false,
    ...overrides,
  };
}

// ─── classifyByRules ─────────────────────────────────────────────────────────

describe('classifyByRules', () => {
  it('classifies image files correctly', () => {
    const result = classifyByRules(makeFile({ name: 'photo.jpg', extension: 'jpg', mimeType: 'image/jpeg' }));
    expect(result.category).toBe('Images and Screenshots');
    expect(result.confidence).toBeGreaterThan(0.8);
    expect(result.needsAI).toBe(false);
  });

  it('classifies video files correctly', () => {
    const result = classifyByRules(makeFile({ name: 'lecture.mp4', extension: 'mp4', mimeType: 'video/mp4' }));
    expect(result.category).toBe('Videos');
  });

  it('classifies audio files correctly', () => {
    const result = classifyByRules(makeFile({ name: 'song.mp3', extension: 'mp3', mimeType: 'audio/mpeg' }));
    expect(result.category).toBe('Audio');
  });

  it('classifies archive files correctly', () => {
    const result = classifyByRules(makeFile({ name: 'backup.zip', extension: 'zip' }));
    expect(result.category).toBe('Archives');
  });

  it('classifies code files correctly', () => {
    const result = classifyByRules(makeFile({ name: 'main.py', extension: 'py' }));
    expect(result.category).toBe('Code and Development');
    expect(result.confidence).toBeGreaterThan(0.8);
  });

  it('detects invoice by filename pattern', () => {
    const result = classifyByRules(makeFile({ name: 'invoice_001.pdf', extension: 'pdf' }));
    expect(result.category).toBe('Invoices and Receipts');
  });

  it('detects resume by filename pattern', () => {
    const result = classifyByRules(makeFile({ name: 'my_resume_2026.docx', extension: 'docx' }));
    expect(result.category).toBe('Career and Resume');
  });

  it('detects screenshot by filename', () => {
    const result = classifyByRules(makeFile({ name: 'screenshot_2026-10-20.png', extension: 'png' }));
    expect(result.category).toBe('Images and Screenshots');
  });

  it('classifies academic notes by name', () => {
    const result = classifyByRules(makeFile({ name: 'lecture_notes_week3.txt', extension: 'txt' }));
    expect(result.category).toBe('Academic Notes');
  });

  it('returns Miscellaneous for unknown extensions', () => {
    const result = classifyByRules(makeFile({ name: 'unknown.xyz', extension: 'xyz' }));
    expect(result.category).toBe('Miscellaneous');
    expect(result.needsAI).toBe(true);
  });

  it('marks PDFs as needing AI', () => {
    const result = classifyByRules(makeFile({ name: 'document.pdf', extension: 'pdf' }));
    expect(result.needsAI).toBe(true);
  });

  it('does not need AI for images', () => {
    const result = classifyByRules(makeFile({ name: 'img.png', extension: 'png' }));
    expect(result.needsAI).toBe(false);
  });
});

// ─── buildDeterministicSuggestion ────────────────────────────────────────────

describe('buildDeterministicSuggestion', () => {
  it('preserves original filename extension', () => {
    const file = makeFile({ name: 'report.pdf', extension: 'pdf' });
    const suggestion = buildDeterministicSuggestion(file);
    expect(suggestion.suggestedName).toBe('report.pdf');
    expect(suggestion.suggestedName.endsWith('.pdf')).toBe(true);
  });

  it('marks source as rule', () => {
    const suggestion = buildDeterministicSuggestion(makeFile());
    expect(suggestion.source).toBe('rule');
  });

  it('includes a non-empty explanation', () => {
    const suggestion = buildDeterministicSuggestion(makeFile({ extension: 'jpg' }));
    expect(suggestion.explanation.length).toBeGreaterThan(0);
  });

  it('confidence is between 0 and 1', () => {
    const suggestion = buildDeterministicSuggestion(makeFile());
    expect(suggestion.confidence).toBeGreaterThanOrEqual(0);
    expect(suggestion.confidence).toBeLessThanOrEqual(1);
  });
});

// ─── formatFileSize ───────────────────────────────────────────────────────────

describe('formatFileSize', () => {
  it('formats bytes', () => { expect(formatFileSize(512)).toBe('512 B'); });
  it('formats kilobytes', () => { expect(formatFileSize(1536)).toBe('1.5 KB'); });
  it('formats megabytes', () => { expect(formatFileSize(2.5 * 1024 * 1024)).toBe('2.5 MB'); });
  it('formats gigabytes', () => { expect(formatFileSize(1.5 * 1024 * 1024 * 1024)).toBe('1.50 GB'); });
  it('handles zero', () => { expect(formatFileSize(0)).toBe('0 B'); });
});

// ─── getConfidenceBadge ───────────────────────────────────────────────────────

describe('getConfidenceBadge', () => {
  it('returns High for >= 0.85', () => {
    expect(getConfidenceBadge(0.9).label).toBe('High');
    expect(getConfidenceBadge(0.85).label).toBe('High');
  });
  it('returns Medium for 0.65–0.84', () => {
    expect(getConfidenceBadge(0.7).label).toBe('Medium');
  });
  it('returns Low for < 0.65', () => {
    expect(getConfidenceBadge(0.4).label).toBe('Low');
  });
});
