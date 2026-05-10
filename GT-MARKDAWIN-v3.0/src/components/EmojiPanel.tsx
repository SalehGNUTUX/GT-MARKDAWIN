import { useEffect, useRef, useState, useMemo } from 'react';
import { useApp } from '../context';

// ── Unicode range → category ──────────────────────────────────────────────────
interface Category {
  label: string;
  ranges: [number, number][];
  keywords: string[];
}

const CATEGORIES: Category[] = [
  {
    label: '😀 وجوه ومشاعر',
    ranges: [[0x1F600, 0x1F64F], [0x1F910, 0x1F93F], [0x1F970, 0x1F97F], [0x1F9D0, 0x1F9E0]],
    keywords: ['smile', 'face', 'happy', 'sad', 'angry', 'laugh', 'cry', 'love',
               'ابتسامة', 'وجه', 'مشاعر', 'سعيد', 'حزين', 'غاضب', 'ضحكة', 'بكاء', 'حب'],
  },
  {
    label: '✋ أيدي وأجساد',
    ranges: [[0x1F44B, 0x1F44F], [0x1F590, 0x1F596], [0x1F450, 0x1F45C],
             [0x261D, 0x261F], [0x1F4AA, 0x1F4AA]],
    keywords: ['hand', 'wave', 'ok', 'thumbs', 'clap', 'body',
               'يد', 'موافق', 'تصفيق', 'جسم'],
  },
  {
    label: '🐶 حيوانات وطبيعة',
    ranges: [[0x1F400, 0x1F43F], [0x1F980, 0x1F9AF], [0x1F330, 0x1F33F]],
    keywords: ['animal', 'dog', 'cat', 'bird', 'plant', 'flower',
               'حيوان', 'كلب', 'قطة', 'طائر', 'نبات', 'زهرة'],
  },
  {
    label: '🍎 طعام وشراب',
    ranges: [[0x1F347, 0x1F37F], [0x1F950, 0x1F96F], [0x1F99E, 0x1F9C3]],
    keywords: ['food', 'eat', 'drink', 'fruit', 'طعام', 'أكل', 'فاكهة'],
  },
  {
    label: '⚽ رياضة وترفيه',
    ranges: [[0x26BD, 0x26CE], [0x1F3A0, 0x1F3CC]],
    keywords: ['sport', 'game', 'ball', 'music', 'رياضة', 'لعبة', 'كرة'],
  },
  {
    label: '🚗 مواصلات وأماكن',
    ranges: [[0x1F680, 0x1F6FF], [0x1F30D, 0x1F32F]],
    keywords: ['car', 'plane', 'travel', 'earth', 'سيارة', 'طائرة', 'سفر'],
  },
  {
    label: '💡 أشياء ورموز',
    ranges: [[0x1F4CC, 0x1F4FF], [0x1F527, 0x1F587], [0x260E, 0x2615]],
    keywords: ['object', 'tool', 'phone', 'book', 'light', 'شيء', 'هاتف', 'كتاب'],
  },
  {
    label: '❤️ قلوب ورموز',
    ranges: [[0x2764, 0x2764], [0x1F48C, 0x1F49F], [0x2600, 0x26FF], [0x2702, 0x27BF]],
    keywords: ['heart', 'love', 'star', 'symbol', 'قلب', 'حب', 'نجمة', 'رمز'],
  },
  {
    label: '🚩 أعلام',
    ranges: [[0x1F1E6, 0x1F1FF]],   // Regional Indicator letters (combine into flags)
    keywords: ['flag', 'country', 'nation', 'arab',
               'علم', 'دولة', 'بلد', 'عربي', 'مغرب', 'سعودية', 'مصر', 'الإمارات'],
  },
];

function getCategory(unicode: string): string {
  // Multi-codepoint: take only the first part for category detection
  const firstCode = parseInt(unicode.split('-')[0], 16);
  if (isNaN(firstCode)) return '📦 أخرى';
  for (const cat of CATEGORIES) {
    for (const [lo, hi] of cat.ranges) {
      if (firstCode >= lo && firstCode <= hi) return cat.label;
    }
  }
  return '📦 أخرى';
}

// ── Build unicode char from possibly multi-codepoint hex string ───────────────
// e.g. "1f1f8-1f1e6" → "🇸🇦"  (Saudi Arabia flag)
function unicodeToChar(unicode: string): string {
  try {
    return unicode
      .split('-')
      .map(u => String.fromCodePoint(parseInt(u, 16)))
      .join('');
  } catch {
    return '';
  }
}

// ── Is this emoji a flag? (regional indicator pairs) ─────────────────────────
function isFlag(unicode: string): boolean {
  const parts = unicode.split('-');
  if (parts.length !== 2) return false;
  const a = parseInt(parts[0], 16);
  const b = parseInt(parts[1], 16);
  return a >= 0x1F1E6 && a <= 0x1F1FF && b >= 0x1F1E6 && b <= 0x1F1FF;
}

// ── Emoji entry ───────────────────────────────────────────────────────────────
interface EmojiEntry {
  name: string;
  unicode: string;
  png: string;
  char: string;
  category: string;
  flag: boolean;
}

// ── Fallback emoji set (unicode chars) ───────────────────────────────────────
function makeFallback(): EmojiEntry[] {
  const ranges: [number, number][] = [
    [0x1F600, 0x1F64F], [0x1F300, 0x1F34F],
    [0x1F680, 0x1F6FF], [0x2600, 0x26FF],
  ];
  const result: EmojiEntry[] = [];
  for (const [lo, hi] of ranges) {
    for (let code = lo; code <= hi; code++) {
      try {
        const char = String.fromCodePoint(code);
        const unicode = code.toString(16);
        result.push({ name: unicode, unicode, png: '', char, category: getCategory(unicode), flag: false });
      } catch { /* skip */ }
    }
  }
  return result;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function EmojiPanel() {
  const { showEmoji, setShowEmoji, insertAtCursor, editorRef, notify } = useApp();
  const [allEmojis, setAllEmojis]   = useState<EmojiEntry[]>([]);
  const [loading, setLoading]       = useState(false);
  const [search, setSearch]         = useState('');
  const panelRef  = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Load emojis.json on first open
  useEffect(() => {
    if (!showEmoji || allEmojis.length > 0) return;
    setLoading(true);

    fetch('./emojis.json')
      .then(r => r.json())
      .then((raw: unknown) => {
        let entries: EmojiEntry[] = [];

        if (Array.isArray(raw)) {
          entries = (raw as { name: string; unicode: string; png?: string }[])
            .filter(e => e.unicode)
            .map(e => {
              const char = unicodeToChar(e.unicode);
              const flag = isFlag(e.unicode);
              return {
                name:     e.name ?? e.unicode,
                unicode:  e.unicode,
                png:      e.png ?? '',
                char,
                category: getCategory(e.unicode),
                flag,
              };
            })
            .filter(e => e.char);
        } else if (typeof raw === 'object' && raw !== null) {
          entries = Object.entries(raw as Record<string, Record<string, string>>)
            .filter(([key]) => /^[0-9a-f-]+$/i.test(key))
            .map(([key, val]) => {
              const unicode = val.unicode ?? key;
              const char = unicodeToChar(unicode);
              const flag = isFlag(unicode);
              return {
                name:     val.name ?? key,
                unicode,
                png:      val.png ?? '',
                char,
                category: getCategory(unicode),
                flag,
              };
            })
            .filter(e => e.char);
        }

        setAllEmojis(entries.length > 0 ? entries : makeFallback());
      })
      .catch(() => setAllEmojis(makeFallback()))
      .finally(() => setLoading(false));
  }, [showEmoji, allEmojis.length]);

  // Focus search on open
  useEffect(() => {
    if (showEmoji) setTimeout(() => searchRef.current?.focus(), 80);
  }, [showEmoji]);

  // Close on outside click
  useEffect(() => {
    if (!showEmoji) return;
    const h = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node))
        setShowEmoji(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [showEmoji, setShowEmoji]);

  // Close on Escape
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && showEmoji) setShowEmoji(false); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [showEmoji, setShowEmoji]);

  // ── Filtering ────────────────────────────────────────────────────────────────
  const { grouped, total } = useMemo(() => {
    const q = search.trim().toLowerCase();

    let filtered: EmojiEntry[];
    if (!q) {
      filtered = allEmojis;
    } else {
      const matchedCats = new Set<string>(
        CATEGORIES
          .filter(cat => cat.keywords.some(kw => kw.includes(q) || q.includes(kw)))
          .map(cat => cat.label),
      );
      filtered = allEmojis.filter(e =>
        e.unicode.includes(q) ||
        e.char.includes(search) ||
        matchedCats.has(e.category) ||
        e.name.toLowerCase().includes(q),
      );
    }

    const map = new Map<string, EmojiEntry[]>();
    for (const e of filtered) {
      if (!map.has(e.category)) map.set(e.category, []);
      map.get(e.category)!.push(e);
    }

    const order = CATEGORIES.map(c => c.label);
    const sorted = [...map.entries()].sort(([a], [b]) => {
      const ai = order.indexOf(a), bi = order.indexOf(b);
      if (ai === -1 && bi === -1) return 0;
      if (ai === -1) return 1; if (bi === -1) return -1;
      return ai - bi;
    });

    return { grouped: sorted, total: filtered.length };
  }, [search, allEmojis]);

  if (!showEmoji) return null;

  // ── Insert emoji WITHOUT stealing focus from editor ───────────────────────
  const handleEmojiMouseDown = (e: React.MouseEvent, entry: EmojiEntry) => {
    // Prevent button from stealing focus — keeps editor focused and cursor position intact
    e.preventDefault();
  };

  const handleEmojiClick = (entry: EmojiEntry) => {
    insertAtCursor(entry.char);
    // Explicitly scroll editor to cursor after RAF (insertAtCursor already focuses)
    requestAnimationFrame(() => {
      const el = editorRef.current;
      if (el) {
        // Scroll the textarea so the cursor line is visible
        el.focus();
        const lineHeight = parseInt(getComputedStyle(el).lineHeight || '24');
        const lines = el.value.slice(0, el.selectionStart).split('\n').length;
        el.scrollTop = Math.max(0, (lines - 3) * lineHeight);
      }
    });
  };

  return (
    <div
      className="emoji-panel"
      ref={panelRef}
      dir="ltr"
      onClick={ev => ev.stopPropagation()}
    >
      {/* Search */}
      <div className="emoji-search">
        <input
          ref={searchRef}
          placeholder="ابحث... (smile, heart, flag, علم)"
          value={search}
          onChange={e => setSearch(e.target.value)}
          dir="ltr"
          // Don't steal focus from editor via mousedown
          onMouseDown={e => e.stopPropagation()}
        />
        {search && (
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginInlineStart: 6, whiteSpace: 'nowrap' }}>
            {total}
          </span>
        )}
      </div>

      {/* Grid */}
      <div style={{ overflowY: 'auto', flex: 1, padding: '0 4px 4px' }}>
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
            جاري تحميل الإيموجي...
          </div>
        ) : grouped.length === 0 ? (
          <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
            لا نتائج لـ "{search}"
          </div>
        ) : (
          grouped.map(([cat, emojis]) => (
            <div key={cat}>
              <div style={{
                fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)',
                padding: '6px 4px 3px', marginTop: 4,
                borderBottom: '1px solid var(--border-subtle)',
                direction: 'rtl',
              }}>
                {cat}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8,1fr)', gap: 2, padding: '3px 0' }}>
                {emojis.map((e, i) => (
                  <button
                    key={i}
                    className="emoji-btn"
                    title={e.char}
                    // Prevent focus steal — this is the critical fix for scroll jump
                    onMouseDown={ev => handleEmojiMouseDown(ev, e)}
                    onClick={() => handleEmojiClick(e)}
                  >
                    {/* Flags and multi-codepoint emojis: always use PNG if available */}
                    {e.png ? (
                      <img
                        src={`./${e.png}`}
                        alt={e.char}
                        width={26}
                        height={26}
                        loading="lazy"
                        style={{ display: 'block', imageRendering: 'auto' }}
                        onError={ev => {
                          // If PNG fails: show unicode char (flags may look like letters on some systems)
                          ev.currentTarget.style.display = 'none';
                          const span = document.createElement('span');
                          span.textContent = e.char;
                          span.style.fontSize = '1.2rem';
                          ev.currentTarget.parentElement?.appendChild(span);
                        }}
                      />
                    ) : (
                      e.char
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
