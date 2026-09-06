<?php
/* =====================================================================
   Eva Space — API v3
   Хранение: JSON-файл + файлы в /uploads. PHP 7.4+.

   Что изменилось против v2:
   · пароли проверяются здесь, а не в браузере: password_hash / password_verify
   · вход выдаёт токен сессии; права проверяются по токену, а не по общему ключу
   · список пользователей и чужой прогресс больше не отдаются посторонним
   · роль администратора берётся только из data/config.php, а не из базы
   · открытые разделы (лента, заказы, вопросы) дописываются, но не стираются
   · защита от перебора пароля

   Первая настройка: откройте api.php?action=diag в браузере — страница
   покажет, что осталось сделать. Права администратора выдаются вписыванием
   почты в data/config.php.
   ===================================================================== */

declare(strict_types=1);
@ini_set('display_errors', '0');
error_reporting(E_ALL);

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') { http_response_code(204); exit; }

const DATA_DIR   = __DIR__ . '/data';
const DB_FILE    = DATA_DIR . '/db.json';
const BAK_FILE   = DATA_DIR . '/db.backup.json';
const CFG_FILE   = DATA_DIR . '/config.php';
const REV_FILE   = DATA_DIR . '/rev.txt';
const UPLOAD_DIR = __DIR__ . '/uploads';
const UPLOAD_URL = 'uploads';
const MAX_UPLOAD = 12 * 1024 * 1024;

const SESSION_DAYS = 90;          // сколько живёт вход без повторного пароля
const MAX_BRANCH   = 2097152;     // 2 МБ на один раздел данных
const MAX_ITEMS    = 5000;        // столько записей помещается в открытый раздел
const TRY_LIMIT    = 8;           // попыток пароля
const TRY_WINDOW   = 900;         // за столько секунд

/* разделы, куда пишет обычная пользовательница: только дополнение, без удаления */
const OPEN_BRANCHES = ['orders', 'questions', 'support', 'wall', 'ideas', 'events', 'media', 'reviews', 'groups', 'chats', 'tipstars'];
/* карточки участниц: номер записи — это почта, и своя запись у каждой одна.
   Отдельно от OPEN_BRANCHES нарочно: там запись правит кто угодно, а здесь
   чужую карточку тронуть нельзя — иначе можно было бы вписать себя
   в чужие знакомые и тем открыть себе переписку. */
const CARD_BRANCHES = ['people'];
/* здесь пользовательница трогает только строку со своей почтой */
const SELF_BRANCHES = ['avatars'];
/* сюда пишет только администратор: эксперту тут делать нечего */
const ADMIN_BRANCHES = ['adminInfo'];
/* ---------- напоминания на телефон ----------
   Объявлено здесь, а не рядом с самими функциями: константы в PHP
   появляются по ходу выполнения файла, а расписание дёргается из
   обработчика выше по тексту. */
const PUSH_FILE    = DATA_DIR . '/push.json';
const PUSH_TICK    = 600;         // не чаще раза в десять минут проверяем расписание
const PUSH_TTL     = 172800;      // двое суток на доставку
/* обратный адрес в подписи уведомлений — его требует стандарт */
const PUSH_CONTACT = 'help@evaspace.ru';
/* карты, ключ которых — номер курса: право на ключ равно праву на курс */
const COURSE_MAPS = ['lessons', 'modules', 'courseInfo', 'courseTags', 'courseKind'];

/* ---------- служебное ---------- */
function low(string $s): string {
  $s = trim($s);
  return function_exists('mb_strtolower') ? mb_strtolower($s, 'UTF-8') : strtolower($s);
}
function fail(string $msg, int $code = 400, array $extra = []): void {
  http_response_code($code);
  echo json_encode(['ok' => false, 'error' => $msg] + $extra, JSON_UNESCAPED_UNICODE);
  exit;
}
function ok(array $data = []): void {
  echo json_encode(['ok' => true] + $data, JSON_UNESCAPED_UNICODE);
  exit;
}
function ensure_dirs(): array {
  $problems = [];
  foreach ([DATA_DIR, UPLOAD_DIR] as $d) {
    if (!is_dir($d) && !@mkdir($d, 0775, true)) $problems[] = 'не удалось создать папку ' . basename($d);
    elseif (!is_writable($d)) $problems[] = 'папка ' . basename($d) . ' недоступна для записи, поставьте права 755';
  }
  return $problems;
}

/* ---------- настройки ----------
   data/config.php лежит рядом с базой и не попадает в git.
   Права администратора даёт только он. */
function config(): array {
  static $cfg = null;
  if ($cfg !== null) return $cfg;

  if (!file_exists(CFG_FILE) && is_dir(DATA_DIR) && is_writable(DATA_DIR)) {
    @file_put_contents(CFG_FILE, <<<'PHP'
<?php
/* Настройки Eva Space. Файл не публикуется и не попадает в git.

   admins — почты с правами администратора. Впишите сюда свою почту,
   зарегистрируйтесь в приложении с ней, и панель управления откроется.
   Больше никак права администратора не выдаются. */
return [
  'admins' => [
    // 'moya@pochta.ru',
  ],
];
PHP
    );
    @chmod(CFG_FILE, 0640);
  }

  $raw = file_exists(CFG_FILE) ? @include CFG_FILE : null;
  $cfg = is_array($raw) ? $raw : [];
  $cfg += ['admins' => []];
  $cfg['admins'] = array_values(array_filter(array_map('low', (array)$cfg['admins'])));
  return $cfg;
}

/* ---------- хранилище ---------- */
function db_read(): array {
  $j = null;
  if (file_exists(DB_FILE)) {
    $raw = @file_get_contents(DB_FILE);
    $j = json_decode($raw ?: '', true);
  }
  if (!is_array($j) && file_exists(BAK_FILE)) {      // основной файл повреждён — берём копию
    $raw = @file_get_contents(BAK_FILE);
    $j = json_decode($raw ?: '', true);
  }
  if (!is_array($j)) $j = [];
  $j += ['rev' => 0, 'updated' => 0, 'shared' => [], 'users' => [],
         'progress' => [], 'sessions' => [], 'tries' => [], 'dm' => []];
  return $j;
}
function db_write(array $db): void {
  $problems = ensure_dirs();
  if ($problems) fail(implode('; ', $problems), 500);

  /* просроченные сессии и счётчики попыток не копим */
  $edge = time() - SESSION_DAYS * 86400;
  foreach ($db['sessions'] as $t => $s) {
    if ((int)($s['at'] ?? 0) < $edge) unset($db['sessions'][$t]);
  }
  foreach ($db['tries'] as $m => $t) {
    if ((int)($t['at'] ?? 0) < time() - TRY_WINDOW) unset($db['tries'][$m]);
  }

  if (file_exists(DB_FILE) && filesize(DB_FILE) > 2) @copy(DB_FILE, BAK_FILE);
  $json = json_encode($db, JSON_UNESCAPED_UNICODE);
  if ($json === false) fail('Не удалось упаковать данные: ' . json_last_error_msg(), 500);
  $tmp = DB_FILE . '.tmp';
  if (@file_put_contents($tmp, $json, LOCK_EX) === false) {
    fail('Нет прав на запись в папку data. Поставьте ей права 755 в файловом менеджере', 500);
  }
  if (!@rename($tmp, DB_FILE)) { @unlink($tmp); fail('Не удалось обновить файл базы', 500); }
  @chmod(DB_FILE, 0644);
  /* крошечный файл с номером версии: приложения спрашивают его каждые
     полминуты, и разбирать ради этого всю базу незачем */
  @file_put_contents(REV_FILE, (int)$db['rev'] . ' ' . (int)$db['updated']);
}

/* ---------- пароли ----------
   Новые пароли хранятся хешем password_hash. Аккаунты, заведённые старой
   версией, входят по своему прежнему хешу один раз — и сразу переводятся
   на нормальный. */
function legacy_hash(string $p): string {
  $h = 5381;
  $len = function_exists('mb_strlen') ? mb_strlen($p, 'UTF-8') : strlen($p);
  for ($i = 0; $i < $len; $i++) {
    $ch = function_exists('mb_substr') ? mb_substr($p, $i, 1, 'UTF-8') : $p[$i];
    $code = function_exists('mb_ord') ? (int)mb_ord($ch, 'UTF-8') : ord($ch);
    $h = (($h << 5) + $h + $code) & 0xFFFFFFFF;
  }
  return 'h' . base_convert((string)$h, 10, 36) . $len;
}
function pass_check(array $u, string $plain): bool {
  $hash = (string)($u['pass'] ?? '');
  if ($hash === '') return false;
  if (strncmp($hash, '$', 1) === 0) return password_verify($plain, $hash);
  return hash_equals($hash, legacy_hash($plain));   // старый аккаунт
}
function pass_is_legacy(array $u): bool {
  return strncmp((string)($u['pass'] ?? ''), '$', 1) !== 0;
}

/* ---------- сессии и права ---------- */
function new_token(): string {
  try { return bin2hex(random_bytes(24)); }
  catch (Exception $e) { return bin2hex(pack('NNNN', mt_rand(), mt_rand(), mt_rand(), mt_rand())); }
}
function role_of(array $u): string {
  if (in_array(low((string)($u['email'] ?? '')), config()['admins'], true)) return 'admin';
  return (($u['role'] ?? '') === 'expert') ? 'expert' : 'user';
}
function safe_user(array $u): array {
  return [
    'email'    => $u['email'] ?? '',
    'name'     => $u['name'] ?? '',
    'role'     => role_of($u),
    'verified' => !empty($u['verified']),
    'avatar'   => $u['avatar'] ?? '',
    'created'  => $u['created'] ?? 0
  ];
}
function user_by_token(array $db, string $token): ?array {
  if ($token === '') return null;
  $s = $db['sessions'][$token] ?? null;
  if (!is_array($s)) return null;
  if ((int)($s['at'] ?? 0) < time() - SESSION_DAYS * 86400) return null;
  $u = $db['users'][low((string)($s['email'] ?? ''))] ?? null;
  return is_array($u) ? $u : null;
}
function need_user(?array $u): array {
  if (!$u) fail('Нужно войти в аккаунт', 401);
  return $u;
}
function need_admin(?array $u): array {
  $u = need_user($u);
  if (role_of($u) !== 'admin') fail('Нужны права администратора', 403);
  return $u;
}
function need_staff(?array $u): array {
  $u = need_user($u);
  if (!in_array(role_of($u), ['admin', 'expert'], true)) fail('Нужны права эксперта или администратора', 403);
  return $u;
}

/* ---------- проверки входных данных ---------- */
function valid_mail(string $m): bool {
  return (bool)preg_match('/^[^@\s]+@[^@\s]+\.[a-zа-яё]{2,}$/iu', $m);
}
function gen_code(): string { return (string)random_int(100000, 999999); }

/* ---------- разбор запроса ---------- */
$action = (string)($_GET['action'] ?? 'state');
$isPost = ($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST';
$body   = [];
$rawLen = (int)($_SERVER['CONTENT_LENGTH'] ?? 0);

if ($isPost) {
  $ctype = strtolower((string)($_SERVER['CONTENT_TYPE'] ?? ''));
  if (strpos($ctype, 'multipart/form-data') !== false) {
    $body = $_POST;
    if ($rawLen > 0 && !$_POST && !$_FILES) {
      fail('Файл больше допустимого размера для этого хостинга (' . ini_get('post_max_size')
         . '). Уменьшите изображение или увеличьте post_max_size', 413);
    }
  } else {
    $raw = file_get_contents('php://input');
    if ($rawLen > 0 && ($raw === '' || $raw === false)) {
      fail('Данные не дошли до сервера: превышен post_max_size (' . ini_get('post_max_size')
         . '). Приложение отправит их меньшими частями', 413);
    }
    $body = json_decode($raw ?: '[]', true);
    if (!is_array($body)) fail('Не удалось разобрать запрос: ' . json_last_error_msg());
  }
}

$token = (string)($body['token'] ?? $_GET['token'] ?? '');
if ($token === '' && preg_match('/Bearer\s+(\S+)/i', (string)($_SERVER['HTTP_AUTHORIZATION'] ?? ''), $m)) {
  $token = $m[1];
}

/* ---------- действия ---------- */
switch ($action) {

  /* самопроверка. Посторонним видно только состояние папок */
  case 'diag': {
    $problems = ensure_dirs();
    $cfg = config();
    $canWrite = false;
    if (is_dir(DATA_DIR)) {
      $t = DATA_DIR . '/.write-test';
      $canWrite = @file_put_contents($t, 'ok') !== false;
      if ($canWrite) @unlink($t); else $problems[] = 'запись в папку data не работает';
    }
    if (!file_exists(CFG_FILE)) $problems[] = 'нет файла data/config.php — создайте его и впишите почту администратора';
    elseif (!$cfg['admins'])    $problems[] = 'в data/config.php не указана ни одна почта администратора';

    $db  = db_read();
    $me  = user_by_token($db, $token);
    $out = [
      'data_ok'     => $canWrite,
      'uploads_ok'  => is_dir(UPLOAD_DIR) && is_writable(UPLOAD_DIR),
      'config_ok'   => file_exists(CFG_FILE) && (bool)$cfg['admins'],
      'you'         => $me ? role_of($me) : 'гость',
      'problems'    => $problems
    ];
    if ($me && role_of($me) === 'admin') {
      $out += [
        'php'           => PHP_VERSION,
        'post_max'      => ini_get('post_max_size'),
        'upload_max'    => ini_get('upload_max_filesize'),
        'uploads_count' => is_dir(UPLOAD_DIR) ? max(0, count((array)scandir(UPLOAD_DIR)) - 2) : 0,
        'db_size'       => file_exists(DB_FILE) ? filesize(DB_FILE) : 0,
        'rev'           => $db['rev'],
        'updated'       => $db['updated'],
        'branches'      => array_keys($db['shared']),
        'users'         => count($db['users']),
        'sessions'      => count($db['sessions']),
        'legacy_pass'   => count(array_filter($db['users'], 'pass_is_legacy'))
      ];
    }
    ok($out);
  }

  case 'ping': ok(['time' => time()]);

  /* только номер версии данных — несколько байт вместо всей базы */
  case 'rev': {
    push_tick();
    if (file_exists(REV_FILE)) {
      $raw = explode(' ', trim((string)@file_get_contents(REV_FILE)));
      if (isset($raw[0]) && $raw[0] !== '') ok(['rev' => (int)$raw[0], 'updated' => (int)($raw[1] ?? 0)]);
    }
    $db = db_read();
    ok(['rev' => (int)$db['rev'], 'updated' => (int)$db['updated']]);
  }

  /* общий контент — он и так виден всем в приложении */
  case 'state': {
    $db = db_read();
    ok(['rev' => $db['rev'], 'updated' => $db['updated'], 'shared' => $db['shared'] ?: new stdClass()]);
  }

  /* ---------- аккаунты ---------- */

  case 'register': {
    if (!$isPost) fail('Ожидается POST');
    $mail = low((string)($body['email'] ?? ''));
    $name = trim((string)($body['name'] ?? ''));
    $pass = (string)($body['pass'] ?? '');
    if (!valid_mail($mail))      fail('Проверь адрес почты');
    if ($name === '')            fail('Не указано имя');
    if (mb_strlen($pass) < 6)    fail('Пароль минимум 6 символов');

    $db = db_read();
    if (isset($db['users'][$mail])) fail('Эта почта уже занята — войди в аккаунт', 409);

    $code = gen_code();
    $db['users'][$mail] = [
      'email' => $mail, 'name' => mb_substr($name, 0, 80),
      'pass' => password_hash($pass, PASSWORD_DEFAULT),
      'verified' => false, 'code' => $code, 'role' => 'user', 'created' => time() * 1000
    ];
    $tok = new_token();
    $db['sessions'][$tok] = ['email' => $mail, 'at' => time()];
    db_write($db);
    /* почтовый сервис ещё не подключён, поэтому код возвращаем приложению —
       оно показывает его на экране. Когда появится рассылка, строку убрать. */
    ok(['token' => $tok, 'user' => safe_user($db['users'][$mail]), 'demo_code' => $code]);
  }

  case 'login': {
    if (!$isPost) fail('Ожидается POST');
    $mail = low((string)($body['email'] ?? ''));
    $pass = (string)($body['pass'] ?? '');
    if ($mail === '' || $pass === '') fail('Введи почту и пароль');

    $db = db_read();
    $t  = $db['tries'][$mail] ?? null;
    if ($t && (int)$t['n'] >= TRY_LIMIT && (int)$t['at'] > time() - TRY_WINDOW) {
      fail('Слишком много попыток. Попробуй через 15 минут', 429);
    }
    $u = $db['users'][$mail] ?? null;
    if (!is_array($u) || !pass_check($u, $pass)) {
      $n = ($t && (int)$t['at'] > time() - TRY_WINDOW) ? (int)$t['n'] + 1 : 1;
      $db['tries'][$mail] = ['n' => $n, 'at' => time()];
      db_write($db);
      fail('Неверная почта или пароль', 401);
    }
    if (pass_is_legacy($u)) $u['pass'] = password_hash($pass, PASSWORD_DEFAULT);  // переводим на нормальный хеш
    $db['users'][$mail] = $u;
    unset($db['tries'][$mail]);
    $tok = new_token();
    $db['sessions'][$tok] = ['email' => $mail, 'at' => time()];
    db_write($db);
    $res = ['token' => $tok, 'user' => safe_user($u)];
    if (empty($u['verified'])) $res['demo_code'] = (string)($u['code'] ?? '');
    ok($res);
  }

  case 'me': {
    $db = db_read();
    $u  = user_by_token($db, $token);
    if (!$u) ok(['user' => null]);
    ok(['user' => safe_user($u)]);
  }

  case 'logout': {
    $db = db_read();
    if ($token !== '' && isset($db['sessions'][$token])) {
      unset($db['sessions'][$token]);
      db_write($db);
    }
    ok([]);
  }

  case 'verify': {
    if (!$isPost) fail('Ожидается POST');
    $db   = db_read();
    $me   = user_by_token($db, $token);
    $mail = $me ? low((string)$me['email']) : low((string)($body['email'] ?? ''));
    $u    = $db['users'][$mail] ?? null;
    if (!is_array($u)) fail('Аккаунт не найден', 404);
    if (!hash_equals((string)($u['code'] ?? ''), trim((string)($body['code'] ?? '')))) fail('Код не совпадает');
    $u['verified'] = true; $u['code'] = '';
    $db['users'][$mail] = $u;
    db_write($db);
    ok(['user' => safe_user($u)]);
  }

  case 'resend': {
    if (!$isPost) fail('Ожидается POST');
    $db   = db_read();
    $me   = user_by_token($db, $token);
    $mail = $me ? low((string)$me['email']) : low((string)($body['email'] ?? ''));
    $u    = $db['users'][$mail] ?? null;
    if (!is_array($u)) fail('Аккаунт не найден', 404);
    $u['code'] = gen_code();
    $db['users'][$mail] = $u;
    db_write($db);
    ok(['demo_code' => $u['code']]);
  }

  /* список аккаунтов — только администратору и без паролей */
  case 'users': {
    $db = db_read();
    need_admin(user_by_token($db, $token));
    $out = [];
    foreach ($db['users'] as $m => $u) $out[$m] = safe_user($u);
    ok(['users' => $out ?: new stdClass()]);
  }

  /* правка профиля: своего — сама, чужого — администратор */
  case 'user_save': {
    if (!$isPost) fail('Ожидается POST');
    $db = db_read();
    $me = need_user(user_by_token($db, $token));
    $in = $body['user'] ?? null;
    if (!is_array($in) || empty($in['email'])) fail('Нет данных пользователя');

    $mail  = low((string)$in['email']);
    $admin = role_of($me) === 'admin';
    if (!$admin && $mail !== low((string)$me['email'])) fail('Можно менять только свой профиль', 403);

    $u = $db['users'][$mail] ?? null;
    if (!is_array($u)) fail('Аккаунт не найден', 404);

    if (isset($in['name']))   $u['name']   = mb_substr(trim((string)$in['name']), 0, 80);
    if (isset($in['avatar'])) $u['avatar'] = mb_substr((string)$in['avatar'], 0, 500);
    if ($admin) {
      if (isset($in['verified'])) $u['verified'] = (bool)$in['verified'];
      if (isset($in['role']))     $u['role'] = ((string)$in['role'] === 'expert') ? 'expert' : 'user';
    }
    /* пароль, почта и права через этот вызов не меняются никогда */
    $db['users'][$mail] = $u;
    $db['updated'] = time();
    db_write($db);
    ok(['user' => safe_user($u)]);
  }

  /* выдать или снять роль эксперта */
  case 'grant': {
    if (!$isPost) fail('Ожидается POST');
    $db = db_read();
    need_admin(user_by_token($db, $token));
    $mail = low((string)($body['email'] ?? ''));
    $role = (string)($body['role'] ?? 'user');
    $u = $db['users'][$mail] ?? null;
    if (!is_array($u)) fail('Аккаунт не найден', 404);
    $u['role'] = ($role === 'expert') ? 'expert' : 'user';
    $db['users'][$mail] = $u;
    db_write($db);
    ok(['user' => safe_user($u)]);
  }

  /* удалить аккаунт вместе с прогрессом и перепиской */
  case 'user_delete': {
    if (!$isPost) fail('Ожидается POST');
    $db = db_read();
    $me = need_admin(user_by_token($db, $token));
    $mail = low((string)($body['email'] ?? ''));
    if ($mail === '') fail('Не указана почта');
    if ($mail === low((string)$me['email'])) fail('Свой аккаунт удалить нельзя', 403);
    if (in_array($mail, config()['admins'], true)) {
      fail('Это администратор — уберите почту из data/config.php, потом удаляйте', 403);
    }
    if (!isset($db['users'][$mail])) fail('Аккаунт не найден', 404);
    unset($db['users'][$mail], $db['progress'][$mail], $db['dm'][$mail]);
    foreach ($db['sessions'] as $t => $sn) {          // выкидываем со всех устройств
      if (low((string)($sn['email'] ?? '')) === $mail) unset($db['sessions'][$t]);
    }
    $db['updated'] = time();
    db_write($db);
    ok(['deleted' => $mail]);
  }

  /* ---------- личные сообщения от платформы ----------
     Лежат отдельно от общих данных: каждая женщина видит только свои. */
  case 'dm_send': {
    if (!$isPost) fail('Ожидается POST');
    $db = db_read();
    $me = need_user(user_by_token($db, $token));
    $mail = low((string)($body['email'] ?? ''));
    $text = trim((string)($body['text'] ?? ''));
    /* Женщина пишет только той, с кем знакома, и знакомство проверяется
       здесь, а не в приложении: обе карточки должны называть друг друга.
       Иначе достаточно было бы подделать запрос, чтобы писать незнакомым. */
    if (!in_array(role_of($me), ['admin', 'expert'], true)) {
      if (!mates_both($db, low((string)$me['email']), $mail))
        fail('Написать можно той, с кем вы знакомы', 403);
      if (mb_strlen($text) > 2000) fail('Сообщение длиннее 2000 символов', 413);
      if (dm_flood($db, low((string)$me['email']))) fail('Слишком много сообщений подряд, подождите', 429);
    }
    if ($mail === '') fail('Не указана почта получателя');
    if ($text === '') fail('Пустое сообщение');
    if (!isset($db['users'][$mail])) fail('Такого аккаунта нет', 404);
    if (mb_strlen($text) > 4000) fail('Сообщение длиннее 4000 символов', 413);

    $db['dm'][$mail] = array_slice(array_merge($db['dm'][$mail] ?? [], [[
      'id'      => 'dm' . bin2hex(random_bytes(6)),
      'from'    => mb_substr(trim((string)($body['from'] ?? 'Eva Space')), 0, 80),
      'by'      => low((string)$me['email']),        // кто отправил — для счёта и жалоб
      'subject' => mb_substr(trim((string)($body['subject'] ?? '')), 0, 120),
      'text'    => $text,
      'at'      => time() * 1000
    ]]), -200);                                        // храним последние 200
    $db['updated'] = time();
    db_write($db);
    ok([]);
  }

  case 'dm_get': {
    $db = db_read();
    $me = need_user(user_by_token($db, $token));
    $mail = low((string)($_GET['email'] ?? $me['email']));
    if ($mail !== low((string)$me['email']) && role_of($me) !== 'admin') fail('Чужая переписка недоступна', 403);
    ok(['dm' => $db['dm'][$mail] ?? []]);
  }

  /* ---------- напоминания на телефон ---------- */
  case 'push_key': {
    ok(['key' => push_keys()['pub'], 'contact' => PUSH_CONTACT]);
  }
  case 'push_save': {
    if (!$isPost) fail('Ожидается POST');
    $db = db_read();
    $me = need_user(user_by_token($db, $token));
    $mail = low((string)$me['email']);
    $ep = (string)($body['endpoint'] ?? '');
    $p256 = (string)($body['p256dh'] ?? '');
    $auth = (string)($body['auth'] ?? '');
    if ($ep === '' || $p256 === '' || $auth === '') fail('Неполная подписка');
    if (!preg_match('~^https://~', $ep)) fail('Подписка должна быть по https');

    $p = push_read();
    $list = $p['subs'][$mail] ?? [];
    $list = array_values(array_filter(is_array($list) ? $list : [],
      fn($s) => ($s['endpoint'] ?? '') !== $ep));          // то же устройство не двоим
    $list[] = ['endpoint' => $ep, 'p256dh' => $p256, 'auth' => $auth, 'at' => time()];
    $p['subs'][$mail] = array_slice($list, -5);            // пять устройств на женщину
    push_write($p);
    ok(['devices' => count($p['subs'][$mail])]);
  }
  case 'push_drop': {
    if (!$isPost) fail('Ожидается POST');
    $db = db_read();
    $me = need_user(user_by_token($db, $token));
    $mail = low((string)$me['email']);
    $ep = (string)($body['endpoint'] ?? '');
    $p = push_read();
    if ($ep === '') unset($p['subs'][$mail]);
    else {
      $list = array_values(array_filter($p['subs'][$mail] ?? [],
        fn($s) => ($s['endpoint'] ?? '') !== $ep));
      if ($list) $p['subs'][$mail] = $list; else unset($p['subs'][$mail]);
    }
    push_write($p);
    ok(['devices' => count($p['subs'][$mail] ?? [])]);
  }
  /* проверка «дошло или нет» — женщина нажимает сама у себя в настройках */
  case 'push_test': {
    $db = db_read();
    $me = need_user(user_by_token($db, $token));
    $n = push_to(low((string)$me['email']), [
      't' => 'Проверка связи',
      'b' => 'Так будут выглядеть напоминания от Евы. Не чаще двух раз в неделю.',
      'u' => '/'
    ]);
    ok(['sent' => $n]);
  }
  /* расписание вручную или по cron */
  case 'push_tick': {
    ok(['sent' => push_tick(true)]);
  }

  /* ---------- личный прогресс ---------- */
  case 'progress_get': {
    $db = db_read();
    $me = need_user(user_by_token($db, $token));
    $mail = low((string)($_GET['email'] ?? $me['email']));
    if ($mail !== low((string)$me['email']) && role_of($me) !== 'admin') fail('Чужой прогресс недоступен', 403);
    ok(['progress' => $db['progress'][$mail] ?? null]);
  }
  case 'progress_save': {
    if (!$isPost) fail('Ожидается POST');
    $db = db_read();
    $me = need_user(user_by_token($db, $token));
    $mail = low((string)$me['email']);          // всегда свой, что бы ни прислали
    $p = $body['progress'] ?? [];
    if (strlen(json_encode($p) ?: '') > MAX_BRANCH) fail('Слишком много данных прогресса', 413);
    $db['progress'][$mail] = $p;
    $db['updated'] = time();
    db_write($db);
    ok([]);
  }

  /* ---------- общий контент ---------- */

  case 'patch': {
    if (!$isPost) fail('Ожидается POST');
    $db = db_read();
    $me = need_user(user_by_token($db, $token));
    $role = role_of($me);

    $parts = $body['parts'] ?? null;
    if ($parts === null && isset($body['branch'])) $parts = [$body['branch'] => $body['value']];
    if (!is_array($parts) || !$parts) fail('Нет данных для сохранения');

    $saved = [];
    foreach ($parts as $bRaw => $v) {
      $b = preg_replace('/[^a-zA-Z0-9_]/', '', (string)$bRaw);
      if ($b === '') continue;

      if (strlen(json_encode($v) ?: '') > MAX_BRANCH) {
        fail('Раздел «' . $b . '» больше ' . round(MAX_BRANCH / 1048576) . ' МБ — не сохраняю', 413);
      }

      if (in_array($b, CARD_BRANCHES, true) && $role !== 'admin') {
        /* эксперт участницам не хозяин: его страница живёт в разделе experts */
        $db['shared'][$b] = merge_cards($db['shared'][$b] ?? null, $v, low((string)$me['email']));
      } elseif ($role === 'admin') {                  // администратор: полная замена
        $db['shared'][$b] = $v;
      } elseif ($role === 'expert') {                 // эксперт: только своё
        if (in_array($b, ADMIN_BRANCHES, true))
          fail('Раздел «' . $b . '» меняет только администратор', 403);
        $db['shared'][$b] = merge_expert($b, $db['shared'][$b] ?? null, $v,
                                         low((string)$me['email']), $db['shared'] ?? []);
      } elseif (in_array($b, OPEN_BRANCHES, true)) {   // пользовательница: дописываем, не стираем
        $db['shared'][$b] = merge_open($db['shared'][$b] ?? null, $v);
      } elseif (in_array($b, CARD_BRANCHES, true)) {   // только своя карточка
        $db['shared'][$b] = merge_cards($db['shared'][$b] ?? null, $v, low((string)$me['email']));
      } elseif (in_array($b, SELF_BRANCHES, true)) {   // только своя строка
        $db['shared'][$b] = merge_self($db['shared'][$b] ?? null, $v, low((string)$me['email']));
      } else {
        fail('Раздел «' . $b . '» меняют только эксперты и администраторы', 403);
      }
      $saved[] = $b;
    }
    if (!$saved) fail('Нет данных для сохранения');

    $db['rev']     = $db['rev'] + 1;
    $db['updated'] = time();
    db_write($db);
    ok(['rev' => $db['rev'], 'saved' => $saved]);
  }

  /* полная замена — для первичной заливки и восстановления */
  case 'save': {
    $db = db_read();
    need_admin(user_by_token($db, $token));
    if (!isset($body['shared']) || !is_array($body['shared'])) fail('Пустые данные');
    $db['shared']  = $body['shared'] + $db['shared'];
    $db['rev']     = $db['rev'] + 1;
    $db['updated'] = time();
    db_write($db);
    ok(['rev' => $db['rev']]);
  }

  /* ---------- файлы ---------- */
  case 'upload': {
    $db = db_read();
    need_user(user_by_token($db, $token));
    $problems = ensure_dirs();
    if ($problems) fail(implode('; ', $problems), 500);

    $bin = null; $ext = null;
    $allowed = ['jpg','jpeg','png','webp','gif','mp4','webm','mov','pdf'];

    if (!empty($_FILES)) {
      $f = reset($_FILES);
      if (is_array($f['error'])) {
        $f = ['tmp_name' => $f['tmp_name'][0], 'name' => $f['name'][0], 'error' => $f['error'][0]];
      }
      if ((int)$f['error'] !== UPLOAD_ERR_OK) {
        $msgs = [
          UPLOAD_ERR_INI_SIZE   => 'файл больше upload_max_filesize (' . ini_get('upload_max_filesize') . ')',
          UPLOAD_ERR_FORM_SIZE  => 'файл больше допустимого',
          UPLOAD_ERR_PARTIAL    => 'файл передан не полностью',
          UPLOAD_ERR_NO_FILE    => 'файл не выбран',
          UPLOAD_ERR_NO_TMP_DIR => 'на сервере нет временной папки',
          UPLOAD_ERR_CANT_WRITE => 'сервер не смог записать файл'
        ];
        fail('Загрузка не удалась: ' . ($msgs[(int)$f['error']] ?? 'код ' . $f['error']), 400);
      }
      $ext = strtolower((string)pathinfo((string)$f['name'], PATHINFO_EXTENSION));
      $bin = @file_get_contents($f['tmp_name']);
    } else {
      $data = (string)($body['data'] ?? '');
      if ($data === '') fail('Файл не передан');
      if (!preg_match('#^data:([\w/\-\.\+]+);base64,#', $data, $m)) fail('Ожидается файл в формате base64');
      $mime = strtolower($m[1]);
      $map  = ['image/jpeg'=>'jpg','image/jpg'=>'jpg','image/png'=>'png','image/webp'=>'webp',
               'image/gif'=>'gif','video/mp4'=>'mp4','video/webm'=>'webm','application/pdf'=>'pdf'];
      $ext  = $map[$mime] ?? null;
      if (!$ext) fail('Формат не поддерживается: ' . $mime);
      $bin  = base64_decode(substr($data, strpos($data, ',') + 1), true);
      if ($bin === false) fail('Не удалось раскодировать файл');
    }

    if ($bin === null || $bin === false || $bin === '') fail('Пустой файл');
    if (!in_array($ext, $allowed, true)) fail('Формат не поддерживается: .' . $ext);
    if (strlen($bin) > MAX_UPLOAD) fail('Файл больше ' . round(MAX_UPLOAD / 1048576) . ' МБ', 413);

    $id = preg_replace('/[^a-zA-Z0-9_\-]/', '', (string)($body['id'] ?? $_POST['id'] ?? ('f' . time())));
    if ($id === '') $id = 'f' . time();
    $name = $id . '_' . substr(md5($bin . microtime()), 0, 8) . '.' . $ext;
    if (@file_put_contents(UPLOAD_DIR . '/' . $name, $bin) === false) {
      fail('Не удалось сохранить файл. Поставьте папке uploads права 755', 500);
    }
    @chmod(UPLOAD_DIR . '/' . $name, 0644);
    ok(['url' => UPLOAD_URL . '/' . $name, 'size' => strlen($bin), 'ext' => $ext]);
  }

  /* ---------- резервная копия ---------- */
  case 'export': {
    $db = db_read();
    need_admin(user_by_token($db, $token));
    unset($db['sessions'], $db['tries']);     // токены в копию не кладём, переписка входит
    ok(['db' => $db]);
  }
  case 'import': {
    $db = db_read();
    need_admin(user_by_token($db, $token));
    if (!isset($body['db']) || !is_array($body['db'])) fail('Нет данных');
    $new = $body['db'];
    $new['sessions'] = $db['sessions'];       // чтобы не выкинуть себя из аккаунта
    $new['tries']    = [];
    db_write($new);
    ok([]);
  }

  default: fail('Неизвестное действие: ' . $action, 404);
}

/* =====================================================================
   Слияние данных для открытых разделов
   ===================================================================== */

/* Массив записей: старые остаются, новые добавляются, совпавшие по id
   обновляются. Стереть раздел целиком пользовательница не может. */
function merge_open($old, $new) {
  if (!is_array($new)) return $old;
  if (!is_array($old) || !$old) return is_array($new) ? array_slice(array_values($new), 0, MAX_ITEMS) : $new;

  $isList = array_keys($old) === range(0, count($old) - 1);
  if (!$isList) {                                   // это карта, например ссылки на файлы
    foreach ($new as $k => $v) $old[$k] = $v;       // ключи только добавляем и обновляем
    return $old;
  }

  $out = [];
  foreach ($old as $item) {
    $key = is_array($item) && isset($item['id']) ? 'id:' . $item['id'] : 'j:' . md5(json_encode($item) ?: '');
    $out[$key] = $item;
  }
  foreach ($new as $item) {
    $key = is_array($item) && isset($item['id']) ? 'id:' . $item['id'] : 'j:' . md5(json_encode($item) ?: '');
    $out[$key] = $item;
  }
  return array_slice(array_values($out), 0, MAX_ITEMS);
}

/* =====================================================================
   Слияние данных для эксперта
   Раньше эксперт считался редактором наравне с администратором и заменял
   раздел целиком — значит, мог переписать и стереть курсы, материалы и
   мероприятия коллеги. Теперь он распоряжается только своими записями.

   Правило простое и предсказуемое:
   · запись без хозяина (демо-контент, заведённое администратором) —
     доступна любому эксперту, как и раньше;
   · запись с хозяином — только ему; чужая правка молча отбрасывается,
     на сервере остаётся прежняя версия;
   · новая запись получает хозяина здесь, на сервере, а не со слов клиента:
     подделать поле «хозяин» нельзя;
   · пропала из присланного списка — удаляем, только если она его.
   ===================================================================== */
/* =====================================================================
   НАПОМИНАНИЯ НА ТЕЛЕФОН (Web Push)
   Женщина ставит приложение на экран телефона и разрешает уведомления —
   дальше письма Евы доходят до неё, даже когда приложение закрыто.
   Работает по стандарту Web Push: Chrome и Android через свой сервис,
   iPhone начиная с 16.4 — но только у приложения, добавленного на экран
   «Домой», не у вкладки в Safari.

   Обещание при подписке — не чаще двух раз в неделю и только от Евы:
   итоги в понедельник и напоминание в субботу. Ничего рекламного здесь
   не отправляется намеренно: один такой пуш отменяет согласие на все
   остальные.
   ===================================================================== */
function b64u(string $bin): string {
  return rtrim(strtr(base64_encode($bin), '+/', '-_'), '=');
}
function b64u_dec(string $s): string {
  $s = strtr($s, '-_', '+/');
  $pad = strlen($s) % 4;
  if ($pad) $s .= str_repeat('=', 4 - $pad);
  return base64_decode($s) ?: '';
}

function push_read(): array {
  $j = file_exists(PUSH_FILE) ? json_decode(@file_get_contents(PUSH_FILE) ?: '', true) : null;
  if (!is_array($j)) $j = [];
  return $j + ['keys' => null, 'subs' => [], 'sent' => [], 'tick' => 0];
}
function push_write(array $p): void {
  @file_put_contents(PUSH_FILE, json_encode($p, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX);
  @chmod(PUSH_FILE, 0600);
}

/* Пара ключей VAPID — подпись, по которой Google и Apple понимают, что
   это мы. Заводится сама при первом обращении и лежит только на сервере. */
function push_keys(): array {
  $p = push_read();
  if (is_array($p['keys']) && !empty($p['keys']['priv'])) return $p['keys'];

  $res = openssl_pkey_new(['curve_name' => 'prime256v1', 'private_key_type' => OPENSSL_KEYTYPE_EC]);
  if (!$res) fail('Не получилось завести ключи для уведомлений', 500);
  $d = openssl_pkey_get_details($res);
  $pub = "\x04" . str_pad($d['ec']['x'], 32, "\0", STR_PAD_LEFT)
                . str_pad($d['ec']['y'], 32, "\0", STR_PAD_LEFT);
  $p['keys'] = ['pub' => b64u($pub), 'priv' => b64u(str_pad($d['ec']['d'], 32, "\0", STR_PAD_LEFT))];
  push_write($p);
  return $p['keys'];
}

/* приватный ключ из «сырых» 32 байт — в вид, понятный openssl */
function push_priv_key(string $rawPriv, string $rawPub) {
  $seq = "\x30\x77\x02\x01\x01\x04\x20" . $rawPriv
       . "\xa0\x0a\x06\x08\x2a\x86\x48\xce\x3d\x03\x01\x07"
       . "\xa1\x44\x03\x42\x00" . $rawPub;
  $pem = "-----BEGIN EC PRIVATE KEY-----\n" .
         chunk_split(base64_encode($seq), 64, "\n") .
         "-----END EC PRIVATE KEY-----\n";
  return openssl_pkey_get_private($pem);
}

/* подпись ES256: openssl отдаёт DER, а JWT ждёт две половинки по 32 байта */
function der_to_raw(string $der): string {
  $o = 3; if (ord($der[1]) > 0x80) $o++;
  $lr = ord($der[$o]); $o++;
  $r = ltrim(substr($der, $o, $lr), "\0"); $o += $lr + 1;
  $ls = ord($der[$o]); $o++;
  $s = ltrim(substr($der, $o, $ls), "\0");
  return str_pad($r, 32, "\0", STR_PAD_LEFT) . str_pad($s, 32, "\0", STR_PAD_LEFT);
}

function push_jwt(string $origin, array $keys): string {
  $head = b64u(json_encode(['typ' => 'JWT', 'alg' => 'ES256']));
  $body = b64u(json_encode([
    'aud' => $origin,
    'exp' => time() + 12 * 3600,
    'sub' => 'mailto:' . PUSH_CONTACT
  ]));
  $pk = push_priv_key(b64u_dec($keys['priv']), b64u_dec($keys['pub']));
  $sig = '';
  openssl_sign($head . '.' . $body, $sig, $pk, OPENSSL_ALGO_SHA256);
  return $head . '.' . $body . '.' . b64u(der_to_raw($sig));
}

/* Шифрование тела по RFC 8291: без него сервис доставки увидел бы текст. */
function push_encrypt(string $payload, string $p256dh, string $auth): array {
  $clientPub = b64u_dec($p256dh);
  $authSecret = b64u_dec($auth);

  $me = openssl_pkey_new(['curve_name' => 'prime256v1', 'private_key_type' => OPENSSL_KEYTYPE_EC]);
  $d = openssl_pkey_get_details($me);
  $myPub = "\x04" . str_pad($d['ec']['x'], 32, "\0", STR_PAD_LEFT)
                  . str_pad($d['ec']['y'], 32, "\0", STR_PAD_LEFT);

  $peerPem = ec_pub_pem($clientPub);
  $peer = openssl_pkey_get_public($peerPem);
  if (!$peer) return ['', ''];
  $shared = openssl_pkey_derive($peer, $me, 32);
  if (!$shared) return ['', ''];

  $salt = random_bytes(16);
  $info = "WebPush: info\0" . $clientPub . $myPub;
  $ikm  = hash_hkdf('sha256', $shared, 32, $info, $authSecret);
  $cek  = hash_hkdf('sha256', $ikm, 16, "Content-Encoding: aes128gcm\0", $salt);
  $nonce = hash_hkdf('sha256', $ikm, 12, "Content-Encoding: nonce\0", $salt);

  $tag = '';
  $ct = openssl_encrypt($payload . "\x02", 'aes-128-gcm', $cek, OPENSSL_RAW_DATA, $nonce, $tag);
  $head = $salt . pack('N', 4096) . chr(strlen($myPub)) . $myPub;
  return [$head . $ct . $tag, ''];
}

/* публичный ключ из 65 «сырых» байт — в PEM */
function ec_pub_pem(string $raw): string {
  $der = "\x30\x59\x30\x13\x06\x07\x2a\x86\x48\xce\x3d\x02\x01"
       . "\x06\x08\x2a\x86\x48\xce\x3d\x03\x01\x07\x03\x42\x00" . $raw;
  return "-----BEGIN PUBLIC KEY-----\n" .
         chunk_split(base64_encode($der), 64, "\n") .
         "-----END PUBLIC KEY-----\n";
}

/* Одно уведомление одной подписке. Возвращает код ответа сервиса:
   404 и 410 значат, что подписки больше нет — её надо забыть. */
function push_one(array $sub, array $msg, array $keys): int {
  $ep = (string)($sub['endpoint'] ?? '');
  if ($ep === '' || !function_exists('curl_init')) return 0;
  $u = parse_url($ep);
  if (!$u || empty($u['host'])) return 0;
  $origin = $u['scheme'] . '://' . $u['host'];

  [$body] = push_encrypt(json_encode($msg, JSON_UNESCAPED_UNICODE),
                         (string)($sub['p256dh'] ?? ''), (string)($sub['auth'] ?? ''));
  if ($body === '') return 0;

  $ch = curl_init($ep);
  curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 10,
    CURLOPT_POSTFIELDS => $body,
    CURLOPT_HTTPHEADER => [
      'TTL: ' . PUSH_TTL,
      'Content-Type: application/octet-stream',
      'Content-Encoding: aes128gcm',
      'Urgency: normal',
      'Authorization: vapid t=' . push_jwt($origin, $keys) . ', k=' . $keys['pub']
    ]
  ]);
  curl_exec($ch);
  $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
  curl_close($ch);
  return $code;
}

/* Все устройства одной женщины. Отвалившиеся подписки убираем. */
function push_to(string $mail, array $msg): int {
  $p = push_read();
  $keys = push_keys();
  $list = $p['subs'][$mail] ?? [];
  if (!is_array($list) || !$list) return 0;
  $left = []; $sent = 0;
  foreach ($list as $sub) {
    $code = push_one($sub, $msg, $keys);
    if ($code === 404 || $code === 410) continue;      // устройство отписалось
    $left[] = $sub;
    if ($code >= 200 && $code < 300) $sent++;
  }
  $p = push_read();                                     // перечитываем: могли добавиться
  $p['subs'][$mail] = $left;
  if (!$left) unset($p['subs'][$mail]);
  push_write($p);
  return $sent;
}

/* ---------- расписание ----------
   Настоящего планировщика на дешёвом хостинге может не быть, поэтому
   расписание подтягивается любым обращением к серверу, но не чаще раза
   в десять минут. Если на хостинге есть cron — можно дёргать
   api.php?action=push_tick, и тогда время будет точнее. */
function push_due(array $prog, int $wday, int $hour): ?array {
  $week = (int)date('W');
  if ($wday === 1 && $hour >= 9)  return ['k' => 'week',  'w' => $week];
  if ($wday === 6 && $hour >= 11) return ['k' => 'nudge', 'w' => $week];
  return null;
}

/* сколько дел в её программе ещё не отмечено */
function push_left(array $prog): array {
  $all = 0; $left = 0;
  foreach (($prog['program'] ?? []) as $day) {
    foreach (($day['tasks'] ?? []) as $t) { $all++; if (empty($t['done'])) $left++; }
  }
  return [$all, $left];
}

function push_tick(bool $force = false): int {
  $p = push_read();
  if (!$force && time() - (int)$p['tick'] < PUSH_TICK) return 0;
  $p['tick'] = time();
  push_write($p);
  if (!$p['subs']) return 0;

  $wday = (int)date('N');            // 1 — понедельник, 6 — суббота
  $hour = (int)date('G');
  $due = push_due([], $wday, $hour);
  if (!$due) return 0;

  $db = db_read();
  $sent = 0;
  foreach (array_keys($p['subs']) as $mail) {
    $mark = $p['sent'][$mail][$due['k']] ?? null;
    if ($mark === $due['w']) continue;                  // за эту неделю уже писали

    $prog = $db['progress'][$mail] ?? [];
    [$all, $left] = push_left(is_array($prog) ? $prog : []);
    $name = trim((string)($prog['name'] ?? ''));

    if ($due['k'] === 'week') {
      $msg = ['t' => 'Ева подвела итоги недели',
              'b' => ($name !== '' ? $name . ', п' : 'П') . 'осмотри, что получилось за неделю — и что собрано на новую.',
              'u' => '/'];
    } else {
      if (!$all || $left < $all * 0.5) { $p['sent'][$mail]['nudge'] = $due['w']; continue; }
      $msg = ['t' => 'Выходные — хорошее время',
              'b' => 'Непройденного осталось ' . $left . '. Догонять всё не нужно: выбери одно, что откликается.',
              'u' => '/'];
    }
    if (push_to($mail, $msg)) $sent++;
    $p = push_read();
    $p['sent'][$mail][$due['k']] = $due['w'];
    push_write($p);
  }
  return $sent;
}

/* Знакомы ли двое: обе публичные карточки называют друг друга.
   Односторонней записи мало — иначе «знакомство» назначалось бы в одну
   сторону, и писать можно было бы кому угодно. */
function mates_both(array $db, string $a, string $b): bool {
  if ($a === '' || $b === '' || $a === $b) return false;
  $list = $db['shared']['people'] ?? [];
  if (!is_array($list)) return false;
  $card = function (string $mail) use ($list) {
    foreach ($list as $c) {
      if (is_array($c) && low((string)($c['id'] ?? '')) === $mail) return $c;
    }
    return null;
  };
  $ca = $card($a); $cb = $card($b);
  if (!$ca || !$cb) return false;
  $has = function ($card, string $mail): bool {
    $m = $card['mates'] ?? [];
    if (!is_array($m)) return false;
    foreach ($m as $x) { if (low((string)$x) === $mail) return true; }
    return false;
  };
  return $has($ca, $b) && $has($cb, $a);
}

/* не больше двадцати личных сообщений в час от одной женщины */
function dm_flood(array $db, string $mail): bool {
  $edge = time() - 3600;
  $n = 0;
  foreach (($db['dm'] ?? []) as $box) {
    if (!is_array($box)) continue;
    foreach ($box as $m) {
      if (!is_array($m)) continue;
      if (low((string)($m['by'] ?? '')) !== $mail) continue;
      if ((int)(($m['at'] ?? 0) / 1000) > $edge) $n++;
    }
  }
  return $n >= 20;
}

/* список это или карта: список — ключи 0,1,2… подряд */
function is_list_arr($a): bool {
  if (!is_array($a)) return false;
  $i = 0;
  foreach ($a as $k => $_) { if ($k !== $i++) return false; }
  return true;
}

function merge_expert(string $branch, $old, $new, string $mail, array $shared) {
  if (!is_array($new)) return $old;
  $isList = is_array($old) && $old ? is_list_arr($old) : is_list_arr($new);

  if ($isList) return merge_owned(is_array($old) ? $old : [], $new, $mail);

  /* карта: ключи только добавляем и обновляем, стереть раздел целиком нельзя */
  $out = is_array($old) ? $old : [];
  $courses = in_array($branch, COURSE_MAPS, true) ? ($shared['courses'] ?? null) : null;
  foreach ($new as $k => $v) {
    if ($courses !== null && !own_course($courses, (string)$k, $mail)) continue;
    $out[$k] = $v;
  }
  return $out;
}

/* курс чужой, если у него есть хозяин и это не он */
function own_course($courses, string $key, string $mail): bool {
  if (!is_array($courses)) return true;
  /* ключ карты — это номер курса или номер курса с хвостом: k1, k1_2 */
  $cid = explode('_', $key)[0];
  foreach ($courses as $c) {
    if (!is_array($c) || (string)($c['id'] ?? '') !== $cid) continue;
    $owner = low((string)($c['owner'] ?? ''));
    return $owner === '' || $owner === $mail;
  }
  return true;
}

function merge_owned(array $old, array $new, string $mail): array {
  $byId = [];
  foreach ($old as $item) {
    if (is_array($item) && isset($item['id'])) $byId['id:' . $item['id']] = $item;
  }
  $out = []; $seen = [];
  foreach ($new as $item) {
    if (!is_array($item) || !isset($item['id'])) { $out[] = $item; continue; }
    $key = 'id:' . $item['id'];
    $seen[$key] = true;
    $was = $byId[$key] ?? null;
    if ($was === null) {                       // новая запись — хозяин ставится здесь
      $item['owner'] = $mail;
      $out[] = $item;
      continue;
    }
    $owner = low((string)($was['owner'] ?? ''));
    if ($owner !== '' && $owner !== $mail) {   // чужая — оставляем как было
      $out[] = $was;
      continue;
    }
    /* хозяина не переписываем словами клиента: он либо был, либо его нет */
    if ($owner === '') unset($item['owner']); else $item['owner'] = $owner;
    $out[] = $item;
  }
  /* чего не прислали: удаляем только своё, всё остальное остаётся.
     Демонстрационный контент и заведённое администратором эксперт убрать
     не может — это делает администратор. */
  foreach ($byId as $key => $was) {
    if (isset($seen[$key])) continue;
    if (low((string)($was['owner'] ?? '')) !== $mail) $out[] = $was;
  }
  return array_slice($out, 0, MAX_ITEMS);
}

/* Карта «почта → значение»: чужие строки не трогаем */
/* Карточки участниц: список, где номер записи — почта хозяйки.
   Из присланного берём ровно одну запись — её собственную. Всё остальное
   остаётся как было, даже если клиент прислал полный список: так чужую
   карточку нельзя ни переписать, ни удалить, ни дополнить. */
function merge_cards($old, $new, string $mail): array {
  $out = [];
  foreach (is_array($old) ? $old : [] as $item) {
    if (is_array($item) && isset($item['id'])) $out[low((string)$item['id'])] = $item;
  }
  if ($mail !== '' && is_array($new)) {
    foreach ($new as $item) {
      if (!is_array($item) || low((string)($item['id'] ?? '')) !== $mail) continue;
      $item['id'] = $mail;                       // номер записи ставим сами
      $out[$mail] = $item;
      break;
    }
  }
  return array_slice(array_values($out), 0, MAX_ITEMS);
}

function merge_self($old, $new, string $mail) {
  $old = is_array($old) ? $old : [];
  if (!is_array($new)) return $old;
  if (array_key_exists($mail, $new)) $old[$mail] = $new[$mail];
  return $old;
}
