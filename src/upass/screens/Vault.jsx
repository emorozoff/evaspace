import { useMemo, useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { Top, List, Item, Chip, Scroller, Search, Section, Btn, Note } from '../components/UI.jsx';
import Icon from '../components/Icons.jsx';
import { VAULT_KINDS, DEGREES } from '../data/canon.js';
import { byId } from '../data/people.js';
import { vaultFor } from '../lib/select.js';
import { plural } from '../lib/format.js';

const KIND_ICON = { doc: 'scroll', play: 'book', rec: 'eye', tpl: 'grid', map: 'globe' };

export default function Vault() {
  const app = useApp();
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('all');
  const items = useMemo(() => {
    let out = vaultFor(app.me);
    if (kind !== 'all') out = out.filter((v) => v.kind === kind);
    if (q.trim()) { const s = q.toLowerCase(); out = out.filter((v) => !v.locked && (v.title + ' ' + v.about).toLowerCase().includes(s)); }
    return out;
  }, [app.me, kind, q]);
  const open = items.filter((v) => !v.locked);
  const locked = items.filter((v) => v.locked);

  return (
    <div className="screen stack">
      <Top title="База знаний" sub="Разборы, документы и шаблоны резидентов" right={<button className="iconbtn" onClick={() => go('/club')}><Icon name="back" size={18} /></button>} />
      <Search value={q} onChange={setQ} placeholder="NAV, виза, найм, аренда…" />
      <Scroller>
        <Chip on={kind === 'all'} onClick={() => setKind('all')}>Всё</Chip>
        {Object.entries(VAULT_KINDS).map(([k, v]) => <Chip key={k} on={kind === k} onClick={() => setKind(k)}>{v.name}</Chip>)}
      </Scroller>

      <List>
        {open.map((v) => (
          <Item key={v.id} icon={KIND_ICON[v.kind]} title={v.title} sub={`${VAULT_KINDS[v.kind].name} · ${byId(v.author)?.name || 'Клуб'} · ${v.size}`} onClick={() => app.say('Материал открыт в читалке')} />
        ))}
      </List>

      {locked.length > 0 && (
        <Section title={`Закрыто · ${locked.length}`}>
          <List>
            {locked.map((v) => {
              const deg = DEGREES.find((d) => d.n === v.degree);
              return <Item key={v.id} icon="lock" title={deg?.secret ? <span className="redacted">{v.title}</span> : v.title} sub={`Нужна степень ${deg?.roman}${deg?.secret ? '' : ` · ${deg?.name}`}`} chev={false} />;
            })}
          </List>
          <Btn variant="quiet" size="sm" wide onClick={() => go('/degrees')}>Как поднять степень</Btn>
        </Section>
      )}
    </div>
  );
}
