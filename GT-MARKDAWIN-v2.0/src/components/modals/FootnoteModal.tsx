import { useState } from 'react';
import { BookMarked } from 'lucide-react';
import { useApp } from '../../context';
import ModalBase from './ModalBase';

export default function FootnoteModal() {
  const { activeModal, insertAtCursor, content, setContent } = useApp();
  const [id, setId] = useState('1');
  const [text, setText] = useState('');

  if (activeModal !== 'footnote') return null;

  const handleInsert = () => {
    if (!id) return;
    // Insert reference at cursor
    insertAtCursor(`[^${id}]`);
    // Append definition at end
    setTimeout(() => {
      setContent(content + `\n[^${id}]: ${text}\n`);
    }, 50);
  };

  return (
    <ModalBase title="إدراج حاشية" icon={<BookMarked size={16} />} onInsert={handleInsert}>
      <div className="form-group">
        <label className="form-label">معرّف الحاشية *</label>
        <input className="form-input" placeholder="1" value={id}
          onChange={e => setId(e.target.value)} autoFocus />
      </div>
      <div className="form-group">
        <label className="form-label">نص الحاشية *</label>
        <textarea className="form-textarea" placeholder="نص الحاشية المرجعية" value={text}
          onChange={e => setText(e.target.value)} />
      </div>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: 'var(--surface2)', padding: '0.5rem', borderRadius: 6 }}>
        ستُضاف الإشارة <code>[^{id}]</code> في موضع المؤشر، والتعريف في نهاية المستند.
      </div>
    </ModalBase>
  );
}
