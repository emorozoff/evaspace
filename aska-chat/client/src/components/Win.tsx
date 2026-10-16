// Окно в стиле «Аськи»: заголовок с цветочком и кнопками, дальше — содержимое.
// Классы те же, что в самой «Аське», поэтому её стили (Зумер и Миллениал) применяются как есть.
import type { ReactNode } from 'react';
import { flower } from '../lib/aska.ts';

// SVG-строка из графики «Аськи» (наша, статичная — не пользовательский текст).
export function Svg({ html, className }: { html: string; className?: string }) {
  if (!html) return null;
  return <span className={className} style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: html }} />;
}

export function Ico({ html, className = 'ico' }: { html: string; className?: string }) {
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

interface WinProps {
  id?: string;
  className: string;
  title: ReactNode;
  icon?: string;
  onBack?: () => void;
  onClose?: () => void;
  closeClass?: string;
  extra?: ReactNode;
  children: ReactNode;
}

export function Win({ id, className, title, icon, onBack, onClose, closeClass, extra, children }: WinProps) {
  return (
    <div className={`win ${className}`} id={id}>
      <div className="titlebar">
        {onBack && <button className="tbtn back" onClick={onBack} title="Назад" aria-label="Назад">‹</button>}
        <Svg html={icon ?? flower('online', 14)} />
        <span className="ttl">{title}</span>
        {extra}
        {onClose && <button className={`tbtn ${closeClass || ''}`} onClick={onClose} title="Закрыть" aria-label="Закрыть">×</button>}
      </div>
      {children}
    </div>
  );
}

// Диалог: на компьютере — окошко по центру, на телефоне — лист снизу.
export function Dialog({ title, onClose, children, buttons }: { title: ReactNode; onClose: () => void; children?: ReactNode; buttons?: ReactNode }) {
  return (
    <div className="overlay sheet" onClick={onClose}>
      <div className="win dialog" onClick={(e) => e.stopPropagation()}>
        <div className="titlebar">
          <Svg html={flower('online', 14)} />
          <span className="ttl">{title}</span>
          <button className="tbtn" data-close onClick={onClose} aria-label="Закрыть">×</button>
        </div>
        <div className="body">
          {children}
          {buttons && <div className="btns">{buttons}</div>}
        </div>
      </div>
    </div>
  );
}
