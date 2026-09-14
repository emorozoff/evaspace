/* Правила, которые применяются сами: город со второго участника
   и рассылка уведомлений. Вызываются на каждом открытии приложения. */
import { DAY, HOUR, startOfWeek, weekKey } from './time.js';
import { uid } from './format.js';
import { isPro } from './club.js';
import { cityMembers } from './events.js';
import { visibleEvents, rsvpOf } from './schedule.js';
import { teamOf, leaderboard } from './teams.js';
import { meetsFor } from './meet.js';

/* ---------- города: главное правило ---------- */

/**
 * После каждой регистрации проверяем город. Стало ровно двое —
 * заводим чат, пятничную встречу и зовём организатора.
 */
export function ensureCityRules(state, now = Date.now()) {
  const notes = [];
  let changed = false;

  const cities = state.cities.map((city) => {
    const members = cityMembers(state, city.id).sort((a, b) => a.joinedAt - b.joinedAt);
    if (members.length < 2) return city;
    let next = city;

    if (!next.chatUrl) {
      next = { ...next, chatUrl: `https://t.me/+iai_${city.id.slice(2)}` };
      changed = true;
      members.forEach((m) =>
        notes.push(
          note(
            `city-second-${city.id}-${m.id}`,
            m.id,
            'В вашем городе теперь двое',
            'Договоритесь, где встречаетесь в пятницу. Чат города уже создан.',
            `/city/${city.id}`,
            now
          )
        )
      );
    }

    if (!next.organizerId) {
      const candidate = members.find((m) => !(next.organizerDeclined || []).includes(m.id));
      if (candidate && next.organizerOfferTo !== candidate.id) {
        next = { ...next, organizerOfferTo: candidate.id };
        changed = true;
        notes.push(
          note(
            `organizer-${city.id}-${candidate.id}`,
            candidate.id,
            'Возьмёте пятницу на себя?',
            `Вы первый в городе ${city.nameIn}. Организатор выбирает место и время встречи.`,
            `/city/${city.id}`,
            now
          )
        );
      }
    }

    return next;
  });

  return { cities, notes, changed };
}
/* ---------- уведомления ---------- */

export function note(key, userId, title, text, link, at = Date.now()) {
  return { id: uid('n'), key, userId, title, text, link, at, read: false };
}

export function unreadCount(state, userId) {
  return state.notes.filter((n) => n.userId === userId && !n.read).length;
}

/**
 * Не больше пяти уведомлений в неделю: напоминание про пятницу,
 * ссылка на онлайн, пара по кофе, новое видео и «покажи, что сделал».
 */
export function buildNotifications(state, user, now = Date.now()) {
  if (!user || user.notifications === false) return [];
  const have = new Set(state.notes.map((n) => n.key));
  const out = [];
  const add = (key, title, text, link, at = now) => {
    if (have.has(key)) return;
    have.add(key);
    out.push(note(key, user.id, title, text, link, at));
  };

  const events = visibleEvents(state, user, { from: now - HOUR, to: now + 3 * DAY });

  for (const event of events) {
    const left = event.startsAt - now;
    if (event.type === 'offline' && left < 30 * HOUR && !rsvpOf(state, event.id, user.id)) {
      add(`friday-${event.id}`, 'Завтра пятница', `${event.title}. Идёте?`, `/event/${event.id}`);
    }
    if ((event.type === 'online' || event.type === 'team') && left < HOUR && left > -HOUR) {
      add(`online-${event.id}`, 'Через час начинаем', `${event.title}. Ссылка на подключение внутри.`, `/event/${event.id}`);
    }
  }

  const week = weekKey(now);
  const waiting = meetsFor(state, user.id, week).filter((m) => m.status === 'new').length;
  if (waiting) {
    add(`meets-${week}-${user.id}`, 'Новые знакомства', `На этой неделе ${waiting} предложения. Загляните, пока не разобрали.`, '/meet', startOfWeek(now) + 9 * HOUR);
  }

  const fresh = state.materials
    .filter((m) => m.seasonId === state.season.id && now - m.publishedAt < 3 * DAY)
    .sort((a, b) => b.publishedAt - a.publishedAt)[0];
  if (fresh) add(`material-${fresh.id}`, 'В базе новый материал', fresh.title, `/base/${fresh.id}`, fresh.publishedAt);

  const team = teamOf(state, user.id);
  if (team && isPro(user)) {
    const board = leaderboard(state);
    const mine = board.find((r) => r.team.id === team.id);
    const above = mine && board[mine.place - 2];
    if (mine && above) {
      add(`rank-${team.id}-${week}`, 'Вас обошли', `${above.team.name} впереди на ${(above.counted - mine.counted).toLocaleString('ru-RU')} ₽`, '/rating');
    }
    const lastEntry = state.revenue.filter((r) => r.teamId === team.id).sort((a, b) => b.at - a.at)[0];
    if (!lastEntry || now - lastEntry.at > 7 * DAY) {
      add(`silence-${team.id}-${week}`, 'Покажи, что сделал на этой неделе', 'Команда не вносила выручку больше недели.', `/team/${team.id}`);
    }
  }

  return out;
}
