import { useEffect, useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { go, back } from '../lib/router.jsx';
import { assistantOf, knownFacts, sources, STARTERS } from '../lib/assistant.js';
import { groupById } from '../lib/groups.js';
import { AVATARS, TONES, AVATAR_RULES } from '../data/avatars.js';
import { DICT } from '../data/dictionary.js';
import { PEOPLE, byId } from '../data/people.js';
import { eventById } from '../data/events.js';
import { companyById } from '../data/services.js';
import { materialById } from '../data/base.js';
import { REGIONS } from '../data/regions.js';
import { plural } from '../lib/format.js';
import { Seg, Sheet, Section, Btn, List, Item } from '../components/UI.jsx';
import { Avatar, GroupAva } from '../components/Art.jsx';
import { AvatarPortrait } from '../components/AvatarArt.jsx';
import { DateTile } from '../components/EventCards.jsx';
import { Brand } from '../components/Covers.jsx';
import { introduce } from '../components/Intros.jsx';
import Icon from '../components/Icons.jsx';
import Flag from '../components/Flag.jsx';

/* Ева и Адам — цифровые ассистенты клуба. Три вкладки: «Чат» — вопрос
   словами, ответ с карточками людей, событий, услуг и материалов;
   «Обо мне» — что ассистент знает о вас; «Знания» — на чём он обучен. */

const hm = (ms) => {
  const d = new Date(ms || Date.now());
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

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
        <button className="row grow" style={{ gap: 12, minWidth: 0 }} onClick={() => setTab('me')}>
          <AvatarPortrait who={A.id} size={44} />
          <span style={{ minWidth: 0 }}>
            <span className="topbar__title ell" style={{ display: 'block' }}>{A.name}</span>
            <span className="topbar__sub"><i className="s-dot" />онлайн · {PEOPLE.length} {plural(PEOPLE.length, 'резидент', 'резидента', 'резидентов')} в базе</span>
          </span>
        </button>
        <button className="iconbtn" onClick={() => setSettings(true)} aria-label="Настройки ассистента"><Icon name="settings" size={18} /></button>
      </div>

      <div style={{ marginTop: -8, marginBottom: 18 }}>
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
      <div className="s-feed s-feed--ai">
        <div className="s-ai-head">
          <AvatarPortrait who={A.id} size={72} />
          <div className="h2" style={{ marginTop: 12 }}>{A.name}</div>
          <p className="lead" style={{ marginTop: 8 }}>{A.about}</p>
        </div>
        {msgs.map((m, i) => (m.from === 'me' ? (
          <div key={i} className="s-row s-row--out">
            <div className="s-b s-b--out"><span className="s-b__text">{m.text}</span><span className="s-b__time">{hm(m.at)}</span></div>
          </div>
        ) : (
          <div key={i} className="s-ai-msg">
            <div className="s-b s-b--in">
              <span className="s-b__who">{A.name}</span>
              <span className="s-b__text">{m.text}</span>
              <span className="s-b__time">{hm(m.at)}</span>
            </div>
            {m.cards?.length > 0 && <List>{m.cards.map((c, j) => <AiCard key={`${c.type}${c.id}${j}`} app={app} c={c} />)}</List>}
            {(m.handoff || m.team) && <button className="sect__more" style={{ textAlign: 'left' }} onClick={() => go('/chat/team')}>Открыть чат с командой →</button>}
          </div>
        )))}
        {waiting && <div className="t-sm dim-2 s-typing" aria-live="polite">{A.name} печатает…</div>}
      </div>

      <div className="s-comp">
        {chips.length > 0 && (
          <div className="scroller s-chips">
            {chips.map((c) => <button key={c} className="chip" onClick={() => ask(c)}>{c}</button>)}
          </div>
        )}
        <form className="s-comp__bar" onSubmit={(e) => { e.preventDefault(); ask(); }}>
          <input className="s-comp__in" value={text} onChange={(e) => setText(e.target.value)} placeholder={`Спросите ${A.acc} о людях, событиях, сделках`} enterKeyHint="send" aria-label="Вопрос ассистенту" />
          <button className="s-comp__send" type="submit" disabled={!text.trim() || waiting} aria-label="Отправить"><Icon name="send" size={18} /></button>
        </form>
      </div>
    </>
  );
}

/* Карточка в ответе — строка списка: у людей польза и «Познакомить». */
function AiCard({ app, c }) {
  if (c.type === 'person') {
    const p = byId(c.id);
    if (!p) return null;
    const done = app.intros?.[p.id];
    return (
      <div className="item" style={{ alignItems: 'flex-start' }}>
        <button onClick={() => go(`/p/${p.id}`)} aria-label={p.name}><Avatar person={p} size={42} dot={p.online} /></button>
        <span className="item__body">
          <button className="item__t" style={{ display: 'block', maxWidth: '100%' }} onClick={() => go(`/p/${p.id}`)}>{p.name}</button>
          <span className="item__s item__s--wrap"><Flag cc={REGIONS[p.region].cc} size={11} /> {c.note || p.company}</span>
          {done
            ? <span className="t-xs sea" style={{ display: 'block', marginTop: 6 }}>Интро отправлено</span>
            : <button className="s-act" onClick={() => introduce(app, p, c.note)}>Познакомить</button>}
        </span>
        {c.pct != null && <span className="s-pct">{c.pct}<small>%</small></span>}
      </div>
    );
  }
  if (c.type === 'event') {
    const e = eventById(c.id);
    if (!e) return null;
    return <Item lead={<DateTile days={e.inDays} />} title={e.title} sub={c.note} subWrap meta={app.going[e.id] ? <span className="tag tag--sea">иду</span> : undefined} onClick={() => go(`/event/${e.id}`)} />;
  }
  if (c.type === 'service') {
    const co = companyById(c.id);
    if (!co) return null;
    return <Item lead={<Brand company={co} size={42} radius={21} />} title={co.name} sub={c.note || co.tagline} onClick={() => go(`/service/${co.id}`)} />;
  }
  if (c.type === 'material') {
    const m = materialById(c.id);
    if (!m) return null;
    return <Item lead={<span className="disc disc--sm"><Icon name={m.kind === 'zoom' ? 'play' : 'book'} size={16} fill={m.kind === 'zoom' ? 'currentColor' : 'none'} width={m.kind === 'zoom' ? 1 : 1.6} /></span>} title={m.title} sub={`${m.kind === 'zoom' ? 'Запись эфира' : 'Гайд'} · ${m.dur || m.read}`} onClick={() => go(`/material/${m.id}`)} />;
  }
  if (c.type === 'group') {
    const g = groupById(app.me, c.id);
    if (!g) return null;
    return <Item lead={<GroupAva members={g.members} size={42} />} title={g.name} sub={`${g.members.length + 1} участников · ${g.when}`} onClick={() => go(`/group/${g.id}`)} />;
  }
  return null;
}

/* ——— что ассистент знает о вас ——— */

function MeTab({ app, A, onSettings }) {
  const facts = knownFacts(app);
  const intros = Object.keys(app.intros || {}).length;
  return (
    <div className="stack-24" style={{ paddingBottom: 24 }}>
      <div className="strip">
        <div><span className="strip__v">{facts.length}</span><span className="strip__k">{plural(facts.length, 'факт', 'факта', 'фактов')} о вас</span></div>
        <div><span className="strip__v">{app.ai.count}</span><span className="strip__k">{plural(app.ai.count, 'вопрос', 'вопроса', 'вопросов')}</span></div>
        <div><span className="strip__v">{intros}</span><span className="strip__k">интро</span></div>
      </div>

      <Section title="Что я знаю о вас" note="Из теста и ваших действий: куда идёте, с кем знакомитесь, о чём спрашиваете">
        {facts.length ? (
          <div className="rows">
            {facts.map((f) => (
              <div key={f.k} className="rows__r"><span className="rows__k" style={{ flexBasis: 90 }}>{f.k}</span><span className="rows__v" style={{ fontSize: 14, color: 'var(--ink)', fontWeight: 500, textAlign: 'right', flex: '1 1 160px' }}>{f.v}</span></div>
            ))}
          </div>
        ) : (
          <div className="note-line">Пока ничего — пройдите тест, и подбор станет точнее.</div>
        )}
      </Section>

      <div className="stack-8">
        <Btn variant="gold" wide onClick={() => go('/test')}>{app.me.tested ? 'Пройти тест заново' : 'Пройти тест — минута'}</Btn>
        <div className="pair">
          <Btn variant="ghost" size="sm" onClick={onSettings}>Тон и ассистент</Btn>
          <Btn variant="quiet" size="sm" onClick={() => { app.aiReset(); app.say(`${A.name} ${A.she ? 'забыла' : 'забыл'} переписку — ответы теста остались`); }}>Забыть чат</Btn>
        </div>
      </div>
    </div>
  );
}

/* ——— на чём обучен ——— */

function KnowTab({ A }) {
  return (
    <div className="stack-24" style={{ paddingBottom: 24 }}>
      <Section title="Проверенная база" note={`${A.name} отвечает только по ней. Нет в базе — вопрос уходит команде.`}>
        <List>
          {sources().map((s) => (
            <Item key={s.name} icon={s.icon} title={s.name} sub={s.sub} meta={<span className="figure" style={{ fontSize: 17 }}>{s.n}</span>} />
          ))}
        </List>
      </Section>

      <Section title="Правила">
        <div className="steps">
          {AVATAR_RULES.map((r, i) => <div key={i} className="step"><span className="step__n">{String(i + 1).padStart(2, '0')}</span><span className="step__t">{r}</span></div>)}
        </div>
      </Section>

      <List>
        <Item icon="book" title="Словарь клуба" sub={`${DICT.length} ${plural(DICT.length, 'термин', 'термина', 'терминов')} — спросите «что такое…»`} onClick={() => go('/dict')} />
      </List>
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
            <button key={id} className={`card tap center${on ? ' card--gold' : ''}`} style={{ display: 'grid', justifyItems: 'center', gap: 10 }} onClick={() => app.updateMe({ assistant: id })} aria-pressed={on}>
              <AvatarPortrait who={id} size={56} ring={on} />
              <span className="h2" style={{ fontSize: 22 }}>{x.name}</span>
            </button>
          );
        })}
      </div>
      <div>
        <span className="label">Тон общения</span>
        <List>
          {TONES.map((t) => {
            const on = (app.me.tone || 'warm') === t.id;
            return <Item key={t.id} title={t.name} sub={t.sub} meta={on ? <Icon name="check" size={18} color="var(--gold)" /> : ''} chev={false} onClick={() => app.updateMe({ tone: t.id })} />;
          })}
        </List>
      </div>
    </div>
  );
}
