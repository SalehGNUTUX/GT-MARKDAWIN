import { useState, useMemo } from 'react';
import { Table2 } from 'lucide-react';
import { useApp } from '../../context';
import ModalBase from './ModalBase';

type Align = 'right' | 'left' | 'center';

function buildTable(rows: number, cols: number, hasHeader: boolean, align: Align): string {
  const r = Math.max(1, rows);
  const c = Math.max(1, cols);
  const sepMap: Record<Align, string> = { right: '---:', left: ':---', center: ':---:' };
  const sep = sepMap[align];

  const pipe = (cells: string[]) => '| ' + cells.join(' | ') + ' |';

  const header  = pipe(Array.from({ length: c }, (_, i) => `العمود ${i + 1}`));
  const divider = pipe(Array.from({ length: c }, () => sep));
  const dataRow = pipe(Array.from({ length: c }, () => 'خلية'));

  const dataCount = hasHeader ? Math.max(0, r - 1) : r;
  const rows_arr  = Array.from({ length: dataCount }, () => dataRow);

  return [hasHeader ? header : dataRow, divider, ...rows_arr].join('\n');
}

export default function TableModal() {
  const { activeModal, insertAtCursor } = useApp();
  const [rows, setRows]         = useState(3);
  const [cols, setCols]         = useState(3);
  const [hasHeader, setHasHeader] = useState(true);
  const [align, setAlign]       = useState<Align>('right');

  if (activeModal !== 'table') return null;

  const preview = buildTable(rows, cols, hasHeader, align);

  const handleInsert = () => {
    insertAtCursor('\n' + preview + '\n');
  };

  return (
    <ModalBase title="إدراج جدول" icon={<Table2 size={16} />} onInsert={handleInsert}>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">الصفوف</label>
          <input
            className="form-input"
            type="number"
            min={1}
            max={30}
            value={rows}
            onChange={e => setRows(Math.max(1, Math.min(30, Number(e.target.value) || 1)))}
          />
        </div>
        <div className="form-group">
          <label className="form-label">الأعمدة</label>
          <input
            className="form-input"
            type="number"
            min={1}
            max={10}
            value={cols}
            onChange={e => setCols(Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
          />
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">محاذاة الأعمدة</label>
        <select
          className="form-select"
          value={align}
          onChange={e => setAlign(e.target.value as Align)}
        >
          <option value="right">يمين (---:)</option>
          <option value="center">وسط (:---:)</option>
          <option value="left">يسار (:---)</option>
        </select>
      </div>

      <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
        <input
          type="checkbox"
          id="tbl-hdr"
          checked={hasHeader}
          onChange={e => setHasHeader(e.target.checked)}
          style={{ width: 16, height: 16, accentColor: 'var(--accent)' }}
        />
        <label htmlFor="tbl-hdr" className="form-label" style={{ margin: 0, cursor: 'pointer' }}>
          صف ترويسة
        </label>
      </div>

      {/* Preview */}
      <div style={{
        background: 'var(--surface2)',
        border: '1px solid var(--border)',
        borderRadius: 6,
        padding: '0.5rem 0.75rem',
        fontSize: '0.75rem',
        fontFamily: 'monospace',
        direction: 'ltr',
        whiteSpace: 'pre',
        overflowX: 'auto',
        color: 'var(--text-muted)',
        lineHeight: 1.6,
        maxHeight: 160,
      }}>
        {preview}
      </div>
    </ModalBase>
  );
}
