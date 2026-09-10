import { useId } from 'react';
import { useStore } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { sponsorById } from '../lib/logic.js';
import { Card, Empty, List, Item, Note, Section, TopBar } from '../components/UI.jsx';
import Icon from '../components/Icons.jsx';

/* Партнёр сезона: своя страница с оффером для участников. */

export default function Sponsor({ id }) {
  const { state } = useStore();
  const sponsor = sponsorById(state, id);
  if (!sponsor) return <div className="screen"><Empty title="Партнёр не найден" /></div>;

  return (
    <div className="screen" style={{ paddingTop: 0 }}>
      <TopBar title={sponsor.name} sub={sponsor.tag} backTo="/rating" />
      <div className="stack-20">
        <div className="sponsor">
          <SponsorArt tone={sponsor.tone} height={132} />
          <div className="sponsor__body" style={{ paddingTop: 26 }}>
            <div className="h2">{sponsor.name}</div>
            <div className="t-sm dim-2" style={{ marginTop: 4 }}>{sponsor.tag} · {sponsor.short}</div>
          </div>
          <span className="sponsor__logo" style={{ background: sponsor.tone, bottom: 'auto', top: 110 }}>{sponsor.name[0]}</span>
        </div>

        <p className="lead">{sponsor.about}</p>

        <Card variant="accent">
          <div className="row-t">
            <div className="item__ic"><Icon name="gift" size={19} /></div>
            <div className="grow">
              <div className="t-xs dim-2">Участникам клуба</div>
              <div className="t-md" style={{ marginTop: 3, lineHeight: 1.4 }}>{sponsor.offer}</div>
            </div>
          </div>
        </Card>

        <a className="btn btn--accent btn--wide" href={sponsor.link} target="_blank" rel="noreferrer">Перейти к партнёру</a>

        <Section title="Другие партнёры">
          <List>
            {state.sponsors.filter((s) => s.id !== sponsor.id).map((s) => (
              <Item
                key={s.id}
                lead={<span className="sponsor__logo" style={{ position: 'static', background: s.tone, boxShadow: 'none', width: 40, height: 40, borderRadius: 12 }}>{s.name[0]}</span>}
                title={s.name}
                sub={s.short}
                onClick={() => go(`/sponsor/${s.id}`)}
              />
            ))}
          </List>
        </Section>

        <Note icon="eye">Партнёры поддерживают сезон: их взносы идут в общую копилку клуба.</Note>
      </div>
    </div>
  );
}

/** Заставка партнёра — мягкие волны в его цвете, рисуются вектором. */
export function SponsorArt({ tone, height = 96 }) {
  const id = useId().replace(/:/g, '');
  return (
    <div className="sponsor__art" style={{ height }}>
      <svg viewBox="0 0 320 120" preserveAspectRatio="none">
        <defs>
          <linearGradient id={`sa${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={tone} stopOpacity="0.5" />
            <stop offset="100%" stopColor="#0f121a" />
          </linearGradient>
        </defs>
        <rect width="320" height="120" fill={`url(#sa${id})`} />
        <g fill="none" stroke="#fff" strokeOpacity="0.13">
          {[0, 1, 2, 3].map((i) => (
            <path key={i} d={`M-10 ${30 + i * 24} C 80 ${10 + i * 26}, 200 ${60 + i * 18}, 330 ${20 + i * 24}`} />
          ))}
        </g>
      </svg>
    </div>
  );
}
