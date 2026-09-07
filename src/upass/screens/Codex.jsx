import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { Card, Section, Btn, Tag } from '../components/UI.jsx';
import { Seal, Guilloche } from '../components/Art.jsx';
import Icon from '../components/Icons.jsx';
import { LAWS, TRADITIONS, RITUALS, MOTTO, MOTTO_MASKED } from '../data/canon.js';

export default function Codex() {
  const app = useApp();
  return (
    <div className="screen stack-22">
      <div style={{ position: 'relative' }}>
        <div style={{ position: 'absolute', right: -60, top: -50, opacity: 0.14, pointerEvents: 'none' }}>
          <Guilloche color="#D7B06A" opacity={0.8} size={260} seed="codex" />
        </div>
        <div className="eyebrow">Устав сообщества</div>
        <h2 className="display" style={{ marginTop: 3, position: 'relative' }}>Кодекс</h2>
        <p className="t-sm dim" style={{ marginTop: 8, lineHeight: 1.55, position: 'relative' }}>
          Три части: законы, которые нельзя нарушать; традиции, которые держат круг;
          ритуалы, которые отмечают переходы. Меняется только голосованием собрания.
        </p>
      </div>

      <Section eyebrow="Часть первая" title="Семь законов">
        <div className="stack-8">
          {LAWS.map((l) => (
            <Card key={l.n} className="row-t" style={{ gap: 13 }}>
              <div className="display gold" style={{ fontSize: 20, width: 26, flex: 'none', textAlign: 'center' }}>{l.n}</div>
              <div className="t-sm" style={{ lineHeight: 1.55 }}>{l.text}</div>
            </Card>
          ))}
        </div>
        <Card className="row-t" style={{ gap: 11, marginTop: 4 }}>
          <Icon name="shield" size={17} color="var(--red)" />
          <div className="t-xs dim">
            Нарушение разбирает собрание. Крайняя мера — исключение: паспорт аннулируется,
            доступ закрывается во всех локациях, доля выкупается в порядке очереди.
          </div>
        </Card>
      </Section>

      <Section eyebrow="Часть вторая" title="Пять традиций">
        <div className="stack-8">
          {TRADITIONS.map((t) => (
            <Card key={t.key} className="row-t" style={{ gap: 13 }}>
              <div
                className="display"
                style={{ fontSize: 30, width: 30, flex: 'none', textAlign: 'center', color: 'var(--gold)', lineHeight: 1 }}
              >
                {t.key}
              </div>
              <div>
                <div className="t-md">{t.name}</div>
                <div className="t-xs dim" style={{ marginTop: 4, lineHeight: 1.5 }}>{t.text}</div>
              </div>
            </Card>
          ))}
        </div>
        <div className="t-xs dim-2 center" style={{ marginTop: 6 }}>
          Порядок традиций закреплён уставом и не меняется.
        </div>
      </Section>

      <Section eyebrow="Часть третья" title="Ритуалы">
        <div className="stack-8">
          {RITUALS.map((r) => (
            <Card key={r.name}>
              <div className="t-md">{r.name}</div>
              <div className="eyebrow" style={{ marginTop: 5 }}>{r.when}</div>
              <div className="t-xs dim" style={{ marginTop: 7, lineHeight: 1.55 }}>{r.text}</div>
            </Card>
          ))}
        </div>
      </Section>

      <Card className="center" style={{ padding: 24 }}>
        <Seal size={92} motto={app.secret ? MOTTO : MOTTO_MASKED} glow={app.secret} onClick={() => app.secret && go('/lodge')} />
        <div className="eyebrow eyebrow--gold" style={{ marginTop: 16 }}>Девиз клуба</div>
        <div className="display" style={{ fontSize: 22, marginTop: 6, letterSpacing: '0.06em' }}>
          {app.secret ? MOTTO : MOTTO_MASKED}
        </div>
        <div className="t-xs dim" style={{ marginTop: 10, lineHeight: 1.5, maxWidth: 300, margin: '10px auto 0' }}>
          {app.secret
            ? 'Из тени — к свету. Полный девиз известен тем, кто прошёл дверь без таблички.'
            : 'Последнее слово на печати стёрлось от времени. В открытой части клуба его не публикуют.'}
        </div>
      </Card>

      <Card>
        <div className="t-md">Полный текст устава</div>
        <div className="t-xs dim" style={{ marginTop: 5, lineHeight: 1.5 }}>
          Тридцать восемь страниц: правила оценки активов, распределения прибыли, выхода из
          кооператива, приёма и исключения участников, наследования доли.
        </div>
        <Btn variant="quiet" size="sm" wide style={{ marginTop: 12 }} onClick={() => go('/vault')}>
          Открыть в базе знаний
        </Btn>
      </Card>
    </div>
  );
}
