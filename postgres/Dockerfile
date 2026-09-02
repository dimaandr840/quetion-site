# Образ БД с pgBackRest внутри.
#
# pgbackrest обязан быть в том же контейнере, что и PostgreSQL: archive_command
# выполняет сама база, и бинарник ей нужен локально.
#
# bookworm, а не alpine: в Debian pgbackrest лежит в основном репозитории и его
# версия прибита к релизу дистрибутива. В alpine пакет живёт в community и может
# обновиться при очередной сборке, разъехавшись с форматом репозитория бэкапов —
# такое выясняется ровно в момент аварии.
FROM postgres:16-bookworm

RUN set -eux; \
	apt-get update; \
	apt-get install -y --no-install-recommends \
		pgbackrest \
		ca-certificates \
		curl \
		jq; \
	rm -rf /var/lib/apt/lists/*; \
	pgbackrest version

# Каталоги создаём заранее и с владельцем postgres: именно эти права
# наследуют named volumes при первом монтировании, иначе сайдкар под uid
# postgres не сможет в них писать.
RUN set -eux; \
	install -d -o postgres -g postgres -m 0750 \
		/var/log/pgbackrest \
		/var/spool/pgbackrest \
		/var/lib/backup-state \
		/var/tmp/verify \
		/etc/pgbackrest
