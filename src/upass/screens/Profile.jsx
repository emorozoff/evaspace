import { useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { TopBar, List, Item, Btn, Section, Sheet, KV, Chip, Seg, Note } from '../components/UI.jsx';
import { Avatar } from '../components/Art.jsx';
import Icon from '../components/Icons.jsx';
import { SKILL_GROUPS } from '../data/people.js';
import { CITIES } from '../data/places.js';
import { TIERS, DEGREES } from '../data/canon.js';
import { VERSION } from '../version.js';
import { usdExact, nf } from '../lib/format.js';

export default function Profile() {
  const app = useApp();
  const { me } = app;
  const [edit, setEdit] = useState(false);
  const [cityOpen, setCityOpen] = useState(false);
  const [form, setForm] = useState({ title: me.title, company: me.company, mission: me.mission, bio: me.bio, gives: me.gives, needs: me.needs });
  const tier = TIERS.find((t) => t.n === me.tier) || TIERS[0];
  const deg = DEGREES.find((d) => d.n === me.degree) || DEGREES[0];

  return (
    <>
      <TopBar title="Профиль" backTo="/" />
      <div className="screen stack-20">
        <div className="center" style={{ paddingTop: 6 }}>
          <Avatar person={me} size={88} ring={deg.tone} style={{ margin: '0 auto' }} />
          <h2 className="h2" style={{ marginTop: 12 }}>{me.name || 'Резидент'}</h2>
          <div className="t-sm dim" style={{ marginTop: 4 }}>{me.title || me.role}{me.company ? ` · ${me.company}` : ''}</div>
          <div className="t-xs dim-2" style={{ marginTop: 3 }}>{me.number} · {tier.name} · степень {deg.roman}</div>
        </div>

        <div className="row" style={{ gap: 10 }}>
          <Btn variant="ghost" wide icon="settings" onClick={() => setEdit(true)}>Редактировать</Btn>
          <Btn variant="ghost" wide icon="pin" onClick={() => setCityOpen(true)}>{CITIES[me.city].flag} {CITIES[me.city].name}</Btn>
        </div>

        <Section title="Видимость профиля">
          <Seg value={app.visibility} onChange={app.setVisibility} options={[{ value: 'all', label: 'Все' }, { value: 'contacts', label: 'Контакты' }, { value: 'hidden', label: 'Скрыт' }]} />
          <Note icon="eye">Клуб знает только город, который вы указали. Точная геолокация не используется, история перемещений не хранится.</Note>
        </Section>

        <Section title="Разделы">
          <List>
            <Item icon="key" title="Уровень и степень" sub={`${tier.name}${tier.price ? ` · ${usdExact(tier.price)}/год` : ''} · ${deg.name}`} onClick={() => go('/degrees')} />
            <Item icon="wallet" title="Баллы" sub={`${nf(app.points)} на счёте`} onClick={() => go('/wallet')} />
            <Item icon="shield" title="Наследие" sub={app.heirs.length ? `${app.heirs.length} наследник(ов)` : 'Не назначено'} onClick={() => go('/heritage')} />
            <Item icon="hash" title="Репутация" sub={`${app.chain.length} записей в цепочке`} onClick={() => go('/rep')} />
          </List>
        </Section>

        <Section title="Данные">
          <List>
            <Item icon="share" title="Выгрузить все мои данные" onClick={() => app.say('Архив данных отправлен на почту')} />
            <Item icon="x" title="Удалить персональные данные" onClick={() => app.say('Запрос на удаление принят')} />
            <Item icon="globe" title="Язык интерфейса" sub="Русский · английская версия в работе" meta={<span>RU</span>} chev={false} />
          </List>
        </Section>

        <Btn variant="danger" wide icon="logout" onClick={() => confirm('Выйти и очистить данные приложения на этом устройстве?') && app.reset()}>Выйти и сбросить демо</Btn>
        <div className="center t-xs dim-2">UPASS · сборка {VERSION} · прототип, платежи не проводятся</div>
      </div>

      <Sheet open={edit} onClose={() => setEdit(false)} title="Редактировать">
        <div className="stack">
          {[['title', 'Должность'], ['company', 'Компания'], ['gives', 'Чем полезен кругу'], ['needs', 'Что ищу']].map(([k, l]) => (
            <div key={k}><div className="label">{l}</div><input className="field" value={form[k] || ''} onChange={(e) => setForm({ ...form, [k]: e.target.value })} /></div>
          ))}
          <div><div className="label">Миссия одним предложением</div><textarea className="field" value={form.mission || ''} onChange={(e) => setForm({ ...form, mission: e.target.value })} /></div>
          <div><div className="label">О себе</div><textarea className="field" value={form.bio || ''} onChange={(e) => setForm({ ...form, bio: e.target.value })} /></div>
          <div>
            <div className="label">Направления</div>
            <div className="wrap">
              {SKILL_GROUPS.map((g) => (
                <Chip key={g.id} on={me.skills?.includes(g.id)} onClick={() => app.setMe({ skills: me.skills?.includes(g.id) ? me.skills.filter((x) => x !== g.id) : [...(me.skills || []), g.id] })}>{g.name}</Chip>
              ))}
            </div>
          </div>
          <Btn variant="gold" wide onClick={() => { app.setMe(form); setEdit(false); app.say('Профиль обновлён'); }}>Сохранить</Btn>
        </div>
      </Sheet>

      <Sheet open={cityOpen} onClose={() => setCityOpen(false)} title="Город присутствия" sub="По нему клуб понимает, кто рядом">
        <div className="wrap">
          {Object.entries(CITIES).map(([key, c]) => <Chip key={key} on={me.city === key} onClick={() => { app.setMe({ city: key }); setCityOpen(false); }}>{c.flag} {c.name}</Chip>)}
        </div>
      </Sheet>
    </>
  );
}
