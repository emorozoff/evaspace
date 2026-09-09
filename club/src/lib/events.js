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

function makeEvent(series, startsAt, patch) {
  return {
    id: `ev_${series}_${isoDate(startsAt)}`,
    series,
    title: '',
    description: '',
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
        description: 'Разбор недели, гость и ответы на вопросы. Приходите с одним вопросом.',
        type: 'online',
        joinUrl: 'https://meet.google.com/iai-club-efir',
        duration: 90,
      })
    );

    // Мастермайнд — раз в две недели, четверг, только PRO
    if (weekIndex % 2 === 0) {
      push(
        makeEvent('mastermind', weekdayAt(w, 4, 19), {
          title: 'Мастермайнд',
          description: 'Пять участников, у каждого 12 минут на разбор своей задачи.',
          type: 'online',
          minPackage: 'pro',
          joinUrl: 'https://meet.google.com/iai-club-mm',
          duration: 120,
        })
      );
    }

    // Воркшоп — раз в две недели, вторник, только PRO
    if (weekIndex % 2 === 1) {
      push(
        makeEvent('workshop', weekdayAt(w, 2, 19), {
          title: 'Воркшоп',
          description: 'Доделываем одну вещь до конца прямо на встрече, руками.',
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
          description: city.organizerId ? '' : 'Место ещё не выбрано. Предложите своё — участники договариваются сами.',
          type: 'offline',
          cityId: city.id,
          place: '',
          duration: 180,
        })
      );
    }

    // Командные созвоны — время команда выбирает сама
    for (const team of state.teams) {
      push(
        makeEvent(`team-${team.id}`, weekdayAt(w, 1, 20), {
          title: 'Командный созвон',
          description: 'Что сделали, что не получилось, что дальше.',
          type: 'team',
          teamId: team.id,
          flexible: true,
          joinUrl: 'https://meet.google.com/iai-club-team',
          duration: 60,
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
      description: 'Финал сезона: итоги команд, награждение и вечеринка.',
      type: 'summit',
      duration: 600,
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
