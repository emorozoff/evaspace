import { useState } from 'react';
import { REGIONS, REGION_KEYS } from '../data/regions.js';
import { regionStats } from '../data/communities.js';
import { count } from '../lib/format.js';
import { localParts, hhmm } from '../lib/time.js';
import { Sheet, Item } from './UI.jsx';
import Icon from './Icons.jsx';
import Flag from './Flag.jsx';

/* Регион — главная привязка резидента: где он сейчас. Меняется одним
   нажатием, за ним подстраиваются карта резидента, афиша, услуги и «рядом». */

export function RegionButton({ app }) {
  const [open, setOpen] = useState(false);
  const r = REGIONS[app.me.region];
  return (
    <>
      <button className="regionbtn" onClick={() => setOpen(true)} aria-label={`Сейчас: ${r.name}. Сменить регион`}>
        <span className="regionbtn__flag"><Flag cc={r.cc} size={24} /></span>
        <span style={{ minWidth: 0 }}>
          <span className="regionbtn__k">Я сейчас</span>
          <span className="regionbtn__v"><span className="ell">{r.name}</span><Icon name="down" size={13} color="var(--ink-3)" /></span>
        </span>
      </button>
      <RegionSheet app={app} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export default function RegionSheet({ app, open, onClose }) {
  const now = new Date();
  return (
    <Sheet open={open} onClose={onClose} title="Где вы сейчас" sub="От региона зависят афиша, услуги и кого показывать рядом. Переключайте, когда летите.">
      <div className="list list--plain">
        {REGION_KEYS.map((key) => {
          const r = REGIONS[key];
          const on = app.me.region === key;
          const n = regionStats(key).residents;
          return (
            <Item
              key={key}
              lead={<span className="picker__lead"><Flag cc={r.cc} size={26} /></span>}
              title={r.name}
              sub={`${r.country} · ${count(n, 'резидент', 'резидента', 'резидентов')}`}
              meta={<><span className="h-num">{hhmm(localParts(r.tz, now))}</span>{on && <span className="tag tag--gold">вы здесь</span>}</>}
              chev={false}
              onClick={() => { if (!on) app.setRegion(key); onClose(); }}
            />
          );
        })}
      </div>
    </Sheet>
  );
}
