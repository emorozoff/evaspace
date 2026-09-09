import { useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { readImage } from '../lib/image.js';
import { money } from '../lib/format.js';
import { Btn, Field, KV, Sheet } from './UI.jsx';

/* Внести выручку: сумма, за что, скриншот. Рядом — сэкономленные часы. */

export default function RevenueSheet({ open, teamId, entry, onClose }) {
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
    try { setProof(await readImage(file)); setError(''); } catch (err) { setError(err.message); }
  };

  const submit = () => {
    if (entry) dispatch({ type: 'revenueEdit', id: entry.id, patch: { amount: value, comment, hours: Number(hours) || 0, proof } });
    else dispatch({ type: 'revenueAdd', teamId, amount: value, comment, hours: Number(hours) || 0, proof });
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title={entry ? 'Изменить запись' : 'Добавить выручку'} sub={entry ? 'Правки доступны 48 часов' : 'Записи складываются в сумму за сезон'}>
      <div className="stack">
        <Field label="Сумма, ₽" hint={value > 0 ? `В копилку клуба уйдёт ${money(Math.round(value * 0.1))} — это 10%` : undefined}>
          <input className="field" inputMode="numeric" placeholder="120 000" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="За что"><input className="field" placeholder="Пилот с сетью из 4 точек" value={comment} onChange={(e) => setComment(e.target.value)} /></Field>
        <Field label="Сэкономленные часы"><input className="field" inputMode="numeric" placeholder="8" value={hours} onChange={(e) => setHours(e.target.value)} /></Field>
        <Field label="Скриншот — необязательно" hint={error || 'Никто не проверяет цифры автоматически — это про честность'}>
          <input className="field" type="file" accept="image/*" onChange={pickFile} />
        </Field>
        {proof && proof.startsWith('data:') && <img src={proof} alt="" style={{ width: '100%', borderRadius: 12 }} />}
        <Btn variant="accent" wide disabled={value <= 0} onClick={submit}>{entry ? 'Сохранить' : 'Записать'}</Btn>
        {entry && <Btn variant="danger" wide onClick={() => { dispatch({ type: 'revenueDelete', id: entry.id }); onClose(); }}>Удалить запись</Btn>}
      </div>
    </Sheet>
  );
}

/** Копилка: команда сама отмечает перевод и прикладывает подтверждение. */
export function ContributionSheet({ open, teamId, stats, onClose }) {
  const { dispatch } = useStore();
  const [amount, setAmount] = useState(String(stats.debt || ''));
  const [proof, setProof] = useState('');
  const value = Number(String(amount).replace(/[^\d]/g, '')) || 0;
  return (
    <Sheet open={open} onClose={onClose} title="Взнос в копилку" sub="10% от внесённой выручки">
      <div className="stack">
        <div className="card">
          <KV k="Выручка сезона" v={money(stats.total)} />
          <KV k="Нужно перевести" v={money(stats.required)} />
          <KV k="Уже отмечено" v={money(stats.paid)} tone="var(--accent)" />
          <KV k="Осталось" v={money(stats.debt)} tone="var(--warm)" />
        </div>
        <Field label="Сумма перевода, ₽"><input className="field" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
        <Field label="Подтверждение"><input className="field" placeholder="Ссылка на чек или номер операции" value={proof} onChange={(e) => setProof(e.target.value)} /></Field>
        <Btn variant="accent" wide disabled={value <= 0} onClick={() => { dispatch({ type: 'contributionAdd', teamId, amount: value, proof }); onClose(); }}>Отметить перевод</Btn>
        <div className="t-xs dim-2 center">Пока взнос не отмечен, эта часть выручки не засчитывается в рейтинг.</div>
      </div>
    </Sheet>
  );
}
