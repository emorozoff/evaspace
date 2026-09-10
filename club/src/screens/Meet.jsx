import { useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import {
  meetsFor, userById, cityName, matchReasons, meetPhotos, meetTags, meetGoals, loveMatch,
  MEET_GOALS, MEET_PHOTOS, WEEKLY_MEETS, chatKey,
} from '../lib/logic.js';
import { weekKey, dateShort } from '../lib/time.js';
import { readImage } from '../lib/image.js';
import { Avatar, Btn, Empty, Field, List, Item, Note, Section, Sheet, Tag, TopBar } from '../components/UI.jsx';
import Choice from '../components/Choice.jsx';
import Icon from '../components/Icons.jsx';

/* Новые знакомства: программа сама предлагает несколько человек в неделю.
   Совпало с обеих сторон — открывается общий чат. Сверху — своя витрина:
   фото, цели и теги, которые видит собеседник. */

const TAG_POOL = [
  'Падл и теннис', 'Горы и походы', 'Караоке', 'Настолки', 'Клубы и вечеринки', 'Зал и бег',
  'Путешествия', 'Вино и рестораны', 'Книги и подкасты', 'Мотоциклы и авто', 'Музыка', 'Фото и видео',
  'Кофе', 'Сёрф', 'Йога', 'Кино', 'Театр', 'Шахматы',
];

export default function Meet({ now }) {
  const { state, me } = useStore();
  const [edit, setEdit] = useState(false);
  const week = weekKey(now);
  const mine = meetsFor(state, me.id, week);
  const open = mine.filter((m) => m.status === 'new' || (m.status === 'liked' && !m.likedBy.includes(me.id)));
  const current = open[0];
  const other = current ? userById(state, current.a === me.id ? current.b : current.a) : null;
  const matched = mine.filter((m) => m.status === 'matched');
  const goals = meetGoals(me);

  return (
    <div className="screen" style={{ paddingTop: 0 }}>
      <TopBar title="Новые знакомства" sub={`${WEEKLY_MEETS} предложений в неделю`} backTo="/people" />
      <div className="stack-20">
        <MyCard onEdit={() => setEdit(true)} />

        {/* Сколько предложений на этой неделе уже посмотрели */}
        <div className="meet__quota">
          {Array.from({ length: Math.max(WEEKLY_MEETS, mine.length) }, (_, i) => <i key={i} data-on={i < mine.length - open.length} />)}
        </div>

        {!me.coffeeEnabled ? (
          <Empty icon="people" title="Знакомства выключены" text="Включите их в профиле — и в понедельник придут новые предложения." />
        ) : current && other ? (
          <MeetCard meet={current} other={other} goals={goals} />
        ) : (
          <Empty
            icon="check"
            title="На этой неделе всё"
            text={`Вы посмотрели все ${mine.length} предложений. Новые придут в понедельник — а когда клуб закончится, программа вернёт тех, с кем знакомство так и не состоялось.`}
          />
        )}

        {matched.length > 0 && (
          <Section title={`Метчи · ${matched.length}`}>
            <List>
              {matched.map((m) => {
                const person = userById(state, m.a === me.id ? m.b : m.a);
                return (
                  <Item
                    key={m.id}
                    lead={<Avatar user={person} size={44} ring="var(--accent)" />}
                    title={person?.name}
                    sub={`Совпадение ${m.percent}% · ${m.online ? 'онлайн' : cityName(state, person?.cityId)}`}
                    meta={<Tag tone="accent">чат</Tag>}
                    onClick={() => go(`/chat/${encodeURIComponent(chatKey('dm', [m.a, m.b]))}`)}
                  />
                );
              })}
            </List>
          </Section>
        )}

        {mine.filter((m) => m.status === 'liked' && m.likedBy.includes(me.id)).length > 0 && (
          <Section title="Ждём ответа">
            <List>
              {mine.filter((m) => m.status === 'liked' && m.likedBy.includes(me.id)).map((m) => {
                const person = userById(state, m.a === me.id ? m.b : m.a);
                return <Item key={m.id} lead={<Avatar user={person} size={40} />} title={person?.name} sub={`Предложение отправлено ${dateShort(m.at)}`} meta={<Tag tone="warm">ждём</Tag>} chev={false} />;
              })}
            </List>
          </Section>
        )}

        <Note icon="eye">Программа подбирает по совпадению интересов и следит, чтобы вы не встречались дважды. Город решает только формат: живьём или онлайн.</Note>
      </div>

      <Sheet open={edit} onClose={() => setEdit(false)} title="Ваши интересы" sub="Это видят в знакомствах — профиль остаётся прежним">
        {edit && <MyForm onDone={() => setEdit(false)} />}
      </Sheet>
    </div>
  );
}

/** Своя витрина: фото, цели и теги — то, по чему вас выбирают. */
function MyCard({ onEdit }) {
  const { me } = useStore();
  const photos = meetPhotos(me);
  const tags = meetTags(me);
  const goals = meetGoals(me);

  return (
    <button className="mine" onClick={onEdit}>
      <div className="mine__row">
        <div className="mine__ph">
          {photos[0] ? <img src={photos[0]} alt="" /> : <Avatar user={me} size={64} radius={0.32} />}
          {photos.length > 1 && <span className="mine__n">{photos.length}</span>}
        </div>
        <div className="grow" style={{ minWidth: 0, textAlign: 'left' }}>
          <div className="t-xs dim-2">Ваши интересы</div>
          <div className="t-md" style={{ marginTop: 2 }}>{goals.map((g) => MEET_GOALS.find((x) => x.id === g)?.label || g).join(' · ')}</div>
          <div className="t-xs dim-2" style={{ marginTop: 4 }}>{photos.length ? `${photos.length} из ${MEET_PHOTOS} фото` : 'Фото из профиля'} · {tags.length} тегов</div>
        </div>
        <Icon name="edit" size={17} className="chev" />
      </div>
      {tags.length > 0 && (
        <div className="wrap" style={{ marginTop: 12 }}>
          {tags.slice(0, 6).map((t) => <Tag key={t}>{t}</Tag>)}
        </div>
      )}
    </button>
  );
}

/** Карточка предложения: фото листается, цели и совпадения — словами. */
function MeetCard({ meet, other, goals }) {
  const { state, me, dispatch } = useStore();
  const [shot, setShot] = useState(0);
  const photos = meetPhotos(other);
  const theirGoals = meetGoals(other);
  const love = loveMatch(me, other);
  const shared = new Set(meetTags(me));
  const tags = meetTags(other);
  const reasons = matchReasons(me, other);

  return (
    <article className="meet">
      {/* Без своих фото кадр короче — незачем растягивать пустоту на пол-экрана */}
      <div className={`meet__shot${photos.length ? '' : ' meet__shot--blank'}`}>
        {photos[shot] ? (
          <img src={photos[shot]} alt="" onClick={() => setShot((shot + 1) % photos.length)} />
        ) : (
          <div className="meet__blank"><Avatar user={other} size={96} radius={0.3} /></div>
        )}
        {photos.length > 1 && (
          <div className="meet__dots">{photos.map((p, i) => <i key={p.slice(-12) + i} data-on={i === shot} />)}</div>
        )}
        <span className="meet__mode">{meet.online ? 'онлайн' : 'ваш город'}</span>
        <span className="meet__pct"><Icon name="spark" size={12} /> {meet.percent}%</span>
        {love && <span className="meet__love"><Icon name="heart" size={12} filled /> оба хотят влюбиться</span>}
        <div className="meet__over">
          <div className="h2" style={{ color: '#fff' }}>{other.name}</div>
          <div className="t-sm" style={{ color: 'rgba(255,255,255,0.8)', marginTop: 3 }}>
            {cityName(state, other.cityId)} · {other.about}
          </div>
        </div>
      </div>

      <div className="meet__body">
        {/* Зачем знакомится он — это важнее списка увлечений */}
        <div>
          <div className="hdr" style={{ padding: 0 }}>Ищет</div>
          <div className="wrap" style={{ marginTop: 7 }}>
            {theirGoals.map((g) => {
              const goal = MEET_GOALS.find((x) => x.id === g);
              return (
                <Tag key={g} tone={goals.includes(g) ? 'accent' : g === 'Встретить любовь' ? 'warm' : undefined}>
                  {goal?.label || g}
                </Tag>
              );
            })}
          </div>
        </div>

        {tags.length > 0 && (
          <div>
            <div className="hdr" style={{ padding: 0 }}>Интересы</div>
            <div className="wrap" style={{ marginTop: 7 }}>
              {tags.map((t) => <Tag key={t} tone={shared.has(t) ? 'accent' : undefined}>{t}</Tag>)}
            </div>
          </div>
        )}

        {reasons.length > 0 && <div className="t-sm dim center">Общее: {reasons.join(' · ')}</div>}

        <div className="pair">
          <Btn variant="accent" icon="handshake" onClick={() => dispatch({ type: 'meetLike', id: meet.id, goal: goals })}>Познакомиться</Btn>
          <Btn variant="quiet" onClick={() => dispatch({ type: 'meetSkip', id: meet.id })}>Пропустить</Btn>
        </div>
        <button className="t-sm accent center" style={{ fontWeight: 600 }} onClick={() => go(`/person/${other.id}`)}>Открыть профиль</button>
      </div>
    </article>
  );
}

/** Фото, цели и теги правятся в одном месте — иначе это три разных экрана. */
function MyForm({ onDone }) {
  const { me, dispatch } = useStore();
  const [photos, setPhotos] = useState(meetPhotos(me));
  const [goal, setGoal] = useState(meetGoals(me));
  const [tags, setTags] = useState(meetTags(me));
  const [own, setOwn] = useState('');
  const [error, setError] = useState('');

  const add = async (e) => {
    const files = [...(e.target.files || [])].slice(0, MEET_PHOTOS - photos.length);
    const next = [...photos];
    for (const file of files) {
      try { next.push(await readImage(file, { maxSide: 640, maxBytes: 180 * 1024 })); setError(''); } catch (err) { setError(err.message); }
    }
    setPhotos(next.slice(0, MEET_PHOTOS));
  };

  const toggle = (t) => setTags(tags.includes(t) ? tags.filter((x) => x !== t) : tags.length < 8 ? [...tags, t] : tags);

  return (
    <div className="stack">
      <Field label={`Фото · ${photos.length} из ${MEET_PHOTOS}`} hint={error || 'Первое — главное. Без своих фото показываем аватар'}>
        <div className="shots">
          {photos.map((p, i) => (
            <div key={p.slice(-14) + i} className="shots__i">
              <img src={p} alt="" />
              {i === 0 && <span className="shots__main">главное</span>}
              <button className="shots__x" onClick={() => setPhotos(photos.filter((_, k) => k !== i))} aria-label="Убрать"><Icon name="x" size={13} /></button>
            </div>
          ))}
          {photos.length < MEET_PHOTOS && (
            <label className="shots__add">
              <Icon name="plus" size={20} />
              <input type="file" accept="image/*" multiple onChange={add} style={{ display: 'none' }} />
            </label>
          )}
        </div>
      </Field>

      <Field label="Зачем знакомитесь" hint="До трёх — их видит собеседник">
        <Choice options={MEET_GOALS} value={goal} max={3} onChange={setGoal} />
      </Field>

      <Field label={`Теги · ${tags.length} из 8`} hint="По ним считается совпадение">
        <div className="wrap">
          {[...new Set([...tags, ...TAG_POOL])].map((t) => (
            <button key={t} className={`chip${tags.includes(t) ? ' chip--on' : ''}`} onClick={() => toggle(t)}>{t}</button>
          ))}
        </div>
      </Field>

      <Field label="Свой тег">
        <div className="row" style={{ gap: 8 }}>
          <input className="field grow" placeholder="Например, «винил»" value={own} onChange={(e) => setOwn(e.target.value)} />
          <Btn variant="soft" size="sm" disabled={own.trim().length < 2 || tags.length >= 8} onClick={() => { setTags([...tags, own.trim()]); setOwn(''); }}>Добавить</Btn>
        </div>
      </Field>

      <Btn variant="accent" wide onClick={() => { dispatch({ type: 'meetProfile', photos, tags, goal }); onDone(); }}>Сохранить</Btn>
    </div>
  );
}
