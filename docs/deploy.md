# Деплой на LuxVPS

Сервер настраивается и обновляется из GitHub Actions. Руками по SSH ходить не нужно
ни для первого запуска, ни для выкатов, ни для HTTPS.

## Два workflow

| Workflow | Когда | Что делает |
|---|---|---|
| **Provision — LuxVPS** | вручную, обычно один раз | пакеты, swap, ufw, Docker, пользователь `deploy`, клон репо, генерация `.env`, первый запуск, сертификат Let’s Encrypt и таймер автопродления |
| **Deploy — LuxVPS** | каждый push в `main` | сборка образов → GHCR → `pull` и `up -d` на сервере → health check → автооткат при падении |

Сборка идёт только в CI: Spring Boot и Next.js собираются в Actions, пушатся в GHCR,
а VPS только тянет готовые образы. Сборка на сервере съедает память и роняет живой сайт.

## Что нужно сделать руками (один раз, ~5 минут)

1. Создать VPS на LuxVPS: Ubuntu 22.04/24.04, минимум 2 vCPU / 4 GB RAM / 40 GB.
2. Направить A-запись домена на IP сервера (без этого Let’s Encrypt не выдаст сертификат).
3. Добавить секреты и переменные: Settings → Secrets and variables → Actions.

Больше ничего вручную не требуется: ни `apt install`, ни `docker`, ни `git clone`, ни `.env`, ни certbot.

### Минимальный набор секретов

| Имя | Обязательно | Зачем |
|---|---|---|
| `LUXVPS_HOST` | да | IP сервера |
| `LUXVPS_ROOT_PASSWORD` | да, если нет ключа | root-пароль из письма LuxVPS |
| `LUXVPS_SSH_KEY` | альтернатива паролю | приватный SSH-ключ целиком, вместе со строками BEGIN/END |
| `LUXVPS_PORT` | нет | если SSH не на порту 22 |
| `GHCR_PULL_TOKEN` | нет | PAT с `read:packages`; не нужен, если пакеты GHCR публичные |
| `ADMIN_PASSWORD` | нет | если не задан — генерируется и ложится в `/root/qareerquest-admin-password.txt` |

Пароли базы, `JWT_SECRET`, `MEILI_MASTER_KEY` и `TOTP_ENC_KEY` в GitHub не нужны:
provision генерирует их на сервере через `openssl rand` и больше не трогает.

### Переменные (Variables)

| Имя | Значение |
|---|---|
| `PUBLIC_ORIGIN` | `https://qareerquest.com` — вшивается в клиентский бандл при сборке |
| `MEDIA_PUBLIC_BASE_URL` | публичный домен хранилища картинок |
| `AUTH_ENABLED` | `true` |
| `ADMIN_EMAIL` | почта первого админа |
| `DEPLOY_PATH` | необязательно, по умолчанию `/opt/quetion-site` |
| `DEPLOY_USER` | необязательно, по умолчанию `deploy` |
| `HEALTH_URL` | необязательно, по умолчанию `http://127.0.0.1/api/actuator/health` |

## Запуск

1. Actions → **Provision — LuxVPS** → Run workflow. Указать домен и e-mail для Let’s Encrypt,
   ветку оставить `main` (или указать тестовую до мержа).
   Первый запуск собирает образы на сервере, потому что в GHCR ещё пусто — 10–20 минут.
2. Дальше ничего делать не надо: каждый push в `main` сам собирает, пушит и выкатывает.

Повторный запуск provision безопасен и идемпотентен: пароли в `.env` не перегенерируются,
база и тома не трогаются, сертификат перевыпускается только при необходимости
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

## Откат

Actions → **Deploy — LuxVPS** → Run workflow → поле `image_tag` = short SHA рабочего релиза.
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

## Известные ограничения

- Требуется Docker Compose v2.24+ — из-за `!reset` в `docker-compose.images.yml`.
  Скрипт установки Docker с get.docker.com ставит актуальную версию.
- Автооткат опирается на имена контейнеров `devprep-api-1` / `devprep-web-1`
  (имя проекта `devprep` из `docker-compose.yml`).
- Сертификат выпускается только на указанный домен без `www`.
  Для второго имени нужно добавить ещё один `-d` в `scripts/setup-tls.sh`.
- Первичный provision подключается под root. Если root-доступ закрыт,
  задай `LUXVPS_ROOT_USER` с sudo-правами и запускай скрипт через sudo.
