import { useState } from 'react';
import { Sigma } from 'lucide-react';
import katex from 'katex';
import { useApp } from '../../context';
import ModalBase from './ModalBase';

export default function MathModal() {
  const { activeModal, insertAtCursor } = useApp();
  const [latex, setLatex] = useState('');
  const [mode, setMode] = useState<'inline' | 'block'>('block');
  const [preview, setPreview] = useState('');
  const [error, setError] = useState('');

  if (activeModal !== 'math') return null;

  const handleLatexChange = (val: string) => {
    setLatex(val);
    try {
      const rendered = katex.renderToString(val, {
        displayMode: mode === 'block',
        throwOnError: true,
      });
      setPreview(rendered);
      setError('');
    } catch (e: any) {
      setPreview('');
      setError(e.message);
    }
  };

  const handleInsert = () => {
    if (!latex) return;
    if (mode === 'block') {
      insertAtCursor(`\n$$\n${latex}\n$$\n`);
    } else {
      insertAtCursor(`$${latex}$`);
    }
  };

  return (
    <ModalBase title="إدراج معادلة رياضية" icon={<Sigma size={16} />} onInsert={handleInsert}>
      <div className="form-group">
        <label className="form-label">نوع المعادلة</label>
        <div style={{ display: 'flex', gap: '1rem' }}>
          {(['block', 'inline'] as const).map(m => (
            <label key={m} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer' }}>
              <input type="radio" value={m} checked={mode === m}
                onChange={() => { setMode(m); handleLatexChange(latex); }} />
              <span style={{ fontSize: '0.82rem' }}>{m === 'block' ? 'كتلة ($$)' : 'مضمّن ($)'}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">معادلة LaTeX *</label>
        <textarea
          className="form-textarea"
          placeholder="مثال: E = mc^2  أو  \frac{a}{b}"
          value={latex}
          onChange={e => handleLatexChange(e.target.value)}
          style={{ fontFamily: 'monospace', direction: 'ltr' }}
          autoFocus
        />
      </div>

      {error && (
        <div style={{ fontSize: '0.78rem', color: 'var(--error)', padding: '0.4rem', background: 'rgba(248,81,73,0.08)', borderRadius: 6 }}>
          ⚠️ {error}
        </div>
      )}

      {preview && (
        <div style={{ padding: '0.75rem', background: 'var(--surface2)', borderRadius: 8, border: '1px solid var(--border)', textAlign: 'center', direction: 'ltr' }}>
          <div dangerouslySetInnerHTML={{ __html: preview }} />
        </div>
      )}
    </ModalBase>
  );
}
