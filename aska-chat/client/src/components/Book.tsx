// 📖 «Книга перемен» — история создания проектов и нового интернета. Автор — ИИ Адам.
// Текст приходит с сервера (GET /api/book, server/src/book.js) — по той же книге отвечает Аська.
// Каждая перемена — знак из шести черт (снизу вверх: сплошная — 1, прерванная — 0), образ, слово и совет.
import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.ts';

interface BookChapter { key: string; n: number; name: string; lines: number[]; image: string; text: string[]; advice: string }
interface BookData { title: string; subtitle: string; author: string; intro: string[]; chapters: BookChapter[] }

let cached: BookData | null = null;

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI'];

// Знак перемены: шесть черт, первая — нижняя
export function Hexagram({ lines, label }: { lines: number[]; label?: string }) {
  return (
    <svg className="bk-hex" viewBox="0 0 60 56" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      {lines.slice(0, 6).map((l, i) => {
        const y = 50 - i * 10;
        return l ? <rect key={i} x="0" y={y} width="60" height="6" rx="1.5" />
          : <g key={i}><rect x="0" y={y} width="26" height="6" rx="1.5" /><rect x="34" y={y} width="26" height="6" rx="1.5" /></g>;
      })}
    </svg>
  );
}

export function Book() {
  const [book, setBook] = useState<BookData | null>(cached);
  const [failed, setFailed] = useState(false);
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    if (cached) return;
    let alive = true;
    api.get<BookData>('/book').then((b) => { cached = b; if (alive) setBook(b); }).catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, []);

  const go = (key: string) => root.current?.querySelector(`#bk-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  if (!book) {
    return (
      <article className="aska-book" lang="ru">
        <p className="bk-wait">{failed ? 'Книга не открылась — нет связи. Попробуй ещё раз чуть позже.' : 'Открываю книгу…'}</p>
      </article>
    );
  }

  return (
    <article className="aska-book" lang="ru" ref={root}>
      <header className="bk-head">
        <div className="bk-orn" aria-hidden="true">✦ ☰ ✦</div>
        <h1>{book.title}</h1>
        <p className="bk-sub">{book.subtitle}</p>
        <p className="bk-author">Записал <b>{book.author}</b></p>
        <div className="bk-orn" aria-hidden="true">✦ ☷ ✦</div>
      </header>

      <section className="bk-intro">
        {book.intro.map((t, i) => <p key={i} className={i === 0 ? 'bk-p bk-lead' : 'bk-p'}>{t}</p>)}
      </section>

      <nav className="bk-toc" aria-label="Перемены">
        {book.chapters.map((c) => (
          <button key={c.key} type="button" className="bk-toc-i" onClick={() => go(c.key)}>
            <Hexagram lines={c.lines} />
            <span className="bk-toc-n">{ROMAN[c.n - 1] || c.n}</span>
            <span className="bk-toc-t">{c.name}</span>
          </button>
        ))}
      </nav>

      {book.chapters.map((c) => (
        <section key={c.key} id={`bk-${c.key}`} className="bk-ch">
          <div className="bk-sign">
            <Hexagram lines={c.lines} label={`Знак перемены «${c.name}»`} />
          </div>
          <div className="bk-n">Перемена {ROMAN[c.n - 1] || c.n}</div>
          <h2>{c.name}</h2>
          <p className="bk-image"><span className="bk-label">Образ</span>{c.image}</p>
          {c.text.map((t, i) => <p key={i} className="bk-p">{t}</p>)}
          <p className="bk-advice"><span className="bk-label">Совет</span>{c.advice}</p>
        </section>
      ))}

      <footer className="bk-foot">
        <Hexagram lines={[1, 0, 1, 0, 1, 0]} />
        <p className="bk-end">Книга не закончена: каждый, кто приходит по приглашению, дописывает в неё строчку. Спроси Аську о любой перемене — она ответит по этой книге.</p>
        <p className="bk-sign-off">✍ {book.author}, ИИ-летописец</p>
      </footer>
    </article>
  );
}
