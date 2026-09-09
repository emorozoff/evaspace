import { plural } from './time.js';

/** 137000 → «137 000 ₽» */
export function money(n) {
  const value = Math.round(Number(n) || 0);
  // Неразрывные пробелы: «9 900 ₽» не должно разрываться переносом строки
  return value.toLocaleString('ru-RU').replace(/\s/g, '\u00A0') + '\u00A0₽';
}

/** Короткая форма для плашек: 1 250 000 → «1,25 млн ₽» */
export function moneyShort(n) {
  const value = Math.round(Number(n) || 0);
  if (Math.abs(value) >= 1_000_000) return (value / 1_000_000).toFixed(2).replace('.', ',').replace(/,?0+$/, '') + '\u00A0млн\u00A0₽';
  if (Math.abs(value) >= 10_000) return Math.round(value / 1000) + '\u00A0тыс\u00A0₽';
  return money(value);
}

export function hours(n) {
  const v = Math.round(Number(n) || 0);
  return `${v} ${plural(v, 'час', 'часа', 'часов')}`;
}

export function people(n) {
  return `${n} ${plural(n, 'человек', 'человека', 'человек')}`;
}

export function initials(name = '') {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] || '')
    .join('')
    .toUpperCase();
}

/** Устойчивое число из строки — для цветов аватарок и «случайных» решений. */
export function hash(str = '') {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export function uid(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`;
}

export function csvEscape(v) {
  const s = String(v ?? '');
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Выгрузка таблицы в CSV — открывается в Excel и Google Таблицах. */
export function downloadCsv(filename, rows) {
  const text = '﻿' + rows.map((r) => r.map(csvEscape).join(';')).join('\n');
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
