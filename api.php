<?php
/* =====================================================================
   Eva Space — API v2
   Хранение: JSON-файл + файлы в /uploads. PHP 7.4+.

   Что изменилось против первой версии:
   · загрузка файлов и через base64 (JSON), и через multipart/form-data
   · сохранение по веткам, а не всё состояние целиком — не упирается в post_max_size
   · любая ошибка возвращается клиенту явным текстом, а не молчанием
   · есть api.php?action=diag — самопроверка окружения
   ===================================================================== */

declare(strict_types=1);
@ini_set('display_errors', '0');
error_reporting(E_ALL);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Cache-Control: no-store');
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') { http_response_code(204); exit; }

const DATA_DIR   = __DIR__ . '/data';
const DB_FILE    = DATA_DIR . '/db.json';
const BAK_FILE   = DATA_DIR . '/db.backup.json';
const UPLOAD_DIR = __DIR__ . '/uploads';
const UPLOAD_URL = 'uploads';
const MAX_UPLOAD = 12 * 1024 * 1024;
const ADMIN_KEY  = 'eva-change-me';       // смените и впишите то же самое в index.html

/* ---------- служебное ---------- */
function low(string $s): string {
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
  $j += ['rev' => 0, 'updated' => 0, 'shared' => [], 'users' => [], 'progress' => []];
  return $j;
}
function db_write(array $db): void {
  $problems = ensure_dirs();
  if ($problems) fail(implode('; ', $problems), 500);
  if (file_exists(DB_FILE) && filesize(DB_FILE) > 2) @copy(DB_FILE, BAK_FILE);
  $json = json_encode($db, JSON_UNESCAPED_UNICODE);
  if ($json === false) fail('Не удалось упаковать данные: ' . json_last_error_msg(), 500);
  $tmp = DB_FILE . '.tmp';
  if (@file_put_contents($tmp, $json, LOCK_EX) === false) {
    fail('Нет прав на запись в папку data. Поставьте ей права 755 в файловом менеджере', 500);
  }
  if (!@rename($tmp, DB_FILE)) { @unlink($tmp); fail('Не удалось обновить файл базы', 500); }
  @chmod(DB_FILE, 0644);
}

/* ---------- разбор запроса ---------- */
$action = $_GET['action'] ?? 'state';
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
$key   = (string)($body['key'] ?? $_GET['key'] ?? '');
$isAdm = hash_equals(ADMIN_KEY, $key);

/* ---------- действия ---------- */
switch ($action) {

  /* самопроверка окружения — открыть в браузере при первой настройке */
  case 'diag': {
    $problems = ensure_dirs();
    $canWrite = false;
    if (is_dir(DATA_DIR)) {
      $t = DATA_DIR . '/.write-test';
      $canWrite = @file_put_contents($t, 'ok') !== false;
      if ($canWrite) @unlink($t); else $problems[] = 'запись в папку data не работает';
    }
    $db = db_read();
    ok([
      'php'           => PHP_VERSION,
      'mbstring'      => extension_loaded('mbstring'),
      'post_max'      => ini_get('post_max_size'),
      'upload_max'    => ini_get('upload_max_filesize'),
      'data_ok'       => $canWrite,
      'uploads_ok'    => is_dir(UPLOAD_DIR) && is_writable(UPLOAD_DIR),
      'uploads_count' => is_dir(UPLOAD_DIR) ? max(0, count((array)scandir(UPLOAD_DIR)) - 2) : 0,
      'db_size'       => file_exists(DB_FILE) ? filesize(DB_FILE) : 0,
      'rev'           => $db['rev'],
      'updated'       => $db['updated'],
      'branches'      => array_keys($db['shared']),
      'users'         => count($db['users']),
      'key_ok'        => $isAdm,
      'key_default'   => ADMIN_KEY === 'eva-change-me',
      'problems'      => $problems
    ]);
  }

  case 'ping': ok(['time' => time(), 'php' => PHP_VERSION]);

  case 'state': {
    $db = db_read();
    ok(['rev' => $db['rev'], 'updated' => $db['updated'], 'shared' => $db['shared'] ?: new stdClass()]);
  }

  /* сохранение по веткам. Открытые ветки пишет любой, остальные — только с ключом */
  case 'patch': {
    if (!$isPost) fail('Ожидается POST');
    $open  = ['orders', 'questions', 'support', 'wall', 'ideas'];
    $parts = $body['parts'] ?? null;
    if ($parts === null && isset($body['branch'])) $parts = [$body['branch'] => $body['value']];
    if (!is_array($parts) || !$parts) fail('Нет данных для сохранения');

    foreach (array_keys($parts) as $b) {
      if (!in_array($b, $open, true) && !$isAdm) {
        fail('Ключ синхронизации не совпадает. Проверьте SYNC_KEY в index.html и ADMIN_KEY в api.php', 403);
      }
    }
    $db = db_read();
    $saved = [];
    foreach ($parts as $b => $v) {
      $b = preg_replace('/[^a-zA-Z0-9_]/', '', (string)$b);
      if ($b === '') continue;
      $db['shared'][$b] = $v;
      $saved[] = $b;
    }
    $db['rev']     = $db['rev'] + 1;
    $db['updated'] = time();
    db_write($db);
    ok(['rev' => $db['rev'], 'saved' => $saved]);
  }

  /* полная замена — для первичной заливки и восстановления */
  case 'save': {
    if (!$isAdm) fail('Ключ синхронизации не совпадает. Проверьте SYNC_KEY в index.html и ADMIN_KEY в api.php', 403);
    if (!isset($body['shared']) || !is_array($body['shared'])) fail('Пустые данные');
    $db = db_read();
    $db['shared']  = $body['shared'] + $db['shared'];
    $db['rev']     = $db['rev'] + 1;
    $db['updated'] = time();
    db_write($db);
    ok(['rev' => $db['rev']]);
  }

  /* загрузка файла: base64 в JSON либо обычная форма multipart */
  case 'upload': {
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

  case 'users': {
    $db = db_read();
    ok(['users' => $db['users'] ?: new stdClass()]);
  }
  case 'user_save': {
    $u = $body['user'] ?? null;
    if (!is_array($u) || empty($u['email'])) fail('Нет данных пользователя');
    $db = db_read();
    $db['users'][low((string)$u['email'])] = $u;
    $db['rev'] = $db['rev'] + 1;
    $db['updated'] = time();
    db_write($db);
    ok(['rev' => $db['rev']]);
  }

  case 'progress_get': {
    $mail = low((string)($_GET['email'] ?? ''));
    if ($mail === '') fail('Не указана почта');
    $db = db_read();
    ok(['progress' => $db['progress'][$mail] ?? null]);
  }
  case 'progress_save': {
    $mail = low((string)($body['email'] ?? ''));
    if ($mail === '') fail('Не указана почта');
    $db = db_read();
    $db['progress'][$mail] = $body['progress'] ?? [];
    $db['updated'] = time();
    db_write($db);
    ok([]);
  }

  /* резервная копия и восстановление */
  case 'export': {
    if (!$isAdm) fail('Нужен ключ администратора', 403);
    ok(['db' => db_read()]);
  }
  case 'import': {
    if (!$isAdm) fail('Нужен ключ администратора', 403);
    if (!isset($body['db']) || !is_array($body['db'])) fail('Нет данных');
    db_write($body['db']);
    ok([]);
  }

  default: fail('Неизвестное действие: ' . $action, 404);
}
