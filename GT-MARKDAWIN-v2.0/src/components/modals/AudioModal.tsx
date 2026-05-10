import { useState } from 'react';
import { Music } from 'lucide-react';
import { useApp } from '../../context';
import ModalBase from './ModalBase';

export default function AudioModal() {
  const { activeModal, insertAtCursor } = useApp();
  const [url, setUrl] = useState('');
  const [desc, setDesc] = useState('');
  const [controls, setControls] = useState(true);

  if (activeModal !== 'audio') return null;

  const handleInsert = () => {
    const ctrl = controls ? ' controls' : '';
    insertAtCursor(`\n<audio src="${url}"${ctrl}>${desc}</audio>\n`);
  };

  return (
    <ModalBase title="إدراج صوت" icon={<Music size={16} />} onInsert={handleInsert}>
      <div className="form-group">
        <label className="form-label">رابط الصوت *</label>
        <input className="form-input" placeholder="https://example.com/audio.mp3" value={url}
          onChange={e => setUrl(e.target.value)} autoFocus />
      </div>
      <div className="form-group">
        <label className="form-label">وصف النص البديل</label>
        <input className="form-input" placeholder="تشغيل الملف الصوتي" value={desc}
          onChange={e => setDesc(e.target.value)} />
      </div>
      <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
        <input type="checkbox" id="audio-ctrl" checked={controls}
          onChange={e => setControls(e.target.checked)} />
        <label htmlFor="audio-ctrl" className="form-label" style={{ margin: 0 }}>
          إظهار أدوات التشغيل
        </label>
      </div>
    </ModalBase>
  );
}
