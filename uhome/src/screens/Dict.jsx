import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { DICT, DICT_LEVELS, DICT_READ_MIN } from '../data/dictionary.js';
import { pinOf } from '../data/base.js';
import { plural } from '../lib/format.js';
import { prefersReduced } from '../lib/motion.js';
import { TopBar, Search, Btn } from '../components/UI.jsx';
import Icon from '../components/Icons.jsx';

/* Словарь клуба — первый закреп базы. Чтобы все говорили на одном языке:
   разделы от устройства клуба к сделкам и ИИ, термин раскрывается по
   нажатию. Ева и Адам знают те же слова и объясняют их в чате. */

const PIN = pinOf('dict');

export default function Dict() {
  const app = useApp();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState({});
  const [level, setLevel] = useState(null);
  const refs = useRef({});

  // открыли словарь — закреп считается изученным
  useEffect(() => {
    if (!app.watched.dict) app.watch('dict');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const s = q.trim().toLowerCase();
  const found = useMemo(
    () => (s ? DICT.filter((t) => `${t.term} ${t.full || ''} ${t.text}`.toLowerCase().includes(s)) : null),
    [s]
  );
  const toggle = (id) => setOpen((o) => ({ ...o, [id]: !o[id] }));
  // к разделу — по положению в раскладке: у разделов есть проявление с
  // transform, и scrollIntoView по «видимой» рамке промахивался бы
  const jump = (id) => {
    setLevel(id);
    const el = refs.current[id];
    if (!el) return;
    let y = 0;
    for (let n = el; n; n = n.offsetParent) y += n.offsetTop;
    const bar = document.querySelector('.topbar')?.offsetHeight || 61;
    const tools = document.querySelector('.dct-tools')?.offsetHeight || 108;
    window.scrollTo({ top: Math.max(0, y - bar - tools - 16), behavior: prefersReduced() ? 'auto' : 'smooth' });
  };

  return (
    <div className="screen screen--nested dct">
      <TopBar title="Словарь клуба" sub={`${DICT.length} ${plural(DICT.length, 'термин', 'термина', 'терминов')} · ${DICT_LEVELS.length} ${plural(DICT_LEVELS.length, 'раздел', 'раздела', 'разделов')}`} backTo="/base" />

      <header className="dct-hero">
        <div className="dct-hero__eye"><span>Закреп {PIN?.n || '01'}</span><span>Текст</span><span>{DICT_READ_MIN} мин</span></div>
        <h1 className="h1">Словарь клуба</h1>
        <p className="dct-hero__lead">Чтобы все говорили на одном языке — от «повода» и «интро» до синдиката и KITAS.</p>
        <div className="dct-stats">
          <div><b>{DICT.length}</b><span>{plural(DICT.length, 'термин', 'термина', 'терминов')}</span></div>
          <div><b>{DICT_LEVELS.length}</b><span>раздела</span></div>
          <div><b>{DICT_READ_MIN}</b><span>мин чтения</span></div>
        </div>
      </header>

      <div className="dct-tools">
        <Search value={q} onChange={setQ} placeholder="Найти слово: KITAS, интро, SAFE…" />
        {!found && (
          <div className="dct-index">
            {DICT_LEVELS.map((l, i) => (
              <button key={l.id} data-on={level === l.id} onClick={() => jump(l.id)}>
                <em>{String(i + 1).padStart(2, '0')}</em>{l.title}<b>{DICT.filter((t) => t.level === l.id).length}</b>
              </button>
            ))}
          </div>
        )}
      </div>

      {found ? (
        <section className="dct-found">
          <div className="dct-found__head">{found.length ? `Нашлось · ${found.length}` : 'Такого слова пока нет'}</div>
          {found.length > 0 && (
            <div className="dct-list">
              {found.map((t) => (
                <Term key={t.id} t={t} q={s} open={found.length <= 3 || !!open[t.id]} onToggle={() => toggle(t.id)} level={DICT_LEVELS.find((l) => l.id === t.level)?.title} />
              ))}
            </div>
          )}
        </section>
      ) : (
        DICT_LEVELS.map((l, i) => {
          const list = DICT.filter((t) => t.level === l.id);
          return (
            <section key={l.id} className="dct-level reveal" ref={(el) => { refs.current[l.id] = el; }}>
              <div className="dct-level__head">
                <span className="dct-level__n">{String(i + 1).padStart(2, '0')}</span>
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="dct-level__t">{l.title}</div>
                  {l.sub && <div className="dct-level__s">{l.sub}</div>}
                </div>
                <span className="dct-level__c">{list.length}</span>
              </div>
              <div className="dct-list">
                {list.map((t) => <Term key={t.id} t={t} open={!!open[t.id]} onToggle={() => toggle(t.id)} />)}
              </div>
            </section>
          );
        })
      )}

      <div className="dct-add">
        <div className="dct-add__k"><Icon name="plus" size={13} width={2} /> Не хватает слова?</div>
        <div className="dct-add__t">Напишите команде клуба — объясним и добавим в словарь для всех. А ассистент уже сейчас ответит на «что такое…».</div>
        <div className="pair">
          <Btn size="sm" variant="ghost" icon="message" onClick={() => go('/chat/team')}>Команде клуба</Btn>
          <Btn size="sm" variant="quiet" icon="spark" onClick={() => go('/ai')}>Ассистенту</Btn>
        </div>
      </div>
    </div>
  );
}

function Mark({ text, q }) {
  if (!q) return text;
  const i = text.toLowerCase().indexOf(q);
  if (i < 0) return text;
  return <>{text.slice(0, i)}<mark className="dct-mark">{text.slice(i, i + q.length)}</mark>{text.slice(i + q.length)}</>;
}

function Term({ t, open, onToggle, q, level }) {
  return (
    <div className="dct-term" data-open={open}>
      <button className="dct-term__row" onClick={onToggle} aria-expanded={open}>
        <span className="dct-term__main">
          {level && <span className="dct-term__lvl">{level}</span>}
          <span className="dct-term__line">
            <span className="dct-term__t"><Mark text={t.term} q={q} /></span>
            {t.full && <span className="dct-term__f"><Mark text={t.full} q={q} /></span>}
          </span>
          {!open && <span className="dct-term__p">{t.text}</span>}
        </span>
        <span className="dct-term__x"><Icon name="plus" size={15} /></span>
      </button>
      {open && <div className="dct-term__text"><Mark text={t.text} q={q} /></div>}
    </div>
  );
}
