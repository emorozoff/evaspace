import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { Top, List, Item, Section, Note } from '../components/UI.jsx';
import { Seal } from '../components/Art.jsx';
import Icon from '../components/Icons.jsx';
import { LAWS, TRADITIONS, RITUALS, MOTTO, MOTTO_MASKED } from '../data/canon.js';

export default function Codex() {
  const app = useApp();
  return (
    <div className="screen stack-20">
      <Top title="Кодекс" sub="Законы, традиции, ритуалы. Меняется только собранием" right={<button className="iconbtn" onClick={() => go('/club')}><Icon name="back" size={18} /></button>} />

      <Section title="Семь законов">
        <List>
          {LAWS.map((l) => (
            <Item key={l.n} lead={<div className="item__ic display" style={{ fontSize: 17, background: 'var(--gold-soft)' }}>{l.n}</div>} title={<span style={{ whiteSpace: 'normal', fontWeight: 500, fontSize: 14, lineHeight: 1.45 }}>{l.text}</span>} chev={false} />
          ))}
        </List>
        <Note icon="shield" tone="var(--red)">Нарушение разбирает собрание. Крайняя мера — исключение: паспорт аннулируется, доступ закрывается везде, доля выкупается в порядке очереди.</Note>
      </Section>

      <Section title="Пять традиций">
        <List>
          {TRADITIONS.map((t) => (
            <Item key={t.key} lead={<div className="item__ic display" style={{ fontSize: 26, color: 'var(--gold)' }}>{t.key}</div>} title={t.name} sub={t.text} subWrap chev={false} />
          ))}
        </List>
        <div className="t-xs dim-2 center">Порядок традиций закреплён уставом и не меняется.</div>
      </Section>

      <Section title="Ритуалы">
        <List>
          {RITUALS.map((r) => (
            <Item key={r.name} icon="seal" title={r.name} sub={`${r.when}. ${r.text}`} subWrap chev={false} />
          ))}
        </List>
      </Section>

      <div className="card center" style={{ padding: 22 }}>
        <Seal size={84} motto={app.secret ? MOTTO : MOTTO_MASKED} glow={app.secret} onClick={() => app.secret && go('/lodge')} />
        <div className="display" style={{ fontSize: 20, marginTop: 14, letterSpacing: '0.06em' }}>{app.secret ? MOTTO : MOTTO_MASKED}</div>
        <div className="t-xs dim" style={{ marginTop: 6 }}>{app.secret ? 'Из тени — к свету.' : 'Последнее слово на печати стёрлось. В открытой части клуба его не публикуют.'}</div>
      </div>
    </div>
  );
}
