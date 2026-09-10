import { useMemo, useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { DICT, DICT_LEVELS } from '../data/dictionary.js';
import { termsOf } from '../lib/logic.js';
import { Btn, Empty, Field, Note, Search, Sheet, Tag, TopBar } from '../components/UI.jsx';
import Choice from '../components/Choice.jsx';
import Icon from '../components/Icons.jsx';

/* Гайд-словарь: чтобы все в клубе говорили на одном языке.
   Разделы идут от лёгкого к сложному, свои слова участники добавляют сами. */

export default function Dict() {
  const { state } = useStore();
  const [query, setQuery] = useState('');
  const [add, setAdd] = useState(false);

  const all = useMemo(() => [...DICT, ...termsOf(state)], [state]);
  const found = query.trim()
    ? all.filter((t) => `${t.term} ${t.full} ${t.text}`.toLowerCase().includes(query.trim().toLowerCase()))
    : null;

  return (
    <div className="screen" style={{ paddingTop: 0 }}>
      <TopBar
        title="Словарь клуба"
        sub="Чтобы все говорили на одном языке"
        backTo="/base"
        right={<button className="iconbtn iconbtn--accent" onClick={() => setAdd(true)} aria-label="Добавить слово"><Icon name="plus" size={18} /></button>}
      />
      <div className="stack-20">
        <Search value={query} onChange={setQuery} placeholder="Найти слово" />

        {found ? (
          found.length === 0 ? (
            <Empty icon="abc" title="Такого слова нет" text="Добавьте его сами — оно появится у всех." action={<Btn variant="accent" size="sm" onClick={() => setAdd(true)}>Добавить слово</Btn>} />
          ) : (
            <div className="terms">{found.map((t) => <Term key={t.id} term={t} />)}</div>
          )
        ) : (
          DICT_LEVELS.map((level) => {
            const list = all.filter((t) => t.level === level.id);
            if (!list.length) return null;
            return (
              <section key={level.id} className="stack-8">
                <div style={{ padding: '0 4px' }}>
                  <div className="hdr" style={{ padding: 0 }}>{level.title}</div>
                  <div className="t-xs dim-2" style={{ marginTop: 3 }}>{level.sub}</div>
                </div>
                <div className="terms">{list.map((t) => <Term key={t.id} term={t} />)}</div>
              </section>
            );
          })
        )}

        <Note icon="spark">
          Не хватает слова — добавьте его. Оно сразу появится у всех участников: словарь общий, как и язык клуба.
        </Note>
      </div>

      <Sheet open={add} onClose={() => setAdd(false)} title="Своё слово" sub="Объясните так, как объяснили бы другу">
        {add && <AddForm onDone={() => setAdd(false)} />}
      </Sheet>
    </div>
  );
}

/** Карточка слова: термин, расшифровка и объяснение простыми словами. */
function Term({ term }) {
  const { me, dispatch } = useStore();
  const [open, setOpen] = useState(false);
  return (
    <button className={`term${open ? ' term--on' : ''}`} onClick={() => setOpen(!open)}>
      <div className="row">
        <div className="grow" style={{ minWidth: 0 }}>
          <span className="term__t">{term.term}</span>
          {term.full && <span className="term__f"> · {term.full}</span>}
        </div>
        {term.userId && <Tag tone="violet">своё</Tag>}
        <Icon name={open ? 'down' : 'right'} size={15} className="chev" />
      </div>
      {open && <div className="term__x">{term.text}</div>}
      {open && term.userId === me.id && (
        <button className="t-xs dim-2" style={{ marginTop: 10 }} onClick={(e) => { e.stopPropagation(); dispatch({ type: 'termDelete', id: term.id }); }}>
          Удалить слово
        </button>
      )}
    </button>
  );
}

function AddForm({ onDone }) {
  const { dispatch } = useStore();
  const [term, setTerm] = useState('');
  const [full, setFull] = useState('');
  const [text, setText] = useState('');
  const [level, setLevel] = useState(['base']);

  return (
    <div className="stack">
      <Field label="Слово"><input className="field" placeholder="Например, ретеншн" value={term} onChange={(e) => setTerm(e.target.value)} /></Field>
      <Field label="Расшифровка" hint="Необязательно"><input className="field" placeholder="Retention, удержание" value={full} onChange={(e) => setFull(e.target.value)} /></Field>
      <Field label="Что это значит"><textarea className="field" placeholder="Своими словами, без учебника" value={text} onChange={(e) => setText(e.target.value)} /></Field>
      <Field label="В какой раздел">
        <Choice options={DICT_LEVELS.map((l) => ({ id: l.id, label: l.title, icon: 'abc' }))} value={level} max={1} onChange={setLevel} list />
      </Field>
      <Btn
        variant="accent"
        wide
        disabled={term.trim().length < 2 || text.trim().length < 10}
        onClick={() => { dispatch({ type: 'termAdd', term, full, text, level: level[0] }); onDone(); }}
      >
        Добавить в словарь
      </Btn>
    </div>
  );
}
