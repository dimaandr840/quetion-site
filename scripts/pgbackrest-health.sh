#!/usr/bin/env bash
# Проверка здоровья бэкапов. Запускается шедулером после каждого бэкапа
# и вручную:
#
#   docker compose exec pgbackrest bash /opt/backup/pgbackrest-health.sh
#
# Код возврата 0 — всё в норме, 1 — есть проблемы (каждая уже заалертена).
#
# Отвечает на вопрос "бэкап жив?", а не "крон отработал?": тихая смерть
# архивации WAL и устаревшие бэкапы — две главные причины, по которым
# "у нас есть бэкапы" оказывается неправдой.

set -Eeuo pipefail

LOG_TAG=health
# shellcheck source=/dev/null
source "$(dirname "${BASH_SOURCE[0]}")/backup-lib.sh"

MAX_AGE_HOURS="${BACKUP_MAX_AGE_HOURS:-30}"
WAL_MAX_AGE_MINUTES="${BACKUP_WAL_MAX_AGE_MINUTES:-15}"
PGWAL_MAX_MB="${BACKUP_PGWAL_MAX_MB:-4096}"
PGDATA_PATH="${PGBACKREST_PG1_PATH:-/var/lib/postgresql/data}"

problems=0

fail() {
	problems=$((problems + 1))
	alert "$1" "${2:-}"
}

# 1. pgbackrest check — сквозная проверка: конфиг, доступ к репозиторию и
# реальный прогон archive-push тестового WAL туда и обратно.
if check_output=$(pgbackrest --stanza="$STANZA" check 2>&1); then
	log "pgbackrest check: ok"
else
	fail "pgbackrest check провалился" "$(printf '%s' "$check_output" | tail -n 5 | tr '\n' ' ')"
fi

# 2. Возраст последнего бэкапа любого типа.
if last_stop=$(last_backup_stop any) && [ -n "$last_stop" ]; then
	age_hours=$(( ( $(date +%s) - last_stop ) / 3600 ))
	if [ "$age_hours" -gt "$MAX_AGE_HOURS" ]; then
		fail "последний бэкап старше допустимого" "возраст ${age_hours}ч, порог ${MAX_AGE_HOURS}ч"
	else
		log "последний бэкап: ${age_hours}ч назад (порог ${MAX_AGE_HOURS}ч)"
	fi
else
	fail "в репозитории нет ни одного бэкапа" "stanza=$STANZA"
fi

# 3. Архивация WAL по данным самой БД. Здесь живёт RPO: если WAL не уезжают,
# полные бэкапы могут быть свежими, а PITR всё равно сломан.
if archiver=$(psql_main "
	SELECT
		coalesce(extract(epoch FROM (now() - last_archived_time))::bigint, -1),
		failed_count,
		coalesce(to_char(last_failed_time, 'YYYY-MM-DD HH24:MI:SSOF'), 'never')
	FROM pg_stat_archiver;" 2>/dev/null); then
	IFS='|' read -r archived_age failed_count last_failed <<<"$archiver"

	if [ "${archived_age:--1}" -lt 0 ]; then
		fail "WAL ни разу не архивировался" "pg_stat_archiver.last_archived_time пустой"
	elif [ "$archived_age" -gt $(( WAL_MAX_AGE_MINUTES * 60 )) ]; then
		fail "WAL не архивируется" "последний успешный push $((archived_age / 60)) мин назад, порог ${WAL_MAX_AGE_MINUTES} мин"
	else
		log "WAL архивация: последний push $((archived_age / 60)) мин назад"
	fi

	if [ "${failed_count:-0}" -gt 0 ]; then
		log "внимание: failed_count=$failed_count, последний сбой $last_failed"
	fi
else
	fail "не удалось прочитать pg_stat_archiver" "psql не ответил"
fi

# 4. Размер pg_wal. Главный новый риск от archive_mode=on: если archive_command
# не работает, PostgreSQL копит WAL до заполнения диска и встаёт.
# Лучше узнать про это на 4 ГБ, чем по алерту "сайт лежит".
if [ -d "$PGDATA_PATH/pg_wal" ]; then
	pgwal_mb=$(du -sm "$PGDATA_PATH/pg_wal" 2>/dev/null | cut -f1)
	if [ -n "${pgwal_mb:-}" ] && [ "$pgwal_mb" -gt "$PGWAL_MAX_MB" ]; then
		fail "pg_wal разрастается" "${pgwal_mb} МБ > порога ${PGWAL_MAX_MB} МБ; вероятно archive_command не отрабатывает"
	else
		log "pg_wal: ${pgwal_mb:-?} МБ (порог ${PGWAL_MAX_MB} МБ)"
	fi
fi

# 5. Возраст последней успешной проверки восстановления. Непроверенный
# бэкап — не бэкап, поэтому старение проверки тоже алерт.
verify_stamp="${BACKUP_STATE_DIR:-/var/lib/backup-state}/last-verify-ok"
verify_max_days=$(( ${BACKUP_VERIFY_INTERVAL_DAYS:-7} * 2 ))
if [ -f "$verify_stamp" ]; then
	verify_age_days=$(( ( $(date +%s) - $(stat -c %Y "$verify_stamp") ) / 86400 ))
	if [ "$verify_age_days" -gt "$verify_max_days" ]; then
		fail "давно не проверялось восстановление" "последняя успешная проверка ${verify_age_days} дн. назад"
	else
		log "проверка восстановления: ${verify_age_days} дн. назад"
	fi
else
	log "проверка восстановления ещё не выполнялась"
fi

if [ "$problems" -gt 0 ]; then
	err "проблем: $problems"
	exit 1
fi

log "все проверки пройдены"
