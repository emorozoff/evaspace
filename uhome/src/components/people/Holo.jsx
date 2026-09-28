import { Avatar, Guilloche } from '../Art.jsx';

/* Голо-портрет резидента: аватар в золотом свечении посреди гильоша
   (как на паспорте UPASS), орбита со «связями», угловые метки прицела
   и моноширинные подписи по углам. Используется в карточке знакомства
   и в шапке профиля. Размер аватара задаёт родитель. */

export default function Holo({ p, plate = '#1b1f2b', size = 112, nodes = 3, corners = {}, className = '', style }) {
  const orbit = Math.round(size * 1.52);
  const orbit2 = Math.round(size * 1.98);
  return (
    <div className={`pholo ${className}`} style={{ '--plate': plate, '--ava': `${size}px`, ...style }}>
      <div className="pholo__grid" />
      <div className="pholo__g" aria-hidden="true">
        <Guilloche seed={p.id} opacity={0.42} size={Math.round(size * 2.6)} />
      </div>
      <div className="pholo__orbit" style={{ width: orbit2, height: orbit2 }} aria-hidden="true" />
      <div className="pholo__orbit pholo__orbit--spin" style={{ width: orbit, height: orbit }} aria-hidden="true">
        {Array.from({ length: nodes }, (_, i) => (
          <i key={i} style={{ transform: `rotate(${i * (360 / Math.max(1, nodes)) + 28}deg) translateY(${-orbit / 2}px)` }} />
        ))}
      </div>
      <div className="pholo__ava">
        <Avatar person={p} size={size} radius={0.5} />
        {p.online && <i className="pholo__live" />}
      </div>
      <i className="pholo__c pholo__c--tl" /><i className="pholo__c pholo__c--tr" />
      <i className="pholo__c pholo__c--bl" /><i className="pholo__c pholo__c--br" />
      <i className="pholo__scan" aria-hidden="true" />
      {corners.tl && <div className="pholo__m pholo__m--tl">{corners.tl}</div>}
      {corners.tr && <div className="pholo__m pholo__m--tr">{corners.tr}</div>}
      {corners.bl && <div className="pholo__m pholo__m--bl">{corners.bl}</div>}
      {corners.br && <div className="pholo__m pholo__m--br">{corners.br}</div>}
    </div>
  );
}
