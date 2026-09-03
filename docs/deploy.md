# Деплой на LuxVPS

Сервер настраивается и обновляется из GitHub Actions. Руками по SSH ходить не нужно
ни для первого запуска, ни для выкатов, ни для HTTPS.

## Два workflow

| Workflow | Когда | Что делает |
|---|---|---|
| **Provision — LuxVPS** | вручную, обычно один раз | пакеты, swap, ufw, Docker, пользователь `deploy`, клон репо, генерация `.env`, первый запуск, сертификат Let’s Encrypt и таймер автопродления |
| **Deploy — LuxVPS** | каждый push в `main` | сборка образов → GHCR → `pull` и `up -d` на сервере → health check → автооткат при падении |

## Что нужно сделать руками (один раз, ~5 минут)

1. Создать VPS на LuxVPS: Ubuntu 22.04/24.04, минимум 2 vCPU / 4 GB RAM / 40 GB.
2. Направить A-запись домена на IP сервера (без этого Let’s Encrypt не выдаст сертификат).
3. Добавить секреты в GitHub: Settings → Secrets and variables → Actions.

### Минимальный набор секретов

| Имя | Обязательно | Зачем |
|---|---|---|
| `LUXVPS_HOST` | да | IP сервера |
| `LUXVPS_ROOT_PASSWORD` | да, если нет ключа | root-пароль из письма LuxVPS |
| `LUXVPS_SSH_KEY` | альтернатива паролю | приватный SSH-ключ |
| `LUXVPS_PORT` | нет | если SSH не на 22 |
| `GHCR_PULL_TOKEN` | нет | PAT с `read:packages`; не нужен, если пакеты GHCR публичные |
| `ADMIN_PASSWORD` | нет | если не задан — генерируется и ложится в `/root/qareerquest-admin-password.txt` |

### Переменные (Variables)

| Имя | Значение |
|---|---|
| `PUBLIC_ORIGIN` | `https://qareerquest.com` — вшивается в клиентский бандл при сборке |
| `MEDIA_PUBLIC_BASE_URL` | публичный домен R2 |
| `AUTH_ENABLED` | `true` |
| `ADMIN_EMAIL` | почта первого админа |
| `DEPLOY_PATH` | по умолчанию `/opt/quetion-site` |
| `HEALTH_URL` | по умолчанию `http://127.0.0.1/api/actuator/health` |

## Запуск

1. Actions → **Provision — LuxVPS** → Run workflow. Указать домен и e-mail для Let’s Encrypt.
   Первый запуск собирает образы на сервере (в GHCR ещё пусто) — это 10–20 минут.
2. Дальше ничего делать не надо: каждый push в `main` сам собирает и выкатывает.

Повторный запуск provision безопасен: пароли в `.env` не перегенерируются, база не трогается.

## Как устроен HTTPS

`nginx.conf` не редактируется. `scripts/render-nginx-conf.sh` генерирует `nginx.effective.conf`
с двумя include, а `scripts/setup-tls.sh` кладёт туда:

- `nginx/tls/tls.conf` — `server { listen 443 ssl; }` с HSTS и теми же location, что на 80;
- `nginx/tls/redirect/redirect.conf` — редирект 80→443, кроме ACME-челленджа.

Пока сертификата нет, оба каталога пусты и сайт работает по http — локальная разработка
через базовый `docker-compose.yml` ничего не замечает.

Продление — systemd-таймер `qareerquest-tls-renew.timer` два раза в сутки
(`scripts/renew-tls.sh` → `certbot renew` + `nginx -s reload`).

## Откат

Actions → **Deploy — LuxVPS** → Run workflow → `image_tag