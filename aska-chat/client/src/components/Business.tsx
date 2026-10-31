// «Бизнес»: рабочие контакты по разделам (Команда, Работа, Бизнес, Партнёры) и рабочие групповые чаты.
// Раздел у человека — это его группа (contact_groups), у чата — chats.biz. В личных стилях их не видно (если включено разделение).
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useStore } from '../useStore.ts';
import { setGroup, createCircle, addCircleMembers } from '../lib/store.ts';
import type { User } from '../lib/store.ts';
import { BIZ_SECTIONS, bizOf, isBizGroup, groupOf, useSplit, setSplit } from '../lib/space.ts';
import type { BizKey } from '../lib/space.ts';
import { userFlower } from '../lib/aska.ts';
import { Dialog, Ico } from './Win.tsx';
import { UserPlate } from './Plate.tsx';

// все люди, кого можно позвать (без ботов, себя, заблокированных и убранных)
function usePeople() {
  const s = useStore();
  const me = s.me!.userId;
  return Object.values(s.users)
    .filter((u) => u.id !== me && (u.kind || 'human') === 'human' && !u.blocked && !s.hidden.includes(u.id))
    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'ru'));
}
const matches = (u: User, q: string) => !q || `${u.displayName} ${u.plate || ''} ${u.city || ''}`.toLowerCase().includes(q.toLowerCase().replace(/\s+/g, ''));

// Выбор раздела: Команда, Работа, Бизнес, Партнёры
export function SectionChips({ value, onChange }: { value: BizKey; onChange: (k: BizKey) => void }) {
  return (
    <div className="aska-biz-chips" role="radiogroup">
      {BIZ_SECTIONS.map((x) => (
        <button type="button" key={x.key} role="radio" aria-checked={value === x.key} className={`chip${value === x.key ? ' on' : ''}`} onClick={() => onChange(x.key)}>
          {x.emoji} {x.label}
        </button>
      ))}
    </div>
  );
}

// Добавить людей в раздел: нажал на человека — он в разделе (ещё раз — вернулся в «Личное»)
export function BizAddDialog({ section, onClose, onNewChat }: { section: BizKey; onClose: () => void; onNewChat: (k: BizKey) => void }) {
  const s = useStore();
  const people = usePeople();
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(0);
  const sec = bizOf(section)!;
  const split = useSplit();
  const list = people.filter((u) => matches(u, q));
  async function toggle(u: User) {
    setBusy(u.id);
    try { await setGroup(u.id, groupOf(s, u.id) === section ? 'meet' : section); } catch { /* нет связи */ } finally { setBusy(0); }
  }
  return (
    <Dialog title={`${sec.emoji} ${sec.label} — кого добавить`} onClose={onClose}
      buttons={<button className="btn primary" onClick={onClose}>Готово</button>}>
      <button className="btn aska-biz-newchat" onClick={() => onNewChat(section)}>💬 Групповой чат «{sec.label}»</button>
      <input className="field mt" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Имя или номер" />
      <div className="aska-biz-pick">
        {list.map((u) => {
          const g = groupOf(s, u.id);
          const here = g === section;
          const other = isBizGroup(g) && !here ? bizOf(g) : undefined;
          return (
            <button key={u.id} className={`aska-biz-person${here ? ' on' : ''}`} disabled={busy === u.id} onClick={() => toggle(u)}>
              <Ico className={`ico${u.gold ? ' gold' : ''}`} html={userFlower(u, !!s.presence[u.id], 16)} />
              <span className="nm">{u.displayName}{other && <small> · сейчас в «{other.label}»</small>}</span>
              <span className="mark">{here ? '✓' : '＋'}</span>
            </button>
          );
        })}
        {!list.length && <div className="hint">Никого не нашли. Позвать нового человека — «Ещё» → «Позвать друга».</div>}
      </div>
      <div className="hint">{split ? `Люди из «${sec.label}» видны только в «Бизнесе» — в личном списке их не будет.` : 'Разделение выключено: рабочие контакты видны везде.'}</div>
    </Dialog>
  );
}

// Новый рабочий групповой чат: название, раздел, участники
export function BizChatDialog({ section, onClose, onOpen }: { section: BizKey; onClose: () => void; onOpen: (chatId: string) => void }) {
  const s = useStore();
  const people = usePeople();
  const [sec, setSec] = useState<BizKey>(section);
  const [title, setTitle] = useState('');
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<number[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  // сначала те, кто уже в этом разделе, потом остальные рабочие, потом все
  const rank = (u: User) => (groupOf(s, u.id) === sec ? 0 : isBizGroup(groupOf(s, u.id)) ? 1 : 2);
  const list = people.filter((u) => matches(u, q)).sort((a, b) => rank(a) - rank(b));
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setError('Придумай название — например, «Отдел продаж».');
    setBusy(true);
    setError('');
    try {
      const id = await createCircle({ title: title.trim(), emoji: bizOf(sec)!.emoji, about: '', memberIds: picked, isPublic: false, biz: sec });
      onClose();
      onOpen(id);
    } catch {
      setError('Не получилось создать чат. Проверь интернет.');
      setBusy(false);
    }
  }
  return (
    <Dialog title="💬 Новый рабочий чат" onClose={onClose}>
      <form className="col" onSubmit={submit}>
        <label className="aska-field"><span className="lbl">Название</span>
          <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={40} placeholder="Например, «Отдел продаж»" />
        </label>
        <span className="aska-biz-lbl">Раздел</span>
        <SectionChips value={sec} onChange={setSec} />
        <span className="aska-biz-lbl">Участники ({picked.length})</span>
        <input className="field" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Имя или номер" />
        <div className="aska-biz-pick">
          {list.map((u) => {
            const on = picked.includes(u.id);
            const g = bizOf(groupOf(s, u.id));
            return (
              <button type="button" key={u.id} className={`aska-biz-person${on ? ' on' : ''}`}
                onClick={() => setPicked((p) => (on ? p.filter((x) => x !== u.id) : [...p, u.id]))}>
                <Ico className={`ico${u.gold ? ' gold' : ''}`} html={userFlower(u, !!s.presence[u.id], 16)} />
                <span className="nm">{u.displayName}{g && <small> · {g.emoji} {g.label}</small>}</span>
                <span className="mark">{on ? '✓' : '＋'}</span>
              </button>
            );
          })}
        </div>
        <div className="hint">🔒 Переписка в рабочем чате шифруется на телефоне, как личка. Позвать ещё людей можно потом — в шапке чата.</div>
        {error && <div className="err">{error}</div>}
        <div className="row mt">
          <button type="button" className="btn" onClick={onClose} disabled={busy}>Отмена</button>
          <span className="sp" />
          <button className="btn primary" disabled={busy}>{busy ? 'Создаю…' : 'Создать чат'}</button>
        </div>
      </form>
    </Dialog>
  );
}

// Позвать людей в уже созданный чат
export function AddMembersDialog({ chatId, onClose }: { chatId: string; onClose: () => void }) {
  const s = useStore();
  const people = usePeople();
  const chat = s.chats[chatId];
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<number[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (!chat) return null;
  const inside = new Set(chat.members.map((m) => m.userId));
  const list = people.filter((u) => !inside.has(u.id) && matches(u, q));
  async function add() {
    setBusy(true);
    try { await addCircleMembers(chatId, picked); onClose(); } catch { setError('Не получилось. Проверь интернет.'); setBusy(false); }
  }
  return (
    <Dialog title={`Позвать в «${chat.title || 'чат'}»`} onClose={onClose}
      buttons={<>
        <button className="btn" onClick={onClose}>Отмена</button>
        <button className="btn primary" disabled={busy || !picked.length} onClick={add}>Позвать{picked.length ? ` (${picked.length})` : ''}</button>
      </>}>
      <input className="field" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Имя или номер" />
      <div className="aska-biz-pick">
        {list.map((u) => {
          const on = picked.includes(u.id);
          return (
            <button key={u.id} className={`aska-biz-person${on ? ' on' : ''}`} onClick={() => setPicked((p) => (on ? p.filter((x) => x !== u.id) : [...p, u.id]))}>
              <Ico className={`ico${u.gold ? ' gold' : ''}`} html={userFlower(u, !!s.presence[u.id], 16)} />
              <span className="nm">{u.displayName}</span>
              <span className="mark">{on ? '✓' : '＋'}</span>
            </button>
          );
        })}
        {!list.length && <div className="hint">Все уже здесь.</div>}
      </div>
      <div className="hint">Новенькие увидят переписку с этого момента — старые сообщения зашифрованы не для них.</div>
      {error && <div className="err">{error}</div>}
    </Dialog>
  );
}

// Страница «Рабочие контакты»: разделы, кто в них, рабочие чаты, разделение
export function BizManager({ onOpen, onProfile }: { onOpen: (chatId: string) => void; onProfile: (userId: number) => void }) {
  const s = useStore();
  const people = usePeople();
  const split = useSplit();
  const [adding, setAdding] = useState<BizKey | null>(null);
  const [chatFor, setChatFor] = useState<BizKey | null>(null);
  const chats = Object.values(s.chats).filter((c) => c.biz);
  return (
    <>
      <div className="aska-biz-hero">
        <b>💼 АСЬКА Бизнес</b>
        <span>Отдельные переписки для команды, работы, бизнеса и партнёров. Разложи людей по разделам — и рабочее не смешается с личным.</span>
        <button className="btn primary" onClick={() => setChatFor('team')}>💬 Новый рабочий чат</button>
      </div>
      <label className="groupbox row aska-check aska-split">
        <input type="checkbox" checked={split} onChange={(e) => setSplit(e.target.checked)} />
        <span><b>Рабочие контакты — только в «Бизнесе»</b><br />
          <small className="hint">{split ? 'В личных стилях их не видно, а в «Бизнесе» не видно личных.' : 'Выключено: все контакты видны и в личном, и в «Бизнесе».'}</small></span>
      </label>
      {BIZ_SECTIONS.map((sec) => {
        const ps = people.filter((u) => groupOf(s, u.id) === sec.key);
        const cs = chats.filter((c) => c.biz === sec.key);
        return (
          <div key={sec.key} className="groupbox aska-biz-sec">
            <div className="legend">{sec.emoji} {sec.label} <span className="cnt">{ps.length}</span></div>
            {!ps.length && !cs.length && <div className="hint">{sec.empty}</div>}
            {cs.map((c) => (
              <button key={c.id} className="aska-biz-person chat" onClick={() => onOpen(c.id)}>
                <span className="ico">{c.emoji || sec.emoji}</span>
                <span className="nm">{c.title}<small> · {c.members.length} уч.</small></span>
                <span className="mark">›</span>
              </button>
            ))}
            {ps.map((u) => (
              <div key={u.id} className="aska-biz-person">
                <Ico className={`ico${u.gold ? ' gold' : ''}`} html={userFlower(u, !!s.presence[u.id], 16)} />
                <span className="nm link" onClick={() => onProfile(u.id)}>{u.displayName}</span>
                <UserPlate user={u} size="s" />
                <button className="btn icon" title="Убрать из раздела" aria-label={`Убрать ${u.displayName} из раздела`}
                  onClick={() => setGroup(u.id, 'meet').catch(() => {})}>✕</button>
              </div>
            ))}
            <div className="row aska-biz-acts">
              <button className="btn" onClick={() => setAdding(sec.key)}>＋ Добавить людей</button>
              <button className="btn" onClick={() => setChatFor(sec.key)}>💬 Чат</button>
            </div>
          </div>
        );
      })}
      {adding && <BizAddDialog section={adding} onClose={() => setAdding(null)} onNewChat={(k) => { setAdding(null); setChatFor(k); }} />}
      {chatFor && <BizChatDialog section={chatFor} onClose={() => setChatFor(null)} onOpen={onOpen} />}
    </>
  );
}
