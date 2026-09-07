#!/usr/bin/env bash
#
# Поднимает стек после перезагрузки VPS ровно на тех образах, которые
# записаны в .releases/current последним успешным деплоем.
#
# Зачем отдельный скрипт, если в compose есть restart: unless-stopped:
# unless-stopped НЕ возвращает контейнер, который был остановлен вручную
# или остался лежать после прерванного деплоя. После ребута такой сервис
# молча не поднимется. Юнит deploy/quetion-site.service закрывает эту дыру.
#
# Идемпотентен: если всё уже работает, compose ничего не пересоздаёт.
set -euo pipefail

DEPLOY_PATH="${DEPLOY_PATH:-/opt/quetion-site}"
cd "$DEPLOY_PATH"

COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.prod.yml)

# nginx.effective.conf не версионируется — пересобираем его на каждом старте.
bash scripts/render-nginx-conf.sh

if [ -s .releases/current ]; then
  SHA="$(cat .releases/current)"
  if [ -s ".releases/$SHA" ]; then
    API_IMAGE="$(sed -n '1p' ".releases/$SHA")"
    WEB_IMAGE="$(sed -n '2p' ".releases/$SHA")"
    if [ -n "$API_IMAGE" ] && [ -n "$WEB_IMAGE" ]; then
      export API_IMAGE WEB_IMAGE
      COMPOSE+=(-f docker-compose.images.yml)
      echo "Восстанавливаем зафиксированный релиз $SHA"
    fi
  fi
fi

"${COMPOSE[@]}" up -d --remove-orphans

# Postgres и JVM после холодного старта поднимаются небыстро — ждём до 5 минут.
HEALTH_ORIGIN="${HEALTH_ORIGIN:-http://127.0.0.1}"
for _ in $(seq 1 60); do
  if curl -fsS --max-time 5 "$HEALTH_ORIGIN/api/actuator/health" >/dev/null 2>&1; then
    echo "Стек поднят"
    "${COMPOSE[@]}" ps
    exit 0
  fi
  sleep 5
done

echo "API не ответил за 5 минут после старта" >&2
"${COMPOSE[@]}" logs --tail=100 api || true
exit 1
