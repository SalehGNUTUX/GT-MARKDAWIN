// Type declarations for Electron's contextBridge API

interface OpenFileData {
  content?: string;
  isHtml?: boolean;
  filePath: string;
  // Office documents are delivered as raw base64 for the renderer to convert
  office?: boolean;
  name?: string;
  dataBase64?: string;
}

interface OfficeConvertResult {
  success: boolean;
  html?: string;
  reason?: 'no-libreoffice';
  error?: string;
}

interface ElectronAPI {
  isElectron: true;
  printToPDF: (htmlContent: string) => Promise<{ success: boolean; path?: string; error?: string }>;
  saveFile: (opts: { defaultName: string; content: string; mimeType?: string }) => Promise<{ success: boolean; path?: string }>;
  writeFile: (opts: { path: string; content: string }) => Promise<{ success: boolean; path?: string; error?: string }>;
  getFontBase64: (fontRelPath: string) => Promise<string | null>;
  convertOffice?: (opts: { name: string; dataBase64: string }) => Promise<OfficeConvertResult>;
  onOpenFile: (cb: (data: OpenFileData) => void) => void;
  removeOpenFileListener: () => void;
  onOpenFileError?: (cb: (message: string) => void) => void;
  notifyReady?: () => void;
  forceClose: () => void;
}

declare interface Window {
  electronAPI?: ElectronAPI;
}
