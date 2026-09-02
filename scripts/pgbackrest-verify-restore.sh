#!/usr/bin/env bash
# Автоматическая проверка восстановления: разворачиваем последний бэкап в
# одноразовый каталог, поднимаем второй экземпляр PostgreSQL на порту 5433,
# гоняем smoke-запросы по реальным таблицам и гасим.
#
#   docker compose exec pgbackrest bash /opt/backup/pgbackrest-verify-restore.sh
#
# Смысл: бэкап, который никто не восстанавливал, не считается работающим.
# Проверяем не факт старта БД, а то, что в ней есть контент и целостные связи.

set -Eeuo pipefail

LOG_TAG=verify
# shellcheck source=/dev/null
source "$(dirname "${BASH_SOURCE[0]}")/backup-lib.sh"

VERIFY_ROOT="${BACKUP_VERIFY_ROOT:-/var/tmp/verify}"
VERIFY_DATA="$VERIFY_ROOT/data"
VERIFY_PORT="${BACKUP_VERIFY_PORT:-5433}"
STATE_DIR="${BACKUP_STATE_DIR:-/var/lib/backup-state}"
LIVE_PGDATA="${PGBACKREST_PG1_PATH:-/var/lib/postgresql/data}"

# Защита от самого дорогого сценария: восстановление поверх боевого PGDATA.
if [ "$(readlink -m "$VERIFY_DATA")" = "$(readlink -m "$LIVE_PGDATA")" ]; then
	err "каталог проверки совпадает с боевым PGDATA ($LIVE_PGDATA) — отказ"
	exit 2
fi

cleanup() {
	if [ -d "$VERIFY_DATA" ] && pg_ctl --pgdata "$VERIFY_DATA" status >/dev/null 2>&1; then
		pg_ctl --pgdata "$VERIFY_DATA" --mode immediate --silent stop >/dev/null 2>&1 || true
	fi
	rm -rf "$VERIFY_DATA"
}
trap cleanup EXIT

log "очищаю $VERIFY_DATA"
rm -rf "$VERIFY_DATA"
mkdir -p "$VERIFY_DATA" "$STATE_DIR"
chmod 700 "$VERIFY_DATA"

log "восстанавливаю последний бэкап в $VERIFY_DATA"
# --type=immediate: остановиться сразу по достижении согласованного состояния.
# --archive-mode=off: копия не должна писать свои WAL в боевой репозиторий.
if ! pgbackrest \
	--stanza="$STANZA" \
	--pg1-path="$VERIFY_DATA" \
	--type=immediate \
	--target-action=promote \
	--archive-mode=off \
	restore; then
	alert "проверка восстановления: pgbackrest restore упал" "stanza=$STANZA"
	exit 1
fi

log "запускаю временный PostgreSQL на порту $VERIFY_PORT"
if ! pg_ctl \
	--pgdata "$VERIFY_DATA" \
	--log "$VERIFY_ROOT/postgres.log" \
	--options "-p $VERIFY_PORT -k $VERIFY_ROOT -c listen_addresses='' -c archive_mode=off" \
	--timeout 300 \
	--wait \
	start; then
	alert "проверка восстановления: восстановленная БД не стартовала" "$(tail -n 10 "$VERIFY_ROOT/postgres.log" 2>/dev/null | tr '\n' ' ')"
	exit 1
fi

psql_verify() {
	psql \
		--host "$VERIFY_ROOT" \
		--port "$VERIFY_PORT" \
		--username "${PGBACKREST_PG1_USER:-postgres}" \
		--dbname "${PGBACKREST_PG1_DATABASE:-postgres}" \
		--no-psqlrc --quiet --no-align --tuples-only \
		--command "$1"
}

failures=0

# Не меньше чем N строк в ключевых таблицах. Имена взяты из liquibase-чейнжлога
# (backend/src/main/resources/db/changelog/changes).
expect_rows() {
	local table="$1" min="$2" actual
	if ! actual=$(psql_verify "SELECT count(*) FROM $table;" 2>/dev/null); then
		err "таблица $table недоступна"
		failures=$((failures + 1))
		return
	fi
	if [ "${actual:-0}" -lt "$min" ]; then
		err "таблица $table: строк $actual, ожидалось не меньше $min"
		failures=$((failures + 1))
	else
		log "таблица $table: строк $actual"
	fi
}

# expect_zero <описание> <SQL, возвращающий одно число>
expect_zero() {
	local what="$1" sql="$2" actual
	if ! actual=$(psql_verify "$sql" 2>/dev/null); then
		err "проверка не выполнилась: $what"
		failures=$((failures + 1))
		return
	fi
	if [ "${actual:-1}" -ne 0 ]; then
		err "$what: найдено $actual нарушений"
		failures=$((failures + 1))
	else
		log "$what: ок"
	fi
}

expect_rows profession "${VERIFY_MIN_PROFESSION:-1}"
expect_rows category "${VERIFY_MIN_CATEGORY:-1}"
expect_rows question "${VERIFY_MIN_QUESTION:-1}"
expect_rows answer_section "${VERIFY_MIN_ANSWER_SECTION:-1}"
expect_rows app_user "${VERIFY_MIN_APP_USER:-1}"

# Без админа восстановленная база бесполезна: войти будет некем.
expect_zero "есть хотя бы один ADMIN" \
	"SELECT CASE WHEN count(*) > 0 THEN 0 ELSE 1 END FROM app_user_role WHERE role = 'ADMIN';"

# Целостность связей: битые FK означают, что восстановление частичное.
expect_zero "вопросы без профессии" \
	"SELECT count(*) FROM question q LEFT JOIN profession p ON p.id = q.profession_id WHERE p.id IS NULL;"
expect_zero "вопросы без категории" \
	"SELECT count(*) FROM question q LEFT JOIN category c ON c.id = q.category_id WHERE c.id IS NULL;"
expect_zero "блоки ответа без вопроса" \
	"SELECT count(*) FROM answer_section a LEFT JOIN question q ON q.id = a.question_id WHERE q.id IS NULL;"

# Свежесть данных: если самая свежая запись старше порога, вероятно
# восстановился старый бэкап, а новые не приезжают.
freshness_days="${VERIFY_MAX_DATA_AGE_DAYS:-0}"
if [ "$freshness_days" -gt 0 ]; then
	expect_zero "свежесть question.updated_at" \
		"SELECT CASE WHEN max(updated_at) > now() - interval '$freshness_days days' THEN 0 ELSE 1 END FROM question;"
fi

log "гашу временный PostgreSQL"
pg_ctl --pgdata "$VERIFY_DATA" --mode fast --silent --wait stop || true

if [ "$failures" -gt 0 ]; then
	alert "проверка восстановления провалена" "неудавшихся проверок: $failures"
	exit 1
fi

date -Is >"$STATE_DIR/last-verify-ok"
log "бэкап успешно восстановлен и проверен"
