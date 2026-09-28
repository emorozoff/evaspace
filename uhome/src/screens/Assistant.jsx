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
import { Seg, Sheet, Search, Section, Btn } from '../components/UI.jsx';
import { Avatar, Tile, GroupAva } from '../components/Art.jsx';
import { HoloPortrait } from '../components/AiFab.jsx';
import { PctRing, DateTile } from '../components/EventCards.jsx';
import { Brand } from '../components/Covers.jsx';
import { introduce } from '../components/Intros.jsx';
import Icon from '../components/Icons.jsx';
import Flag from '../components/Flag.jsx';

/* Ева и Адам — цифровые ассистенты клуба. Три вкладки:
   «Чат» — вопрос словами, ответ с карточками людей, событий, услуг и
   материалов и следующими шагами; «Обо мне» — что ассистент знает о вас
   и чему научился; «Знания» — на чём он обучен: проверенные источники,
   правила и словарь клуба. */

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
    <div className="screen screen--nested screen--chat xai">
      <div className="topbar xai-bar">
        <button className="backbtn" onClick={() => back('/')} aria-label="Назад"><Icon name="back" size={20} width={2} /></button>
        <button className="row grow" style={{ gap: 12, minWidth: 0, textAlign: 'left' }} onClick={() => setTab('me')}>
          <HoloPortrait who={A.id} size={34} />
          <span style={{ minWidth: 0 }}>
            <span className="topbar__title ell" style={{ display: 'block' }}>{A.name}</span>
            <span className="xai-stat"><i />онлайн · знает {PEOPLE.length} резидентов</span>
          </span>
        </button>
        <button className="iconbtn" onClick={() => setSettings(true)} aria-label="Настройки ассистента"><Icon name="settings" size={18} /></button>
      </div>

      <div className="xai-seg">
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

  const src = sources();
  return (
    <>
      <div className="xai-feed">
        <div className="xai-head">
          <HoloPortrait who={A.id} size={92} scan />
          <div className="xai-head__name">{A.name}</div>
          <div className="xtele xai-head__tele"><b>{src[0].n}</b> резидентов<i /><b>{src[1].n}</b> событий<i /><b>{src[2].n}</b> компаний</div>
          <div className="xai-head__about">{A.about}</div>
        </div>
        {msgs.map((m, i) => (m.from === 'me' ? (
          <div key={i} className="xb xb--out">
            <span className="xb__text">{m.text}</span>
            <span className="xb__sp" aria-hidden="true" />
            <span className="xb__time">{hm(m.at)}</span>
          </div>
        ) : (
          <div key={i} className="xai-msg">
            <div className="xai-msg__t">
              <span className="xai-msg__k"><i />{A.name}<span>{hm(m.at)}</span></span>
              {m.text}
            </div>
            {m.cards?.length > 0 && (
              <div className="xai-cards">
                {m.cards.map((c, j) => <AiCard key={`${c.type}${c.id}${j}`} app={app} c={c} i={j} />)}
              </div>
            )}
            {(m.handoff || m.team) && (
              <button className="xai-link" onClick={() => go('/chat/team')}>Открыть чат с командой →</button>
            )}
          </div>
        )))}
        {waiting && (
          <div className="xai-typing" aria-label={`${A.name} печатает`}>
            <span className="xai-typing__bar"><i /><i /><i /></span>
            {A.name} думает над ответом
          </div>
        )}
      </div>

      <div className="xcomp xai-comp">
        {chips.length > 0 && (
          <div className="xai-chips">
            {chips.map((c, i) => <button key={c} className="xai-chip" style={{ '--i': i }} onClick={() => ask(c)}>{c}</button>)}
          </div>
        )}
        <form className="xcomp__bar" onSubmit={(e) => { e.preventDefault(); ask(); }}>
          <input className="xcomp__in" value={text} onChange={(e) => setText(e.target.value)} placeholder={`Спросите ${A.acc} о людях, событиях, сделках`} enterKeyHint="send" aria-label="Вопрос ассистенту" />
          <button className="xcomp__send" type="submit" disabled={!text.trim() || waiting} aria-label="Отправить"><Icon name="send" size={18} /></button>
        </form>
      </div>
    </>
  );
}

/* Карточка в ответе: всё кликабельно, у людей — польза и «Познакомить». */
function AiCard({ app, c, i = 0 }) {
  if (c.type === 'person') {
    const p = byId(c.id);
    if (!p) return null;
    const done = app.intros?.[p.id];
    return (
      <div className="xai-card xai-card--p" style={{ '--i': i }}>
        <button className="xai-card__lead" onClick={() => go(`/p/${p.id}`)} aria-label={p.name}>
          <Avatar person={p} size={42} dot={p.online} />
        </button>
        <span className="xai-card__body">
          <button className="xai-card__t" onClick={() => go(`/p/${p.id}`)}>{p.name}</button>
          <span className="xai-card__s clamp-2"><Flag cc={REGIONS[p.region].cc} size={11} /> {c.note || p.company}</span>
          {done
            ? <span className="xmeet__done"><Icon name="check" size={12} width={2.2} /> интро отправлено</span>
            : <button className="xmeet__act" onClick={() => introduce(app, p, c.note)}><Icon name="handshake" size={14} /> Познакомить</button>}
        </span>
        {c.pct != null && <PctRing pct={c.pct} size={44} />}
      </div>
    );
  }
  if (c.type === 'event') {
    const e = eventById(c.id);
    if (!e) return null;
    const going = app.going[e.id];
    return (
      <button className="xai-card" style={{ '--i': i }} onClick={() => go(`/event/${e.id}`)}>
        <DateTile days={e.inDays} />
        <span className="xai-card__body">
          <span className="xai-card__t clamp-2">{e.title}</span>
          <span className="xai-card__s clamp-2">{c.note}</span>
        </span>
        {going ? <span className="tag tag--sea">иду</span> : <Icon name="right" size={16} className="chev" />}
      </button>
    );
  }
  if (c.type === 'service') {
    const co = companyById(c.id);
    if (!co) return null;
    return (
      <button className="xai-card" style={{ '--i': i }} onClick={() => go(`/service/${co.id}`)}>
        <Brand company={co} size={44} radius={13} />
        <span className="xai-card__body">
          <span className="xai-card__t ell">{co.name}</span>
          <span className="xai-card__s ell">{c.note || co.tagline}</span>
        </span>
        <Icon name="right" size={16} className="chev" />
      </button>
    );
  }
  if (c.type === 'material') {
    const m = materialById(c.id);
    if (!m) return null;
    const t = TOPICS.find((x) => x.id === m.topic);
    return (
      <button className="xai-card" style={{ '--i': i }} onClick={() => go(`/material/${m.id}`)}>
        <Tile icon={m.kind === 'zoom' ? 'play' : 'book'} tone={t?.tone} size={44} />
        <span className="xai-card__body">
          <span className="xai-card__t clamp-2">{m.title}</span>
          <span className="xai-card__m">{m.kind === 'zoom' ? 'Запись эфира' : 'Гайд'}{m.dur || m.read ? ` · ${m.dur || m.read}` : ''}</span>
        </span>
        <Icon name="right" size={16} className="chev" />
      </button>
    );
  }
  if (c.type === 'group') {
    const g = groupById(app.me, c.id);
    if (!g) return null;
    return (
      <button className="xai-card" style={{ '--i': i }} onClick={() => go(`/group/${g.id}`)}>
        <GroupAva members={g.members} size={44} />
        <span className="xai-card__body">
          <span className="xai-card__t ell">{g.name}</span>
          <span className="xai-card__m">10 участников · {g.when}</span>
        </span>
        <Icon name="right" size={16} className="chev" />
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
      <div className="xai-head xai-head--me">
        <HoloPortrait who={A.id} size={104} scan />
        <div className="xai-head__name">{A.name}</div>
        <div className="xai-head__about">
          Я учусь на ваших ответах и выборах: куда вы идёте, с кем знакомитесь, о чём спрашиваете. Чем больше вы со мной говорите, тем точнее подбор.
        </div>
      </div>

      <div className="stats xai-stats">
        <div className="stat"><div className="stat__v gold">{facts.length}</div><div className="stat__l">{plural(facts.length, 'факт', 'факта', 'фактов')} о вас</div></div>
        <div className="stat"><div className="stat__v">{app.ai.count}</div><div className="stat__l">{plural(app.ai.count, 'вопрос', 'вопроса', 'вопросов')}</div></div>
        <div className="stat"><div className="stat__v">{intros}</div><div className="stat__l">интро</div></div>
      </div>

      <Section title="Что я знаю о вас" note="Собрано из теста и ваших действий">
        <div className="xfacts">
          {facts.map((f, i) => (
            <div key={f.k} className="xfacts__r" style={{ '--i': i }}><span className="xfacts__k">{f.k}</span><span className="xfacts__v">{f.v}</span></div>
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
        <div className="xsrc">
          {sources().map((s, i) => (
            <div key={s.name} className="xsrc__r" style={{ '--i': i }}>
              <span className="xsrc__ic"><Icon name={s.icon} size={17} /></span>
              <span className="grow" style={{ minWidth: 0 }}>
                <span className="xsrc__t">{s.name}</span>
                <span className="xsrc__s">{s.sub}</span>
              </span>
              <span className="xsrc__n">{String(s.n).padStart(2, '0')}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Правила">
        <ol className="xtl xtl--n">
          {AVATAR_RULES.map((r, i) => (
            <li key={i} className="xtl__i" style={{ '--i': i }}><span className="xtl__t">{String(i + 1).padStart(2, '0')}</span><span className="xtl__d">{r}</span></li>
          ))}
        </ol>
      </Section>

      <Section title="Словарь клуба" note={`${DICT.length} ${plural(DICT.length, 'термин', 'термина', 'терминов')} — спросите «что такое…»`}>
        <Search value={q} onChange={setQ} placeholder="Термин" />
        {DICT_LEVELS.map((l) => {
          const list = terms.filter((d) => d.level === l.id);
          if (!list.length) return null;
          return (
            <div key={l.id} className="stack-8">
              <div className="xai-lvl">{l.title}<span>{String(list.length).padStart(2, '0')}</span></div>
              <div className="xterms">
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
    <div className="stack xset" style={{ gap: 18 }}>
      <div className="pair">
        {['eva', 'adam'].map((id) => {
          const x = AVATARS[id];
          const on = app.me.assistant === id;
          return (
            <button key={id} className={`opt xset__ava${on ? ' opt--on' : ''}`} style={{ flexDirection: 'column', gap: 12, padding: 16 }} onClick={() => app.updateMe({ assistant: id })} aria-pressed={on}>
              <HoloPortrait who={id} size={64} still={!on} />
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
