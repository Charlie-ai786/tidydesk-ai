import '@testing-library/jest-dom';

// Mock the Electron bridge for testing
const mockTidydesk = {
  openFolder: vi.fn().mockResolvedValue(null),
  scanFolder: vi.fn().mockResolvedValue([]),
  computeHash: vi.fn().mockResolvedValue(null),
  executeOperations: vi.fn().mockResolvedValue([]),
  undoOperation: vi.fn().mockResolvedValue({ success: true }),
  getHistory: vi.fn().mockResolvedValue([]),
  clearHistory: vi.fn().mockResolvedValue(true),
  checkOllama: vi.fn().mockResolvedValue({ running: false, models: [] }),
  classify: vi.fn().mockResolvedValue({ success: false, error: 'test mode' }),
  showInFolder: vi.fn().mockResolvedValue(undefined),
};

Object.defineProperty(window, 'tidydesk', {
  value: mockTidydesk,
  writable: true,
});

// Suppress console noise in tests
globalThis.console.warn = vi.fn();
