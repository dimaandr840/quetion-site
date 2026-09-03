# Деплой на LuxVPS

Схема: GitHub Actions собирает образы `api` и `web`, пушит их в GHCR и по SSH
говорит серверу `docker compose pull && up -d`. На самом VPS сборки нет:
компиляция Spring Boot и Next.js съедает всю память небольшого сервера и роняет
живой сайт.

## Файлы

- `.github/workflows/deploy.yml` — сборка, пуш в GHCR, деплой, health check, автооткат.
- `docker-compose.prod.yml` — оверлей: вместо `build` используются готовые образы.

## Подготовка сервера (один раз)

```bash
# под root
apt update && apt install -y git curl
curl -fsSL https://get.docker.com | sh   # Docker + Compose v2 (нужен v2.24+)
docker compose version

# отдельный пользователь для деплоя, а не root
adduser --disabled-password --gecos "" deploy
usermod -aG docker deploy

mkdir -p /opt/quetion-site
chown deploy:deploy /opt/quetion-site

# под deploy
su - deploy
git clone https://github.com/dimaandr840/quetion-site.git /opt/quetion-site
cd /opt/quetion-site
```

Создать `/opt/quetion-site/.env` с боевыми значениями (этот файл в git не попадает
и деплоем не перезаписывается):

```env
POSTGRES_PASSWORD=...
JWT_SECRET=...
MEILI_MASTER_KEY=...
TOTP_ENC_KEY=...            # openssl rand -base64 32
PUBLIC_ORIGIN=https://qareerquest.com
COOKIE_SECURE=true
ADMIN_EMAIL=...
ADMIN_PASSWORD=...
```

Ключ для CI:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/github-deploy -N ""
cat ~/.ssh/github-deploy.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
cat ~/.ssh/github-deploy   # приватный ключ → секрет LUXVPS_SSH_KEY
```

Первый запуск вручную (чтобы поднялись postgres/meilisearch/nginx):

```bash
export API_IMAGE=ghcr.io/dimaandr840/quetion-site/api:latest
export WEB_IMAGE=ghcr.io/dimaandr840/quetion-site/web:latest
docker compose -f docker-compose.yml -f docker-compose.prod.yml pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## Секреты и переменные в GitHub

Settings → Secrets and variables → Actions.

| Имя | Тип | Назначение |
|---|---|---|
| `LUXVPS_HOST` | secret | IP или домен VPS |
| `LUXVPS_USER` | secret | пользователь SSH (`deploy`) |
| `LUXVPS_SSH_KEY` | secret | приватный ed25519-ключ целиком |
| `LUXVPS_PORT` | secret | порт SSH, если не 22 |
| `GHCR_PULL_TOKEN` | secret | PAT с `read:packages` для `docker login` на сервере |
| `PUBLIC_ORIGIN` | variable | `https://qareerquest.com` — вшивается в бандл |
| `MEDIA_PUBLIC_BASE_URL` | variable | публичный домен R2 |
| `AUTH_ENABLED` | variable | `true` |
| `DEPLOY_PATH` | variable | `/opt/quetion-site` (значение по умолчанию) |
| `HEALTH_URL` | variable | `http://127.0.0.1/api/actuator/health` (по умолчанию) |

Если сделать пакеты GHCR публичными (Packages → Package settings → Change visibility),
`GHCR_PULL_TOKEN` не нужен, но шаг `docker login` в скрипте надо будет убрать.

Желательно завести environment `production` (Settings → Environments) с required reviewers —
тогда выкат в прод будет требовать подтверждения кнопкой.

## Как работает выкат

1. Push в `main` → сборка образов с тегами `<short-sha>` и `latest`.
2. SSH на VPS: `git reset --hard <sha>` (нужен для nginx.conf и compose-файлов), `pull`, `up -d`.
3. Ждём `до 5 минут` ответа от `/api/actuator/health` (Liquibase-миграции + старт JVM).
4. Если health не поднялся — печатаются логи и контейнеры возвращаются на предыдущие образы.

## Ручной откат

Actions → “Deploy — LuxVPS” → Run workflow → в поле `image_tag` указать short SHA
рабочего релиза. Или на сервере:

```bash
cd /opt/quetion-site
export API_IMAGE=ghcr.io/dimaandr840/quetion-site/api:<sha>
export WEB_IMAGE=ghcr.io/dimaandr840/quetion-site/web:<sha>
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## О базе данных

Миграции прогоняет Liquibase при старте `api`, отдельного шага в CI нет.
Откат образа не откатывает схему БД — для ломающих миграций сначала бэкап
(`scripts/backup-db.sh`, см. `docs/backup.md`).
