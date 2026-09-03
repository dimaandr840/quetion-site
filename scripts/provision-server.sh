#!/usr/bin/env bash
#
# Идемпотентная подготовка чистого VPS. Запускается по SSH под root из
# .github/workflows/provision.yml. Повторный запуск безопасен: уже созданные
# секреты не перегенерируются (иначе сломался бы доступ к уже созданной БД).
set -euo pipefail

REPO_URL="${REPO_URL:?REPO_URL обязателен}"
GIT_REF="${GIT_REF:-main}"
DEPLOY_PATH="${DEPLOY_PATH:-/opt/quetion-site}"
DEPLOY_USER="${DEPLOY_USER:-deploy}"
PUBLIC_ORIGIN="${PUBLIC_ORIGIN:?PUBLIC_ORIGIN обязателен}"
COOKIE_SECURE="${COOKIE_SECURE:-false}"
DOMAIN="${DOMAIN:-}"
LETSENCRYPT_EMAIL="${LETSENCRYPT_EMAIL:-}"
ENABLE_TLS="${ENABLE_TLS:-false}"
ADMIN_EMAIL="${ADMIN_EMAIL:-}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-}"
GHCR_USER="${GHCR_USER:-}"
GHCR_TOKEN="${GHCR_TOKEN:-}"
API_IMAGE="${API_IMAGE:-}"
WEB_IMAGE="${WEB_IMAGE:-}"

log() { printf '\n==> %s\n' "$*"; }

if [ "$(id -u)" -ne 0 ]; then
  echo "Скрипт должен выполняться под root" >&2
  exit 1
fi

log "Системные пакеты"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq git curl ca-certificates openssl ufw >/dev/null

log "Swap 2 ГБ (страховка от OOM: JVM + Postgres + Meilisearch + Next.js)"
if ! swapon --show=NAME --noheadings 2>/dev/null | grep -q '/swapfile'; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

log "Firewall: наружу только SSH, 80 и 443"
ufw allow OpenSSH >/dev/null 2>&1 || true
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw --force enable >/dev/null

log "Docker"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh >/dev/null
fi
systemctl enable --now docker >/dev/null 2>&1 || true
echo "docker compose: $(docker compose version --short 2>/dev/null || echo 'не найден')"

log "Пользователь $DEPLOY_USER"
if ! id -u "$DEPLOY_USER" >/dev/null 2>&1; then
  adduser --disabled-password --gecos "" "$DEPLOY_USER" >/dev/null
fi
usermod -aG docker "$DEPLOY_USER"

log "Репозиторий в $DEPLOY_PATH"
mkdir -p "$DEPLOY_PATH"
chown "$DEPLOY_USER:$DEPLOY_USER" "$DEPLOY_PATH"
git config --global --add safe.directory "$DEPLOY_PATH" || true
if [ ! -d "$DEPLOY_PATH/.git" ]; then
  sudo -u "$DEPLOY_USER" git clone --quiet "$REPO_URL" "$DEPLOY_PATH"
fi
cd "$DEPLOY_PATH"
sudo -u "$DEPLOY_USER" git fetch --prune --quiet origin
sudo -u "$DEPLOY_USER" git reset --hard --quiet "origin/$GIT_REF"

log "Файл .env"
ENV_FILE="$DEPLOY_PATH/.env"
touch "$ENV_FILE"

ensure_secret() {
  key="$1"
  if ! grep -q "^${key}=" "$ENV_FILE"; then
    printf '%s=%s\n' "$key" "$(openssl rand -base64 32)" >> "$ENV_FILE"
    echo "  $key сгенерирован"
  fi
}

upsert() {
  key="$1"
  val="$2"
  if grep -q "^${key}=" "$ENV_FILE"; then
    grep -v "^${key}=" "$ENV_FILE" > "${ENV_FILE}.tmp"
    mv "${ENV_FILE}.tmp" "$ENV_FILE"
  fi
  printf '%s=%s\n' "$key" "$val" >> "$ENV_FILE"
}

# Секреты создаются ровно один раз: смена POSTGRES_PASSWORD на живой базе
# отрезала бы приложение от уже созданного кластера, а смена TOTP_ENC_KEY —
# от зашифрованных TOTP-секретов админов.
ensure_secret POSTGRES_PASSWORD
ensure_secret JWT_SECRET
ensure_secret MEILI_MASTER_KEY
ensure_secret TOTP_ENC_KEY

upsert PUBLIC_ORIGIN "$PUBLIC_ORIGIN"
upsert COOKIE_SECURE "$COOKIE_SECURE"

if [ -n "$ADMIN_EMAIL" ]; then
  upsert ADMIN_EMAIL "$ADMIN_EMAIL"
fi

if [ -n "$ADMIN_PASSWORD" ]; then
  upsert ADMIN_PASSWORD "$ADMIN_PASSWORD"
elif ! grep -q '^ADMIN_PASSWORD=' "$ENV_FILE"; then
  GENERATED="$(openssl rand -base64 18)"
  printf 'ADMIN_PASSWORD=%s\n' "$GENERATED" >> "$ENV_FILE"
  printf '%s\n' "$GENERATED" > /root/qareerquest-admin-password.txt
  chmod 600 /root/qareerquest-admin-password.txt
  echo "  Пароль администратора сгенерирован и лежит в /root/qareerquest-admin-password.txt"
fi

chown "$DEPLOY_USER:$DEPLOY_USER" "$ENV_FILE"
chmod 600 "$ENV_FILE"

log "Конфиг nginx"
bash scripts/render-nginx-conf.sh

if [ -n "$GHCR_TOKEN" ]; then
  echo "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USER" --password-stdin >/dev/null
fi

COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml"
IMAGES_OVERLAY="-f docker-compose.images.yml"

log "Запуск сервисов"
if [ -n "$API_IMAGE" ] && [ -n "$WEB_IMAGE" ] && \
   API_IMAGE="$API_IMAGE" WEB_IMAGE="$WEB_IMAGE" $COMPOSE $IMAGES_OVERLAY pull api web >/dev/null 2>&1; then
  echo "Берём готовые образы из GHCR"
  export API_IMAGE WEB_IMAGE
  $COMPOSE $IMAGES_OVERLAY up -d --remove-orphans
else
  # Сюда попадаем на самом первом запуске, пока в GHCR ещё ничего нет.
  echo "Готовых образов нет — собираем на сервере (только в этот раз, дальше сборка в CI)"
  $COMPOSE up -d --build --remove-orphans
fi

if [ "$ENABLE_TLS" = "true" ] && [ -n "$DOMAIN" ] && [ -n "$LETSENCRYPT_EMAIL" ]; then
  log "HTTPS для $DOMAIN"
  DOMAIN="$DOMAIN" LETSENCRYPT_EMAIL="$LETSENCRYPT_EMAIL" DEPLOY_PATH="$DEPLOY_PATH" bash scripts/setup-tls.sh
fi

log "Проверка здоровья API"
ok=0
for _ in $(seq 1 60); do
  if curl -fsS --max-time 5 http://127.0.0.1/api/actuator/health >/dev/null 2>&1; then ok=1; break; fi
  sleep 5
done

if [ "$ok" -ne 1 ]; then
  echo "API не ответил за 5 минут, логи ниже" >&2
  $COMPOSE logs --tail=200 api || true
  exit 1
fi

$COMPOSE ps
log "Готово: $PUBLIC_ORIGIN"
