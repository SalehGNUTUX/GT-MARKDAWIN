import { useState } from 'react';
import { Video } from 'lucide-react';
import { useApp } from '../../context';
import ModalBase from './ModalBase';

export default function VideoModal() {
  const { activeModal, insertAtCursor } = useApp();
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [width, setWidth] = useState('560');
  const [height, setHeight] = useState('315');

  if (activeModal !== 'video') return null;

  const handleInsert = () => {
    insertAtCursor(
      `\n<iframe width="${width}" height="${height}" src="${url}" title="${title}" ` +
      `frameborder="0" allowfullscreen></iframe>\n`,
    );
  };

  return (
    <ModalBase title="إدراج فيديو" icon={<Video size={16} />} onInsert={handleInsert}>
      <div className="form-group">
        <label className="form-label">رابط الفيديو (YouTube embed) *</label>
        <input className="form-input" placeholder="https://www.youtube.com/embed/..." value={url}
          onChange={e => setUrl(e.target.value)} autoFocus />
      </div>
      <div className="form-group">
        <label className="form-label">العنوان</label>
        <input className="form-input" placeholder="عنوان الفيديو" value={title}
          onChange={e => setTitle(e.target.value)} />
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">العرض (px)</label>
          <input className="form-input" type="number" value={width}
            onChange={e => setWidth(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">الارتفاع (px)</label>
          <input className="form-input" type="number" value={height}
            onChange={e => setHeight(e.target.value)} />
        </div>
      </div>
    </ModalBase>
  );
}
