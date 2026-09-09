# Деплой на LuxVPS

Сервер настраивается и обновляется из GitHub Actions. Руками по SSH ходить не нужно
ни для первого запуска, ни для выкатов, ни для HTTPS.

Что именно заполнить перед первым деплоем — см. `docs/deploy-checklist.md`.

## Два workflow

| Workflow | Когда | Что делает |
|---|---|---|
| **Provision — LuxVPS** | вручную, обычно один раз | пакеты, swap, ufw, Docker, пользователь `deploy`, клон репо, генерация `.env`, первый запуск, сертификат Let’s Encrypt и таймер автопродления |
| **Deploy — LuxVPS** | автоматически после успешного CI на `main` | сборка образов → GHCR → `pull` и `up -d` на сервере → health check → автооткат при падении |

Выкат цепляется не на push, а на событие `workflow_run` от CI: если тесты упали,
деплоя не будет вообще.

Сборка идёт только в CI: Spring Boot и Next.js собираются в Actions, пушатся в GHCR,
а VPS только тянет готовые образы по digest. Сборка на сервере съедает память и роняет живой сайт.
Тега `:latest` в GHCR нет по умыслу: образы тегируются полным commit SHA, а запускаются
по digest, чтобы релиз был воспроизводим.

## Что нужно сделать руками (один раз, ~5 минут)

1. Создать VPS на LuxVPS: Ubuntu 22.04/24.04, минимум 2 vCPU / 4 GB RAM / 40 GB.
2. Направить A-запись домена на IP сервера (без этого Let’s Encrypt не выдаст сертификат).
3. Добавить секреты и переменные: Settings → Secrets and variables → Actions.

Больше ничего вручную не требуется: ни `apt install`, ни `docker`, ни `git clone`, ни `.env`, ни certbot.

### Минимальный набор секретов

| Имя | Обязательно | Зачем |
|---|---|---|
| `LUXVPS_HOST` | да | IP сервера |
| `LUXVPS_ROOT_PASSWORD` | для provision | root-пароль из письма LuxVPS |
| `LUXVPS_ROOT_USER` | нет | если root-логин закрыт и есть sudo-пользователь |
| `LUXVPS_USER` | после hardening | пользователь для выкатов, обычно `deploy` |
| `LUXVPS_SSH_KEY` | для выкатов | приватный SSH-ключ целиком, вместе со строками BEGIN/END |
| `LUXVPS_PORT` | нет | если SSH не на порту 22 |
| `GHCR_PULL_TOKEN` | нет | PAT с `read:packages`; не нужен, если пакеты GHCR публичные |
| `ADMIN_PASSWORD` | нет | если не задан — генерируется и ложится в `/root/qareerquest-admin-password.txt` |

Пароли базы, `JWT_SECRET`, `MEILI_MASTER_KEY`, `TOTP_ENC_KEY` и `GRAFANA_ADMIN_PASSWORD` в GitHub не нужны:
provision генерирует их на сервере через `openssl rand` и больше не трогает.

### Переменные (Variables)

| Имя | Значение |
|---|---|
| `PUBLIC_ORIGIN` | `https://qareerquest.com` — вшивается в клиентский бандл при сборке |
| `MEDIA_PUBLIC_BASE_URL` | публичный домен хранилища картинок (пусто, если медиа выключены) |
| `AUTH_ENABLED` | `true` |
| `ADMIN_EMAIL` | почта первого админа |
| `DEPLOY_PATH` | необязательно, по умолчанию `/opt/quetion-site` |
| `DEPLOY_USER` | необязательно, по умолчанию `deploy` |
| `HEALTH_ORIGIN` | необязательно, по умолчанию `http://127.0.0.1`; скрипт сам добавляет `/api/actuator/health`, `/` и `/search` |

## Запуск

1. Actions → **Provision — LuxVPS** → Run workflow. Указать домен и e-mail для Let’s Encrypt,
   ветку оставить `main` (или указать тестовую до мержа).
   Первый запуск собирает образы на сервере, потому что в GHCR ещё пусто — 10–20 минут.
2. Дальше ничего делать не надо: каждый зелёный CI на `main` сам собирает, пушит и выкатывает.

Повторный запуск provision безопасен и идемпотентен: пароли в `.env` не перегенерируются,
база и тома не трогаются, а сервисы поднимаются из последнего записанного релиза
(`.releases/current`), а не пересобираются. Сертификат перевыпускается только при необходимости
(`--keep-until-expiring`).

## Как устроен HTTPS

`nginx/nginx.conf` не редактируется. `scripts/render-nginx-conf.sh` генерирует
`nginx/nginx.effective.conf` с двумя include, а `scripts/setup-tls.sh` кладёт туда:

- `nginx/tls/tls.conf` — `server { listen 443 ssl; }` с HSTS и теми же location, что на 80;
- `nginx/tls/redirect/redirect.conf` — редирект 80→443, кроме ACME-челленджа.

Пока сертификата нет, оба каталога пусты и сайт работает по http, а локальная разработка
через базовый `docker-compose.yml` вообще не замечает этой механики.

Продление — systemd-таймер `qareerquest-tls-renew.timer` два раза в сутки:
`scripts/renew-tls.sh` запускает `certbot renew` и делает `nginx -s reload`.

Проверить таймер: `systemctl list-timers qareerquest-tls-renew.timer`.
За сроком жизни сертификата также следит алерт `TlsCertExpiringSoon` (см. `docs/observability.md`).

## Откат

Actions → **Deploy — LuxVPS** → Run workflow → поле `image_tag` = полный commit SHA (40 символов)
работавшего релиза. Список доступных релизов лежит на сервере:
`ls /opt/quetion-site/.releases` (текущий — в `.releases/current`).
Если health check после выката не прошёл, деплой сам поднимает предыдущие образы
и выводит последние 200 строк логов `api` и `web`.

⚠️ Откат образа не откатывает схему БД: Liquibase-миграции применяются при старте `api`.
Перед ломающими миграциями снимай бэкап: `scripts/backup-db.sh` (см. `docs/backup.md`).

## Файлы

| Файл | Роль |
|---|---|
| `.github/workflows/provision.yml` | первичная настройка сервера |
| `.github/workflows/deploy.yml` | сборка в GHCR и выкат |
| `scripts/provision-server.sh` | идемпотентный bootstrap VPS |
| `scripts/setup-tls.sh` | выпуск сертификата и включение 443 |
| `scripts/renew-tls.sh` | продление сертификата по таймеру |
| `scripts/render-nginx-conf.sh` | генерация `nginx.effective.conf` |
| `docker-compose.prod.yml` | тома nginx и TLS |
| `docker-compose.images.yml` | готовые образы из GHCR вместо сборки |
| `docker-compose.observability.yml` | мониторинг нагрузки и доступности |
| `docs/deploy-checklist.md` | что заполнить перед деплоем |

## Известные ограничения

- Требуется Docker Compose v2.24+ — из-за `!reset` в `docker-compose.images.yml`.
  Скрипт установки Docker с get.docker.com ставит актуальную версию.
- Автооткат опирается на имена контейнеров `devprep-api-1` / `devprep-web-1`
  (имя проекта `devprep` из `docker-compose.yml`).
- Сертификат выпускается только на указанный домен без `www`.
  Для второго имени нужно добавить ещё один `-d` в `scripts/setup-tls.sh`.
- Первичный provision подключается под root. Если root-доступ закрыт,
  задай `LUXVPS_ROOT_USER` с sudo-правами и запускай скрипт через sudo.
- Саморазмещённый мониторинг не увидит полное падение VPS — нужен внешний
  uptime-чекер (UptimeRobot, Better Stack, healthchecks.io).
