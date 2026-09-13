#!/usr/bin/env bash
#
# Генерирует nginx/nginx.effective.conf из nginx/nginx.conf, добавляя два include:
#
#   include /etc/nginx/tls/*.conf;           — сюда setup-tls.sh кладёт server{listen 443}
#   include /etc/nginx/tls/redirect/*.conf;  — редирект 80→443, появляется только после выпуска сертификата
#
# и server-блок, который отправляет www-зеркало 301-м на домен без www.
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

# --- Каноническое зеркало: www -> без www ------------------------------------
#
# Домен с www и без www для поисковых систем — два разных сайта: без 301 они
# индексируются и ранжируются отдельно, вес внешних ссылок делится, а cookie
# (в том числе сессия админки) не разделяются между зеркалами.
# Основное зеркало — домен без www: он короче и не является доменом третьего
# уровня.
#
# Блок добавляется здесь, а не в nginx.conf, потому что конкретный домен в
# репозитории не зашит, а локально www-зеркала нет вовсе. server_name с
# именованным захватом работает для любого домена: www.example.com -> example.com.
#
# Схема цели: пока 80→443 не включён (нет сертификата), ведём на ту же схему,
# чтобы редирект не упирался в отсутствующий HTTPS. После выпуска сертификата
# сразу отправляем на https и экономим один хоп.
if compgen -G "nginx/tls/redirect/*.conf" > /dev/null; then
  WWW_TARGET_SCHEME="https"
else
  WWW_TARGET_SCHEME='$scheme'
fi

# Вставляем перед закрывающей скобкой http{} — последней строкой файла.
if [ "$(tail -n 1 "${OUT}.tmp")" != "}" ]; then
  rm -f "${OUT}.tmp"
  echo "Ожидалась закрывающая } в конце $SRC — разметка изменилась" >&2
  exit 1
fi

{
  head -n -1 "${OUT}.tmp"
  cat <<'WWWBLOCK'

    # Каноническое зеркало: www.<домен> -> <домен>, 301 (см. render-nginx-conf.sh).
    server {
        listen 80;
        server_name ~^www\.(?<devprep_bare_host>.+)$;

        # ACME-челлендж не редиректим: сертификат на www-зеркало выпускается
        # через тот же webroot (scripts/setup-www-redirect.sh).
        location ^~ /.well-known/acme-challenge/ {
            default_type "text/plain";
            root /var/www/certbot;
        }

        location / {
            return 301 __WWW_TARGET_SCHEME__://$devprep_bare_host$request_uri;
        }
    }
WWWBLOCK
  echo "}"
} > "${OUT}.www"

sed -i "s|__WWW_TARGET_SCHEME__|${WWW_TARGET_SCHEME}|" "${OUT}.www"
mv "${OUT}.www" "${OUT}.tmp"

grep -qF 'server_name ~^www\.' "${OUT}.tmp"

# Не заменяем OUT через mv: nginx.effective.conf смонтирован в контейнер как
# отдельный bind mount. Замена inode оставляет уже запущенный nginx на старой
# версии файла, поэтому reload не видит новый ACME location. Перезапись на месте
# сохраняет inode и делает обновлённый конфиг доступным внутри контейнера.
if [ -f "$OUT" ]; then
  cat "${OUT}.tmp" > "$OUT"
  rm -f "${OUT}.tmp"
else
  mv "${OUT}.tmp" "$OUT"
fi

mkdir -p nginx/tls/redirect nginx/certs nginx/certbot-www nginx/letsencrypt
echo "nginx/nginx.effective.conf сгенерирован"
