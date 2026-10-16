#!/usr/bin/env bash
# Подключает адрес aska.tytproai.ru в общем Caddy сервера: bash deploy/caddy.sh (один раз).
# Дописывает блок в конец /opt/tytproai/app/deploy/Caddyfile, проверяет и перезагружает Caddy без остановки.
# Повторный запуск ничего не меняет. Нужна запись A aska → 159.194.237.231 в reg.ru (добавлена 16.10.2026).
#
# Тот же блок держим в исходниках «тут про ии» на Mac (~/Desktop/Курс "тут про ии"/app/deploy/Caddyfile):
# при выкладке «тут про ии» файл на сервере заменяется его версией. Скрипт дописывает блок и туда.
set -euo pipefail
HOST=root@159.194.237.231
KEY="$HOME/.ssh/tutproii_deploy"
DOMAIN=aska.tytproai.ru
MAC_CADDYFILE="$HOME/Desktop/Курс \"тут про ии\"/app/deploy/Caddyfile"
BLOCK="
# Мессенджер «АСЬКА» с сервером (репозиторий evaspace, папка aska-chat; контейнер aska, /opt/aska).
$DOMAIN {
	encode zstd gzip
	reverse_proxy unix//data/aska/web.sock
	header {
		Strict-Transport-Security \"max-age=31536000\"
		X-Robots-Tag \"noindex, nofollow\"
		-Server
	}
}"

if [[ "$(dig +short A $DOMAIN @ns1.reg.ru | head -1)" != "${HOST#*@}" ]]; then
  echo "в reg.ru ещё нет записи A $DOMAIN → ${HOST#*@}"; exit 1
fi

if [[ -f "$MAC_CADDYFILE" ]] && ! grep -q "^$DOMAIN" "$MAC_CADDYFILE"; then
  printf '%s\n' "$BLOCK" >> "$MAC_CADDYFILE"
  echo "блок дописан в исходники «тут про ии» на Mac"
fi

ssh -i "$KEY" -o IdentitiesOnly=yes -o BatchMode=yes "$HOST" "DOMAIN=$DOMAIN bash -s" <<REMOTE
set -euo pipefail
F=/opt/tytproai/app/deploy/Caddyfile
C=tytproai-caddy-1
if grep -q "^\$DOMAIN" "\$F"; then echo "блок уже есть на сервере"; else
  cp "\$F" /opt/aska/Caddyfile.before
  # дописываем в тот же файл (не заменяем): Caddy видит его через bind mount по inode
  cat >> "\$F" <<'BLOCK'
$BLOCK
BLOCK
  if ! docker exec -i "\$C" caddy validate --config - --adapter caddyfile <"\$F" >/tmp/caddy-aska.log 2>&1; then
    cat /opt/aska/Caddyfile.before > "\$F"
    echo "Caddy не принял настройку — откатил"; tail -5 /tmp/caddy-aska.log; exit 1
  fi
fi
docker exec -i "\$C" caddy reload --config - --adapter caddyfile <"\$F"
echo "Caddy перезагружен"
REMOTE

for i in $(seq 1 12); do
  code="$(curl -s -o /dev/null -m 15 -w '%{http_code}' --resolve "$DOMAIN:443:${HOST#*@}" "https://$DOMAIN/api/health" || true)"
  [[ $code == 200 ]] && { echo "https://$DOMAIN отвечает"; break; }
  sleep 5
done
[[ ${code:-} == 200 ]] || echo "https://$DOMAIN пока не отвечает (код ${code:-нет}) — сертификат может выпускаться ещё минуту"
for site in tytproai.ru market.tytproai.ru domgazobeton-supervision.tytproai.ru chat.tytproai.ru; do
  echo "$site: $(curl -s -o /dev/null -m 15 -w '%{http_code}' "https://$site/")"
done
