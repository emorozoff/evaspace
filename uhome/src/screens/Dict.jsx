import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { DICT, DICT_LEVELS, DICT_NOTE, DICT_READ_MIN } from '../data/dictionary.js';
import { pinOf } from '../data/base.js';
import { plural } from '../lib/format.js';
import { TopBar, Search, Section, List, Item, Empty } from '../components/UI.jsx';
import Icon from '../components/Icons.jsx';

/* Словарь клуба — первый закреп базы. Разделы от устройства клуба к сделкам
   и AI; термин раскрывается по нажатию. Ева и Адам знают те же слова. */

const PIN = pinOf('dict');

export default function Dict() {
  const app = useApp();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState({});

  // открыли словарь — закреп считается изученным
  useEffect(() => {
    if (!app.watched.dict) app.watch('dict');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const s = q.trim().toLowerCase();
  const found = useMemo(() => (s ? DICT.filter((t) => `${t.term} ${t.full || ''} ${t.text}`.toLowerCase().includes(s)) : null), [s]);
  const toggle = (id) => setOpen((o) => ({ ...o, [id]: !o[id] }));

  return (
    <div className="screen screen--nested">
      <TopBar title="Словарь клуба" sub={`Закреп ${PIN?.n || '01'} · ${DICT_READ_MIN} мин`} backTo="/base" />

      <div className="stack-24">
        <div className="top" style={{ padding: 0 }}>
          <h1 className="h1">Словарь клуба</h1>
          <div className="top__sub" style={{ marginTop: 0 }}>{DICT.length} {plural(DICT.length, 'термин', 'термина', 'терминов')} в {DICT_LEVELS.length} разделах — чтобы все говорили на одном языке.</div>
        </div>

        <Search value={q} onChange={setQ} placeholder="KITAS, интро, SAFE…" />

        {found ? (
          found.length ? (
            <Section title="Нашлось" note={`${found.length} ${plural(found.length, 'термин', 'термина', 'терминов')}`}>
              <List>{found.map((t) => <Term key={t.id} t={t} open={found.length <= 3 || !!open[t.id]} onToggle={() => toggle(t.id)} />)}</List>
            </Section>
          ) : (
            <Empty title="Такого слова пока нет" text="Напишите команде — объясним и добавим в словарь для всех." />
          )
        ) : (
          DICT_LEVELS.map((l, i) => {
            const list = DICT.filter((t) => t.level === l.id);
            return (
              <Section key={l.id} eye={String(i + 1).padStart(2, '0')} title={l.title} note={l.sub}>
                <List>{list.map((t) => <Term key={t.id} t={t} open={!!open[t.id]} onToggle={() => toggle(t.id)} />)}</List>
                {l.id === 'move' && <div className="note-line">{DICT_NOTE}</div>}
              </Section>
            );
          })
        )}

        <Section title="Не хватает слова?">
          <List>
            <Item icon="message" title="Написать команде клуба" sub="Объясним и добавим в словарь" onClick={() => go('/chat/team')} />
            <Item icon="spark" title="Спросить ассистента" sub="Ответит на «что такое…» прямо сейчас" onClick={() => go('/ai')} />
          </List>
        </Section>
      </div>
    </div>
  );
}

/* Строка термина: название и полная форма; текст раскрывается по нажатию. */
function Term({ t, open, onToggle }) {
  return (
    <div className="b-term" data-open={open}>
      <button className="item" onClick={onToggle} aria-expanded={open}>
        <span className="item__body">
          <span className="item__t">{t.term}{t.full && <span className="b-term__f"> · {t.full}</span>}</span>
          {!open && <span className="item__s">{t.text}</span>}
        </span>
        <Icon name={open ? 'x' : 'plus'} size={15} className="chev" />
      </button>
      {open && <div className="b-term__x">{t.full && <div className="t-xs dim-2" style={{ marginBottom: 4 }}>{t.full}</div>}{t.text}</div>}
    </div>
  );
}
