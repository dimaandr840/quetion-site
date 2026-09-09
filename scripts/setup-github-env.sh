#!/usr/bin/env bash
# Заливка GitHub Secrets и Variables для деплоя на LuxVPS.
#
# Зачем: и job `deploy` (deploy.yml), и job `provision` (provision.yml) работают
# в environment `production`, поэтому серверные секреты кладём в этот environment.
# А NEXT_PUBLIC_* переменные читает job `build-push`, который к environment НЕ
# привязан — их кладём на уровень репозитория, иначе фронт соберётся с пустыми
# значениями.
#
# Как пользоваться:
#   1. Установить GitHub CLI и войти:  gh auth login
#   2. Заполнить блок FILL ME ниже (пустые значения просто пропускаются).
#   3. bash scripts/setup-github-env.sh
#
# Скрипт идемпотентен: повторный запуск перезаписывает значения.
# ВАЖНО: не коммить этот файл с заполненными секретами. Либо заполняй копию
# вне репозитория, либо экспортируй переменные окружения перед запуском:
#   LUXVPS_HOST=1.2.3.4 LUXVPS_ROOT_PASSWORD='...' bash scripts/setup-github-env.sh

set -euo pipefail

REPO="${REPO:-dimaandr840/quetion-site}"
ENVIRONMENT="${ENVIRONMENT:-production}"

# ─────────────────────────── FILL ME ───────────────────────────
# --- Environment secrets (доступны только job'ам с environment: production) ---

# IP или хостнейм VPS. ОБЯЗАТЕЛЬНО.
LUXVPS_HOST="${LUXVPS_HOST:-}"

# Root-пароль из письма LuxVPS. Нужен для первичного Provision.
# После harden-server.sh можно удалить и оставить только ключ.
LUXVPS_ROOT_PASSWORD="${LUXVPS_ROOT_PASSWORD:-}"

# Заполнять только если вход на сервер не под root.
LUXVPS_ROOT_USER="${LUXVPS_ROOT_USER:-}"

# Пользователь для регулярных деплоев. Обычно deploy.
# Задавать ПОСЛЕ того, как provision создал пользователя и ты добавил ему ключ.
LUXVPS_USER="${LUXVPS_USER:-}"

# Приватный SSH-ключ ЦЕЛИКОМ, вместе со строками -----BEGIN/-----END.
# Проще всего подставить путь к файлу: LUXVPS_SSH_KEY_FILE=~/.ssh/quetion_deploy
LUXVPS_SSH_KEY_FILE="${LUXVPS_SSH_KEY_FILE:-}"

# SSH-порт, если не 22.
LUXVPS_PORT="${LUXVPS_PORT:-}"

# PAT с правом read:packages — только если пакеты в GHCR приватные.
GHCR_PULL_TOKEN="${GHCR_PULL_TOKEN:-}"

# Пароль первого админа. Если пусто — provision сгенерирует его сам
# и положит в /root/qareerquest-admin-password.txt (файл нужно забрать и удалить).
ADMIN_PASSWORD="${ADMIN_PASSWORD:-}"

# --- Repository variables (нужны на этапе сборки образов) ---

# Публичный адрес сайта. Вшивается в клиентский бандл при сборке.
PUBLIC_ORIGIN="${PUBLIC_ORIGIN:-https://qareerquest.com}"

# Включена ли авторизация во фронтенде.
AUTH_ENABLED="${AUTH_ENABLED:-true}"

# Базовый URL медиа-хранилища. Можно оставить пустым, если медиа выключены.
MEDIA_PUBLIC_BASE_URL="${MEDIA_PUBLIC_BASE_URL:-}"

# --- Environment variables (нужны только на этапе деплоя) ---

# Почта первого администратора.
ADMIN_EMAIL="${ADMIN_EMAIL:-}"

# Значения ниже совпадают с дефолтами в workflow — задавать не обязательно.
DEPLOY_PATH="${DEPLOY_PATH:-/opt/quetion-site}"
DEPLOY_USER="${DEPLOY_USER:-deploy}"
HEALTH_ORIGIN="${HEALTH_ORIGIN:-http://127.0.0.1}"
# ─────────────────────────── /FILL ME ──────────────────────────

command -v gh >/dev/null || { echo 'Нужен GitHub CLI: https://cli.github.com'; exit 1; }
gh auth status >/dev/null || { echo 'Сначала выполни: gh auth login'; exit 1; }

skipped=()

set_env_secret() {
  local name=$1 value=$2
  if [ -z "$value" ]; then skipped+=("secret $name"); return 0; fi
  printf '%s' "$value" | gh secret set "$name" --repo "$REPO" --env "$ENVIRONMENT" --body -
  echo "  ✓ secret $name (environment: $ENVIRONMENT)"
}

set_env_secret_from_file() {
  local name=$1 path=${2/#\~/$HOME}
  if [ -z "${2:-}" ]; then skipped+=("secret $name"); return 0; fi
  [ -f "$path" ] || { echo "  ✗ $name: файл не найден: $path"; return 1; }
  gh secret set "$name" --repo "$REPO" --env "$ENVIRONMENT" < "$path"
  echo "  ✓ secret $name (из $path)"
}

set_repo_variable() {
  local name=$1 value=$2
  if [ -z "$value" ]; then skipped+=("repo variable $name"); return 0; fi
  gh variable set "$name" --repo "$REPO" --body "$value"
  echo "  ✓ repo variable $name = $value"
}

set_env_variable() {
  local name=$1 value=$2
  if [ -z "$value" ]; then skipped+=("env variable $name"); return 0; fi
  gh variable set "$name" --repo "$REPO" --env "$ENVIRONMENT" --body "$value"
  echo "  ✓ env variable $name = $value"
}

echo "Репозиторий: $REPO, environment: $ENVIRONMENT"
echo
echo 'Environment secrets:'
set_env_secret LUXVPS_HOST "$LUXVPS_HOST"
set_env_secret LUXVPS_ROOT_PASSWORD "$LUXVPS_ROOT_PASSWORD"
set_env_secret LUXVPS_ROOT_USER "$LUXVPS_ROOT_USER"
set_env_secret LUXVPS_USER "$LUXVPS_USER"
set_env_secret_from_file LUXVPS_SSH_KEY "$LUXVPS_SSH_KEY_FILE"
set_env_secret LUXVPS_PORT "$LUXVPS_PORT"
set_env_secret GHCR_PULL_TOKEN "$GHCR_PULL_TOKEN"
set_env_secret ADMIN_PASSWORD "$ADMIN_PASSWORD"

echo
echo 'Repository variables (нужны job build-push):'
set_repo_variable PUBLIC_ORIGIN "$PUBLIC_ORIGIN"
set_repo_variable AUTH_ENABLED "$AUTH_ENABLED"
set_repo_variable MEDIA_PUBLIC_BASE_URL "$MEDIA_PUBLIC_BASE_URL"

echo
echo 'Environment variables:'
set_env_variable ADMIN_EMAIL "$ADMIN_EMAIL"
set_env_variable DEPLOY_PATH "$DEPLOY_PATH"
set_env_variable DEPLOY_USER "$DEPLOY_USER"
set_env_variable HEALTH_ORIGIN "$HEALTH_ORIGIN"

if [ ${#skipped[@]} -gt 0 ]; then
  echo
  echo 'Пропущено (пустое значение):'
  for item in "${skipped[@]}"; do echo "  – $item"; done
fi

echo
echo 'Проверить результат:'
echo "  gh secret list --repo $REPO --env $ENVIRONMENT"
echo "  gh variable list --repo $REPO --env $ENVIRONMENT"
echo "  gh variable list --repo $REPO"
echo
echo 'Секреты базы (POSTGRES_PASSWORD, JWT_SECRET, MEILI_MASTER_KEY, TOTP_ENC_KEY,'
echo 'GRAFANA_ADMIN_PASSWORD) сюда добавлять НЕ нужно — provision генерирует их на сервере.'
