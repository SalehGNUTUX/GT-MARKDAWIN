import { useMemo } from 'react';
import { Type, AlignJustify, Hash, ArrowLeftRight } from 'lucide-react';
import { useApp } from '../context';

function countWords(text: string): number {
  if (!text.trim()) return 0;
  return text
    .trim()
    .split(/[\s،؛؟!-/:-@[-`{-~]+/)
    .filter(Boolean).length;
}

export default function StatusBar() {
  const { content, direction, syncScroll } = useApp();

  const stats = useMemo(() => ({
    words: countWords(content),
    chars: content.length,
    lines: content.split('\n').length,
  }), [content]);

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

      <div className="stat-badge" style={{ color: syncScroll ? 'var(--accent)' : 'var(--text-subtle)' }}>
        {syncScroll ? '⇅ مزامنة' : '⇅ منفصل'}
      </div>
    </div>
  );
}
