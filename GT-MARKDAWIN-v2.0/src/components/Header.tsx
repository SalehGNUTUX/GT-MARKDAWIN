import { useRef } from 'react';
import {
  Sun, Moon, AlignRight, AlignLeft, Smile, Maximize2,
  Upload, Columns2, PanelLeft, PanelRight,
} from 'lucide-react';
import { useApp } from '../context';
import type { FontEntry, ViewMode } from '../types';

const BUILT_IN_FONTS: FontEntry[] = [
  { name: 'Ubuntu Arabic' },
  { name: 'Amiri Quran' },
  { name: 'Amiri Quran Colored' },
  { name: 'ArbFONTS Amiri Quran' },
  { name: 'Uthmanic Hafs' },
  { name: 'Arslan Wessam' },
  { name: 'Noto Sans Arabic' },
  { name: 'Arial' },
  { name: 'system-ui' },
  { name: 'monospace' },
];

export default function Header() {
  const {
    theme, toggleTheme,
    direction, toggleDirection,
    fontFamily, setFontFamily,
    fontSize, setFontSize,
    showEmoji, setShowEmoji,
    view, setView,
    notify, addCustomFont, customFonts,
  } = useApp();

  const fontImportRef = useRef<HTMLInputElement>(null);
  const allFonts = [...BUILT_IN_FONTS, ...customFonts];

  const VIEW_OPTS: { v: ViewMode; icon: React.ReactNode; label: string }[] = [
    { v: 'split',   icon: <Columns2 size={15} />,   label: 'عرض مقسّم' },
    { v: 'editor',  icon: <PanelLeft size={15} />,  label: 'المحرر فقط' },
    { v: 'preview', icon: <PanelRight size={15} />, label: 'المعاينة فقط' },
  ];
  const viewIdx = VIEW_OPTS.findIndex(o => o.v === view);
  const cycleView = () => setView(VIEW_OPTS[(viewIdx + 1) % VIEW_OPTS.length].v);

  const handleFontImport = async () => {
    if ('showOpenFilePicker' in window) {
      try {
        const [fh] = await (window as Window & { showOpenFilePicker: (o: object) => Promise<any[]> })
          .showOpenFilePicker({
            types: [{ description: 'خطوط', accept: { 'font/*': ['.ttf', '.otf', '.woff', '.woff2'] } }],
          });
        const file: File = await fh.getFile();
        const url = URL.createObjectURL(file);
        const name = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
        addCustomFont({ name, url });
        setFontFamily(name);
        notify(`تم استيراد الخط: ${name}`, 'success');
      } catch { /* cancelled */ }
    } else {
      fontImportRef.current?.click();
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const name = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
    addCustomFont({ name, url });
    setFontFamily(name);
    notify(`تم استيراد الخط: ${name}`, 'success');
    e.target.value = '';
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() =>
        notify('تعذّر الدخول إلى وضع ملء الشاشة', 'error'),
      );
    } else {
      document.exitFullscreen();
    }
  };

  return (
    <header className="header">
      {/* Logo & brand */}
      <div className="header-logo">
        <img src="./icon.png" alt="GT-MARKDAWIN" className="header-icon" />
        <div className="header-brand header-brand-text">
          <span className="header-title">GT-MARKDAWIN</span>
          <span className="header-subtitle">مارك دَوِّنْ مُحَرِّرٌ عَرَبِيٌّ عَصْرِيٌّ</span>
        </div>
      </div>

      <div className="header-sep" />

      <div className="header-controls">
        {/* Font selector */}
        <select
          className="font-select"
          value={fontFamily}
          onChange={e => setFontFamily(e.target.value)}
          title="اختيار الخط"
          style={{ fontFamily }}
        >
          {allFonts.map(f => (
            <option key={f.name} value={f.name} style={{ fontFamily: f.name }}>
              {f.name}
            </option>
          ))}
        </select>

        {/* Font size */}
        <input
          type="number"
          className="font-size-input"
          value={fontSize}
          min={10}
          max={30}
          onChange={e => setFontSize(Number(e.target.value))}
          title="حجم الخط"
        />

        {/* Import font */}
        <input
          ref={fontImportRef}
          type="file"
          accept=".ttf,.otf,.woff,.woff2"
          style={{ display: 'none' }}
          onChange={handleFileInput}
        />
        <button className="icon-btn" title="استيراد خط مخصص" onClick={handleFontImport}>
          <Upload size={15} />
        </button>

        {/* View cycle */}
        <button
          className="icon-btn"
          title={VIEW_OPTS[(viewIdx + 1) % VIEW_OPTS.length].label}
          onClick={cycleView}
        >
          {VIEW_OPTS[viewIdx].icon}
        </button>

        {/* Emoji panel — smart position: RIGHT of button by default */}
        <button
          className={`icon-btn${showEmoji ? ' active' : ''}`}
          title="لوحة الإيموجي"
          onClick={(e) => {
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            const PANEL_W = 322;
            const PANEL_H = 440;
            const GAP     = 6;

            // Vertical: below button; if not enough space, show above
            const top = (rect.bottom + GAP + PANEL_H <= window.innerHeight - 8)
              ? rect.bottom + GAP
              : Math.max(8, rect.top - GAP - PANEL_H);

            // Horizontal priority: RIGHT of button → LEFT of button → clamped
            let left: number;
            if (rect.right + GAP + PANEL_W <= window.innerWidth - 8) {
              left = rect.right + GAP;                        // open RIGHT
            } else if (rect.left - GAP - PANEL_W >= 8) {
              left = rect.left - GAP - PANEL_W;              // open LEFT
            } else {
              // clamp to viewport
              left = Math.max(8, Math.min(window.innerWidth - PANEL_W - 8, rect.left));
            }

            document.documentElement.style.setProperty('--emoji-panel-top',  `${top}px`);
            document.documentElement.style.setProperty('--emoji-panel-left', `${left}px`);
            setShowEmoji(!showEmoji);
          }}
        >
          <Smile size={15} />
        </button>

        {/* Theme */}
        <button className="icon-btn" title={theme === 'dark' ? 'الثيم الفاتح' : 'الثيم الداكن'} onClick={toggleTheme}>
          {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
        </button>

        {/* Direction */}
        <button
          className="icon-btn"
          title={direction === 'rtl' ? 'التبديل إلى LTR' : 'التبديل إلى RTL'}
          onClick={toggleDirection}
        >
          {direction === 'rtl' ? <AlignLeft size={15} /> : <AlignRight size={15} />}
        </button>

        {/* Fullscreen */}
        <button className="icon-btn" title="ملء الشاشة (F11)" onClick={toggleFullscreen}>
          <Maximize2 size={15} />
        </button>
      </div>
    </header>
  );
}
