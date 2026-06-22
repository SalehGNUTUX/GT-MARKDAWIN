'use strict';
// GT-MARKDAWIN — Electron Main Process
// Copyright © 2026 SalehGNUTUX — GNU GPL v3

const { app, BrowserWindow, shell, Menu, ipcMain, dialog } = require('electron');
const path = require('path');
const fs   = require('fs');
const url  = require('url');
const os   = require('os');
const { execFile } = require('child_process');

const IS_DEV = process.env.NODE_ENV === 'development';

// ── Window + file-open state ──────────────────────────────────────────────────
let mainWindow = null;        // the single main window
let rendererReady = false;    // true once the renderer registered its open-file listener
let pendingFileToOpen = null; // a file waiting to be handed to the renderer

// ── Normalize a CLI/URL argument into a readable filesystem path ───────────────
// Handles plain paths, file:// URLs (some file managers pass these), relative paths.
function normalizeFilePath(arg) {
  let p = arg;
  if (p.startsWith('file://')) {
    try { p = url.fileURLToPath(p); } catch { return null; }
  }
  try { p = path.resolve(p); } catch { /* keep p */ }
  return p;
}

// ── Find the first openable file inside an argv array ─────────────────────────
// e.g. `gt-markdawin myfile.md` or a double-click in the file manager.
function extractFileArg(argv) {
  for (const a of argv) {
    if (!a || a.startsWith('-')) continue;
    if (a === '.' || a === app.getAppPath()) continue; // skip the dev "." entry
    const looksLikeFile = /\.(md|txt|markdown|html?|docx?|odt|odf|fodt)$/i.test(a.replace(/^file:\/\//, ''));
    if (!looksLikeFile) continue;
    const p = normalizeFilePath(a);
    if (p) return p;
  }
  return null;
}

// Cold start: app launched directly with a file argument
pendingFileToOpen = extractFileArg(process.argv.slice(1));

// ── Single-instance lock ──────────────────────────────────────────────────────
// Without this, "Open with" on a running app spawns a 2nd instance instead of
// handing the file to the existing window — so the file appears not to open.
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    const f = extractFileArg(argv.slice(1));
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
    if (f) openInRenderer(f);
  });
}


// ── Resource path helper ──────────────────────────────────────────────────────
function res(...parts) {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'app', ...parts);
  }
  return path.join(__dirname, '..', ...parts);
}

// ── Create main window ────────────────────────────────────────────────────────
function createWindow() {
  const win = new BrowserWindow({
    width:    1440,
    height:   900,
    minWidth: 800,
    minHeight: 560,
    title: 'GT-MARKDAWIN',
    icon: res('public', 'icon.png'),
    show: false,                    // show after ready-to-show
    backgroundColor: '#0d1117',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: !IS_DEV,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  // Remove application menu
  Menu.setApplicationMenu(null);

  mainWindow = win;
  win.on('closed', () => { mainWindow = null; rendererReady = false; });

  // Show once loaded (prevents white flash). A pending file is NOT sent here —
  // it is flushed only after the renderer signals it is ready (renderer-ready),
  // which removes the old race where the file was sent before the listener existed.
  win.once('ready-to-show', () => {
    win.show();
  });

  if (IS_DEV) {
    // يحترم منفذ Vite الفعلي إن اختلف عن 5173 (مثلاً عند انشغال المنفذ)
    win.loadURL(process.env.VITE_DEV_URL || 'http://localhost:5173');
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  // ── Window open: target="_blank" links ──────────────────────────────────────
  win.webContents.setWindowOpenHandler(({ url }) => {
    // Allow blank / blob: / data: (used for print dialogs in browser mode)
    if (!url || url === 'about:blank' || url.startsWith('blob:') || url.startsWith('data:')) {
      return { action: 'allow' };
    }
    // Open external links in the system's default browser
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  // ── Prevent in-app navigation to external URLs ───────────────────────────────
  win.webContents.on('will-navigate', (event, url) => {
    const isLocal = url.startsWith('file://') || url.startsWith('http://localhost');
    if (!isLocal) {
      event.preventDefault();
      if (/^https?:\/\//.test(url)) shell.openExternal(url);
    }
  });

  // ── Prevent renderer from redirecting the window (e.g., <a href> without target) ──
  win.webContents.on('did-start-navigation', (event, url, isInPlace) => {
    if (!isInPlace) return; // only block same-page navigations going external
    const isLocal = url.startsWith('file://') || url.startsWith('http://localhost');
    if (!isLocal && /^https?:\/\//.test(url)) {
      event.preventDefault?.();
      shell.openExternal(url);
    }
  });

  return win;
}

// ── IPC: Force close — destroys window bypassing beforeunload ─────────────────
ipcMain.on('force-close', () => {
  BrowserWindow.getAllWindows().forEach(w => w.destroy());
});

// ── Helper: read a file and push it to the renderer ───────────────────────────
function sendFileToRenderer(filePath) {
  if (!mainWindow) return;
  try {
    const p = normalizeFilePath(filePath) || filePath;
    // Office documents: deliver raw bytes (base64); the renderer converts them.
    if (/\.(docx?|odt|odf|fodt)$/i.test(p)) {
      const buf = fs.readFileSync(p);
      mainWindow.webContents.send('open-file', {
        office: true,
        name: path.basename(p),
        dataBase64: buf.toString('base64'),
        filePath: p,
      });
      return;
    }
    const content = fs.readFileSync(p, 'utf-8');
    const isHtml = /\.(html?|htm)$/i.test(p);
    mainWindow.webContents.send('open-file', { content, isHtml, filePath: p });
  } catch (err) {
    console.error('Could not open file:', err);
    if (mainWindow) {
      mainWindow.webContents.send('open-file-error', String(err?.message || err));
    }
  }
}

// ── Open a file in the renderer now, or queue it until the renderer is ready ──
function openInRenderer(filePath) {
  if (rendererReady && mainWindow) {
    sendFileToRenderer(filePath);
  } else {
    pendingFileToOpen = filePath;
  }
}

// ── Renderer handshake: flush any pending file once the listener is registered ─
ipcMain.on('renderer-ready', () => {
  rendererReady = true;
  if (pendingFileToOpen && mainWindow) {
    const f = pendingFileToOpen;
    pendingFileToOpen = null;
    sendFileToRenderer(f);
  }
});

// ── macOS / Linux: handle file opened via "Open with" ────────────────────────
app.on('open-file', (event, filePath) => {
  event.preventDefault();
  openInRenderer(filePath);
});

// ── IPC: Print to PDF (loads HTML via data URL — works fully offline) ─────────
ipcMain.handle('print-to-pdf', async (event, htmlContent) => {
  const senderWin = BrowserWindow.fromWebContents(event.sender);
  if (!senderWin) return { success: false, error: 'No window' };

  const printWin = new BrowserWindow({
    show: false,
    width: 900,
    height: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // Allow data: URLs and local resources
    },
  });

  try {
    // Load HTML via base64 data URL — no external network required
    const b64 = Buffer.from(htmlContent, 'utf-8').toString('base64');
    await printWin.loadURL(`data:text/html;base64,${b64}`);

    // Give page time to render (fonts, layout)
    await new Promise(r => setTimeout(r, 800));

    // margins use CSS @page rules embedded in the HTML
    // marginType:'none' lets the CSS @page { margin: ... } take full control
    const pdfData = await printWin.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      margins: { marginType: 'none' },
      landscape: false,
    });

    printWin.close();

    const { filePath, canceled } = await dialog.showSaveDialog(senderWin, {
      title: 'حفظ PDF — GT-MARKDAWIN',
      defaultPath: path.join(app.getPath('documents'), `GT-MD-${Date.now()}.pdf`),
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
    });

    if (!canceled && filePath) {
      fs.writeFileSync(filePath, pdfData);
      return { success: true, path: filePath };
    }
    return { success: false, error: 'cancelled' };

  } catch (err) {
    try { printWin.close(); } catch {}
    return { success: false, error: String(err) };
  }
});

// ── IPC: Show save dialog ────────────────────────────────────────────────────
ipcMain.handle('save-file', async (event, { defaultName, content, mimeType }) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const ext = defaultName.split('.').pop() ?? 'txt';

  const { filePath, canceled } = await dialog.showSaveDialog(win, {
    title: 'حفظ الملف',
    defaultPath: path.join(app.getPath('documents'), defaultName),
    filters: [{ name: ext.toUpperCase(), extensions: [ext] }],
  });

  if (!canceled && filePath) {
    fs.writeFileSync(filePath, content, 'utf-8');
    return { success: true, path: filePath };
  }
  return { success: false };
});

// ── IPC: Write content directly to a known path (no dialog) — for auto-save ──
ipcMain.handle('write-file', (_event, { path: filePath, content }) => {
  try {
    if (!filePath) return { success: false, error: 'no-path' };
    const p = filePath.startsWith('file://') ? url.fileURLToPath(filePath) : filePath;
    fs.writeFileSync(p, content, 'utf-8');
    return { success: true, path: p };
  } catch (err) {
    return { success: false, error: String(err && err.message || err) };
  }
});

// ── IPC: Read font as base64 for PDF embedding ───────────────────────────────
ipcMain.handle('get-font-base64', (_event, fontRelPath) => {
  try {
    const fontPath = app.isPackaged
      ? path.join(process.resourcesPath, 'app', 'dist', fontRelPath)
      : path.join(__dirname, '..', 'dist', fontRelPath);
    const data = fs.readFileSync(fontPath);
    return data.toString('base64');
  } catch {
    return null;
  }
});

// ── LibreOffice: locate the soffice binary (cached) ───────────────────────────
let _sofficePath; // undefined = not probed yet, null = not found
function resolveSoffice() {
  if (_sofficePath !== undefined) return _sofficePath;
  const candidates = process.platform === 'win32'
    ? [
        path.join(process.env['ProgramFiles'] || 'C:/Program Files', 'LibreOffice/program/soffice.exe'),
        path.join(process.env['ProgramFiles(x86)'] || 'C:/Program Files (x86)', 'LibreOffice/program/soffice.exe'),
      ]
    : process.platform === 'darwin'
      ? ['/Applications/LibreOffice.app/Contents/MacOS/soffice', '/usr/local/bin/soffice']
      : [
          '/usr/bin/soffice', '/usr/bin/libreoffice',
          '/usr/local/bin/soffice', '/snap/bin/libreoffice',
          '/opt/libreoffice/program/soffice',
          '/var/lib/flatpak/exports/bin/org.libreoffice.LibreOffice',
        ];
  for (const c of candidates) {
    try { if (fs.existsSync(c)) { _sofficePath = c; return c; } } catch { /* ignore */ }
  }
  // Fall back to PATH lookup (execFile will resolve 'soffice' / 'libreoffice')
  _sofficePath = process.platform === 'win32' ? 'soffice.exe' : 'soffice';
  return _sofficePath;
}

// ── LibreOffice: convert an office file on disk → HTML ────────────────────────
function libreofficeToHtml(inputPath) {
  return new Promise((resolve) => {
    const soffice = resolveSoffice();
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gtmd-office-'));
    const profile = path.join(outDir, 'profile');
    const args = [
      '--headless', '--norestore', '--invisible', '--nologo',
      `-env:UserInstallation=file://${profile}`,
      '--convert-to', 'html:HTML (StarWriter)',
      '--outdir', outDir, inputPath,
    ];
    execFile(soffice, args, { timeout: 60000 }, (err) => {
      try {
        if (err && err.code === 'ENOENT') {
          return resolve({ success: false, reason: 'no-libreoffice' });
        }
        const base = path.basename(inputPath, path.extname(inputPath));
        const outPath = path.join(outDir, `${base}.html`);
        if (fs.existsSync(outPath)) {
          const html = fs.readFileSync(outPath, 'utf-8');
          return resolve({ success: true, html });
        }
        return resolve({ success: false, error: err ? String(err.message || err) : 'لم يُنتج LibreOffice ملف HTML' });
      } finally {
        try { fs.rmSync(outDir, { recursive: true, force: true }); } catch { /* ignore */ }
      }
    });
  });
}

// ── IPC: convert an office document (base64) → HTML via LibreOffice ───────────
ipcMain.handle('convert-office', async (_event, { name, dataBase64 }) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gtmd-in-'));
  const safe = String(name || 'input').replace(/[^a-zA-Z0-9._-]/g, '_') || 'input';
  const inPath = path.join(tmpDir, safe);
  try {
    fs.writeFileSync(inPath, Buffer.from(dataBase64, 'base64'));
    return await libreofficeToHtml(inPath);
  } catch (err) {
    return { success: false, error: String(err && err.message || err) };
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
});

// ── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
