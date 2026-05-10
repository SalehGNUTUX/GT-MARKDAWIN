import { useEffect, useState, useCallback, useRef } from 'react';
import { useApp } from './context';
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

// ── Detect environment ────────────────────────────────────────────────────────
const isElectronEnv = () => typeof window !== 'undefined' && !!window.electronAPI?.isElectron;
const isCapacitorEnv = () => typeof (window as any).Capacitor !== 'undefined';
const isMobile = () => /Android|iPhone|iPad/i.test(navigator.userAgent);

// ── Documents save path ───────────────────────────────────────────────────────
const SAVE_DIR = 'MARKDAWIN';

export default function App() {
  const { theme, fontFamily, fontSize, content, setContent, notify } = useApp();
  const [dragOver, setDragOver]         = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string; message: string;
    onSave: () => void; onDiscard: () => void; onCancel: () => void;
  } | null>(null);
  const [closeDialog, setCloseDialog]   = useState(false);
  const isIntentionalClose = useRef(false); // bypass beforeunload after user confirms
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // ── Auto-save to Documents/MARKDAWIN/ ─────────────────────────────────────
  const autoSave = useCallback(async (text: string) => {
    if (!text.trim()) return;

    try {
      const timestamp = new Date().toLocaleString('fr-MA', {
        timeZone: 'Africa/Casablanca',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit',
      }).replace(/[/: ]/g, '-');

      const filename = `auto-${timestamp}.md`;

      if (isElectronEnv()) {
        // Electron: write to ~/Documents/MARKDAWIN/
        const api = window.electronAPI!;
        await api.saveFile({
          defaultName: `${SAVE_DIR}/${filename}`,
          content: text,
        });
      } else if (isCapacitorEnv()) {
        // Android: write to Documents/MARKDAWIN/ — must use Encoding.UTF8
        const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
        await Filesystem.mkdir({
          path: SAVE_DIR,
          directory: Directory.Documents,
          recursive: true,
        }).catch(() => {});
        await Filesystem.writeFile({
          path: `${SAVE_DIR}/${filename}`,
          data: text,                    // plain UTF-8 string
          directory: Directory.Documents,
          encoding: Encoding.UTF8,       // tells Capacitor to write as text, not base64
        });
        notify(`✅ حُفظ في Documents/${SAVE_DIR}/${filename}`, 'success');
      } else {
        // Browser: localStorage only
        localStorage.setItem('gt-md-content', text);
      }
    } catch (err) {
      console.warn('Auto-save failed:', err);
    }
  }, [notify]);

  // Debounced auto-save trigger
  useEffect(() => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => autoSave(content), 30000); // 30s
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [content, autoSave]);

  // ── Helper: ask user to save before replacing content ─────────────────────
  const confirmBeforeOpen = useCallback((
    newContent: string,
    isHtml: boolean,
    fileName: string,
  ) => {
    if (!content.trim() || content === localStorage.getItem('gt-md-default')) {
      // Editor is empty — open directly
      if (isHtml) document.dispatchEvent(new CustomEvent('gt-preview-html', { detail: newContent }));
      else setContent(newContent);
      notify(`تم فتح: ${fileName}`, 'success');
      return;
    }

    setConfirmDialog({
      title:   'هل تريد حفظ التغييرات الحالية؟',
      message: `ستُفتح "${fileName}" وسيُستبدل المحتوى الحالي.`,
      onSave: async () => {
        setConfirmDialog(null);
        // Save current content first
        await autoSave(content);
        notify('تم الحفظ ✅', 'success');
        if (isHtml) document.dispatchEvent(new CustomEvent('gt-preview-html', { detail: newContent }));
        else setContent(newContent);
        notify(`تم فتح: ${fileName}`, 'info');
      },
      onDiscard: () => {
        setConfirmDialog(null);
        if (isHtml) document.dispatchEvent(new CustomEvent('gt-preview-html', { detail: newContent }));
        else setContent(newContent);
        notify(`تم فتح: ${fileName}`, 'success');
      },
      onCancel: () => setConfirmDialog(null),
    });
  }, [content, autoSave, setContent, notify]);

  // ── Electron: listen for files opened via OS file manager ────────────────
  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.onOpenFile) return;
    api.onOpenFile(({ content: fileContent, isHtml, filePath }) => {
      const name = filePath.split('/').pop() ?? filePath;
      confirmBeforeOpen(fileContent, isHtml, name);
    });
    return () => api.removeOpenFileListener?.();
  }, [confirmBeforeOpen]);

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
      const text = await file.text();
      const isHtml = /\.(html?|htm)$/i.test(file.name);
      confirmBeforeOpen(text, isHtml, file.name);
    } catch (err) {
      notify(`خطأ في قراءة الملف: ${String(err)}`, 'error');
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
            <small>MD · TXT · HTML</small>
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
                await autoSave(content);
                notify('تم الحفظ ✅', 'success');
                setTimeout(doClose, 600);
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
