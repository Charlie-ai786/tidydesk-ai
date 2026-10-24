import { contextBridge, ipcRenderer } from 'electron';

const validChannels = {
  invoke: [
    'dialog:open-folder',
    'fs:scan-folder',
    'fs:compute-hash',
    'fs:execute-operations',
    'fs:undo-operation',
    'db:get-history',
    'db:clear-history',
    'ollama:check-status',
    'ollama:classify',
    'shell:show-in-folder',
  ],
} as const;

type InvokeChannel = typeof validChannels.invoke[number];

contextBridge.exposeInMainWorld('electronAPI', {
  invoke: (channel: string, ...args: unknown[]) => {
    if ((validChannels.invoke as readonly string[]).includes(channel)) {
      return ipcRenderer.invoke(channel, ...args);
    }
    throw new Error(`Channel "${channel}" is not allowed.`);
  },
});

// Convenience typed methods
contextBridge.exposeInMainWorld('tidydesk', {
  openFolder: () => ipcRenderer.invoke('dialog:open-folder'),
  scanFolder: (folderPath: string, options: unknown) =>
    ipcRenderer.invoke('fs:scan-folder', folderPath, options),
  computeHash: (filePath: string) =>
    ipcRenderer.invoke('fs:compute-hash', filePath),
  executeOperations: (operations: unknown[]) =>
    ipcRenderer.invoke('fs:execute-operations', operations),
  undoOperation: (operationId: string) =>
    ipcRenderer.invoke('fs:undo-operation', operationId),
  getHistory: () => ipcRenderer.invoke('db:get-history'),
  clearHistory: () => ipcRenderer.invoke('db:clear-history'),
  checkOllama: () => ipcRenderer.invoke('ollama:check-status'),
  classify: (payload: unknown) => ipcRenderer.invoke('ollama:classify', payload),
  showInFolder: (filePath: string) => ipcRenderer.invoke('shell:show-in-folder', filePath),
});
