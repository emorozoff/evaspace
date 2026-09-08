import { useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { Top, List, Item, Btn, Section, Sheet, KV, Bar, Tag, Note } from '../components/UI.jsx';
import { Avatar } from '../components/Art.jsx';
import Icon from '../components/Icons.jsx';
import { PROPOSALS, TREASURY } from '../data/capital.js';
import { byId } from '../data/people.js';
import { totalVotes } from '../lib/nav.js';
import { nf, pct, relDay } from '../lib/format.js';

export default function Dao() {
  const app = useApp();
  const [open, setOpen] = useState(null);
  const weight = Math.max(1, app.me.uht);
  const live = PROPOSALS.filter((p) => !p.closed);
  const done = PROPOSALS.filter((p) => p.closed);

  return (
    <div className="screen stack-20">
      <Top title="Голосования" sub={`Ваш вес · ${nf(weight, 0)} голосов · ${pct(weight / TREASURY.supply, 3)}`} right={<button className="iconbtn" onClick={() => go('/club')}><Icon name="back" size={18} /></button>} />

      <Section title="Открытые">
        <List>
          {live.map((p) => {
            const total = totalVotes(p);
            const lead = p.kind === 'choice' ? p.options.reduce((a, b) => (b.votes > a.votes ? b : a)) : null;
            const my = app.votes[p.id];
            return (
              <Item
                key={p.id}
                icon={p.kind === 'choice' ? 'globe' : 'gavel'}
                title={p.title}
                sub={p.kind === 'choice' ? `Лидирует ${lead.name} · ${pct(lead.votes / total)}` : `За ${pct(p.yes / total)} · против ${pct(p.no / total)}`}
                meta={<><span>{relDay(p.endsInDays)}</span>{my ? <Tag tone="cyan">ваш голос</Tag> : <Tag tone="gold">открыто</Tag>}</>}
                chev={false}
                onClick={() => setOpen(p)}
              />
            );
          })}
        </List>
      </Section>

      <Section title="Решённые">
        <List>
          {done.map((p) => {
            const total = totalVotes(p);
            const passed = p.yes > p.no;
            return <Item key={p.id} icon={passed ? 'check' : 'x'} title={p.title} sub={`${passed ? 'Принято' : 'Отклонено'} · ${pct(p.yes / total)} за`} onClick={() => setOpen(p)} />;
          })}
        </List>
      </Section>

      <Note icon="eye">Открытый вопрос устава: что происходит, когда собрание голосует против воли учредителя. Пока право вето действует — и об этом идёт голосование выше.</Note>

      <Sheet open={!!open} onClose={() => setOpen(null)} title={open?.title} sub={open?.tags?.join(' · ')}>
        {open && <Detail p={open} app={app} weight={weight} onDone={() => setOpen(null)} />}
      </Sheet>
    </div>
  );
}

function Detail({ p, app, weight, onDone }) {
  const total = totalVotes(p);
  const my = app.votes[p.id];
  const author = byId(p.author);
  const cast = (choice) => { app.vote(p.id, choice, p.title); onDone(); };
  return (
    <div className="stack">
      <p className="t-sm dim" style={{ lineHeight: 1.6, margin: 0 }}>{p.about}</p>
      {p.kind === 'yesno' ? (
        <div className="card">
          <div className="spread t-xs" style={{ marginBottom: 6 }}><span className="cyan">За {pct(p.yes / total)}</span><span className="dim-2">Против {pct(p.no / total)}</span></div>
          <Bar value={p.yes / total} tone="cyan" />
        </div>
      ) : (
        <div className="card stack-8">
          {p.options.map((o) => (
            <div key={o.id}>
              <div className="spread t-xs" style={{ marginBottom: 4 }}><span>{o.name}</span><span className="dim">{pct(o.votes / total)}</span></div>
              <Bar value={o.votes / total} />
            </div>
          ))}
        </div>
      )}
      <div className="card" style={{ paddingTop: 2, paddingBottom: 2 }}>
        <KV k="Автор" v={author?.name} />
        <KV k="Кворум" v={`${pct(p.quorum)} · подано ${pct(total / TREASURY.supply)}`} />
        <KV k="Ваш вес" v={nf(weight, 0)} tone="var(--gold)" />
        <KV k={p.closed ? 'Завершено' : 'Осталось'} v={relDay(p.endsInDays)} />
      </div>
      {p.closed ? (
        <Note icon={p.yes > p.no ? 'check' : 'x'}>{p.yes > p.no ? 'Решение принято' : 'Решение отклонено'} · {pct(p.yes / total)} за</Note>
      ) : p.kind === 'yesno' ? (
        <div className="row" style={{ gap: 10 }}>
          <Btn variant={my === 'yes' ? 'gold' : 'ghost'} wide onClick={() => cast('yes')}>За</Btn>
          <Btn variant={my === 'no' ? 'danger' : 'quiet'} wide onClick={() => cast('no')}>Против</Btn>
        </div>
      ) : (
        <div className="stack-8">{p.options.map((o) => <Btn key={o.id} variant={my === o.id ? 'gold' : 'ghost'} wide onClick={() => cast(o.id)}>{o.name}</Btn>)}</div>
      )}
    </div>
  );
}
