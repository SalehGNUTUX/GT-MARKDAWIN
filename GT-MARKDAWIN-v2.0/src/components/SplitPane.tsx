import { useRef, useState, useEffect, useCallback } from 'react';
import { useApp } from '../context';
import EditorPanel from './EditorPanel';
import PreviewPanel from './PreviewPanel';

export default function SplitPane() {
  const { view } = useApp();
  const [ratio, setRatio] = useState(0.5);
  const dragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    setIsDragging(true);
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const r = Math.max(0.15, Math.min(0.85, (e.clientX - rect.left) / rect.width));
      setRatio(r);
    };

    const onUp = () => {
      dragging.current = false;
      setIsDragging(false);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, []);

  if (view === 'editor') {
    return (
      <div className="split-pane" ref={containerRef}>
        <EditorPanel style={{ flex: 1 }} />
      </div>
    );
  }

  if (view === 'preview') {
    return (
      <div className="split-pane" ref={containerRef}>
        <PreviewPanel style={{ flex: 1 }} />
      </div>
    );
  }

  return (
    <div
      className="split-pane"
      ref={containerRef}
      style={{ userSelect: isDragging ? 'none' : undefined }}
    >
      <EditorPanel style={{ flex: `0 0 ${ratio * 100}%`, overflow: 'hidden' }} />
      <div
        className={`resizer${isDragging ? ' dragging' : ''}`}
        onMouseDown={onMouseDown}
        title="اسحب لتغيير الحجم"
      />
      <PreviewPanel style={{ flex: 1, overflow: 'hidden' }} />
    </div>
  );
}
