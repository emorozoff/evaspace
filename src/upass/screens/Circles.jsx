import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { Card, Btn, Section, Tag } from '../components/UI.jsx';
import { Cover, Avatar } from '../components/Art.jsx';
import Icon from '../components/Icons.jsx';
import { circlesFor } from '../lib/select.js';
import { byId } from '../data/people.js';
import { plural, nf } from '../lib/format.js';

export default function Circles() {
  const app = useApp();
  const list = circlesFor(app.me);

  return (
    <div className="screen stack-16">
      <div>
        <div className="eyebrow">Внутри клуба</div>
        <h2 className="display" style={{ marginTop: 3 }}>Круги по интересам</h2>
        <p className="t-sm dim" style={{ marginTop: 8, lineHeight: 1.55 }}>
          Ассоциации внутри сообщества: у каждой свой куратор, свои встречи и свой чат.
          С третьей степени можно создать собственный круг.
        </p>
      </div>

      <div className="stack">
        {list.map((c) => {
          const curator = byId(c.curator);
          const joined = app.circles.includes(c.id);
          return (
            <div key={c.id} className={`card locked${c.locked ? '' : ' tap'}`} style={{ padding: 0, overflow: 'hidden', position: 'relative' }}>
              <button
                style={{ width: '100%', textAlign: 'left', display: 'block' }}
                onClick={() => !c.locked && go(`/circle/${c.id}`)}
              >
                <Cover art={c.art} seed={c.id} height={104}>
                  <div style={{ position: 'absolute', left: 14, right: 14, bottom: 10 }}>
                    <div className="row" style={{ gap: 6, marginBottom: 5 }}>
                      <span className="tag">{c.access === 'closed' ? 'Закрытый' : 'Открытый'}</span>
                      {joined && <span className="tag tag--cyan">вы в круге</span>}
                    </div>
                    <div className="t-lg">{c.name}</div>
                  </div>
                </Cover>
                <div style={{ padding: 13 }}>
                  <div className="t-xs dim" style={{ lineHeight: 1.5 }}>{c.about}</div>
                  <div className="spread" style={{ marginTop: 11 }}>
                    <div className="row" style={{ gap: 8 }}>
                      <Avatar person={curator} size={24} />
                      <span className="t-xs dim">Куратор {curator?.name}</span>
                    </div>
                    <span className="t-xs gold">{nf(c.members)} {plural(c.members, 'участник', 'участника', 'участников')}</span>
                  </div>
                </div>
              </button>
              {c.locked && (
                <div className="locked__veil">
                  <Icon name="lock" size={20} color="var(--ink-2)" />
                  <div className="t-sm dim" style={{ maxWidth: 260, lineHeight: 1.45 }}>
                    Нужен уровень {c.minTier} и степень {c.minDegree}. Участники и переписка закрытого круга
                    не видны снаружи.
                  </div>
                  <Btn size="sm" variant="quiet" onClick={() => go('/degrees')}>Как получить доступ</Btn>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Card className="row-t" style={{ gap: 11 }}>
        <Icon name="plus" size={17} color="var(--gold)" />
        <div>
          <div className="t-sm">Создать свой круг</div>
          <div className="t-xs dim" style={{ marginTop: 3, lineHeight: 1.45 }}>
            Доступно с уровня Business и третьей степени. Заявка уходит модератору: нужны название,
            смысл и первые десять участников.
          </div>
        </div>
      </Card>
    </div>
  );
}
