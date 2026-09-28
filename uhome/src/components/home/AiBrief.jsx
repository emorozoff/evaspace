import { go } from '../../lib/router.jsx';
import { assistantOf, greeting } from '../../lib/assistant.js';
import { reasons } from '../../lib/intro.js';
import { upcomingFor } from '../../lib/select.js';
import { plural } from '../../lib/format.js';
import { AvatarPortrait } from '../AvatarArt.jsx';
import Icon from '../Icons.jsx';

/* Ассистент на главной — тонкая строка-сводка: портрет с пульсом,
   моноширинная подпись и одна-две строки по делу. До теста — приглашение
   его пройти: без ответов ассистенту не из чего собирать людей. */

const first = (t) => (t.match(/^[^.?!]+[.?!]/) || [t])[0];

export default function AiBrief({ app }) {
  const A = assistantOf(app);

  if (!app.me.tested) {
    return (
      <button className="hai hai--test" onClick={() => go('/test')}>
        <span className="hai__ava"><AvatarPortrait who={A.id} size={44} /></span>
        <span className="hai__body">
          <span className="hai__k"><b>{A.name}</b> · тест · 1 минута</span>
          <span className="hai__t">Восемь вопросов — и я соберу вашу мастер-группу и нужных вам людей.</span>
          <span className="hai__cta">Пройти тест<span aria-hidden="true">→</span></span>
        </span>
      </button>
    );
  }

  const n = reasons(app, 12).length;
  const week = upcomingFor(app, 12).filter((e) => e.inDays <= 7).length;
  const Found = A.found[0].toUpperCase() + A.found.slice(1);
  const parts = [];
  if (n) parts.push(`${n} ${plural(n, 'знакомство', 'знакомства', 'знакомств')}`);
  if (week) parts.push(`${week} ${plural(week, 'событие', 'события', 'событий')}`);
  const hello = first(greeting(app));

  return (
    <button className="hai" onClick={() => go('/ai')}>
      <span className="hai__ava"><AvatarPortrait who={A.id} size={44} /></span>
      <span className="hai__body">
        <span className="hai__k"><b>{A.name}</b> · ассистент<i className="hai__on">на связи</i></span>
        {parts.length ? (
          <span className="hai__t"><span className="hai__hello">{hello} </span>{Found} <b>{parts.join(' и ')}</b>.</span>
        ) : (
          <span className="hai__t">{greeting(app)}</span>
        )}
      </span>
      <Icon name="right" size={16} className="chev" />
    </button>
  );
}
