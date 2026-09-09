import { useStore } from '../lib/store.jsx';
import { isViewed } from '../lib/logic.js';
import { dateShort } from '../lib/time.js';
import { preview, service } from '../lib/video.js';
import { Btn, Card, Empty, TopBar } from '../components/UI.jsx';
import { IcPlay, IcCheck } from '../components/Icons.jsx';

export default function MaterialPage({ id }) {
  const { state, me, dispatch } = useStore();
  const material = state.materials.find((m) => m.id === id);
  if (!material) return <Empty title="Материал не найден" />;

  const viewed = isViewed(state, material.id, me.id);
  const cover = preview(material.videoUrl);

  return (
    <div className="screen">
      <TopBar title={material.type} sub={material.topic} />

      <a href={material.videoUrl} target="_blank" rel="noreferrer" className="video" style={{ display: 'grid' }}>
        {cover && (
          <img
            src={cover}
            alt=""
            onError={(e) => (e.currentTarget.style.display = 'none')}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
        )}
        <div className="play" style={{ position: 'relative' }}>
          <IcPlay size={20} />
        </div>
      </a>

      <h2 className="t-big" style={{ marginTop: 14 }}>{material.title}</h2>
      <div className="t-dim" style={{ marginTop: 4 }}>
        {dateShort(material.publishedAt)} · {service(material.videoUrl)}
        {material.seasonId < state.season.id ? ' · архив' : ''}
      </div>
      <p className="t-sub" style={{ marginTop: 12 }}>{material.description}</p>

      <a className="btn primary wide" style={{ marginTop: 16 }} href={material.videoUrl} target="_blank" rel="noreferrer">
        Смотреть на {service(material.videoUrl)}
      </a>
      <Btn kind={viewed ? 'on' : 'soft'} wide style={{ marginTop: 10 }} onClick={() => dispatch({ type: 'view', materialId: material.id })}>
        <IcCheck /> {viewed ? 'Просмотрено' : 'Отметить просмотренным'}
      </Btn>
      <div className="t-dim center" style={{ marginTop: 10 }}>Отметка видна только вам.</div>

      <Card className="flat" style={{ marginTop: 18 }}>
        <div className="t-dim">Видео мы не храним — материал открывается по ссылке на внешнем сервисе.</div>
      </Card>
    </div>
  );
}
