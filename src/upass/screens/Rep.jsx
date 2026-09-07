import { useMemo, useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { Card, Btn, Section, KV, Tag } from '../components/UI.jsx';
import Icon from '../components/Icons.jsx';
import { verifyChain, dayRoot, shortHash, linkChain } from '../lib/chain.js';
import { byId } from '../data/people.js';
import { plural, nf } from '../lib/format.js';

const TYPES = {
  join: { name: 'Посвящение', icon: 'seal', tone: '#D7B06A' },
  tier: { name: 'Уровень', icon: 'star', tone: '#D7B06A' },
  meet: { name: 'Встреча', icon: 'cup', tone: '#5FE0C8' },
  connect: { name: 'Знакомство', icon: 'users', tone: '#5B8CFF' },
  vouch: { name: 'Поручительство', icon: 'shield', tone: '#8E7BF5' },
  event: { name: 'Событие', icon: 'calendar', tone: '#F2789B' },
  deal: { name: 'Сделка', icon: 'gift', tone: '#E9855C' },
  booking: { name: 'Бронь', icon: 'bed', tone: '#9BA6BE' },
  vote: { name: 'Голос', icon: 'gavel', tone: '#8E7BF5' },
  capital: { name: 'Взнос капитала', icon: 'coin', tone: '#D7B06A' },
  trip: { name: 'Поездка', icon: 'plane', tone: '#5FE0C8' },
};

export default function Rep() {
  const app = useApp();
  const [tampered, setTampered] = useState(false);
  const [checked, setChecked] = useState(null);

  const chain = useMemo(() => {
    if (!tampered || app.chain.length < 2) return app.chain;
    const copy = app.chain.map((r) => ({ ...r }));
    const i = Math.max(0, Math.floor(copy.length / 2));
    copy[i] = { ...copy[i], note: copy[i].note + ' (изменено задним числом)', weight: 99 };
    return copy;
  }, [app.chain, tampered]);

  const broken = useMemo(() => verifyChain(chain), [chain]);
  const root = useMemo(() => dayRoot(chain), [chain]);
  const weight = chain.reduce((s, r) => s + (r.weight || 0), 0);

  const check = () => setChecked(verifyChain(chain));

  return (
    <div className="screen stack-22">
      <div>
        <div className="eyebrow">Репутация</div>
        <h2 className="display" style={{ marginTop: 3 }}>Цепочка событий</h2>
        <p className="t-sm dim" style={{ marginTop: 8, lineHeight: 1.55 }}>
          Репутация строится не на оценках, а на подтверждённых событиях. Журнал только на
          добавление: каждая запись содержит хеш предыдущей, поэтому переписать прошлое нельзя —
          расходится весь хвост.
        </p>
      </div>

      <div className="stats">
        <div className="stat"><div className="stat__v">{chain.length}</div><div className="stat__l">Записей</div></div>
        <div className="stat"><div className="stat__v gold">{weight}</div><div className="stat__l">Вес</div></div>
        <div className="stat"><div className="stat__v cyan">{app.counts.meets}</div><div className="stat__l">Встречи</div></div>
      </div>

      <Card variant={broken === -1 ? undefined : 'gold'} style={broken === -1 ? undefined : { borderColor: 'rgba(255,122,110,.4)' }}>
        <div className="row" style={{ gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 12, display: 'grid', placeItems: 'center', flex: 'none', background: broken === -1 ? 'rgba(88,214,141,.14)' : 'rgba(255,122,110,.14)', color: broken === -1 ? 'var(--green)' : 'var(--red)' }}>
            <Icon name={broken === -1 ? 'shield' : 'x'} size={19} />
          </div>
          <div className="grow">
            <div className="t-md">{broken === -1 ? 'Цепочка цела' : `Цепочка нарушена на записи №${broken + 1}`}</div>
            <div className="t-xs dim" style={{ marginTop: 3 }}>
              {broken === -1
                ? 'Каждый хеш совпадает с пересчитанным заново'
                : 'Хеш записи не совпадает с телом — дальше вся цепочка недействительна'}
            </div>
          </div>
        </div>
        <div className="mono dim-2" style={{ marginTop: 12, wordBreak: 'break-all', lineHeight: 1.5 }}>
          Корень дня: {root}
        </div>
        <div className="row" style={{ gap: 9, marginTop: 13 }}>
          <Btn size="sm" variant="ghost" wide onClick={check}>Проверить сейчас</Btn>
          <Btn size="sm" variant={tampered ? 'danger' : 'quiet'} wide onClick={() => { setTampered(!tampered); setChecked(null); }}>
            {tampered ? 'Вернуть как было' : 'Подделать запись'}
          </Btn>
        </div>
        {checked !== null && (
          <div className="t-xs" style={{ marginTop: 10, color: checked === -1 ? 'var(--green)' : 'var(--red)' }}>
            {checked === -1
              ? `Пересчитано ${chain.length} ${plural(chain.length, 'хеш', 'хеша', 'хешей')} — всё сходится.`
              : `Первое расхождение — запись №${checked + 1}. Подделка видна без доверия к серверу.`}
          </div>
        )}
      </Card>

      <Card className="row-t" style={{ gap: 11 }}>
        <Icon name="link" size={17} color="var(--gold)" />
        <div className="t-xs dim" style={{ lineHeight: 1.5 }}>
          Корневой хеш за сутки ежедневно якорится во внешний публичный таймстемп. Это даёт
          проверяемое утверждение «историю нельзя переписать» без собственного смарт-контракта
          и без блокчейн-инфраструктуры на старте.
        </div>
      </Card>

      <Section eyebrow="Журнал" title={`${chain.length} ${plural(chain.length, 'запись', 'записи', 'записей')}`}>
        {chain.length === 0 ? (
          <Card className="center"><div className="t-sm dim">Пока пусто. Первая запись появится при посвящении.</div></Card>
        ) : (
          <div className="stack-8">
            {[...chain].reverse().map((r, idx) => {
              const i = chain.length - 1 - idx;
              const t = TYPES[r.type] || TYPES.connect;
              const bad = broken !== -1 && i >= broken;
              const who = r.with ? byId(r.with) : null;
              return (
                <Card key={i} style={bad ? { borderColor: 'rgba(255,122,110,.35)' } : undefined}>
                  <div className="row" style={{ gap: 11 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 10, flex: 'none', display: 'grid', placeItems: 'center', background: `${t.tone}1c`, color: t.tone }}>
                      <Icon name={t.icon} size={15} />
                    </div>
                    <div className="grow">
                      <div className="row" style={{ gap: 7 }}>
                        <span className="t-sm" style={{ fontWeight: 600 }}>{t.name}</span>
                        <span className="t-xs dim-2">{r.at}</span>
                        {bad && <Tag style={{ background: 'rgba(255,122,110,.16)', color: 'var(--red)' }}>сбой</Tag>}
                      </div>
                      {r.note && <div className="t-xs dim" style={{ marginTop: 3 }}>{r.note}</div>}
                    </div>
                    <div className="t-xs dim-2" style={{ flex: 'none' }}>+{r.weight}</div>
                  </div>
                  <div className="mono dim-2" style={{ marginTop: 9, lineHeight: 1.6 }}>
                    <div>prev {shortHash(r.prev, 10)}</div>
                    <div style={{ color: bad ? 'var(--red)' : 'var(--gold)' }}>hash {shortHash(r.hash, 10)}</div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </Section>

      <Card className="row-t" style={{ gap: 11 }}>
        <Icon name="eye" size={17} color="var(--ink-3)" />
        <div className="t-xs dim" style={{ lineHeight: 1.5 }}>
          Верификация и деанонимизация — разные вещи. Клубу нужно доказательство, что человек
          реален и уникален, а не раскрытие его данных всем участникам. Записи в цепочке хранят
          события, а не персональные данные.
        </div>
      </Card>
    </div>
  );
}
