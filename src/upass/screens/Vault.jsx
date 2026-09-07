import { useMemo, useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { Card, Chip, Scroller, Search, Section, Tag, Btn } from '../components/UI.jsx';
import Icon from '../components/Icons.jsx';
import { VAULT_KINDS, DEGREES } from '../data/canon.js';
import { byId } from '../data/people.js';
import { vaultFor } from '../lib/select.js';
import { plural } from '../lib/format.js';

export default function Vault() {
  const app = useApp();
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('all');

  const items = useMemo(() => {
    let out = vaultFor(app.me);
    if (kind !== 'all') out = out.filter((v) => v.kind === kind);
    if (q.trim()) {
      const s = q.toLowerCase();
      out = out.filter((v) => !v.locked && (v.title.toLowerCase().includes(s) || v.about.toLowerCase().includes(s)));
    }
    return out;
  }, [app.me, kind, q]);

  const open = items.filter((v) => !v.locked);
  const locked = items.filter((v) => v.locked);

  return (
    <div className="screen stack-16">
      <div>
        <div className="eyebrow">Знание круга</div>
        <h2 className="display" style={{ marginTop: 3 }}>База знаний</h2>
        <p className="t-sm dim" style={{ marginTop: 8, lineHeight: 1.55 }}>
          Разборы, документы и шаблоны, собранные резидентами. Доступ открывается со степенью:
          часть материалов существует, но не показывается — это видно честно, а не скрыто.
        </p>
      </div>

      <Search value={q} onChange={setQ} placeholder="NAV, виза, найм, аренда…" />

      <Scroller>
        <Chip on={kind === 'all'} onClick={() => setKind('all')}>Всё</Chip>
        {Object.entries(VAULT_KINDS).map(([k, v]) => (
          <Chip key={k} on={kind === k} onClick={() => setKind(k)}>{v.name}</Chip>
        ))}
      </Scroller>

      <div className="stack-8">
        {open.map((v) => {
          const author = byId(v.author);
          const k = VAULT_KINDS[v.kind];
          return (
            <Card key={v.id} className="tap" as="button" style={{ display: 'block', width: '100%', textAlign: 'left' }} onClick={() => app.say('Материал открыт в читалке')}>
              <div className="row" style={{ gap: 6, marginBottom: 7 }}>
                <Tag style={{ background: `${k.tone}1e`, color: k.tone }}>{k.name}</Tag>
                {v.tags.map((t) => <Tag key={t} plain>{t}</Tag>)}
              </div>
              <div className="t-md" style={{ lineHeight: 1.3 }}>{v.title}</div>
              <div className="t-xs dim" style={{ marginTop: 5, lineHeight: 1.5 }}>{v.about}</div>
              <div className="spread" style={{ marginTop: 9 }}>
                <span className="t-xs dim-2">{author ? author.name : 'Клуб'}</span>
                <span className="t-xs dim-2">{v.size}</span>
              </div>
            </Card>
          );
        })}
      </div>

      {locked.length > 0 && (
        <Section eyebrow="Закрыто" title={`${locked.length} ${plural(locked.length, 'материал', 'материала', 'материалов')} выше вашей степени`}>
          <div className="stack-8">
            {locked.map((v) => {
              const deg = DEGREES.find((d) => d.n === v.degree);
              return (
                <Card key={v.id} className="row" style={{ gap: 12, opacity: 0.8 }}>
                  <Icon name="lock" size={17} color="var(--ink-3)" />
                  <div className="grow">
                    <div className="t-sm">
                      {deg?.secret ? <span className="redacted">{v.title}</span> : v.title}
                    </div>
                    <div className="t-xs dim-2" style={{ marginTop: 3 }}>
                      Степень {deg?.roman}{deg?.secret ? '' : ` · ${deg?.name}`}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
          <Btn variant="quiet" size="sm" wide style={{ marginTop: 4 }} onClick={() => go('/degrees')}>
            Как поднять степень
          </Btn>
        </Section>
      )}
    </div>
  );
}
