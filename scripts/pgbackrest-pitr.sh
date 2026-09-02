#!/usr/bin/env bash
# Восстановление боевой БД на точку во времени (PITR). Запускать НА ХОСТЕ,
# из корня репозитория, рядом с docker-compose.yml.
#
#   ./scripts/pgbackrest-pitr.sh '2026-09-02 18:30:00+03'
#   ./scripts/pgbackrest-pitr.sh latest
#
# СКРИПТ РАЗРУШАЕТ ТЕКУЩИЕ ДАННЫЕ: он замещает содержимое volume
# postgres-data состоянием из бэкапа. Всё, что произошло после указанной точки,
# будет потеряно. Сначала проверьте целевую точку на копии:
# scripts/pgbackrest-verify-restore.sh поднимает бэкап, не трогая боевую базу.

set -Eeuo pipefail

TARGET="${1:-}"
STANZA="${PGBACKREST_STANZA:-devprep}"
COMPOSE_FILES=(-f docker-compose.yml -f docker-compose.backup.yml)

if [ -z "$TARGET" ]; then
	cat >&2 <<'USAGE'
Использование:
  ./scripts/pgbackrest-pitr.sh '<YYYY-MM-DD HH:MM:SS+TZ>'   — восстановить на момент времени
  ./scripts/pgbackrest-pitr.sh latest                        — восстановить максимально возможное

Переменные: FORCE=true пропускает подтверждение (только для автоматизации).
USAGE
	exit 2
fi

if [ ! -f docker-compose.yml ]; then
	echo "Ошибка: запускайте скрипт из корня репозитория" >&2
	exit 2
fi

if [ "${FORCE:-false}" != "true" ]; then
	echo "Внимание: текущее содержимое БД будет замещено состоянием на: $TARGET"
	echo "Сервисы api и web будут остановлены на время восстановления."
	printf 'Напишите "restore" для продолжения: '
	read -r answer
	if [ "$answer" != "restore" ]; then
		echo "Отменено."
		exit 1
	fi
fi

restore_args=(--stanza="$STANZA" --delta --target-action=promote)
if [ "$TARGET" = "latest" ]; then
	restore_args+=(--type=default)
else
	restore_args+=(--type=time --target="$TARGET")
fi

echo "==> останавливаю приложение и базу"
# api и web гасим до БД, иначе они будут писать в базу, которую мы замещаем.
docker compose "${COMPOSE_FILES[@]}" stop api web pgbackrest
docker compose "${COMPOSE_FILES[@]}" stop postgres

echo "==> восстанавливаю: ${restore_args[*]}"
# Одноразовый контейнер с тем же volume PGDATA; сама БД в этот момент лежит.
docker compose "${COMPOSE_FILES[@]}" run --rm --no-deps \
	--entrypoint pgbackrest pgbackrest "${restore_args[@]}" restore

echo "==> поднимаю базу (идёт проигрывание WAL, может занять время)"
docker compose "${COMPOSE_FILES[@]}" up -d postgres

echo "==> жду завершения восстановления"
for _ in $(seq 1 120); do
	if docker compose "${COMPOSE_FILES[@]}" exec -T postgres \
		psql -U "${POSTGRES_USER:-devprep}" -d "${POSTGRES_DB:-devprep}" -tAc 'SELECT pg_is_in_recovery();' 2>/dev/null \
		| grep -qx 'f'; then
		echo "БД вышла из recovery и принимает запись"
		break
	fi
	sleep 5
done

echo "==> запускаю приложение и шедулер бэкапов"
docker compose "${COMPOSE_FILES[@]}" up -d

cat <<'NEXT'

Готово. Обязательные шаги после PITR:
  1. Проверьте данные в приложении (вопросы, пользователи, админ-доступ).
  2. После promote началась новая ветка WAL (timeline). Сделайте полный бэкап:
     docker compose exec pgbackrest pgbackrest --stanza=devprep --type=full backup
  3. Проверьте здоровье: docker compose exec pgbackrest bash /opt/backup/pgbackrest-health.sh
  4. Медиа в R2 не откатываются вместе с БД: возможны ссылки на файлы, которых
     ещё нет, или осиротевшие файлы — см. docs/media.md.
NEXT
