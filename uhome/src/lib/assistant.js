import { AVATARS } from '../data/avatars.js';
import { PEOPLE, TRIPS, EXCHANGE, SPHERES, byId, firstNameOf } from '../data/people.js';
import { EVENTS } from '../data/events.js';
import { COMPANIES } from '../data/services.js';
import { MATERIALS, TOPICS } from '../data/base.js';
import { COMMUNITIES } from '../data/communities.js';
import { NEWS } from '../data/news.js';
import { DICT, findTerm } from '../data/dictionary.js';
import { REGIONS } from '../data/regions.js';
import { FORMATS } from '../data/test.js';
import { match } from './match.js';
import { reasons, eventIntros, whyText } from './intro.js';
import { groupsOf } from './groups.js';
import { localParts } from './time.js';
import { plural, relDay, whenLabel } from './format.js';

/* Мозг Евы и Адама. Отвечает только по проверенной базе клуба:
   резиденты, события, услуги, база знаний, сообщества и словарь.
   Понимает тему вопроса, подбирает под профиль из теста и под то,
   чему научился из ваших действий, и всегда заканчивает действием.
   Характер — в data/avatars.js; к нейросети он подключается той же
   персоной и теми же правилами, а эти функции становятся её инструментами. */

export const assistantOf = (app) => AVATARS[app.me.assistant] || AVATARS.eva;

const norm = (t) => (t || '').toLowerCase().replace(/ё/g, 'е');
const has = (t, ...w) => w.some((x) => t.includes(x));
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const nameTail = (app) => (app.me.name ? `, ${firstNameOf(app.me)}` : '');

const REGION_WORDS = {
  moscow: ['москв', 'мск'],
  bali: ['бали', 'чангу', 'убуд', 'букит', 'семиньяк', 'индонез'],
  dubai: ['дуба', 'оаэ', 'эмират'],
  miami: ['майами', 'сша', 'америк', 'нью-йорк', 'нью йорк'],
  europe: ['европ', 'лиссабон', 'барселон', 'берлин', 'кипр', 'лимасол', 'португал', 'испан'],
};
export function regionIn(t) {
  return Object.keys(REGION_WORDS).find((k) => REGION_WORDS[k].some((w) => t.includes(w))) || null;
}

/* ——— голос ——— */

export function greeting(app, now = new Date()) {
  const A = assistantOf(app);
  const { h } = localParts(REGIONS[app.me.region]?.tz || 'Europe/Moscow', now);
  const part = h >= 5 && h < 12 ? 'morning' : h >= 12 && h < 18 ? 'day' : h >= 18 && h < 23 ? 'evening' : 'night';
  const pool = A.hello[part];
  return pool[now.getDate() % pool.length].replace('{name}', nameTail(app));
}

/** Комплимент — не в каждом ответе: иначе он перестаёт что-то значить. */
function compliment(app, n) {
  const A = assistantOf(app);
  const tone = app.me.tone || 'warm';
  if (tone === 'business') return '';
  const pool = A.compliments[tone] || A.compliments.warm;
  return n % 3 === 1 ? ` ${pool[Math.floor(n / 3) % pool.length]}` : '';
}

/* ——— подбор ——— */

function topPeople(app, filter = () => true, n = 3) {
  return PEOPLE.filter(filter)
    .map((p) => ({ p, m: match(app.me, p) }))
    .sort((a, b) => b.m.pct - a.m.pct)
    .slice(0, n)
    .map(({ p, m }) => ({ type: 'person', id: p.id, pct: m.pct, note: whyText(m) }));
}

/** Оценка события: регион, полезные люди, интересы и то, что вы уже спрашивали. */
export function scoreEvent(app, e, region = app.me.region) {
  const useful = eventIntros(app, e).filter((x) => x.pct >= 60).length;
  const text = `${e.title} ${e.about}`.toLowerCase();
  const likes = (app.me.interests || []).filter((i) => text.includes(i.toLowerCase().slice(0, 5))).length;
  const topics = app.ai?.memory?.topics || {};
  const investBoost = (topics.invest || 0) > 0 && /инвест|капитал|сделк/.test(text) ? 8 : 0;
  return (e.region === region ? 24 : e.kind === 'online' ? 10 : 0) + useful * 7 + likes * 6 + investBoost - e.inDays * 0.6;
}

function topEvents(app, region, n = 3) {
  return [...EVENTS]
    .filter((e) => !region || e.region === region || e.kind === 'online')
    .sort((a, b) => scoreEvent(app, b, region || app.me.region) - scoreEvent(app, a, region || app.me.region))
    .slice(0, n)
    .map((e) => {
      const useful = eventIntros(app, e).filter((x) => x.pct >= 60);
      return { type: 'event', id: e.id, note: useful.length ? `Там ${useful.length} ${plural(useful.length, 'полезное знакомство', 'полезных знакомства', 'полезных знакомств')}: ${useful.slice(0, 2).map((x) => firstNameOf(x.p)).join(', ')}` : whenLabel(e.inDays, e.time) };
    });
}

const companiesIn = (app, cat, region) =>
  COMPANIES.filter((c) => c.cat === cat && (!region || c.regions.includes(region)))
    .sort((a, b) => b.regions.includes(app.me.region) - a.regions.includes(app.me.region) || b.rating - a.rating)
    .slice(0, 3)
    .map((c) => ({ type: 'service', id: c.id, note: c.perk }));

const materialsFor = (topic, n = 2) => MATERIALS.filter((m) => m.topic === topic).slice(0, n).map((m) => ({ type: 'material', id: m.id }));

/* ——— темы ——— */

const CHIPS = {
  start: ['Кого мне стоит знать?', 'Куда сходить на неделе?', 'Кто прилетает ко мне?', 'Найди инвестора'],
  people: ['Кто прилетает ко мне?', 'Покажи мою мастер-группу', 'Куда сходить на неделе?'],
  events: ['С кем там познакомиться?', 'Что в Дубае?', 'Закрытые ужины'],
  money: ['Налоги между странами', 'Что такое синдикат?', 'Кого мне стоит знать?'],
  move: ['Виза на Бали', 'Жильё на сезон', 'Байк с доставкой'],
};

function topicOf(t) {
  if (has(t, 'спасибо', 'благодар', 'супер', 'отлично', 'класс')) return 'thanks';
  if (/^(привет|здравств|добр(ое|ый)|хай|hello|hi|ева|адам)\b/.test(t) || t === 'привет') return 'hello';
  if (has(t, 'кто ты', 'что ты умеешь', 'что умеешь', 'как ты работаешь', 'откуда ты', 'чему обуч', 'что ты знаешь')) return 'about';
  if (has(t, 'что такое', 'что значит', 'что означает', 'расшифр', 'термин', 'словар')) return 'term';
  if (has(t, 'мастер', 'групп')) return 'groups';
  if (t.trim() === 'команда' || has(t, 'команда клуба', 'команде клуба', 'команду клуба', 'uhome', 'менеджер', 'поддержк', 'живой человек', 'оператор')) return 'team';
  if (has(t, 'прилет', 'прилёт', 'приедет', 'прилетает', 'кто будет у', 'кто приезжа')) return 'arrivals';
  if (has(t, 'инвест', 'капитал', 'деньг', 'раунд', 'фонд', 'синдикат', 'сделк', 'привлечь')) return 'invest';
  if (has(t, 'налог', 'бухгалт', 'банк', 'юрист', 'фризон', 'llc', 'открыть компан', 'резидентств')) return 'taxes';
  if (has(t, 'виз', 'внж', 'kitas', 'b211', 'золот', 'переезд', 'релокац', 'продлен')) return 'visa';
  if (has(t, 'вилл', 'квартир', 'жиль', 'недвиж', 'аренд', 'снять дом')) return 'realty';
  if (has(t, 'байк', 'скутер', 'мото', 'транспорт', 'nmax', 'vespa')) return 'bikes';
  if (has(t, 'детск', 'сад', 'школ', 'ребен', 'дет')) return 'kids';
  if (has(t, 'ресторан', 'поесть', 'кухн', 'кейтеринг', 'ужин где', 'где поужинать')) return 'food';
  if (has(t, 'событ', 'мероприят', 'ивент', 'сходить', 'выходн', 'на неделе', 'афиш', 'закрыт', 'ужин')) return 'events';
  if (has(t, 'эфир', 'запис', 'zoom', 'зум', 'база', 'гайд', 'материал', 'почитать', 'посмотреть', 'учить')) return 'base';
  if (has(t, 'новост', 'что нового', 'что происходит')) return 'news';
  if (has(t, 'познаком', 'знаком', 'кого', 'кто мне', 'нетворк', 'контакт', 'партнер', 'людей', 'люди', 'связ', 'полезн')) return 'people';
  if (has(t, 'как дела', 'как ты', 'скучно', 'устал', 'настроени', 'комплимент', 'нрав')) return 'mood';
  if (regionIn(t)) return 'region';
  return 'unknown';
}

/** Главная функция: вопрос → ответ с карточками и следующими шагами. */
export function reply(app, raw) {
  const A = assistantOf(app);
  const t = norm(raw);
  const n = app.ai?.count || 0;
  const region = regionIn(t) || (has(t, 'рядом', 'здесь', 'у меня в городе') ? app.me.region : null);
  const topic = topicOf(t);
  const R = region ? REGIONS[region] : null;
  const c = compliment(app, n);

  switch (topic) {
    case 'hello': {
      const rs = reasons(app, 3);
      const ev = topEvents(app, app.me.region, 1);
      return {
        topic, text: `${greeting(app)}${c}\n\nСегодня у меня для вас ${rs.length} ${plural(rs.length, 'повод', 'повода', 'поводов')} познакомиться и лучшее событие недели.`,
        cards: [...rs.slice(0, 2).map((r) => ({ type: 'person', id: r.p.id, pct: r.pct, note: r.text })), ...ev], chips: CHIPS.start,
      };
    }
    case 'thanks':
      return { topic, text: `${A.she ? 'Всегда рада' : 'Всегда рад'} помочь${nameTail(app)}.${c} ${A.signoff[app.me.tone || 'warm']}`, cards: [], chips: CHIPS.start };
    case 'about': {
      return {
        topic,
        text: `${A.about}\n\nЯ знаю только проверенное: ${PEOPLE.length} ${plural(PEOPLE.length, 'резидент', 'резидента', 'резидентов')}, ${EVENTS.length} событий, ${COMPANIES.length} компаний клуба, ${MATERIALS.length} материалов базы и ${DICT.length} терминов словаря. О вас — ${knownFacts(app).length} фактов, и с каждым вашим выбором их больше.`,
        cards: [], chips: ['Что ты знаешь обо мне?', ...CHIPS.start.slice(0, 2)],
      };
    }
    case 'term': {
      const d = findTerm(t);
      if (!d) return { topic, text: 'Такого слова в словаре клуба пока нет. Могу объяснить, например, что такое мастер-группа, интро, синдикат или KITAS.', cards: [], chips: ['Что такое интро?', 'Что такое синдикат?', 'Что такое KITAS?'] };
      return { topic, text: `«${d.term}» — ${d.text}`, cards: [], chips: ['Кого мне стоит знать?', 'Что такое польза знакомства?'] };
    }
    case 'team':
      return {
        topic, text: `Команда UHOME — менеджеры клуба. Отвечают за 15 минут с 9 до 22 по вашему времени: события, услуги, визы, жильё, знакомства. Всё, чего я не знаю наверняка, я передаю им.`,
        cards: [], chips: CHIPS.start, team: true,
      };
    case 'groups': {
      const gs = groupsOf(app.me);
      return {
        topic, text: `Ваши группы собраны по тесту — из людей, которым вы нужны и которые нужны вам.${c}`,
        cards: gs.map((g) => ({ type: 'group', id: g.id })), chips: CHIPS.people,
      };
    }
    case 'arrivals': {
      const to = region || app.me.region;
      const list = TRIPS.filter((x) => x.to === to).sort((a, b) => a.inDays - b.inDays);
      if (!list.length) return { topic, text: `В ближайшие две недели ${REGIONS[to].loc} никто не заявил прилёт. Я предупрежу, как только появится.`, cards: [], chips: CHIPS.people };
      return {
        topic, text: `Кто будет ${REGIONS[to].loc} в ближайшие дни — самое время договориться о встрече:`,
        cards: list.slice(0, 4).map((x) => {
          const p = byId(x.who);
          return { type: 'person', id: p.id, pct: match(app.me, p).pct, note: `Прилетает ${relDay(x.inDays)} на ${x.days} ${plural(x.days, 'день', 'дня', 'дней')}` };
        }),
        chips: CHIPS.people,
      };
    }
    case 'invest': {
      const people = topPeople(app, (p) => p.gives.includes('invest') && (!region || p.region === region), 3);
      const closed = EVENTS.filter((e) => e.kind === 'closed' && /инвест|фаундер|основател/i.test(`${e.title} ${e.about}`)).slice(0, 2).map((e) => ({ type: 'event', id: e.id, note: whenLabel(e.inDays, e.time) }));
      return {
        topic, text: `Инвесторы клуба, которым интересен ваш профиль, и где с ними встретиться лично.${c}`,
        cards: [...people, ...closed, { type: 'material', id: 'm5' }], chips: CHIPS.money,
      };
    }
    case 'taxes':
      return { topic, text: `Налоги и компании между странами — у резидентов есть проверенные специалисты. Начните с бесплатного разбора резидентства.${c}`, cards: [...companiesIn(app, 'services').filter((x) => ['clear', 'lex'].includes(x.id)), { type: 'material', id: 'm1' }, { type: 'material', id: 'g2' }], chips: CHIPS.money };
    case 'visa': {
      const cards = [{ type: 'service', id: 'amazonki', note: '−10% резидентам' }, { type: 'person', id: 'r3', pct: match(app.me, byId('r3')).pct, note: 'Визы и ВНЖ на Бали и в Дубае' }, ...materialsFor('move', 2)];
      return { topic, text: `Визы — это к Amazonki: ведут резидентов от первой визы до KITAS и золотой визы ОАЭ.${c}`, cards, chips: CHIPS.move };
    }
    case 'realty':
      return { topic, text: `Жильё ${R ? R.loc : 'в регионах клуба'} — только через резидентов, с проверкой договора.${c}`, cards: [...companiesIn(app, 'realty', region), ...materialsFor('realty', 1)], chips: CHIPS.move };
    case 'bikes':
      return { topic, text: 'Butler Bike привезёт байк к дому за час — шлемы и страховка включены, резидентам −15%.', cards: [{ type: 'service', id: 'butler', note: '−15% резидентам' }, { type: 'event', id: 'e2', note: 'Байк-трип к рассвету' }], chips: CHIPS.move };
    case 'kids':
      return { topic, text: `Сады и школы, которым доверяют резиденты.${c}`, cards: [...companiesIn(app, 'kids', region), { type: 'material', id: 'g3' }], chips: CHIPS.move };
    case 'food':
      return { topic, text: `Где поужинать ${R ? R.loc : REGIONS[app.me.region].loc} — рестораны резидентов, для своих держат стол.${c}`, cards: companiesIn(app, 'food', region || app.me.region).length ? companiesIn(app, 'food', region || app.me.region) : companiesIn(app, 'food'), chips: CHIPS.events };
    case 'events': {
      const wantClosed = t.includes('закрыт');
      const cards = wantClosed
        ? EVENTS.filter((e) => e.kind === 'closed' && (!region || e.region === region)).slice(0, 3).map((e) => ({ type: 'event', id: e.id, note: whenLabel(e.inDays, e.time) }))
        : topEvents(app, region || app.me.region, 3);
      return { topic, text: `${A.found === 'подобрала' ? 'Подобрала' : 'Подобрал'} события ${R ? R.loc : 'под вас'} — с учётом людей, которые там будут.${c}`, cards, chips: CHIPS.events };
    }
    case 'base': {
      const tops = (app.me.needs || []).map((x) => ({ invest: 'money', law: 'money', realty: 'realty', relocation: 'move', ai: 'ai', kids: 'family' }[x])).filter(Boolean);
      const list = MATERIALS.filter((m) => tops.includes(m.topic)).concat(MATERIALS).filter((m, i, a) => a.indexOf(m) === i).slice(0, 3);
      return { topic, text: `Из базы знаний — то, что пригодится именно вам.${c}`, cards: list.map((m) => ({ type: 'material', id: m.id })), chips: ['Что такое RAG?', 'Куда сходить на неделе?'] };
    }
    case 'news':
      return { topic, text: `Главное в клубе:\n\n${NEWS.slice(0, 3).map((x) => `· ${x.title}`).join('\n')}`, cards: [], chips: CHIPS.start };
    case 'mood': {
      const tone = app.me.tone || 'warm';
      const A2 = assistantOf(app);
      const line = tone === 'business' ? 'Всё под контролем. Чем помочь?' : A2.compliments[tone === 'flirt' ? 'flirt' : 'warm'][n % 3];
      return { topic, text: `${line}\n\nХотите, найду вам интересного собеседника на этот вечер?`, cards: [], chips: ['Кого мне стоит знать?', 'Куда сходить на неделе?'] };
    }
    case 'region': {
      const people = PEOPLE.filter((p) => p.region === region).length;
      const comm = COMMUNITIES.filter((x) => x.region === region || x.chapters?.includes(region)).length;
      return {
        topic, text: `${R.name}: ${people} ${plural(people, 'резидент', 'резидента', 'резидентов')} в базе и ${comm} ${plural(comm, 'сообщество', 'сообщества', 'сообществ')}. Вот с кем и куда стоит сходить:`,
        cards: [...topPeople(app, (p) => p.region === region, 2), ...topEvents(app, region, 2)], chips: [`Кто прилетает ко мне?`, 'Куда сходить на неделе?'],
      };
    }
    case 'people': {
      if (region) {
        return { topic, text: `Самые полезные знакомства ${R.loc}:${c}`, cards: topPeople(app, (p) => p.region === region, 3), chips: CHIPS.people };
      }
      const rs = reasons(app, 3);
      return {
        topic, text: `Я ${A.found} ${rs.length} ${plural(rs.length, 'человека', 'человек', 'человек')}, с кем вам стоит поговорить в первую очередь — у каждого есть повод.${c}`,
        cards: rs.map((r) => ({ type: 'person', id: r.p.id, pct: r.pct, note: `${r.label}. ${r.why}` })), chips: CHIPS.people,
      };
    }
    default:
      return {
        topic: 'unknown',
        text: `Этого я пока не знаю наверняка — а я говорю только проверенное. ${A.she ? 'Передала' : 'Передал'} вопрос команде клуба, ответ придёт в сообщения.`,
        cards: [], chips: CHIPS.start, handoff: true,
      };
  }
}

/* ——— что ассистент знает о резиденте ——— */

export function knownFacts(app) {
  const me = app.me;
  const out = [];
  const sphere = SPHERES.find((s) => s.id === me.sphere);
  if (sphere) out.push({ k: 'Сфера', v: sphere.name });
  if (me.needs?.length) out.push({ k: 'Ищете', v: me.needs.map((x) => EXCHANGE[x]?.name).join(', ') });
  if (me.gives?.length) out.push({ k: 'Полезны', v: me.gives.map((x) => EXCHANGE[x]?.name).join(', ') });
  if (me.interests?.length) out.push({ k: 'Любите', v: me.interests.join(', ') });
  if (me.regionsOften?.length) out.push({ k: 'Бываете', v: me.regionsOften.map((k) => REGIONS[k]?.name).join(', ') });
  if (me.formats?.length) out.push({ k: 'Знакомитесь', v: me.formats.map((f) => FORMATS.find((x) => x.id === f)?.name.toLowerCase()).join(', ') });
  const going = EVENTS.filter((e) => app.going[e.id]);
  if (going.length) out.push({ k: 'Идёте', v: going.map((e) => e.title).join('; ') });
  const intros = Object.keys(app.intros || {}).length;
  if (intros) out.push({ k: 'Интро', v: `${intros} ${plural(intros, 'знакомство', 'знакомства', 'знакомств')} через меня` });
  const topics = Object.entries(app.ai?.memory?.topics || {}).filter(([k]) => !['hello', 'thanks', 'unknown', 'mood'].includes(k)).sort((a, b) => b[1] - a[1]);
  const TOPIC_NAME = { people: 'знакомства', invest: 'инвестиции', events: 'события', visa: 'визы', realty: 'недвижимость', taxes: 'налоги', base: 'база знаний', groups: 'группы', arrivals: 'кто прилетает', kids: 'дети', food: 'рестораны', bikes: 'транспорт', term: 'словарь', region: 'регионы', news: 'новости', about: 'обо мне' };
  if (topics.length) out.push({ k: 'Чаще спрашиваете', v: topics.slice(0, 3).map(([k, v]) => `${TOPIC_NAME[k] || k} (${v})`).join(', ') });
  return out;
}

/** Проверенные источники — то, на чём обучен аватар. */
export function sources() {
  return [
    { icon: 'users', name: 'Резиденты', n: PEOPLE.length, sub: 'профили, запросы, польза знакомств' },
    { icon: 'calendar', name: 'События', n: EVENTS.length, sub: 'кто идёт, где и зачем' },
    { icon: 'bag', name: 'Компании резидентов', n: COMPANIES.length, sub: 'цены, бонусы, отзывы' },
    { icon: 'book', name: 'База знаний', n: MATERIALS.length, sub: 'эфиры и гайды с выводами' },
    { icon: 'globe', name: 'Сообщества', n: COMMUNITIES.length, sub: 'регионы и интересы' },
    { icon: 'spark', name: 'Словарь клуба', n: DICT.length, sub: 'как мы говорим' },
  ];
}

/** Короткая мысль ассистента на главную: лучший повод дня. */
export function insight(app) {
  const r = reasons(app, 1)[0];
  if (!r) return { text: `${greeting(app)} Спросите меня о людях, событиях или сделках — я знаю всех в клубе.`, reason: null };
  return { text: `${r.text} ${r.why} Польза знакомства — ${r.pct}%.`, reason: r };
}

export const STARTERS = CHIPS.start;
export { TOPICS };
