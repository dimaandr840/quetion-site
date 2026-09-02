#!/usr/bin/env bash
# Общие функции для скриптов бэкапов. Файл только для source, не для запуска.

STANZA="${PGBACKREST_STANZA:-devprep}"

log() {
	printf '%s [%s] %s\n' "$(date -Is)" "${LOG_TAG:-backup}" "$*"
}

err() {
	printf '%s [%s] ERROR %s\n' "$(date -Is)" "${LOG_TAG:-backup}" "$*" >&2
}

# alert <тема> <детали>
#
# Всегда пишет в stderr (попадает в docker logs → json-file), и дополнительно
# отправляет JSON на BACKUP_ALERT_WEBHOOK, если он задан.
#
# Сознательно не делаем интеграцию с конкретным Sentry/PagerDuty: половинчатая
# интеграция создаёт иллюзию оповещения. Вебхук — нейтральная точка ввода,
# её цепляют на Slack/Telegram/Alertmanager без правки кода (см. docs/backup.md).
alert() {
	local subject="$1"
	local detail="${2:-}"

	err "ALERT: ${subject}${detail:+ | }${detail}"

	if [ -z "${BACKUP_ALERT_WEBHOOK:-}" ]; then
		return 0
	fi

	local payload
	payload=$(jq -nc \
		--arg service "devprep-db-backup" \
		--arg stanza "$STANZA" \
		--arg severity "error" \
		--arg subject "$subject" \
		--arg detail "$detail" \
		--arg host "$(hostname)" \
		--arg ts "$(date -Is)" \
		'{service: $service, stanza: $stanza, severity: $severity, subject: $subject, detail: $detail, host: $host, timestamp: $ts, text: ($subject + " — " + $detail)}')

	# Неудавшаяся отправка алерта не должна ронять сам бэкап.
	if ! curl -fsS --max-time 10 \
		-X POST \
		-H 'Content-Type: application/json' \
		--data "$payload" \
		"$BACKUP_ALERT_WEBHOOK" >/dev/null; then
		err "не удалось отправить алерт на BACKUP_ALERT_WEBHOOK"
	fi
}

# Ждём готовность БД через unix-сокет (тот же путь, что у pgBackRest).
wait_for_postgres() {
	local socket_dir="${PGBACKREST_PG1_SOCKET_PATH:-/var/run/postgresql}"
	local user="${PGBACKREST_PG1_USER:-postgres}"
	local db="${PGBACKREST_PG1_DATABASE:-postgres}"
	local deadline=$(( $(date +%s) + ${WAIT_FOR_DB_TIMEOUT:-300} ))

	while ! pg_isready -h "$socket_dir" -p 5432 -U "$user" -d "$db" -q; do
		if [ "$(date +%s)" -ge "$deadline" ]; then
			err "PostgreSQL не ответил за ${WAIT_FOR_DB_TIMEOUT:-300}с по сокету $socket_dir"
			return 1
		fi
		sleep 2
	done
}

# psql в основную базу без лишнего вывода: psql_main <SQL>
psql_main() {
	psql \
		--host "${PGBACKREST_PG1_SOCKET_PATH:-/var/run/postgresql}" \
		--port 5432 \
		--username "${PGBACKREST_PG1_USER:-postgres}" \
		--dbname "${PGBACKREST_PG1_DATABASE:-postgres}" \
		--no-psqlrc --quiet --no-align --tuples-only \
		--command "$1"
}

# Время последнего успешного бэкапа заданного типа (unix timestamp) или пусто.
# last_backup_stop <full|diff|incr|any>
last_backup_stop() {
	local type_filter="$1"
	local info_json

	if ! info_json=$(pgbackrest --stanza="$STANZA" --output=json info 2>/dev/null); then
		return 1
	fi

	printf '%s' "$info_json" | jq -r --arg t "$type_filter" '
		(.[0].backup // [])
		| map(select($t == "any" or .type == $t))
		| (last.timestamp.stop // empty)
	'
}
