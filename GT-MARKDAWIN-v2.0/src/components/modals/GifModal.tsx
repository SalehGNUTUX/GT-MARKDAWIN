import { useState } from 'react';
import { ScanLine } from 'lucide-react';
import { useApp } from '../../context';
import ModalBase from './ModalBase';

export default function GifModal() {
  const { activeModal, insertAtCursor } = useApp();
  const [url, setUrl] = useState('');
  const [alt, setAlt] = useState('');

  if (activeModal !== 'gif') return null;

  const handleInsert = () => {
    insertAtCursor(`![${alt || 'GIF'}](${url})`);
  };

  return (
    <ModalBase title="إدراج GIF" icon={<ScanLine size={16} />} onInsert={handleInsert}>
      <div className="form-group">
        <label className="form-label">رابط GIF *</label>
        <input className="form-input" placeholder="https://example.com/animation.gif" value={url}
          onChange={e => setUrl(e.target.value)} autoFocus />
      </div>
      <div className="form-group">
        <label className="form-label">النص البديل</label>
        <input className="form-input" placeholder="وصف الصورة المتحركة" value={alt}
          onChange={e => setAlt(e.target.value)} />
      </div>
      {url && (
        <div style={{ textAlign: 'center' }}>
          <img src={url} alt={alt} style={{ maxWidth: '100%', maxHeight: 150, borderRadius: 8 }}
            onError={e => (e.currentTarget.style.display = 'none')} />
        </div>
      )}
    </ModalBase>
  );
}
