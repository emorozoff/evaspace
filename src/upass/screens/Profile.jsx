import { useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { TopBar, List, Item, Btn, Section, Sheet, KV, Chip, Seg, Note } from '../components/UI.jsx';
import { Avatar } from '../components/Art.jsx';
import Icon from '../components/Icons.jsx';
import { SKILL_GROUPS } from '../data/people.js';
import { OFFERS } from '../data/exchange.js';
import { REGIONS, REGION_KEYS } from '../data/regions.js';
import { DEGREES } from '../data/canon.js';
import { VERSION } from '../version.js';
import { usdExact, nf } from '../lib/format.js';

export default function Profile() {
  const app = useApp();
  const { me } = app;
  const [edit, setEdit] = useState(false);
  const [cityOpen, setCityOpen] = useState(false);
  const [form, setForm] = useState({ title: me.title, company: me.company, mission: me.mission, bio: me.bio, gives: me.gives, needs: me.needs });
  
  const deg = DEGREES.find((d) => d.n === me.degree) || DEGREES[0];

  return (
    <>
      <TopBar title="Профиль" backTo="/" />
      <div className="screen stack-20">
        <div className="center" style={{ paddingTop: 6 }}>
          <Avatar person={me} size={88} ring={deg.tone} style={{ margin: '0 auto' }} />
          <h2 className="h2" style={{ marginTop: 12 }}>{me.name || 'Резидент'}</h2>
          <div className="t-sm dim" style={{ marginTop: 4 }}>{me.title || me.role}{me.company ? ` · ${me.company}` : ''}</div>
          <div className="t-xs dim-2" style={{ marginTop: 3 }}>{me.number} · Travel · степень {deg.roman}</div>
        </div>

        <div className="row" style={{ gap: 10 }}>
          <Btn variant="ghost" wide icon="settings" onClick={() => setEdit(true)}>Редактировать</Btn>
          <Btn variant="ghost" wide icon="pin" onClick={() => setCityOpen(true)}>{REGIONS[me.city].flag} {REGIONS[me.city].name}</Btn>
        </div>

        <List>
          <Item
            icon="message"
            title="Написать в поддержку UPASS"
            sub="Отвечаем в рабочие часы, обычно в тот же день"
            tone="var(--gold)"
            onClick={() => app.say('Обращение отправлено — ответим в чате')}
          />
        </List>

        <Section title="Видимость профиля">
          <Seg value={app.visibility} onChange={app.setVisibility} options={[{ value: 'all', label: 'Все' }, { value: 'contacts', label: 'Контакты' }, { value: 'hidden', label: 'Скрыт' }]} />
          <Note icon="eye">Клуб знает только город, который вы указали. Точная геолокация не используется, история перемещений не хранится.</Note>
        </Section>

        <Section title="Клуб и правила">
          <List>
            <Item icon="scroll" title="Кодекс" sub="Законы, традиции, ритуалы" onClick={() => go('/codex')} />
            <Item icon="book" title="База знаний" sub="Разборы, шаблоны, записи эфиров" onClick={() => go('/vault')} />
            <Item icon="key" title="Уровень и степень" sub={`Travel · ${usdExact(200)}/год · степень ${deg.roman}`} onClick={() => go('/degrees')} />
            <Item icon="hash" title="Репутация" sub={`${app.chain.length} записей в цепочке`} onClick={() => go('/rep')} />
          </List>
        </Section>

        <Section title="Моё">
          <List>
            <Item icon="plane" title="Мои поездки" sub={app.trips.length ? `${app.trips.length} объявлено` : 'Ничего не объявлено'} onClick={() => go('/trips')} />
            <Item icon="message" title="Мои запросы" sub={app.requests.length ? `${app.requests.length} в ленте` : 'Ничего не опубликовано'} onClick={() => go('/requests')} />
            <Item icon="users" title="Хочу встретиться" sub={app.meet.length ? `${app.meet.length} отмечено` : 'Никого не отмечено'} onClick={() => go('/map')} />
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
            <div className="label">Что ищу</div>
            <div className="wrap">
              {OFFERS.map((o) => (
                <Chip key={o.id} on={me.wants?.includes(o.id)} onClick={() => app.setMe({ wants: me.wants?.includes(o.id) ? me.wants.filter((x) => x !== o.id) : [...(me.wants || []), o.id] })}>{o.emoji} {o.short}</Chip>
              ))}
            </div>
          </div>
          <div>
            <div className="label">Чем могу быть полезен</div>
            <div className="wrap">
              {OFFERS.map((o) => (
                <Chip key={o.id} on={me.offers?.includes(o.id)} onClick={() => app.setMe({ offers: me.offers?.includes(o.id) ? me.offers.filter((x) => x !== o.id) : [...(me.offers || []), o.id] })}>{o.emoji} {o.short}</Chip>
              ))}
            </div>
          </div>
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

      <Sheet open={cityOpen} onClose={() => setCityOpen(false)} title="Регион присутствия" sub="Определяет сообщества, афишу и запросы на главной">
        <div className="wrap">
          {REGION_KEYS.map((key) => <Chip key={key} on={me.city === key} onClick={() => { app.setRegion(key); setCityOpen(false); }}>{REGIONS[key].flag} {REGIONS[key].name}</Chip>)}
        </div>
      </Sheet>
    </>
  );
}
