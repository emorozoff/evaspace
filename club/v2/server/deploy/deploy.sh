#!/usr/bin/env bash
# Выложить штаб и CRM на сервер (тот же, где сайт «тут про ии»).
# Запуск с Mac из любой папки:  bash club/v2/server/deploy/deploy.sh
# Что делает: собирает обе страницы, копирует на сервер только нужное для работы
# (собранные страницы и серверную часть — исходники src/ не едут), перезапускает
# контейнер и проверяет, что он отвечает. Данные (/opt/eva/data) не трогает.
# Первый запуск сам заводит на сервере пользователя eva, папки и настройки.
# Презентации m/*.html в репозитории не лежат: положите их в папку materials/
# рядом с репозиторием (или укажите MATERIALS=путь) — уедут вместе с кодом.
set -euo pipefail
# Куда выкладывать: адрес сервера и ключ — в файле local.env рядом (в репозиторий не попадает):
#   EVA_HOST=root@адрес-сервера
#   EVA_KEY=$HOME/.ssh/имя_ключа
#   EVA_SITE=eva.example.ru
HERE="$(cd "$(dirname "$0")" && pwd)"
[ -f "$HERE/local.env" ] && . "$HERE/local.env"
HOST="${EVA_HOST:?нет EVA_HOST — заполните club/v2/server/deploy/local.env}"
KEY="${EVA_KEY:?нет EVA_KEY — заполните club/v2/server/deploy/local.env}"
SITE="${EVA_SITE:?нет EVA_SITE — заполните club/v2/server/deploy/local.env}"
ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
MATERIALS="${MATERIALS:-$ROOT/../materials}"
SSH=(ssh -i "$KEY" -o IdentitiesOnly=yes -o BatchMode=yes)
cd "$ROOT"

echo "— собираю страницы"
python3 club/v2/build.py --check
python3 crm/v2/build.py --check
for f in club/v2/server/server.js club/v2/server/lib/*.js club/v2/server/public/*.js; do node --check "$f"; done

echo "— готовлю сервер"
"${SSH[@]}" "$HOST" "SITE=$SITE bash -s" <<'REMOTE'
set -euo pipefail
id eva >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin eva
SOCK=/var/lib/docker/volumes/tytproai_caddy-data/_data/eva
mkdir -p /opt/eva/app /opt/eva/data /opt/eva/materials "$SOCK"
chown eva:eva /opt/eva/data "$SOCK"
chmod 700 /opt/eva/data
chmod 755 "$SOCK"
printf 'EVA_UID=%s\nEVA_GID=%s\n' "$(id -u eva)" "$(id -g eva)" > /opt/eva/.env
if [ ! -f /opt/eva/eva.env ]; then
  printf '# Адрес сайта и ключи Google для календаря (Google Cloud → Credentials → OAuth client)\nPUBLIC_URL=https://%s\nGOOGLE_CLIENT_ID=\nGOOGLE_CLIENT_SECRET=\n' "$SITE" > /opt/eva/eva.env
  chmod 600 /opt/eva/eva.env
fi
REMOTE

echo "— копирую код"
rsync -azR --delete -e "ssh -i $KEY -o IdentitiesOnly=yes" \
  club/v2/index.html club/v2/eva-club-v2.html \
  club/v2/server/server.js club/v2/server/lib club/v2/server/public \
  crm/v2/index.html crm/v2/eva-crm-v2.html crm/v2/anketa.html crm/v2/a/index.html \
  "$HOST:/opt/eva/app/"
rsync -az -e "ssh -i $KEY -o IdentitiesOnly=yes" club/v2/server/deploy/docker-compose.yml "$HOST:/opt/eva/docker-compose.yml"
if compgen -G "$MATERIALS/*.html" >/dev/null; then
  rsync -az --delete -e "ssh -i $KEY -o IdentitiesOnly=yes" "$MATERIALS/" "$HOST:/opt/eva/materials/"
else
  echo "  презентаций в $MATERIALS нет — на сервере остаются прежние"
fi

echo "— перезапускаю"
"${SSH[@]}" "$HOST" 'bash -s' <<'REMOTE'
set -euo pipefail
cd /opt/eva
chown -R root:root app materials docker-compose.yml
chmod -R a+rX app materials
docker compose up -d --force-recreate --quiet-pull 2>&1 | tail -3
SOCK=/var/lib/docker/volumes/tytproai_caddy-data/_data/eva/web.sock
for i in 1 2 3 4 5 6 7 8 9 10; do
  if [ -S "$SOCK" ] && [ "$(curl -s -m 3 --unix-socket "$SOCK" http://eva/healthz || true)" = ok ]; then echo "✓ контейнер отвечает"; docker compose logs --tail 2 hq 2>&1 | tail -2; exit 0; fi
  sleep 1
done
echo "✗ контейнер не ответил за 10 секунд:"; docker compose logs --tail 20 hq; exit 1
REMOTE
