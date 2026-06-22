import { renderMarkdown } from './markdown';
// Import KaTeX CSS as inline string — Vite bundles it, no CDN needed
import katexCSSRaw from 'katex/dist/katex.min.css?inline';

// Strip @font-face (fonts won't be at a relative path in data: context)
// Math will render using system serif fonts — good enough for PDF
const KATEX_CSS = katexCSSRaw.replace(/@font-face\s*\{[^}]*\}/g, '');

const isElectron   = () => typeof window !== 'undefined' && !!window.electronAPI?.isElectron;
const isCapacitor  = () => typeof (window as any).Capacitor !== 'undefined';
const SAVE_DIR = 'MARKDAWIN';

// ── File download helper ──────────────────────────────────────────────────────
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ── Morocco timestamps ────────────────────────────────────────────────────────
function getMoroccanTimestamp(): string {
  try {
    const p = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Casablanca',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(new Date());
    const g = (t: string) => p.find(x => x.type === t)?.value ?? '00';
    return `${g('year')}-${g('month')}-${g('day')}_${g('hour')}-${g('minute')}`;
  } catch {
    return new Date().toISOString().slice(0, 16).replace(/[T:]/g, '-');
  }
}

function getMoroccanDateFormatted(): string {
  try {
    return new Intl.DateTimeFormat('ar-MA', {
      timeZone: 'Africa/Casablanca', dateStyle: 'full', timeStyle: 'short',
    }).format(new Date());
  } catch {
    return new Date().toLocaleDateString('ar');
  }
}

// ── Shared CSS (no external references, works in data: URL context) ───────────
function makeCSS(
  theme: string, direction: string, fontFamily: string, fontB64?: string | null,
): string {
  const isDark = theme === 'dark';
  const bg     = isDark ? '#0d1117' : '#ffffff';
  const text   = isDark ? '#e6edf3' : '#1f2328';
  const surf   = isDark ? '#161b22' : '#f6f8fa';
  const brd    = isDark ? '#30363d' : '#d0d7de';
  const acc    = isDark ? '#2f81f7' : '#0969da';
  const code   = isDark ? '#161b22' : '#f6f8fa';

  const fontFace = fontB64
    ? `@font-face{font-family:'${fontFamily}';src:url('data:font/truetype;base64,${fontB64}')format('truetype')}`
    : '';

  return `
${fontFace}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:'${fontFamily}','Noto Sans Arabic',system-ui,sans-serif;font-size:15px;
  line-height:1.85;color:${text};background:${bg};direction:${direction};padding:1.5rem}
.wrap{max-width:860px;margin:0 auto}
h1{font-size:1.9em;border-bottom:2px solid ${brd};padding-bottom:.3em;margin:1.5em 0 .5em;font-weight:700}
h2{font-size:1.5em;border-bottom:1px solid ${brd};padding-bottom:.2em;margin:1.3em 0 .4em;font-weight:700}
h3{font-size:1.2em;margin:1.1em 0 .3em;font-weight:700}
h4{font-size:1.05em;margin:1em 0 .3em;font-weight:700}
h5,h6{font-size:.9em;margin:.8em 0 .2em;font-weight:700}
p{margin:.5em 0}
a{color:${acc};text-decoration:underline}
strong{font-weight:700} em{font-style:italic} del{text-decoration:line-through;opacity:.7}
blockquote{border-inline-start:4px solid ${acc};padding:.4em 1em;margin:.8em 0;color:#8b949e;background:${surf};border-radius:4px}
:not(pre)>code{font-family:monospace;font-size:.875em;background:${code};padding:.15em .4em;border-radius:4px;border:1px solid ${brd};direction:ltr;display:inline-block}
pre{background:${code};border:1px solid ${brd};border-radius:8px;padding:1em;overflow-x:auto;margin:.8em 0;direction:ltr}
pre code{background:none;padding:0;border:none;font-size:.875em}
table{border-collapse:collapse;width:100%;margin:.8em 0;font-size:.9em}
th,td{border:1px solid ${brd};padding:.45em .75em;text-align:start}
th{background:${surf};font-weight:700}
tr:nth-child(even){background:${surf}}
ul,ol{padding-inline-start:1.75em;margin:.4em 0}
li{margin:.2em 0}
li input[type=checkbox]{margin-inline-end:.5em;accent-color:${acc}}
img{max-width:100%;border-radius:8px;display:block;margin:.4em auto}
hr{border:none;border-top:1px solid ${brd};margin:1.5em 0}
sup,sub{font-size:.8em}
.math-block{text-align:center;margin:1.2em 0;padding:.8em;background:${surf};border:1px solid ${brd};border-radius:8px;direction:ltr;overflow-x:auto}
.footnote-item{font-size:.85em;color:#8b949e;border-top:1px solid ${brd};padding:.3em 0}
.footnote-ref a,.footnote-back{color:${acc};font-size:.8em;text-decoration:none}
iframe{max-width:100%;border-radius:8px;border:1px solid ${brd};display:block;margin:.6em auto}
audio{display:block;margin:.6em auto;max-width:100%}
`;
}

// ── Build complete standalone HTML ────────────────────────────────────────────
function buildHTML(opts: {
  rendered: string; direction: string; fontFamily: string;
  theme?: string; fontB64?: string | null; forPrint?: boolean; date?: string;
}): string {
  const { rendered, direction, fontFamily, theme = 'light', fontB64, forPrint, date } = opts;
  const css = makeCSS(theme, direction, fontFamily, fontB64);
  const pdfHeaderCSS = forPrint ? `
    @page{margin:22mm 18mm}
    body{background:#fff;color:#000;padding:0}
    .wrap{max-width:none}
    .pdf-hdr{border-bottom:1.5pt solid #333;padding-bottom:5pt;margin-bottom:14pt;
      font-size:9pt;color:#555;display:flex;justify-content:space-between;flex-wrap:wrap}
    .pdf-hdr strong{font-size:10pt;color:#000}
    .pdf-ftr{border-top:1pt solid #aaa;margin-top:14pt;padding-top:4pt;font-size:8pt;color:#888;text-align:center}
    pre,code{font-size:9pt}
  ` : `.meta{font-size:.8em;color:#8b949e;border-bottom:1px solid;padding-bottom:.75em;margin-bottom:1.5em;display:flex;gap:1em;flex-wrap:wrap}`;

  const header = forPrint
    ? `<div class="pdf-hdr"><strong>GT-MARKDAWIN v3.0 — مارك دَوِّنْ مُحَرِّرٌ عَرَبِيٌّ عَصْرِيٌّ</strong><span>📅 ${date} | ${direction === 'rtl' ? 'RTL' : 'LTR'}</span></div>`
    : `<div class="meta"><span>GT-MARKDAWIN v3.0</span><span>📅 ${date}</span><span>${direction === 'rtl' ? 'RTL' : 'LTR'}</span></div>`;

  const footer = forPrint
    ? `<div class="pdf-ftr">GT-MARKDAWIN — SalehGNUTUX — GPL-3.0 — ${date}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="ar" dir="${direction}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>GT-MARKDAWIN${date ? ` — ${date}` : ''}</title>
  <style>${css}${pdfHeaderCSS}${KATEX_CSS}</style>
</head>
<body><div class="wrap">
${header}
${rendered}
${footer}
</div></body></html>`;
}

// ── Export Markdown ───────────────────────────────────────────────────────────
type NotifyFn = (m: string, t?: string) => void;

export interface SaveResult { success: boolean; path?: string; name?: string }

export async function exportMarkdown(content: string, notify?: NotifyFn): Promise<SaveResult> {
  const filename = `مستند-${getMoroccanTimestamp()}.md`;

  if (isElectron()) {
    const res = await window.electronAPI!.saveFile({ defaultName: filename, content });
    if (res.success) notify?.(`تم الحفظ ✅: ${res.path}`, 'success');
    return { success: !!res.success, path: res.path, name: res.path?.split('/').pop() };
  }

  if (isCapacitor()) {
    // Android: save to Documents/MARKDAWIN/ as UTF-8 text
    try {
      const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
      await Filesystem.mkdir({ path: SAVE_DIR, directory: Directory.Documents, recursive: true }).catch(() => {});
      await Filesystem.writeFile({
        path: `${SAVE_DIR}/${filename}`,
        data: content,           // UTF-8 string directly
        directory: Directory.Documents,
        encoding: Encoding.UTF8, // write as text, not base64
      });
      notify?.(`✅ تم الحفظ: Documents/${SAVE_DIR}/${filename}`, 'success');
      return { success: true, path: `${SAVE_DIR}/${filename}`, name: filename };
    } catch (err) {
      notify?.(`❌ فشل الحفظ: ${String(err)}`, 'error');
      return { success: false };
    }
  }

  downloadBlob(new Blob([content], { type: 'text/markdown;charset=utf-8' }), filename);
  notify?.('تم حفظ ملف Markdown', 'success');
  return { success: true, name: filename };
}

// ── Export HTML ───────────────────────────────────────────────────────────────
export async function exportHTML(
  content: string, theme: string, direction: string, fontFamily: string,
  notify?: NotifyFn,
) {
  const rendered = renderMarkdown(content);
  const date = getMoroccanDateFormatted();
  const filename = `مستند-${getMoroccanTimestamp()}.html`;
  const html = buildHTML({ rendered, direction, fontFamily, theme, date });

  if (isElectron()) {
    const res = await window.electronAPI!.saveFile({ defaultName: filename, content: html });
    if (res.success) notify?.(`تم تصدير HTML ✅: ${res.path}`, 'success');
    return;
  }

  if (isCapacitor()) {
    try {
      const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
      await Filesystem.mkdir({ path: SAVE_DIR, directory: Directory.Documents, recursive: true }).catch(() => {});
      await Filesystem.writeFile({
        path: `${SAVE_DIR}/${filename}`,
        data: html,
        directory: Directory.Documents,
        encoding: Encoding.UTF8,
      });
      notify?.(`✅ تم التصدير: Documents/${SAVE_DIR}/${filename}`, 'success');
    } catch (err) {
      notify?.(`❌ فشل التصدير: ${String(err)}`, 'error');
    }
    return;
  }

  downloadBlob(new Blob([html], { type: 'text/html;charset=utf-8' }), filename);
  notify?.('تم تصدير HTML', 'success');
}

// ── Export PDF ────────────────────────────────────────────────────────────────
export async function exportPDF(
  content: string, direction: string, fontFamily: string,
  notify?: NotifyFn,
) {
  const rendered = renderMarkdown(content);
  const date = getMoroccanDateFormatted();

  if (isElectron()) {
    // ── Electron: IPC → Chromium printToPDF, embedded font, fully offline ──
    notify?.('جاري إعداد PDF...', 'info');

    // Try to get the selected font as base64 for embedding
    const FONT_MAP: Record<string, string> = {
      'Ubuntu Arabic':       'fonts/Ubuntu Arabic Regular.otf',
      'Amiri Quran':         'fonts/amiri-quran.ttf',
      'Amiri Quran Colored': 'fonts/amiri-quran-colored.ttf',
      'Noto Sans Arabic':    'fonts/NotoSansArabic-Regular.ttf',
      'Uthmanic Hafs':       'fonts/UthmanicHafs1 Ver13.otf',
      'Arslan Wessam':       'fonts/(A) Arslan Wessam A (A) Arslan Wessam A.ttf',
    };
    const fontRelPath = FONT_MAP[fontFamily] ?? FONT_MAP['Noto Sans Arabic'];
    const fontB64 = await window.electronAPI!.getFontBase64(fontRelPath).catch(() => null);

    const html = buildHTML({ rendered, direction, fontFamily, fontB64, forPrint: true, date });

    const res = await window.electronAPI!.printToPDF(html);
    if (res.success) {
      notify?.(`✅ تم حفظ PDF: ${res.path}`, 'success');
    } else if (res.error !== 'cancelled') {
      notify?.(`❌ فشل تصدير PDF: ${res.error}`, 'error');
    }
    return;
  }

  // ── Android (Capacitor): save print-ready HTML to Documents/MARKDAWIN/ ──────
  // Android WebView doesn't support window.print() — save as HTML instead
  if (isCapacitor()) {
    notify?.('جاري تحضير ملف PDF/HTML...', 'info');
    try {
      const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
      const html = buildHTML({ rendered, direction, fontFamily, forPrint: true, date });
      const htmlFilename = `مستند-${getMoroccanTimestamp()}-print.html`;
      await Filesystem.mkdir({ path: SAVE_DIR, directory: Directory.Documents, recursive: true }).catch(() => {});
      await Filesystem.writeFile({
        path: `${SAVE_DIR}/${htmlFilename}`,
        data: html,
        directory: Directory.Documents,
        encoding: Encoding.UTF8,
      });
      notify?.(
        `✅ تم الحفظ في: Documents/${SAVE_DIR}/${htmlFilename}\n` +
        `افتحه في Chrome ثم اضغط ⋮ → طباعة → حفظ كـ PDF`,
        'success',
      );
    } catch (err) {
      notify?.(`❌ فشل: ${String(err)}`, 'error');
    }
    return;
  }

  // ── Browser fallback: blob URL + window.print() ──────────────────────────
  const html = buildHTML({ rendered, direction, fontFamily, forPrint: true, date });
  const printHtml = html.replace('</body>', `
  <script>
    window.addEventListener('load', function() {
      setTimeout(function(){ window.print(); }, 400);
    });
  <\/script>
  </body>`);

  const blob = new Blob([printHtml], { type: 'text/html;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const win  = window.open(url, '_blank');

  if (!win) {
    // Last resort: download as HTML
    notify?.('تعذّر فتح نافذة الطباعة — جاري تنزيل HTML بدلاً من ذلك', 'warning');
    downloadBlob(new Blob([printHtml], { type: 'text/html' }), `مستند-${getMoroccanTimestamp()}-print.html`);
  } else {
    notify?.('جاري فتح مربع الطباعة...', 'info');
    win.addEventListener('afterprint', () => {
      URL.revokeObjectURL(url);
    });
  }
}
