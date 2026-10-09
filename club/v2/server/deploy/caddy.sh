#!/usr/bin/env bash
# Подключить адрес штаба к Caddy сайта «тут про ии» (он один держит порты 80/443).
# Дописывает блок в конец /opt/tytproai/app/deploy/Caddyfile, проверяет и перезагружает
# Caddy без остановки. Запуск с Mac: bash club/v2/server/deploy/caddy.sh. Повторный запуск
# ничего не меняет. Устроено так же, как у соседей (WB Alina/SOBAM/deploy/caddy.sh):
#  • блок добавляем, только когда адрес уже есть в DNS — без записи Caddy не получит сертификат;
#  • настройку Caddy получает из файла на сервере через stdin: файл подключён к контейнеру
#    по inode, и после выкладки «тут про ии» контейнер до перезапуска видит прежнюю версию;
#  • при выкладке «тут про ии» его Caddyfile перезаписывается — поэтому тот же блок лежит
#    в его исходниках на Mac (Курс "тут про ии"/app/deploy/Caddyfile). Пропал адрес — запустите этот скрипт.
# Контейнер Caddy не перезапускать — это сайт «тут про ии».
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
IP="${HOST#*@}"
NS="$(dig +short NS "${SITE#*.}" 2>/dev/null | head -1)"
if [[ "$(dig +short A "$SITE" ${NS:+@$NS} 2>/dev/null | head -1)" != "$IP" ]]; then
  echo "записи DNS $SITE → $IP пока нет — блок не добавляю (у регистратора домена нужна запись A «${SITE%%.*}» со значением $IP)"; exit 1
fi
ssh -i "$KEY" -o IdentitiesOnly=yes -o BatchMode=yes "$HOST" "SITE=$SITE bash -s" <<'REMOTE'
set -euo pipefail
F=/opt/tytproai/app/deploy/Caddyfile
C=tytproai-caddy-1
if grep -q "^${SITE//./\\.} " "$F"; then echo "блок $SITE уже есть"
else
  cp "$F" /opt/eva/Caddyfile.before-eva
  # дописываем в тот же файл (не заменяем): Caddy видит его через bind mount по inode
  cat >> "$F" <<BLOCK

# Штаб Eva Club и Eva CRM (проект «Кирилл EVA», контейнер eva-hq-1 на этом сервере, /opt/eva).
$SITE {
	# живые правки идут потоком событий — их не сжимаем и отдаём сразу, не копим
	@pages not path /api/events /crm/api/events
	encode @pages zstd gzip
	reverse_proxy unix//data/eva/web.sock {
		flush_interval -1
	}
	header {
		Strict-Transport-Security "max-age=31536000"
		X-Robots-Tag "noindex, nofollow"
		-Server
	}
}
BLOCK
  if ! docker exec -i "$C" caddy validate --config - --adapter caddyfile <"$F" >/tmp/caddy-eva.log 2>&1; then
    cat /opt/eva/Caddyfile.before-eva > "$F"
    echo "✗ Caddy не принял настройку — откатил"; tail -5 /tmp/caddy-eva.log; exit 1
  fi
  echo "блок $SITE добавлен"
fi
if ! out="$(docker exec -i "$C" caddy reload --config - --adapter caddyfile <"$F" 2>&1)"; then
  echo "✗ Caddy не перечитал настройки:"; echo "$out" | tail -5; exit 1
fi
echo "✓ Caddy перечитал настройки"
REMOTE
# снаружи (адрес сервера задаём явно: новая запись DNS могла ещё не дойти до этого компьютера)
for i in 1 2 3 4 5 6; do
  code="$(curl -s -o /dev/null -m 20 -w '%{http_code}' --resolve "$SITE:443:$IP" "https://$SITE/healthz" || true)"
  if [[ $code == 200 ]]; then echo "✓ https://$SITE отвечает"; break; fi
  [[ $i == 6 ]] && echo "… https://$SITE пока не отвечает (код $code): новому адресу Caddy получает сертификат около минуты — проверьте позже" || sleep 10
done
# соседи должны работать как прежде
for s in ${EVA_NEIGHBOURS:-}; do
  echo "  $s: $(curl -s -o /dev/null -m 15 -w '%{http_code}' "https://$s/" || true)"
done
