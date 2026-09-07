import { useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { Card, Btn, Section, Sheet, KV, Chip, Seg, Tag } from '../components/UI.jsx';
import { Avatar } from '../components/Art.jsx';
import Passport from '../components/Passport.jsx';
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
  const [form, setForm] = useState({ mission: me.mission, gives: me.gives, needs: me.needs, company: me.company });
  const tier = TIERS.find((t) => t.n === me.tier) || TIERS[0];
  const deg = DEGREES.find((d) => d.n === me.degree) || DEGREES[0];

  const save = () => {
    app.setMe(form);
    setEdit(false);
    app.say('Профиль обновлён');
  };

  return (
    <div className="screen stack-22">
      <div className="spread">
        <div>
          <div className="eyebrow">Ваш профиль</div>
          <h2 className="display" style={{ marginTop: 3 }}>{me.name || 'Резидент'}</h2>
        </div>
        <Avatar person={me} size={48} ring={deg.tone} />
      </div>

      <Passport me={me} chain={app.chain} compact />

      <Card>
        <KV k="Номер резидента" v={me.number} />
        <KV k="Уровень членства" v={`${tier.name}${tier.price ? ` · ${usdExact(tier.price)}/год` : ''}`} tone="var(--gold)" />
        <KV k="Степень" v={`${deg.roman} · ${deg.secret ? '·····' : deg.name}`} tone={deg.tone} />
        <KV k="Город присутствия" v={`${CITIES[me.city].flag} ${CITIES[me.city].name}`} />
        <KV k="В клубе с" v={String(me.since)} />
        <KV k="Доля" v={`${nf(me.uht, 1)} UHT`} />
      </Card>

      <div className="row" style={{ gap: 10 }}>
        <Btn variant="ghost" wide icon="settings" onClick={() => setEdit(true)}>Редактировать</Btn>
        <Btn variant="quiet" wide icon="star" onClick={() => go('/degrees')}>Уровень</Btn>
      </div>

      <Section eyebrow="Видимость профиля" title="Кто вас видит">
        <Seg
          value={app.visibility}
          onChange={app.setVisibility}
          options={[
            { value: 'all', label: 'Все резиденты' },
            { value: 'contacts', label: 'Контакты' },
            { value: 'hidden', label: 'Скрыт' },
          ]}
        />
        <Card className="row-t" style={{ gap: 11, marginTop: 4 }}>
          <Icon name="eye" size={17} color="var(--ink-3)" />
          <div className="t-xs dim" style={{ lineHeight: 1.5 }}>
            Клуб знает только город, который вы указали сами. Геолокация точнее города не
            используется, история перемещений не хранится.
          </div>
        </Card>
      </Section>

      <Section eyebrow="Данные" title="Ваши права">
        <div className="stack-8">
          <button className="card tap row" onClick={() => app.say('Архив данных отправлен на почту')}>
            <Icon name="share" size={17} color="var(--ink-3)" />
            <div className="grow t-sm">Выгрузить все мои данные</div>
            <Icon name="right" size={15} color="var(--ink-4)" />
          </button>
          <button className="card tap row" onClick={() => app.say('Запрос на удаление принят к рассмотрению')}>
            <Icon name="x" size={17} color="var(--ink-3)" />
            <div className="grow t-sm">Удалить персональные данные</div>
            <Icon name="right" size={15} color="var(--ink-4)" />
          </button>
        </div>
        <div className="t-xs dim-2" style={{ marginTop: 6, lineHeight: 1.5 }}>
          Выгрузка и удаление по требованию — обязательная функция, а не опция. Данные хранятся
          в европейском регионе по наиболее строгому применимому стандарту.
        </div>
      </Section>

      <Section eyebrow="Ещё" title="Разделы">
        <div className="stack-8">
          <Link to="/heritage" icon="shield" title="Наследие" sub="Кому перейдёт доля и доступ" />
          <Link to="/rep" icon="hash" title="Репутация" sub="Цепочка подтверждённых событий" />
          <Link to="/codex" icon="scroll" title="Кодекс" sub="Законы, традиции, ритуалы" />
          <Link to="/wallet" icon="wallet" title="Баллы и приглашения" sub="Кэшбэк и реферальная программа" />
        </div>
      </Section>

      <Card>
        <div className="spread">
          <div>
            <div className="t-sm">Язык интерфейса</div>
            <div className="t-xs dim-2" style={{ marginTop: 2 }}>Английская версия — следующий этап</div>
          </div>
          <div className="row" style={{ gap: 6 }}>
            <Chip on>RU</Chip>
            <Chip onClick={() => app.say('Английская локализация в работе')}>EN</Chip>
          </div>
        </div>
      </Card>

      <Btn variant="danger" wide icon="logout" onClick={() => {
        if (confirm('Выйти и очистить данные приложения на этом устройстве?')) app.reset();
      }}>
        Выйти и сбросить демо
      </Btn>

      <div className="center t-xs dim-2" style={{ paddingBottom: 10 }}>
        UPASS · сборка {VERSION}<br />
        Прототип. Содержимое демонстрационное, платежи не проводятся.
      </div>

      <Sheet open={edit} onClose={() => setEdit(false)} eyebrow="Профиль" title="Редактировать">
        <div className="stack-16">
          <div>
            <div className="label">Компания или практика</div>
            <input className="field" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
          </div>
          <div>
            <div className="label">Миссия одним предложением</div>
            <textarea className="field" value={form.mission} onChange={(e) => setForm({ ...form, mission: e.target.value })} />
          </div>
          <div>
            <div className="label">Чем полезен кругу</div>
            <input className="field" value={form.gives} onChange={(e) => setForm({ ...form, gives: e.target.value })} />
          </div>
          <div>
            <div className="label">Что ищу</div>
            <input className="field" value={form.needs} onChange={(e) => setForm({ ...form, needs: e.target.value })} />
          </div>
          <div>
            <div className="label">Направления</div>
            <div className="wrap">
              {SKILL_GROUPS.map((g) => (
                <Chip
                  key={g.id}
                  on={me.skills?.includes(g.id)}
                  onClick={() =>
                    app.setMe({
                      skills: me.skills?.includes(g.id)
                        ? me.skills.filter((x) => x !== g.id)
                        : [...(me.skills || []), g.id],
                    })
                  }
                >
                  {g.name}
                </Chip>
              ))}
            </div>
          </div>
          <Btn variant="gold" wide onClick={save}>Сохранить</Btn>
        </div>
      </Sheet>
    </div>
  );
}

function Link({ to, icon, title, sub }) {
  return (
    <button className="card tap row" style={{ gap: 12 }} onClick={() => go(to)}>
      <Icon name={icon} size={17} color="var(--gold)" />
      <div className="grow">
        <div className="t-sm" style={{ fontWeight: 600 }}>{title}</div>
        <div className="t-xs dim-2" style={{ marginTop: 2 }}>{sub}</div>
      </div>
      <Icon name="right" size={15} color="var(--ink-4)" />
    </button>
  );
}
