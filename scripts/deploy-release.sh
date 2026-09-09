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
# Actuator lives at the root: nginx has a dedicated location /actuator/health and
# proxies /api/ without stripping the prefix, so /api/actuator/health returns 404.
#
# The probe must go through nginx over loopback, never over public DNS: the point
# is to test THIS host's freshly recreated containers, not whatever the domain
# currently resolves to. But nginx redirects HTTP to HTTPS, and curl -L follows
# it, so probing http://127.0.0.1 ends up at https://127.0.0.1 and fails
# certificate verification (curl exit 60) even though the release is fine.
# Fix: keep the public hostname in the URL so TLS verifies, and pin it to
# loopback with --resolve.
check_health() {
  local origin=${HEALTH_ORIGIN:-${PUBLIC_ORIGIN:-http://127.0.0.1}}
  local host=${origin#*://}
  host=${host%%/*}
  host=${host%%:*}
  local -a opts=(-fsSL)
  if [[ "$host" == "127.0.0.1" || "$host" == "localhost" || "$host" == "[::1]" ]]; then
    # No certificate can match a loopback literal; the hop stays on this host.
    opts+=(--insecure)
  else
    opts+=(--resolve "$host:443:127.0.0.1" --resolve "$host:80:127.0.0.1")
  fi
  for _ in $(seq 1 60); do
    if curl "${opts[@]}" --max-time 5 "$origin/actuator/health" >/dev/null \
      && curl "${opts[@]}" --max-time 10 "$origin/" >/dev/null \
      && curl "${opts[@]}" --max-time 10 "$origin/search" >/dev/null; then
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
