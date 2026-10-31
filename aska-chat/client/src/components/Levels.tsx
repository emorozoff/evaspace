// 🎖 Уровни: Гость → Голд → Блэк. Что открыто сейчас, что даст следующий уровень (про Блэк — только намёк,
// пока не позовут), обмен аськоинов (Голд, номера, НФТ, скидки), VIP-регион 777/888, пропуск UPASS и приглашения в Блэк.
import { useEffect, useState } from 'react';
import { useStore } from '../useStore.ts';
import { refreshState, openDm } from '../lib/store.ts';
import type { Tier, User } from '../lib/store.ts';
import { getLevels, buyGold, setVipRegion, inviteBlack, acceptBlack, setPlace } from '../lib/levels.ts';
import type { Levels as LevelsData } from '../lib/levels.ts';
import { ApiError } from '../lib/api.ts';
import { PLACES, VIP_REGIONS, placeOf, rememberPlace } from '../lib/places.ts';
import { Dialog } from './Win.tsx';
import { Plate, UserPlate } from './Plate.tsx';

const RANK: Record<Tier, number> = { guest: 0, gold: 1, black: 2 };
export const TIER_LOOK: Record<Tier, { name: string; emoji: string; cls: string }> = {
  guest: { name: 'Гость', emoji: '👤', cls: 'guest' }, gold: { name: 'Голд', emoji: '⭐', cls: 'gold' }, black: { name: 'Блэк', emoji: '🖤', cls: 'black' },
};
const day = (ts: number) => new Date(ts).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });

export function TierBadge({ tier }: { tier?: Tier }) {
  const t = TIER_LOOK[tier || 'guest'];
  return <span className={`aska-tier ${t.cls}`}>{t.emoji} {t.name}</span>;
}

// «Где я сейчас»: место — это регион на номере
export function PlacePicker({ onClose }: { onClose: () => void }) {
  const s = useStore();
  const me = s.users[s.me!.userId];
  const [busy, setBusy] = useState('');
  async function pick(key: string) {
    setBusy(key);
    rememberPlace(key);
    try { await setPlace(key); await refreshState(); onClose(); } catch { setBusy(''); }
  }
  return (
    <Dialog title="📍 Где ты сейчас?" onClose={onClose}>
      <div className="hint">Регион на твоём номере — это место, где ты сейчас.{me?.vipRegion ? ` У тебя VIP-регион ${me.vipRegion} — место видно в карточке.` : ''}</div>
      <div className="aska-places">
        {PLACES.map((p) => (
          <button key={p.key} className={`aska-place${me?.place === p.key ? ' on' : ''}`} disabled={!!busy} onClick={() => pick(p.key)}>
            <span className="fl">{p.flag}</span><b>{p.name}</b><code>{p.code}</code>
          </button>
        ))}
      </div>
    </Dialog>
  );
}

// VIP-регион: у Голд и Блэк на номере 777 или 888
export function VipPicker({ onClose, first }: { onClose: () => void; first?: boolean }) {
  const s = useStore();
  const me = s.users[s.me!.userId];
  const [busy, setBusy] = useState(false);
  async function pick(r: string) {
    setBusy(true);
    try { await setVipRegion(r); await refreshState(); onClose(); } catch { setBusy(false); }
  }
  return (
    <Dialog title={first ? '⭐ Ты на уровне Голд — выбери регион' : '⭐ VIP-регион'} onClose={onClose}>
      <div className="hint">{first ? 'У Голд и Блэк на номере вместо места — VIP-регион. Выбери свой:' : 'Какой регион показывать на номере:'}</div>
      <div className="aska-vip-pick">
        {VIP_REGIONS.map((r) => (
          <button key={r} className={`aska-vip${me?.vipRegion === r ? ' on' : ''}`} disabled={busy} onClick={() => pick(r)}>
            {me?.plate && <Plate plate={me.plate} country="RU" size="l" region={{ code: r, flag: '🇷🇺', vip: true, ru: true }} />}
            <b>{r}</b><small>{r === '777' ? 'три семёрки — удача' : 'три восьмёрки — богатство'}</small>
          </button>
        ))}
      </div>
    </Dialog>
  );
}

export function Levels({ onAux, onOpen }: { onAux: (k: 'plates' | 'night' | 'network' | 'rules' | 'invite') => void; onOpen: (chatId: string) => void }) {
  const s = useStore();
  const [lv, setLv] = useState<LevelsData | null>(null);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [vip, setVip] = useState(false);
  const [place, setPlaceOpen] = useState(false);
  const [blackTo, setBlackTo] = useState(false);
  const me = s.users[s.me!.userId];
  const load = () => getLevels().then(setLv).catch(() => setError('Не получилось загрузить. Проверь интернет.'));
  useEffect(() => { load(); }, []);
  if (!lv) return <div className="hint">{error || 'Загружаю…'}</div>;
  const rank = RANK[lv.tier];
  const goldPaid = lv.tier === 'gold' && lv.tierUntil;

  async function act(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    setError('');
    setNote('');
    try { await fn(); await refreshState(); await load(); setNote(ok); } catch (e) {
      const code = e instanceof ApiError ? e.code : '';
      setError(code === 'no_coins' ? `Не хватает аськоинов: нужно ${lv!.gold.price} 🪙.` : code === 'already' ? 'У тебя уже есть этот уровень.' : 'Не получилось. Попробуй ещё раз.');
    } finally { setBusy(false); }
  }

  return (
    <>
      <div className={`aska-tier-hero ${TIER_LOOK[lv.tier].cls}`}>
        <span className="em">{TIER_LOOK[lv.tier].emoji}</span>
        <span className="t">
          <small>Твой уровень</small>
          <b>{TIER_LOOK[lv.tier].name}</b>
          <span>{lv.tier === 'gold' && lv.tierUntil ? `до ${day(lv.tierUntil)}` : lv.tier === 'gold' ? 'навсегда' : lv.tier === 'black' ? 'по приглашению' : 'бесплатно'} · 🪙 {lv.coins} · 🕸 {lv.netSize}</span>
        </span>
        <span className="pl"><UserPlate user={me} size="m" /></span>
      </div>

      {lv.blackInvites.map((inv) => (
        <div key={inv.id} className="aska-black-invite">
          <b>🖤 {inv.fromName} зовёт тебя в Блэк</b>
          <span>Закрытый уровень: чёрная карта, закрытый чат, пропуск UPASS.</span>
          <button className="btn primary" disabled={busy} onClick={() => act(() => acceptBlack(inv.id), 'Добро пожаловать в Блэк 🖤')}>Принять</button>
        </div>
      ))}

      <div className="aska-ladder">
        {lv.tiers.map((t) => {
          const r = RANK[t.key];
          const teaser = r > rank + 1 || (t.key === 'black' && rank < 1); // Блэк — намёком, пока не Голд
          return (
            <div key={t.key} className={`aska-rung ${TIER_LOOK[t.key].cls}${r === rank ? ' cur' : ''}${r < rank ? ' done' : ''}`}>
              <div className="rh"><span>{t.emoji}</span><b>{t.name}</b>{r === rank && <em>ты здесь</em>}{r < rank && <em>✓</em>}</div>
              <ul>
                {(teaser ? t.perks.slice(0, 2) : t.perks).map((p) => <li key={p}>{p}</li>)}
                {teaser && <li className="lock">🔒 …и ещё кое-что — откроется, когда позовут</li>}
              </ul>
              {t.key === 'gold' && rank === 0 && (
                <div className="rung-go">
                  <div className="aska-prog"><i style={{ width: `${Math.min(100, (lv.coins / lv.gold.price) * 100)}%` }} /><span>🪙 {lv.coins} из {lv.gold.price}</span></div>
                  <div className="aska-prog"><i style={{ width: `${Math.min(100, (lv.netSize / lv.gold.net) * 100)}%` }} /><span>🕸 {lv.netSize} из {lv.gold.net} в нетворке — Голд навсегда</span></div>
                  <button className="btn primary aska-wide" disabled={busy || lv.coins < lv.gold.price} onClick={() => act(buyGold, 'Ты Голд! ⭐ Выбери VIP-регион ниже')}>⭐ Голд на {lv.gold.days} дней — {lv.gold.price} 🪙</button>
                </div>
              )}
              {t.key === 'gold' && goldPaid && (
                <button className="btn aska-wide" disabled={busy || lv.coins < lv.gold.price} onClick={() => act(buyGold, `Голд продлён ещё на ${lv.gold.days} дней ⭐`)}>Продлить на {lv.gold.days} дней — {lv.gold.price} 🪙</button>
              )}
              {t.key === 'black' && rank < 2 && <div className="hint">Блэк не покупается — только по приглашению Блэк или администрации.</div>}
            </div>
          );
        })}
      </div>
      {error && <div className="err">{error}</div>}
      {note && <div className="aska-note">{note}</div>}

      <div className="groupbox">
        <div className="legend">🚗 Номер и регион</div>
        <div className="row aska-kv"><span>📍 Где я</span><b>{placeOf(me?.place)?.flag} {placeOf(me?.place)?.name || '—'}</b><span className="sp" /><button className="btn" onClick={() => setPlaceOpen(true)}>Сменить</button></div>
        {rank >= 1 && <div className="row aska-kv"><span>⭐ VIP-регион</span><b>{lv.vipRegion || '777'}</b><span className="sp" /><button className="btn" onClick={() => setVip(true)}>777 / 888</button></div>}
        <div className="hint">{rank >= 1 ? 'На номере у тебя VIP-регион, а место видно в карточке.' : 'Регион на номере — где ты сейчас: Москва 197, Питер 198, Бали, Дубай… У Голд — 777 или 888.'}</div>
      </div>

      {lv.tier === 'black' && (
        <div className="aska-upass">
          <span className="up-top"><b>UPASS</b><em>BLACK</em></span>
          <span className="up-num">{lv.upass}</span>
          <span className="up-name">{me?.displayName}</span>
          <span className="up-row">
            {lv.blackChat && <button className="btn" onClick={() => onOpen(lv.blackChat!)}>🖤 Закрытый чат</button>}
          </span>
        </div>
      )}
      {lv.canInviteBlack && (
        <div className="groupbox">
          <div className="legend">🖤 Позвать в Блэк</div>
          <div className="hint">{lv.isAdmin ? 'Администрация зовёт без ограничений.' : 'Можно позвать одного человека в месяц. Человек сам примет приглашение.'}</div>
          <button className="btn" onClick={() => setBlackTo(true)}>Выбрать человека</button>
        </div>
      )}

      <div className="groupbox">
        <div className="legend">🔁 Обмен аськоинов</div>
        <div className="aska-swap">
          <button className="btn" onClick={() => onAux('plates')}><i>🚗</i><span>Крутые номера</span><small>{lv.tiers[rank].discount ? `скидка ${lv.tiers[rank].discount}%` : 'от 50 🪙'}</small></button>
          <button className="btn" disabled={rank >= 1 && !goldPaid} onClick={() => (rank === 0 || goldPaid ? act(buyGold, 'Голд ⭐') : undefined)}><i>⭐</i><span>Голд</span><small>{lv.gold.price} 🪙 / {lv.gold.days} дн.</small></button>
          <button className="btn" onClick={() => onAux('night')}><i>🌙</i><span>НФТ для Ночи</span><small>100 🪙{lv.tiers[rank].discount ? ` −${lv.tiers[rank].discount}%` : ''}</small></button>
          <button className="btn" onClick={() => onAux('network')}><i>🕸</i><span>Заработать</span><small>+50 за друга</small></button>
        </div>
        <div className="hint">Твоя скидка на номера, улучшения и НФТ: <b>{lv.tiers[rank].discount}%</b>. За вход каждый день: <b>+{lv.tiers[rank].daily} 🪙</b>.</div>
      </div>
      <div className="aska-actions">
        <button className="btn" onClick={() => onAux('rules')}>📜 Правила АСЬКИ</button>
        <button className="btn" onClick={() => onAux('network')}>🕸 Мой нетворк</button>
      </div>

      {vip && <VipPicker onClose={() => { setVip(false); load(); }} />}
      {place && <PlacePicker onClose={() => setPlaceOpen(false)} />}
      {blackTo && <BlackInviteDialog onClose={() => { setBlackTo(false); load(); }} />}
    </>
  );
}

function BlackInviteDialog({ onClose }: { onClose: () => void }) {
  const s = useStore();
  const [q, setQ] = useState('');
  const [msg, setMsg] = useState('');
  const people = Object.values(s.users).filter((u): u is User => !!u && u.id !== s.me?.userId && (u.kind || 'human') === 'human' && !u.blocked && u.tier !== 'black'
    && (!q || u.displayName.toLowerCase().includes(q.toLowerCase())));
  async function invite(u: User) {
    try { await inviteBlack(u.id); setMsg(`Приглашение отправлено: ${u.displayName} 🖤`); openDm(u.id).catch(() => {}); } catch (e) {
      setMsg(e instanceof ApiError && e.code === 'invited' ? 'Уже позвал(а).' : e instanceof ApiError && e.code === 'forbidden' ? 'В этом месяце приглашение уже использовано.' : 'Не получилось.');
    }
  }
  return (
    <Dialog title="🖤 Позвать в Блэк" onClose={onClose}>
      <input className="field" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Имя" />
      <div className="aska-biz-pick">
        {people.slice(0, 40).map((u) => (
          <button key={u.id} className="aska-biz-person" onClick={() => invite(u)}>
            <span className="nm">{u.displayName}</span><TierBadge tier={u.tier} /><span className="mark">🖤</span>
          </button>
        ))}
      </div>
      {msg && <div className="aska-note">{msg}</div>}
    </Dialog>
  );
}
