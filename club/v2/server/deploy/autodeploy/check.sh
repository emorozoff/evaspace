#!/bin/sh
# Проверка новой правки — внутри одноразового контейнера без доступа к серверу и данным.
# Забирает ветку с GitHub, собирает обе страницы и прогоняет проверки на пустых данных.
# Код 0 — можно ставить; 75 — ветка изменилась, пока проверяли (попробуем позже); иное — не ставить.
set -eu
cd /work
git clone --quiet --depth 1 --branch "$BRANCH" "$REPO" src
cd src
[ "$(git rev-parse HEAD)" = "$COMMIT" ] || { echo "ветка ушла вперёд, пока шла проверка — возьму новую правку в следующий раз"; exit 75; }
echo "— сборка штаба";  python3 club/v2/build.py --check
echo "— сборка CRM";    python3 crm/v2/build.py --check
echo "— синтаксис сервера"
for f in club/v2/server/server.js club/v2/server/lib/*.js club/v2/server/public/*.js; do node --check "$f"; done
echo "— календарь";     node club/v2/server/test/gcal-test.js
echo "— вход и права"
mkdir -p /tmp/data
DATA_DIR=/tmp/data PORT=8787 INSECURE_COOKIE=1 node club/v2/server/server.js > /tmp/server.log 2>&1 &
pid=$!
sleep 2
code=0
node club/v2/server/test/api-test.js || code=$?
kill "$pid" 2>/dev/null || true
[ "$code" = 0 ] || { echo "— журнал сервера:"; tail -20 /tmp/server.log; }
exit "$code"
