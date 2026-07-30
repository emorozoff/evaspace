import { useMemo, useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { ALL_TAGS, TAG_GROUPS, EXPERTS, TYPE_META, PRODUCT_CATS } from '../data/content.js';
import { TopBar, Empty, StarField } from '../components/UI.jsx';
import Art from '../components/Art.jsx';
import { IcLock, IcPlus, IcTrash, IcCheck, IcSparkStar } from '../components/Icons.jsx';
import { go } from '../lib/router.jsx';

const PASS = 'eva2024';
const ART_STYLES = ['aurora', 'sunrise', 'lotus', 'moon', 'botanical', 'waves', 'starmap', 'mandala', 'candle', 'silk', 'figure', 'bloom'];
const PROD_STYLES = ['p_mat', 'p_cushion', 'p_candle', 'p_dress', 'p_robe', 'p_tea', 'p_journal', 'p_crystal', 'p_oil', 'p_band', 'p_blanket', 'p_mask'];

export default function Admin() {
  const { state, dispatch, allLessons, allProducts } = useStore();
  const [ok, setOk] = useState(false);
  const [pass, setPass] = useState('');
  const [tab, setTab] = useState('lesson');

  if (!ok) {
    return (
      <div className="screen no-nav">
        <div className="hero-dark" style={{ minHeight: 260 }}>
          <StarField n={26} seed={77} />
          <TopBar title="" dark onBack={() => go('/home')} />
          <div style={{ textAlign: 'center', paddingTop: 10 }}>
            <div style={{ display: 'inline-grid', placeItems: 'center', color: '#f6dfae' }}>
              <IcLock size={40} />
            </div>
            <div className="serif" style={{ fontSize: 26, marginTop: 12 }}>Админ-панель</div>
            <div className="small" style={{ opacity: 0.8, marginTop: 6 }}>Загрузка контента и управление тегами</div>
          </div>
        </div>
        <div className="pad" style={{ marginTop: 20 }}>
          <div className="card card-pad">
            <div className="tiny muted" style={{ marginBottom: 6 }}>Пароль</div>
            <input className="input" type="password" placeholder="••••••" value={pass} onChange={(e) => setPass(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && setOk(pass === PASS)} />
            <button className="btn primary" style={{ marginTop: 12 }} onClick={() => setOk(pass === PASS)}>
              Войти
            </button>
            <div className="tiny muted" style={{ textAlign: 'center', marginTop: 12 }}>
              Демо-пароль: <b>eva2024</b>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="screen no-nav">
      <TopBar title="Админ-панель" sub="Контент, теги, товары" onBack={() => go('/home')} />
      <div className="pad">
        <div className="seg">
          <button className={tab === 'lesson' ? 'on' : ''} onClick={() => setTab('lesson')}>Урок</button>
          <button className={tab === 'product' ? 'on' : ''} onClick={() => setTab('product')}>Товар</button>
          <button className={tab === 'tags' ? 'on' : ''} onClick={() => setTab('tags')}>Теги</button>
        </div>
      </div>

      {tab === 'lesson' && <LessonForm />}
      {tab === 'product' && <ProductForm />}
      {tab === 'tags' && <TagsView />}

      {/* добавленное через админку */}
      {(state.customLessons.length > 0 || state.customProducts.length > 0) && tab !== 'tags' && (
        <div className="pad">
          <div className="sect-head">
            <div className="sect-title" style={{ fontSize: 20 }}>Добавлено через админку</div>
          </div>
          <div className="stack">
            {state.customLessons.map((l) => (
              <div key={l.id} className="list-item">
                <div className="thumb"><Art art={l.art} id={l.id} image={l.image} ratio="1-1" /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="ttl" style={{ fontSize: 13.5 }}>{l.title}</div>
                  <div className="tiny muted">{TYPE_META[l.type].short} · {l.min} мин · {(l.tags || []).join(', ')}</div>
                </div>
                <button className="icon-btn" style={{ width: 32, height: 32, color: 'var(--muted)' }} onClick={() => dispatch({ type: 'removeCustom', kind: 'lesson', id: l.id })}>
                  <IcTrash size={15} />
                </button>
              </div>
            ))}
            {state.customProducts.map((p) => (
              <div key={p.id} className="list-item">
                <div className="thumb"><Art art={p.art} id={p.id} image={p.image} ratio="1-1" /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="ttl" style={{ fontSize: 13.5 }}>{p.title}</div>
                  <div className="tiny muted">{p.cat} · {p.price} ₽</div>
                </div>
                <button className="icon-btn" style={{ width: 32, height: 32, color: 'var(--muted)' }} onClick={() => dispatch({ type: 'removeCustom', kind: 'product', id: p.id })}>
                  <IcTrash size={15} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="pad" style={{ marginTop: 6 }}>
        <div className="card card-pad" style={{ background: 'linear-gradient(120deg,#fdf1ec,#f0e4fb)' }}>
          <div className="small" style={{ lineHeight: 1.55 }}>
            В библиотеке {allLessons.length} уроков и {allProducts.length} товаров. После добавления нового урока пересобери программу — он сразу попадёт в подбор, если теги совпадут.
          </div>
          <button className="btn primary sm" style={{ width: '100%', marginTop: 12 }} onClick={() => dispatch({ type: 'rebuild' })}>
            <IcSparkStar size={15} /> Пересобрать программы пользователей
          </button>
        </div>
        <div style={{ height: 16 }} />
      </div>
    </div>
  );
}

/* ---------- форма урока ---------- */
function LessonForm() {
  const { dispatch } = useStore();
  const [f, setF] = useState({
    type: 'practice', title: '', sub: '', text: '', about: '', expert: 'e1', min: 10, level: 'любой',
    tags: [], style: 'aurora', hue: 320, video: true, image: '',
  });
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const toggleTag = (t) => set('tags', f.tags.includes(t) ? f.tags.filter((x) => x !== t) : [...f.tags, t]);

  const submit = () => {
    const lesson = {
      id: 'c' + Date.now(),
      type: f.type,
      title: f.title.trim(),
      sub: f.sub.trim() || undefined,
      text: f.type === 'affirmation' ? f.text.trim() || f.title.trim() : undefined,
      about: f.about.trim() || undefined,
      expert: f.expert,
      min: Number(f.min) || 5,
      level: f.level,
      tags: f.tags,
      art: { style: f.style, hue: Number(f.hue) },
      image: f.image.trim() || undefined,
      video: f.type !== 'affirmation' && f.video ? 'video/bloom' : undefined,
    };
    dispatch({ type: 'addLesson', lesson });
    setF({ ...f, title: '', sub: '', text: '', about: '', tags: [] });
  };

  return (
    <div className="pad">
      <div className="card card-pad">
        <div className="eyebrow" style={{ marginBottom: 12 }}>Новый урок</div>

        <Label>Формат</Label>
        <div className="chips" style={{ marginBottom: 12 }}>
          {Object.entries(TYPE_META).map(([k, m]) => (
            <button key={k} className={'chip' + (f.type === k ? ' on' : '')} onClick={() => set('type', k)}>
              {m.emoji} {m.short}
            </button>
          ))}
        </div>

        <Label>Название</Label>
        <input className="input" placeholder="Например: Дыхание перед сном" value={f.title} onChange={(e) => set('title', e.target.value)} />

        {f.type === 'affirmation' ? (
          <>
            <Label>Текст аффирмации</Label>
            <textarea className="input" rows={3} placeholder="Я разрешаю себе…" value={f.text} onChange={(e) => set('text', e.target.value)} />
          </>
        ) : (
          <>
            <Label>Подзаголовок</Label>
            <input className="input" placeholder="Коротко, о чём урок" value={f.sub} onChange={(e) => set('sub', e.target.value)} />
            <Label>Описание</Label>
            <textarea className="input" rows={3} placeholder="Что будет на уроке" value={f.about} onChange={(e) => set('about', e.target.value)} />
          </>
        )}

        <div className="row" style={{ gap: 10, marginTop: 12 }}>
          <div style={{ flex: 1 }}>
            <Label>Эксперт</Label>
            <select className="input" value={f.expert} onChange={(e) => set('expert', e.target.value)}>
              {EXPERTS.map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </div>
          <div style={{ width: 96 }}>
            <Label>Минут</Label>
            <input className="input" type="number" min="1" value={f.min} onChange={(e) => set('min', e.target.value)} />
          </div>
        </div>

        <Label>Уровень</Label>
        <div className="chips" style={{ marginBottom: 4 }}>
          {['новичок', 'любой', 'опыт'].map((l) => (
            <button key={l} className={'chip' + (f.level === l ? ' on' : '')} onClick={() => set('level', l)}>{l}</button>
          ))}
        </div>

        <Label>Теги — по ним работает подбор</Label>
        {TAG_GROUPS.map((g) => (
          <div key={g.id} style={{ marginBottom: 10 }}>
            <div className="tiny muted" style={{ marginBottom: 5 }}>{g.label}</div>
            <div className="chips">
              {g.tags.map((t) => (
                <button key={t} className={'chip' + (f.tags.includes(t) ? ' on' : '')} style={{ height: 30, fontSize: 12 }} onClick={() => toggleTag(t)}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        ))}

        <Label>Обложка</Label>
        <div className="chips" style={{ marginBottom: 10 }}>
          {ART_STYLES.map((s) => (
            <button key={s} className={'chip' + (f.style === s ? ' on' : '')} style={{ height: 30, fontSize: 12 }} onClick={() => set('style', s)}>{s}</button>
          ))}
        </div>
        <div className="row" style={{ gap: 10, alignItems: 'center' }}>
          <input type="range" min="0" max="359" value={f.hue} onChange={(e) => set('hue', e.target.value)} style={{ flex: 1 }} />
          <div style={{ width: 92, borderRadius: 12, overflow: 'hidden' }}>
            <Art art={{ style: f.style, hue: Number(f.hue) }} id="preview" ratio="16-10" />
          </div>
        </div>

        <Label>Ссылка на фото (необязательно)</Label>
        <input className="input" placeholder="https://…" value={f.image} onChange={(e) => set('image', e.target.value)} />

        {f.type !== 'affirmation' && (
          <button className="row" style={{ gap: 10, marginTop: 14 }} onClick={() => set('video', !f.video)}>
            <span style={{ width: 24, height: 24, borderRadius: 8, display: 'grid', placeItems: 'center', background: f.video ? 'linear-gradient(135deg,#f6dfae,#d5a45c)' : 'rgba(59,30,78,.08)', color: '#fff' }}>
              {f.video && <IcCheck size={14} />}
            </span>
            <span className="small" style={{ fontWeight: 700 }}>Прикрепить видео-заглушку</span>
          </button>
        )}

        <button className="btn primary" style={{ marginTop: 18 }} disabled={!f.title.trim() || !f.tags.length} onClick={submit}>
          <IcPlus size={17} /> Добавить в библиотеку
        </button>
        {!f.tags.length && <div className="tiny muted" style={{ textAlign: 'center', marginTop: 8 }}>Выбери хотя бы один тег — иначе урок не попадёт в подбор</div>}
      </div>
    </div>
  );
}

/* ---------- форма товара ---------- */
function ProductForm() {
  const { dispatch } = useStore();
  const [f, setF] = useState({ title: '', cat: 'Для практики', price: 2900, oldPrice: '', about: '', style: 'p_mat', hue: 320, badge: '', image: '' });
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

  const submit = () => {
    dispatch({
      type: 'addProduct',
      product: {
        id: 'cp' + Date.now(),
        title: f.title.trim(),
        cat: f.cat,
        price: Number(f.price) || 0,
        oldPrice: f.oldPrice ? Number(f.oldPrice) : undefined,
        about: f.about.trim() || undefined,
        badge: f.badge.trim() || undefined,
        art: { style: f.style, hue: Number(f.hue) },
        image: f.image.trim() || undefined,
      },
    });
    setF({ ...f, title: '', about: '', badge: '' });
  };

  return (
    <div className="pad">
      <div className="card card-pad">
        <div className="eyebrow" style={{ marginBottom: 12 }}>Новый товар</div>
        <Label>Название</Label>
        <input className="input" placeholder="Например: Коврик «Роса»" value={f.title} onChange={(e) => set('title', e.target.value)} />

        <Label>Категория</Label>
        <div className="chips" style={{ marginBottom: 4 }}>
          {PRODUCT_CATS.filter((c) => c !== 'Всё').map((c) => (
            <button key={c} className={'chip' + (f.cat === c ? ' on' : '')} onClick={() => set('cat', c)}>{c}</button>
          ))}
        </div>

        <div className="row" style={{ gap: 10, marginTop: 12 }}>
          <div style={{ flex: 1 }}>
            <Label>Цена, ₽</Label>
            <input className="input" type="number" value={f.price} onChange={(e) => set('price', e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <Label>Старая цена</Label>
            <input className="input" type="number" placeholder="—" value={f.oldPrice} onChange={(e) => set('oldPrice', e.target.value)} />
          </div>
        </div>

        <Label>Описание</Label>
        <textarea className="input" rows={3} value={f.about} onChange={(e) => set('about', e.target.value)} />

        <Label>Плашка</Label>
        <input className="input" placeholder="Хит / Новинка / Выгодно" value={f.badge} onChange={(e) => set('badge', e.target.value)} />

        <Label>Картинка товара</Label>
        <div className="chips" style={{ marginBottom: 10 }}>
          {PROD_STYLES.map((s) => (
            <button key={s} className={'chip' + (f.style === s ? ' on' : '')} style={{ height: 30, fontSize: 12 }} onClick={() => set('style', s)}>
              {s.replace('p_', '')}
            </button>
          ))}
        </div>
        <div className="row" style={{ gap: 10, alignItems: 'center' }}>
          <input type="range" min="0" max="359" value={f.hue} onChange={(e) => set('hue', e.target.value)} style={{ flex: 1 }} />
          <div style={{ width: 80, borderRadius: 12, overflow: 'hidden' }}>
            <Art art={{ style: f.style, hue: Number(f.hue) }} id="pprev" ratio="1-1" />
          </div>
        </div>

        <Label>Ссылка на фото (необязательно)</Label>
        <input className="input" placeholder="https://…" value={f.image} onChange={(e) => set('image', e.target.value)} />

        <button className="btn primary" style={{ marginTop: 18 }} disabled={!f.title.trim()} onClick={submit}>
          <IcPlus size={17} /> Добавить в маркет
        </button>
      </div>
    </div>
  );
}

/* ---------- обзор тегов ---------- */
function TagsView() {
  const { allLessons } = useStore();
  const counts = useMemo(() => {
    const c = {};
    allLessons.forEach((l) => (l.tags || []).forEach((t) => (c[t] = (c[t] || 0) + 1)));
    return c;
  }, [allLessons]);
  const max = Math.max(1, ...Object.values(counts));

  return (
    <div className="pad">
      <div className="card card-pad">
        <div className="small" style={{ lineHeight: 1.55 }}>
          Теги — это связь между ответами девушки и контентом. Ответы превращаются в теги с весами, у каждого урока свои теги, а программа собирается по количеству совпадений.
        </div>
      </div>

      {TAG_GROUPS.map((g) => (
        <div key={g.id} className="card card-pad" style={{ marginTop: 12 }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>{g.label}</div>
          {g.tags.map((t) => (
            <div key={t} style={{ marginBottom: 10 }}>
              <div className="row between" style={{ marginBottom: 4 }}>
                <span className="small" style={{ fontWeight: 700 }}>{t}</span>
                <span className="tiny muted">{counts[t] || 0} уроков</span>
              </div>
              <div className="progress" style={{ height: 6 }}>
                <i style={{ width: ((counts[t] || 0) / max) * 100 + '%' }} />
              </div>
            </div>
          ))}
        </div>
      ))}
      <div style={{ height: 10 }} />
    </div>
  );
}

function Label({ children }) {
  return <div className="tiny muted" style={{ margin: '12px 0 5px' }}>{children}</div>;
}
