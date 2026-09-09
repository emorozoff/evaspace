import { useStore } from '../lib/store.jsx';
import { isViewed } from '../lib/logic.js';
import { dateShort } from '../lib/time.js';
import { preview, service } from '../lib/video.js';
import { hash } from '../lib/format.js';
import { Btn, Empty, List, Item, Note, TopBar } from '../components/UI.jsx';
import Icon from '../components/Icons.jsx';

export default function MaterialPage({ id }) {
  const { state, me, dispatch } = useStore();
  const m = state.materials.find((x) => x.id === id);
  if (!m) return <div className="screen"><Empty title="Материал не найден" /></div>;
  const viewed = isViewed(state, m.id, me.id);
  const cover = preview(m.videoUrl);
  const hue = hash(m.id) % 360;

  return (
    <div className="screen" style={{ paddingTop: 0 }}>
      <TopBar title={m.type[0].toUpperCase() + m.type.slice(1)} sub={m.topic} backTo="/base" />
      <div className="stack-20">
        <a className="ev__cover" href={m.videoUrl} target="_blank" rel="noreferrer" style={{ borderRadius: 16, background: `linear-gradient(135deg, hsl(${hue} 30% 24%), #0f121a)` }}>
          {cover && <img src={cover} alt="" onError={(e) => (e.currentTarget.style.display = 'none')} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
          <div className="ev__shade" />
          <div className="thumb__play"><i style={{ width: 54, height: 54 }}><Icon name="play" size={20} /></i></div>
          <div className="ev__over"><div className="ev__title">{m.title}</div><div className="ev__meta">{dateShort(m.publishedAt)} · {service(m.videoUrl)}</div></div>
        </a>

        <p className="lead">{m.description}</p>

        <List>
          <Item icon="video" title={`Смотреть на ${service(m.videoUrl)}`} sub="Откроется в приложении сервиса" onClick={() => window.open(m.videoUrl, '_blank')} />
        </List>

        <Btn variant={viewed ? 'soft' : 'ghost'} wide icon="check" onClick={() => dispatch({ type: 'view', materialId: m.id })}>
          {viewed ? 'Просмотрено' : 'Отметить просмотренным'}
        </Btn>
        <Note icon="eye">Отметка видна только вам. Видео мы не храним — только ссылку.</Note>
      </div>
    </div>
  );
}
