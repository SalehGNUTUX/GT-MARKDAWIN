import { useMemo } from 'react';
import { Type, AlignJustify, Hash, ArrowLeftRight, Save } from 'lucide-react';
import { useApp } from '../context';

function countWords(text: string): number {
  if (!text.trim()) return 0;
  return text
    .trim()
    .split(/[\s،؛؟!-/:-@[-`{-~]+/)
    .filter(Boolean).length;
}

// Interval choices for the auto-save selector (seconds)
const INTERVALS: { v: number; l: string }[] = [
  { v: 10, l: '10 ث' },
  { v: 30, l: '30 ث' },
  { v: 60, l: 'دقيقة' },
  { v: 120, l: 'دقيقتان' },
  { v: 300, l: '5 د' },
];

export default function StatusBar() {
  const {
    content, direction, syncScroll,
    autoSaveEnabled, setAutoSaveEnabled, autoSaveInterval, setAutoSaveInterval,
    currentFile, lastSavedAt,
  } = useApp();

  const stats = useMemo(() => ({
    words: countWords(content),
    chars: content.length,
    lines: content.split('\n').length,
  }), [content]);

  const lastSavedStr = lastSavedAt
    ? new Date(lastSavedAt).toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;

  return (
    <div className="statusbar">
      <div className="stat-badge" title="عدد الكلمات">
        <Type size={11} />
        <span>{stats.words.toLocaleString('ar')} كلمة</span>
      </div>

      <div className="stat-badge" title="عدد الأحرف">
        <Hash size={11} />
        <span>{stats.chars.toLocaleString('ar')} حرف</span>
      </div>

      <div className="stat-badge" title="عدد الأسطر">
        <AlignJustify size={11} />
        <span>{stats.lines.toLocaleString('ar')} سطر</span>
      </div>

      <div className="stat-badge" title="اتجاه النص">
        <ArrowLeftRight size={11} />
        <span>{direction === 'rtl' ? 'RTL' : 'LTR'}</span>
      </div>

      <div className="statusbar-sep" />

      {/* ── Auto-save controls ── */}
      <button
        type="button"
        className="stat-badge as-toggle"
        onClick={() => setAutoSaveEnabled(s => !s)}
        title={autoSaveEnabled ? 'الحفظ التلقائي مُفعّل — انقر لإيقافه' : 'الحفظ التلقائي متوقف — انقر لتفعيله'}
        style={{ color: autoSaveEnabled ? 'var(--accent)' : 'var(--text-subtle)', cursor: 'pointer' }}
      >
        <Save size={11} />
        <span>{autoSaveEnabled ? 'حفظ تلقائي' : 'حفظ يدوي'}</span>
      </button>

      {autoSaveEnabled && (
        <select
          className="as-interval"
          value={autoSaveInterval}
          onChange={e => setAutoSaveInterval(Number(e.target.value))}
          title="الفاصل الزمني بين كل حفظ تلقائي"
        >
          {INTERVALS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
        </select>
      )}

      {autoSaveEnabled && (
        <span
          className="stat-badge"
          title={currentFile ? `يُحفظ تلقائياً في: ${currentFile.name}` : 'حفظ محلي'}
          style={{ color: 'var(--text-subtle)' }}
        >
          {lastSavedStr ? `✓ حُفظ ${lastSavedStr}` : '… بانتظار التغييرات'}
        </span>
      )}

      <div className="statusbar-sep" />

      <div className="stat-badge" style={{ color: syncScroll ? 'var(--accent)' : 'var(--text-subtle)' }}>
        {syncScroll ? '⇅ مزامنة' : '⇅ منفصل'}
      </div>
    </div>
  );
}
