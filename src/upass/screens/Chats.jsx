import { useMemo } from 'react';
import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { Top, List, Item, Section, Note } from '../components/UI.jsx';
import { Avatar } from '../components/Art.jsx';
import Icon from '../components/Icons.jsx';
import { DMS } from '../data/life.js';
import { byId } from '../data/people.js';
import { communitiesFor } from '../lib/select.js';
import { CommunityRow } from './Communities.jsx';
import { agoHours } from '../lib/format.js';

export default function Chats() {
  const app = useApp();
  const mine = useMemo(() => communitiesFor(app.me).filter((c) => app.communities.includes(c.id)), [app.me, app.communities]);

  const dms = useMemo(
    () =>
      DMS.map((d) => {
        const p = byId(d.with);
        const own = app.dms[d.with] || [];
        const last = own.length ? { text: own[own.length - 1].text, ago: 0, who: 'me' } : d.thread[d.thread.length - 1];
        return { ...d, p, last, unread: app.seen['dm-' + d.with] ? 0 : d.unread };
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
              meta={<><span>{d.last.ago ? agoHours(d.last.ago) : 'только что'}</span>{d.unread > 0 && <span className="unread">{d.unread}</span>}</>}
              chev={false}
              onClick={() => go(`/dm/${d.with}`)}
            />
          ))}
        </List>
      </Section>

      <Section title="Мои сообщества" more="Все" onMore={() => go('/communities')}>
        {mine.length ? (
          <List>{mine.map((c) => <CommunityRow key={c.id} c={c} joined />)}</List>
        ) : (
          <Note icon="users">Вы пока не вступили ни в одно сообщество. Откройте раздел «Сообщества» — там же чаты.</Note>
        )}
      </Section>
    </div>
  );
}
