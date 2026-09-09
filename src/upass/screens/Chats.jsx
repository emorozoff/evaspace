import { useMemo, useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { Top, List, Item, Seg, Note, Search } from '../components/UI.jsx';
import { Avatar } from '../components/Art.jsx';
import Icon from '../components/Icons.jsx';
import { DMS } from '../data/life.js';
import { CIRCLES, peopleInCircle } from '../data/circles.js';
import { byId } from '../data/people.js';
import { communitiesFor } from '../lib/select.js';
import { CommunityRow } from './Communities.jsx';
import { agoHours } from '../lib/format.js';

/* Мессенджер. Люди разложены по трём кругам — ближний, друзья, бизнес,
   четвёртая вкладка — сообщества. Строка как в телеграме: аватар,
   имя, последняя реплика, время и счётчик непрочитанных. */

const TABS = [...CIRCLES.map((c) => ({ value: c.id, label: c.short })), { value: 'groups', label: 'Группы' }];

export default function Chats() {
  const app = useApp();
  const [tab, setTab] = useState('inner');
  const [q, setQ] = useState('');

  const groups = useMemo(
    () => communitiesFor(app.me).filter((c) => app.communities.includes(c.id)),
    [app.me, app.communities]
  );

  const rows = useMemo(() => {
    if (tab === 'groups') return [];
    const list = peopleInCircle(tab, app.circles)
      .map((id) => {
        const p = byId(id);
        if (!p) return null;
        const dm = DMS.find((d) => d.with === id);
        const own = app.dms[id] || [];
        const last = own.length
          ? { text: own[own.length - 1].text, ago: 0, who: 'me' }
          : dm?.thread[dm.thread.length - 1];
        return { p, last, unread: dm && !app.seen['dm-' + id] ? dm.unread : 0 };
      })
      .filter(Boolean);

    const s = q.trim().toLowerCase();
    const found = s ? list.filter((x) => `${x.p.name} ${x.p.company}`.toLowerCase().includes(s)) : list;
    return found.sort((a, b) => b.unread - a.unread || (a.last?.ago ?? 999) - (b.last?.ago ?? 999));
  }, [tab, app.circles, app.dms, app.seen, q]);

  const unreadIn = (id) =>
    peopleInCircle(id, app.circles).reduce(
      (n, pid) => n + (DMS.find((d) => d.with === pid && !app.seen['dm-' + pid])?.unread || 0),
      0
    );

  return (
    <div className="screen stack">
      <Top
        back
        title="Чаты"
        right={
          <button className="iconbtn" onClick={() => go('/people')} aria-label="Новый чат">
            <Icon name="plus" size={18} />
          </button>
        }
      />

      <Seg
        value={tab}
        onChange={setTab}
        options={TABS.map((t) => ({
          value: t.value,
          label: t.value === 'groups' ? t.label : `${t.label}${unreadIn(t.value) ? ` · ${unreadIn(t.value)}` : ''}`,
        }))}
      />

      {tab !== 'groups' && <Search value={q} onChange={setQ} placeholder="Найти в круге" />}

      {tab === 'groups' ? (
        groups.length ? (
          <List>{groups.map((c) => <CommunityRow key={c.id} c={c} joined />)}</List>
        ) : (
          <Note icon="users">Вы пока не вступили ни в одно сообщество. Откройте «Сообщества» — там же и чаты регионов.</Note>
        )
      ) : rows.length ? (
        <List>
          {rows.map(({ p, last, unread }) => (
            <Item
              key={p.id}
              lead={<Avatar person={p} size={48} dot={p.online} />}
              title={p.name}
              sub={last ? (last.who === 'me' ? `Вы: ${last.text}` : last.text) : `${p.title} · ${p.company}`}
              meta={
                <>
                  <span>{last ? (last.ago ? agoHours(last.ago) : 'только что') : ''}</span>
                  {unread > 0 && <span className="unread">{unread}</span>}
                </>
              }
              chev={false}
              onClick={() => go(`/dm/${p.id}`)}
            />
          ))}
        </List>
      ) : (
        <Note icon="users">
          {q ? 'Никого не нашлось.' : `В круге «${CIRCLES.find((c) => c.id === tab)?.name}» пока пусто. Откройте профиль резидента и перенесите его сюда.`}
        </Note>
      )}
    </div>
  );
}
