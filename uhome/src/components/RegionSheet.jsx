import { useState } from 'react';
import { REGIONS, REGION_KEYS } from '../data/regions.js';
import { regionStats } from '../data/communities.js';
import { plural, count } from '../lib/format.js';
import { localParts, hhmm } from '../lib/time.js';
import { Sheet } from './UI.jsx';
import Icon from './Icons.jsx';
import Flag from './Flag.jsx';

/* Главная привязка резидента — регион, где он сейчас. Меняется одним
   нажатием: карта резидента, афиша, услуги и «кто рядом» подстраиваются сразу. */

export function RegionButton({ app }) {
  const [open, setOpen] = useState(false);
  const r = REGIONS[app.me.region];
  return (
    <>
      <button className="hreg" onClick={() => setOpen(true)} aria-label={`Сейчас: ${r.name}. Сменить регион`}>
        <span className="hreg__flag"><Flag cc={r.cc} size={26} /></span>
        <span className="hreg__txt">
          <span className="hreg__k">Я сейчас</span>
          <span className="hreg__v">
            <span className="ell">{r.name}</span>
            <Icon name="down" size={13} color="var(--ink-3)" />
          </span>
        </span>
      </button>
      <RegionSheet app={app} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export default function RegionSheet({ app, open, onClose }) {
  const now = new Date();
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Где вы сейчас"
      sub="От региона зависят карта резидента, афиша, услуги и кого показывать рядом. Переключайте, когда летите."
    >
      <div className="rsh">
        {REGION_KEYS.map((key, n) => {
          const r = REGIONS[key];
          const st = regionStats(key);
          const on = app.me.region === key;
          return (
            <button
              key={key} className="rsh__row" data-on={on} style={{ '--i': n }}
              onClick={() => { if (!on) app.setRegion(key); onClose(); }}
            >
              <span className="rsh__flag"><Flag cc={r.cc} size={30} /></span>
              <span className="rsh__body">
                <span className="rsh__name">{r.name}<span className="rsh__country">{r.country}</span></span>
                <span className="rsh__meta">
                  {count(st.members, 'резидент', 'резидента', 'резидентов')} · {st.communities} {plural(st.communities, 'сообщество', 'сообщества', 'сообществ')}
                </span>
              </span>
              <span className="rsh__side">
                <span className="rsh__time">{hhmm(localParts(r.tz, now))}</span>
                {on ? <span className="rsh__here">вы здесь</span> : <span className="rsh__go">выбрать</span>}
              </span>
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}
