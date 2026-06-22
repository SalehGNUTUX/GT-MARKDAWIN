import { useEffect, useState, useCallback, useRef } from 'react';
import { useApp, DEFAULT_CONTENT } from './context';
import ErrorBoundary from './components/ErrorBoundary';
import Header from './components/Header';
import Toolbar from './components/Toolbar';
import SplitPane from './components/SplitPane';
import StatusBar from './components/StatusBar';
import Footer from './components/Footer';
import EmojiPanel from './components/EmojiPanel';
import Notification from './components/Notification';
import LinkModal from './components/modals/LinkModal';
import ImageModal from './components/modals/ImageModal';
import VideoModal from './components/modals/VideoModal';
import AudioModal from './components/modals/AudioModal';
import GifModal from './components/modals/GifModal';
import MathModal from './components/modals/MathModal';
import FootnoteModal from './components/modals/FootnoteModal';
import TableModal from './components/modals/TableModal';
import { exportMarkdown } from './lib/export';
import { isOfficeFile, officeToMarkdown, base64ToArrayBuffer } from './lib/officeImport';

// ── Detect environment ────────────────────────────────────────────────────────
const isElectronEnv = () => typeof window !== 'undefined' && !!window.electronAPI?.isElectron;
const isCapacitorEnv = () => typeof (window as any).Capacitor !== 'undefined';

export default function App() {
  const {
    theme, fontFamily, fontSize, content, setContent, notify,
    autoSaveEnabled, setAutoSaveEnabled, autoSaveInterval,
    currentFile, setCurrentFile, setLastSavedAt,
  } = useApp();
  const [dragOver, setDragOver]         = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string; message: string;
    onSave: () => void; onDiscard: () => void; onCancel: () => void;
  } | null>(null);
  const [closeDialog, setCloseDialog]   = useState(false);
  // One-time prompt offering to turn on auto-save (on open / first edit)
  const [autoSavePrompt, setAutoSavePrompt] = useState<{ fileName?: string } | null>(null);
  const isIntentionalClose = useRef(false); // bypass beforeunload after user confirms

  // Always-fresh snapshots for use inside timers/callbacks (avoid stale closures)
  const contentRef = useRef(content);
  contentRef.current = content;
  const currentFileRef = useRef(currentFile);
  currentFileRef.current = currentFile;
  const autoSaveEnabledRef = useRef(autoSaveEnabled);
  autoSaveEnabledRef.current = autoSaveEnabled;
  const dirtyRef = useRef(false);            // content changed since last save?
  const lastSavedContentRef = useRef<string | null>(null); // text of the last save
  const newDocPromptedRef = useRef(false);   // already prompted for a fresh doc?
  const startedEmptyRef = useRef(!content.trim() || content === DEFAULT_CONTENT);

  // ── CSS variables for font ────────────────────────────────────────────────
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--editor-font', `'${fontFamily}'`);
    root.style.setProperty('--editor-font-size', `${fontSize}px`);
    root.style.setProperty('--preview-font-size', `${fontSize}px`);
  }, [fontFamily, fontSize]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // ── F11 fullscreen ───────────────────────────────────────────────────────
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'F11') {
        e.preventDefault();
        document.fullscreenElement
          ? document.exitFullscreen().catch(() => {})
          : document.documentElement.requestFullscreen().catch(() => {});
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  // ── Save helpers ──────────────────────────────────────────────────────────
  // Write directly to the bound file (no dialog). Returns true on success.
  const saveToCurrentFile = useCallback(async (text: string): Promise<boolean> => {
    const cf = currentFileRef.current;
    if (!cf?.path) return false;
    try {
      if (isElectronEnv() && window.electronAPI?.writeFile) {
        const res = await window.electronAPI.writeFile({ path: cf.path, content: text });
        if (!res.success) return false;
      } else if (isCapacitorEnv()) {
        const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
        if (cf.path.startsWith('content://') || cf.path.startsWith('file://')) {
          await Filesystem.writeFile({ path: cf.path, data: text, encoding: Encoding.UTF8 });
        } else {
          await Filesystem.writeFile({
            path: cf.path, data: text, directory: Directory.Documents, encoding: Encoding.UTF8,
          });
        }
      } else {
        return false; // browser has no real file handle
      }
      setLastSavedAt(Date.now());
      dirtyRef.current = false;
      lastSavedContentRef.current = text;
      return true;
    } catch {
      return false;
    }
  }, [setLastSavedAt]);

  // Background auto-save tick — silent; the status bar reflects the result
  const doAutoSave = useCallback(async () => {
    const text = contentRef.current;
    if (!text.trim()) return;
    if (currentFileRef.current?.path) {
      const ok = await saveToCurrentFile(text);
      if (!ok) notify('تعذّر الحفظ التلقائي — تحقّق من الملف', 'error');
    } else if (!isElectronEnv() && !isCapacitorEnv()) {
      // Browser: persist to localStorage and mark the save time
      try { localStorage.setItem('gt-md-content', text); } catch {}
      setLastSavedAt(Date.now());
      dirtyRef.current = false;
      lastSavedContentRef.current = text;
    }
  }, [saveToCurrentFile, notify, setLastSavedAt]);

  // Manual save (Ctrl+S / close dialog): write to the bound file, else "Save As"
  const saveNow = useCallback(async (): Promise<boolean> => {
    const text = contentRef.current;
    if (currentFileRef.current?.path && (isElectronEnv() || isCapacitorEnv())) {
      const ok = await saveToCurrentFile(text);
      notify(ok ? `حُفظ: ${currentFileRef.current?.name ?? ''} ✅` : 'تعذّر الحفظ', ok ? 'success' : 'error');
      return ok;
    }
    const res = await exportMarkdown(text, notify as any);
    if (res.success && res.path) {
      setCurrentFile({ path: res.path, name: res.name ?? res.path.split('/').pop() ?? 'مستند' });
      dirtyRef.current = false;
      setLastSavedAt(Date.now());
    }
    return res.success;
  }, [saveToCurrentFile, notify, setCurrentFile, setLastSavedAt]);
  const saveNowRef = useRef(saveNow);
  saveNowRef.current = saveNow;

  // Mark the document dirty whenever content changes
  useEffect(() => { dirtyRef.current = true; }, [content]);

  // ── Periodic background auto-save (only when enabled) ──────────────────────
  useEffect(() => {
    if (!autoSaveEnabled) return;
    const id = setInterval(() => {
      // Only write when there are real, unsaved changes
      if (dirtyRef.current && contentRef.current !== lastSavedContentRef.current) doAutoSave();
    }, Math.max(5, autoSaveInterval) * 1000);
    return () => clearInterval(id);
  }, [autoSaveEnabled, autoSaveInterval, doAutoSave]);

  // ── Turning auto-save on without a bound file → ask where to save (once) ───
  useEffect(() => {
    if (!autoSaveEnabled || currentFile) return;
    if (!isElectronEnv() && !isCapacitorEnv()) return; // browser uses localStorage
    let cancelled = false;
    (async () => {
      const res = await exportMarkdown(contentRef.current, notify as any);
      if (cancelled) return;
      if (res.success && res.path) {
        setCurrentFile({ path: res.path, name: res.name ?? res.path.split('/').pop() ?? 'مستند' });
        dirtyRef.current = false;
        setLastSavedAt(Date.now());
      } else {
        setAutoSaveEnabled(false); // cancelled the save dialog → keep it off
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSaveEnabled]);

  // ── Prompt to enable auto-save when the user starts a fresh document ───────
  useEffect(() => {
    if (autoSaveEnabled || newDocPromptedRef.current || currentFile) return;
    if (!startedEmptyRef.current) return;                  // only for an empty/new start
    if (!content.trim() || content === DEFAULT_CONTENT) return; // not edited yet
    newDocPromptedRef.current = true;
    setAutoSavePrompt({});
  }, [content, autoSaveEnabled, currentFile]);

  // ── Helper: ask user to save before replacing content ─────────────────────
  const confirmBeforeOpen = useCallback((
    newContent: string,
    isHtml: boolean,
    fileName: string,
    filePath?: string,
  ) => {
    const current = contentRef.current;

    const openNow = () => {
      if (isHtml) {
        document.dispatchEvent(new CustomEvent('gt-preview-html', { detail: newContent }));
        return;
      }
      setContent(newContent);
      // Bind the opened text file for auto-save (office imports / browser → untitled,
      // because we must never overwrite a .docx/.odt with markdown).
      if (filePath && (isElectronEnv() || isCapacitorEnv())) {
        setCurrentFile({ path: filePath, name: fileName });
      } else {
        setCurrentFile(null);
      }
      dirtyRef.current = false;
      // Offer to enable auto-save (only when it's currently off)
      if (!autoSaveEnabledRef.current) {
        newDocPromptedRef.current = true;
        setAutoSavePrompt({ fileName });
      }
    };

    if (!current.trim() || current === DEFAULT_CONTENT) {
      // Editor is empty or still shows the untouched welcome text — open directly
      openNow();
      notify(`تم فتح: ${fileName}`, 'success');
      return;
    }

    setConfirmDialog({
      title:   'هل تريد حفظ التغييرات الحالية؟',
      message: `ستُفتح "${fileName}" وسيُستبدل المحتوى الحالي.`,
      onSave: async () => {
        // Save the current work first (to its bound file, or via Save As)
        const saved = await saveNowRef.current();
        if (!saved) {
          setConfirmDialog(null);
          notify('أُلغي الحفظ — لم يُفتح الملف', 'info');
          return;
        }
        setConfirmDialog(null);
        openNow();
        notify(`تم فتح: ${fileName}`, 'info');
      },
      onDiscard: () => {
        setConfirmDialog(null);
        openNow();
        notify(`تم فتح: ${fileName}`, 'success');
      },
      onCancel: () => setConfirmDialog(null),
    });
  }, [setContent, setCurrentFile, notify]);

  // ── Shared open request (from المحرر / المعاينة open buttons) ─────────────
  useEffect(() => {
    const handler = (e: Event) => {
      const { content: c, isHtml, fileName, filePath } = (e as CustomEvent<{
        content: string; isHtml: boolean; fileName: string; filePath?: string;
      }>).detail;
      confirmBeforeOpen(c, isHtml, fileName, filePath);
    };
    document.addEventListener('gt-request-open', handler);
    return () => document.removeEventListener('gt-request-open', handler);
  }, [confirmBeforeOpen]);

  // ── Ctrl+S → حفظ المستند (Markdown) ───────────────────────────────────────
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        saveNowRef.current();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  // ── Electron: listen for files opened via OS file manager ────────────────
  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.onOpenFile) return;
    api.onOpenFile(async (data) => {
      const name = (data.filePath?.split('/').pop()) ?? data.name ?? data.filePath;
      if (data.office && data.dataBase64) {
        // Office document delivered as base64 — convert to Markdown first
        notify(`جارٍ تحويل: ${name}…`, 'info');
        try {
          const md = await officeToMarkdown({
            name: data.name ?? name,
            arrayBuffer: base64ToArrayBuffer(data.dataBase64),
          });
          confirmBeforeOpen(md, false, name);
        } catch (err) {
          notify(`تعذّر تحويل المستند: ${(err as Error).message}`, 'error');
        }
        return;
      }
      // Bind the real path so auto-save overwrites the same file
      confirmBeforeOpen(data.content ?? '', !!data.isHtml, name, data.filePath);
    });
    return () => api.removeOpenFileListener?.();
  }, [confirmBeforeOpen]);

  // ── Electron: signal the main process we're ready + surface open errors ──
  // Must run AFTER the onOpenFile listener above is registered so any file the
  // app was launched with ("Open with") is flushed only once we can receive it.
  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return;
    api.onOpenFileError?.((message: string) => {
      notify(`تعذّر فتح الملف: ${message}`, 'error');
    });
    api.notifyReady?.();
  }, [notify]);

  // ── Capacitor/Android: handle file opened from file manager ──────────────
  useEffect(() => {
    if (!isCapacitorEnv()) return;
    const setup = async () => {
      try {
        const { App: CapApp } = await import('@capacitor/app');
        const { Filesystem } = await import('@capacitor/filesystem');

        CapApp.addListener('appUrlOpen', async (event) => {
          const url = event.url;
          if (!url) return;

          // ── Helper: decode base64 → UTF-8 properly (atob gives binary, not unicode) ──
          const b64ToUtf8 = (b64: string): string => {
            try {
              const binary = atob(b64);
              const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
              return new TextDecoder('utf-8').decode(bytes);
            } catch { return b64; }
          };

          try {
            let text = '';
            // First attempt: read with explicit UTF-8 encoding (returns string directly)
            const { Encoding } = await import('@capacitor/filesystem');
            try {
              const result = await Filesystem.readFile({ path: url, encoding: Encoding.UTF8 });
              text = result.data as string;
            } catch {
              // Fallback: read as base64, then decode to UTF-8
              const result = await Filesystem.readFile({ path: url });
              if (typeof result.data === 'string') {
                text = b64ToUtf8(result.data);
              } else {
                text = await (result.data as Blob).text();
              }
            }

            const isHtml = /\.(html?|htm)$/i.test(url);
            const name = url.split('/').pop() ?? url;
            confirmBeforeOpen(text, isHtml, name);

          } catch (fsErr) {
            // Fallback: use XMLHttpRequest (works for file:// on some devices)
            try {
              const text = await new Promise<string>((res, rej) => {
                const xhr = new XMLHttpRequest();
                xhr.open('GET', url, true);
                xhr.onload = () => xhr.status < 400 ? res(xhr.responseText) : rej(xhr.status);
                xhr.onerror = rej;
                xhr.send();
              });
              const isHtml = /\.(html?|htm)$/i.test(url);
              const name = url.split('/').pop() ?? url;
              confirmBeforeOpen(text, isHtml, name);
            } catch {
              notify(`تعذّر فتح الملف: ${url}`, 'error');
            }
          }
        });

        // ── Android back button → close confirmation ──────────────────────
        CapApp.addListener('backButton', () => {
          setCloseDialog(true);
        });

      } catch { /* Not in Capacitor */ }
    };
    setup();
  }, [confirmBeforeOpen, notify]);

  // ── Electron: window close confirmation ──────────────────────────────────
  useEffect(() => {
    if (!isElectronEnv()) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Skip dialog if user already confirmed close
      if (isIntentionalClose.current) return;
      e.preventDefault();
      e.returnValue = '';
      setCloseDialog(true);
      return '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Drag & Drop ───────────────────────────────────────────────────────────
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    try {
      if (isOfficeFile(file.name)) {
        notify(`جارٍ تحويل: ${file.name}…`, 'info');
        const md = await officeToMarkdown({ name: file.name, arrayBuffer: await file.arrayBuffer() });
        confirmBeforeOpen(md, false, file.name);
        return;
      }
      const text = await file.text();
      const isHtml = /\.(html?|htm)$/i.test(file.name);
      // Electron exposes the real path on dropped File objects
      const filePath = (file as unknown as { path?: string }).path;
      confirmBeforeOpen(text, isHtml, file.name, filePath);
    } catch (err) {
      notify(`خطأ في قراءة الملف: ${String((err as Error).message || err)}`, 'error');
    }
  }, [confirmBeforeOpen, notify]);

  // ── Force close (bypass confirm) ─────────────────────────────────────────
  const doClose = useCallback(async () => {
    setCloseDialog(false);
    if (isCapacitorEnv()) {
      const { App: CapApp } = await import('@capacitor/app');
      await CapApp.exitApp();
    } else if (isElectronEnv()) {
      // 1. Use IPC force-close (main process destroys window, bypasses beforeunload)
      if (window.electronAPI?.forceClose) {
        window.electronAPI.forceClose();
        return;
      }
      // 2. Fallback: set bypass flag then call window.close()
      isIntentionalClose.current = true;
      window.close();
    }
  }, []);

  return (
    <div
      className={`app${dragOver ? ' drag-over' : ''}`}
      data-theme={theme}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {dragOver && (
        <div className="drag-overlay">
          <div className="drag-message">
            <span>📂</span>
            <span>أفلت الملف هنا لفتحه</span>
            <small>MD · TXT · HTML · DOCX · DOC · ODT · ODF</small>
          </div>
        </div>
      )}

      <Notification />
      <Header />
      <ErrorBoundary><Toolbar /></ErrorBoundary>
      <div className="main-area">
        <ErrorBoundary><SplitPane /></ErrorBoundary>
        <EmojiPanel />
      </div>

      {/* ── Auto-save offer banner (non-blocking, bottom of the app) ── */}
      {autoSavePrompt && !autoSaveEnabled && (
        <div className="autosave-banner">
          <span className="autosave-banner-text">
            💾 {autoSavePrompt.fileName
              ? `تفعيل الحفظ التلقائي إلى «${autoSavePrompt.fileName}»؟`
              : 'فعِّل الحفظ التلقائي حتى لا تفقد عملك.'}
          </span>
          <div className="autosave-banner-actions">
            <button className="btn btn-primary btn-sm" onClick={() => {
              setAutoSavePrompt(null);
              setAutoSaveEnabled(true);
            }}>
              تفعيل
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => setAutoSavePrompt(null)}>
              لاحقًا
            </button>
          </div>
        </div>
      )}

      <StatusBar />
      <Footer />

      {/* Modals */}
      <ErrorBoundary><LinkModal /></ErrorBoundary>
      <ErrorBoundary><ImageModal /></ErrorBoundary>
      <ErrorBoundary><VideoModal /></ErrorBoundary>
      <ErrorBoundary><AudioModal /></ErrorBoundary>
      <ErrorBoundary><GifModal /></ErrorBoundary>
      <ErrorBoundary><MathModal /></ErrorBoundary>
      <ErrorBoundary><FootnoteModal /></ErrorBoundary>
      <ErrorBoundary><TableModal /></ErrorBoundary>

      {/* ── Save confirmation dialog (before opening new file) ── */}
      {confirmDialog && (
        <div className="modal-overlay" style={{ zIndex: 2000 }}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <span className="modal-title">💾 {confirmDialog.title}</span>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                {confirmDialog.message}
              </p>
            </div>
            <div className="modal-footer" style={{ gap: '0.5rem' }}>
              <button className="btn btn-secondary" onClick={confirmDialog.onCancel}>
                إلغاء
              </button>
              <button className="btn btn-secondary" onClick={confirmDialog.onDiscard}
                style={{ color: 'var(--warning)' }}>
                بدون حفظ
              </button>
              <button className="btn btn-primary" onClick={confirmDialog.onSave}>
                💾 حفظ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Close confirmation dialog ── */}
      {closeDialog && (
        <div className="modal-overlay" style={{ zIndex: 2000 }}>
          <div className="modal" style={{ maxWidth: 380 }}>
            <div className="modal-header">
              <span className="modal-title">🚪 إغلاق التطبيق</span>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                هل تريد حفظ عملك قبل الإغلاق؟
              </p>
            </div>
            <div className="modal-footer" style={{ gap: '0.5rem' }}>
              <button className="btn btn-secondary" onClick={() => setCloseDialog(false)}>
                إلغاء
              </button>
              <button className="btn btn-secondary" onClick={doClose}
                style={{ color: 'var(--error)' }}>
                إغلاق بدون حفظ
              </button>
              <button className="btn btn-primary" onClick={async () => {
                const ok = await saveNowRef.current();
                if (ok) setTimeout(doClose, 400);
              }}>
                💾 حفظ وإغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
