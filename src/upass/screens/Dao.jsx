import { useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { Card, Btn, Section, Sheet, KV, Bar, Tag } from '../components/UI.jsx';
import { Avatar } from '../components/Art.jsx';
import Icon from '../components/Icons.jsx';
import { PROPOSALS, TREASURY } from '../data/capital.js';
import { byId } from '../data/people.js';
import { totalVotes } from '../lib/nav.js';
import { usd, nf, pct, plural, relDay } from '../lib/format.js';

export default function Dao() {
  const app = useApp();
  const [open, setOpen] = useState(null);
  const weight = Math.max(1, app.me.uht);

  const live = PROPOSALS.filter((p) => !p.closed);
  const done = PROPOSALS.filter((p) => p.closed);

  return (
    <div className="screen stack-22">
      <div>
        <div className="eyebrow">Общее собрание</div>
        <h2 className="display" style={{ marginTop: 3 }}>Голосования</h2>
        <p className="t-sm dim" style={{ marginTop: 8, lineHeight: 1.55 }}>
          Вес голоса равен вашей доле в портфеле. Решение собрания исполняется, даже если вы
          голосовали против — спорить можно до голосования.
        </p>
      </div>

      <Card className="row" style={{ gap: 14 }}>
        <div style={{ width: 38, height: 38, borderRadius: 12, display: 'grid', placeItems: 'center', background: 'var(--gold-soft)', color: 'var(--gold)', flex: 'none' }}>
          <Icon name="gavel" size={19} />
        </div>
        <div className="grow">
          <div className="t-md">Ваш вес: {nf(weight, 0)} голосов</div>
          <div className="t-xs dim" style={{ marginTop: 2 }}>
            {pct(weight / TREASURY.supply, 3)} от обращения · {nf(TREASURY.holders)} держателей
          </div>
        </div>
      </Card>

      <div className="stack">
        {live.map((p) => (
          <ProposalCard key={p.id} p={p} vote={app.votes[p.id]} onOpen={() => setOpen(p)} weight={weight} />
        ))}
      </div>

      {done.length > 0 && (
        <Section eyebrow="Архив" title="Решённые вопросы">
          <div className="stack-8">
            {done.map((p) => {
              const total = totalVotes(p);
              const passed = p.yes > p.no;
              return (
                <button key={p.id} className="card tap row" style={{ gap: 12, opacity: 0.75 }} onClick={() => setOpen(p)}>
                  <Icon name={passed ? 'check' : 'x'} size={17} color={passed ? 'var(--green)' : 'var(--red)'} />
                  <div className="grow">
                    <div className="t-sm">{p.title}</div>
                    <div className="t-xs dim-2" style={{ marginTop: 2 }}>
                      {passed ? 'Принято' : 'Отклонено'} · {pct(p.yes / total)} за
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </Section>
      )}

      <Card className="row-t" style={{ gap: 11 }}>
        <Icon name="eye" size={17} color="var(--ink-3)" />
        <div className="t-xs dim" style={{ lineHeight: 1.5 }}>
          Открытый вопрос устава: что происходит, когда собрание голосует за решение, с которым не
          согласен учредитель. Пока право вето действует — и об этом идёт голосование выше.
          Если ответ «этого не произойдёт», честнее называть организацию клубом с единоличным
          управлением, а не ДАО.
        </div>
      </Card>

      <Sheet open={!!open} onClose={() => setOpen(null)} eyebrow={open?.tags?.join(' · ')} title={open?.title}>
        {open && <Detail p={open} app={app} weight={weight} onDone={() => setOpen(null)} />}
      </Sheet>
    </div>
  );
}

function ProposalCard({ p, vote, onOpen, weight }) {
  const total = totalVotes(p);
  const quorumReached = total / (TREASURY.supply * p.quorum);
  const author = byId(p.author);
  return (
    <button className="card tap" style={{ display: 'block', width: '100%', textAlign: 'left' }} onClick={onOpen}>
      <div className="row" style={{ gap: 6, marginBottom: 8 }}>
        {p.tags.map((t) => <Tag key={t} plain>{t}</Tag>)}
        <span className="grow" />
        <span className="t-xs dim-2">{relDay(p.endsInDays)}</span>
      </div>
      <div className="t-lg" style={{ lineHeight: 1.25 }}>{p.title}</div>
      <div className="t-xs dim clamp-2" style={{ marginTop: 6, lineHeight: 1.45 }}>{p.about}</div>

      <div style={{ marginTop: 13 }}>
        {p.kind === 'yesno' ? (
          <>
            <div className="spread t-xs" style={{ marginBottom: 6 }}>
              <span className="cyan">За {pct(p.yes / total)}</span>
              <span className="dim-2">Против {pct(p.no / total)}</span>
            </div>
            <Bar value={p.yes / total} tone="cyan" />
          </>
        ) : (
          <div className="stack-8">
            {p.options.map((o) => (
              <div key={o.id}>
                <div className="spread t-xs" style={{ marginBottom: 4 }}>
                  <span>{o.name}</span>
                  <span className="dim">{pct(o.votes / total)}</span>
                </div>
                <Bar value={o.votes / total} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="spread" style={{ marginTop: 12 }}>
        <div className="row" style={{ gap: 8 }}>
          <Avatar person={author} size={22} />
          <span className="t-xs dim">{author?.name}</span>
        </div>
        {vote ? (
          <Tag tone="cyan">вы проголосовали</Tag>
        ) : quorumReached >= 1 ? (
          <Tag tone="gold">кворум набран</Tag>
        ) : (
          <Tag tone="gold">кворум {pct(quorumReached)}</Tag>
        )}
      </div>
    </button>
  );
}

function Detail({ p, app, weight, onDone }) {
  const total = totalVotes(p);
  const my = app.votes[p.id];
  const author = byId(p.author);

  const cast = (choice) => {
    app.vote(p.id, choice, p.title);
    onDone();
  };

  return (
    <div className="stack-16">
      <p className="t-sm dim" style={{ lineHeight: 1.6, margin: 0 }}>{p.about}</p>

      <Card>
        <KV k="Автор" v={author?.name} />
        <KV k="Кворум" v={`${pct(p.quorum)} обращения`} />
        <KV k="Подано голосов" v={`${nf(total)} · ${pct(total / TREASURY.supply)}`} />
        <KV k="Ваш вес" v={nf(weight, 0)} tone="var(--gold)" />
        <KV k={p.closed ? 'Завершено' : 'Осталось'} v={relDay(p.endsInDays)} />
      </Card>

      {p.closed ? (
        <Card className="center">
          <div className="t-md">{p.yes > p.no ? 'Решение принято' : 'Решение отклонено'}</div>
          <div className="t-xs dim" style={{ marginTop: 5 }}>{pct(p.yes / total)} за · {pct(p.no / total)} против</div>
        </Card>
      ) : p.kind === 'yesno' ? (
        <div className="row" style={{ gap: 10 }}>
          <Btn variant={my === 'yes' ? 'gold' : 'ghost'} wide onClick={() => cast('yes')}>За</Btn>
          <Btn variant={my === 'no' ? 'danger' : 'quiet'} wide onClick={() => cast('no')}>Против</Btn>
        </div>
      ) : (
        <div className="stack-8">
          {p.options.map((o) => (
            <Btn key={o.id} variant={my === o.id ? 'gold' : 'ghost'} wide onClick={() => cast(o.id)}>
              {o.name}
            </Btn>
          ))}
        </div>
      )}

      <div className="center t-xs dim-2">
        Голос записывается в вашу цепочку репутации. Протокол решения публикуется целиком.
      </div>
    </div>
  );
}
