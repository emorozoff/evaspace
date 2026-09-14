import { useMemo, useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { PROMPTS, PROMPT_CATS } from '../data/prompts.js';
import { Btn, Empty, Field, Note, Search, Sheet, Tag, TopBar } from '../components/UI.jsx';
import Choice from '../components/Choice.jsx';
import Icon from '../components/Icons.jsx';

/* Библиотека промптов: то, чем в клубе пользуются каждую неделю.
   Устроена как словарь — по разделам, со своими добавлениями. */

export default function Prompts() {
  const { state } = useStore();
  const [query, setQuery] = useState('');
  const [add, setAdd] = useState(false);

  const all = useMemo(() => [...PROMPTS, ...(state.prompts || [])], [state.prompts]);
  const found = query.trim()
    ? all.filter((p) => `${p.title} ${p.about} ${p.text}`.toLowerCase().includes(query.trim().toLowerCase()))
    : null;

  return (
    <div className="screen" style={{ paddingTop: 0 }}>
      <TopBar
        title="Библиотека промптов"
        sub="Готовые запросы под рабочие задачи"
        backTo="/base"
        right={<button className="iconbtn iconbtn--accent" onClick={() => setAdd(true)} aria-label="Добавить промпт"><Icon name="plus" size={18} /></button>}
      />
      <div className="stack-20">
        <Search value={query} onChange={setQuery} placeholder="Найти промпт" />

        {found ? (
          found.length === 0 ? (
            <Empty icon="spark" title="Ничего не нашлось" text="Добавьте свой промпт — он появится у всех." action={<Btn variant="accent" size="sm" onClick={() => setAdd(true)}>Добавить</Btn>} />
          ) : (
            <div className="terms">{found.map((p) => <PromptRow key={p.id} prompt={p} />)}</div>
          )
        ) : (
          PROMPT_CATS.map((cat) => {
            const list = all.filter((p) => p.cat === cat.id);
            if (!list.length) return null;
            return (
              <section key={cat.id} className="stack-8">
                <div className="row" style={{ padding: '0 4px' }}>
                  <span className="code__ic"><Icon name={cat.icon} size={17} /></span>
                  <span className="grow">
                    <span className="t-lg">{cat.title}</span>
                    <span className="t-xs dim-2" style={{ display: 'block', marginTop: 1 }}>{cat.sub}</span>
                  </span>
                  <Tag>{list.length}</Tag>
                </div>
                <div className="terms">{list.map((p) => <PromptRow key={p.id} prompt={p} />)}</div>
              </section>
            );
          })
        )}

        <Note icon="spark">
          В квадратных скобках — то, что подставляете сами. Чем конкретнее подставите, тем меньше придётся переписывать за моделью.
        </Note>
      </div>

      <Sheet open={add} onClose={() => setAdd(false)} title="Свой промпт" sub="Тот, которым реально пользуетесь">
        {add && <AddForm onDone={() => setAdd(false)} />}
      </Sheet>
    </div>
  );
}

/** Строка промпта: раскрывается, текст копируется одним нажатием. */
function PromptRow({ prompt }) {
  const { me, dispatch } = useStore();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(prompt.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setOpen(true);
    }
  };

  return (
    <button className={`term${open ? ' term--on' : ''}`} onClick={() => setOpen(!open)}>
      <div className="row">
        <div className="grow" style={{ minWidth: 0 }}>
          <span className="term__t">{prompt.title}</span>
          <div className="t-xs dim-2" style={{ marginTop: 2 }}>{prompt.about}</div>
        </div>
        {prompt.userId && <Tag tone="violet">своё</Tag>}
        <Icon name={open ? 'down' : 'right'} size={15} className="chev" />
      </div>

      {open && (
        <>
          <div className="prompt__text">{prompt.text}</div>
          <div className="row" style={{ gap: 8, marginTop: 10 }}>
            <Btn variant={copied ? 'soft' : 'accent'} size="sm" icon={copied ? 'check' : 'share'} onClick={copy}>
              {copied ? 'Скопировано' : 'Скопировать'}
            </Btn>
            {prompt.userId === me.id && (
              <button className="t-xs dim-2" onClick={(e) => { e.stopPropagation(); dispatch({ type: 'promptDelete', id: prompt.id }); }}>
                Удалить
              </button>
            )}
          </div>
        </>
      )}
    </button>
  );
}

function AddForm({ onDone }) {
  const { dispatch } = useStore();
  const [title, setTitle] = useState('');
  const [about, setAbout] = useState('');
  const [text, setText] = useState('');
  const [cat, setCat] = useState([PROMPT_CATS[0].id]);

  return (
    <div className="stack">
      <Field label="Название"><input className="field" placeholder="Например, разбор отзыва клиента" value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
      <Field label="Что делает" hint="Одной строкой"><input className="field" placeholder="Вытаскивает из отзыва, что чинить первым" value={about} onChange={(e) => setAbout(e.target.value)} /></Field>
      <Field label="Текст промпта" hint="То, что подставляют сами, пишите в [квадратных скобках]">
        <textarea className="field" rows={6} value={text} onChange={(e) => setText(e.target.value)} />
      </Field>
      <Field label="Раздел">
        <Choice options={PROMPT_CATS.map((c) => ({ id: c.id, label: c.title, icon: c.icon }))} value={cat} max={1} onChange={setCat} list />
      </Field>
      <Btn
        variant="accent"
        wide
        disabled={title.trim().length < 3 || text.trim().length < 30}
        onClick={() => { dispatch({ type: 'promptAdd', title, about, text, cat: cat[0] }); onDone(); }}
      >
        Добавить в библиотеку
      </Btn>
    </div>
  );
}
