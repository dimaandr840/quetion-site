#!/usr/bin/env bash
#
# Выпускает сертификат для www-зеркала и включает server{listen 443} с 301
# на домен без www.
#
# Контекст: редирект на 80 порту (www -> без www) добавляет
# scripts/render-nginx-conf.sh и он работает сразу. Но если посетитель или
# поисковый робот придёт сразу на https://www.<домен>, браузер увидит
# ошибку сертификата раньше любого редиректа: сертификат из setup-tls.sh
# выписан только на домен без www. Этот скрипт закрывает пробел.
#
# Запускать после scripts/setup-tls.sh, когда у www.<домен> уже есть
# A- или CNAME-запись на этот же сервер:
#
#   DOMAIN=qareerquest.com LETSENCRYPT_EMAIL=you@example.com \
#     bash scripts/setup-www-redirect.sh
#
# Продление отдельно настраивать не нужно: scripts/renew-tls.sh вызывает
# `certbot renew` и продлевает все сертификаты, включая этот.
set -euo pipefail

DOMAIN="${DOMAIN:?DOMAIN обязателен}"
LETSENCRYPT_EMAIL="${LETSENCRYPT_EMAIL:?LETSENCRYPT_EMAIL обязателен}"
DEPLOY_PATH="${DEPLOY_PATH:-/opt/quetion-site}"
WWW_DOMAIN="www.$DOMAIN"

cd "$DEPLOY_PATH"
mkdir -p nginx/certbot-www nginx/letsencrypt nginx/tls

COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml"

# Самопроверка до nginx: неудачные валидации Let's Encrypt лимитируются
# (5 в час на домен), поэтому дешевле упасть на отсутствующей DNS-записи.
if ! getent hosts "$WWW_DOMAIN" > /dev/null; then
  echo "$WWW_DOMAIN не разрешается в IP." >&2
  echo "Сначала добавьте CNAME $WWW_DOMAIN -> $DOMAIN (или A-запись на этот сервер)." >&2
  exit 1
fi

# Перегенерируем конфиг: в нём уже есть server{listen 80} для www с
# ACME-location, без него челлендж для www попадёт под редирект.
bash scripts/render-nginx-conf.sh
$COMPOSE up -d --force-recreate nginx
$COMPOSE exec -T nginx nginx -t

ACME_DIR="nginx/certbot-www/.well-known/acme-challenge"
mkdir -p "$ACME_DIR"
PROBE="setup-www-probe-$$"
echo "ok" > "$ACME_DIR/$PROBE"
PROBE_URL="http://$WWW_DOMAIN/.well-known/acme-challenge/$PROBE"
if [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$PROBE_URL" || echo 000)" != "200" ]; then
  rm -f "$ACME_DIR/$PROBE"
  echo "nginx не отдаёт $PROBE_URL — Let's Encrypt тоже получит ошибку." >&2
  echo "Проверьте DNS для $WWW_DOMAIN и открыт ли 80/tcp в ufw." >&2
  exit 1
fi
rm -f "$ACME_DIR/$PROBE"

# Отдельный cert-name: не трогаем сертификат основного домена, чтобы
# повторный запуск этого скрипта не мог сломать работающий HTTPS сайта.
docker run --rm \
  -v "$DEPLOY_PATH/nginx/letsencrypt:/etc/letsencrypt" \
  -v "$DEPLOY_PATH/nginx/certbot-www:/var/www/certbot" \
  certbot/certbot certonly \
    --webroot -w /var/www/certbot \
    --cert-name "$WWW_DOMAIN" \
    -d "$WWW_DOMAIN" \
    --email "$LETSENCRYPT_EMAIL" \
    --agree-tos --no-eff-email --non-interactive --keep-until-expiring

# Зеркало на 443: ничего не проксирует, только 301. HSTS здесь тоже нужен:
# includeSubDomains с основного домена уже покрывает www, и ответ без
# заголовка выглядел бы как регресс в сканерах безопасности.
cat > nginx/tls/www.conf <<'WWWCONF'
# Сгенерировано scripts/setup-www-redirect.sh. Правки вручную будут перезатёрты.
server {
    listen 443 ssl;
    http2 on;
    server_name www.__DOMAIN__;

    ssl_certificate     /etc/nginx/letsencrypt/live/www.__DOMAIN__/fullchain.pem;
    ssl_certificate_key /etc/nginx/letsencrypt/live/www.__DOMAIN__/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;

    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;

    location ^~ /.well-known/acme-challenge/ {
        default_type "text/plain";
        root /var/www/certbot;
    }

    location / {
        return 301 https://__DOMAIN__$request_uri;
    }
}
WWWCONF

sed -i "s/__DOMAIN__/$DOMAIN/g" nginx/tls/www.conf

bash scripts/render-nginx-conf.sh
$COMPOSE up -d --force-recreate nginx

if $COMPOSE exec -T nginx nginx -t; then
  $COMPOSE exec -T nginx nginx -s reload
else
  echo "nginx -t не прошёл, перезапускаем контейнер" >&2
  $COMPOSE restart nginx
fi

echo "Готово: http(s)://$WWW_DOMAIN отвечает 301 на https://$DOMAIN"
