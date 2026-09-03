#!/usr/bin/env bash
#
# Продление сертификатов Let's Encrypt. Запускается systemd-таймером
# qareerquest-tls-renew.timer, который создаёт scripts/setup-tls.sh.
# certbot сам решает, нужно ли продлевать (меньше 30 дней до конца).
set -euo pipefail

DEPLOY_PATH="${DEPLOY_PATH:-/opt/quetion-site}"
cd "$DEPLOY_PATH"

docker run --rm \
  -v "$DEPLOY_PATH/nginx/letsencrypt:/etc/letsencrypt" \
  -v "$DEPLOY_PATH/nginx/certbot-www:/var/www/certbot" \
  certbot/certbot renew --webroot -w /var/www/certbot --quiet

# nginx читает сертификат при старте, поэтому после продления нужен reload.
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T nginx nginx -s reload || true
