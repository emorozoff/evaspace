import { useState } from 'react';
import { useStore, levelOf, totalStars, weekReport, referralIncome } from '../lib/store.jsx';
import { LEVELS, REFERRALS, COURSES } from '../data/content.js';
import { Avatar, StarField, TopBar, Sheet, Empty } from '../components/UI.jsx';
import { IcCrown, IcShare, IcCheck, IcLock, IcWallet, IcGift, IcNext, IcSettings, IcStar, IcSparkStar } from '../components/Icons.jsx';
import { go } from '../lib/router.jsx';

export default function Profile() {
  const { state, dispatch } = useStore();
  const lvl = levelOf(state.points);
  const stars = totalStars(state);
  const rep = weekReport(state);
  const income = referralIncome(REFERRALS);
  const [settings, setSettings] = useState(false);
  const [copied, setCopied] = useState(false);

  const refLink = `https://emorozoff.github.io/evaspace/#/join/${(state.name || 'eva').toLowerCase().replace(/[^a-zа-я0-9]/gi, '')}-star`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(refLink);
      setCopied(true);
      dispatch({ type: 'toast', value: 'Ссылка скопирована' });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      dispatch({ type: 'toast', value: refLink });
    }
  };

  return (
    <div className="screen">
      <div className="hero-dark">
        <StarField n={28} seed={13} />
        <TopBar
          title=""
          dark
          onBack={() => go('/home')}
          right={
            <button className="icon-btn" onClick={() => setSettings(true)}>
              <IcSettings size={19} />
            </button>
          }
        />
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'grid', placeItems: 'center', marginBottom: 12 }}>
            <Avatar name={state.name || 'Ты'} hue={330} size={82} ring />
          </div>
          <div className="serif" style={{ fontSize: 27 }}>{state.name || 'Гостья'}</div>
          <div style={{ marginTop: 8 }}>
            <span className="badge-lvl">
              <IcCrown size={14} /> {lvl.current.emoji} {lvl.current.name}
            </span>
          </div>

          {lvl.next && (
            <div style={{ margin: '18px 18px 0' }}>
              <div className="row between tiny" style={{ opacity: 0.85, marginBottom: 6 }}>
                <span>{state.points} баллов</span>
                <span>до «{lvl.next.name}»: {lvl.next.from - state.points}</span>
              </div>
              <div className="progress" style={{ background: 'rgba(255,255,255,.22)' }}>
                <i style={{ width: lvl.progress * 100 + '%', background: 'linear-gradient(90deg,#f6dfae,#e6a0c4)' }} />
              </div>
            </div>
          )}

          <div className="row" style={{ gap: 8, marginTop: 18 }}>
            <div className="stat glass" style={{ flex: 1 }}><b>{stars}</b><span>ЗВЁЗД</span></div>
            <div className="stat glass" style={{ flex: 1 }}><b>{rep.fullDays}</b><span>ПОЛНЫХ ДНЕЙ</span></div>
            <div className="stat glass" style={{ flex: 1 }}><b>{rep.minutes}</b><span>МИНУТ</span></div>
          </div>
        </div>
      </div>

      {/* ---------- кошелёк ---------- */}
      <div className="pad" style={{ marginTop: 18 }}>
        <div className="sect-head" style={{ marginTop: 0 }}>
          <div className="sect-title">Мои накопления</div>
        </div>
        <div className="card card-pad">
          <div className="row" style={{ gap: 12 }}>
            <span style={{ width: 42, height: 42, borderRadius: 14, background: 'var(--blush)', color: 'var(--rose-deep)', display: 'grid', placeItems: 'center', flex: 'none' }}>
              <IcStar size={20} />
            </span>
            <div style={{ flex: 1 }}>
              <div className="tiny muted">Баллы за практики</div>
              <b style={{ fontSize: 19 }}>{state.points.toLocaleString('ru-RU')}</b>
            </div>
          </div>
          <div className="divider" />
          <div className="row" style={{ gap: 12 }}>
            <span style={{ width: 42, height: 42, borderRadius: 14, background: '#fbeed3', color: 'var(--gold)', display: 'grid', placeItems: 'center', flex: 'none' }}>
              <IcGift size={20} />
            </span>
            <div style={{ flex: 1 }}>
              <div className="tiny muted">Бонусные рубли для маркета</div>
              <b style={{ fontSize: 19 }}>{state.bonus.toLocaleString('ru-RU')} ₽</b>
            </div>
            <button className="btn sm ghost" style={{ height: 32, fontSize: 12 }} onClick={() => go('/market')}>Потратить</button>
          </div>
          <div className="divider" />
          <div className="row" style={{ gap: 12 }}>
            <span style={{ width: 42, height: 42, borderRadius: 14, background: 'var(--lilac-soft)', color: '#5b3f7d', display: 'grid', placeItems: 'center', flex: 'none' }}>
              <IcWallet size={20} />
            </span>
            <div style={{ flex: 1 }}>
              <div className="tiny muted">Доход с приглашённых (10%)</div>
              <b style={{ fontSize: 19 }}>{income.toLocaleString('ru-RU')} ₽</b>
            </div>
          </div>
        </div>
      </div>

      {/* ---------- реферальная система ---------- */}
      <div className="pad">
        <div className="sect-head">
          <div className="sect-title">Зарабатывай вместе с Евой</div>
        </div>
        <div className="card card-pad" style={{ background: 'linear-gradient(120deg,#fdf1ec,#f0e4fb)' }}>
          <div className="small" style={{ lineHeight: 1.55 }}>
            Приглашай свою аудиторию по личной ссылке. С каждой покупки приглашённой ты получаешь процент, а она — скидку на первый курс.
          </div>
          <div className="card flat card-pad" style={{ marginTop: 12, background: '#fff', padding: 12 }}>
            <div className="tiny muted">Твоя ссылка</div>
            <div className="tiny" style={{ wordBreak: 'break-all', marginTop: 4, fontWeight: 700, color: 'var(--plum)' }}>{refLink}</div>
          </div>
          <button className="btn sm primary" style={{ width: '100%', marginTop: 12 }} onClick={copy}>
            <IcShare size={15} /> {copied ? 'Скопировано!' : 'Скопировать ссылку'}
          </button>
        </div>

        <div className="sect-head">
          <div className="sect-title" style={{ fontSize: 21 }}>Моя аудитория</div>
          <span className="tiny muted">{REFERRALS.length} человек</span>
        </div>
        <div className="stack">
          {REFERRALS.map((r) => (
            <div key={r.name} className="list-item">
              <Avatar name={r.name} hue={r.hue} size={40} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 14 }}>{r.name}</div>
                <div className="tiny muted">пришла {r.joined}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <b style={{ fontSize: 14, color: 'var(--ok)' }}>+{Math.round(r.spent * 0.1).toLocaleString('ru-RU')} ₽</b>
                <div className="tiny muted">с {r.spent.toLocaleString('ru-RU')} ₽</div>
              </div>
            </div>
          ))}
        </div>
        <div className="tiny muted" style={{ marginTop: 10, textAlign: 'center' }}>Демо-данные для показа механики</div>
      </div>

      {/* ---------- уровни ---------- */}
      <div className="pad">
        <div className="sect-head">
          <div className="sect-title">Статусы в системе</div>
        </div>
        <div className="stack">
          {LEVELS.map((l, i) => {
            const open = state.points >= l.from;
            return (
              <div key={l.id} className="card card-pad" style={{ opacity: open ? 1 : 0.72 }}>
                <div className="row between">
                  <div className="row" style={{ gap: 10 }}>
                    <span style={{ fontSize: 22 }}>{l.emoji}</span>
                    <div>
                      <b style={{ fontSize: 15 }}>{l.name}</b>
                      <div className="tiny muted">от {l.from.toLocaleString('ru-RU')} баллов</div>
                    </div>
                  </div>
                  {open ? <span className="tag green"><IcCheck size={11} style={{ marginRight: 3 }} /> открыт</span> : <span className="tag"><IcLock size={11} style={{ marginRight: 3 }} /> закрыт</span>}
                </div>
                <div className="divider" style={{ margin: '12px 0' }} />
                {l.perks.map((p) => (
                  <div key={p} className="row tiny" style={{ gap: 8, marginBottom: 6, color: open ? 'var(--ink)' : 'var(--muted)' }}>
                    <IcSparkStar size={12} style={{ color: 'var(--gold)' }} /> {p}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* ---------- заказы ---------- */}
      {(state.orders.length > 0 || state.purchases.length > 0) && (
        <div className="pad">
          <div className="sect-head">
            <div className="sect-title" style={{ fontSize: 21 }}>Мои покупки</div>
          </div>
          <div className="stack">
            {state.purchases.map((id) => {
              const c = COURSES.find((x) => x.id === id);
              if (!c) return null;
              return (
                <button key={id} className="list-item" style={{ width: '100%', textAlign: 'left' }} onClick={() => go(`/course/${id}`)}>
                  <span style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--lilac-soft)', display: 'grid', placeItems: 'center', flex: 'none' }}>🎓</span>
                  <div style={{ flex: 1 }}>
                    <div className="ttl" style={{ fontSize: 14 }}>{c.title}</div>
                    <div className="tiny muted">Курс · доступ навсегда</div>
                  </div>
                  <IcNext size={16} style={{ color: 'var(--muted)' }} />
                </button>
              );
            })}
            {state.orders.map((o) => (
              <div key={o.id} className="list-item">
                <span style={{ width: 40, height: 40, borderRadius: 12, background: '#fbeed3', display: 'grid', placeItems: 'center', flex: 'none' }}>🛍</span>
                <div style={{ flex: 1 }}>
                  <div className="ttl" style={{ fontSize: 14 }}>Заказ на {o.total.toLocaleString('ru-RU')} ₽</div>
                  <div className="tiny muted">{o.items.length} товара · оплачено бонусами {o.usedBonus} ₽</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ height: 10 }} />

      <Sheet open={settings} onClose={() => setSettings(false)} title="Настройки">
        <div className="pad" style={{ paddingBottom: 24 }}>
          <div className="stack">
            <button className="list-item" style={{ width: '100%' }} onClick={() => { setSettings(false); go('/onboarding'); }}>
              <span style={{ flex: 1, textAlign: 'left', fontWeight: 700, fontSize: 14 }}>Пройти тест заново</span>
              <IcNext size={16} style={{ color: 'var(--muted)' }} />
            </button>
            <button className="list-item" style={{ width: '100%' }} onClick={() => { dispatch({ type: 'rebuild' }); setSettings(false); }}>
              <span style={{ flex: 1, textAlign: 'left', fontWeight: 700, fontSize: 14 }}>Пересобрать программу</span>
              <IcNext size={16} style={{ color: 'var(--muted)' }} />
            </button>
            <button className="list-item" style={{ width: '100%' }} onClick={() => { setSettings(false); go('/admin'); }}>
              <span style={{ flex: 1, textAlign: 'left', fontWeight: 700, fontSize: 14 }}>Админка (загрузка контента)</span>
              <IcNext size={16} style={{ color: 'var(--muted)' }} />
            </button>
            <button
              className="list-item"
              style={{ width: '100%' }}
              onClick={() => {
                if (confirm('Удалить все данные и начать заново?')) {
                  dispatch({ type: 'reset' });
                  go('/onboarding');
                }
              }}
            >
              <span style={{ flex: 1, textAlign: 'left', fontWeight: 700, fontSize: 14, color: '#b64f7c' }}>Сбросить всё и начать заново</span>
            </button>
          </div>
          <div className="tiny muted" style={{ textAlign: 'center', marginTop: 16 }}>Eva Space · демо-версия MVP</div>
        </div>
      </Sheet>
    </div>
  );
}
