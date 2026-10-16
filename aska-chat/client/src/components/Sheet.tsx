// Нижнее меню в стиле iOS.
import type { ReactNode } from 'react';

export interface SheetAction { label: string; run: () => void; danger?: boolean }

export function Sheet({ title, actions, onClose, children }: { title?: ReactNode; actions?: SheetAction[]; onClose: () => void; children?: ReactNode }) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet-wrap" onClick={(e) => e.stopPropagation()}>
        <div className="sheet">
          {title && <div className="sheet-title">{title}</div>}
          {children}
          {actions?.map((a) => (
            <button key={a.label} className={`sheet-btn${a.danger ? ' danger' : ''}`} onClick={() => { onClose(); a.run(); }}>
              {a.label}
            </button>
          ))}
        </div>
        <button className="sheet-btn sheet-cancel" onClick={onClose}>Отмена</button>
      </div>
    </div>
  );
}
