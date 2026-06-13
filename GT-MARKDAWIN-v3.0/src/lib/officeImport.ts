// ─── Office document import → Markdown ────────────────────────────────────────
// Converts .docx / .doc / .odt / .odf / .fodt into Markdown for the editor.
//
// Strategy (best fidelity first):
//   1. Desktop (Electron): LibreOffice headless via IPC `convert-office`.
//      Handles ALL formats including the legacy binary .doc.
//   2. Fallback JS engine (browser / Android / desktop without LibreOffice):
//      .docx  → mammoth → HTML
//      .odt   → fflate (unzip) + content.xml parse → HTML
//      .doc   → unsupported in pure JS (clear message asking for LibreOffice)
// In all cases the resulting HTML is turned into Markdown with turndown.

import TurndownService from 'turndown';
import { unzipSync, strFromU8 } from 'fflate';

const isElectron = () =>
  typeof window !== 'undefined' && !!window.electronAPI?.isElectron;

export function isOfficeFile(name: string): boolean {
  return /\.(docx?|odt|odf|fodt)$/i.test(name);
}

// ── HTML → Markdown ───────────────────────────────────────────────────────────
let _td: TurndownService | null = null;
function htmlToMarkdown(html: string): string {
  if (!_td) {
    _td = new TurndownService({
      headingStyle: 'atx',
      bulletListMarker: '-',
      codeBlockStyle: 'fenced',
      emDelimiter: '*',
    });
    // marked renders raw HTML tables/sub/sup — keep them instead of dropping
    _td.keep(['table', 'thead', 'tbody', 'tr', 'th', 'td', 'sub', 'sup']);
  }
  // strip everything outside <body> if present
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const inner = bodyMatch ? bodyMatch[1] : html;
  return _td.turndown(inner).replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

// ── Base64 helpers (chunked to avoid call-stack limits on large files) ────────
function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

// ── DOCX via mammoth ──────────────────────────────────────────────────────────
async function docxToMarkdown(arrayBuffer: ArrayBuffer): Promise<string> {
  const mammoth = await import('mammoth');
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer });
  return htmlToMarkdown(html);
}

// ── ODT / ODF / FODT via fflate + content.xml ─────────────────────────────────
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Build a map of automatic text-style name → inline formatting flags
function buildOdtStyleMap(doc: Document): Record<string, { b?: boolean; i?: boolean; u?: boolean }> {
  const map: Record<string, { b?: boolean; i?: boolean; u?: boolean }> = {};
  const styles = doc.getElementsByTagName('style:style');
  for (let i = 0; i < styles.length; i++) {
    const st = styles[i];
    const name = st.getAttribute('style:name');
    if (!name) continue;
    const tp = st.getElementsByTagName('style:text-properties')[0];
    if (!tp) continue;
    const fmt: { b?: boolean; i?: boolean; u?: boolean } = {};
    if (tp.getAttribute('fo:font-weight') === 'bold') fmt.b = true;
    if (tp.getAttribute('fo:font-style') === 'italic') fmt.i = true;
    const ul = tp.getAttribute('style:text-underline-style');
    if (ul && ul !== 'none') fmt.u = true;
    map[name] = fmt;
  }
  return map;
}

// Map paragraph automatic-style name → heading level, for documents where
// headings are paragraph-styled (Title / Heading N) instead of <text:h>.
function buildOdtHeadingMap(doc: Document): Record<string, number> {
  const map: Record<string, number> = {};
  const levelOf = (ref: string | null): number | null => {
    if (!ref) return null;
    const m = ref.match(/^Heading_20_(\d+)$/);
    if (m) return Math.min(6, Math.max(1, parseInt(m[1], 10)));
    if (ref === 'Title') return 1;
    if (ref === 'Subtitle') return 2;
    return null;
  };
  const styles = doc.getElementsByTagName('style:style');
  for (let i = 0; i < styles.length; i++) {
    const st = styles[i];
    if (st.getAttribute('style:family') !== 'paragraph') continue;
    const name = st.getAttribute('style:name');
    if (!name) continue;
    const lvl = levelOf(st.getAttribute('style:parent-style-name')) ?? levelOf(name);
    if (lvl) map[name] = lvl;
  }
  return map;
}

// Convert the inline children of an ODT element to HTML
function odtInline(node: Element, styles: Record<string, { b?: boolean; i?: boolean; u?: boolean }>): string {
  let out = '';
  node.childNodes.forEach((child) => {
    if (child.nodeType === 3) {
      out += escapeHtml(child.nodeValue || '');
      return;
    }
    if (child.nodeType !== 1) return;
    const el = child as Element;
    const tag = el.tagName; // namespaced, e.g. text:span
    if (tag === 'text:span') {
      const fmt = styles[el.getAttribute('text:style-name') || ''] || {};
      let inner = odtInline(el, styles);
      if (fmt.b) inner = `<strong>${inner}</strong>`;
      if (fmt.i) inner = `<em>${inner}</em>`;
      if (fmt.u) inner = `<u>${inner}</u>`;
      out += inner;
    } else if (tag === 'text:a') {
      const href = el.getAttribute('xlink:href') || '';
      out += `<a href="${escapeHtml(href)}">${odtInline(el, styles)}</a>`;
    } else if (tag === 'text:line-break') {
      out += '<br>';
    } else if (tag === 'text:tab') {
      out += '\t';
    } else if (tag === 'text:s') {
      const c = parseInt(el.getAttribute('text:c') || '1', 10) || 1;
      out += ' '.repeat(c);
    } else {
      out += odtInline(el, styles);
    }
  });
  return out;
}

// Convert a list element to HTML (ordered detection is best-effort → bullets)
function odtList(el: Element, styles: Record<string, { b?: boolean; i?: boolean; u?: boolean }>): string {
  let items = '';
  for (let i = 0; i < el.children.length; i++) {
    const li = el.children[i];
    if (li.tagName !== 'text:list-item') continue;
    let liHtml = '';
    for (let j = 0; j < li.children.length; j++) {
      const c = li.children[j];
      if (c.tagName === 'text:list') liHtml += odtList(c, styles);
      else liHtml += odtInline(c, styles);
    }
    items += `<li>${liHtml}</li>`;
  }
  return `<ul>${items}</ul>`;
}

function odtTable(el: Element, styles: Record<string, { b?: boolean; i?: boolean; u?: boolean }>): string {
  let rows = '';
  const trs = el.getElementsByTagName('table:table-row');
  for (let r = 0; r < trs.length; r++) {
    let cells = '';
    const tds = trs[r].getElementsByTagName('table:table-cell');
    for (let c = 0; c < tds.length; c++) {
      cells += `<td>${odtInline(tds[c], styles)}</td>`;
    }
    rows += `<tr>${cells}</tr>`;
  }
  return `<table>${rows}</table>`;
}

function odtXmlToHtml(xml: string): string {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const styles = buildOdtStyleMap(doc);
  const headings = buildOdtHeadingMap(doc);
  const body = doc.getElementsByTagName('office:text')[0];
  if (!body) throw new Error('بنية ODT غير متوقعة');

  let html = '';
  const walk = (parent: Element) => {
    for (let i = 0; i < parent.children.length; i++) {
      const el = parent.children[i];
      const tag = el.tagName;
      if (tag === 'text:h') {
        const lvl = Math.min(6, Math.max(1, parseInt(el.getAttribute('text:outline-level') || '1', 10) || 1));
        const inner = odtInline(el, styles).trim();
        if (inner) html += `<h${lvl}>${inner}</h${lvl}>`;
      } else if (tag === 'text:p') {
        const inner = odtInline(el, styles).trim();
        if (!inner) continue;
        const hLvl = headings[el.getAttribute('text:style-name') || ''];
        html += hLvl ? `<h${hLvl}>${inner}</h${hLvl}>` : `<p>${inner}</p>`;
      } else if (tag === 'text:list') {
        html += odtList(el, styles);
      } else if (tag === 'table:table') {
        html += odtTable(el, styles);
      } else if (tag === 'text:section' || tag === 'office:text') {
        walk(el);
      }
    }
  };
  walk(body);
  return html;
}

function odtToMarkdown(arrayBuffer: ArrayBuffer, name: string): string {
  let xml: string;
  if (/\.fodt$/i.test(name)) {
    xml = strFromU8(new Uint8Array(arrayBuffer)); // flat ODT is plain XML
  } else {
    const files = unzipSync(new Uint8Array(arrayBuffer));
    const content = files['content.xml'];
    if (!content) throw new Error('الملف لا يحتوي على content.xml');
    xml = strFromU8(content);
  }
  return htmlToMarkdown(odtXmlToHtml(xml));
}

// ── Main entry: convert any supported office file to Markdown ──────────────────
export async function officeToMarkdown(file: { name: string; arrayBuffer: ArrayBuffer }): Promise<string> {
  const { name, arrayBuffer } = file;
  const lower = name.toLowerCase();

  // 1) Desktop: LibreOffice (highest fidelity, supports legacy .doc)
  if (isElectron() && window.electronAPI?.convertOffice) {
    try {
      const res = await window.electronAPI.convertOffice({
        name,
        dataBase64: arrayBufferToBase64(arrayBuffer),
      });
      if (res?.success && res.html) return htmlToMarkdown(res.html);
      // LibreOffice present but failed on a real error → surface it for .doc
      if (res && res.reason !== 'no-libreoffice' && lower.endsWith('.doc')) {
        throw new Error(res.error || 'تعذّر تحويل المستند عبر LibreOffice');
      }
      // otherwise fall through to the JS engine
    } catch (err) {
      if (lower.endsWith('.doc')) throw err; // .doc has no JS fallback
      // else fall through to JS
    }
  }

  // 2) JS engine
  if (lower.endsWith('.docx')) return docxToMarkdown(arrayBuffer);
  if (/\.(odt|odf|fodt)$/.test(lower)) return odtToMarkdown(arrayBuffer, name);
  if (lower.endsWith('.doc')) {
    throw new Error('صيغة .doc القديمة تتطلّب تثبيت LibreOffice على الجهاز');
  }
  throw new Error('صيغة مكتبية غير مدعومة');
}

// Decode base64 (used when the OS delivers an office file as base64)
export function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}
