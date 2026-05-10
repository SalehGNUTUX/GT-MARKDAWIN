import { useState } from 'react';
import { Link2 } from 'lucide-react';
import { useApp } from '../../context';
import ModalBase from './ModalBase';

export default function LinkModal() {
  const { activeModal, insertAtCursor } = useApp();
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');

  if (activeModal !== 'link') return null;

  const handleInsert = () => {
    const t = text || url;
    const titlePart = title ? ` "${title}"` : '';
    insertAtCursor(`[${t}](${url}${titlePart})`);
  };

  return (
    <ModalBase title="إدراج رابط" icon={<Link2 size={16} />} onInsert={handleInsert}>
      <div className="form-group">
        <label className="form-label">نص الرابط</label>
        <input className="form-input" placeholder="النص المعروض" value={text}
          onChange={e => setText(e.target.value)} autoFocus />
      </div>
      <div className="form-group">
        <label className="form-label">عنوان URL *</label>
        <input className="form-input" placeholder="https://example.com" value={url}
          onChange={e => setUrl(e.target.value)} type="url" />
      </div>
      <div className="form-group">
        <label className="form-label">عنوان التلميح (اختياري)</label>
        <input className="form-input" placeholder="عنوان عند التحويم" value={title}
          onChange={e => setTitle(e.target.value)} />
      </div>
    </ModalBase>
  );
}
