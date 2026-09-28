import { useEffect, useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { go, back } from '../lib/router.jsx';
import { assistantOf, knownFacts, sources, STARTERS } from '../lib/assistant.js';
import { groupById } from '../lib/groups.js';
import { AVATARS, TONES, AVATAR_RULES } from '../data/avatars.js';
import { DICT, DICT_LEVELS } from '../data/dictionary.js';
import { PEOPLE, byId } from '../data/people.js';
import { eventById } from '../data/events.js';
import { companyById } from '../data/services.js';
import { materialById, TOPICS } from '../data/base.js';
import { REGIONS } from '../data/regions.js';
import { plural } from '../lib/format.js';
import { Seg, List, Item, Sheet, Search, Section, Btn } from '../components/UI.jsx';
import { Avatar, Tile, GroupAva } from '../components/Art.jsx';
import { AvatarPortrait } from '../components/AvatarArt.jsx';
import { Brand } from '../components/Covers.jsx';
import { introduce } from '../components/Intros.jsx';
import Icon from '../components/Icons.jsx';
import Flag from '../components/Flag.jsx';

/* Ева и Адам — цифровые ассистенты клуба. Три вкладки:
   «Чат» — вопрос словами, ответ с карточками людей, событий, услуг и
   материалов и следующими шагами; «Обо мне» — что ассистент знает о вас
   и чему научился; «Знания» — на чём он обучен: проверенные источники,
   правила и словарь клуба. */

export default function Assistant({ query }) {
  const app = useApp();
  const A = assistantOf(app);
  const [tab, setTab] = useState(query?.tab || 'chat');
  const [settings, setSettings] = useState(false);

  useEffect(() => {
    app.aiOpen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="screen screen--nested screen--chat">
      <div className="topbar">
        <button className="backbtn" onClick={() => back('/')} aria-label="Назад"><Icon name="back" size={20} width={2} /></button>
        <button className="row grow" style={{ gap: 10, minWidth: 0, textAlign: 'left' }} onClick={() => setTab('me')}>
          <AvatarPortrait who={A.id} size={38} />
          <span style={{ minWidth: 0 }}>
            <span className="topbar__title ell" style={{ display: 'block' }}>{A.name}</span>
            <span className="aistat"><i />в сети · знает {PEOPLE.length} резидентов</span>
          </span>
        </button>
        <button className="iconbtn" onClick={() => setSettings(true)} aria-label="Настройки ассистента"><Icon name="settings" size={18} /></button>
      </div>

      <div style={{ marginBottom: 12 }}>
        <Seg value={tab} onChange={setTab} options={[{ value: 'chat', label: 'Чат' }, { value: 'me', label: 'Обо мне' }, { value: 'know', label: 'Знания' }]} />
      </div>

      {tab === 'chat' && <ChatTab app={app} A={A} />}
      {tab === 'me' && <MeTab app={app} A={A} onSettings={() => setSettings(true)} />}
      {tab === 'know' && <KnowTab A={A} />}

      <Sheet open={settings} onClose={() => setSettings(false)} title="Ваш ассистент" sub="Характер один на всех проектах клуба. Тон — под вас.">
        <Settings app={app} />
      </Sheet>
    </div>
  );
}

/* ——— чат ——— */

function ChatTab({ app, A }) {
  const [text, setText] = useState('');
  const msgs = app.ai.messages;
  const waiting = msgs.length > 0 && msgs[msgs.length - 1].from === 'me';
  const lastAi = [...msgs].reverse().find((m) => m.from === 'ai');
  const chips = waiting ? [] : lastAi?.chips || STARTERS;

  useEffect(() => {
    // к самому низу: поле ввода липкое и иначе закрывает последний ответ
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: msgs.length > 2 ? 'smooth' : 'auto' });
  }, [msgs.length, waiting]);

  const ask = (t) => {
    const q = (t ?? text).trim();
    if (!q || waiting) return;
    app.aiAsk(q);
    setText('');
  };

  return (
    <>
      <div className="chat" style={{ gap: 12 }}>
        <div className="aihead" style={{ padding: '10px 0 6px' }}>
          <AvatarPortrait who={A.id} size={88} />
          <div className="aihead__name">{A.name}</div>
          <div className="t-sm dim-2" style={{ maxWidth: 320, lineHeight: 1.5 }}>{A.about}</div>
        </div>
        {msgs.map((m, i) => (m.from === 'me' ? (
          <div key={i} className="bubble bubble--out">{m.text}</div>
        ) : (
          <div key={i} className="aimsg">
            <div className="bubble bubble--in" style={{ maxWidth: '100%' }}>{m.text}</div>
            {m.cards?.length > 0 && (
              <div className="aicards">
                {m.cards.map((c, j) => <AiCard key={`${c.type}${c.id}${j}`} app={app} c={c} />)}
              </div>
            )}
            {(m.handoff || m.team) && (
              <button className="t-xs gold" style={{ justifySelf: 'start', fontWeight: 600 }} onClick={() => go('/chat/team')}>Открыть чат с командой →</button>
            )}
          </div>
        )))}
        {waiting && <div className="typing" aria-label={`${A.name} печатает`}><i /><i /><i /></div>}
      </div>

      <div className="composer" style={{ display: 'grid', gap: 10 }}>
        {chips.length > 0 && (
          <div className="aichips">
            {chips.map((c) => <button key={c} className="chip" onClick={() => ask(c)}>{c}</button>)}
          </div>
        )}
        <form className="row" style={{ gap: 8 }} onSubmit={(e) => { e.preventDefault(); ask(); }}>
          <input className="field grow" value={text} onChange={(e) => setText(e.target.value)} placeholder={`Спросите ${A.acc} о людях, событиях, сделках`} enterKeyHint="send" />
          <button className="sendbtn" type="submit" disabled={!text.trim() || waiting} aria-label="Отправить"><Icon name="send" size={19} /></button>
        </form>
      </div>
    </>
  );
}

/* Карточка в ответе: всё кликабельно, у людей — польза и «Познакомить». */
function AiCard({ app, c }) {
  if (c.type === 'person') {
    const p = byId(c.id);
    if (!p) return null;
    const done = app.intros?.[p.id];
    return (
      <div className="aicard2">
        <button className="row grow" style={{ gap: 12, minWidth: 0, textAlign: 'left' }} onClick={() => go(`/p/${p.id}`)}>
          <Avatar person={p} size={44} dot={p.online} />
          <span style={{ minWidth: 0 }}>
            <span className="ell" style={{ display: 'block', fontWeight: 600, fontSize: 15 }}>{p.name}</span>
            <span className="t-xs dim-2 clamp-2" style={{ marginTop: 2 }}><Flag cc={REGIONS[p.region].cc} size={12} /> {c.note || p.company}</span>
          </span>
        </button>
        <span style={{ display: 'grid', justifyItems: 'end', gap: 6, flex: 'none' }}>
          {c.pct != null && <span className={`pct${c.pct >= 75 ? ' pct--hi' : ''}`}>{c.pct}%</span>}
          {done ? <span className="t-xs" style={{ color: 'var(--sea)' }}>интро</span> : <button className="t-xs gold" style={{ fontWeight: 600 }} onClick={() => introduce(app, p, c.note)}>Познакомить</button>}
        </span>
      </div>
    );
  }
  if (c.type === 'event') {
    const e = eventById(c.id);
    if (!e) return null;
    const going = app.going[e.id];
    return (
      <button className="aicard2" onClick={() => go(`/event/${e.id}`)}>
        <Tile icon={e.kind === 'online' ? 'video' : e.kind === 'closed' ? 'lock' : 'calendar'} size={44} />
        <span className="grow" style={{ minWidth: 0 }}>
          <span className="clamp-2" style={{ fontWeight: 600, fontSize: 15 }}>{e.title}</span>
          <span className="t-xs dim-2 clamp-2" style={{ marginTop: 2 }}>{c.note}</span>
        </span>
        {going ? <span className="tag tag--sea">иду</span> : <Icon name="right" size={16} color="var(--ink-3)" />}
      </button>
    );
  }
  if (c.type === 'service') {
    const co = companyById(c.id);
    if (!co) return null;
    return (
      <button className="aicard2" onClick={() => go(`/service/${co.id}`)}>
        <Brand company={co} size={44} radius={13} />
        <span className="grow" style={{ minWidth: 0 }}>
          <span className="ell" style={{ display: 'block', fontWeight: 600, fontSize: 15 }}>{co.name}</span>
          <span className="t-xs dim-2 ell" style={{ display: 'block', marginTop: 2 }}>{c.note || co.tagline}</span>
        </span>
        <Icon name="right" size={16} color="var(--ink-3)" />
      </button>
    );
  }
  if (c.type === 'material') {
    const m = materialById(c.id);
    if (!m) return null;
    const t = TOPICS.find((x) => x.id === m.topic);
    return (
      <button className="aicard2" onClick={() => go(`/material/${m.id}`)}>
        <Tile icon={m.kind === 'zoom' ? 'play' : 'book'} tone={t?.tone} size={44} />
        <span className="grow" style={{ minWidth: 0 }}>
          <span className="clamp-2" style={{ fontWeight: 600, fontSize: 15 }}>{m.title}</span>
          <span className="t-xs dim-2 ell" style={{ display: 'block', marginTop: 2 }}>{m.kind === 'zoom' ? 'Запись эфира' : 'Гайд'} · {m.dur || m.read || ''}</span>
        </span>
        <Icon name="right" size={16} color="var(--ink-3)" />
      </button>
    );
  }
  if (c.type === 'group') {
    const g = groupById(app.me, c.id);
    if (!g) return null;
    return (
      <button className="aicard2" onClick={() => go(`/group/${g.id}`)}>
        <GroupAva members={g.members} size={44} />
        <span className="grow" style={{ minWidth: 0 }}>
          <span className="ell" style={{ display: 'block', fontWeight: 600, fontSize: 15 }}>{g.name}</span>
          <span className="t-xs dim-2 ell" style={{ display: 'block', marginTop: 2 }}>10 участников · {g.when}</span>
        </span>
        <Icon name="right" size={16} color="var(--ink-3)" />
      </button>
    );
  }
  return null;
}

/* ——— что ассистент знает о вас ——— */

function MeTab({ app, A, onSettings }) {
  const facts = knownFacts(app);
  const intros = Object.keys(app.intros || {}).length;
  return (
    <div className="stack-24" style={{ paddingBottom: 24 }}>
      <div className="aihead">
        <AvatarPortrait who={A.id} size={112} />
        <div className="aihead__name">{A.name}</div>
        <div className="t-sm dim-2" style={{ maxWidth: 320, lineHeight: 1.5 }}>
          Я учусь на ваших ответах и выборах: куда вы идёте, с кем знакомитесь, о чём спрашиваете. Чем больше вы со мной говорите, тем точнее подбор.
        </div>
      </div>

      <div className="stats">
        <div className="stat"><div className="stat__v gold">{facts.length}</div><div className="stat__l">{plural(facts.length, 'факт', 'факта', 'фактов')} о вас</div></div>
        <div className="stat"><div className="stat__v">{app.ai.count}</div><div className="stat__l">{plural(app.ai.count, 'вопрос', 'вопроса', 'вопросов')}</div></div>
        <div className="stat"><div className="stat__v">{intros}</div><div className="stat__l">интро</div></div>
      </div>

      <Section title="Что я знаю о вас">
        <div className="card">
          {facts.map((f) => (
            <div key={f.k} className="kv"><span className="kv__k">{f.k}</span><span className="kv__v" style={{ fontWeight: 500 }}>{f.v}</span></div>
          ))}
        </div>
      </Section>

      <div className="stack-8">
        <Btn variant="gold" wide icon="spark" onClick={() => go('/test')}>{app.me.tested ? 'Пройти тест заново' : 'Пройти тест — минута'}</Btn>
        <div className="pair">
          <Btn variant="ghost" size="sm" icon="settings" onClick={onSettings}>Тон и ассистент</Btn>
          <Btn variant="ghost" size="sm" icon="x" onClick={() => { app.aiReset(); app.say(`${A.name} ${A.she ? 'забыла' : 'забыл'} переписку — ответы теста остались`); }}>Забыть чат</Btn>
        </div>
      </div>
    </div>
  );
}

/* ——— на чём обучен ——— */

function KnowTab({ A }) {
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();
  const terms = DICT.filter((d) => !query || `${d.term} ${d.text}`.toLowerCase().includes(query));
  return (
    <div className="stack-24" style={{ paddingBottom: 24 }}>
      <Section title="Проверенная база" note={`${A.name} отвечает только по ней. Нет в базе — вопрос уходит команде.`}>
        <List>
          {sources().map((s) => (
            <Item key={s.name} icon={s.icon} title={s.name} sub={s.sub} meta={<span className="t-md" style={{ color: 'var(--ink)', fontWeight: 600 }}>{s.n}</span>} chev={false} />
          ))}
        </List>
      </Section>

      <Section title="Правила">
        <div className="card steps">
          {AVATAR_RULES.map((r, i) => (
            <div key={i} className="step"><span className="step__n">{i + 1}</span><span className="step__t">{r}</span></div>
          ))}
        </div>
      </Section>

      <Section title="Словарь клуба" note={`${DICT.length} ${plural(DICT.length, 'термин', 'термина', 'терминов')} — спросите «что такое…»`}>
        <Search value={q} onChange={setQ} placeholder="Термин" />
        {DICT_LEVELS.map((l) => {
          const list = terms.filter((d) => d.level === l.id);
          if (!list.length) return null;
          return (
            <div key={l.id} className="stack-8">
              <div className="label" style={{ margin: '6px 0 0' }}>{l.title}</div>
              <div className="card" style={{ padding: '4px 16px' }}>
                {list.map((d) => (
                  <div key={d.id} className="term">
                    <div className="term__t">{d.term}</div>
                    <div className="term__d">{d.text}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </Section>
    </div>
  );
}

/* ——— настройки ——— */

function Settings({ app }) {
  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="pair">
        {['eva', 'adam'].map((id) => {
          const x = AVATARS[id];
          const on = app.me.assistant === id;
          return (
            <button key={id} className={`opt${on ? ' opt--on' : ''}`} style={{ flexDirection: 'column', gap: 10, padding: 16 }} onClick={() => app.updateMe({ assistant: id })}>
              <AvatarPortrait who={id} size={72} />
              <span className="opt__name" style={{ fontFamily: 'var(--display)', fontWeight: 400, fontSize: 22 }}>{x.name}</span>
            </button>
          );
        })}
      </div>
      <div>
        <span className="label">Тон общения</span>
        <div className="stack-8">
          {TONES.map((t) => {
            const on = (app.me.tone || 'warm') === t.id;
            return (
              <button key={t.id} className={`opt${on ? ' opt--on' : ''}`} onClick={() => app.updateMe({ tone: t.id })}>
                <span className="grow">
                  <span className="opt__name">{t.name}</span>
                  <span className="opt__sub">{t.sub}</span>
                </span>
                <span className="opt__check">{on && <Icon name="check" size={14} width={2.4} />}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
