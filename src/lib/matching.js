import { QUESTIONS, LESSONS } from '../data/content.js';

/* ============================================================
   Алгоритм персональной программы.
   Ответы девушки превращаются в веса по тегам, каждый урок
   получает балл совпадения, из лучших собирается неделя.
   ============================================================ */

export function buildTagWeights(answers = {}) {
  const w = {};
  const add = (tag, v) => {
    w[tag] = (w[tag] || 0) + v;
  };
  for (const q of QUESTIONS) {
    const picked = answers[q.id] || [];
    picked.forEach((optId, i) => {
      const opt = q.options.find((o) => o.id === optId);
      if (!opt) return;
      // первый выбор чуть весомее второго
      const k = i === 0 ? 1 : 0.75;
      (opt.tags || []).forEach((t) => add(t, q.weight * k));
    });
  }
  return w;
}

export function profileMeta(answers = {}) {
  const get = (qid) => {
    const q = QUESTIONS.find((x) => x.id === qid);
    const id = (answers[qid] || [])[0];
    return q?.options.find((o) => o.id === id);
  };
  const lvl = get('level');
  const time = get('time');
  const stage = get('stage');
  return {
    level: lvl?.level || 'любой',
    budget: time?.budget || 22,
    stage: stage?.id || 'self',
    stageLabel: stage?.label || '',
  };
}

const MAX_TAG_SUM = 6; // ориентир для нормировки процента

export function scoreLesson(lesson, weights, meta, opts = {}) {
  const tags = lesson.tags || [];
  let raw = 0;
  const matched = [];
  for (const t of tags) {
    const v = weights[t] || 0;
    if (v > 0) {
      raw += v;
      matched.push({ tag: t, w: v });
    }
  }
  matched.sort((a, b) => b.w - a.w);

  let score = raw;

  // длительность под бюджет времени
  if (lesson.min <= meta.budget) score += 1.5;
  else if (lesson.min > meta.budget * 2) score -= 2.5;

  // уровень сложности
  if (meta.level === 'новичок') {
    if (lesson.level === 'новичок') score += 2;
    if (lesson.level === 'опыт') score -= 2.5;
  }
  if (meta.level === 'опыт' && lesson.level === 'новичок') score -= 0.8;

  // особые этапы жизни
  if (meta.stage === 'pregnant') {
    if (tags.includes('беременность')) score += 5;
    if (tags.includes('деньги') || tags.includes('карьера')) score -= 1.5;
  }
  if (meta.stage === 'mom' && tags.includes('мама')) score += 3;

  // предпочтение утренним практикам для утреннего блока
  if (opts.morning && tags.includes('утро')) score += 1.2;
  if (opts.morning && tags.includes('вечер')) score -= 0.6;

  // плавная кривая: проценты не «слипаются» на 99 у половины уроков
  const percent = Math.max(58, Math.min(99, Math.round(55 + 44 * (1 - Math.exp(-raw / MAX_TAG_SUM)))));
  return { score, raw, percent, matched: matched.map((m) => m.tag) };
}

export function rankLessons(lessons, weights, meta, opts = {}) {
  return lessons
    .map((l) => ({ lesson: l, ...scoreLesson(l, weights, meta, opts) }))
    .sort((a, b) => b.score - a.score);
}

/* Выбор N штук с разнообразием: не берём подряд одного эксперта */
function pickDiverse(ranked, n) {
  const used = new Set();
  const expertCount = {};
  const out = [];
  const pool = ranked.slice();
  while (out.length < n && pool.length) {
    let best = null;
    let bestVal = -Infinity;
    let bestIdx = -1;
    pool.forEach((c, i) => {
      if (used.has(c.lesson.id)) return;
      const penalty = (expertCount[c.lesson.expert] || 0) * 1.6;
      const v = c.score - penalty;
      if (v > bestVal) {
        bestVal = v;
        best = c;
        bestIdx = i;
      }
    });
    if (!best) break;
    used.add(best.lesson.id);
    expertCount[best.lesson.expert] = (expertCount[best.lesson.expert] || 0) + 1;
    out.push(best);
    pool.splice(bestIdx, 1);
  }
  return out;
}

export function buildProgram(answers, allLessons = LESSONS) {
  const weights = buildTagWeights(answers);
  const meta = profileMeta(answers);

  const byType = (t, opts) => rankLessons(allLessons.filter((l) => l.type === t), weights, meta, opts);

  const affirmations = pickDiverse(byType('affirmation'), 7);
  const practices = pickDiverse(byType('practice', { morning: true }), 7);
  const masterclasses = pickDiverse(byType('masterclass'), 7);

  const fill = (arr, type) => {
    if (arr.length >= 7) return arr;
    const rest = byType(type).filter((c) => !arr.find((a) => a.lesson.id === c.lesson.id));
    return arr.concat(rest.slice(0, 7 - arr.length));
  };

  const A = fill(affirmations, 'affirmation');
  const P = fill(practices, 'practice');
  const M = fill(masterclasses, 'masterclass');

  const days = [];
  for (let i = 0; i < 7; i++) {
    days.push({
      affirmation: A[i]?.lesson.id,
      practice: P[i]?.lesson.id,
      masterclass: M[i]?.lesson.id,
      percent: Math.round(((A[i]?.percent || 70) + (P[i]?.percent || 70) + (M[i]?.percent || 70)) / 3),
    });
  }

  const all = [...A, ...P, ...M];
  const matchPercent = Math.round(all.reduce((s, c) => s + c.percent, 0) / (all.length || 1));

  // теги, которые чаще всего попали в программу — «почему такая программа»
  const tagHits = {};
  all.forEach((c) => c.matched.forEach((t) => (tagHits[t] = (tagHits[t] || 0) + 1)));
  const topTags = Object.entries(tagHits)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([t]) => t);

  return {
    createdAt: Date.now(),
    days,
    matchPercent,
    topTags,
    weights,
    meta,
    scanned: allLessons.length,
  };
}

/* Почему именно этот урок — для карточки «подбор» */
export function whyLesson(lesson, weights, meta) {
  const r = scoreLesson(lesson, weights || {}, meta || { level: 'любой', budget: 22, stage: 'self' });
  return { percent: r.percent, tags: r.matched.slice(0, 3) };
}

/* Поиск подходящего контента по свободному тексту (для Евы и поиска) */
const STOP = new Set(['мне', 'меня', 'моя', 'мой', 'что', 'как', 'это', 'для', 'она', 'они', 'все', 'уже', 'так', 'там', 'тут', 'бы', 'же', 'ли', 'нет', 'да', 'очень', 'себя', 'сейчас', 'хочу', 'могу', 'надо', 'есть', 'быть', 'меня']);

export function searchLessons(query, allLessons = LESSONS, limit = 4) {
  const q = (query || '').toLowerCase().trim();
  if (!q) return [];
  const words = q.split(/[^a-zа-яё0-9]+/i).filter((w) => w.length > 3 && !STOP.has(w));
  const scored = allLessons.map((l) => {
    const hay = `${l.title} ${l.sub || ''} ${l.about || ''} ${(l.tags || []).join(' ')}`.toLowerCase();
    let s = 0;
    for (const w of words) {
      if (hay.includes(w)) s += 2;
      if ((l.tags || []).some((t) => t.includes(w) || w.includes(t))) s += 3;
    }
    return { l, s };
  });
  return scored
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.l);
}
