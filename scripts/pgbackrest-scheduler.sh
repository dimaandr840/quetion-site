#!/usr/bin/env bash
# Шедулер бэкапов — entrypoint сайдкара pgbackrest из docker-compose.backup.yml.
#
# Цикл в shell, а не cron: в контейнере у cron нет окружения и логи уезжают
# в никуда, а здесь всё падает в docker logs с ротацией из x-hardening.

set -Eeuo pipefail

LOG_TAG=scheduler
# shellcheck source=/dev/null
source "$(dirname "${BASH_SOURCE[0]}")/backup-lib.sh"

SCRIPT_DIR="$(dirname "${BASH_SOURCE[0]}")"
TICK_SECONDS="${BACKUP_TICK_SECONDS:-86400}"
INITIAL_DELAY="${BACKUP_INITIAL_DELAY:-60}"
FULL_INTERVAL_DAYS="${BACKUP_FULL_INTERVAL_DAYS:-7}"
VERIFY_INTERVAL_DAYS="${BACKUP_VERIFY_INTERVAL_DAYS:-7}"
LOGICAL_INTERVAL_DAYS="${BACKUP_LOGICAL_INTERVAL_DAYS:-7}"
LOGICAL_DIR="${BACKUP_LOGICAL_DIR:-/backups}"
LOGICAL_KEEP="${BACKUP_LOGICAL_KEEP:-4}"
STATE_DIR="${BACKUP_STATE_DIR:-/var/lib/backup-state}"

mkdir -p "$STATE_DIR"

terminate() {
	log "получен сигнал остановки, выхожу"
	exit 0
}
trap terminate TERM INT

# Надо ли запускать задачу: due <имя-метки> <интервал-в-днях>
due() {
	local stamp="$STATE_DIR/$1" days="$2"
	[ "$days" -le 0 ] && return 1
	[ -f "$stamp" ] || return 0
	[ $(( $(date +%s) - $(stat -c %Y "$stamp") )) -ge $(( days * 86400 )) ]
}

mark_done() {
	date -Is >"$STATE_DIR/$1"
}

# Полный бэкап, если его вообще нет или он старше FULL_INTERVAL_DAYS, иначе
# разностный. diff вместо incr сознательно: восстановление требует всего два
# набора (full + последний diff), а не цепочку из семи — меньше точек отказа и RTO.
choose_backup_type() {
	local last_full
	if ! last_full=$(last_backup_stop full) || [ -z "$last_full" ]; then
		printf 'full'
		return
	fi
	if [ $(( $(date +%s) - last_full )) -ge $(( FULL_INTERVAL_DAYS * 86400 )) ]; then
		printf 'full'
	else
		printf 'diff'
	fi
}

# Логический дамп — страховка от сценариев, где pgBackRest не поможет:
# повреждён сам репозиторий, нужна одна таблица, или переезд на другую
# мажорную версию PostgreSQL (физический бэкап между мажорками не переносится).
logical_dump() {
	local file="$LOGICAL_DIR/${PGBACKREST_PG1_DATABASE:-postgres}-$(date -u +%Y%m%d-%H%M%S).dump"

	if [ ! -w "$LOGICAL_DIR" ]; then
		alert "каталог логических дампов недоступен для записи" "$LOGICAL_DIR"
		return 1
	fi

	log "логический дамп → $file"
	if pg_dump \
		--host "${PGBACKREST_PG1_SOCKET_PATH:-/var/run/postgresql}" \
		--port 5432 \
		--username "${PGBACKREST_PG1_USER:-postgres}" \
		--dbname "${PGBACKREST_PG1_DATABASE:-postgres}" \
		--format=custom --compress=9 --file "$file.part"; then
		mv "$file.part" "$file"
		# Ротация: держим последние LOGICAL_KEEP штук.
		find "$LOGICAL_DIR" -maxdepth 1 -name '*.dump' -type f -printf '%T@ %p\n' \
			| sort -rn \
			| tail -n "+$((LOGICAL_KEEP + 1))" \
			| cut -d' ' -f2- \
			| while read -r old; do
				log "удаляю старый дамп $old"
				rm -f "$old"
			done
	else
		rm -f "$file.part"
		alert "логический дамп не создан" "pg_dump вернул ошибку"
		return 1
	fi
}

log "старт; stanza=$STANZA, тик=${TICK_SECONDS}с, полный бэкап каждые ${FULL_INTERVAL_DAYS} дн."
sleep "$INITIAL_DELAY"
wait_for_postgres

# stanza-create идемпотентен; после апгрейда PostgreSQL нужен stanza-upgrade.
if ! pgbackrest --stanza="$STANZA" stanza-create; then
	log "stanza-create не прошёл, пробую stanza-upgrade"
	if ! pgbackrest --stanza="$STANZA" stanza-upgrade; then
		alert "не удалось создать или обновить stanza" "проверьте доступ к S3 и пароль шифрования"
		exit 1
	fi
fi

while true; do
	backup_type=$(choose_backup_type)
	log "запускаю бэкап --type=$backup_type"

	if pgbackrest --stanza="$STANZA" --type="$backup_type" backup; then
		log "бэкап $backup_type завершён"
	else
		alert "бэкап провалился" "type=$backup_type, stanza=$STANZA; см. docker compose logs pgbackrest"
	fi

	# Проверка здоровья сама алертит, поэтому её код возврата гасим.
	bash "$SCRIPT_DIR/pgbackrest-health.sh" || true

	if due last-verify-attempt "$VERIFY_INTERVAL_DAYS"; then
		mark_done last-verify-attempt
		log "плановая проверка восстановления"
		bash "$SCRIPT_DIR/pgbackrest-verify-restore.sh" || true
	fi

	if due last-logical-dump "$LOGICAL_INTERVAL_DAYS"; then
		mark_done last-logical-dump
		logical_dump || true
	fi

	log "следующий цикл через ${TICK_SECONDS}с"
	sleep "$TICK_SECONDS" &
	wait $!
done
