import { DAY, WEEK, startOfDay, startOfWeek, isoDate, addMonths } from './time.js';

/* Расписание собирается из повторяющихся серий.
   У каждого события устойчивый id вида ev_<серия>_<дата>, поэтому
   пересборка не плодит дубли: новые недели просто добавляются. */

export const EVENT_TYPES = {
  online: { label: 'Эфир', short: 'эфир' },
  offline: { label: 'Встреча', short: 'встреча' },
  team: { label: 'Созвон', short: 'созвон' },
  summit: { label: 'Слёт', short: 'слёт' },
};

const RECORDS = [
  'https://www.youtube.com/watch?v=aircA6HbT6Y',
  'https://www.youtube.com/watch?v=IHZwWFHWa-w',
  'https://www.youtube.com/watch?v=bBC-nXj3Ng4',
  'https://www.youtube.com/watch?v=R9OHn5ZF4Uo',
];

/** Ближайший день недели (1 = пн … 7 = вс) в заданное время, не раньше from. */
function weekdayAt(from, weekday, hour, minute = 0) {
  const base = startOfWeek(from) + (weekday - 1) * DAY;
  const d = new Date(base);
  d.setHours(hour, minute, 0, 0);
  return d.getTime();
}

/* Созвон команды по умолчанию — вторая и четвёртая пятница месяца,
   18:00–19:30. Раз в две недели: еженедельный созвон команды не тянут,
   а раз в месяц забывают, о чём договаривались. */
export const DEFAULT_CALL = { weekday: 5, hour: 18, minute: 0, duration: 90 };

/** Какая это по счёту такая-то пятница в своём месяце. */
function weekdayIndexInMonth(at) {
  return Math.floor((new Date(at).getDate() - 1) / 7) + 1;
}

export const isCallWeek = (at) => [2, 4].includes(weekdayIndexInMonth(at));

/** Расписание созвонов команды: своё, если команда его меняла. */
export const callPlan = (team) => ({ ...DEFAULT_CALL, ...(team?.call || {}) });

/* «Вторая и четвёртая пятница, 18:00» — одной строкой. Род у дней разный,
   поэтому порядковые числительные хранятся вместе с названием. */
const WEEKDAYS = [
  ['понедельник', 'второй и четвёртый'],
  ['вторник', 'второй и четвёртый'],
  ['среда', 'вторая и четвёртая'],
  ['четверг', 'второй и четвёртый'],
  ['пятница', 'вторая и четвёртая'],
  ['суббота', 'вторая и четвёртая'],
  ['воскресенье', 'второе и четвёртое'],
];

export function callLabel(team) {
  const plan = callPlan(team);
  const pad = (n) => String(n).padStart(2, '0');
  const from = plan.hour * 60 + plan.minute;
  const to = from + plan.duration;
  const [day, form] = WEEKDAYS[plan.weekday - 1];
  return `${form} ${day} месяца, ${pad(plan.hour)}:${pad(plan.minute)}–${pad(Math.floor(to / 60) % 24)}:${pad(to % 60)}`;
}

function makeEvent(series, startsAt, patch) {
  return {
    id: `ev_${series}_${isoDate(startsAt)}`,
    series,
    title: '',
    topic: '',
    description: '',
    agenda: [],
    price: 0,
    type: 'online',
    cityId: null,
    teamId: null,
    startsAt,
    duration: 90,
    joinUrl: '',
    recordUrl: '',
    minPackage: 'start',
    place: '',
    flexible: false,
    canceled: false,
    createdBy: 'system',
    ...patch,
  };
}

/** Города, где встреча вообще существует: минимум два активных участника. */
export function cityMembers(state, cityId) {
  const city = state.cities.find((c) => c.id === cityId);
  if (!city) return [];
  return state.users.filter((u) => u.cityId === cityId && u.active !== false);
}

/**
 * Досоздаёт события до конца окна. Вызывается при каждом открытии приложения,
 * поэтому расписание всегда заполнено на месяц вперёд.
 */
export function ensureEvents(state, now = Date.now()) {
  const have = new Set(state.events.map((e) => e.id));
  const added = [];
  const from = Math.max(state.season.startsAt, startOfWeek(now) - 3 * WEEK);
  const until = startOfDay(now) + 42 * DAY;

  const push = (event) => {
    if (event.startsAt < from || event.startsAt > until) return;
    if (have.has(event.id)) return;
    have.add(event.id);
    if (event.startsAt < now && event.type === 'online' && !event.recordUrl) {
      event.recordUrl = RECORDS[added.length % RECORDS.length];
    }
    added.push(event);
  };

  for (let w = startOfWeek(from); w <= until; w += WEEK) {
    const weekIndex = Math.round((w - startOfWeek(state.season.startsAt)) / WEEK);

    // Общий эфир клуба — среда, 20:00, для всех
    push(
      makeEvent('efir', weekdayAt(w, 3, 20), {
        title: 'Общий эфир клуба',
        topic: 'ИИ в деле: что сработало на этой неделе',
        description: 'Разбор недели, гость и ответы на вопросы. Приходите с одним вопросом.',
        agenda: ['Что у команд получилось за неделю', 'Гость: как он это сделал', 'Разбор ваших вопросов вживую'],
        type: 'online',
        joinUrl: 'https://meet.google.com/iai-club-efir',
        duration: 90,
      })
    );

    // Второе событие недели — вторник. Мастермайнд и воркшоп чередуются,
    // поэтому в неделе всегда ровно два клубных события: вторник и среда.
    if (weekIndex % 2 === 0) {
      push(
        makeEvent('mastermind', weekdayAt(w, 2, 19), {
          title: 'Мастермайнд',
          topic: 'Разбор задач участников',
          description: 'Пять участников, у каждого 12 минут на разбор своей задачи.',
          agenda: ['12 минут на человека: задача и контекст', 'Вопросы группы, потом идеи', 'Одно решение, за которое берётесь до следующей встречи'],
          type: 'online',
          minPackage: 'pro',
          joinUrl: 'https://meet.google.com/iai-club-mm',
          duration: 120,
        })
      );
    }

    if (weekIndex % 2 === 1) {
      push(
        makeEvent('workshop', weekdayAt(w, 2, 19), {
          title: 'Воркшоп',
          topic: 'Собираем ИИ-инструмент под свою задачу',
          description: 'Доделываем одну вещь до конца прямо на встрече, руками.',
          agenda: ['Выбираем задачу, которая съедает время', 'Собираем решение по шагам вместе', 'Уходим с работающим инструментом, а не с конспектом'],
          type: 'online',
          minPackage: 'pro',
          joinUrl: 'https://meet.google.com/iai-club-work',
          duration: 120,
        })
      );
    }

    // Пятница в городе — везде, где набралось двое
    for (const city of state.cities) {
      if (cityMembers(state, city.id).length < 2) continue;
      push(
        makeEvent(`friday-${city.id}`, weekdayAt(w, 5, 19, 30), {
          title: `Пятница в ${city.nameIn}`,
          topic: 'Живая встреча резидентов города',
          description: city.organizerId ? '' : 'Место ещё не выбрано. Предложите своё — участники договариваются сами.',
          agenda: ['Знакомство новых участников', 'Кто чем занят и кому чем помочь', 'Свободное общение'],
          type: 'offline',
          cityId: city.id,
          place: '',
          duration: 180,
        })
      );
    }

    // Командные созвоны: вторая и четвёртая пятница месяца, время меняется голосованием
    for (const team of state.teams) {
      const plan = callPlan(team);
      const at = weekdayAt(w, plan.weekday, plan.hour, plan.minute);
      if (!isCallWeek(at)) continue;
      push(
        makeEvent(`team-${team.id}`, at, {
          title: 'Командный созвон',
          topic: 'Статус команды за две недели',
          description: 'Что сделали, что не получилось, что дальше.',
          agenda: ['Что сделали с прошлого созвона', 'Где застряли', 'План до следующего'],
          type: 'team',
          teamId: team.id,
          joinUrl: 'https://meet.google.com/iai-club-team',
          duration: plan.duration,
        })
      );
    }
  }

  // Большой слёт — за два дня до выпускного
  const summitAt = new Date(state.season.graduationAt - 2 * DAY);
  summitAt.setHours(12, 0, 0, 0);
  push(
    makeEvent('summit', summitAt.getTime(), {
      title: 'Большой слёт',
      topic: 'Финал сезона',
      description: 'Финал сезона: итоги команд, награждение и вечеринка.',
      agenda: ['Защита проектов команд', 'Награждение и итоги копилки', 'Ужин и вечеринка'],
      type: 'summit',
      duration: 600,
      price: 6500,
      place: 'Москва, лофт «Депо», Лесная 20',
    })
  );

  return added;
}

/** Заготовка следующего сезона — используется только в админке. */
export function nextSeason(season) {
  return {
    id: season.id + 1,
    title: `Сезон ${season.id + 1}`,
    startsAt: season.graduationAt,
    graduationAt: addMonths(season.graduationAt, 3),
  };
}
