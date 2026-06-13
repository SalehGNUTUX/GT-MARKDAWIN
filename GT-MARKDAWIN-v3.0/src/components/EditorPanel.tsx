import { useCallback, useState } from 'react';
import {
  Undo2, Redo2, Trash2, ArrowUpDown, Search, FolderOpen,
  ClipboardCopy, Copy, ClipboardPaste, Eraser,
} from 'lucide-react';
import { useApp } from '../context';
import { isOfficeFile, officeToMarkdown } from '../lib/officeImport';

interface Props {
  style?: React.CSSProperties;
}

export default function EditorPanel({ style }: Props) {
  const {
    content, setContent, undo, redo, canUndo, canRedo,
    editorRef, syncScroll, toggleSyncScroll, direction,
    fontFamily, fontSize, notify, insertAtCursor,
  } = useApp();

  const [showFind, setShowFind] = useState(false);
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const findOccurrences = findText
    ? (() => {
        try {
          return [...content.matchAll(new RegExp(findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'))].length;
        } catch { return 0; }
      })()
    : 0;

  // ── Keyboard shortcuts ──────────────────────────────────────────────────────
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const ctrl = e.ctrlKey || e.metaKey;

      if (e.key === 'Tab') {
        e.preventDefault();
        insertAtCursor('    ');
        return;
      }
      if (ctrl && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
      if (ctrl && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); return; }
      if (ctrl && e.key === 'b') { e.preventDefault(); insertAtCursor('**', '**', 'نص غامق'); return; }
      if (ctrl && e.key === 'i') { e.preventDefault(); insertAtCursor('*', '*', 'نص مائل'); return; }
      if (ctrl && e.key === 'f') { e.preventDefault(); setShowFind(s => !s); return; }

      // Auto-pairs on selection
      const PAIRS: Record<string, string> = { '(': ')', '[': ']', '{': '}' };
      if (PAIRS[e.key] && editorRef.current) {
        const el = editorRef.current;
        const sel = content.slice(el.selectionStart, el.selectionEnd);
        if (sel) {
          e.preventDefault();
          insertAtCursor(e.key, PAIRS[e.key]);
        }
      }
    },
    [undo, redo, insertAtCursor, content, editorRef],
  );

  // ── Find & Replace ──────────────────────────────────────────────────────────
  const handleFind = () => {
    if (!findText || !editorRef.current) return;
    const el = editorRef.current;
    try {
      const re = new RegExp(findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      const searchFrom = el.selectionEnd;
      const tail = content.slice(searchFrom);
      const match = re.exec(tail);
      if (match) {
        const start = searchFrom + match.index;
        el.focus();
        el.setSelectionRange(start, start + match[0].length);
        el.scrollTop = (el.scrollTop || 0); // keep scroll
      } else {
        // wrap around
        re.lastIndex = 0;
        const m2 = re.exec(content);
        if (m2) {
          el.focus();
          el.setSelectionRange(m2.index, m2.index + m2[0].length);
        } else {
          notify('لا توجد نتائج', 'info');
        }
      }
    } catch {}
  };

  const handleReplaceAll = () => {
    if (!findText) return;
    try {
      const re = new RegExp(findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      const count = [...content.matchAll(re)].length;
      if (count === 0) { notify('لا توجد نتائج', 'info'); return; }
      setContent(content.replace(re, replaceText));
      notify(`تم استبدال ${count} تكرار`, 'success');
    } catch {}
  };

  // ── Open file ───────────────────────────────────────────────────────────────
  // Route through App's confirm-before-open so the current content can be saved first
  const handleOpenFile = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.md,.txt,.markdown,.html,.htm,.docx,.doc,.odt,.odf,.fodt';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        if (isOfficeFile(file.name)) {
          // Office document → convert to Markdown, then open through confirm flow
          notify(`جارٍ تحويل: ${file.name}…`, 'info');
          const md = await officeToMarkdown({ name: file.name, arrayBuffer: await file.arrayBuffer() });
          document.dispatchEvent(new CustomEvent('gt-request-open', {
            detail: { content: md, isHtml: false, fileName: file.name },
          }));
          return;
        }
        const text = await file.text();
        const isHtml = /\.(html?|htm)$/i.test(file.name);
        document.dispatchEvent(new CustomEvent('gt-request-open', {
          detail: { content: text, isHtml, fileName: file.name },
        }));
      } catch (err) {
        notify(`تعذّر فتح الملف: ${(err as Error).message}`, 'error');
      }
    };
    input.click();
  };

  const handleClear = () => {
    if (!content) return;
    if (confirm('هل تريد مسح محتوى المحرر بالكامل؟')) {
      setContent('');
      notify('تم مسح المحتوى', 'info');
    }
  };

  // ── Replace current selection (or insert at cursor) with given text ───────────
  const replaceSelection = useCallback((text: string) => {
    const el = editorRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const next = content.slice(0, start) + text + content.slice(end);
    setContent(next);
    const pos = start + text.length;
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  }, [content, setContent, editorRef]);

  // ── Clipboard tools ───────────────────────────────────────────────────────────
  const copyAll = useCallback(async () => {
    if (!content) { notify('المحرر فارغ', 'info'); return; }
    try {
      await navigator.clipboard.writeText(content);
      notify('تم نسخ كامل النص ✅', 'success');
    } catch { notify('تعذّر النسخ — استخدم Ctrl+C', 'error'); }
  }, [content, notify]);

  const copySelection = useCallback(async () => {
    const el = editorRef.current;
    if (!el) return;
    const sel = content.slice(el.selectionStart, el.selectionEnd);
    if (!sel) { notify('لا يوجد نص محدّد', 'info'); return; }
    try {
      await navigator.clipboard.writeText(sel);
      notify('تم نسخ التحديد ✅', 'success');
    } catch { notify('تعذّر النسخ — استخدم Ctrl+C', 'error'); }
  }, [content, editorRef, notify]);

  const pasteClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) { notify('الحافظة فارغة', 'info'); return; }
      replaceSelection(text);
      notify('تم اللصق ✅', 'success');
    } catch { notify('تعذّر اللصق — استخدم Ctrl+V', 'error'); }
  }, [replaceSelection, notify]);

  const deleteSelection = useCallback(() => {
    const el = editorRef.current;
    if (!el || el.selectionStart === el.selectionEnd) {
      notify('لا يوجد نص محدّد', 'info');
      return;
    }
    replaceSelection('');
    notify('تم مسح التحديد', 'info');
  }, [editorRef, replaceSelection, notify]);

  return (
    <div className="panel" style={style}>
      {/* Panel header */}
      <div className="panel-header">
        <span className="panel-title">✍️ المحرر</span>
        <div className="panel-actions">
          <button className="tb-btn" title="تراجع (Ctrl+Z)" onClick={undo} disabled={!canUndo}>
            <Undo2 size={13} />
          </button>
          <button className="tb-btn" title="إعادة (Ctrl+Y)" onClick={redo} disabled={!canRedo}>
            <Redo2 size={13} />
          </button>
          <button
            className="tb-btn"
            title={syncScroll ? 'مزامنة التمرير مفعّلة — انقر لإيقافها' : 'مزامنة التمرير متوقفة — انقر لتفعيلها'}
            onClick={toggleSyncScroll}
            style={{ color: syncScroll ? 'var(--accent)' : undefined }}
          >
            <ArrowUpDown size={13} />
            <span style={{ fontSize: '0.65rem', marginInlineStart: 2 }}>
              {syncScroll ? '🔗' : '🔓'}
            </span>
          </button>
          <button className="tb-btn" title="بحث واستبدال (Ctrl+F)" onClick={() => setShowFind(s => !s)}>
            <Search size={13} />
          </button>
          <button className="tb-btn" title="نسخ كامل النص" onClick={copyAll}>
            <ClipboardCopy size={13} />
          </button>
          <button className="tb-btn" title="نسخ التحديد فقط" onClick={copySelection}>
            <Copy size={13} />
          </button>
          <button className="tb-btn" title="لصق" onClick={pasteClipboard}>
            <ClipboardPaste size={13} />
          </button>
          <button className="tb-btn" title="مسح التحديد" onClick={deleteSelection}>
            <Eraser size={13} />
          </button>
          <button className="tb-btn" title="فتح ملف (MD · TXT · HTML · DOCX · DOC · ODT)" onClick={handleOpenFile}>
            <FolderOpen size={13} />
          </button>
          <button className="tb-btn" title="مسح المحتوى" onClick={handleClear}
            style={{ color: 'var(--error)' }}>
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Find & Replace bar */}
      {showFind && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap',
          padding: '0.35rem 0.75rem',
          background: 'var(--surface2)', borderBottom: '1px solid var(--border)',
        }}>
          <input
            placeholder="بحث..."
            value={findText}
            onChange={e => setFindText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleFind()}
            autoFocus
            style={{
              width: 150, background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 5, color: 'var(--text)', padding: '0.28rem 0.5rem',
              fontSize: '0.8rem', outline: 'none',
            }}
          />
          <input
            placeholder="استبدال..."
            value={replaceText}
            onChange={e => setReplaceText(e.target.value)}
            style={{
              width: 150, background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 5, color: 'var(--text)', padding: '0.28rem 0.5rem',
              fontSize: '0.8rem', outline: 'none',
            }}
          />
          {findOccurrences > 0 && (
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              {findOccurrences} نتيجة
            </span>
          )}
          <button className="tb-btn" onClick={handleFind}>التالي</button>
          <button className="tb-btn" onClick={handleReplaceAll}>استبدال الكل</button>
          <button className="tb-btn" onClick={() => setShowFind(false)}>✕</button>
        </div>
      )}

      {/* Textarea */}
      <div className="editor-wrap">
        <textarea
          ref={editorRef as React.RefObject<HTMLTextAreaElement>}
          className="editor-textarea"
          value={content}
          onChange={e => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="ابدأ الكتابة هنا..."
          spellCheck
          style={{
            fontFamily: `'Noto Sans Arabic', 'Ubuntu Arabic', monospace`,
            fontSize: `${fontSize}px`,
            direction: direction as 'rtl' | 'ltr',
          }}
        />
      </div>
    </div>
  );
}
