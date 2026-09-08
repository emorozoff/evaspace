import { useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { Top, List, Item, Btn, Section, Tag, Note } from '../components/UI.jsx';
import { Seal } from '../components/Art.jsx';
import Icon from '../components/Icons.jsx';
import { DEGREES, MOTTO, MOTTO_MASKED, RITUALS } from '../data/canon.js';
import { shortHash } from '../lib/chain.js';

const SEALED = [
  { id: 1, title: 'Порядок преемственности учредительного круга', year: 2024, hash: 'a3f19c8b77e2d4510cb3a9f2e6d81147c0b5e9a2f7314d68' },
  { id: 2, title: 'Условия раскрытия состава закрытых степеней', year: 2025, hash: '7c2e5a19b4d038f6ea71c93b25d0847fa6b1e3c95d24f870' },
  { id: 3, title: 'Границы права вето и порядок его снятия', year: 2026, hash: 'e91b3d7a25c8f406b9d14e83a7c25f0d3b68e1a94c7d2b50' },
];

export default function Lodge() {
  const app = useApp();
  const [word, setWord] = useState('');
  const [tries, setTries] = useState(0);
  const submit = () => { if (!app.tryPassphrase(word)) setTries((t) => t + 1); setWord(''); };

  if (!app.secret) {
    return (
      <div className="screen center" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 70 }}>
        <Seal size={104} color="#8E7BF5" motto={MOTTO_MASKED} />
        <h2 className="h2" style={{ marginTop: 22 }}>Дверь без таблички</h2>
        <p className="t-sm dim" style={{ marginTop: 10, maxWidth: 300, lineHeight: 1.55 }}>Тот, кто должен войти, знает последнее слово девиза. Подсказка — в кодексе.</p>
        <input className="field center mono" style={{ marginTop: 22, letterSpacing: '0.3em', textTransform: 'uppercase', maxWidth: 260 }} value={word} placeholder="·····" onChange={(e) => setWord(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
        <Btn variant="ghost" style={{ marginTop: 12 }} onClick={submit} disabled={!word.trim()}>Назвать слово</Btn>
        {tries > 0 && <div className="t-xs dim-2" style={{ marginTop: 12 }}>Не то слово.</div>}
        <Btn variant="quiet" size="sm" style={{ marginTop: 26 }} onClick={() => go('/codex')}>Открыть кодекс</Btn>
      </div>
    );
  }

  const secret = DEGREES.filter((d) => d.secret);
  return (
    <div className="screen stack-20">
      <div className="center" style={{ paddingTop: 8 }}>
        <Seal size={84} color="#8E7BF5" motto={MOTTO} glow />
        <div className="eyebrow" style={{ color: 'var(--violet)', marginTop: 14 }}>Закрытый контур</div>
        <h1 className="h1" style={{ marginTop: 4 }}>Ложа</h1>
        <p className="t-sm dim" style={{ marginTop: 8, lineHeight: 1.5 }}>Вторая часть устава — та, о которой в открытом клубе известно только то, что она существует.</p>
      </div>

      <div className="card card--violet">
        <div className="stack-8">
          {['Степени выше третьей не публикуются: ни имена, ни количество носителей', 'Переход — по приглашению двух носителей степени и единогласному решению', 'Решения ложи между собраниями публикуются протоколом — тайных денег нет', 'Правила денег, оценки и выхода одни для всех: закрытость касается людей, а не капитала'].map((t) => (
            <div key={t} className="row-t t-sm" style={{ gap: 9 }}><Icon name="key" size={14} color="var(--violet)" style={{ marginTop: 3, flex: 'none' }} /><span className="dim" style={{ lineHeight: 1.45 }}>{t}</span></div>
          ))}
        </div>
      </div>

      <Section title="Закрытые степени">
        <List>
          {secret.map((d) => (
            <Item key={d.n} lead={<div className="item__ic display" style={{ fontSize: 18, background: `${d.tone}1e`, color: d.tone }}>{d.roman}</div>} title={d.name} sub={`${d.line}. ${d.opens.join(' · ')}`} subWrap chev={false} />
          ))}
        </List>
      </Section>

      <Section title="Запечатанные решения">
        <List>
          {SEALED.map((s) => <Item key={s.id} icon="scroll" title={s.title} sub={shortHash(s.hash, 16)} meta={<Tag tone="violet">{s.year}</Tag>} chev={false} />)}
        </List>
        <Note icon="hash">Тексты закрыты, но хеши опубликованы: когда решение раскрывается, любой резидент проверит, что его не переписали.</Note>
      </Section>

      <Note icon="seal">{RITUALS[3].text}</Note>
      <Btn variant="quiet" wide onClick={() => go('/degrees')}>К степеням</Btn>
    </div>
  );
}
