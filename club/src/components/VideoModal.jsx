import { useEffect } from 'react';
import { embedUrl, service } from '../lib/video.js';
import { Btn } from './UI.jsx';
import Icon from './Icons.jsx';

/* Записи смотрим внутри приложения: плеер открывается поверх экрана,
   уходить на внешний сервис не нужно. */

export default function VideoModal({ url, title, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const embed = embedUrl(url);

  return (
    <>
      <div className="backdrop" onClick={onClose} />
      <div className="player" role="dialog" aria-modal="true">
        <div className="player__head">
          <div className="grow ell t-md">{title}</div>
          <button className="iconbtn" onClick={onClose} aria-label="Закрыть"><Icon name="x" size={17} /></button>
        </div>
        {embed ? (
          <div className="player__frame">
            <iframe
              src={embed}
              title={title}
              allow="accelerometer; autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
        ) : (
          <div className="player__frame player__frame--empty">
            <div className="center stack">
              <div className="t-sm dim">Этот источник не открывается встроенным плеером.</div>
              <a className="btn btn--ghost btn--sm" href={url} target="_blank" rel="noreferrer">Открыть на {service(url)}</a>
            </div>
          </div>
        )}
        <div className="player__foot">
          <Btn variant="ghost" size="sm" wide onClick={onClose}>Закрыть</Btn>
        </div>
      </div>
    </>
  );
}
