import { useMemo, useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { TopBar, List, Item, Btn, Chip, Sheet, Empty, KV, Note } from '../components/UI.jsx';
import { SceneThumb } from '../components/Scene.jsx';
import Icon from '../components/Icons.jsx';
import { REGIONS, REGION_KEYS } from '../data/regions.js';
import { flight, hoursText } from '../lib/travel.js';
import { nf, plural, monthsAhead, relDay, stayLabel } from '../lib/format.js';

/* Мои поездки. Календарь тут стилистика, а не сетка: месяцы идут сверху вниз
   списком, внутри месяца — карточки. Поездка открывается и правится. */

const STAY = [3, 7, 14, 30, 60, 89];

export default function Trips({ query = {} }) {
  const app = useApp();
  const [edit, setEdit] = useState(query.new ? 'new' : null);   // поездка или 'new'
  const months = useMemo(() => monthsAhead(9), []);

  const groups = useMemo(() => {
    const byMonth = new Map();
    for (const t of [...app.trips].sort((a, b) => a.inDays - b.inDays)) {
      const key = t.month || months.find((m) => m.inDays >= t.inDays)?.key || months[0].key;
      if (!byMonth.has(key)) byMonth.set(key, []);
      byMonth.get(key).push(t);
    }
    return [...byMonth.entries()];
  }, [app.trips, months]);

  const label = (key) => months.find((m) => m.key === key)?.label || key;

  return (
    <>
      <TopBar
        title="Мои поездки"
        sub={app.trips.length ? `${app.trips.length} ${plural(app.trips.length, 'поездка объявлена', 'поездки объявлены', 'поездок объявлено')}` : 'Пока ничего не объявлено'}
        backTo="/"
        right={
          <button className="iconbtn iconbtn--gold" onClick={() => setEdit('new')} aria-label="Добавить поездку">
            <Icon name="plus" size={19} />
          </button>
        }
      />
      <div className="screen stack-20">
        {groups.length === 0 ? (
          <Empty
            icon="plane"
            title="Поездок пока нет"
            text="Объявите поездку — резиденты в регионе увидят вас в списке «прилетают» и позовут на встречи."
            action={<Btn size="sm" variant="gold" onClick={() => setEdit('new')}>Объявить поездку</Btn>}
          />
        ) : (
          groups.map(([key, list]) => (
            <div key={key} className="stack-8">
              <div className="monthline">
                <span className="monthline__t">{label(key)}</span>
                <span className="monthline__r" />
                <span className="monthline__n figure">{list.length}</span>
              </div>
              <List>
                {list.map((t) => {
                  const r = REGIONS[t.region];
                  const f = flight(app.me.city, t.region);
                  return (
                    <Item
                      key={t.id}
                      lead={<SceneThumb city={t.region} size={46} />}
                      title={`${r.flag} ${r.name}`}
                      sub={`${t.when || relDay(t.inDays)} · ${stayLabel(t.days)}`}
                      meta={f ? <span>{hoursText(f.hours)}</span> : undefined}
                      onClick={() => setEdit(t)}
                    />
                  );
                })}
              </List>
            </div>
          ))
        )}

        {app.trips.length > 0 && (
          <Note icon="users">Видны только регион и месяц. Точные даты и рейс остаются вашим делом.</Note>
        )}
      </div>

      <TripSheet
        open={edit !== null}
        trip={edit === 'new' ? null : edit}
        months={months}
        app={app}
        onClose={() => setEdit(null)}
      />
    </>
  );
}

/* Одна шторка и на новую поездку, и на правку существующей. */
function TripSheet({ open, trip, months, app, onClose }) {
  const [region, setRegion] = useState(trip?.region || 'bali');
  const [month, setMonth] = useState(trip?.month || months[0].key);
  const [days, setDays] = useState(trip?.days || 14);
  const [key, setKey] = useState(0);

  /* Шторка переиспользуется, поэтому при смене поездки поля переставляются. */
  const id = trip?.id || 'new';
  if (key !== id) {
    setKey(id);
    setRegion(trip?.region || 'bali');
    setMonth(trip?.month || months[0].key);
    setDays(trip?.days || 14);
  }

  if (!open) return null;

  const picked = months.find((x) => x.key === month) || months[0];
  const f = flight(app.me.city, region);

  const save = () => {
    const patch = { region, days, month: picked.key, inDays: picked.inDays, when: picked.label };
    if (trip) app.updateTrip(trip.id, patch);
    else app.announceTrip(patch);
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title={trip ? 'Поездка' : 'Новая поездка'} sub="Регион, месяц и срок">
      <div className="stack">
        <div>
          <div className="label">Куда</div>
          <div className="wrap">
            {REGION_KEYS.filter((k) => k !== app.me.city).map((k) => (
              <Chip key={k} on={region === k} onClick={() => setRegion(k)}>{REGIONS[k].flag} {REGIONS[k].name}</Chip>
            ))}
          </div>
        </div>
        <div>
          <div className="label">Когда</div>
          <div className="wrap">
            {months.map((x) => <Chip key={x.key} on={month === x.key} onClick={() => setMonth(x.key)}>{x.label}</Chip>)}
          </div>
        </div>
        <div>
          <div className="label">На сколько</div>
          <div className="wrap">
            {STAY.map((d) => <Chip key={d} on={days === d} onClick={() => setDays(d)}>{stayLabel(d)}</Chip>)}
          </div>
        </div>

        {f && (
          <div className="card" style={{ paddingTop: 2, paddingBottom: 2 }}>
            <KV k="Перелёт" v={`${nf(f.km)} км · ${hoursText(f.hours)}${f.direct ? '' : ' · с пересадкой'}`} />
          </div>
        )}

        <Btn variant="gold" wide onClick={save}>{trip ? 'Сохранить' : 'Объявить'}</Btn>
        {trip && (
          <Btn variant="danger" wide icon="x" onClick={() => { app.cancelTrip(trip.id); onClose(); }}>Отменить поездку</Btn>
        )}
        <Btn variant="quiet" wide onClick={() => { onClose(); go(`/region/${region}`); }}>Открыть регион</Btn>
      </div>
    </Sheet>
  );
}
