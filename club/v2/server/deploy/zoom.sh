#!/usr/bin/env bash
# Внести на сервер ключи Зума: встречи из штаба, запись и ИИ-протокол — сами в «Протоколы».
# Где взять (в Зуме под владельцем платного аккаунта): marketplace.zoom.us → Develop → Build App →
# Server-to-Server OAuth App. На вкладке App Credentials — Account ID, Client ID, Client secret.
# Scopes: meeting:write:meeting:admin, meeting:update:meeting:admin, meeting:read:summary:admin,
#         cloud_recording:read:list_recording_files:admin (или их аналоги «:master» в списке).
# Feature → Event Subscriptions → добавить подписку: адрес https://АДРЕС-ШТАБА/api/zoom/webhook,
#   события Recording → «All Recordings have completed» и Meeting → «Meeting summary completed».
#   Там же — Secret Token (это ZOOM_WEBHOOK_SECRET). Сначала запустите этот скрипт, потом нажмите
#   в Зуме «Validate» — сервер подтвердит адрес сам. Потом — Activate app.
# Запуск с Mac: bash club/v2/server/deploy/zoom.sh — спросит четыре значения (секреты на экране
# не видны), запишет их в /opt/eva/eva.env на сервере и перезапустит штаб.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
[ -f "$HERE/local.env" ] && . "$HERE/local.env"
HOST="${EVA_HOST:?нет EVA_HOST — заполните club/v2/server/deploy/local.env}"
KEY="${EVA_KEY:?нет EVA_KEY — заполните club/v2/server/deploy/local.env}"
SSH=(ssh -i "$KEY" -o IdentitiesOnly=yes -o BatchMode=yes)
read -r -p "Account ID: " ACC
read -r -p "Client ID: " ID
read -r -s -p "Client secret (при вставке не отображается): " SECRET; echo
read -r -s -p "Secret Token уведомлений (Event Subscriptions, не отображается): " HOOK; echo
ACC="${ACC//[[:space:]]/}"; ID="${ID//[[:space:]]/}"; SECRET="${SECRET//[[:space:]]/}"; HOOK="${HOOK//[[:space:]]/}"
[ -n "$ACC" ] && [ -n "$ID" ] && [ -n "$SECRET" ] || { echo "Нужны Account ID, Client ID и Client secret"; exit 1; }
printf 'ZOOM_ACCOUNT_ID=%s\nZOOM_CLIENT_ID=%s\nZOOM_CLIENT_SECRET=%s\nZOOM_WEBHOOK_SECRET=%s\n' "$ACC" "$ID" "$SECRET" "$HOOK" | "${SSH[@]}" "$HOST" 'umask 077; cat > /opt/eva/zoom.new'
"${SSH[@]}" "$HOST" 'bash -s' <<'REMOTE'
set -euo pipefail
cd /opt/eva
{ grep -v -E '^ZOOM_(ACCOUNT_ID|CLIENT_ID|CLIENT_SECRET|WEBHOOK_SECRET)=' eva.env || true; cat zoom.new; } > eva.env.new
chmod 600 eva.env.new
mv eva.env.new eva.env
rm -f zoom.new
docker compose up -d --force-recreate 2>&1 | tail -1
sleep 2
docker compose logs --tail 1 hq 2>&1 | tail -1
REMOTE
echo "Готово. В штабе: «Календарь» → новое собрание → «Создать встречу в Зуме»."
