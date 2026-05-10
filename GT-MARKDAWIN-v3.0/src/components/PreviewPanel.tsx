import { useEffect, useRef, useMemo, useCallback, useState } from 'react';
import { FileDown, FileCode2, Printer, FolderOpen, ZoomIn, ZoomOut } from 'lucide-react';
import { useApp } from '../context';
import { renderMarkdown } from '../lib/markdown';
import { exportMarkdown, exportHTML, exportPDF } from '../lib/export';

interface Props { style?: React.CSSProperties; }

export default function PreviewPanel({ style }: Props) {
  const {
    content, theme, direction, fontFamily, fontSize,
    syncScroll, editorRef, notify, setFontSize,
  } = useApp();

  const wrapRef   = useRef<HTMLDivElement>(null);
  const syncing   = useRef(false);
  // htmlOverride: when user opens an HTML file, show it directly
  const [htmlOverride, setHtmlOverride] = useState<string | null>(null);

  const rendered = useMemo(() => renderMarkdown(content), [content]);

  // When content changes (user typing), clear html override → back to markdown
  useEffect(() => { setHtmlOverride(null); }, [content]);

  // Listen for HTML file import event dispatched by EditorPanel
  useEffect(() => {
    const handler = (e: Event) =>
      setHtmlOverride((e as CustomEvent<string>).detail);
    document.addEventListener('gt-preview-html', handler);
    return () => document.removeEventListener('gt-preview-html', handler);
  }, []);

  // ── Scroll sync ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!syncScroll) return;
    const editor  = editorRef.current;
    const preview = wrapRef.current;
    if (!editor || !preview) return;

    const onEditor = () => {
      if (syncing.current) return;
      syncing.current = true;
      const r = editor.scrollTop / Math.max(1, editor.scrollHeight - editor.clientHeight);
      preview.scrollTop = r * (preview.scrollHeight - preview.clientHeight);
      requestAnimationFrame(() => { syncing.current = false; });
    };
    const onPreview = () => {
      if (syncing.current) return;
      syncing.current = true;
      const r = preview.scrollTop / Math.max(1, preview.scrollHeight - preview.clientHeight);
      editor.scrollTop = r * (editor.scrollHeight - editor.clientHeight);
      requestAnimationFrame(() => { syncing.current = false; });
    };

    editor.addEventListener('scroll', onEditor, { passive: true });
    preview.addEventListener('scroll', onPreview, { passive: true });
    return () => {
      editor.removeEventListener('scroll', onEditor);
      preview.removeEventListener('scroll', onPreview);
    };
  }, [syncScroll, editorRef]);

  // ── Export handlers ──────────────────────────────────────────────────────────
  const n = useCallback((m: string, t?: string) => notify(m, (t as any) ?? 'info'), [notify]);
  const doExportMD   = useCallback(() => exportMarkdown(content, n), [content, n]);
  const doExportHTML = useCallback(() => exportHTML(content, theme, direction, fontFamily, n), [content, theme, direction, fontFamily, n]);
  const doExportPDF  = useCallback(() => exportPDF(content, direction, fontFamily, n), [content, direction, fontFamily, n]);

  // ── Open file in preview ─────────────────────────────────────────────────────
  const handleOpenFile = useCallback(() => {
    const input = document.createElement('input');
    input.type  = 'file';
    input.accept = '.html,.htm,.md,.txt,.markdown';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const text = await file.text();
      if (/\.(html?|htm)$/i.test(file.name)) {
        setHtmlOverride(text);
        notify(`تم عرض: ${file.name}`, 'success');
      } else {
        notify('لفتح ملف نصي في المحرر، استخدم زر الفتح في لوحة المحرر', 'info');
      }
    };
    input.click();
  }, [notify]);

  return (
    <div className="panel" style={style}>
      {/* ── Panel header ── */}
      <div className="panel-header">
        <span className="panel-title">👁️ المعاينة</span>
        <div className="panel-actions">
          <button className="tb-btn" title="حفظ Markdown (.md)" onClick={doExportMD}>
            <FileDown size={13} />
            <span style={{ fontSize: '0.68rem', marginInlineStart: 2 }}>MD</span>
          </button>
          <button className="tb-btn" title="تصدير HTML" onClick={doExportHTML}>
            <FileCode2 size={13} />
            <span style={{ fontSize: '0.68rem', marginInlineStart: 2 }}>HTML</span>
          </button>
          <button className="tb-btn" title="طباعة / PDF" onClick={doExportPDF}>
            <Printer size={13} />
            <span style={{ fontSize: '0.68rem', marginInlineStart: 2 }}>PDF</span>
          </button>
          <button className="tb-btn" title="فتح ملف HTML في المعاينة" onClick={handleOpenFile}>
            <FolderOpen size={13} />
          </button>
          <button
            className="tb-btn"
            title="تكبير الخط"
            onClick={() => setFontSize(Math.min(fontSize + 1, 30))}
          >
            <ZoomIn size={13} />
          </button>
          <button
            className="tb-btn"
            title="تصغير الخط"
            onClick={() => setFontSize(Math.max(fontSize - 1, 10))}
          >
            <ZoomOut size={13} />
          </button>
        </div>
      </div>

      {/* ── Preview content ── */}
      <div className="preview-wrap" ref={wrapRef}>
        {htmlOverride !== null ? (
          // HTML file opened directly
          <div
            className="preview-content"
            dir={direction}
            dangerouslySetInnerHTML={{ __html: htmlOverride }}
            style={{
              fontFamily: `'${fontFamily}', 'Noto Sans Arabic', sans-serif`,
              fontSize: `${fontSize}px`,
            }}
          />
        ) : (
          // Normal markdown rendering
          <div
            className="preview-content"
            dir={direction}
            dangerouslySetInnerHTML={{ __html: rendered }}
            style={{
              fontFamily: `'${fontFamily}', 'Noto Sans Arabic', sans-serif`,
              fontSize: `${fontSize}px`,
            }}
          />
        )}
      </div>
    </div>
  );
}
