import { useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { readImage } from '../lib/image.js';
import { money } from '../lib/format.js';
import { Btn, Input, Area, Sheet, Field } from './UI.jsx';

/* Внести выручку: сумма, за что, скриншот. Рядом — сэкономленные часы. */

export default function RevenueSheet({ teamId, entry, onClose }) {
  const { dispatch } = useStore();
  const [amount, setAmount] = useState(entry ? String(entry.amount) : '');
  const [comment, setComment] = useState(entry?.comment || '');
  const [hours, setHours] = useState(entry ? String(entry.hours || '') : '');
  const [proof, setProof] = useState(entry?.proof || '');
  const [error, setError] = useState('');

  const value = Number(String(amount).replace(/[^\d]/g, '')) || 0;

  const pickFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setProof(await readImage(file));
      setError('');
    } catch (err) {
      setError(err.message);
    }
  };

  const submit = () => {
    if (entry) dispatch({ type: 'revenueEdit', id: entry.id, patch: { amount: value, comment, hours: Number(hours) || 0, proof } });
    else dispatch({ type: 'revenueAdd', teamId, amount: value, comment, hours: Number(hours) || 0, proof });
    onClose();
  };

  return (
    <Sheet
      title={entry ? 'Изменить запись' : 'Добавить выручку'}
      sub={entry ? 'Правки доступны 48 часов после записи' : 'Записи складываются в сумму за сезон'}
      onClose={onClose}
    >
      <div className="stack">
        <Input
          label="Сумма, ₽"
          inputMode="numeric"
          placeholder="120 000"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          hint={value > 0 ? `В копилку клуба уйдёт ${money(Math.round(value * 0.1))} — это 10%` : ' '}
        />
        <Area label="За что" placeholder="Одной строкой: пилот с сетью из 4 точек" value={comment} onChange={(e) => setComment(e.target.value)} />
        <Input label="Сэкономленные часы" inputMode="numeric" placeholder="8" value={hours} onChange={(e) => setHours(e.target.value)} />

        <Field label="Скриншот (необязательно)" hint={error || 'Никто не проверяет цифры автоматически — это про честность'}>
          <input type="file" accept="image/*" onChange={pickFile} />
        </Field>
        {proof && proof.startsWith('data:') && (
          <img src={proof} alt="Подтверждение" style={{ width: '100%', borderRadius: 12, border: '1px solid var(--line)' }} />
        )}

        <Btn kind="primary" wide disabled={value <= 0} onClick={submit}>
          {entry ? 'Сохранить' : 'Записать'}
        </Btn>
        {entry && (
          <Btn
            kind="danger"
            wide
            onClick={() => {
              dispatch({ type: 'revenueDelete', id: entry.id });
              onClose();
            }}
          >
            Удалить запись
          </Btn>
        )}
      </div>
    </Sheet>
  );
}

/** Копилка: команда сама отмечает перевод и прикладывает подтверждение. */
export function ContributionSheet({ teamId, stats, onClose }) {
  const { dispatch } = useStore();
  const [amount, setAmount] = useState(String(stats.debt || ''));
  const [proof, setProof] = useState('');
  const value = Number(String(amount).replace(/[^\d]/g, '')) || 0;

  return (
    <Sheet title="Взнос в копилку" sub="10% от внесённой выручки" onClose={onClose}>
      <div className="stack">
        <div className="card flat" style={{ padding: 0 }}>
          <div className="split"><span className="t-sub">Выручка сезона</span><b className="mono">{money(stats.total)}</b></div>
          <div className="split"><span className="t-sub">Нужно перевести</span><b className="mono">{money(stats.required)}</b></div>
          <div className="split"><span className="t-sub">Уже отмечено</span><b className="mono t-lime">{money(stats.paid)}</b></div>
          <div className="split"><span className="t-sub">Осталось</span><b className="mono t-amber">{money(stats.debt)}</b></div>
        </div>
        <Input label="Сумма перевода, ₽" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <Input label="Подтверждение" placeholder="Ссылка на чек или номер операции" value={proof} onChange={(e) => setProof(e.target.value)} />
        <Btn
          kind="primary"
          wide
          disabled={value <= 0}
          onClick={() => {
            dispatch({ type: 'contributionAdd', teamId, amount: value, proof });
            onClose();
          }}
        >
          Отметить перевод
        </Btn>
        <div className="t-dim center">
          Пока взнос не отмечен, эта часть выручки не засчитывается в рейтинг.
        </div>
      </div>
    </Sheet>
  );
}
