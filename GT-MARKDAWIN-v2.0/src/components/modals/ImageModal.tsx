import { useState } from 'react';
import { Image } from 'lucide-react';
import { useApp } from '../../context';
import ModalBase from './ModalBase';

export default function ImageModal() {
  const { activeModal, insertAtCursor } = useApp();
  const [alt, setAlt] = useState('');
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');

  if (activeModal !== 'image') return null;

  const handleInsert = () => {
    const titlePart = title ? ` "${title}"` : '';
    insertAtCursor(`![${alt}](${url}${titlePart})`);
  };

  return (
    <ModalBase title="إدراج صورة" icon={<Image size={16} />} onInsert={handleInsert}>
      <div className="form-group">
        <label className="form-label">النص البديل</label>
        <input className="form-input" placeholder="وصف الصورة" value={alt}
          onChange={e => setAlt(e.target.value)} autoFocus />
      </div>
      <div className="form-group">
        <label className="form-label">رابط الصورة *</label>
        <input className="form-input" placeholder="https://example.com/image.png" value={url}
          onChange={e => setUrl(e.target.value)} />
      </div>
      <div className="form-group">
        <label className="form-label">العنوان (اختياري)</label>
        <input className="form-input" placeholder="عنوان الصورة" value={title}
          onChange={e => setTitle(e.target.value)} />
      </div>
    </ModalBase>
  );
}
