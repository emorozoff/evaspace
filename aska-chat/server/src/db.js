// База на встроенном в Node SQLite. Сервер хранит только зашифрованные сообщения:
// текст и фото он прочитать не может, видит лишь кто, кому и когда писал.
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

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
