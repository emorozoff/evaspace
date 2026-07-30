import { useStore, weekReport, levelOf, totalStars } from '../lib/store.jsx';
import { TYPE_META } from '../data/content.js';
import { TopBar, StarField, StarRow } from '../components/UI.jsx';
import { IcStar, IcSparkStar, IcClock, IcCrown } from '../components/Icons.jsx';
import { go } from '../lib/router.jsx';

const DAY_NAMES = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

/* правильное окончание: 1 звезда, 2 звезды, 5 звёзд */
function plural(n, forms) {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return forms[2];
  if (b > 1 && b < 5) return forms[1];
  if (b === 1) return forms[0];
  return forms[2];
}

export default function Report() {
  const { state } = useStore();
  const rep = weekReport(state);
  const lvl = levelOf(state.points);
  const max = 3;

  return (
    <div className="screen">
      <div className="hero-dark">
        <StarField n={26} seed={17} />
        <TopBar title="" dark onBack={() => go('/home')} />
        <div style={{ textAlign: 'center', paddingBottom: 8 }}>
          <div className="eyebrow" style={{ color: 'rgba(255,255,255,.7)' }}>Отчёт недели</div>
          <div className="serif" style={{ fontSize: 30, marginTop: 6 }}>
            {rep.super ? 'Суперзвезда недели!' : `${rep.stars} ${plural(rep.stars, ['звезда', 'звезды', 'звёзд'])} из 21`}
          </div>
          <div className="small" style={{ opacity: 0.82, marginTop: 8, lineHeight: 1.5 }}>
            {rep.super
              ? 'Ты закрыла все 7 дней полностью. Это редкость 🏆'
              : rep.stars === 0
              ? 'Неделя только начинается — самое время сделать первый шаг'
              : `Закрыто полных дней: ${rep.fullDays}. Осталось ${21 - rep.stars} звёзд до суперзвезды`}
          </div>

          <div style={{ display: 'grid', placeItems: 'center', margin: '20px 0 6px' }}>
            <div
              style={{
                width: 118, height: 118, borderRadius: '50%', display: 'grid', placeItems: 'center',
                background: rep.super
                  ? 'radial-gradient(circle at 50% 40%, rgba(246,223,174,.55), rgba(246,223,174,0) 70%)'
                  : 'rgba(255,255,255,.1)',
                border: '1px solid rgba(255,255,255,.2)',
                color: rep.super ? '#f6dfae' : '#fff',
                animation: rep.super ? 'floaty 4s ease-in-out infinite' : 'none',
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <IcSparkStar size={38} />
                <div style={{ fontWeight: 800, fontSize: 22, marginTop: 2 }}>{rep.stars}/21</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="pad" style={{ marginTop: 18 }}>
        {/* столбики по дням */}
        <div className="card card-pad">
          <div className="eyebrow" style={{ marginBottom: 14 }}>Звёзды по дням</div>
          <div className="row" style={{ alignItems: 'flex-end', gap: 8, height: 110 }}>
            {rep.days.map((s, i) => (
              <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ height: 84, display: 'flex', alignItems: 'flex-end' }}>
                  <div
                    style={{
                      width: '100%',
                      height: Math.max(6, (s / max) * 84),
                      borderRadius: 10,
                      background: s === 3 ? 'linear-gradient(180deg,#f6dfae,#d5a45c)' : s > 0 ? 'linear-gradient(180deg,#f3c5d6,#d9739b)' : 'rgba(59,30,78,.08)',
                      transition: 'height .6s cubic-bezier(.4,0,.2,1)',
                    }}
                  />
                </div>
                <div className="tiny muted" style={{ marginTop: 6, fontWeight: 700 }}>{DAY_NAMES[i]}</div>
              </div>
            ))}
          </div>
        </div>

        {/* показатели */}
        <div className="grid-2" style={{ marginTop: 12 }}>
          <div className="card card-pad">
            <div className="tiny muted">Всего баллов</div>
            <b style={{ fontSize: 24 }}>{state.points.toLocaleString('ru-RU')}</b>
            <div className="tiny" style={{ color: 'var(--ok)', marginTop: 4, fontWeight: 700 }}>+{rep.earned} за неделю</div>
          </div>
          <div className="card card-pad">
            <div className="tiny muted">Время практик</div>
            <b style={{ fontSize: 24 }}>{rep.minutes} мин</b>
            <div className="tiny muted" style={{ marginTop: 4 }}>
              {rep.minutes >= 60 ? `≈ ${(rep.minutes / 60).toFixed(1)} часа` : 'на этой неделе'}
            </div>
          </div>
        </div>

        <div className="card card-pad" style={{ marginTop: 12 }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>Что выполнено</div>
          {Object.entries(TYPE_META).map(([k, m]) => (
            <div key={k} style={{ marginBottom: 12 }}>
              <div className="row between" style={{ marginBottom: 6 }}>
                <span className="small" style={{ fontWeight: 700 }}>{m.emoji} {m.short}</span>
                <span className="tiny muted">{rep.byType[k]} из 7</span>
              </div>
              <div className="progress">
                <i style={{ width: (rep.byType[k] / 7) * 100 + '%', background: k === 'masterclass' ? 'var(--grad-gold)' : undefined }} />
              </div>
            </div>
          ))}
        </div>

        {/* уровень */}
        <div className="card card-pad" style={{ marginTop: 12, background: 'linear-gradient(120deg,#fdf1ec,#f0e4fb)' }}>
          <div className="row" style={{ gap: 12 }}>
            <span style={{ fontSize: 26 }}>{lvl.current.emoji}</span>
            <div style={{ flex: 1 }}>
              <b style={{ fontSize: 15 }}>Статус: {lvl.current.name}</b>
              <div className="tiny muted" style={{ marginTop: 2 }}>
                {lvl.next ? `До «${lvl.next.name}» осталось ${lvl.next.from - state.points} баллов` : 'Максимальный статус достигнут'}
              </div>
            </div>
          </div>
          <div className="progress" style={{ marginTop: 12 }}>
            <i style={{ width: lvl.progress * 100 + '%' }} />
          </div>
        </div>

        <div className="card card-pad" style={{ marginTop: 12 }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Совет на следующую неделю</div>
          <div className="small" style={{ lineHeight: 1.6 }}>
            {rep.stars >= 15
              ? 'Ты в отличном ритме. На следующей неделе можно добавить один мастер-класс подлиннее — база уже есть.'
              : rep.stars >= 7
              ? 'Хороший старт. Попробуй закрывать аффирмацию сразу после пробуждения — это самый лёгкий способ не потерять серию.'
              : 'Начни с одного шага в день — аффирмация занимает минуту. Регулярность важнее объёма.'}
          </div>
          <button className="btn primary sm" style={{ width: '100%', marginTop: 14 }} onClick={() => go('/home')}>
            Вернуться к программе
          </button>
        </div>
        <div style={{ height: 14 }} />
      </div>
    </div>
  );
}
