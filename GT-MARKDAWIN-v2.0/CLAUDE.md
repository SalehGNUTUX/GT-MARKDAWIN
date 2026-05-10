# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run dev                    # Vite dev server only (browser at localhost:5173)
npm run dev:electron           # Vite + Electron window (waits 3s for Vite to start)

# Build
npm run build                  # TypeScript check + Vite build → dist/
npm run electron:build:linux   # build + electron-builder AppImage + DEB

# Android (Capacitor)
npm run android:sync           # build + npx cap sync android
npx cap sync android           # sync dist/ → android/app/src/main/assets/public/
npx cap open android           # open Android Studio

# Package all formats (AppImage + DEB + RPM + Flatpak + APK)
bash scripts/build-packages.sh all

# Partial packaging
bash scripts/build-packages.sh linux     # AppImage + DEB + RPM
bash scripts/build-packages.sh appimage
bash scripts/build-packages.sh deb
bash scripts/build-packages.sh rpm       # builds from existing DEB via /tmp (Arabic path workaround)
bash scripts/build-packages.sh flatpak   # requires flatpak-builder + Electron2 BaseApp runtime
bash scripts/build-packages.sh apk       # requires ANDROID_HOME set
bash scripts/build-packages.sh icons     # regenerates build/icons/ via ImageMagick
bash scripts/build-packages.sh check-deps  # show what tools are missing (no install)
bash scripts/build-packages.sh install-deps # install only missing tools

# Preview built dist/ in browser
npm run preview
```

There are no test files in this project.

## Architecture

### Three-target rendering
The app runs in three modes that share the same React renderer (`src/`):
- **Browser** (`npm run dev`): Vite dev server, export uses blob URLs + `window.print()`
- **Electron** (`npm run dev:electron`): `electron/main.cjs` creates a BrowserWindow loading Vite or `dist/index.html`
- **Android** (`npx cap sync android`): Capacitor wraps `dist/` in a WebView; file I/O uses `@capacitor/filesystem`

Runtime detection in `src/App.tsx` and `src/lib/export.ts`:
```typescript
const isElectronEnv  = () => !!window.electronAPI?.isElectron;   // set by preload.cjs
const isCapacitorEnv = () => typeof (window as any).Capacitor !== 'undefined';
```
Export functions check `isElectron()` then `isCapacitor()` before falling back to browser behavior.

### State management — `src/context.tsx`
Single `AppContext` (no Redux) holds all application state. Key design choices:
- Editor content + undo/redo uses `useReducer` with `EditorState { content, history[], historyIndex }`. History is pushed debounced (600ms) to avoid flooding the stack.
- Settings (`theme`, `direction`, `fontFamily`, `fontSize`, `syncScroll`) persist via `useLocalStorage` with keys `gt-md-*`.
- `direction` changes ONLY the editor `textarea` direction and preview `div[dir]` — the UI stays RTL (`html[dir=rtl]` from `index.html`). Never apply `direction` to the app wrapper.
- `editorRef` (a `RefObject<HTMLTextAreaElement>`) lives in context so `insertAtCursor` can reach the textarea from toolbar buttons and modals.
- `fontFamily` controls the **preview and export** font only; the editor textarea is hardcoded to `'Noto Sans Arabic'`.

### App-level logic — `src/App.tsx`
All cross-cutting concerns live here (not in context):
- **Auto-save** (`SAVE_DIR = 'MARKDAWIN'`): debounced 30s, writes to `~/Documents/MARKDAWIN/auto-*.md`. Uses `Filesystem.writeFile({ encoding: Encoding.UTF8 })` on Android — never pass `'utf8' as any` (that writes base64, corrupting Arabic text).
- **Confirm before open**: when the editor has content and a new file is dropped/imported, shows a 3-button dialog (Save / Discard / Cancel).
- **Close confirmation**: Electron intercepts `beforeunload` with `isIntentionalClose` ref. When user confirms close, calls `window.electronAPI.forceClose()` → IPC `force-close` → `win.destroy()` on main process. **Do not use `window.close()` for the intentional close path** — it re-fires `beforeunload` causing an infinite loop.
- **Android back button**: Capacitor `App.addListener('backButton')` shows the close confirmation dialog.

### Markdown pipeline — `src/lib/markdown.ts`
`marked` v15 is configured once at module load with:
1. `markedHighlight` → highlight.js for fenced code blocks
2. Custom block extension: `$$...$$` → KaTeX `displayMode:true`
3. Custom inline extension: `$...$` → KaTeX `displayMode:false`
4. Custom block extension: `[^id]: text` → footnote definitions
5. Custom inline extension: `[^id]` → footnote references
6. GFM + `breaks:true` globally

The custom `listitem` renderer was intentionally removed — GFM handles task lists natively. Do not add it back; it breaks list rendering with the "Token with 'list' type was not found" error.

### Text insertion — `src/lib/insertText.ts`
`insertAroundSelection(content, selStart, selEnd, before, after, placeholder)` returns the new content string and the new cursor range without touching the DOM. `context.insertAtCursor` calls this then uses `requestAnimationFrame` to restore cursor position after React re-renders the controlled textarea.

### Export — `src/lib/export.ts`
KaTeX CSS is imported as an inline string via `import katexCSS from 'katex/dist/katex.min.css?inline'`. The `@font-face` declarations are stripped (they reference font files unavailable in a `data:` URL context). This means PDF math renders with system serif fonts — intentional for offline support.

**Electron PDF path**: `window.electronAPI.printToPDF(html)` → IPC → `main.cjs` creates a hidden `BrowserWindow`, loads HTML via `data:text/html;base64,...`, calls `webContents.printToPDF({ margins: { marginType: 'none' } })`. `marginType:'none'` is required — numeric margin values are interpreted in inches by Electron, not mm, and would throw "margins must be less than or equal to pageSize".

**Android PDF path**: `window.print()` is not supported in Capacitor WebView. Instead, the HTML is saved to `Documents/MARKDAWIN/` as a `.html` file. The user opens it in Chrome and prints to PDF from there.

### Electron IPC — `electron/main.cjs`
Four IPC handlers:
- `force-close`: calls `win.destroy()` — bypasses `beforeunload`, used when user confirms close dialog
- `print-to-pdf`: creates hidden window, loads HTML as base64 data URL, prints to PDF, shows native save dialog
- `save-file`: shows native save dialog, writes content to chosen path
- `get-font-base64`: reads a font from `dist/fonts/` (unpacked from ASAR) and returns it as base64 for embedding in PDF

Fonts and emojis are listed in `asarUnpack` in `package.json` so they remain as real filesystem files (not inside the ASAR) — this is required for `get-font-base64` to read them with `fs.readFileSync`.

External links: `setWindowOpenHandler` opens `https?://` URLs via `shell.openExternal`. `will-navigate` prevents the main window from navigating away. `blob:` and `data:` URLs are allowed through for browser-mode print dialogs.

### Android file reading — `src/App.tsx` `appUrlOpen` handler
When the user opens a `.md` or `.txt` file from the Android file manager, Capacitor fires `appUrlOpen` with a `content://` URI. Reading must be done with `Filesystem.readFile({ path: url, encoding: Encoding.UTF8 })` first (returns a plain string). If that fails, fall back to reading without encoding (returns base64) and decode with:
```typescript
const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
new TextDecoder('utf-8').decode(bytes);
```
**Never use `atob()` directly on Arabic text** — `atob()` produces a binary string, not a Unicode string, causing garbled characters.

### Emoji panel positioning — `src/components/Header.tsx`
The panel position is set via CSS custom properties `--emoji-panel-top` and `--emoji-panel-left` on `document.documentElement` at click time using `getBoundingClientRect()`. The panel uses `left: var(--emoji-panel-left)` (not `right`, not `inset-inline-end`) to avoid RTL layout inversions. The positioning logic tries right-of-button first, then left-of-button, then clamped to viewport.

Emoji buttons use `onMouseDown={(e) => e.preventDefault()}` to prevent stealing focus from the editor textarea. After inserting, `requestAnimationFrame` scrolls the textarea to keep the cursor visible.

### CSS architecture
- `src/styles/index.css`: theming via `[data-theme="dark/light"]` CSS custom properties on `:root`, app layout, responsive breakpoints (< 700px hides `.header-brand-text`, < 480px full mobile layout)
- `src/styles/preview.css`: Markdown content styling + RTL/LTR directional overrides + `@media print` (hides all chrome)
- `public/fonts.css`: `@font-face` declarations with paths relative to the HTML file — loaded directly from `index.html`, NOT imported through Vite, so font paths resolve correctly in both dev and packaged builds

### RPM packaging workaround
The project path contains Arabic characters and spaces, which causes `rpmbuild` to fail when invoked from the project directory. `scripts/build-packages.sh` extracts the DEB to `/tmp/gt-md-rpm-build` and runs `rpmbuild` from there. The `%files` section lists only top-level directories (`/opt/GT-MARKDAWIN`, `/usr/share/applications`, `/usr/share/icons`, `/usr/share/doc`) to avoid per-file listing of font files with spaces and parentheses in their names.

### Android icon sizing
Android launcher icons must have padding — the icon image should fill **72% of the canvas** (14% padding on each side). Without padding, the icon appears zoomed-in on the home screen. The `ic_launcher_foreground.png` (for adaptive icons on Android 8+) should have the icon filling only 50% of its canvas, since Android applies additional clipping.

## Key files not to confuse

| File | Purpose |
|------|---------|
| `electron/main.cjs` | CommonJS — Electron main process only |
| `electron/preload.cjs` | CommonJS — exposes `window.electronAPI` (isElectron, printToPDF, saveFile, getFontBase64, onOpenFile, forceClose) |
| `src/context.tsx` | ALL React state lives here |
| `src/App.tsx` | Cross-cutting app logic: auto-save, close confirm, drag-drop, file-open, Capacitor listeners |
| `src/lib/markdown.ts` | marked configuration, run once at import |
| `src/lib/export.ts` | all three export formats, Electron + Android + browser branching |
| `public/fonts.css` | font faces — not processed by Vite |
| `build/icons/` | generated by `scripts/build-packages.sh icons` |
| `الإصدارات/v3.0.0/` | all release packages (APK · AppImage · DEB · RPM · Flatpak) |
| `android/app/src/main/AndroidManifest.xml` | Android permissions + file intent-filters (.md, .txt) |
| `capacitor.config.ts` | Capacitor app ID + Android options |

## localStorage keys

| Key | Default | Persists |
|-----|---------|---------|
| `gt-md-content` | DEFAULT_CONTENT | editor text |
| `gt-md-theme` | `'dark'` | theme |
| `gt-md-dir` | `'rtl'` | text direction (editor + preview only) |
| `gt-md-font` | `'Ubuntu Arabic'` | preview/export font |
| `gt-md-fontsize` | `16` | font size (px) |
| `gt-md-sync` | `true` | scroll sync enabled |
| `gt-md-custom-fonts` | `[]` | user-imported fonts |
