import { useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.jsx';
import { Card, Btn, Section, KV, Tag } from '../components/UI.jsx';
import { Seal, Guilloche } from '../components/Art.jsx';
import Icon from '../components/Icons.jsx';
import { DEGREES, MOTTO, MOTTO_MASKED, RITUALS } from '../data/canon.js';
import { shortHash } from '../lib/chain.js';

export default function Lodge() {
  const app = useApp();
  const [word, setWord] = useState('');
  const [tries, setTries] = useState(0);

  const submit = () => {
    if (!app.tryPassphrase(word)) setTries((t) => t + 1);
    setWord('');
  };

  if (!app.secret) {
    return (
      <div className="screen center" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 70 }}>
        <div style={{ position: 'absolute', top: 40, opacity: 0.1, pointerEvents: 'none' }}>
          <Guilloche color="#8E7BF5" opacity={0.9} size={340} seed="lodge" />
        </div>
        <Seal size={110} color="#8E7BF5" motto={MOTTO_MASKED} />
        <h2 className="display" style={{ marginTop: 24 }}>Дверь без таблички</h2>
        <p className="t-sm dim" style={{ marginTop: 10, maxWidth: 300, lineHeight: 1.55 }}>
          Здесь ничего не написано. Тот, кто должен войти, знает последнее слово девиза.
          Подсказка — в кодексе: пять традиций стоят в правильном порядке не случайно.
        </p>
        <input
          className="field center mono"
          style={{ marginTop: 22, letterSpacing: '0.3em', textTransform: 'uppercase', maxWidth: 260 }}
          value={word}
          placeholder="·····"
          onChange={(e) => setWord(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
        <Btn variant="ghost" style={{ marginTop: 12 }} onClick={submit} disabled={!word.trim()}>Назвать слово</Btn>
        {tries > 0 && <div className="t-xs dim-2" style={{ marginTop: 12 }}>Не то слово. Дверь не открывается.</div>}
        <Btn variant="quiet" size="sm" style={{ marginTop: 26 }} onClick={() => go('/codex')}>Открыть кодекс</Btn>
      </div>
    );
  }

  const secret = DEGREES.filter((d) => d.secret);

  return (
    <div className="screen stack-22">
      <div className="center" style={{ position: 'relative', paddingTop: 6 }}>
        <div style={{ position: 'absolute', top: -30, left: '50%', transform: 'translateX(-50%)', opacity: 0.12, pointerEvents: 'none' }}>
          <Guilloche color="#8E7BF5" opacity={0.9} size={300} seed="lodge2" />
        </div>
        <Seal size={86} color="#8E7BF5" motto={MOTTO} glow />
        <div className="eyebrow" style={{ color: 'var(--violet)', marginTop: 16 }}>Закрытый контур</div>
        <h2 className="display" style={{ marginTop: 5 }}>Ложа</h2>
        <p className="t-sm dim" style={{ marginTop: 10, lineHeight: 1.55 }}>
          Вы прошли дверь. Здесь начинается вторая часть устава — та, о которой в открытом клубе
          известно только то, что она существует.
        </p>
      </div>

      <Card variant="violet">
        <div className="t-md">Что здесь по-другому</div>
        <div className="stack-8" style={{ marginTop: 11 }}>
          {[
            'Степени выше третьей не публикуются: ни имена носителей, ни их количество',
            'Переход возможен только по приглашению двух носителей степени и единогласному решению',
            'Решения ложи между собраниями исполняются, но публикуются протоколом — тайных денег нет',
            'Правила денег, оценки и выхода одни для всех: закрытость касается людей, а не капитала',
          ].map((t) => (
            <div key={t} className="row-t t-xs" style={{ gap: 9 }}>
              <Icon name="key" size={13} color="var(--violet)" style={{ marginTop: 2, flex: 'none' }} />
              <span className="dim" style={{ lineHeight: 1.5 }}>{t}</span>
            </div>
          ))}
        </div>
      </Card>

      <Section eyebrow="Открылось" title="Закрытые степени">
        <div className="stack-8">
          {secret.map((d) => (
            <Card key={d.n} style={{ borderColor: `${d.tone}44` }}>
              <div className="row" style={{ gap: 11 }}>
                <div style={{ width: 38, height: 38, borderRadius: 12, display: 'grid', placeItems: 'center', background: `${d.tone}1e`, color: d.tone, fontFamily: 'var(--display)', fontSize: 18, fontWeight: 700 }}>
                  {d.roman}
                </div>
                <div className="grow">
                  <div className="t-md">{d.name}</div>
                  <div className="t-xs dim" style={{ marginTop: 2 }}>{d.line}</div>
                </div>
              </div>
              <div className="stack-8" style={{ marginTop: 11 }}>
                {d.opens.map((o) => (
                  <div key={o} className="row t-xs" style={{ gap: 8 }}>
                    <Icon name="check" size={12} color={d.tone} />
                    <span className="dim">{o}</span>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </Section>

      <Section eyebrow="Архив" title="Запечатанные решения">
        <div className="stack-8">
          {SEALED.map((s) => (
            <Card key={s.id} className="row" style={{ gap: 12 }}>
              <Icon name="scroll" size={17} color="var(--violet)" />
              <div className="grow">
                <div className="t-sm">{s.title}</div>
                <div className="mono dim-2" style={{ marginTop: 4 }}>{shortHash(s.hash, 16)}</div>
              </div>
              <Tag tone="violet">{s.year}</Tag>
            </Card>
          ))}
        </div>
        <div className="t-xs dim-2" style={{ marginTop: 6, lineHeight: 1.5 }}>
          Тексты закрыты, но хеши опубликованы: когда решение раскрывается, любой резидент может
          проверить, что его не переписали задним числом.
        </div>
      </Section>

      <Card>
        <div className="eyebrow">Ритуал перехода</div>
        <div className="t-sm" style={{ marginTop: 8, lineHeight: 1.55 }}>{RITUALS[3].text}</div>
      </Card>

      <Btn variant="quiet" wide onClick={() => go('/degrees')}>Вернуться к степеням</Btn>
    </div>
  );
}

const SEALED = [
  { id: 1, title: 'Порядок преемственности учредительного круга', year: 2024, hash: 'a3f19c8b77e2d4510cb3a9f2e6d81147c0b5e9a2f7314d68' },
  { id: 2, title: 'Условия раскрытия состава закрытых степеней', year: 2025, hash: '7c2e5a19b4d038f6ea71c93b25d0847fa6b1e3c95d24f870' },
  { id: 3, title: 'Границы права вето и порядок его снятия', year: 2026, hash: 'e91b3d7a25c8f406b9d14e83a7c25f0d3b68e1a94c7d2b50' },
];
