#!/usr/bin/env bash
# Поставить (или обновить) на сервере самообновление штаба с GitHub: скрипты из папки
# autodeploy/, образ для проверок и таймер. Запуск с Mac: bash club/v2/server/deploy/autodeploy-install.sh
# Как это устроено и зачем — в шапке autodeploy/autodeploy.sh.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
[ -f "$HERE/local.env" ] && . "$HERE/local.env"
HOST="${EVA_HOST:?нет EVA_HOST — заполните club/v2/server/deploy/local.env}"
KEY="${EVA_KEY:?нет EVA_KEY — заполните club/v2/server/deploy/local.env}"
SSH=(ssh -i "$KEY" -o IdentitiesOnly=yes -o BatchMode=yes)
"${SSH[@]}" "$HOST" 'mkdir -p /opt/eva/autodeploy/state'
rsync -az -e "ssh -i $KEY -o IdentitiesOnly=yes" "$HERE/autodeploy/" "$HOST:/opt/eva/autodeploy/" --exclude state --exclude stage
"${SSH[@]}" "$HOST" "EVA_BRANCH='${EVA_BRANCH:-}' bash -s" <<'REMOTE'
set -euo pipefail
cd /opt/eva/autodeploy
chown -R root:root autodeploy.sh check.sh Dockerfile eva-autodeploy.service eva-autodeploy.timer
chmod 755 autodeploy.sh check.sh
docker build -q -t eva-build -f Dockerfile . | tail -1
install -m 644 eva-autodeploy.service eva-autodeploy.timer /etc/systemd/system/
if [ -n "$EVA_BRANCH" ]; then
  mkdir -p /etc/systemd/system/eva-autodeploy.service.d
  printf '[Service]\nEnvironment=EVA_BRANCH=%s\n' "$EVA_BRANCH" > /etc/systemd/system/eva-autodeploy.service.d/branch.conf
fi
systemctl daemon-reload
systemctl enable --now eva-autodeploy.timer >/dev/null 2>&1
systemctl list-timers --no-pager eva-autodeploy.timer | sed -n 1,2p
REMOTE
echo "✓ самообновление поставлено. Журнал: journalctl -u eva-autodeploy -n 30 · состояние: https://${EVA_SITE:-адрес}/version.json"
