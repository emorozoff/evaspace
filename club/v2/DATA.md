# Данные штаба Eva Club V2 — формат и переезд

Штаб хранит всё в одном формате, где бы он ни работал:

| Где открыт штаб | Где лежат данные | Как забрать |
| --- | --- | --- |
| Артефакт Claude | общая база артефакта (`claude.use('db')`) | «Команда» → «Данные штаба» → «Выгрузить всё» |
| Свой сервер (`server/server.js`) | файл `server/data/eva-hq.json` (CRM — `eva-crm.json`) + копия на каждый день в `server/data/backups/` | «Выгрузить всё» у основателя или `node server.js --export файл.json` |
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
2. На сервере (нужен только Node.js 18+, без зависимостей), пока сервер не запущен:
   ```bash
   cd club/v2/server
   node server.js --import eva-hq-full-2026-10-07.json      # штаб
   node server.js --import-crm eva-crm.json                  # Eva CRM (её коллекции: team, people, cfg)
   PORT=8080 node server.js
   ```
3. Откройте `http://сервер:8080/`. Входить теми же почтами и паролями: отпечатки паролей
   считаются тем же способом, поэтому старые пароли подходят. Вход через аккаунт Claude
   на своём сервере не работает — только по почте и паролю.

Можно и наоборот: открыть пустой штаб на сервере, создать учётку основателя и
загрузить файл через «Загрузить из файла…» (это может только основатель).

**Между серверами и хостингами** — скопируйте папку данных (`eva-hq.json`, `eva-crm.json`)
или выгрузите `--export` / `--export-crm` и загрузите на новом месте `--import` / `--import-crm`.

**Обратно в артефакт** — «Загрузить из файла…» в штабе артефакта.

## Сервер штаба и CRM — что умеет

Один сервер (`server/server.js`) отдаёт штаб (`/`), Eva CRM (`/crm/`) и анкету CRM для
клиенток (`/anketa/`, открыта без входа — данных с сервера она не получает).

- **Вход проверяет сервер.** Пароль уходит только ему; отпечатки паролей, коды сброса и
  приглашения в браузер не приходят. Сессия — в cookie (HttpOnly), живёт 30 дней. После
  серии неверных паролей вход с этого адреса закрывается на 15 минут.
- **Без входа сервер не отдаёт ни одной записи** — кроме того, без чего не открыть анкету
  приглашения (по коду) и форму нового пароля (по ссылке от основателя).
- **Каждой роли — только её данные** (`server/lib/hq-rules.js`, зеркало прав из
  `src/app/01-config.js`): команда не получает операции, план платежей, оклады, заказы и
  возвраты; инвестор получает деньги без данных клиентов и не получает задачи и сообщения;
  личные сообщения приходят только двум собеседникам. Чужие правки сервер не принимает:
  роль, пароль и чужую учётку не поменять записью в базу.
  Честно про границу: руководитель и инвестор видят план платежей и операции целиком —
  значит, суммы зарплатных строк им технически доступны, хотя на экране по людям не показаны.
- **Eva CRM** входит по той же учётке штаба (все, кроме инвесторов). Роль в CRM — в её
  собственной команде (`team/<id>.role`), правила — `server/lib/crm-rules.js`.
- `GET /api/state` — данные по роли, `GET /api/events` — живые правки (Server-Sent Events),
  `PUT/PATCH/DELETE /api/doc/<коллекция>/<id>` — запись; у CRM то же под `/crm/api/`.
  Полная выгрузка и загрузка файла — только основателю.
- пишет на диск атомарно, хранит копию на каждый день (последние 30) в `backups/`;
- **Google Календарь** — от имени вошедшего: каждый один раз подключает свой аккаунт Google
  («Календарь» → «Подключить»), ключи продления лежат в `data/gcal.json`. Нужны
  `GOOGLE_CLIENT_ID` и `GOOGLE_CLIENT_SECRET` (Google Cloud → Credentials → OAuth client,
  тип «Web application», адрес возврата `PUBLIC_URL/api/gcal/callback`) и `PUBLIC_URL`.
  Инструменты и поля — те же, что у коннектора Claude (`server/lib/gcal.js`).
- Чего на своём сервере нет: ответов Адама и сводок CRM с помощью Claude (остаются
  встроенные ответы), входа через аккаунт Claude, напоминаний в Telegram.

Настройки — переменные окружения, список в шапке `server/server.js`. За HTTPS и доменом —
обратный прокси (Caddy, nginx) перед `PORT` или сокетом `LISTEN`.

Выкладка на сервер проекта: `bash club/v2/server/deploy/deploy.sh` (код) и
`bash club/v2/server/deploy/caddy.sh` (адрес). Проверки: `node server/test/gcal-test.js` и
`node server/test/api-test.js` (вторая — против сервера, запущенного на пустой папке данных).
