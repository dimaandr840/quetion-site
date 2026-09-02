#!/usr/bin/env bash
# Разовый бэкап PostgreSQL из compose-стека devprep.
#
# Запуск с хоста, где поднят стек:
#   ./scripts/backup-db.sh
#
# Дамп кладётся в BACKUP_DIR (по умолчанию ./backups) под именем
# <db>-YYYYmmdd-HHMMSS.dump. Файлы старше BACKUP_RETENTION_DAYS удаляются.
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# .env читаем сами, чтобы не дублировать пароль и имена БД в двух местах.
if [[ -f .env ]]; then
	set -a
	# shellcheck disable=SC1091
	source .env
	set +a
fi

POSTGRES_DB="${POSTGRES_DB:-devprep}"
POSTGRES_USER="${POSTGRES_USER:-devprep}"
BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/backups}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"

mkdir -p "$BACKUP_DIR"
# В дампе лежат хеши паролей и зашифрованные TOTP-секреты, поэтому каталог
# закрыт от других пользователей хоста.
chmod 700 "$BACKUP_DIR"

STAMP="$(date +%Y%m%d-%H%M%S)"
TARGET="$BACKUP_DIR/${POSTGRES_DB}-${STAMP}.dump"

# -Fc (custom) вместо plain SQL: pg_restore умеет восстанавливать выборочно,
# и данные сжимаются без внешнего gzip.
# Пишем в .part и переименовываем в конце — прерванный дамп не будет выглядеть
# как готовый к восстановлению.
docker compose exec -T postgres \
	pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc --clean --if-exists >"$TARGET.part"

mv "$TARGET.part" "$TARGET"
chmod 600 "$TARGET"

echo "Бэкап готов: $TARGET ($(du -h "$TARGET" | cut -f1))"

if [[ "$BACKUP_RETENTION_DAYS" -gt 0 ]]; then
	find "$BACKUP_DIR" -maxdepth 1 -name "${POSTGRES_DB}-*.dump" \
		-mtime "+$BACKUP_RETENTION_DAYS" -print -delete
fi
