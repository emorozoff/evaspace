# Данные штаба Eva Club V2 — формат и переезд

Штаб хранит всё в одном формате, где бы он ни работал:

| Где открыт штаб | Где лежат данные | Как забрать |
| --- | --- | --- |
| Артефакт Claude | общая база артефакта (`claude.use('db')`) | «Команда» → «Данные штаба» → «Выгрузить всё» |
| Свой сервер (`server/server.js`) | файл `server/data/eva-hq.json` + копия на каждый день в `server/data/backups/` | тот же файл, `GET /api/export` или `node server.js --export файл.json` |
| GitHub Pages / любой статический хостинг | `localStorage` этого браузера (`eva-hq:*`) | «Выгрузить всё» |

## Формат файла

```json
{
  "format": "eva-hq",
  "version": 1,
  "exportedAt": "2026-10-07T12:00:00.000Z",
  "source": "db | server | local",
  "collections": {
    "tasks":    { "<id>": { "title": "…", "status": "todo", "assignee": "<personId>", … } },
    "people":   { "<id>": { … } },
    "…":        { … }
  }
}
```

Каждая коллекция — объект «id → документ», каждый документ — отдельная запись
(в артефакте и на сервере это отдельный документ, поэтому правки разных людей не
затирают друг друга). Коллекции:

| Коллекция | Что внутри | Главные поля |
| --- | --- | --- |
| `tasks` | задачи | `title`, `status` (todo · doing · review · done), `assignee` и `createdBy` (id человека), `due` (YYYY-MM-DD), `month` (YYYY-MM), `dueFixed` (срок важен), `dueReq` (запрос переноса), `priority`, `dir`, `goalId`, `stratId`, `budget`, `budgetNeedsApproval`, `approval`/`approver`, `blockedBy` [id], `comments` {id: {by, at, text, kind, ev, to}}, `seen` {кто: когда} |
| `sales` | цифры дня, id = дата `YYYY-MM-DD` | `reach`, `views`, `clicks`, `regs`, `pays`, `renewals`, `revenue` (если правили руками), `experts`, `mk`, `note`, `by`, `at` |
| `ledger` | операции денег | `kind` (out · in · invest), `amount`, `cat`, `date`, `note`, `planId`/`planMonth` (оплачено по плану), `by`, `at` |
| `plan` | план платежей | `title`, `group` (payroll · regular · once), `cat`, `amount`, `months` [YYYY-MM], `personId`, `insurance`, `taskId` |
| `people` | команда | `name`, `givenName`, `surname`, `title`, `dir`, `status` (active · inactive · vacancy), `managerId` (кому подчиняется), `salary`, `startMonth`, `email`, `phone`, `telegram`, `calEmail`, `birthDate`, `birthTime`, `birthCity`, `hdType`, `hdProfile`, `founder` |
| `accounts` | учётки | `name`, `email`, `role` (owner · lead · finance · member · investor), `personId`, `salt` и `hash` (PBKDF2-SHA256, 150 000 итераций), `claudeId` (вход через аккаунт Claude), `prefs`, `welcomed` |
| `invites` | приглашения, id = код | `role`, `personId`, `by`, `at`, `usedBy` |
| `docs` | одиночные документы | `strategy` (цели, этапы, точки, дорожная карта, `vision`), `settings` (цена, конверсии, сценарии, деньги), `learning` |
| `meetings` | собрания | `title`, `date`, `start`, `dur`, `repeat`, `organizer`, `attendees` [id], `guests` [почты для приглашения], `extGuests` [{id, name, email, tg, tgChatId}] — гости не из команды, `remindMin` (за сколько минут напомнить, 0 — не напоминать, нет поля — за час), `gcalId`, `meetUrl`, `responses`, `guestResp` [[почта, ответ]], `imported`/`gcalReadonly` (событие перенесено из Google) |
| `messages` | сообщения команды | `ch` (team · dm:<учётка>|<учётка>), `by` (учётка), `text`, `at` |
| `subs` | подписки по месяцам, id = `YYYY-MM` (пустое поле — считается само) | `startM`, `startY` (на начало), `newM`, `newY`, `renewed`, `churn` (не продлили), `refunds`, `refundSum` |
| `payouts` | выплаты: рефералам — записями; авторам и продавцам — отметка о выплате (`author_<курс>_<месяц>`, `seller_<код>_<месяц>`) | `kind` (ref · author · seller), `to`, `contact`, `month`, `n`, `base`, `pct`, `amount`, `status` (accrued · paid), `paidAt`, `ledgerId` |
| `courses` | курсы | `title`, `author`, `authorContact`, `price`, `authorPct`, `active`, `sales` {YYYY-MM: {n, revenue}} |
| `orders` | заказы маркетплейса | `no`, `date`, `customer`, `contact`, `address`, `items` [{productId, title, qty, price, cost, seller, fee}], `shipCost`, `pay` (wait · paid · refund), `paidAt`, `delivery` (new · packing · shipped · delivered · cancelled), `track`, `stockOut` |
| `products` | товары | `title`, `sku`, `price`, `cost`, `stock`, `seller` (пусто — свой склад), `fee` (комиссия клуба, %) |
| `failed` | сбои оплат | `date`, `client`, `contact`, `amount`, `plan` (month · year), `reason` (funds · bank · card · tds · limit · other), `attempts`, `status` (new · contacted · retry · paid · lost), `next`, `who`, `log` |
| `refunds` | запросы на возврат | `date`, `deadline` (+10 дней), `client`, `contact`, `product` (sub · course · market · other), `courseId`, `orderId`, `amount`, `reason`, `comment`, `status` (new · review · approved · refunded · rejected), `decision`, `who`, `refundedAt`, `log` |
| `busy` | занятость по Google Календарю (только интервалы, без названий) | `slots` [[начало, конец]], `crm`, `from`, `to`, `share` |
| `links` | свои материалы основателя | `title`, `url`, `group`, `roles` |

Деньги — в рублях, даты — `YYYY-MM-DD` по Москве, время — `HH:MM`, отметки времени — миллисекунды Unix.

Операция в журнале помнит, откуда она: `planId`/`planMonth` (оплата по финплану),
`payoutId` (выплата), `orderId` (заказ маркетплейса), `refundId` (возврат), `courseMonth`
(выручка курсов за месяц). В сбоях, возвратах и заказах — данные клиентов: держите штаб
закрытым от посторонних.

Разговор с Адамом в общую выгрузку не входит: в артефакте он лежит в личном разделе
базы человека (`data/users/<id>/adam-<учётка>`), вне артефакта — в его браузере.

Для таблиц в «Данных штаба» есть выгрузка в CSV (задачи, цифры продаж, операции,
команда): разделитель `;`, кодировка UTF-8 с BOM — открывается в Excel и Google Таблицах.

## Переезд

**Из артефакта Claude на свой сервер**

1. В штабе: «Команда» → «Данные штаба» → «Выгрузить всё (JSON)» с галочкой «с учётками и паролями».
2. На сервере (нужен только Node.js 18+, без зависимостей):
   ```bash
   cd club/v2/server
   node server.js --import eva-hq-full-2026-10-07.json
   PORT=8080 node server.js          # или EVA_KEY=секрет — доступ только по ключу
   ```
3. Откройте `http://сервер:8080/` (с ключом — один раз `http://сервер:8080/?key=секрет`). Входить теми же
   почтами и паролями. Вход через аккаунт Claude на своём сервере не работает — по паролю.

Можно и наоборот: открыть пустой штаб на сервере, создать учётку основателя и
загрузить файл через «Загрузить из файла…».

**Между серверами и хостингами** — скопируйте `server/data/eva-hq.json` или
выгрузите `GET /api/export` и загрузите на новом месте `--import`. Файл тот же.

**Обратно в артефакт** — «Загрузить из файла…» в штабе артефакта.

## Сервер штаба — что умеет

- раздаёт штаб (`index.html` + `eva-club-v2.html`) и подставляет адрес своего хранилища;
- `GET /api/state` — все данные, `GET /api/events` — живые правки (Server-Sent Events),
  `PUT/PATCH/DELETE /api/doc/<коллекция>/<id>` — запись, `GET /api/export`, `POST /api/import`;
- пишет на диск атомарно, хранит копию на каждый день (последние 30);
- `EVA_KEY` — доступ только с ключом; без него сервер открыт всем, кто знает адрес;
- напоминания в Telegram: создайте бота у @BotFather и запустите
  `TELEGRAM_BOT_TOKEN=… TELEGRAM_BOT_NAME=имя_бота node server.js`. Гость собрания
  нажимает «Старт» у бота по ссылке из «Напомнить» в штабе, человек из команды — по кнопке
  «Получать напоминания в Telegram» на своей странице. За час до собрания (или за сколько
  указано в собрании) бот пишет напоминание со ссылкой на встречу.

За HTTPS и доменом — любой обратный прокси (nginx, Caddy) перед `PORT`.
