import { useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { TopBar, Card, Btn, Section, Sheet, KV, Empty } from '../components/UI.jsx';
import { Cover, Avatar } from '../components/Art.jsx';
import Icon from '../components/Icons.jsx';
import { serviceById, SERVICE_CATS } from '../data/life.js';
import { CITIES } from '../data/places.js';
import { byId } from '../data/people.js';
import { usd, usdExact, nf, plural } from '../lib/format.js';

export default function Service({ id }) {
  const app = useApp();
  const s = serviceById(id);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');

  if (!s) return <Empty title="Услуга не найдена" />;

  const owner = byId(s.owner);
  const cat = SERVICE_CATS.find((c) => c.id === s.cat);
  const city = CITIES[s.city];
  const sent = app.requests.some((r) => r.service === s.id);
  const cashback = Math.round((s.price * s.cashback) / 100);

  const send = () => {
    app.requestService(s, text || 'Здравствуйте! Интересует ваша услуга.');
    setOpen(false);
    setText('');
  };

  return (
    <>
      <TopBar title={s.title} subtitle={cat?.name} backTo="/market" />
      <div className="screen stack-22">
        <Cover art={s.art} seed={s.id} height={178} radius={20}>
          <div style={{ position: 'absolute', left: 16, right: 16, bottom: 14 }}>
            <div className="row" style={{ gap: 6, marginBottom: 7 }}>
              <span className="tag tag--gold">кэшбэк {s.cashback}%</span>
              <span className="tag tag--plain">{city.flag} {city.name}</span>
            </div>
            <h2 className="display" style={{ fontSize: 25 }}>{s.title}</h2>
          </div>
        </Cover>

        <div className="spread">
          <div>
            <div className="display" style={{ fontSize: 30 }}>{s.price ? usdExact(s.price) : 'По запросу'}</div>
            {s.price > 0 && <div className="t-xs dim">за {s.unit} · для резидентов</div>}
          </div>
          {cashback > 0 && (
            <div style={{ textAlign: 'right' }}>
              <div className="t-sm cyan">+{nf(cashback * 100)} баллов</div>
              <div className="t-xs dim-2">вернётся кэшбэком</div>
            </div>
          )}
        </div>

        <p className="dim t-sm" style={{ lineHeight: 1.6, margin: 0 }}>{s.desc}</p>

        <div className="stats">
          <div className="stat"><div className="stat__v gold">★ {s.rating}</div><div className="stat__l">Оценка</div></div>
          <div className="stat"><div className="stat__v">{s.deals}</div><div className="stat__l">Заказов</div></div>
          <div className="stat"><div className="stat__v cyan">{s.reply}</div><div className="stat__l">Ответ, мин</div></div>
        </div>

        <Section eyebrow="Партнёр клуба" title="Кто оказывает услугу">
          <button className="card tap row" style={{ gap: 12 }} onClick={() => go(`/p/${owner.id}`)}>
            <Avatar person={owner} size={46} dot={owner.online} />
            <div className="grow">
              <div className="t-md">{owner.name}</div>
              <div className="t-xs dim">{owner.company} · в клубе с {owner.since}</div>
              <div className="t-xs dim-2" style={{ marginTop: 4 }}>
                {owner.vouches} {plural(owner.vouches, 'поручительство', 'поручительства', 'поручительств')} от резидентов
              </div>
            </div>
            <Icon name="right" size={15} color="var(--ink-4)" />
          </button>
        </Section>

        <Card>
          <KV k="Категория" v={cat?.name} />
          <KV k="Город" v={`${city.flag} ${city.name}`} />
          <KV k="Кэшбэк резиденту" v={`${s.cashback}%`} tone="var(--gold)" />
          <KV k="Среднее время ответа" v={`${s.reply} мин`} />
          <div className="t-xs dim" style={{ marginTop: 11, lineHeight: 1.45 }}>
            Внутри круга не продают того, во что не верят сами. Партнёр отвечает за услугу
            репутацией: жалоба разбирается модератором и попадает в цепочку.
          </div>
        </Card>

        <div style={{ position: 'sticky', bottom: 'calc(var(--tab-h) + 12px)' }}>
          <Btn variant={sent ? 'ghost' : 'gold'} wide icon={sent ? 'check' : 'message'} onClick={() => !sent && setOpen(true)}>
            {sent ? 'Заявка отправлена' : 'Оставить заявку'}
          </Btn>
        </div>
      </div>

      <Sheet open={open} onClose={() => setOpen(false)} eyebrow={owner.company} title="Заявка партнёру">
        <div className="stack-16">
          <textarea
            className="field"
            autoFocus
            placeholder="Что нужно, когда и в каком городе"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <Card>
            <KV k="Стоимость" v={s.price ? `${usdExact(s.price)} / ${s.unit}` : 'по запросу'} />
            <KV k="Вернётся баллами" v={`${nf(cashback * 100)} (${usdExact(cashback)})`} tone="var(--cyan)" />
            <KV k="Ответ обычно за" v={`${s.reply} мин`} />
          </Card>
          <Btn variant="gold" wide onClick={send}>Отправить</Btn>
          <div className="center t-xs dim-2">
            Время первого ответа партнёра фиксируется — это одна из метрик клуба.
          </div>
        </div>
      </Sheet>
    </>
  );
}
