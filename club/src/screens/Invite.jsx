import { useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { referralStats, referralLink, REFERRAL_BONUS } from '../lib/logic.js';
import { dateShort } from '../lib/time.js';
import { money } from '../lib/format.js';
import { Btn, Card, Empty, List, Item, Section, Stat, Tag, TopBar } from '../components/UI.jsx';

const STORY = `Я в И АЙ КЛАБ — клубе, где предприниматели внедряют ИИ и собирают команды на сезон. Каждую пятницу встречаемся в своём городе, а команды соревнуются по выручке. Заходи по моей ссылке — первый месяц со скидкой 10%.`;

export default function Invite() {
  const { state, me } = useStore();
  const stats = referralStats(state, me.id);
  const link = referralLink(me);
  const [copied, setCopied] = useState(false);

  const copy = async (text) => {
    try { await navigator.clipboard.writeText(text); } catch { /* старый браузер */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  const share = async () => {
    if (navigator.share) { try { await navigator.share({ title: 'И АЙ КЛАБ', text: `${STORY}\n\n${link}` }); return; } catch { /* передумал */ } }
    copy(`${STORY}\n\n${link}`);
  };

  return (
    <div className="screen" style={{ paddingTop: 0 }}>
      <TopBar title="Пригласить друга" sub="Скидка другу, бонус вам" backTo="/" />
      <div className="stack-20">
        <Card variant="accent">
          <div className="eyebrow">Ваша ссылка</div>
          <div className="t-sm num" style={{ marginTop: 6, wordBreak: 'break-all' }}>{link}</div>
          <div className="pair" style={{ marginTop: 12 }}>
            <Btn variant="accent" size="sm" icon="share" onClick={share}>Поделиться</Btn>
            <Btn variant="ghost" size="sm" icon={copied ? 'check' : 'link'} onClick={() => copy(link)}>{copied ? 'Скопировано' : 'Скопировать'}</Btn>
          </div>
        </Card>

        <div className="stats">
          <Stat v={stats.visited} l="перешли" />
          <Stat v={stats.paid} l="оплатили" />
          <Stat v={money(me.bonus || 0)} l="бонусов" tone="var(--accent)" />
        </div>

        <List>
          <Item icon="gift" title="Другу — скидка 10%" sub="На первый месяц любого пакета" chev={false} />
          <Item icon="money" title={`Вам — ${money(REFERRAL_BONUS)} бонусами`} sub="За каждого, кто оплатил. Бонусы идут на подписку или билеты" chev={false} />
        </List>

        <Section title="Текст для сторис" more={copied ? 'Скопировано' : 'Скопировать'} onMore={() => copy(`${STORY}\n\n${link}`)}>
          <Card><div className="t-sm dim" style={{ lineHeight: 1.55 }}>{STORY}</div></Card>
        </Section>

        <Section title="История">
          {stats.list.length === 0 && !state.bonusLog.some((b) => b.userId === me.id) ? (
            <Empty icon="gift" title="Пока никого" text="Отправьте ссылку тем, кому клуб реально пригодится." />
          ) : (
            <List>
              {stats.list.map((r) => {
                const invited = state.users.find((u) => u.id === r.invitedId);
                return <Item key={r.id} icon="user" title={invited?.name || 'Новый участник'} sub={dateShort(r.at)} meta={<Tag tone={r.status === 'paid' ? 'accent' : 'warm'}>{r.status === 'paid' ? `+${money(r.bonus)}` : 'перешёл'}</Tag>} chev={false} />;
              })}
              {state.bonusLog.filter((b) => b.userId === me.id).map((b) => (
                <Item key={b.id} icon="money" title={b.reason} sub={dateShort(b.at)} meta={<span className={b.amount > 0 ? 'accent' : 'red'}>{b.amount > 0 ? '+' : ''}{money(b.amount)}</span>} chev={false} />
              ))}
            </List>
          )}
        </Section>
      </div>
    </div>
  );
}
