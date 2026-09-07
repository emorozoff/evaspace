import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { Card, Btn, Section, Bar, Tag, KV } from '../components/UI.jsx';
import Icon from '../components/Icons.jsx';
import { TIERS, DEGREES } from '../data/canon.js';
import { usdExact, plural } from '../lib/format.js';

export default function Degrees() {
  const app = useApp();
  const { me, counts } = app;

  const visibleDegrees = DEGREES.filter((d) => !d.secret || app.secret);
  const hiddenCount = DEGREES.filter((d) => d.secret).length - (app.secret ? DEGREES.filter((d) => d.secret).length : 0);

  return (
    <div className="screen stack-22">
      <div>
        <div className="eyebrow">Две шкалы</div>
        <h2 className="display" style={{ marginTop: 3 }}>Уровни и степени</h2>
        <p className="t-sm dim" style={{ marginTop: 8, lineHeight: 1.55 }}>
          Уровень членства покупается и открывает доступ. Степень зарабатывается внутри и
          определяет доверие. Их нельзя обменять друг на друга — и это принципиально.
        </p>
      </div>

      <Section eyebrow="Покупается" title="Уровень членства">
        <div className="stack-8">
          {TIERS.map((t) => {
            const cur = me.tier === t.n;
            const lower = me.tier > t.n;
            return (
              <Card key={t.n} variant={cur ? 'gold' : undefined}>
                <div className="spread">
                  <div className="row" style={{ gap: 11 }}>
                    <div style={{ width: 4, height: 36, borderRadius: 3, background: `linear-gradient(180deg, ${t.edge[0]}, ${t.edge[1]})` }} />
                    <div>
                      <div className="row" style={{ gap: 7 }}>
                        <span className="t-md">{t.name}</span>
                        {cur && <Tag tone="gold">ваш</Tag>}
                      </div>
                      <div className="t-xs dim">{t.line}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="t-sm num">{t.price ? usdExact(t.price) : '—'}</div>
                    <div className="t-xs dim-2">{t.price ? 'в год' : 'по приглашению'}</div>
                  </div>
                </div>
                {(cur || (!lower && t.n === me.tier + 1)) && (
                  <div className="stack-8" style={{ marginTop: 12 }}>
                    {t.perks.map((p) => (
                      <div key={p} className="row t-xs" style={{ gap: 8 }}>
                        <Icon name="check" size={13} color={cur ? 'var(--gold)' : 'var(--ink-3)'} />
                        <span className="dim">{p}</span>
                      </div>
                    ))}
                  </div>
                )}
                {!cur && !lower && t.price && (
                  <Btn variant="quiet" size="sm" wide style={{ marginTop: 12 }} onClick={() => app.upgrade(t.n)}>
                    Перейти на {t.name} · {usdExact(t.price)}
                  </Btn>
                )}
              </Card>
            );
          })}
        </div>
        <Card className="row-t" style={{ gap: 11, marginTop: 4 }}>
          <Icon name="eye" size={17} color="var(--ink-3)" />
          <div className="t-xs dim">
            Правило видимости: объект с минимальным уровнем N виден участнику с уровнем не ниже N.
            Исключение — витрина услуг: бизнес-карточка партнёра видна всем, а его личный профиль
            остаётся закрытым. Это две персоны одного человека с разными правами доступа.
          </div>
        </Card>
      </Section>

      <Section eyebrow="Зарабатывается" title="Степень">
        <div className="stack-8">
          {visibleDegrees.map((d) => {
            const cur = me.degree === d.n;
            const done = me.degree >= d.n;
            const ready =
              counts.meets >= d.need.meets && counts.vouches >= d.need.vouches && counts.events >= d.need.events;
            const prog = Math.min(
              1,
              (counts.meets / Math.max(1, d.need.meets)) * 0.5 +
                (counts.vouches / Math.max(1, d.need.vouches)) * 0.3 +
                (counts.events / Math.max(1, d.need.events || 1)) * 0.2
            );
            return (
              <Card key={d.n} style={cur ? { borderColor: `${d.tone}66` } : undefined}>
                <div className="spread">
                  <div className="row" style={{ gap: 11 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 12, display: 'grid', placeItems: 'center', background: `${d.tone}1e`, color: d.tone, fontFamily: 'var(--display)', fontSize: 17, fontWeight: 700 }}>
                      {d.roman}
                    </div>
                    <div>
                      <div className="row" style={{ gap: 7 }}>
                        <span className="t-md">{d.name}</span>
                        {cur && <Tag style={{ background: `${d.tone}22`, color: d.tone }}>ваша</Tag>}
                        {done && <Icon name="check" size={13} color="var(--green)" />}
                        {d.secret && <Tag tone="violet">закрытая</Tag>}
                      </div>
                      <div className="t-xs dim">{d.line}</div>
                    </div>
                  </div>
                </div>

                {!done && (
                  <>
                    <div style={{ marginTop: 12 }}><Bar value={prog} /></div>
                    <div className="row t-xs dim-2" style={{ marginTop: 8, gap: 14, flexWrap: 'wrap' }}>
                      <span>Встречи {counts.meets}/{d.need.meets}</span>
                      <span>Поручительства {counts.vouches}/{d.need.vouches}</span>
                      <span>События {counts.events}/{d.need.events}</span>
                    </div>
                  </>
                )}

                <div className="stack-8" style={{ marginTop: 12 }}>
                  {d.opens.map((o) => (
                    <div key={o} className="row t-xs" style={{ gap: 8 }}>
                      <Icon name="key" size={12} color={d.tone} />
                      <span className="dim">{o}</span>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}

          {!app.secret && (
            <Card className="row-t" style={{ gap: 12 }}>
              <Icon name="lock" size={18} color="var(--violet)" />
              <div>
                <div className="t-sm">
                  Дальше — <span className="redacted">степень IV</span>, <span className="redacted">степень V</span> и ещё одна
                </div>
                <div className="t-xs dim" style={{ marginTop: 5, lineHeight: 1.5 }}>
                  Официально клуб объявляет три степени. О существовании следующих известно
                  из устава: их названия, состав и порядок перехода не публикуются.
                </div>
              </div>
            </Card>
          )}

          {app.secret && (
            <Btn variant="ghost" wide icon="seal" onClick={() => go('/lodge')}>Войти в ложу</Btn>
          )}
        </div>
      </Section>

      <Card className="row-t" style={{ gap: 11 }}>
        <Icon name="users" size={17} color="var(--gold)" />
        <div className="t-xs dim" style={{ lineHeight: 1.5 }}>
          Быстрее всего степень растёт от подтверждённых встреч и поручительств.
          Написать в чат — не считается: клуб держится на встречах.
        </div>
      </Card>
    </div>
  );
}
