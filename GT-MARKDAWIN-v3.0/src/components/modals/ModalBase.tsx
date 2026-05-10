import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useApp } from '../../context';

interface Props {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  onInsert: () => void;
  insertLabel?: string;
  wide?: boolean;
}

export default function ModalBase({
  title, icon, children, onInsert, insertLabel = 'إدراج', wide = false,
}: Props) {
  const { closeModal } = useApp();
  const modalRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); closeModal(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [closeModal]);

  // Focus first input when opened
  useEffect(() => {
    const timer = setTimeout(() => {
      const first = modalRef.current?.querySelector<HTMLElement>(
        'input:not([type=checkbox]):not([type=radio]), textarea, select',
      );
      first?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) closeModal();
  };

  const handleInsert = () => {
    try { onInsert(); } catch (err) { console.error('Modal insert error:', err); }
    closeModal();
  };

  return (
    <div
      className="modal-overlay"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="modal"
        ref={modalRef}
        style={wide ? { width: 580 } : undefined}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <span className="modal-title">
            {icon && <span style={{ display: 'flex' }}>{icon}</span>}
            {title}
          </span>
          <button className="icon-btn" onClick={closeModal} title="إغلاق (Esc)">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="modal-body">{children}</div>

        {/* Footer */}
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={closeModal}>إلغاء</button>
          <button className="btn btn-primary" onClick={handleInsert}>
            {insertLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
