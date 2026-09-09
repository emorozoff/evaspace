import { useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { referralStats, referralLink, REFERRAL_BONUS } from '../lib/logic.js';
import { dateShort } from '../lib/time.js';
import { money } from '../lib/format.js';
import { Btn, Card, Empty, Stat, TopBar } from '../components/UI.jsx';
import { IcShare, IcDownload, IcCheck } from '../components/Icons.jsx';

const STORY_TEXT = `Я в И АЙ КЛАБ — клубе, где предприниматели внедряют ИИ и собирают команды на сезон.
Каждую пятницу встречаемся в своём городе, раз в неделю разбираем чужие цифры, а команды соревнуются по выручке.
Заходи по моей ссылке — первый месяц со скидкой 10%.`;

export default function Invite() {
  const { state, me } = useStore();
  const stats = referralStats(state, me.id);
  const link = referralLink(me);
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const text = `${STORY_TEXT}\n\n${link}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'И АЙ КЛАБ', text });
        return;
      } catch {
        /* пользователь передумал */
      }
    }
    copy(text);
  };

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const area = document.createElement('textarea');
      area.value = text;
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="screen">
      <TopBar title="Пригласить друга" sub="Личная ссылка и бонусы" />

      <div className="hero">
        <div className="t-dim">Ваша ссылка</div>
        <div className="mono" style={{ marginTop: 6, wordBreak: 'break-all', fontSize: 13 }}>{link}</div>
        <div className="btn-row" style={{ marginTop: 12 }}>
          <Btn kind="primary" onClick={share}>
            <IcShare /> Поделиться
          </Btn>
          <Btn kind="soft" onClick={() => copy(link)}>
            {copied ? <><IcCheck /> Скопировано</> : 'Скопировать'}
          </Btn>
        </div>
      </div>

      <div className="grid3" style={{ marginTop: 10 }}>
        <Stat value={stats.visited} label="перешли" />
        <Stat value={stats.paid} label="оплатили" />
        <Stat value={money(me.bonus || 0)} label="бонусов" tone="t-lime" />
      </div>

      <Card style={{ marginTop: 10 }}>
        <div className="t-title">Как это работает</div>
        <div className="stack s" style={{ marginTop: 8 }}>
          <div className="t-sub">· Друг получает скидку 10% на первый месяц</div>
          <div className="t-sub">· Вам приходит {money(REFERRAL_BONUS)} бонусами за каждого оплатившего</div>
          <div className="t-sub">· Бонусами можно оплатить часть следующей подписки или билет на мероприятие</div>
        </div>
      </Card>

      <div className="section"><h2>Готовый текст для сторис</h2></div>
      <Card>
        <div className="t-sub" style={{ whiteSpace: 'pre-line' }}>{STORY_TEXT}</div>
        <div className="btn-row" style={{ marginTop: 12 }}>
          <Btn kind="soft" small onClick={() => copy(`${STORY_TEXT}\n\n${link}`)}>Скопировать текст</Btn>
          <StoryButton link={link} />
        </div>
      </Card>

      <div className="section"><h2>История</h2></div>
      {stats.list.length === 0 && state.bonusLog.filter((b) => b.userId === me.id).length === 0 ? (
        <Empty title="Пока никого" text="Отправьте ссылку тем, кому клуб реально пригодится." />
      ) : (
        <Card>
          {stats.list.map((r) => {
            const invited = state.users.find((u) => u.id === r.invitedId);
            return (
              <div key={r.id} className="lead" style={{ gridTemplateColumns: '1fr auto' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{invited?.name || 'Новый участник'}</div>
                  <div className="t-dim">{dateShort(r.at)}</div>
                </div>
                <span className={`chip ${r.status === 'paid' ? 'on' : 'warn'}`}>
                  {r.status === 'paid' ? `+${money(r.bonus)}` : 'перешёл'}
                </span>
              </div>
            );
          })}
          {state.bonusLog
            .filter((b) => b.userId === me.id)
            .map((b) => (
              <div key={b.id} className="lead" style={{ gridTemplateColumns: '1fr auto' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{b.reason}</div>
                  <div className="t-dim">{dateShort(b.at)}</div>
                </div>
                <span className={`mono ${b.amount > 0 ? 't-lime' : 't-red'}`}>
                  {b.amount > 0 ? '+' : ''}
                  {money(b.amount)}
                </span>
              </div>
            ))}
        </Card>
      )}
    </div>
  );
}

/** Картинка для сторис рисуется на канвасе — ничего не грузим из сети. */
function StoryButton({ link }) {
  const [busy, setBusy] = useState(false);

  const make = async () => {
    setBusy(true);
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext('2d');

    const bg = ctx.createLinearGradient(0, 0, 1080, 1920);
    bg.addColorStop(0, '#0b0e13');
    bg.addColorStop(1, '#161d29');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 1080, 1920);

    // искра — та же четырёхлучевая звезда, что и на иконке
    ctx.fillStyle = '#c8f751';
    ctx.beginPath();
    for (let a = 0; a <= Math.PI * 2 + 0.01; a += 0.01) {
      const cos = Math.cos(a);
      const sin = Math.sin(a);
      const x = 540 + 210 * Math.sign(cos) * Math.abs(cos) ** 2.2;
      const y = 560 + 210 * Math.sign(sin) * Math.abs(sin) ** 2.2;
      if (a === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.fillStyle = '#eaf0f6';
    ctx.font = '800 96px Manrope, sans-serif';
    ctx.fillText('И АЙ КЛАБ', 540, 1000);

    ctx.fillStyle = '#8a94a6';
    ctx.font = '500 44px Manrope, sans-serif';
    const lines = ['Клуб предпринимателей,', 'которые внедряют ИИ', 'и собирают команды на сезон'];
    lines.forEach((line, i) => ctx.fillText(line, 540, 1110 + i * 62));

    ctx.fillStyle = '#c8f751';
    ctx.font = '700 38px Manrope, sans-serif';
    ctx.fillText('Скидка 10% по ссылке', 540, 1400);
    ctx.fillStyle = '#5d6779';
    ctx.font = '500 28px Manrope, sans-serif';
    ctx.fillText(link, 540, 1460);

    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'iai-club-story.png';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setBusy(false);
    }, 'image/png');
  };

  return (
    <Btn kind="soft" small onClick={make} disabled={busy}>
      <IcDownload /> Картинка
    </Btn>
  );
}
