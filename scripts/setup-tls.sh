#!/usr/bin/env bash
#
# Выпускает сертификат Let's Encrypt через webroot работающего nginx,
# включает server{listen 443}, редирект 80→443 и systemd-таймер автопродления.
#
# Перед запуском A-запись домена уже должна указывать на этот сервер,
# иначе Let's Encrypt не пройдёт проверку владения.
set -euo pipefail

DOMAIN="${DOMAIN:?DOMAIN обязателен}"
LETSENCRYPT_EMAIL="${LETSENCRYPT_EMAIL:?LETSENCRYPT_EMAIL обязателен}"
DEPLOY_PATH="${DEPLOY_PATH:-/opt/quetion-site}"

cd "$DEPLOY_PATH"
mkdir -p nginx/certbot-www nginx/letsencrypt nginx/tls/redirect

COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml"

# ACME-челлендж отдаёт nginx на 80 порту (location /.well-known/acme-challenge/).
$COMPOSE up -d nginx

docker run --rm \
  -v "$DEPLOY_PATH/nginx/letsencrypt:/etc/letsencrypt" \
  -v "$DEPLOY_PATH/nginx/certbot-www:/var/www/certbot" \
  certbot/certbot certonly \
    --webroot -w /var/www/certbot \
    -d "$DOMAIN" \
    --email "$LETSENCRYPT_EMAIL" \
    --agree-tos --no-eff-email --non-interactive --keep-until-expiring

cat > nginx/tls/tls.conf <<'TLSCONF'
# Сгенерировано scripts/setup-tls.sh. Правки вручную будут перезатёрты.
server {
    listen 443 ssl;
    http2 on;
    server_name __DOMAIN__;

    ssl_certificate     /etc/nginx/letsencrypt/live/__DOMAIN__/fullchain.pem;
    ssl_certificate_key /etc/nginx/letsencrypt/live/__DOMAIN__/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;

    limit_conn perip 32;

    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options DENY always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;
    add_header Content-Security-Policy $devprep_csp always;
    add_header Cross-Origin-Opener-Policy same-origin always;
    add_header Cross-Origin-Resource-Policy same-origin always;
    add_header X-Permitted-Cross-Domain-Policies none always;
    add_header Origin-Agent-Cluster "?1" always;
    add_header Permissions-Policy "accelerometer=(), camera=(), microphone=(), geolocation=(), gyroscope=(), magnetometer=(), payment=(), usb=()" always;

    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
        return 404;
    }

    location ~* \.(env|bak|old|sql|swp|ini|log|zip|tar|gz)$ {
        deny all;
        access_log off;
        return 404;
    }

    if ($request_method !~ ^(GET|HEAD|POST|PUT|PATCH|DELETE|OPTIONS)$) {
        return 405;
    }

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location /_next/static/ {
        proxy_pass http://devprep_web;
        add_header Cache-Control "public, max-age=31536000, immutable";
        add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;
        add_header X-Content-Type-Options nosniff always;
        add_header X-Frame-Options DENY always;
        add_header Referrer-Policy strict-origin-when-cross-origin always;
        add_header Content-Security-Policy $devprep_csp always;
    }

    location = /api/auth/login {
        limit_req zone=login burst=3 nodelay;
        proxy_pass http://devprep_api;
    }

    location = /api/auth/totp/verify {
        limit_req zone=login burst=3 nodelay;
        proxy_pass http://devprep_api;
    }

    location = /api/auth/register {
        limit_req zone=login burst=3 nodelay;
        proxy_pass http://devprep_api;
    }

    location = /api/auth/password {
        limit_req zone=login burst=3 nodelay;
        proxy_pass http://devprep_api;
        add_header Cache-Control "no-store" always;
    }

    location = /api/admin/media {
        limit_req zone=api burst=10 nodelay;
        client_max_body_size 6m;
        proxy_pass http://devprep_api;
        proxy_read_timeout 120s;
        proxy_request_buffering on;
        add_header Cache-Control "no-store" always;
        add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;
        add_header X-Content-Type-Options nosniff always;
        add_header X-Frame-Options DENY always;
        add_header Referrer-Policy strict-origin-when-cross-origin always;
    }

    location /api/docs {
        deny all;
        return 404;
    }

    location = /api/openapi.json {
        deny all;
        return 404;
    }

    location /api/ {
        limit_req zone=api burst=40 nodelay;
        proxy_pass http://devprep_api;
        add_header Cache-Control "no-store" always;
        add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;
        add_header X-Content-Type-Options nosniff always;
        add_header X-Frame-Options DENY always;
        add_header Referrer-Policy strict-origin-when-cross-origin always;
    }

    location /actuator/health {
        proxy_pass http://devprep_api;
    }

    # CSP для /admin и /login выдаёт сам Next.js с nonce (frontend/proxy.ts),
    # поэтому здесь его не дублируем.
    location /admin {
        proxy_pass http://devprep_web;
        proxy_buffering off;
        add_header X-Robots-Tag "noindex, nofollow, noarchive" always;
        add_header Cache-Control "no-store" always;
        add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;
        add_header X-Content-Type-Options nosniff always;
        add_header X-Frame-Options DENY always;
        add_header Referrer-Policy no-referrer always;
        add_header Cross-Origin-Opener-Policy same-origin always;
        add_header Cross-Origin-Resource-Policy same-origin always;
    }

    location = /login {
        proxy_pass http://devprep_web;
        proxy_buffering off;
        add_header X-Robots-Tag "noindex, nofollow" always;
        add_header Cache-Control "no-store" always;
        add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;
        add_header X-Content-Type-Options nosniff always;
        add_header X-Frame-Options DENY always;
        add_header Referrer-Policy no-referrer always;
        add_header Cross-Origin-Opener-Policy same-origin always;
        add_header Cross-Origin-Resource-Policy same-origin always;
    }

    location / {
        proxy_pass http://devprep_web;
        proxy_buffering off;
    }
}
TLSCONF

sed -i "s/__DOMAIN__/$DOMAIN/g" nginx/tls/tls.conf

cat > nginx/tls/redirect/redirect.conf <<'REDIRECT'
# Сгенерировано scripts/setup-tls.sh.
# ACME-челлендж должен остаться доступным по http, иначе продление упрётся в редирект.
if ($request_uri !~ ^/\.well-known/acme-challenge/) {
    return 301 https://$host$request_uri;
}
REDIRECT

bash scripts/render-nginx-conf.sh
$COMPOSE up -d nginx

if $COMPOSE exec -T nginx nginx -t; then
  $COMPOSE exec -T nginx nginx -s reload
else
  echo "nginx -t не прошёл, перезапускаем контейнер" >&2
  $COMPOSE restart nginx
fi

# Автопродление: сертификат Let's Encrypt живёт 90 дней.
if [ "$(id -u)" -eq 0 ]; then
  cat > /etc/systemd/system/qareerquest-tls-renew.service <<EOF
[Unit]
Description=Renew Let's Encrypt certificates for Qareer Quest
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
Environment=DEPLOY_PATH=$DEPLOY_PATH
ExecStart=/bin/bash $DEPLOY_PATH/scripts/renew-tls.sh
EOF

  cat > /etc/systemd/system/qareerquest-tls-renew.timer <<'EOF'
[Unit]
Description=Renew Let's Encrypt certificates twice a day

[Timer]
OnCalendar=*-*-* 03,15:17:00
RandomizedDelaySec=45m
Persistent=true

[Install]
WantedBy=timers.target
EOF

  systemctl daemon-reload
  systemctl enable --now qareerquest-tls-renew.timer
  echo "Таймер автопродления включён"
fi

echo "HTTPS настроен: https://$DOMAIN"
