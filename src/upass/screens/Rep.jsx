import { useMemo, useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { Top, List, Item, Btn, Section, Tag, Note } from '../components/UI.jsx';
import Icon from '../components/Icons.jsx';
import { verifyChain, dayRoot, shortHash } from '../lib/chain.js';
import { plural } from '../lib/format.js';

const TYPES = {
  join: { name: 'Посвящение', icon: 'seal', tone: '#D9B26B' }, tier: { name: 'Уровень', icon: 'star', tone: '#D9B26B' },
  meet: { name: 'Встреча', icon: 'cup', tone: '#5FE0C8' }, connect: { name: 'Знакомство', icon: 'users', tone: '#5B8CFF' },
  vouch: { name: 'Поручительство', icon: 'shield', tone: '#8E7BF5' }, event: { name: 'Событие', icon: 'calendar', tone: '#F2789B' },
  deal: { name: 'Сделка', icon: 'gift', tone: '#E9855C' }, booking: { name: 'Бронь', icon: 'bed', tone: '#9BA6BE' },
  vote: { name: 'Голос', icon: 'gavel', tone: '#8E7BF5' }, capital: { name: 'Взнос капитала', icon: 'coin', tone: '#D9B26B' },
  trip: { name: 'Поездка', icon: 'plane', tone: '#5FE0C8' },
};

export default function Rep() {
  const app = useApp();
  const [tampered, setTampered] = useState(false);
  const [checked, setChecked] = useState(null);

  const chain = useMemo(() => {
    if (!tampered || app.chain.length < 2) return app.chain;
    const copy = app.chain.map((r) => ({ ...r }));
    const i = Math.floor(copy.length / 2);
    copy[i] = { ...copy[i], note: copy[i].note + ' (изменено задним числом)', weight: 99 };
    return copy;
  }, [app.chain, tampered]);
  const broken = useMemo(() => verifyChain(chain), [chain]);
  const root = useMemo(() => dayRoot(chain), [chain]);
  const ok = broken === -1;

  return (
    <div className="screen stack-20">
      <Top title="Репутация" sub="Журнал только на добавление, каждая запись хранит хеш предыдущей" right={<button className="iconbtn" onClick={() => go('/club')}><Icon name="back" size={18} /></button>} />

      <div className="card" style={ok ? undefined : { boxShadow: 'inset 0 0 0 1px rgba(255,122,110,.4)' }}>
        <div className="row" style={{ gap: 12 }}>
          <div className="item__ic" style={{ background: ok ? 'rgba(88,214,141,.14)' : 'rgba(255,122,110,.14)', color: ok ? 'var(--green)' : 'var(--red)' }}><Icon name={ok ? 'shield' : 'x'} size={19} /></div>
          <div className="grow">
            <div className="t-md">{ok ? 'Цепочка цела' : `Нарушена на записи №${broken + 1}`}</div>
            <div className="t-xs dim">{ok ? `${chain.length} ${plural(chain.length, 'запись', 'записи', 'записей')} · корень дня ${shortHash(root, 10)}` : 'Хеш не совпадает с телом — хвост недействителен'}</div>
          </div>
        </div>
        <div className="row" style={{ gap: 8, marginTop: 12 }}>
          <Btn size="sm" variant="ghost" wide onClick={() => setChecked(verifyChain(chain))}>Проверить</Btn>
          <Btn size="sm" variant={tampered ? 'danger' : 'quiet'} wide onClick={() => { setTampered(!tampered); setChecked(null); }}>{tampered ? 'Вернуть' : 'Подделать запись'}</Btn>
        </div>
        {checked !== null && (
          <div className="t-xs" style={{ marginTop: 10, color: checked === -1 ? 'var(--green)' : 'var(--red)' }}>
            {checked === -1 ? `Пересчитано ${chain.length} ${plural(chain.length, 'хеш', 'хеша', 'хешей')} — всё сходится.` : `Первое расхождение — запись №${checked + 1}. Подделка видна без доверия к серверу.`}
          </div>
        )}
      </div>

      <Section title="Журнал">
        <List>
          {[...chain].reverse().map((r, idx) => {
            const i = chain.length - 1 - idx;
            const t = TYPES[r.type] || TYPES.connect;
            const bad = broken !== -1 && i >= broken;
            return (
              <Item
                key={i}
                lead={<div className="item__ic" style={{ background: `${t.tone}1c`, color: t.tone }}><Icon name={t.icon} size={17} /></div>}
                title={<span className="row" style={{ gap: 7 }}>{t.name}{bad && <Tag style={{ background: 'rgba(255,122,110,.16)', color: 'var(--red)' }}>сбой</Tag>}</span>}
                sub={`${r.note || ''} · ${shortHash(r.hash, 8)}`}
                meta={<><span>{r.at.slice(5, 16)}</span><span style={{ color: bad ? 'var(--red)' : 'var(--gold)' }}>+{r.weight}</span></>}
                chev={false}
              />
            );
          })}
        </List>
      </Section>

      <Note icon="link">Корень дня якорится во внешний публичный таймстемп: «историю нельзя переписать» проверяемо без собственного блокчейна.</Note>
    </div>
  );
}
