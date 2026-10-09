#!/usr/bin/env bash
# Сервер сам забирает правки с GitHub. Раз в 2 минуты (eva-autodeploy.timer) смотрит ветку:
# появилась новая правка — проверяет её в одноразовом контейнере (check.sh) и, только если
# проверки прошли, ставит и перезапускает штаб. Не прошли или новая версия не запустилась —
# остаётся прежняя. Итог виден по адресу /version.json.
#
# Этот файл и check.sh живут на сервере в /opt/eva/autodeploy и из ветки сами НЕ обновляются:
# из репозитория на сервер попадает только то, что работает внутри контейнера штаба.
# Обновить их — с Mac: bash club/v2/server/deploy/autodeploy-install.sh.
#
#   autodeploy.sh          — обычный запуск (по таймеру)
#   autodeploy.sh check    — только проверить ветку EVA_BRANCH, ничего не ставить
set -euo pipefail
REPO="${EVA_REPO:-https://github.com/emorozoff/evaspace.git}"
BRANCH="${EVA_BRANCH:-claude/financial-model-reporting-0tg9bl}"
MODE="${1:-run}"
BASE=/opt/eva
AD=$BASE/autodeploy
ST=$AD/state
STAGE=$AD/stage
SOCK=/var/lib/docker/volumes/tytproai_caddy-data/_data/eva/web.sock
FILES="club/v2/index.html club/v2/eva-club-v2.html club/v2/server/server.js crm/v2/index.html crm/v2/eva-crm-v2.html crm/v2/anketa.html crm/v2/a/index.html"
DIRS="club/v2/server/lib club/v2/server/public"
mkdir -p "$ST"
exec 9>"$ST/lock"
flock -n 9 || exit 0

new="$(timeout 30 git ls-remote "$REPO" "refs/heads/$BRANCH" 2>/dev/null | cut -f1 || true)"
[ -n "$new" ] || { echo "GitHub не ответил или ветки $BRANCH нет"; exit 0; }
if [ "$MODE" = run ]; then
  [ "$new" = "$(cat "$ST/deployed" 2>/dev/null || true)" ] && exit 0
  [ "$new" = "$(cat "$ST/failed" 2>/dev/null || true)" ] && exit 0
fi
short="${new:0:7}"
echo "новая правка $short в ветке $BRANCH — проверяю"

# что показать по адресу /version.json
status() {  # status ok|fail <текст причины>
  python3 - "$1" "$new" "${2:-}" "$ST" "$BASE/app/version.json" <<'PY'
import json, sys, os, datetime
kind, commit, why, st, out = sys.argv[1:6]
now = datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds')
try: cur = json.load(open(out, encoding='utf-8'))
except Exception: cur = {}
if kind == 'ok':
    cur = {'commit': commit, 'deployedAt': now, 'ok': True}
else:
    log = ''
    try: log = open(os.path.join(st, 'last.log'), encoding='utf-8', errors='replace').read()[-2500:]
    except Exception: pass
    cur['ok'] = False
    cur['notDeployed'] = {'commit': commit, 'at': now, 'why': why, 'log': log}
tmp = out + '.tmp'
json.dump(cur, open(tmp, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
os.chmod(tmp, 0o644)
os.replace(tmp, out)
PY
}
refuse() { echo "✗ $1"; if [ "$MODE" = run ]; then echo "$new" > "$ST/failed"; status fail "$1"; fi; exit 1; }

rm -rf "$STAGE"
install -d -o eva -g eva -m 700 "$STAGE"
code=0
timeout 900 docker run --rm --name eva-check --user "$(id -u eva):$(id -g eva)" \
  --memory 400m --cpus 0.8 --pids-limit 300 --read-only --tmpfs /tmp:exec,size=64m \
  --cap-drop ALL --security-opt no-new-privileges \
  -e HOME=/tmp -e REPO="$REPO" -e BRANCH="$BRANCH" -e COMMIT="$new" \
  -v "$STAGE:/work" -v "$AD/check.sh:/check.sh:ro" eva-build sh /check.sh > "$ST/last.log" 2>&1 || code=$?
tail -4 "$ST/last.log" | sed 's/^/  /'
[ "$code" = 75 ] && { echo "ветка изменилась во время проверки — повторю на следующем круге"; exit 0; }
[ "$code" = 0 ] || refuse "проверки не прошли — штаб остаётся на прежней версии"
SRC=$STAGE/src
# из проверенной копии берём только известные файлы и только обычные (не ссылки)
for f in $FILES; do { [ -f "$SRC/$f" ] && [ ! -L "$SRC/$f" ]; } || refuse "в правке нет файла $f"; done
for d in $DIRS; do { [ -d "$SRC/$d" ] && [ ! -L "$SRC/$d" ]; } || refuse "в правке нет папки $d"; done
if [ "$MODE" = check ]; then echo "✓ проверки прошли (режим «только проверить» — ничего не ставлю)"; rm -rf "$STAGE"; exit 0; fi

# запас на откат: прежний код и снимок данных
rm -rf "$BASE/app.prev"
cp -a "$BASE/app" "$BASE/app.prev"
install -d -o eva -g eva -m 700 "$BASE/data/backups"
for f in eva-hq eva-crm; do
  [ -f "$BASE/data/$f.json" ] && cp -p "$BASE/data/$f.json" "$BASE/data/backups/predeploy-$f-$(date +%Y%m%d-%H%M%S)-$short.json"
  { ls -1t "$BASE/data/backups"/predeploy-$f-*.json 2>/dev/null || true; } | tail -n +11 | xargs -r rm -f
done

up() {
  ( cd "$BASE" && docker compose up -d --force-recreate >/dev/null 2>&1 )
  for i in $(seq 1 15); do
    [ -S "$SOCK" ] && [ "$(curl -s -m 3 --unix-socket "$SOCK" http://eva/healthz || true)" = ok ] && return 0
    sleep 1
  done
  return 1
}
( cd "$SRC" && rsync -rtR --no-links --delete --chmod=D755,F644 $FILES $DIRS "$BASE/app/" )
chown -R root:root "$BASE/app"
if up; then
  echo "$new" > "$ST/deployed"
  rm -f "$ST/failed"
  status ok
  echo "✓ установлена правка $short"
else
  echo "новая версия не запустилась — возвращаю прежнюю"
  ( cd "$BASE" && docker compose logs --tail 30 hq ) >> "$ST/last.log" 2>&1 || true
  rm -rf "$BASE/app.bad"; mv "$BASE/app" "$BASE/app.bad"; mv "$BASE/app.prev" "$BASE/app"
  up || echo "‼ и прежняя версия не отвечает — нужен человек"
  rm -rf "$BASE/app.bad"
  refuse "новая версия не запустилась — вернул прежнюю"
fi
rm -rf "$STAGE"
