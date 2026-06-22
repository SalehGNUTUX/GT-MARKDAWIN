export type Theme = 'dark' | 'light';
export type Direction = 'rtl' | 'ltr';
export type ViewMode = 'split' | 'editor' | 'preview';
export type ModalId = 'link' | 'image' | 'video' | 'audio' | 'gif' | 'math' | 'footnote' | 'table';
export type NotifType = 'success' | 'error' | 'info' | 'warning';

export interface NotifItem {
  id: string;
  message: string;
  type: NotifType;
}

export interface FontEntry {
  name: string;
  url?: string;
}

// The file currently bound for auto-save (overwritten in the background).
// `path` is environment-specific: an absolute path on Electron, a content URI
// on Android, or empty in the browser (where only localStorage is used).
export interface CurrentFile {
  path: string;
  name: string;
}

export interface EmojiItem {
  emoji: string;
  name: string;
  category?: string;
}

export interface AppContextValue {
  content: string;
  setContent: (c: string) => void;

  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;

  theme: Theme;
  toggleTheme: () => void;
  direction: Direction;
  toggleDirection: () => void;
  fontFamily: string;
  setFontFamily: (f: string) => void;
  fontSize: number;
  setFontSize: (s: number) => void;
  syncScroll: boolean;
  toggleSyncScroll: () => void;

  // ── Auto-save ──
  autoSaveEnabled: boolean;
  setAutoSaveEnabled: (v: boolean | ((p: boolean) => boolean)) => void;
  autoSaveInterval: number; // seconds between background saves
  setAutoSaveInterval: (v: number) => void;
  currentFile: CurrentFile | null;
  setCurrentFile: (f: CurrentFile | null) => void;
  lastSavedAt: number | null; // timestamp of the last successful save
  setLastSavedAt: (t: number | null) => void;

  view: ViewMode;
  setView: (v: ViewMode) => void;

  editorRef: React.RefObject<HTMLTextAreaElement | null>;
  insertAtCursor: (before: string, after?: string, placeholder?: string) => void;
  wrapSelection: (before: string, after: string, placeholder?: string) => void;

  activeModal: ModalId | null;
  openModal: (m: ModalId) => void;
  closeModal: () => void;

  showEmoji: boolean;
  setShowEmoji: (s: boolean) => void;

  notify: (msg: string, type?: NotifType) => void;
  notifications: NotifItem[];

  customFonts: FontEntry[];
  addCustomFont: (font: FontEntry) => void;
}
