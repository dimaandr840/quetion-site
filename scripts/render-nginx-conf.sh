#!/usr/bin/env bash
#
# Генерирует nginx/nginx.effective.conf из nginx/nginx.conf, добавляя два include:
#
#   include /etc/nginx/tls/*.conf;           — сюда setup-tls.sh кладёт server{listen 443}
#   include /etc/nginx/tls/redirect/*.conf;  — редирект 80→443, появляется только после выпуска сертификата
#
# Зачем так: основной nginx.conf остаётся нетронутым и пригодным для локальной
# разработки (где никакого HTTPS нет), а продакшен-оверлей монтирует сгенерированный
# вариант. Файл не версионируется и пересобирается на каждом деплое.
set -euo pipefail

cd "$(dirname "$0")/.."

SRC="nginx/nginx.conf"
OUT="nginx/nginx.effective.conf"

[ -f "$SRC" ] || { echo "Не найден $SRC"; exit 1; }

awk '
  /^    server \{$/ && !tls { print "    include /etc/nginx/tls/*.conf;"; tls = 1 }
  { print }
  /^        listen 80;$/ && !red { print "        include /etc/nginx/tls/redirect/*.conf;"; red = 1 }
' "$SRC" > "${OUT}.tmp"

# Если разметка nginx.conf изменится и якоря не найдутся — лучше упасть здесь,
# чем тихо выкатить конфиг без HTTPS.
grep -qF 'include /etc/nginx/tls/*.conf;' "${OUT}.tmp"
grep -qF 'include /etc/nginx/tls/redirect/*.conf;' "${OUT}.tmp"

mv "${OUT}.tmp" "$OUT"
mkdir -p nginx/tls/redirect nginx/certs nginx/certbot-www nginx/letsencrypt
echo "nginx/nginx.effective.conf сгенерирован"
