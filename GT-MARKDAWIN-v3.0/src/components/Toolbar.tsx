import {
  Undo2, Redo2, Bold, Italic, Strikethrough, Code, Braces,
  Quote, Minus, Link2, Image, Video, Music, Film, Table2,
  AlignLeft, AlignCenter, AlignRight, Superscript, Subscript,
  List, ListOrdered, ListChecks, Sigma, BookMarked, BookText,
} from 'lucide-react';
import { useApp } from '../context';
import type { ModalId } from '../types';

interface TBtnProps {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

function TBtn({ title, onClick, children, className = '', disabled }: TBtnProps) {
  return (
    <button
      className={`tb-btn ${className}`}
      title={title}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <div className="toolbar-sep" />;
}

export default function Toolbar() {
  const { insertAtCursor, openModal, undo, redo, canUndo, canRedo, direction } = useApp();

  const modal = (id: ModalId) => () => openModal(id);

  // Wrap selection with markup; no selection → placeholder
  const wrap = (before: string, after = '', ph = 'نص') =>
    () => insertAtCursor(before, after, ph);

  // Insert a line-level prefix on new line
  const lineIns = (prefix: string, ph = 'عنصر') =>
    () => insertAtCursor('\n' + prefix, '', ph);

  // Alignment: use <p> like original app
  const align = (pos: 'left' | 'center' | 'right') =>
    () => insertAtCursor(`<p style="text-align:${pos};">`, '</p>', 'نص');

  const heading = (n: number) =>
    () => insertAtCursor('\n' + '#'.repeat(n) + ' ', '', 'عنوان');

  return (
    <div className="toolbar" role="toolbar" aria-label="شريط الأدوات">
      {/* ── History ── */}
      <div className="toolbar-group">
        <TBtn title="تراجع (Ctrl+Z)" onClick={undo} disabled={!canUndo}>
          <Undo2 size={14} />
        </TBtn>
        <TBtn title="إعادة (Ctrl+Y)" onClick={redo} disabled={!canRedo}>
          <Redo2 size={14} />
        </TBtn>
      </div>

      <Sep />

      {/* ── Text style ── */}
      <div className="toolbar-group">
        <TBtn title="غامق (Ctrl+B)" onClick={wrap('**', '**', 'نص غامق')} className="tb-bold">
          <Bold size={14} />
        </TBtn>
        <TBtn title="مائل (Ctrl+I)" onClick={wrap('*', '*', 'نص مائل')} className="tb-italic">
          <Italic size={14} />
        </TBtn>
        <TBtn title="يتوسطه خط" onClick={wrap('~~', '~~', 'نص')} className="tb-strike">
          <Strikethrough size={14} />
        </TBtn>
        <TBtn title="كود مضمّن" onClick={wrap('`', '`', 'كود')}>
          <Code size={14} />
        </TBtn>
        <TBtn title="كتلة كود" onClick={() => insertAtCursor('\n```\n', '\n```\n', 'الكود هنا')}>
          <Braces size={14} />
        </TBtn>
        <TBtn title="اقتباس" onClick={lineIns('> ', 'النص المقتبس')}>
          <Quote size={14} />
        </TBtn>
        <TBtn title="خط أفقي" onClick={() => insertAtCursor('\n\n---\n\n')}>
          <Minus size={14} />
        </TBtn>
      </div>

      <Sep />

      {/* ── Headings ── */}
      <div className="toolbar-group">
        {([1,2,3,4,5,6] as const).map(n => (
          <TBtn key={n} title={`عنوان ${n}`} onClick={heading(n)} className={`tb-h${n}`}>
            H{n}
          </TBtn>
        ))}
      </div>

      <Sep />

      {/* ── Lists ── */}
      <div className="toolbar-group">
        <TBtn title="قائمة نقطية" onClick={lineIns('- ')}>
          <List size={14} />
        </TBtn>
        <TBtn title="قائمة مرقمة" onClick={lineIns('1. ')}>
          <ListOrdered size={14} />
        </TBtn>
        <TBtn title="قائمة مهام" onClick={lineIns('- [ ] ', 'مهمة')}>
          <ListChecks size={14} />
        </TBtn>
        <TBtn title="قائمة تعريفات" onClick={() => insertAtCursor('\nمصطلح\n:   ', '', 'التعريف هنا')}>
          <BookText size={14} />
        </TBtn>
      </div>

      <Sep />

      {/* ── Rich media ── */}
      <div className="toolbar-group">
        <TBtn title="جدول" onClick={modal('table')}>
          <Table2 size={14} />
        </TBtn>
        <TBtn title="رابط" onClick={modal('link')}>
          <Link2 size={14} />
        </TBtn>
        <TBtn title="صورة" onClick={modal('image')}>
          <Image size={14} />
        </TBtn>
        <TBtn title="فيديو (iframe)" onClick={modal('video')}>
          <Video size={14} />
        </TBtn>
        <TBtn title="صوت" onClick={modal('audio')}>
          <Music size={14} />
        </TBtn>
        <TBtn title="صورة GIF متحركة" onClick={modal('gif')}>
          <Film size={14} />
        </TBtn>
      </div>

      <Sep />

      {/* ── Alignment ── */}
      <div className="toolbar-group">
        <TBtn title="محاذاة يسار" onClick={align('left')}>
          <AlignLeft size={14} />
        </TBtn>
        <TBtn title="محاذاة وسط" onClick={align('center')}>
          <AlignCenter size={14} />
        </TBtn>
        <TBtn title="محاذاة يمين" onClick={align('right')}>
          <AlignRight size={14} />
        </TBtn>
        <TBtn title="نص مرتفع" onClick={wrap('<sup>', '</sup>', 'نص')}>
          <Superscript size={14} />
        </TBtn>
        <TBtn title="نص منخفض" onClick={wrap('<sub>', '</sub>', 'نص')}>
          <Subscript size={14} />
        </TBtn>
      </div>

      <Sep />

      {/* ── Advanced ── */}
      <div className="toolbar-group">
        <TBtn title="معادلة رياضية LaTeX" onClick={modal('math')}>
          <Sigma size={14} />
        </TBtn>
        <TBtn title="حاشية مرجعية" onClick={modal('footnote')}>
          <BookMarked size={14} />
        </TBtn>
      </div>
    </div>
  );
}
