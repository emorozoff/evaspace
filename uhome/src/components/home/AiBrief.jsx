import { go } from '../../lib/router.jsx';
import { assistantOf, insight } from '../../lib/assistant.js';
import { AvatarPortrait } from '../AvatarArt.jsx';
import Icon from '../Icons.jsx';

/* Ассистент на главной — одна строка: портрет, имя, одна мысль по делу.
   До теста — приглашение его пройти: без ответов ассистенту не из чего
   собирать людей. */

const first = (t) => (t.match(/^[^.?!]+[.?!]/) || [t])[0].trim();

export default function AiBrief({ app }) {
  const A = assistantOf(app);
  const tested = app.me.tested;
  const line = tested ? first(insight(app).text) : `Восемь вопросов — и ${A.name} соберёт вашу мастер-группу и нужных вам людей.`;
  return (
    <button className="card card--gold h-brief tap" onClick={() => go(tested ? '/ai' : '/test')}>
      <AvatarPortrait who={A.id} size={44} />
      <span className="h-brief__body">
        <span className="h-brief__k">{tested ? `${A.name} · ассистент` : `${A.name} · тест за минуту`}</span>
        <span className="h-brief__t">{line}</span>
      </span>
      <Icon name="right" size={16} className="chev" />
    </button>
  );
}
