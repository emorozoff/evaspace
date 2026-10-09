/* Проверка «переводчика» инструментов календаря: что уходит в Google и что возвращается приложению. Google подменён. */
'use strict';
const path = require('path');
const {Gcal} = require(path.join(__dirname, '..', 'lib', 'gcal.js'));
let pass = 0, failN = 0;
const ok = (c, n, x) => { if (c) pass++; else { failN++; console.log('  ✗', n, x !== undefined ? JSON.stringify(x).slice(0, 400) : ''); } };
(async () => {
  const g = new Gcal({file: path.join(require('os').tmpdir(), 'gcal-test-' + process.pid + '.json'), clientId: 'id', clientSecret: 'secret', publicUrl: 'https://eva.example.ru/'});
  ok(g.configured && g.redirectUri === 'https://eva.example.ru/api/gcal/callback', 'адрес возврата из Google');
  const url = new URL(g.authUrl('acc1', '/crm/'));
  ok(url.searchParams.get('access_type') === 'offline' && url.searchParams.get('redirect_uri') === g.redirectUri && /calendar\.events/.test(url.searchParams.get('scope')), 'ссылка в окно Google', url.search);
  ok(g.status('acc1').connected === false, 'до подключения — не подключён');
  let e = null; try { await g.call('acc1', 'list_events', {startTime: '2026-10-05T00:00:00+03:00', endTime: '2026-10-12T00:00:00+03:00'}); } catch (x) { e = x; }
  ok(e && e.code === 'connect_first', 'без подключения — понятный код ошибки', e && e.code);
  await g.finish('bad-state', 'x').then(() => ok(false, 'чужой state'), x => ok(x.code === 'cancelled', 'чужой ответ Google не принимается'));

  /* дальше Google подменён */
  const calls = [];
  let reply = () => ({});
  g.api = async (accId, method, p, opts = {}) => { calls.push({accId, method, p, ...opts}); return reply({method, p, ...opts}); };
  const last = () => calls[calls.length - 1];

  reply = () => ({summary: 'me@gmail.com', items: [{id: 'e1', summary: 'Встреча', start: {dateTime: '2026-10-06T10:00:00+03:00'}, end: {dateTime: '2026-10-06T11:00:00+03:00'}}], nextPageToken: 'p2'});
  let r = await g.call('acc1', 'list_events', {startTime: '2026-10-05T00:00:00+03:00', endTime: '2026-10-12T00:00:00+03:00', orderBy: 'startTime', pageSize: 250, timeZone: 'Europe/Moscow', calendarId: 'work@group.calendar.google.com'});
  ok(last().p === 'calendars/work%40group.calendar.google.com/events' && last().query.singleEvents === true && last().query.orderBy === 'startTime' && last().query.timeMin === '2026-10-05T00:00:00+03:00', 'list_events → события по одному, по времени', last());
  ok(r.items.length === 1 && r.nextPageToken === 'p2' && r.summary === 'me@gmail.com', 'ответ list_events как у коннектора');

  reply = () => ({items: [{id: 'primary@x', summary: 'Основной', primary: true}]});
  r = await g.call('acc1', 'list_calendars', {pageSize: 100});
  ok(r.calendars.length === 1 && r.calendars[0].primary, 'list_calendars');

  reply = () => ({id: 'ev123', htmlLink: 'https://calendar.google.com/e', hangoutLink: 'https://meet.google.com/abc'});
  r = await g.call('acc1', 'create_event', {summary: 'Планёрка', startTime: '2026-10-07T10:00:00+03:00', endTime: '2026-10-07T10:45:00+03:00', timeZone: 'Europe/Moscow',
    attendees: [{email: 'A@x.ru', displayName: 'Аня'}, {email: ''}], description: 'Повестка', addGoogleMeetUrl: true, notificationLevel: 'ALL', useDefaultReminders: true, recurrenceData: ['RRULE:FREQ=WEEKLY;UNTIL=20261231T205959Z']});
  const c = last();
  ok(c.method === 'POST' && c.p === 'calendars/primary/events' && c.query.sendUpdates === 'all' && c.query.conferenceDataVersion === 1, 'create_event → вставка с рассылкой приглашений', c.query);
  ok(c.body.attendees.length === 1 && c.body.attendees[0].email === 'a@x.ru' && c.body.recurrence[0].startsWith('RRULE') && c.body.conferenceData.createRequest.conferenceSolutionKey.type === 'hangoutsMeet' && c.body.start.timeZone === 'Europe/Moscow', 'участники, повтор, Meet', c.body);
  ok(r.event.id === 'ev123' && r.event.hangoutLink, 'ответ create_event: id и ссылка Meet');

  r = await g.call('acc1', 'create_event', {summary: 'CRM · Интервью: Анна', description: 'Карточка…\n\n#eva-crm', startTime: '2026-10-07T07:00:00.000Z', endTime: '2026-10-07T07:30:00.000Z', timeZone: 'Asia/Makassar', colorId: '4', notificationLevel: 'NONE', location: 'https://zoom.us/j/1'});
  ok(last().query.sendUpdates === 'none' && last().body.colorId === '4' && last().body.location && !last().body.attendees && !last().body.conferenceData, 'созвон CRM: без рассылки, цвет и место', last().body);

  reply = ({method}) => (method === 'GET' ? {id: 'ev123', attendees: [{email: 'a@x.ru'}, {email: 'b@x.ru', responseStatus: 'accepted'}]} : {id: 'ev123', hangoutLink: 'https://meet.google.com/new'});
  r = await g.call('acc1', 'update_event', {eventId: 'ev123', summary: 'Планёрка 2', startTime: '2026-10-07T11:00:00+03:00', endTime: '2026-10-07T11:45:00+03:00', timeZone: 'Europe/Moscow', notificationLevel: 'ALL',
    addedAttendees: [{email: 'c@x.ru'}], removedAttendeeEmails: ['A@X.RU'], addGoogleMeetUrl: true});
  ok(last().method === 'PATCH' && last().body.attendees.map(x => x.email).join() === 'b@x.ru,c@x.ru' && last().body.attendees[0].responseStatus === 'accepted' && last().body.conferenceData, 'update_event: добавить/убрать участников, ответы остальных целы', last().body);
  calls.length = 0;
  await g.call('acc1', 'update_event', {eventId: 'ev123', summary: 'Только название', notificationLevel: 'NONE'});
  ok(calls.length === 1 && calls[0].method === 'PATCH' && !('attendees' in calls[0].body), 'update_event без участников — одна правка, участников не трогает', calls);

  r = await g.call('acc1', 'delete_event', {eventId: 'ev123', notificationLevel: 'ALL', calendarId: 'c1'});
  ok(last().method === 'DELETE' && last().p === 'calendars/c1/events/ev123' && last().query.sendUpdates === 'all', 'delete_event');
  e = null; try { await g.call('acc1', 'drop_table', {}); } catch (x) { e = x; }
  ok(e && e.code === 'bad_request', 'неизвестный инструмент отклонён');

  /* свободные окна: пн 5 окт 2026, рабочий день 10–19 по Москве, занято 10:00–11:30 и 15:00–16:00 */
  reply = () => ({calendars: {primary: {busy: [{start: '2026-10-05T07:00:00Z', end: '2026-10-05T08:30:00Z'}]}, 'a@x.ru': {busy: [{start: '2026-10-05T12:00:00Z', end: '2026-10-05T13:00:00Z'}]}, 'b@x.ru': {errors: [{reason: 'notFound'}]}}});
  r = await g.call('acc1', 'suggest_time', {attendeeEmails: ['a@x.ru', 'b@x.ru'], startTime: '2026-10-05T09:00:00+03:00', endTime: '2026-10-06T23:00:00+03:00', durationMinutes: 60, timeZone: 'Europe/Moscow',
    preferences: {startHour: '10:00', endHour: '19:00', excludeWeekends: true, pageSize: 6}});
  const slots = r.timeSlots.map(s => s.startTime.slice(5, 16) + '–' + s.endTime.slice(11, 16));
  ok(JSON.stringify(slots) === JSON.stringify(['10-05T08:30–12:00', '10-05T13:00–16:00', '10-06T07:00–16:00']), 'окна: 11:30–15:00 и 16:00–19:00 в понедельник, весь вторник (время в UTC)', slots);
  ok(last().body.items.length === 3 && last().body.items[0].id === 'primary', 'занятость спрашиваем у себя и у участников');
  reply = () => ({calendars: {}});
  r = await g.call('acc1', 'suggest_time', {attendeeEmails: [], startTime: '2026-10-10T09:00:00+03:00', endTime: '2026-10-11T23:00:00+03:00', durationMinutes: 30, timeZone: 'Europe/Moscow', preferences: {startHour: '10:00', endHour: '19:00', excludeWeekends: true}});
  ok(r.timeSlots.length === 0, 'выходные пропускаем', r.timeSlots);

  console.log(`Итог: прошло ${pass}, не прошло ${failN}`);
  process.exit(failN ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
