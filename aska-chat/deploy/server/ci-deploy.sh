#!/usr/bin/env bash
# Выкладка мессенджера «АСЬКА» (папка aska-chat в github.com/emorozoff/evaspace) по команде из GitHub Actions.
#
# КОПИЯ ДЛЯ СПРАВКИ. Настоящий файл — /opt/aska/ci-deploy.sh на сервере 159.194.237.231, его ставят вручную с Mac.
# Сервер этот файл из репозитория НЕ берёт: иначе любой коммит мог бы выполнить что угодно с правами root.
#
# Запускается только ключом выкладки: в /root/.ssh/authorized_keys стоит
#   command="/opt/aska/ci-deploy.sh",restrict ssh-ed25519 … aska-chat-ci
# Принимает одну команду: «deploy <sha>». Выкладывает, только если <sha> — текущая вершина ветки облачной сессии,
# поэтому ключ не может выложить чужой или старый код. Код скачивается с GitHub, собирается в Docker
# (сборка изолирована от сервера), контейнер получает только свою папку данных и сокет для Caddy.
# Если новая версия не ответила — возвращается прежняя. База и фото (/opt/aska/data) не трогаются.
# Настоящие звуки ICQ (/opt/aska/sounds) в репозиторий не кладём (права у ICQ) — подключаем в контейнер только для чтения.
set -euo pipefail
REPO=emorozoff/evaspace
BRANCH=claude/pensive-davinci-tyahht
BASE=/opt/aska
SOCK=/var/lib/docker/volumes/tytproai_caddy-data/_data/aska
NAME=aska
IMAGE=aska-chat
PUBLIC_URL=https://aska.tytproai.ru

read -r action sha extra <<<"${SSH_ORIGINAL_COMMAND:-$*}" || true
if [[ ${action:-} != deploy || ! ${sha:-} =~ ^[0-9a-f]{40}$ || -n ${extra:-} ]]; then
  echo "ожидаю команду: deploy <sha из 40 символов>"; exit 2
fi

exec 9>"$BASE/deploy.lock"
flock 9

head="$(git ls-remote "https://github.com/$REPO.git" "refs/heads/$BRANCH" | cut -f1)"
if [[ $head != "$sha" ]]; then
  echo "В ветке уже есть версия новее (${head:0:7}) — её выложит свой запуск. Пропускаю ${sha:0:7}."
  exit 0
fi

work="$(mktemp -d "$BASE/build.XXXXXX")"
trap 'rm -rf "$work"' EXIT
echo "Скачиваю ${sha:0:7}…"
curl -fsSL "https://codeload.github.com/$REPO/tar.gz/$sha" \
  | tar xz -C "$work" --strip-components=1 --wildcards '*/aska-chat/*' '*/aska/*'

echo "Собираю…"
docker build -q -t "$IMAGE:$sha" -f "$work/aska-chat/Dockerfile" "$work" >/dev/null

mkdir -p "$BASE/data" "$SOCK" "$BASE/sounds"
chown 1000:1000 "$BASE/data" "$SOCK"
prev="$(docker inspect -f '{{.Config.Image}}' "$NAME" 2>/dev/null || true)"

run() {
  docker run -d --name "$NAME" --restart unless-stopped --user 1000:1000 --memory 256m \
    -e PUBLIC_URL="$PUBLIC_URL" -e SOCKET=/sock/web.sock -e APP_VERSION="$2" \
    -v "$BASE/data":/data -v "$SOCK":/sock -v "$BASE/sounds":/app/client/dist/sounds:ro "$1" >/dev/null
}
healthy() {
  for _ in $(seq 1 60); do
    curl -fsS --max-time 2 --unix-socket "$SOCK/web.sock" http://aska/api/health 2>/dev/null | grep -q "\"$1\"" && return 0
    sleep 0.5
  done
  return 1
}

docker rm -f "$NAME" >/dev/null 2>&1 || true
run "$IMAGE:$sha" "$sha"
if healthy "$sha"; then
  echo "✅ Выложена версия ${sha:0:7}: $PUBLIC_URL"
  # убираем старые образы, кроме текущего и предыдущего
  docker images "$IMAGE" --format '{{.Tag}}' | grep -v -e "^$sha\$" -e "^${prev#*:}\$" | xargs -r -I{} docker rmi "$IMAGE:{}" >/dev/null 2>&1 || true
  exit 0
fi

echo "❌ Новая версия не ответила. Последние строки её журнала:"
docker logs --tail 30 "$NAME" 2>&1 || true
docker rm -f "$NAME" >/dev/null 2>&1 || true
if [[ -n $prev ]]; then
  run "$prev" "${prev#*:}"
  healthy "${prev#*:}" && echo "↩️ Вернул прежнюю версию ${prev#*:}" || echo "⚠️ Прежняя версия тоже не отвечает"
fi
exit 1
