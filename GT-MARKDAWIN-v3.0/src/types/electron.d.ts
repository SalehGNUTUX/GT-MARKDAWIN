// Type declarations for Electron's contextBridge API

interface OpenFileData { content: string; isHtml: boolean; filePath: string; }

interface ElectronAPI {
  isElectron: true;
  printToPDF: (htmlContent: string) => Promise<{ success: boolean; path?: string; error?: string }>;
  saveFile: (opts: { defaultName: string; content: string; mimeType?: string }) => Promise<{ success: boolean; path?: string }>;
  getFontBase64: (fontRelPath: string) => Promise<string | null>;
  onOpenFile: (cb: (data: OpenFileData) => void) => void;
  removeOpenFileListener: () => void;
  forceClose: () => void;
}

declare interface Window {
  electronAPI?: ElectronAPI;
}
