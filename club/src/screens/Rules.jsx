import { useStore } from '../lib/store.jsx';
import { CODE, CODE_SHORT } from '../data/rules.js';
import { Card, Note, TopBar } from '../components/UI.jsx';
import Icon from '../components/Icons.jsx';

/* Кодекс клуба целиком. Короткая версия висит в чатах, здесь — разбор
   по случаям: что считается нарушением и что за этим следует. */

export default function Rules() {
  const { state } = useStore();
  return (
    <div className="screen" style={{ paddingTop: 0 }}>
      <TopBar title="Кодекс клуба" sub="Правила, по которым живёт И АЙ КЛАБ" backTo="/profile" />
      <div className="stack-20">
        <Card variant="accent">
          <div className="t-lg">Если коротко</div>
          <div className="rules" style={{ marginTop: 12 }}>
            {CODE_SHORT.map((r, i) => (
              <div key={r} className="rules__i"><span className="rules__n">{i + 1}</span><span>{r}</span></div>
            ))}
          </div>
        </Card>

        {CODE.map((block) => (
          <section key={block.id} className="stack-8">
            <div className="row" style={{ padding: '0 4px' }}>
              <span className="code__ic"><Icon name={block.icon} size={17} /></span>
              <span className="t-lg">{block.title}</span>
            </div>
            <div className="terms">
              {block.items.map(([title, text]) => (
                <div key={title} className="term term--static">
                  <div className="t-md">{title}</div>
                  <div className="term__x">{text}</div>
                </div>
              ))}
            </div>
          </section>
        ))}

        <Note icon="shield">
          Кодекс действует с первого дня в клубе и одинаков для всех — резидентов, капитанов и куратора.
          Вопрос по спорной ситуации — куратору {state.users.find((u) => u.admin)?.name || 'клуба'} в личные сообщения.
        </Note>
      </div>
    </div>
  );
}
