import { useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { feedPosts, repliesOf, tagOf, userById, POST_TAGS, POINTS } from '../lib/logic.js';
import { relative } from '../lib/time.js';
import { readImage } from '../lib/image.js';
import { Avatar, Btn, Empty, Note, Sheet, Tag, TopBar } from '../components/UI.jsx';
import Icon from '../components/Icons.jsx';

/* Лента клуба: короткие посты с фото и разговор под каждым.
   Первым идёт сам пост, ответы раскрываются вниз — как в тредах. */

export default function Feed({ now }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="screen" style={{ paddingTop: 0 }}>
      <TopBar
        title="Лента"
        sub="Встречи, результаты и вопросы"
        backTo="/"
        right={<button className="iconbtn iconbtn--accent" onClick={() => setOpen(true)} aria-label="Написать"><Icon name="plus" size={18} /></button>}
      />
      <div className="stack">
        <FeedList now={now} onWrite={() => setOpen(true)} />
        <Note icon="spark">
          Пост — {POINTS.post} баллов, фото со встречи — {POINTS.meetPhoto}, ответ — {POINTS.message}.
          Баллы копятся в профиле и показывают, кто в клубе живой.
        </Note>
      </div>

      <Sheet open={open} onClose={() => setOpen(false)} title="Что рассказать" sub="Фото со встречи — самое ценное">
        {open && <PostForm onDone={() => setOpen(false)} />}
      </Sheet>
    </div>
  );
}

/** Сама лента — она же вкладкой в разделе «Люди». */
export function FeedList({ now, onWrite }) {
  const { state } = useStore();
  const posts = feedPosts(state);
  if (posts.length === 0) {
    return (
      <Empty
        icon="camera"
        title="Лента пустая"
        text="Выложите первое фото со встречи — за это дают баллы."
        action={onWrite && <Btn variant="accent" size="sm" onClick={onWrite}>Написать</Btn>}
      />
    );
  }
  return <div className="stack">{posts.map((post) => <Post key={post.id} post={post} now={now} />)}</div>;
}

export function Post({ post, now, compact }) {
  const { state, me, dispatch } = useStore();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const author = userById(state, post.userId);
  const tag = tagOf(post.tag);
  const liked = post.likes.includes(me.id);
  const replies = repliesOf(state, post.id);

  const reply = () => {
    if (!text.trim()) return;
    dispatch({ type: 'postReply', postId: post.id, text });
    setText('');
  };

  return (
    <article className="post">
      <div className="post__head">
        <button onClick={() => go(`/person/${post.userId}`)}><Avatar user={author} size={40} /></button>
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="t-md ell">{author?.name}</div>
          <div className="t-xs dim-2">{relative(post.at, now)}</div>
        </div>
        <Tag tone={tag.tone}>{tag.label}</Tag>
      </div>

      <div className={`post__text${compact ? ' clamp-2' : ''}`}>{post.text}</div>
      {post.photo && <img className="post__photo" src={post.photo} alt="" loading="lazy" />}

      <div className="post__foot">
        <button className={`post__act${liked ? ' post__act--on' : ''}`} onClick={() => dispatch({ type: 'postLike', id: post.id })}>
          <Icon name="heart" size={16} filled={liked} /> {post.likes.length || ''}
        </button>
        <button className={`post__act${open ? ' post__act--on' : ''}`} onClick={() => setOpen(!open)}>
          <Icon name="message" size={16} /> {replies.length || 'ответить'}
        </button>
        {post.userId === me.id && (
          <button className="post__act" style={{ marginLeft: 'auto' }} onClick={() => dispatch({ type: 'postDelete', id: post.id })}>удалить</button>
        )}
      </div>

      {/* Разговор раскрывается вниз, прямо под постом */}
      {open && (
        <div className="thread">
          {replies.map((r) => {
            const person = userById(state, r.userId);
            return (
              <div key={r.id} className="thread__i">
                <button onClick={() => go(`/person/${r.userId}`)}><Avatar user={person} size={28} /></button>
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="thread__who">{person?.name} <span className="dim-2">· {relative(r.at, now)}</span></div>
                  <div className="thread__t">{r.text}</div>
                </div>
                {r.userId === me.id && (
                  <button className="t-xs dim-2" onClick={() => dispatch({ type: 'postReplyDelete', id: r.id })}>убрать</button>
                )}
              </div>
            );
          })}
          <div className="thread__new">
            <Avatar user={me} size={28} />
            <input
              className="field grow"
              placeholder="Ответить"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && reply()}
            />
            <button className="composer__send" style={{ width: 36, height: 36 }} onClick={reply} disabled={!text.trim()} aria-label="Отправить">
              <Icon name="send" size={15} />
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

/** Сначала тег, потом пара слов, фото — значком рядом с кнопкой. */
export function PostForm({ onDone }) {
  const { dispatch } = useStore();
  const [tag, setTag] = useState('встреча');
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState('');
  const [error, setError] = useState('');

  const pick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try { setPhoto(await readImage(file)); setError(''); } catch (err) { setError(err.message); }
  };

  return (
    <div className="stack">
      <div className="wrap">
        {POST_TAGS.map((t) => (
          <button key={t.id} className={`chip${tag === t.id ? ' chip--on' : ''}`} onClick={() => setTag(t.id)}>{t.label}</button>
        ))}
      </div>

      <textarea className="field" rows={4} placeholder="Пара слов: что было и что из этого вышло" value={text} onChange={(e) => setText(e.target.value)} />

      {photo && (
        <div className="post__pick">
          <img src={photo} alt="" />
          <button className="shots__x" onClick={() => setPhoto('')} aria-label="Убрать фото"><Icon name="x" size={13} /></button>
        </div>
      )}
      {error && <div className="t-xs" style={{ color: 'var(--red)' }}>{error}</div>}

      <div className="row" style={{ gap: 8 }}>
        <label className="clipbtn" title="Прикрепить фото">
          <Icon name="clip" size={19} />
          <input type="file" accept="image/*" onChange={pick} style={{ display: 'none' }} />
        </label>
        <Btn variant="accent" wide className="grow" disabled={text.trim().length < 5} onClick={() => { dispatch({ type: 'postAdd', text, photo, tag }); onDone(); }}>
          Выложить
        </Btn>
      </div>
      <div className="t-xs dim-2 center">
        {tag === 'встреча' && photo ? `Фото со встречи — ${POINTS.meetPhoto} баллов` : `Пост — ${POINTS.post} баллов`}
      </div>
    </div>
  );
}
