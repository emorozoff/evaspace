import { useMemo, useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { PRODUCT_CATS } from '../data/content.js';
import Art from '../components/Art.jsx';
import { TopBar, Price, Empty, Sheet } from '../components/UI.jsx';
import { IcCart, IcPlus, IcTrash, IcCheck, IcGift, IcNext } from '../components/Icons.jsx';
import { go } from '../lib/router.jsx';

/* ============ Маркет ============ */
export function Market() {
  const { state, dispatch, allProducts } = useStore();
  const [cat, setCat] = useState('Всё');
  const count = Object.values(state.cart).reduce((a, b) => a + b, 0);

  const list = useMemo(() => (cat === 'Всё' ? allProducts : allProducts.filter((p) => p.cat === cat)), [allProducts, cat]);

  return (
    <div className="screen">
      <div className="topbar">
        <div style={{ flex: 1 }}>
          <div className="eyebrow">Маркет</div>
          <h1 style={{ marginTop: 2 }}>Для твоих практик</h1>
        </div>
        <button className="icon-btn" onClick={() => go('/cart')} style={{ position: 'relative' }}>
          <IcCart size={20} />
          {count > 0 && (
            <span style={{ position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9, background: 'var(--rose-deep)', color: '#fff', fontSize: 10, fontWeight: 800, display: 'grid', placeItems: 'center', padding: '0 4px' }}>
              {count}
            </span>
          )}
        </button>
      </div>

      <div className="pad">
        <div className="card card-pad" style={{ background: 'linear-gradient(120deg,#fbeed3,#f7d8e6)' }}>
          <div className="row" style={{ gap: 12 }}>
            <span style={{ width: 40, height: 40, borderRadius: 14, background: 'rgba(255,255,255,.7)', display: 'grid', placeItems: 'center', color: 'var(--gold)', flex: 'none' }}>
              <IcGift size={20} />
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 14 }}>{state.bonus.toLocaleString('ru-RU')} ₽ бонусами</div>
              <div className="tiny muted" style={{ marginTop: 2 }}>Можно оплатить до 30% любого заказа</div>
            </div>
          </div>
        </div>
      </div>

      <div className="pad">
        <div className="chips scroll" style={{ marginTop: 14 }}>
          {PRODUCT_CATS.map((c) => (
            <button key={c} className={'chip' + (cat === c ? ' on' : '')} onClick={() => setCat(c)}>
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="pad" style={{ marginTop: 14 }}>
        <div className="grid-2">
          {list.map((p) => (
            <button key={p.id} className="card" style={{ textAlign: 'left' }} onClick={() => go(`/product/${p.id}`)}>
              <Art art={p.art} id={p.id} image={p.image} ratio="1-1">
                {p.badge && (
                  <div style={{ position: 'absolute', top: 8, left: 8 }}>
                    <span className="tag gold">{p.badge}</span>
                  </div>
                )}
              </Art>
              <div className="card-pad" style={{ padding: 12 }}>
                <div className="ttl" style={{ fontSize: 13.5, minHeight: 34 }}>{p.title}</div>
                <div style={{ marginTop: 8 }}>
                  <Price value={p.price} old={p.oldPrice} />
                </div>
                <button
                  className="btn sm primary"
                  style={{ width: '100%', marginTop: 10, height: 36 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    dispatch({ type: 'cart', id: p.id });
                  }}
                >
                  <IcPlus size={14} /> В корзину
                </button>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ============ Товар ============ */
export function ProductDetail({ id }) {
  const { state, dispatch, allProducts } = useStore();
  const p = allProducts.find((x) => x.id === id);
  if (!p) return <Empty emoji="🔍" title="Товар не найден" action={<button className="btn ghost sm" onClick={() => go('/market')}>В маркет</button>} />;
  const inCart = state.cart[p.id] || 0;

  return (
    <div className="screen no-nav">
      <div style={{ position: 'relative' }}>
        <Art art={p.art} id={p.id} image={p.image} ratio="1-1" />
        <button className="icon-btn" style={{ position: 'absolute', top: 'calc(var(--safe-t) + 12px)', left: 12, background: 'rgba(255,255,255,.85)' }} onClick={() => go('/market')}>‹</button>
      </div>

      <div className="pad" style={{ marginTop: 16 }}>
        <div className="row" style={{ gap: 8, marginBottom: 10 }}>
          <span className="tag">{p.cat}</span>
          {p.badge && <span className="tag gold">{p.badge}</span>}
          {p.custom && <span className="tag green">Добавлен через админку</span>}
        </div>
        <div className="sect-title" style={{ fontSize: 25 }}>{p.title}</div>
        <div style={{ marginTop: 10 }}>
          <Price value={p.price} old={p.oldPrice} />
        </div>

        {p.about && (
          <div className="card card-pad" style={{ marginTop: 16 }}>
            <div className="small" style={{ lineHeight: 1.6 }}>{p.about}</div>
          </div>
        )}

        <div className="card card-pad" style={{ marginTop: 12 }}>
          <div className="row between small">
            <span className="muted">Кэшбэк баллами</span>
            <b>+{Math.round(p.price / 100)} баллов</b>
          </div>
          <div className="divider" />
          <div className="row between small">
            <span className="muted">Можно оплатить бонусами</span>
            <b>до {Math.round(p.price * 0.3).toLocaleString('ru-RU')} ₽</b>
          </div>
        </div>

        <button className="btn primary" style={{ marginTop: 18 }} onClick={() => dispatch({ type: 'cart', id: p.id })}>
          <IcCart size={18} /> {inCart ? `В корзине: ${inCart} — добавить ещё` : 'Добавить в корзину'}
        </button>
        {inCart > 0 && (
          <button className="btn ghost" style={{ marginTop: 8 }} onClick={() => go('/cart')}>
            Перейти в корзину <IcNext size={16} />
          </button>
        )}
        <div style={{ height: 20 }} />
      </div>
    </div>
  );
}

/* ============ Корзина ============ */
export function Cart() {
  const { state, dispatch, allProducts } = useStore();
  const [useBonus, setUseBonus] = useState(true);
  const [done, setDone] = useState(false);

  const items = Object.entries(state.cart)
    .map(([id, qty]) => ({ p: allProducts.find((x) => x.id === id), qty }))
    .filter((x) => x.p);

  const total = items.reduce((s, { p, qty }) => s + p.price * qty, 0);
  const maxBonus = Math.min(state.bonus, Math.floor(total * 0.3));
  const used = useBonus ? maxBonus : 0;
  const toPay = total - used;

  if (done) {
    return (
      <div className="screen no-nav">
        <TopBar title="Заказ оформлен" onBack={() => go('/market')} />
        <div className="pad" style={{ textAlign: 'center', paddingTop: 40 }}>
          <div className="anim-pop" style={{ fontSize: 56 }}>🎁</div>
          <div className="sect-title" style={{ marginTop: 10 }}>Спасибо!</div>
          <div className="small muted" style={{ marginTop: 8, lineHeight: 1.6 }}>
            Это демо-заказ: платёжная система подключается на следующем этапе.
            <br />Баллы и бонусы уже начислены.
          </div>
          <button className="btn primary" style={{ marginTop: 24 }} onClick={() => go('/market')}>Вернуться в маркет</button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen no-nav">
      <TopBar title="Корзина" onBack={() => go('/market')} />
      <div className="pad">
        {items.length === 0 ? (
          <Empty emoji="🛍" title="Пока пусто" text="Загляни в маркет — там есть всё для практик" action={<button className="btn primary sm" onClick={() => go('/market')}>В маркет</button>} />
        ) : (
          <>
            <div className="stack">
              {items.map(({ p, qty }) => (
                <div key={p.id} className="list-item">
                  <div className="thumb"><Art art={p.art} id={p.id} image={p.image} ratio="1-1" /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="ttl" style={{ fontSize: 13.5 }}>{p.title}</div>
                    <div className="row" style={{ marginTop: 6, gap: 8 }}>
                      <button className="chip" style={{ height: 28, width: 28, padding: 0, justifyContent: 'center' }} onClick={() => dispatch({ type: 'cart', id: p.id, qty: -1 })}>−</button>
                      <b style={{ fontSize: 14, minWidth: 16, textAlign: 'center' }}>{qty}</b>
                      <button className="chip" style={{ height: 28, width: 28, padding: 0, justifyContent: 'center' }} onClick={() => dispatch({ type: 'cart', id: p.id, qty: 1 })}>+</button>
                      <span className="spacer" />
                      <b style={{ fontSize: 14 }}>{(p.price * qty).toLocaleString('ru-RU')} ₽</b>
                    </div>
                  </div>
                  <button className="icon-btn" style={{ width: 32, height: 32, color: 'var(--muted)' }} onClick={() => dispatch({ type: 'cartRemove', id: p.id })}>
                    <IcTrash size={16} />
                  </button>
                </div>
              ))}
            </div>

            <div className="card card-pad" style={{ marginTop: 14 }}>
              <button className="row between" style={{ width: '100%' }} onClick={() => setUseBonus(!useBonus)}>
                <span className="row" style={{ gap: 10 }}>
                  <span style={{ width: 24, height: 24, borderRadius: 8, display: 'grid', placeItems: 'center', background: useBonus ? 'linear-gradient(135deg,#f6dfae,#d5a45c)' : 'rgba(59,30,78,.08)', color: '#fff' }}>
                    {useBonus && <IcCheck size={14} />}
                  </span>
                  <span className="small" style={{ fontWeight: 700 }}>Списать бонусы</span>
                </span>
                <b style={{ fontSize: 14, color: 'var(--gold)' }}>−{maxBonus.toLocaleString('ru-RU')} ₽</b>
              </button>
              <div className="tiny muted" style={{ marginTop: 6, paddingLeft: 34 }}>Доступно {state.bonus.toLocaleString('ru-RU')} ₽, к списанию до 30% заказа</div>
              <div className="divider" />
              <div className="row between small"><span className="muted">Товары</span><span>{total.toLocaleString('ru-RU')} ₽</span></div>
              <div className="row between small" style={{ marginTop: 6 }}><span className="muted">Бонусы</span><span>−{used.toLocaleString('ru-RU')} ₽</span></div>
              <div className="row between" style={{ marginTop: 10 }}>
                <b>Итого</b>
                <b style={{ fontSize: 19 }}>{toPay.toLocaleString('ru-RU')} ₽</b>
              </div>
            </div>

            <button
              className="btn primary"
              style={{ marginTop: 16 }}
              onClick={() => {
                dispatch({ type: 'checkout', items: items.map(({ p, qty }) => ({ id: p.id, title: p.title, qty, price: p.price })), total: toPay, usedBonus: used });
                setDone(true);
              }}
            >
              Оформить заказ · {toPay.toLocaleString('ru-RU')} ₽
            </button>
            <div className="tiny muted" style={{ textAlign: 'center', marginTop: 10 }}>Демо-оплата: реальная касса подключается позже</div>
          </>
        )}
        <div style={{ height: 20 }} />
      </div>
    </div>
  );
}
