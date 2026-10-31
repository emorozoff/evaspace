// База на встроенном в Node SQLite. Сервер хранит только зашифрованные сообщения:
// текст и фото он прочитать не может, видит лишь кто, кому и когда писал.
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { mintPlate, isGoldCode, partsOf, randomFreeCode, regionForCity, keyTaken, plateKey } from './plates.js';

export const GENERAL_CHAT = 'general';

export function openDb(dataDir) {
  fs.mkdirSync(dataDir, { recursive: true });
  const db = new DatabaseSync(path.join(dataDir, 'svoi.db'));
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      box_pk TEXT NOT NULL,
      kdf_salt TEXT NOT NULL,
      auth_hash TEXT NOT NULL,
      backup_n TEXT NOT NULL,
      backup_c TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      last_seen INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS invites (
      code TEXT PRIMARY KEY,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at INTEGER NOT NULL,
      used_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      used_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS chats (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      title TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chat_members (
      chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      read_up_to INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (chat_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
      sender_id INTEGER NOT NULL REFERENCES users(id),
      uuid TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      UNIQUE (sender_id, uuid)
    );
    CREATE INDEX IF NOT EXISTS messages_chat ON messages(chat_id, id);

    -- Каждое сообщение зашифровано отдельно для каждого участника чата.
    CREATE TABLE IF NOT EXISTS message_boxes (
      message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
      recipient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      nonce TEXT NOT NULL,
      ct TEXT NOT NULL,
      PRIMARY KEY (recipient_id, message_id)
    );

    CREATE TABLE IF NOT EXISTS blobs (
      id TEXT PRIMARY KEY,
      uploader_id INTEGER NOT NULL REFERENCES users(id),
      size INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS push_subs (
      endpoint TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      session_hash TEXT,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  db.prepare(`INSERT OR IGNORE INTO chats (id, kind, title, created_at) VALUES (?, 'general', 'Общий чат', ?)`)
    .run(GENERAL_CHAT, Date.now());

  migrate(db);
  return db;
}

function addColumn(db, table, col, def) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  if (!cols.includes(col)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
}

// Вторая версия: номера-«автомобильные», телефоны, круги, Аська, ИИ-люди и личные ИИ.
// Колонки добавляются к старой базе, ничего не удаляется.
function migrate(db) {
  // kind: human — человек, aska — Аська, person — ИИ-человек (для остальных выглядит как человек), twin — личный ИИ
  addColumn(db, 'users', 'kind', "TEXT NOT NULL DEFAULT 'human'");
  addColumn(db, 'users', 'owner_id', 'INTEGER');
  addColumn(db, 'users', 'plate', 'TEXT');
  addColumn(db, 'users', 'phone', 'TEXT');
  addColumn(db, 'users', 'phone_verified', 'INTEGER NOT NULL DEFAULT 0');
  addColumn(db, 'users', 'about', 'TEXT');
  addColumn(db, 'users', 'city', 'TEXT');
  addColumn(db, 'users', 'is_admin', 'INTEGER NOT NULL DEFAULT 0');
  addColumn(db, 'users', 'allow_anon', 'INTEGER NOT NULL DEFAULT 1');
  addColumn(db, 'users', 'bot_sk', 'TEXT');        // секретный ключ ботов — только на сервере
  addColumn(db, 'users', 'persona', 'TEXT');       // характер ИИ-человека — только на сервере
  addColumn(db, 'users', 'prev_pks', 'TEXT');      // прежние ключи после восстановления входа
  addColumn(db, 'users', 'key_reset_at', 'INTEGER');
  addColumn(db, 'users', 'last_active', 'INTEGER');
  addColumn(db, 'chats', 'emoji', 'TEXT');
  addColumn(db, 'chats', 'about', 'TEXT');
  addColumn(db, 'chats', 'is_public', 'INTEGER NOT NULL DEFAULT 0');
  addColumn(db, 'chats', 'created_by', 'INTEGER');
  addColumn(db, 'chats', 'meta', 'TEXT');

  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS users_plate ON users(plate) WHERE plate IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS users_phone ON users(phone) WHERE phone IS NOT NULL;
    CREATE INDEX IF NOT EXISTS users_owner ON users(owner_id);

    CREATE TABLE IF NOT EXISTS phone_codes (
      phone TEXT NOT NULL,
      purpose TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (phone, purpose)
    );

    -- Код для входа, который выдаёт администратор, если СМС не настроены
    CREATE TABLE IF NOT EXISTS help_codes (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      code_hash TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS pins (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      target_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, target_id)
    );

    -- Игра «Кто здесь ИИ?»
    CREATE TABLE IF NOT EXISTS guesses (
      guesser_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      target_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      guess TEXT NOT NULL,
      correct INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (guesser_id, target_id)
    );

    -- Что личный ИИ знает о хозяине
    CREATE TABLE IF NOT EXISTS twin_facts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      text TEXT NOT NULL,
      source TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS twin_facts_owner ON twin_facts(owner_id);

    -- Вопросы, которые личный ИИ передал хозяину
    CREATE TABLE IF NOT EXISTS twin_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      twin_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      asker_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      chat_id TEXT NOT NULL,
      anon INTEGER NOT NULL,
      question TEXT NOT NULL,
      owner_msg_id INTEGER,
      created_at INTEGER NOT NULL,
      answered_at INTEGER
    );

    -- Отложенные дела ботов (ответить, поздороваться…): переживают перезапуск сервера
    CREATE TABLE IF NOT EXISTS bot_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      due_at INTEGER NOT NULL,
      kind TEXT NOT NULL,
      bot_id INTEGER NOT NULL,
      chat_id TEXT NOT NULL DEFAULT '',
      payload TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS bot_jobs_due ON bot_jobs(due_at);
    CREATE UNIQUE INDEX IF NOT EXISTS bot_jobs_one ON bot_jobs(kind, bot_id, chat_id);

    -- Заметки ботов о людях («любит кино, есть собака»)
    CREATE TABLE IF NOT EXISTS bot_notes (
      bot_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      notes TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (bot_id, user_id)
    );

    -- Когда бот сам написал человеку — чтобы не надоедать
    CREATE TABLE IF NOT EXISTS bot_reach (
      bot_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      last_at INTEGER NOT NULL,
      unanswered INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (bot_id, user_id)
    );
  `);

  // Администратор — самый первый человек (тот, кто открыл АСЬКУ первым приглашением).
  if (!db.prepare("SELECT 1 FROM users WHERE is_admin = 1 AND kind = 'human'").get()) {
    db.prepare("UPDATE users SET is_admin = 1 WHERE id = (SELECT MIN(id) FROM users WHERE kind = 'human')").run();
  }
  migrateV3(db);
  migrateV4(db);
  migrateV5(db);
  migrateV6(db);
  migrateV7(db);
  migrateV9(db);
  migrateV10(db);
  migrateV11(db);
}

// Третья версия (22.10.2026): номера-токены (покупка, улучшение, рынок), аськоины, роли (голд-админы, супер-админ), блокировка.
function migrateV3(db) {
  addColumn(db, 'users', 'role', "TEXT NOT NULL DEFAULT 'user'"); // user | admin (голд) | super
  addColumn(db, 'users', 'blocked_at', 'INTEGER');
  addColumn(db, 'users', 'coins', 'INTEGER NOT NULL DEFAULT 0');
  addColumn(db, 'users', 'plate_id', 'INTEGER');
  addColumn(db, 'users', 'daily_day', 'TEXT');
  addColumn(db, 'users', 'old_plate_key', 'TEXT'); // номер второй версии, если его пришлось сменить, — по нему можно войти
  db.exec(`
    CREATE TABLE IF NOT EXISTS plates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL,
      key TEXT NOT NULL UNIQUE,
      country TEXT NOT NULL,
      region TEXT NOT NULL DEFAULT '',
      rarity INTEGER NOT NULL DEFAULT 0,
      level INTEGER NOT NULL DEFAULT 0,
      owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      price INTEGER,
      gold INTEGER NOT NULL DEFAULT 0,
      minted_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS plates_owner ON plates(owner_id);
    CREATE TABLE IF NOT EXISTS plate_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plate_id INTEGER NOT NULL REFERENCES plates(id) ON DELETE CASCADE,
      from_id INTEGER,
      to_id INTEGER,
      price INTEGER,
      kind TEXT NOT NULL,
      note TEXT,
      at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS plate_history_plate ON plate_history(plate_id);
    CREATE TABLE IF NOT EXISTS coin_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      delta INTEGER NOT NULL,
      reason TEXT NOT NULL,
      at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS coin_log_user ON coin_log(user_id, id);
    CREATE TABLE IF NOT EXISTS super_links (
      code_hash TEXT PRIMARY KEY,
      target_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      username TEXT,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      from_console INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      used_at INTEGER
    );
  `);
  // Администраторы второй версии становятся голд
  db.prepare("UPDATE users SET role = 'admin' WHERE is_admin = 1 AND role = 'user' AND kind = 'human'").run();

  // Каждый номер — токен в таблице plates. Серия АМР — только у голд (и у Аськи), остальным
  // выдаём номер с теми же цифрами в другой серии; ИИ-людям — в регионе их города.
  const done = getSetting(db, 'plates_v3');
  const users = db.prepare('SELECT * FROM users WHERE plate IS NOT NULL AND plate_id IS NULL ORDER BY id').all();
  for (const u of users) {
    tx(db, () => {
      const gold = u.role === 'admin' || u.role === 'super' || u.kind === 'aska';
      let code = u.plate;
      let country = 'RU';
      if (!partsOf('RU', code)) return;
      if (u.kind === 'person' || (!gold && isGoldCode('RU', code))) {
        const per = u.persona ? JSON.parse(u.persona) : null;
        const place = (per && regionForCity(per.city)) || { country: 'RU', region: partsOf('RU', code).region };
        country = place.country;
        code = randomFreeCode(db, country, place.region, { keepDigits: country === 'RU' ? partsOf('RU', u.plate).digits : undefined });
      } else if (keyTaken(db, plateKey(code))) {
        code = randomFreeCode(db, 'RU', partsOf('RU', code).region, { gold, keepDigits: partsOf('RU', code).digits });
      }
      const id = mintPlate(db, { country, code, ownerId: u.id, kind: 'mint', note: code === u.plate ? 'перенос' : `было ${u.plate}` });
      db.prepare('UPDATE users SET plate = ?, plate_id = ?, old_plate_key = ? WHERE id = ?').run(code, id, code === u.plate ? null : plateKey(u.plate), u.id);
    });
  }
  if (!done) {
    // стартовые аськоины всем людям
    const now = Date.now();
    for (const u of db.prepare("SELECT id FROM users WHERE kind = 'human'").all()) {
      db.prepare('UPDATE users SET coins = coins + 100 WHERE id = ?').run(u.id);
      db.prepare("INSERT INTO coin_log (user_id, delta, reason, at) VALUES (?, 100, 'подарок к запуску номеров', ?)").run(u.id, now);
    }
    setSetting(db, 'plates_v3', '1');
  }
}

// Опрос Аськи о вечеринке зумеров (22.10.2026): был ли человек и оценка 1–10 с отзывом.
function migrateV4(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS party_votes (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      asked_at INTEGER NOT NULL,
      attended INTEGER,
      rating INTEGER,
      comment TEXT,
      updated_at INTEGER
    );
  `);
}

// Пятое обновление: статус человека («медитирую», «вджобываю»…) и группы контактов
function migrateV5(db) {
  addColumn(db, 'users', 'status', 'TEXT');
  addColumn(db, 'users', 'status_at', 'INTEGER');
  db.exec(`
    CREATE TABLE IF NOT EXISTS contact_groups (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      target_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      grp TEXT NOT NULL,
      PRIMARY KEY (user_id, target_id)
    );
  `);
}

// Шестое обновление: стены — записи, цветочки, комментарии, фото
function migrateV6(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS wall_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wall_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      text TEXT,
      card TEXT,
      magnet TEXT,
      photo TEXT,
      w INTEGER,
      h INTEGER,
      created_at INTEGER NOT NULL,
      best_day TEXT
    );
    CREATE INDEX IF NOT EXISTS wall_posts_wall ON wall_posts (wall_id, id);
    CREATE INDEX IF NOT EXISTS wall_posts_author ON wall_posts (author_id);
    CREATE TABLE IF NOT EXISTS wall_flowers (
      post_id INTEGER NOT NULL REFERENCES wall_posts(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (post_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS wall_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL REFERENCES wall_posts(id) ON DELETE CASCADE,
      author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      text TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS wall_comments_post ON wall_comments (post_id, id);
    CREATE TABLE IF NOT EXISTS wall_photos (
      id TEXT PRIMARY KEY,
      uploader_id INTEGER,
      size INTEGER,
      mime TEXT,
      created_at INTEGER NOT NULL
    );
  `);
}

// Седьмое обновление: реакции, аськоины в подарок за запись, гифки-мемы, «скрыть человека для себя»
function migrateV7(db) {
  addColumn(db, 'wall_posts', 'sticker', 'TEXT');
  addColumn(db, 'wall_comments', 'sticker', 'TEXT');
  db.exec(`
    CREATE TABLE IF NOT EXISTS wall_reactions (
      post_id INTEGER NOT NULL REFERENCES wall_posts(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      emoji TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (post_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS wall_tips (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL REFERENCES wall_posts(id) ON DELETE CASCADE,
      from_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      to_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      amount INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS user_hides (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      target_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, target_id)
    );
  `);
}

// Транзакция: всё или ничего.
export function tx(db, fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

export function getSetting(db, key) {
  return db.prepare('SELECT value FROM settings WHERE key = ?').get(key)?.value;
}

export function setSetting(db, key, value) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, value);
}

// Девятое обновление (31.10.2026): «Бизнес» — групповые чаты для работы помечены разделом
// (team — команда, work — работа, biz — бизнес, partners — партнёры). В личных стилях их не видно.
function migrateV9(db) {
  addColumn(db, 'chats', 'biz', 'TEXT');
}

// Десятое обновление (31.10.2026): уровни (Гость / Голд / Блэк), нетворк, место-регион на номере,
// реестр на внутренней цепочке блоков (музыка, кино, книги), ночные комнаты с НФТ-аватарами.
// Одиннадцатое (31.10.2026): стиль «Царская особа» — Аська обращается «Ваше Величество»
function migrateV11(db) {
  addColumn(db, 'users', 'royal', 'INTEGER NOT NULL DEFAULT 0');
}

function migrateV10(db) {
  // уровень: guest | gold | black; tier_until — до какого времени оплачен Голд (NULL — навсегда)
  addColumn(db, 'users', 'tier', "TEXT NOT NULL DEFAULT 'guest'");
  addColumn(db, 'users', 'tier_until', 'INTEGER');
  addColumn(db, 'users', 'vip_region', 'TEXT');   // 777 или 888 — у Голд и Блэк вместо места
  addColumn(db, 'users', 'place', 'TEXT');        // где человек сейчас — регион на номере (ключ из places.js)
  addColumn(db, 'users', 'net_size', 'INTEGER NOT NULL DEFAULT 0'); // сколько человек во всём нетворке (вся цепочка вниз)
  addColumn(db, 'users', 'upass', 'TEXT');        // номер пропуска UPASS у Блэк
  db.exec(`
    -- Приглашение в Блэк: только от Блэк или администрации, человек сам принимает
    CREATE TABLE IF NOT EXISTS tier_invites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      to_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      tier TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      accepted_at INTEGER,
      UNIQUE (to_id, tier)
    );
    -- Внутренний блокчейн АСЬКИ: каждая запись ссылается на хеш предыдущей
    CREATE TABLE IF NOT EXISTS ledger (
      id INTEGER PRIMARY KEY,
      kind TEXT NOT NULL,
      ref TEXT NOT NULL,
      actor_id INTEGER,
      data TEXT NOT NULL,
      prev_hash TEXT NOT NULL,
      hash TEXT NOT NULL UNIQUE,
      at INTEGER NOT NULL
    );
    -- Реестр: музыка, кино, книги. key — чтобы одно и то же не занесли дважды («кто первый занёс»)
    CREATE TABLE IF NOT EXISTS catalog_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL,
      key TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      year INTEGER,
      link TEXT,
      note TEXT,
      added_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at INTEGER NOT NULL,
      block INTEGER NOT NULL,
      rights TEXT NOT NULL DEFAULT 'none',
      rights_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      rights_note TEXT,
      rights_block INTEGER,
      synth TEXT
    );
    CREATE INDEX IF NOT EXISTS catalog_kind ON catalog_items (kind, id);
    -- Ночь: НФТ-аватары (пиксельные), у людей — owner_id, у ночных ботов — bot
    CREATE TABLE IF NOT EXISTS night_avatars (
      id INTEGER PRIMARY KEY,
      owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      bot TEXT UNIQUE,
      nick TEXT NOT NULL UNIQUE,
      minted_at INTEGER NOT NULL,
      block INTEGER
    );
    CREATE UNIQUE INDEX IF NOT EXISTS night_avatar_owner ON night_avatars (owner_id) WHERE owner_id IS NOT NULL;
    CREATE TABLE IF NOT EXISTS night_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room TEXT NOT NULL,
      avatar_id INTEGER NOT NULL REFERENCES night_avatars(id),
      text TEXT NOT NULL,
      at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS night_messages_room ON night_messages (room, id);
    -- Репутация в комнате: из неё ранги (советники, хранители, джедаи, самураи)
    CREATE TABLE IF NOT EXISTS night_rep (
      room TEXT NOT NULL,
      avatar_id INTEGER NOT NULL REFERENCES night_avatars(id),
      posts INTEGER NOT NULL DEFAULT 0,
      rep INTEGER NOT NULL DEFAULT 0,
      last_at INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (room, avatar_id)
    );
    -- Пропуск в комнату: первый час в день бесплатно, дальше — аськоины за час
    CREATE TABLE IF NOT EXISTS night_passes (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      room TEXT NOT NULL,
      until INTEGER NOT NULL DEFAULT 0,
      free_day TEXT,
      paid INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, room)
    );
    -- «Спасибо» за сообщение в комнате (+2 к репутации автора), одно от человека
    CREATE TABLE IF NOT EXISTS night_thanks (
      message_id INTEGER NOT NULL REFERENCES night_messages(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      PRIMARY KEY (message_id, user_id)
    );
    -- Президент комнаты назначается (человек), остальные ранги — по репутации
    CREATE TABLE IF NOT EXISTS night_seats (
      room TEXT PRIMARY KEY,
      president_user INTEGER REFERENCES users(id) ON DELETE SET NULL,
      president_avatar INTEGER REFERENCES night_avatars(id)
    );
  `);
  // Админы — не ниже Голд (супер-админ — Блэк); Голд и Блэк у них навсегда
  db.prepare("UPDATE users SET tier = 'black' WHERE role = 'super' AND tier != 'black'").run();
  db.prepare("UPDATE users SET tier = 'gold' WHERE role = 'admin' AND tier = 'guest'").run();
}
