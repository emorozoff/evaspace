import { useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { visibleEvents } from '../lib/logic.js';
import { dateShort } from '../lib/time.js';
import { EVENT_TYPES } from '../lib/events.js';
import { CoverThumb } from '../components/Cover.jsx';
import VideoModal from '../components/VideoModal.jsx';
import { Empty, List, Item, Note, Tag, TopBar } from '../components/UI.jsx';

const TONE_TAG = { online: 'blue', offline: 'accent', team: 'violet', summit: 'warm' };

/* Архив: всё, что прошло. Запись открывается прямо здесь. */

export default function Archive({ now }) {
  const { state, me } = useStore();
  const [play, setPlay] = useState(null);
  const past = visibleEvents(state, me, { from: state.season.startsAt, to: now }).reverse();

  return (
    <div className="screen" style={{ paddingTop: 0 }}>
      <TopBar title="Архив" sub="Прошедшие события и записи" backTo="/events" />
      {past.length === 0 ? (
        <Empty icon="calendar" title="Архив пуст" text="Здесь появятся прошедшие встречи и записи эфиров." />
      ) : (
        <div className="stack-20">
          <List>
            {past.map((e) => (
              <Item
                key={e.id}
                lead={<CoverThumb event={e} />}
                title={e.title}
                sub={`${dateShort(e.startsAt)} · ${EVENT_TYPES[e.type].label}`}
                meta={e.recordUrl ? <Tag tone="accent">запись</Tag> : <Tag tone={TONE_TAG[e.type]}>{EVENT_TYPES[e.type].short}</Tag>}
                onClick={e.recordUrl ? () => setPlay(e) : undefined}
                chev={Boolean(e.recordUrl)}
              />
            ))}
          </List>
          <Note icon="play">Записи открываются внутри приложения — уходить никуда не нужно.</Note>
        </div>
      )}
      {play && <VideoModal url={play.recordUrl} title={play.title} onClose={() => setPlay(null)} />}
    </div>
  );
}
