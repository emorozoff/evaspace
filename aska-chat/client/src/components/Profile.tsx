// Карточка человека: номер, «о себе», написать ему или его личному ИИ (открыто или анонимно),
// закрепить наверху, сыграть «Человек или ИИ?». И карточка круга: кто в нём и выйти.
import { useState } from 'react';
import { useStore } from '../useStore.ts';
import { openDm, openTwinChat, setPin, setGroup, guess, twinOf, leaveCircle, setHidden } from '../lib/store.ts';
import type { Group, Truth } from '../lib/store.ts';
import { ApiError } from '../lib/api.ts';
import { safetyCode, fromB64 } from '../lib/crypto.ts';
import { flower, userFlower } from '../lib/aska.ts';
import { statusLine } from '../lib/statuses.ts';
import { plural } from '../lib/format.ts';
import { Dialog, Ico } from './Win.tsx';
import { UserPlate, Gold } from './Plate.tsx';
import { PlateCard } from './Plates.tsx';
import { StatusPicker } from './Status.tsx';

const GROUP_NAMES: { key: Group; label: string }[] = [{ key: 'close', label: '💛 Ближний круг' }, { key: 'meet', label: '👋 Знакомства' }, { key: 'work', label: '💼 Работа' }];

export function Profile({ userId, onClose, onOpenChat, onWall }: { userId: number; onClose: () => void; onOpenChat: (chatId: string) => void; onWall: (userId: number) => void }) {
  const s = useStore();
  const [error, setError] = useState('');
  const [twinAsk, setTwinAsk] = useState(false);
  const [result, setResult] = useState<{ correct: boolean; truth: Truth } | null>(null);
  const [busy, setBusy] = useState(false);
  const [card, setCard] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const u = s.users[userId];
  if (!u) return null;
  const me = s.me!.userId;
  const itsMe = u.id === me;
  const isAska = u.kind === 'aska';
  const isTwin = u.kind === 'twin';
  const isFriendAi = u.kind === 'friend';
  const person = !isAska && !isTwin && !isFriendAi;
  const online = !!s.presence[u.id];
  const twin = person ? twinOf(u.id, s) : undefined;
  const owner = isTwin && u.ownerId ? s.users[u.ownerId] : undefined;
  const pinned = s.pins.includes(u.id);
  const known = s.guesses[u.id];

  const act = async (fn: () => Promise<void>) => {
    setError('');
    setBusy(true);
    try { await fn(); } catch (e) {
      setError(e instanceof ApiError && e.code === 'anon_off' ? `${u.displayName} не принимает анонимные сообщения.` : 'Не получилось. Проверь интернет.');
    } finally { setBusy(false); }
  };
  const write = () => act(async () => { onOpenChat(await openDm(u.id)); onClose(); });
  const writeTwin = (anon: boolean) => act(async () => { onOpenChat(await openTwinChat(twin!.id, anon)); onClose(); });
  const doGuess = (g: Truth) => act(async () => setResult(await guess(u.id, g)));

  return (
    <Dialog title={itsMe ? 'Это ты' : u.displayName} onClose={onClose}>
      <div className="aska-profile">
        <div className="aska-profile-head">
          <Ico className={`ico big${u.gold ? ' gold' : ''}`} html={isAska ? flower('chat', 40) : isFriendAi ? '<span class="aska-ico-emo">👨</span>' : userFlower(u, online || itsMe, 40)} />
          <div className="who">
            <b>{u.displayName}<Gold user={u} big />{(isAska || isFriendAi) && <span className="aska-tag">ИИ</span>}</b>
            <div className="muted">{u.blocked ? 'заблокирован(а)' : isAska ? 'всегда на связи' : online || itsMe ? 'в сети' : 'не в сети'}{u.city ? ` · ${u.city}` : ''}{u.gold ? ' · голд' : ''}</div>
            {u.status && <div className="aska-st-line">{statusLine(u.status)}</div>}
          </div>
        </div>
        {itsMe && (
          <div className="row aska-actions">
            <button className="btn aska-st-btn" onClick={() => setStatusOpen(true)}>{u.status ? '✏️ Сменить статус' : '＋ Поставить статус'}</button>
            <button className="btn aska-st-btn" onClick={() => onWall(u.id)}>📌 Моя стена</button>
          </div>
        )}
        {statusOpen && <StatusPicker onClose={() => setStatusOpen(false)} />}
        {u.plate && <div className="aska-profile-plate"><UserPlate user={u} size="l" onClick={u.plateId ? () => setCard(true) : undefined} /></div>}
        {card && u.plateId && <PlateCard id={u.plateId} onClose={() => setCard(false)} />}
        {u.about && <div className="aska-about">{u.about}</div>}
        {isAska && <div className="hint">Аська — ИИ и душа АСЬКИ. Подскажет, поболтает и не даст заскучать 🌼</div>}
        {isFriendAi && <div className="hint">Батя — ИИ-друг. Раз в день спросит, как ты: поел ли, выспался ли, звонил ли родным и как на личном фронте. Можно и самому написать — выслушает и подскажет по-отцовски.</div>}
        {isTwin && owner && <div className="hint">Личный ИИ человека «{owner.displayName}». Ему можно задать вопрос, передать комплимент или подарок.</div>}
        {u.keyRotated && !itsMe && <div className="hint">🔑 {u.displayName} недавно восстанавливал(а) вход — ключ шифрования обновился.</div>}

        {!itsMe && !u.blocked && (
          <div className="aska-actions">
            <button className="btn primary" onClick={write} disabled={busy}>💬 Написать</button>
            {u.kind !== 'twin' && <button className="btn" onClick={() => onWall(u.id)}>📌 Стена</button>}
            {twin && <button className="btn" onClick={() => setTwinAsk((v) => !v)} disabled={busy}>🤖 Личный ИИ</button>}
            {person && <button className="btn" onClick={() => act(() => setPin(u.id, !pinned))} disabled={busy}>{pinned ? '📌 Открепить' : '📌 Закрепить'}</button>}
            {person && <button className="btn" disabled={busy} onClick={() => act(async () => {
              const hidden = s.hidden.includes(u.id);
              if (!hidden && !confirm(`Убрать ${u.displayName} для себя? Записи и комментарии пропадут со стен, а сам(а) — из списка. Вернуть можно здесь же или в «Ещё».`)) return;
              await setHidden(u.id, !hidden);
            })}>{s.hidden.includes(u.id) ? '↩ Вернуть' : '🚫 Убрать для себя'}</button>}
          </div>
        )}

        {person && !itsMe && !u.blocked && (
          <div className="aska-grp-pick">
            <span className="hint">Группа:</span>
            <div className="tabs">
              {GROUP_NAMES.map((g) => (
                <button key={g.key} className={(s.groups[u.id] || 'meet') === g.key ? 'on' : ''} disabled={busy}
                  onClick={() => act(() => setGroup(u.id, g.key))}>{g.label}</button>
              ))}
            </div>
          </div>
        )}

        {twinAsk && twin && (
          <div className="groupbox">
            <div className="legend">Как написать ИИ · {u.displayName}?</div>
            <div className="aska-choice">
              <button className="btn" onClick={() => writeTwin(false)} disabled={busy}>
                <b>🙂 Открыто</b><small>{u.displayName} увидит, что это ты</small>
              </button>
              <button className="btn" onClick={() => writeTwin(true)} disabled={busy}>
                <b>🕶 Анонимно</b><small>никто не узнает, кто писал</small>
              </button>
            </div>
          </div>
        )}

        {person && !itsMe && (
          <div className="groupbox aska-game">
            <div className="legend">Игра «Человек или ИИ?»</div>
            {result ? (
              <div className={`aska-verdict ${result.correct ? 'ok' : 'miss'}`}>
                {result.correct ? 'Верно! ' : 'Мимо! '}{result.truth === 'ai' ? 'Это ИИ 🤖' : 'Это живой человек 🙂'}
              </div>
            ) : known ? (
              <div className="aska-verdict">{known === 'ai' ? 'Ты уже знаешь: это ИИ 🤖' : 'Ты уже знаешь: это живой человек 🙂'}</div>
            ) : (
              <>
                <div className="hint">Среди людей в АСЬКЕ есть ИИ. Как думаешь, {u.displayName} — кто? Попытка одна.</div>
                <div className="aska-choice">
                  <button className="btn" onClick={() => doGuess('human')} disabled={busy}><b>🙂 Человек</b></button>
                  <button className="btn" onClick={() => doGuess('ai')} disabled={busy}><b>🤖 ИИ</b></button>
                </div>
              </>
            )}
          </div>
        )}

        {error && <div className="err">{error}</div>}
        {person && (
          <details className="aska-safety">
            <summary>Код безопасности</summary>
            <span className="code">{safetyCode(fromB64(u.pk))}</span>
            <div className="hint">Сверь при встрече: если цифры совпадают с «Моим кодом» у друга, переписку никто не подменяет.</div>
          </details>
        )}
      </div>
    </Dialog>
  );
}

export function CircleInfo({ chatId, onClose, onProfile }: { chatId: string; onClose: () => void; onProfile: (userId: number) => void }) {
  const s = useStore();
  const [busy, setBusy] = useState(false);
  const chat = s.chats[chatId];
  if (!chat) return null;
  const general = chat.kind === 'general';
  const people = chat.members.map((m) => s.users[m.userId]).filter((u) => u && u.kind !== 'twin');
  const online = people.filter((u) => s.presence[u!.id]).length;
  return (
    <Dialog title={`${chat.emoji || (general ? '🌼' : '⭕')} ${chat.title || 'Общий чат'}`} onClose={onClose}>
      <div className="aska-profile">
        {chat.about && <div className="aska-about">{chat.about}</div>}
        <div className="hint">{people.length} {plural(people.length, 'участник', 'участника', 'участников')}, в сети {online}</div>
        {general ? (
          <div className="hint">Здесь все, кого пригласили в АСЬКУ. Сообщения тут зашифрованы для всех участников.</div>
        ) : (
          <div className="clist inset aska-members">
            {people.map((u) => (
              <div key={u!.id} className={`citem${s.presence[u!.id] ? '' : ' off'}`} onClick={() => onProfile(u!.id)}>
                <Ico className={`ico${u!.gold ? ' gold' : ''}`} html={u!.kind === 'aska' ? flower('chat', 16) : userFlower(u, !!s.presence[u!.id], 16)} />
                <span className="cmeta"><span className="nick">{u!.id === s.me?.userId ? `${u!.displayName} (ты)` : u!.displayName}</span>{u!.city && <span className="sub">{u!.city}</span>}</span>
              </div>
            ))}
          </div>
        )}
        {!general && <div className="hint">В кругах бывают и ИИ. Секреты лучше писать лично.</div>}
        {!general && (
          <div className="right mt">
            <button className="btn" disabled={busy} onClick={async () => { setBusy(true); try { await leaveCircle(chatId); onClose(); } finally { setBusy(false); } }}>Выйти из круга</button>
          </div>
        )}
      </div>
    </Dialog>
  );
}
