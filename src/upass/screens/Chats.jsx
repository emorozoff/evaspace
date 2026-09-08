import { useMemo } from 'react';
import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { Top, List, Item, Section, Note } from '../components/UI.jsx';
import { Avatar } from '../components/Art.jsx';
import Icon from '../components/Icons.jsx';
import { CIRCLES, THREADS, DMS } from '../data/life.js';
import { byId } from '../data/people.js';
import { circlesFor } from '../lib/select.js';
import { agoHours } from '../lib/format.js';

export default function Chats() {
  const app = useApp();
  const circles = useMemo(() => circlesFor(app.me), [app.me]);

  const dms = useMemo(
    () =>
      DMS.map((d) => {
        const p = byId(d.with);
        const mine = app.dms[d.with] || [];
        const last = mine.length ? { text: mine[mine.length - 1].text, ago: 0, who: 'me' } : d.thread[d.thread.length - 1];
        const unread = app.seen['dm-' + d.with] ? 0 : d.unread;
        return { ...d, p, last, unread };
      }).sort((a, b) => b.unread - a.unread || a.last.ago - b.last.ago),
    [app.dms, app.seen]
  );

  return (
    <div className="screen stack-20">
      <Top title="Чаты" right={<button className="iconbtn" onClick={() => go('/people')} aria-label="Новый чат"><Icon name="plus" size={18} /></button>} />

      <Section title="Личные">
        <List>
          {dms.map((d) => (
            <Item
              key={d.with}
              lead={<Avatar person={d.p} size={48} dot={d.p?.online} />}
              title={d.p?.name}
              sub={(d.last.who === 'me' ? 'Вы: ' : '') + d.last.text}
              meta={
                <>
                  <span>{d.last.ago ? agoHours(d.last.ago) : 'только что'}</span>
                  {d.unread > 0 && <span className="unread">{d.unread}</span>}
                </>
              }
              chev={false}
              onClick={() => go(`/dm/${d.with}`)}
            />
          ))}
        </List>
      </Section>

      <Section title="Круги по интересам">
        <List>
          {circles.map((c) => {
            const thread = THREADS[c.id] || [];
            const mine = app.messages[c.id] || [];
            const last = mine.length ? { text: 'Вы: ' + mine[mine.length - 1].text, ago: 0 } : thread[thread.length - 1];
            const author = last && last.who ? byId(last.who) : null;
            return (
              <Item
                key={c.id}
                lead={<CircleIcon c={c} />}
                title={
                  <span className="row" style={{ gap: 6 }}>
                    <span className="ell">{c.name}</span>
                    {c.locked && <Icon name="lock" size={12} color="var(--ink-3)" />}
                  </span>
                }
                sub={c.locked ? `Закрытый круг · нужен уровень ${c.minTier}` : last ? `${author ? author.name.split(' ')[0] + ': ' : ''}${last.text}` : c.about}
                meta={<span>{c.locked ? '' : last ? (last.ago ? agoHours(last.ago) : 'только что') : ''}</span>}
                chev={false}
                onClick={() => go(`/chat/${c.id}`)}
              />
            );
          })}
        </List>
      </Section>

      <Note icon="users">Круги ведут кураторы. С третьей степени можно создать свой.</Note>
    </div>
  );
}

export function CircleIcon({ c, size = 48 }) {
  return (
    <div style={{ width: size, height: size, flex: 'none', borderRadius: '50%', display: 'grid', placeItems: 'center', background: `${c.art[0]}26`, color: c.art[0], opacity: c.locked ? 0.55 : 1 }}>
      <Icon name={c.icon} size={size * 0.44} />
    </div>
  );
}
