# Чек-лист: что заполнить для деплоя на VPS

Всё, что нельзя зашить в репозиторий и что нужно ввести руками один раз.

## 1. Сервер и DNS

- [ ] VPS: Ubuntu 22.04 или 24.04, минимум 2 vCPU / 4 GB RAM / 40 GB SSD.
      С мониторингом и Meilisearch комфортно с 4 vCPU / 8 GB.
- [ ] A-запись `qareerquest.com` → IP сервера (и `www`, если нужно).
- [ ] Открыты порты 22, 80, 443 (ufw настраивает provision, но внешний firewall панели — ваш.)

## 2. GitHub → Settings → Secrets and variables → Actions

### Secrets

| Имя | Значение | Обязательно |
|---|---|---|
| `LUXVPS_HOST` | IP сервера | да |
| `LUXVPS_ROOT_PASSWORD` | root-пароль из письма LuxVPS | для Provision |
| `LUXVPS_ROOT_USER` | если вход не под `root` | нет |
| `LUXVPS_USER` | `deploy` | для Deploy после hardening |
| `LUXVPS_SSH_KEY` | приватный ключ целиком (`-----BEGIN ... END-----`) | для Deploy |
| `LUXVPS_PORT` | нестандартный SSH-порт | нет |
| `GHCR_PULL_TOKEN` | PAT с `read:packages` | если пакеты GHCR приватные |
| `ADMIN_PASSWORD` | пароль первого админа | нет, иначе сгенерируется |

### Variables

| Имя | Значение |
|---|---|
| `PUBLIC_ORIGIN` | `https://qareerquest.com` |
| `AUTH_ENABLED` | `true` |
| `ADMIN_EMAIL` | почта админа |
| `MEDIA_PUBLIC_BASE_URL` | домен CDN/S3 для картинок (можно пустым) |
| `YANDEX_METRIKA_ID` | номер счётчика Яндекс Метрики (пусто = аналитики нет) |
| `DEPLOY_PATH` | `/opt/quetion-site` (по умолчанию) |
| `DEPLOY_USER` | `deploy` (по умолчанию) |
| `HEALTH_ORIGIN` | `http://127.0.0.1` (по умолчанию) |

## 3. Генерируется автоматически — вводить НЕ нужно

`POSTGRES_PASSWORD`, `JWT_SECRET`, `MEILI_MASTER_KEY`, `TOTP_ENC_KEY`,
`GRAFANA_ADMIN_PASSWORD` — provision создаёт их в `/opt/quetion-site/.env`
через `openssl rand` и при повторных запусках не меняет.

## 4. Файл `.env` на сервере — опциональные блоки

Заполнять только если нужна соответствующая функция (`nano /opt/quetion-site/.env`, затем `docker compose up -d`):

```env
# Почта: без неё не работает восстановление пароля и почтовые алерты
SMTP_HOST=
SMTP_PORT=587
SMTP_USERNAME=
SMTP_PASSWORD=
PASSWORD_RESET_MAIL_FROM=no-reply@qareerquest.com

# Картинки/вложения (S3-совместимое хранилище)
MEDIA_ENABLED=false
S3_ENDPOINT=
S3_BUCKET=
S3_ACCESS_KEY=
S3_SECRET_KEY=
S3_REGION=

# Яндекс Метрика. Значение читается на сборке образа web,
# поэтому после изменения нужен деплой (или up -d --build web).
# Скрипт грузится только после согласия посетителя (152-ФЗ).
YANDEX_METRIKA_ID=

# Ошибки в Sentry (необязательно)
SENTRY_DSN=

# Мониторинг и алерты
GRAFANA_ROOT_URL=http://localhost:3001
ALERT_TELEGRAM_CHAT_ID=
ALERT_MAIL_FROM=no-reply@qareerquest.com
ALERT_MAIL_TO=
```

Токен Telegram-бота кладётся файлом, а не переменной:

```bash
install -d -m 700 /opt/quetion-site/observability/alertmanager/secrets
printf '%s' '123456:AA...' > /opt/quetion-site/observability/alertmanager/secrets/telegram_bot_token
chmod 600 /opt/quetion-site/observability/alertmanager/secrets/telegram_bot_token
```

## 5. После первого запуска

- [ ] Проверить, что сайт отвечает по HTTPS и контейнеры healthy:

```bash
cd /opt/quetion-site
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps
curl -I https://qareerquest.com
curl -fsS https://qareerquest.com/api/actuator/health
```

- [ ] Забрать пароль админа из `/root/qareerquest-admin-password.txt` и удалить файл.
- [ ] Включить 2FA админу.
- [ ] Проверить автопродление сертификата: `systemctl list-timers qareerquest-tls-renew.timer`.
- [ ] `scripts/harden-server.sh` с переменной `ADMIN_PUBKEY` — отключит парольный SSH и root-логин.
      После этого добавить в GitHub `LUXVPS_USER=deploy` и `LUXVPS_SSH_KEY`.
- [ ] Установить unit автостарта: `deploy/quetion-site.service`.
- [ ] Включить бэкапы (`docker-compose.backup.yml`, `scripts/backup-db.sh`) и проверить восстановление.
- [ ] Поднять мониторинг:
      `docker compose -f docker-compose.yml -f docker-compose.observability.yml up -d`.
- [ ] Завести внешний uptime-чекер (UptimeRobot / Better Stack / healthchecks.io) —
      свой мониторинг не сообщит, если умрёт весь сервер.
- [ ] Если нужен `www` — добавить второй `-d` в `scripts/setup-tls.sh` и A-запись в DNS.
