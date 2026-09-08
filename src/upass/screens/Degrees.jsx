import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { Top, List, Item, Btn, Section, Bar, Tag, Note } from '../components/UI.jsx';
import Icon from '../components/Icons.jsx';
import { TIERS, DEGREES } from '../data/canon.js';
import { usdExact } from '../lib/format.js';

export default function Degrees() {
  const app = useApp();
  const { me, counts } = app;
  const visible = DEGREES.filter((d) => !d.secret || app.secret);

  return (
    <div className="screen stack-20">
      <Top title="Уровень и степень" sub="Уровень оплачивается, степень зарабатывается" right={<button className="iconbtn" onClick={() => go('/club')}><Icon name="back" size={18} /></button>} />

      <Section title="Уровень членства">
        <List>
          {TIERS.map((t) => (
            <Item
              key={t.n}
              lead={<div style={{ width: 6, height: 40, borderRadius: 3, flex: 'none', background: `linear-gradient(180deg, ${t.edge[0]}, ${t.edge[1]})`, marginLeft: 8, marginRight: 8, opacity: t.open ? 1 : 0.5 }} />}
              title={
                <span className="row" style={{ gap: 7 }}>
                  {t.name}
                  {t.open && <Tag tone="gold">ваш</Tag>}
                  {t.soon && <Tag>скоро</Tag>}
                  {t.invite && <Tag tone="violet">по приглашению</Tag>}
                </span>
              }
              sub={t.perks.join(' · ')}
              subWrap
              meta={<span>{t.price ? `${usdExact(t.price)} / год` : t.invite ? '—' : 'позже'}</span>}
              chev={false}
            />
          ))}
        </List>
        <Note icon="eye">Сейчас в сообществе один уровень — Travel. Business и Gold откроются, когда для них появится что предложить. Black был и остаётся закрытым.</Note>
      </Section>

      <Section title="Степень">
        <List>
          {visible.map((d) => {
            const cur = me.degree === d.n;
            const done = me.degree >= d.n;
            const prog = Math.min(1, (counts.meets / Math.max(1, d.need.meets)) * 0.5 + (counts.vouches / Math.max(1, d.need.vouches)) * 0.3 + (counts.events / Math.max(1, d.need.events || 1)) * 0.2);
            return (
              <Item
                key={d.n}
                lead={<div className="item__ic display" style={{ fontSize: 17, background: `${d.tone}1e`, color: d.tone }}>{d.roman}</div>}
                title={
                  <span className="row" style={{ gap: 7 }}>
                    {d.name}
                    {cur && <Tag style={{ background: `${d.tone}22`, color: d.tone }}>ваша</Tag>}
                    {d.secret && <Tag tone="violet">закрытая</Tag>}
                  </span>
                }
                sub={done ? d.opens.join(' · ') : `Нужно: встречи ${counts.meets}/${d.need.meets}, поручительства ${counts.vouches}/${d.need.vouches}, события ${counts.events}/${d.need.events}`}
                subWrap
                meta={done ? <Icon name="check" size={16} color="var(--green)" /> : <div style={{ width: 48 }}><Bar value={prog} /></div>}
                chev={false}
              />
            );
          })}
          {!app.secret && (
            <Item
              icon="lock"
              title={<span>Дальше — <span className="redacted">степень IV</span> и ещё две</span>}
              sub="Официально объявлены три степени. О следующих известно из устава, но их названия и состав не публикуются."
              subWrap
              chev={false}
            />
          )}
        </List>
        {app.secret && <Btn variant="ghost" wide icon="seal" onClick={() => go('/lodge')}>Войти в ложу</Btn>}
      </Section>

      <Note icon="cup">Быстрее всего степень растёт от подтверждённых встреч и поручительств. Написать в чат — не считается.</Note>
    </div>
  );
}
