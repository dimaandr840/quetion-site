#!/usr/bin/env bash
# Восстановление PostgreSQL из дампа, созданного scripts/backup-db.sh.
#
#   ./scripts/restore-db.sh backups/devprep-20260902-030000.dump
#   FORCE=true ./scripts/restore-db.sh <dump>   # без интерактивного подтверждения
#
# ВНИМАНИЕ: текущее содержимое базы заменяется данными из дампа.
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ -f .env ]]; then
	set -a
	# shellcheck disable=SC1091
	source .env
	set +a
fi

POSTGRES_DB="${POSTGRES_DB:-devprep}"
POSTGRES_USER="${POSTGRES_USER:-devprep}"

DUMP="${1:-}"
if [[ -z "$DUMP" ]]; then
	echo "Использование: $0 <путь к .dump>" >&2
	exit 2
fi
if [[ ! -f "$DUMP" ]]; then
	echo "Файл не найден: $DUMP" >&2
	exit 1
fi

if [[ "${FORCE:-false}" != "true" ]]; then
	read -r -p "Заменить содержимое базы '$POSTGRES_DB' данными из $DUMP? [y/N] " answer
	if [[ "$answer" != "y" && "$answer" != "Y" ]]; then
		echo "Отменено."
		exit 1
	fi
fi

# api и web останавливаем: открытые соединения и фоновые записи ломают
# pg_restore --clean: DROP не проходит из-за зависимостей и блокировок.
docker compose stop api web

# --single-transaction: при ошибке база останется в прежнем состоянии,
# а не в наполовину восстановленном.
docker compose exec -T postgres \
	pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
	--clean --if-exists --no-owner --no-privileges --single-transaction <"$DUMP"

docker compose start api web

echo "База восстановлена из $DUMP."
echo "Индекс Meilisearch пересобирается бэкендом; проверьте поиск после старта api."
