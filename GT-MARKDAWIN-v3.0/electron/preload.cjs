'use strict';
// GT-MARKDAWIN — Preload Script — GNU GPL v3

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,

  // Print to native PDF via Electron
  printToPDF: (htmlContent) => ipcRenderer.invoke('print-to-pdf', htmlContent),

  // Save file via native dialog
  saveFile: (opts) => ipcRenderer.invoke('save-file', opts),

  // Write content directly to a known path (no dialog) — used by auto-save
  writeFile: (opts) => ipcRenderer.invoke('write-file', opts),

  // Get font as base64 for PDF embedding
  getFontBase64: (fontRelPath) => ipcRenderer.invoke('get-font-base64', fontRelPath),

  // Convert an office document (docx/doc/odt/odf) → HTML via LibreOffice
  convertOffice: (opts) => ipcRenderer.invoke('convert-office', opts),

  // Listen for files opened from the OS file manager ("Open with")
  onOpenFile: (callback) => {
    ipcRenderer.on('open-file', (_event, data) => callback(data));
  },

  removeOpenFileListener: () => {
    ipcRenderer.removeAllListeners('open-file');
  },

  // Listen for OS-open read errors (e.g. unreadable path)
  onOpenFileError: (callback) => {
    ipcRenderer.on('open-file-error', (_event, message) => callback(message));
  },

  // Tell the main process the renderer is ready to receive a pending file.
  // Flushes any file the app was launched with (fixes the OS "Open with" race).
  notifyReady: () => ipcRenderer.send('renderer-ready'),

  // Force close — destroys the window from main process, bypasses beforeunload
  forceClose: () => ipcRenderer.send('force-close'),
});
