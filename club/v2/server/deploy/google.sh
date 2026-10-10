#!/usr/bin/env bash
# Внести на сервер ключи Google для календаря. Их выдаёт Google Cloud того аккаунта, от чьего
# имени работает «приложение»: APIs & Services → Credentials → Create credentials → OAuth client ID
# (тип «Web application», Authorized redirect URI — https://АДРЕС-ШТАБА/api/gcal/callback).
# Запуск с Mac: bash club/v2/server/deploy/google.sh — спросит два значения (секрет на экране
# не показывается), запишет их в /opt/eva/eva.env на сервере и перезапустит штаб.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
[ -f "$HERE/local.env" ] && . "$HERE/local.env"
HOST="${EVA_HOST:?нет EVA_HOST — заполните club/v2/server/deploy/local.env}"
KEY="${EVA_KEY:?нет EVA_KEY — заполните club/v2/server/deploy/local.env}"
SSH=(ssh -i "$KEY" -o IdentitiesOnly=yes -o BatchMode=yes)
read -r -p "Client ID (заканчивается на .apps.googleusercontent.com): " ID
read -r -s -p "Client secret (при вставке не отображается): " SECRET; echo
ID="${ID//[[:space:]]/}"; SECRET="${SECRET//[[:space:]]/}"
[[ "$ID" == *.apps.googleusercontent.com ]] || { echo "Это не похоже на Client ID — он заканчивается на .apps.googleusercontent.com"; exit 1; }
[ -n "$SECRET" ] || { echo "Секрет пустой"; exit 1; }
printf 'GOOGLE_CLIENT_ID=%s\nGOOGLE_CLIENT_SECRET=%s\n' "$ID" "$SECRET" | "${SSH[@]}" "$HOST" 'umask 077; cat > /opt/eva/google.new'
"${SSH[@]}" "$HOST" 'bash -s' <<'REMOTE'
set -euo pipefail
cd /opt/eva
{ grep -v -E '^GOOGLE_CLIENT_(ID|SECRET)=' eva.env || true; cat google.new; } > eva.env.new
chmod 600 eva.env.new
mv eva.env.new eva.env
rm -f google.new
docker compose up -d --force-recreate 2>&1 | tail -1
sleep 2
docker compose logs --tail 1 hq 2>&1 | tail -1
REMOTE
echo "Готово. В штабе: «Календарь» → «Подключить мой Google Календарь»."
