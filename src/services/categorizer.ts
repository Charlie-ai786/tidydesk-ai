import { FileEntry, AISuggestion, FileCategory } from '../types';

// ─── Deterministic Rules ──────────────────────────────────────────────────────

const EXT_CATEGORY_MAP: Record<string, { category: FileCategory; folder: string }> = {
  // Images
  png: { category: 'Images and Screenshots', folder: 'Images' },
  jpg: { category: 'Images and Screenshots', folder: 'Images' },
  jpeg: { category: 'Images and Screenshots', folder: 'Images' },
  gif: { category: 'Images and Screenshots', folder: 'Images' },
  webp: { category: 'Images and Screenshots', folder: 'Images' },
  svg: { category: 'Images and Screenshots', folder: 'Images/SVG' },
  bmp: { category: 'Images and Screenshots', folder: 'Images' },
  tiff: { category: 'Images and Screenshots', folder: 'Images' },
  heic: { category: 'Images and Screenshots', folder: 'Images' },
  ico: { category: 'Images and Screenshots', folder: 'Images/Icons' },

  // Videos
  mp4: { category: 'Videos', folder: 'Videos' },
  avi: { category: 'Videos', folder: 'Videos' },
  mov: { category: 'Videos', folder: 'Videos' },
  mkv: { category: 'Videos', folder: 'Videos' },
  webm: { category: 'Videos', folder: 'Videos' },
  flv: { category: 'Videos', folder: 'Videos' },
  wmv: { category: 'Videos', folder: 'Videos' },
  m4v: { category: 'Videos', folder: 'Videos' },

  // Audio
  mp3: { category: 'Audio', folder: 'Audio' },
  wav: { category: 'Audio', folder: 'Audio' },
  ogg: { category: 'Audio', folder: 'Audio' },
  flac: { category: 'Audio', folder: 'Audio' },
  aac: { category: 'Audio', folder: 'Audio' },
  m4a: { category: 'Audio', folder: 'Audio' },
  wma: { category: 'Audio', folder: 'Audio' },

  // Archives
  zip: { category: 'Archives', folder: 'Archives' },
  rar: { category: 'Archives', folder: 'Archives' },
  '7z': { category: 'Archives', folder: 'Archives' },
  tar: { category: 'Archives', folder: 'Archives' },
  gz: { category: 'Archives', folder: 'Archives' },
  bz2: { category: 'Archives', folder: 'Archives' },
  xz: { category: 'Archives', folder: 'Archives' },

  // Code
  js: { category: 'Code and Development', folder: 'Code/JavaScript' },
  ts: { category: 'Code and Development', folder: 'Code/TypeScript' },
  tsx: { category: 'Code and Development', folder: 'Code/TypeScript' },
  jsx: { category: 'Code and Development', folder: 'Code/JavaScript' },
  py: { category: 'Code and Development', folder: 'Code/Python' },
  rs: { category: 'Code and Development', folder: 'Code/Rust' },
  go: { category: 'Code and Development', folder: 'Code/Go' },
  java: { category: 'Code and Development', folder: 'Code/Java' },
  cpp: { category: 'Code and Development', folder: 'Code/C++' },
  c: { category: 'Code and Development', folder: 'Code/C' },
  h: { category: 'Code and Development', folder: 'Code/C' },
  cs: { category: 'Code and Development', folder: 'Code/CSharp' },
  php: { category: 'Code and Development', folder: 'Code/PHP' },
  rb: { category: 'Code and Development', folder: 'Code/Ruby' },
  swift: { category: 'Code and Development', folder: 'Code/Swift' },
  kt: { category: 'Code and Development', folder: 'Code/Kotlin' },
  sh: { category: 'Code and Development', folder: 'Code/Scripts' },
  bat: { category: 'Code and Development', folder: 'Code/Scripts' },
  ps1: { category: 'Code and Development', folder: 'Code/Scripts' },

  // Documents (need AI to sub-classify)
  pdf: { category: 'Documents', folder: 'Documents' },
  doc: { category: 'Documents', folder: 'Documents' },
  docx: { category: 'Documents', folder: 'Documents' },
  xls: { category: 'Documents', folder: 'Documents/Spreadsheets' },
  xlsx: { category: 'Documents', folder: 'Documents/Spreadsheets' },
  ppt: { category: 'Documents', folder: 'Documents/Presentations' },
  pptx: { category: 'Documents', folder: 'Documents/Presentations' },
  txt: { category: 'Documents', folder: 'Documents/Text' },
  md: { category: 'Documents', folder: 'Documents/Markdown' },
  csv: { category: 'Documents', folder: 'Documents/Spreadsheets' },
  rtf: { category: 'Documents', folder: 'Documents' },
  odt: { category: 'Documents', folder: 'Documents' },
  pages: { category: 'Documents', folder: 'Documents' },
};

// Patterns that suggest specific sub-categories
const NAME_PATTERNS: { pattern: RegExp; category: FileCategory; folder: string }[] = [
  { pattern: /invoice|receipt|bill|payment|order/i, category: 'Invoices and Receipts', folder: 'Documents/Invoices' },
  { pattern: /resume|cv|curriculum/i, category: 'Career and Resume', folder: 'Documents/Career' },
  { pattern: /screenshot|screen shot|capture/i, category: 'Images and Screenshots', folder: 'Images/Screenshots' },
  { pattern: /assignment|homework|lab|report|project/i, category: 'Assignments and Reports', folder: 'Documents/Assignments' },
  { pattern: /notes?|lecture|class|study/i, category: 'Academic Notes', folder: 'Documents/Academic' },
  { pattern: /cover.?letter|job|application/i, category: 'Career and Resume', folder: 'Documents/Career' },
];

// Types that always benefit from AI
const AI_PREFERRED_EXTS = new Set(['pdf', 'doc', 'docx', 'txt', 'md', 'rtf', 'odt']);

export interface DeterministicResult {
  category: FileCategory;
  folder: string;
  needsAI: boolean;
  confidence: number;
}

export function classifyByRules(file: FileEntry): DeterministicResult {
  const ext = file.extension.toLowerCase();
  const nameBase = file.name.replace(/\.[^.]+$/, '');
  const extMatch = EXT_CATEGORY_MAP[ext];

  // Strong media, code, and archive types are never overridden by document name patterns
  if (extMatch && ['Videos', 'Audio', 'Archives', 'Code and Development'].includes(extMatch.category)) {
    return {
      category: extMatch.category,
      folder: extMatch.folder,
      needsAI: false,
      confidence: 0.9,
    };
  }

  // Check name patterns first (higher specificity for documents, screenshots, etc.)
  for (const p of NAME_PATTERNS) {
    if (p.pattern.test(nameBase)) {
      return {
        category: p.category,
        folder: p.folder,
        needsAI: AI_PREFERRED_EXTS.has(ext),
        confidence: 0.75,
      };
    }
  }

  // Extension-based classification
  if (extMatch) {
    return {
      category: extMatch.category,
      folder: extMatch.folder,
      needsAI: AI_PREFERRED_EXTS.has(ext),
      confidence: AI_PREFERRED_EXTS.has(ext) ? 0.6 : 0.9,
    };
  }

  return {
    category: 'Miscellaneous',
    folder: 'Miscellaneous',
    needsAI: true,
    confidence: 0.3,
  };
}

export function buildDeterministicSuggestion(file: FileEntry): AISuggestion {
  const rules = classifyByRules(file);
  return {
    category: rules.category,
    suggestedName: file.name, // Keep original for pure rule-based
    suggestedFolder: rules.folder,
    explanation: `Categorized as ${rules.category} based on file extension (.${file.extension}) and filename patterns.`,
    confidence: rules.confidence,
    needsReview: rules.confidence < 0.7,
    source: 'rule',
  };
}

// Format file size human-readable
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

// Format relative date
export function formatRelativeDate(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

export function getCategoryIcon(category: FileCategory): string {
  const icons: Record<FileCategory, string> = {
    'Documents': '📄',
    'Academic Notes': '📚',
    'Assignments and Reports': '📋',
    'Invoices and Receipts': '🧾',
    'Career and Resume': '💼',
    'Images and Screenshots': '🖼️',
    'Videos': '🎬',
    'Audio': '🎵',
    'Archives': '📦',
    'Code and Development': '💻',
    'Miscellaneous': '📁',
  };
  return icons[category] ?? '📁';
}

export function getConfidenceBadge(confidence: number): { label: string; color: string } {
  if (confidence >= 0.85) return { label: 'High', color: 'text-emerald-400 bg-emerald-400/10' };
  if (confidence >= 0.65) return { label: 'Medium', color: 'text-amber-400 bg-amber-400/10' };
  return { label: 'Low', color: 'text-rose-400 bg-rose-400/10' };
}
