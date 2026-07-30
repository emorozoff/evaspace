import { useMemo, useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { Avatar, TopBar, Empty, Sheet, StarField } from '../components/UI.jsx';
import { IcHeart, IcMessage, IcPlus, IcCheck, IcNext, IcSparkStar, IcSend } from '../components/Icons.jsx';
import { go } from '../lib/router.jsx';

/* ============ Сообщество ============ */
export function Community() {
  const { state, dispatch, allGroups, allPosts } = useStore();
  const [make, setMake] = useState(false);
  const [title, setTitle] = useState('');
  const [about, setAbout] = useState('');
  const [emoji, setEmoji] = useState('✨');

  const mine = allGroups.filter((g) => state.joined.includes(g.id));
  const others = allGroups.filter((g) => !state.joined.includes(g.id));
  const feed = useMemo(() => allPosts.slice(0, 6), [allPosts]);

  return (
    <div className="screen">
      <div className="topbar">
        <div style={{ flex: 1 }}>
          <div className="eyebrow">Сообщество</div>
          <h1 style={{ marginTop: 2 }}>Группы по интересам</h1>
        </div>
      </div>

      <div className="pad">
        <div className="card" style={{ background: 'var(--grad-hero)', color: '#fff', padding: 18, position: 'relative', overflow: 'hidden' }}>
          <StarField n={16} seed={21} />
          <div style={{ position: 'relative' }}>
            <div className="serif" style={{ fontSize: 20, lineHeight: 1.2 }}>Здесь не нужно быть идеальной</div>
            <div className="small" style={{ opacity: 0.85, marginTop: 6, lineHeight: 1.5 }}>
              Задавай вопросы, делись состоянием и получай ответы — часто отвечают сами эксперты.
            </div>
            <div className="tiny" style={{ opacity: 0.8, marginTop: 10 }}>+5 баллов за каждое сообщение</div>
          </div>
        </div>
      </div>

      {mine.length > 0 && (
        <div className="pad">
          <div className="sect-head">
            <div className="sect-title">Мои группы</div>
          </div>
          <div className="stack">
            {mine.map((g) => (
              <GroupRow key={g.id} g={g} joined />
            ))}
          </div>
        </div>
      )}

      <div className="pad">
        <div className="sect-head">
          <div className="sect-title">Все группы</div>
          <span className="tiny muted">{allGroups.length}</span>
        </div>
        <div className="stack">
          {others.map((g) => (
            <GroupRow key={g.id} g={g} />
          ))}
        </div>
      </div>

      <div className="pad">
        <div className="sect-head">
          <div className="sect-title">Последние сообщения</div>
        </div>
        <div className="stack">
          {feed.map((p) => {
            const g = allGroups.find((x) => x.id === p.group);
            return (
              <button key={p.id} className="card card-pad" style={{ textAlign: 'left', width: '100%' }} onClick={() => go(`/group/${p.group}`)}>
                <div className="row" style={{ gap: 10, marginBottom: 8 }}>
                  <Avatar name={p.author} hue={p.hue} size={34} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="row" style={{ gap: 6 }}>
                      <b style={{ fontSize: 13.5 }}>{p.author}</b>
                      {p.expert && <span className="tag rose" style={{ height: 18, fontSize: 9.5 }}>эксперт</span>}
                    </div>
                    <div className="tiny muted">{g?.emoji} {g?.title} · {p.ago}</div>
                  </div>
                </div>
                <div className="small" style={{ lineHeight: 1.55, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.text}</div>
              </button>
            );
          })}
        </div>
        <div style={{ height: 10 }} />
      </div>

      <button className="floating-add" onClick={() => setMake(true)}>
        <IcPlus size={16} /> Создать группу
      </button>

      <Sheet open={make} onClose={() => setMake(false)} title="Новая группа">
        <div className="pad" style={{ paddingBottom: 20 }}>
          <div className="tiny muted" style={{ marginBottom: 6 }}>Значок</div>
          <div className="chips" style={{ marginBottom: 14 }}>
            {['✨', '🌸', '🧘‍♀️', '👶', '💼', '🌙', '🤍', '🔥'].map((e) => (
              <button key={e} className={'chip' + (emoji === e ? ' on' : '')} onClick={() => setEmoji(e)} style={{ fontSize: 17 }}>
                {e}
              </button>
            ))}
          </div>
          <input className="input" placeholder="Название группы" value={title} onChange={(e) => setTitle(e.target.value)} />
          <textarea className="input" style={{ marginTop: 10 }} rows={3} placeholder="О чём эта группа?" value={about} onChange={(e) => setAbout(e.target.value)} />
          <button
            className="btn primary"
            style={{ marginTop: 14 }}
            disabled={!title.trim()}
            onClick={() => {
              dispatch({ type: 'createGroup', title: title.trim(), about: about.trim() || 'Новая группа сообщества', emoji });
              setTitle('');
              setAbout('');
              setMake(false);
            }}
          >
            Создать группу
          </button>
        </div>
      </Sheet>
    </div>
  );
}

function GroupRow({ g, joined }) {
  const { dispatch } = useStore();
  return (
    <div className="list-item">
      <button style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0, textAlign: 'left' }} onClick={() => go(`/group/${g.id}`)}>
        <div
          style={{
            width: 48, height: 48, borderRadius: 16, flex: 'none', display: 'grid', placeItems: 'center', fontSize: 22,
            background: `linear-gradient(135deg, hsl(${g.hue} 70% 90%), hsl(${g.hue + 30} 60% 80%))`,
          }}
        >
          {g.emoji}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 14.5 }}>{g.title}</div>
          <div className="tiny muted" style={{ marginTop: 2 }}>{g.members.toLocaleString('ru-RU')} участниц</div>
        </div>
      </button>
      <button
        className={'btn sm ' + (joined ? 'ghost' : 'primary')}
        style={{ height: 32, padding: '0 12px', fontSize: 12 }}
        onClick={() => dispatch({ type: 'joinGroup', id: g.id })}
      >
        {joined ? 'Вы в группе' : 'Вступить'}
      </button>
    </div>
  );
}

/* ============ Страница группы ============ */
export function GroupPage({ id }) {
  const { state, dispatch, allGroups, allPosts } = useStore();
  const g = allGroups.find((x) => x.id === id);
  const [text, setText] = useState('');
  if (!g) return <Empty emoji="🔍" title="Группа не найдена" action={<button className="btn ghost sm" onClick={() => go('/community')}>В сообщество</button>} />;

  const posts = allPosts.filter((p) => p.group === id);
  const joined = state.joined.includes(id);

  const send = () => {
    if (!text.trim()) return;
    dispatch({ type: 'post', group: id, text: text.trim() });
    setText('');
  };

  return (
    <div className="screen">
      <div className="hero-dark" style={{ background: `linear-gradient(140deg, #3a1a4a 0%, hsl(${g.hue} 46% 36%) 58%, hsl(${g.hue} 62% 58%) 100%)`, paddingBottom: 20 }}>
        <StarField n={18} seed={g.hue} />
        <TopBar title="" dark onBack={() => go('/community')} />
        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: 34 }}>{g.emoji}</div>
          <div className="serif" style={{ fontSize: 26, marginTop: 4 }}>{g.title}</div>
          <div className="small" style={{ opacity: 0.85, marginTop: 6, lineHeight: 1.5 }}>{g.about}</div>
          <div className="row" style={{ gap: 10, marginTop: 14 }}>
            <span className="badge-lvl">{g.members.toLocaleString('ru-RU')} участниц</span>
            <button className="btn sm" style={{ height: 32, background: joined ? 'rgba(255,255,255,.2)' : '#fff', color: joined ? '#fff' : 'var(--plum)', boxShadow: 'none' }} onClick={() => dispatch({ type: 'joinGroup', id })}>
              {joined ? <><IcCheck size={14} /> Вы в группе</> : 'Вступить'}
            </button>
          </div>
        </div>
      </div>

      <div className="pad" style={{ marginTop: 16 }}>
        <div className="card card-pad">
          <textarea className="input" rows={3} placeholder="Поделись состоянием или задай вопрос…" value={text} onChange={(e) => setText(e.target.value)} />
          <div className="row between" style={{ marginTop: 10 }}>
            <span className="tiny muted">+5 баллов за сообщение</span>
            <button className="btn sm primary" disabled={!text.trim()} onClick={send}>
              <IcSend size={15} /> Отправить
            </button>
          </div>
        </div>

        <div className="stack" style={{ marginTop: 16 }}>
          {posts.map((p) => {
            const liked = !!state.likes[p.id];
            return (
              <div key={p.id} className="card card-pad">
                <div className="row" style={{ gap: 10, marginBottom: 10 }}>
                  <Avatar name={p.author} hue={p.hue} size={38} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="row" style={{ gap: 6 }}>
                      <b style={{ fontSize: 14 }}>{p.author}</b>
                      {p.expert && <span className="tag rose" style={{ height: 18, fontSize: 9.5 }}>эксперт</span>}
                      {p.mine && <span className="tag green" style={{ height: 18, fontSize: 9.5 }}>ты</span>}
                    </div>
                    <div className="tiny muted">{p.ago}</div>
                  </div>
                </div>
                <div className="small" style={{ lineHeight: 1.6 }}>{p.text}</div>
                <div className="row" style={{ gap: 16, marginTop: 12 }}>
                  <button className="row tiny" style={{ gap: 5, color: liked ? 'var(--rose-deep)' : 'var(--muted)', fontWeight: 700 }} onClick={() => dispatch({ type: 'like', id: p.id })}>
                    <IcHeart size={15} filled={liked} /> {p.likes + (liked ? 1 : 0)}
                  </button>
                  <span className="row tiny muted" style={{ gap: 5, fontWeight: 700 }}>
                    <IcMessage size={15} /> Ответить
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ height: 16 }} />
      </div>
    </div>
  );
}
