import { marked } from 'marked';
import { markedHighlight } from 'marked-highlight';
import hljs from 'highlight.js';
import katex from 'katex';

// ── Syntax highlighting ───────────────────────────────────────────────────────
marked.use(
  markedHighlight({
    langPrefix: 'hljs language-',
    highlight(code, lang) {
      if (lang && hljs.getLanguage(lang)) {
        return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
      }
      return hljs.highlightAuto(code).value;
    },
  }),
);

// ── Math extensions (block $$ and inline $) ───────────────────────────────────
marked.use({
  extensions: [
    {
      name: 'blockMath',
      level: 'block',
      start(src) {
        return src.indexOf('$$');
      },
      tokenizer(src) {
        const match = /^\$\$\n?([\s\S]+?)\n?\$\$/.exec(src);
        if (match) {
          return { type: 'blockMath', raw: match[0], text: match[1].trim() };
        }
        return undefined;
      },
      renderer(token) {
        try {
          return `<div class="math-block">${katex.renderToString(token.text as string, {
            displayMode: true,
            throwOnError: false,
          })}</div>\n`;
        } catch {
          return `<pre class="math-error">$$${token.text}$$</pre>\n`;
        }
      },
    },
    {
      name: 'inlineMath',
      level: 'inline',
      start(src) {
        return src.indexOf('$');
      },
      tokenizer(src) {
        // Must not match $$
        if (src.startsWith('$$')) return undefined;
        const match = /^\$([^$\n]+?)\$/.exec(src);
        if (match) {
          return { type: 'inlineMath', raw: match[0], text: match[1].trim() };
        }
        return undefined;
      },
      renderer(token) {
        try {
          return katex.renderToString(token.text as string, {
            displayMode: false,
            throwOnError: false,
          });
        } catch {
          return `<code class="math-error">$${token.text}$</code>`;
        }
      },
    },
    // ── Footnote definitions: [^id]: text ──────────────────────────────────
    {
      name: 'footnoteItem',
      level: 'block',
      start(src) {
        return src.indexOf('[^');
      },
      tokenizer(src) {
        const match = /^\[\^([^\]]+)\]:\s*(.+)/.exec(src);
        if (match) {
          return { type: 'footnoteItem', raw: match[0], id: match[1], text: match[2] };
        }
        return undefined;
      },
      renderer(token) {
        return `<p class="footnote-item" id="fn-${token.id}">` +
          `<sup>${token.id}</sup> ${token.text} ` +
          `<a href="#fnref-${token.id}" class="footnote-back">↩</a></p>`;
      },
    },
    // ── Footnote references: [^id] ──────────────────────────────────────────
    {
      name: 'footnoteRef',
      level: 'inline',
      start(src) {
        return src.indexOf('[^');
      },
      tokenizer(src) {
        const match = /^\[\^([^\]]+)\](?!:)/.exec(src);
        if (match) {
          return { type: 'footnoteRef', raw: match[0], id: match[1] };
        }
        return undefined;
      },
      renderer(token) {
        return `<sup class="footnote-ref"><a href="#fn-${token.id}" id="fnref-${token.id}">[${token.id}]</a></sup>`;
      },
    },
  ],
});

// ── GFM options (no custom listitem — GFM handles task lists natively) ────────
marked.setOptions({
  gfm: true,
  breaks: true,
});

export function renderMarkdown(content: string): string {
  try {
    return marked.parse(content) as string;
  } catch (err) {
    console.error('Markdown render error:', err);
    return `<p style="color:var(--error);padding:1rem;border:1px solid var(--error);border-radius:6px">
      خطأ في تحليل Markdown: ${String(err)}
    </p>`;
  }
}
