import React, {
  createContext,
  useContext,
  useReducer,
  useRef,
  useState,
  useCallback,
  useEffect,
} from 'react';
import type { AppContextValue, Theme, Direction, ViewMode, ModalId, NotifType, NotifItem, FontEntry } from './types';
import { useLocalStorage } from './hooks/useLocalStorage';
import { insertAroundSelection } from './lib/insertText';

// ─── Editor state (content + undo/redo) ──────────────────────────────────────

const DEFAULT_CONTENT = `# مرحباً بك في GT-MarkDaWin 3.0 ✨

محرر **مارك داون** عصري ونظيف مبني بـ React وTypeScript.

## الخصائص الرئيسية

### تنسيق النص
**غامق** — *مائل* — ~~يتوسطه خط~~ — \`كود مضمّن\`

### القوائم

- عنصر أول
- عنصر ثانٍ
  - عنصر متداخل

1. قائمة مرقمة
2. العنصر الثاني

- [x] مهمة منجزة ✅
- [ ] مهمة قيد الإنجاز

### الجداول

| المميزة | الوصف |
|---------|-------|
| RTL/LTR | دعم كامل لاتجاه النص |
| الخطوط | 8+ خطوط عربية مدمجة |
| التصدير | MD · HTML · PDF |
| الثيمات | داكن وفاتح |

### الاقتباس

> *"البساطة هي أقصى درجات التطور"*

### الكود

\`\`\`javascript
function greet(name) {
  return \`مرحباً يا \${name}!\`;
}
\`\`\`

### المعادلات الرياضية

معادلة مضمّنة: $E = mc^2$

$$\\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}$$

---
> ابدأ كتابتك هنا، أو احذف هذا المحتوى واستمتع بالتجربة 🚀
`;

interface EditorState {
  content: string;
  history: string[];
  historyIndex: number;
}

type EditorAction =
  | { type: 'SET'; content: string }
  | { type: 'PUSH'; content: string }
  | { type: 'UNDO' }
  | { type: 'REDO' };

function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'SET':
      return { ...state, content: action.content };

    case 'PUSH': {
      const base = state.history.slice(0, state.historyIndex + 1);
      if (base[base.length - 1] === action.content) return state;
      const next = [...base, action.content].slice(-50);
      return { content: action.content, history: next, historyIndex: next.length - 1 };
    }

    case 'UNDO': {
      const i = Math.max(0, state.historyIndex - 1);
      if (i === state.historyIndex) return state;
      return { ...state, historyIndex: i, content: state.history[i] };
    }

    case 'REDO': {
      const i = Math.min(state.history.length - 1, state.historyIndex + 1);
      if (i === state.historyIndex) return state;
      return { ...state, historyIndex: i, content: state.history[i] };
    }
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AppContext = createContext<AppContextValue>(null!);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const savedContent = (() => {
    try {
      return localStorage.getItem('gt-md-content') ?? DEFAULT_CONTENT;
    } catch {
      return DEFAULT_CONTENT;
    }
  })();

  const [editorState, dispatch] = useReducer(editorReducer, {
    content: savedContent,
    history: [savedContent],
    historyIndex: 0,
  });

  // Persisted settings
  const [theme, setTheme] = useLocalStorage<Theme>('gt-md-theme', 'dark');
  const [direction, setDirection] = useLocalStorage<Direction>('gt-md-dir', 'rtl');
  const [fontFamily, setFontFamily] = useLocalStorage('gt-md-font', 'Ubuntu Arabic');
  const [fontSize, setFontSize] = useLocalStorage('gt-md-fontsize', 16);
  const [syncScroll, setSyncScroll] = useLocalStorage('gt-md-sync', true);
  const [customFonts, setCustomFonts] = useLocalStorage<FontEntry[]>('gt-md-custom-fonts', []);

  // Ephemeral UI state
  const [view, setView] = useState<ViewMode>('split');
  const [activeModal, setActiveModal] = useState<ModalId | null>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [notifications, setNotifications] = useState<NotifItem[]>([]);

  // Refs
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const historyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Apply theme on mount (App.tsx also applies it, keep in sync)
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);
  // Direction is NOT applied globally — only editor textarea and preview div use it

  // ── Content setter with debounced history & save
  const setContent = useCallback((content: string) => {
    dispatch({ type: 'SET', content });

    if (historyTimer.current) clearTimeout(historyTimer.current);
    historyTimer.current = setTimeout(() => {
      dispatch({ type: 'PUSH', content });
    }, 600);

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try {
        localStorage.setItem('gt-md-content', content);
      } catch {}
    }, 400);
  }, []);

  const undo = useCallback(() => dispatch({ type: 'UNDO' }), []);
  const redo = useCallback(() => dispatch({ type: 'REDO' }), []);

  // ── Insert at cursor
  const insertAtCursor = useCallback(
    (before: string, after = '', placeholder = '') => {
      const el = editorRef.current;
      if (!el) return;
      const { content, newStart, newEnd } = insertAroundSelection(
        editorState.content,
        el.selectionStart,
        el.selectionEnd,
        before,
        after,
        placeholder,
      );
      setContent(content);
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(newStart, newEnd);
      });
    },
    [editorState.content, setContent],
  );

  const wrapSelection = useCallback(
    (before: string, after: string, placeholder = 'نص') => {
      insertAtCursor(before, after, placeholder);
    },
    [insertAtCursor],
  );

  // ── Notifications
  const notify = useCallback((message: string, type: NotifType = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 3500);
  }, []);

  // ── Custom fonts
  const addCustomFont = useCallback(
    (font: FontEntry) => {
      setCustomFonts(prev => {
        if (prev.find(f => f.name === font.name)) return prev;
        return [...prev, font];
      });
      // Inject @font-face
      if (font.url) {
        const style = document.createElement('style');
        style.textContent = `@font-face { font-family: '${font.name}'; src: url('${font.url}'); }`;
        document.head.appendChild(style);
      }
    },
    [setCustomFonts],
  );

  const value: AppContextValue = {
    content: editorState.content,
    setContent,
    undo,
    redo,
    canUndo: editorState.historyIndex > 0,
    canRedo: editorState.historyIndex < editorState.history.length - 1,

    theme,
    toggleTheme: () => setTheme(t => (t === 'dark' ? 'light' : 'dark')),
    direction,
    toggleDirection: () => setDirection(d => (d === 'rtl' ? 'ltr' : 'rtl')),
    fontFamily,
    setFontFamily,
    fontSize,
    setFontSize,
    syncScroll,
    toggleSyncScroll: () => setSyncScroll(s => !s),

    view,
    setView,

    editorRef,
    insertAtCursor,
    wrapSelection,

    activeModal,
    openModal: setActiveModal,
    closeModal: () => setActiveModal(null),

    showEmoji,
    setShowEmoji,

    notify,
    notifications,

    customFonts,
    addCustomFont,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export const useApp = () => useContext(AppContext);
