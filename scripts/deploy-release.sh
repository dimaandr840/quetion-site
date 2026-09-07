#!/usr/bin/env bash
set -Eeuo pipefail
: "${DEPLOY_PATH:?}" "${GIT_SHA:?}"
[[ "$GIT_SHA" =~ ^[0-9a-f]{40}$ ]] || { echo 'Expected a full commit SHA'; exit 2; }
cd "$DEPLOY_PATH"
mkdir -p .releases
chmod 700 .releases
PREV_SHA=$(git rev-parse HEAD)
PREV_API=$(docker inspect --format='{{.Image}}' devprep-api-1 2>/dev/null || true)
PREV_WEB=$(docker inspect --format='{{.Image}}' devprep-web-1 2>/dev/null || true)
if [[ "${ROLLBACK:-false}" == true ]]; then
  [[ -f ".releases/$GIT_SHA" ]] || { echo 'No recorded release for this commit'; exit 2; }
  mapfile -t images < ".releases/$GIT_SHA"
  API_IMAGE=${images[0]:-}
  WEB_IMAGE=${images[1]:-}
fi
for image in "${API_IMAGE:-}" "${WEB_IMAGE:-}"; do
  [[ "$image" =~ ^ghcr\.io/[a-z0-9._/-]+@sha256:[0-9a-f]{64}$ ]] || { echo 'Immutable image digest required'; exit 2; }
done
export API_IMAGE WEB_IMAGE
COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.images.yml)
check_health() {
  local origin=${HEALTH_ORIGIN:-http://127.0.0.1}
  for _ in $(seq 1 60); do
    if curl -fsSL --max-time 5 "$origin/api/actuator/health" >/dev/null \
      && curl -fsSL --max-time 10 "$origin/" >/dev/null \
      && curl -fsSL --max-time 10 "$origin/search" >/dev/null; then
      return 0
    fi
    sleep 5
  done
  return 1
}
rollback_on_error() {
  local code=$?
  trap - ERR
  echo 'Release failed. Restoring previous application images AND tracked configuration.'
  if [[ -n "$PREV_API" && -n "$PREV_WEB" ]]; then
    if git reset --hard "$PREV_SHA" && bash scripts/render-nginx-conf.sh; then
      export API_IMAGE=$PREV_API WEB_IMAGE=$PREV_WEB
      "${COMPOSE[@]}" up -d --no-deps --pull never --force-recreate api web nginx || true
    fi
  fi
  echo 'Database migrations are not reversed. Inspect service health before retrying.'
  exit "$code"
}
git fetch --prune origin
docker pull "$API_IMAGE"
docker pull "$WEB_IMAGE"
trap rollback_on_error ERR
git reset --hard "$GIT_SHA"
bash scripts/render-nginx-conf.sh
"${COMPOSE[@]}" config --quiet
# Never recreate postgres or remove backup/monitoring services; reload nginx configuration explicitly.
"${COMPOSE[@]}" up -d --no-deps --force-recreate api web nginx
check_health
if [[ -f ".releases/$GIT_SHA" ]]; then
  diff -u ".releases/$GIT_SHA" <(printf '%s\n%s\n' "$API_IMAGE" "$WEB_IMAGE")
else
  printf '%s\n%s\n' "$API_IMAGE" "$WEB_IMAGE" > ".releases/$GIT_SHA.tmp"
  mv ".releases/$GIT_SHA.tmp" ".releases/$GIT_SHA"
fi
printf '%s\n' "$GIT_SHA" > .releases/current
trap - ERR
"${COMPOSE[@]}" ps
# Retain previous images for offline rollback. Migrations must be backward compatible.
