// Ненастоящий «мозг» для проверки на своём компьютере: ASKA_FAKE_AI=1 node server/src/index.js
// На сервере не используется. Отвечает заготовками, чтобы было видно, как боты печатают и отвечают.
import { parseParty } from './personas.js';

const pick = (a) => a[Math.floor(Math.random() * a.length)];

export async function fakeAi({ prompt, schema }) {
  await new Promise((r) => setTimeout(r, 300));
  const last = String(prompt).split('\n').filter((l) => /^\[\d\d:\d\d\]/.test(l)).pop() || '';
  const said = last.replace(/^\[[^\]]+\]\s*[^:]+:\s*/, '');
  if (schema.properties.reply) return { reply: 'Привет! Связь есть 🌼' };
  if (schema.properties.facts) return { messages: ['Запомнил! А что ты любишь делать по вечерам?'], facts: said.split(/\s+/).length > 2 ? [said] : [] };
  if (schema.properties.attended) {
    const p = parseParty(said);
    return { messages: [p.attended === 'no' ? 'Поняла, в следующий раз зовём 😉' : p.rating ? `Записала: ${p.rating}/10 🎉` : 'А какую оценку поставишь — от 1 до 10?'], note: '', ...p };
  }
  if (schema.properties.forward) return { messages: [pick(['Хороший вопрос 🙂 Думаю, ему понравится.', 'Ха, это в его духе!'])], forward: '', ask_owner: /\?$/.test(said) ? said : '' };
  return { messages: [pick(['ахах, да', 'ну такое)', 'слушай, а ты откуда?', 'согласна', 'о, интересно!'])], note: '' };
}
