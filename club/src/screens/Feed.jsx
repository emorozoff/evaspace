import { useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { feedPosts, tagOf, userById, POST_TAGS, POINTS } from '../lib/logic.js';
import { relative } from '../lib/time.js';
import { readImage } from '../lib/image.js';
import { Avatar, Btn, Empty, Field, Note, Sheet, Tag, TopBar } from '../components/UI.jsx';
import Choice from '../components/Choice.jsx';
import Icon from '../components/Icons.jsx';

/* Лента клуба: короткие посты с фото. Встретились — выложили карточку,
   получили баллы. Ничего сложнее здесь не нужно. */

export default function Feed({ now }) {
  const { state } = useStore();
  const [open, setOpen] = useState(false);
  const posts = feedPosts(state);

  return (
    <div className="screen" style={{ paddingTop: 0 }}>
      <TopBar
        title="Лента"
        sub="Встречи, результаты и вопросы"
        backTo="/"
        right={<button className="iconbtn iconbtn--accent" onClick={() => setOpen(true)} aria-label="Написать"><Icon name="plus" size={18} /></button>}
      />
      <div className="stack">
        {posts.length === 0 ? (
          <Empty icon="camera" title="Лента пустая" text="Выложите первое фото со встречи — за это дают баллы." action={<Btn variant="accent" size="sm" onClick={() => setOpen(true)}>Написать</Btn>} />
        ) : (
          posts.map((post) => <Post key={post.id} post={post} now={now} />)
        )}
        <Note icon="spark">
          Пост — {POINTS.post} баллов, фото со встречи — {POINTS.meetPhoto}. Баллы копятся в профиле и показывают, кто в клубе живой.
        </Note>
      </div>

      <Sheet open={open} onClose={() => setOpen(false)} title="Что рассказать" sub="Фото со встречи — самое ценное">
        {open && <PostForm onDone={() => setOpen(false)} />}
      </Sheet>
    </div>
  );
}

export function Post({ post, now, compact }) {
  const { state, me, dispatch } = useStore();
  const author = userById(state, post.userId);
  const tag = tagOf(post.tag);
  const liked = post.likes.includes(me.id);

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
        {post.userId === me.id && (
          <button className="post__act" style={{ marginLeft: 'auto' }} onClick={() => dispatch({ type: 'postDelete', id: post.id })}>удалить</button>
        )}
      </div>
    </article>
  );
}

function PostForm({ onDone }) {
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
      <Field label="О чём пост">
        <Choice options={POST_TAGS} value={[tag]} max={1} onChange={(v) => setTag(v[0])} wide />
      </Field>

      <Field label="Фото" hint={error || (tag === 'встреча' ? `Фото со встречи — ${POINTS.meetPhoto} баллов` : 'Необязательно')}>
        <label className="post__drop">
          {photo ? <img src={photo} alt="" /> : <><Icon name="camera" size={26} /><span className="t-sm">Выбрать фото</span></>}
          <input type="file" accept="image/*" onChange={pick} style={{ display: 'none' }} />
        </label>
      </Field>

      <Field label="Пара слов">
        <textarea className="field" placeholder="Собрались вчетвером, три часа разбирали воронки" value={text} onChange={(e) => setText(e.target.value)} />
      </Field>

      <Btn variant="accent" wide disabled={text.trim().length < 5} onClick={() => { dispatch({ type: 'postAdd', text, photo, tag }); onDone(); }}>
        Выложить
      </Btn>
    </div>
  );
}
