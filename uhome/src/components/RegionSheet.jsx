import { useState } from 'react';
import { REGIONS, REGION_KEYS } from '../data/regions.js';
import { regionStats } from '../data/communities.js';
import { plural, count } from '../lib/format.js';
import { localParts, hhmm } from '../lib/time.js';
import { Sheet, List, Item } from './UI.jsx';
import Icon from './Icons.jsx';

/* Главная привязка резидента — регион, где он сейчас. Меняется одним
   нажатием: карта резидента, афиша, услуги и «кто рядом» подстраиваются сразу. */

export function RegionButton({ app }) {
  const [open, setOpen] = useState(false);
  const r = REGIONS[app.me.region];
  return (
    <>
      <button className="regionbtn" onClick={() => setOpen(true)} aria-label="Сменить регион">
        <span className="regionbtn__flag">{r.flag}</span>
        <span style={{ minWidth: 0 }}>
          <span className="regionbtn__k" style={{ display: 'block' }}>Я сейчас</span>
          <span className="regionbtn__v">
            <span className="ell">{r.name}</span>
            <Icon name="down" size={14} color="var(--ink-3)" />
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
      <List>
        {REGION_KEYS.map((key) => {
          const r = REGIONS[key];
          const on = app.me.region === key;
          return (
            <Item
              key={key}
              lead={<span className="picker__lead" style={{ fontSize: 22, width: 44, height: 44, borderRadius: 14 }}>{r.flag}</span>}
              title={r.name}
              sub={`${hhmm(localParts(r.tz, now))} · ${count(regionStats(key).members, 'резидент', 'резидента', 'резидентов')} · ${regionStats(key).communities} ${plural(regionStats(key).communities, 'сообщество', 'сообщества', 'сообществ')}`}
              meta={on ? <span className="tag tag--gold">вы здесь</span> : undefined}
              chev={false}
              onClick={() => { if (!on) app.setRegion(key); onClose(); }}
            />
          );
        })}
      </List>
    </Sheet>
  );
}
