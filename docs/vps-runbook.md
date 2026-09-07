# Runbook: подготовка VPS и CI/CD

Сквозной порядок действий от чистого сервера до автодеплоя по push в `main`.
Production-ветка — `main`.

## Что уже автоматизировано

| Задача | Чем закрыта |
| --- | --- |
| Пакеты, swap, UFW, Docker, юзер `deploy`, клон репозитория, генерация секретов в `.env` | `scripts/provision-server.sh` |
| SSH keys-only, fail2ban, автообновления, чистка Docker | `scripts/harden-server.sh` |
| Reverse proxy | `nginx/nginx.conf` + `scripts/render-nginx-conf.sh` |
| HTTPS Let's Encrypt + автопродление | `scripts/setup-tls.sh`, `scripts/renew-tls.sh` |
| Сборка образов и деплой по push | `.github/workflows/ci.yml` → `.github/workflows/deploy.yml` |
| Health-check и автооткат | `scripts/deploy-release.sh` |
| Автозапуск после перезагрузки | `scripts/boot-up.sh` + `deploy/quetion-site.service` |
| Резервные копии БД | `scripts/backup-db.sh`, `scripts/pgbackrest-*.sh` |

## Порядок первичной настройки

### 1. DNS

A-запись домена должна указывать на IP VPS **до** выпуска сертификата,
иначе Let's Encrypt не пройдёт проверку владения доменом.

### 2. Secrets в GitHub

`Settings → Secrets and variables → Actions → Secrets`:

| Secret | Значение |
| --- | --- |
| `LUXVPS_HOST` | IP или хостнейм VPS |
| `LUXVPS_USER` | `deploy` |
| `LUXVPS_SSH_KEY` | приватный SSH-ключ деплой-пользователя |
| `LUXVPS_PORT` | порт SSH, если не 22 |
| `GHCR_PULL_TOKEN` | PAT с правом `read:packages` |

Пароли (`LUXVPS_SSH_PASSWORD`, `LUXVPS_ROOT_PASSWORD`) заводить не нужно:
после `harden-server.sh` вход по паролю выключен.

### 3. Variables в GitHub

| Variable | Значение |
| --- | --- |
| `PUBLIC_ORIGIN` | `https://ваш-домен` |
| `DEPLOY_PATH` | `/opt/quetion-site` |
| `HEALTH_ORIGIN` | `http://127.0.0.1` |
| `MEDIA_PUBLIC_BASE_URL` | домен объектного хранилища, если включены медиа |
| `GA_ID` | если нужна аналитика |

`PUBLIC_ORIGIN` попадает в build-args фронтенда (`robots.txt`, `sitemap.xml`,
CSP), поэтому смена домена требует пересборки образа, а не только рестарта.

### 4. Провижининг

Запустить workflow **Provision** (`workflow_dispatch`) с параметрами:

- `ENABLE_TLS=true`
- `DOMAIN=ваш-домен`
- `LETSENCRYPT_EMAIL=почта@для.уведомлений`
- `COOKIE_SECURE=true`
- `PUBLIC_ORIGIN=https://ваш-домен`

Скрипт сгенерирует секреты в `.env`, поднимет стек (в первый раз собрав
образы прямо на сервере, так как в GHCR ещё пусто), выпустит сертификат и
включит таймер автопродления.

Пароль администратора окажется в `/root/qareerquest-admin-password.txt`
(права 600). Заберите его и удалите файл.

Повторный запуск безопасен: `POSTGRES_PASSWORD`, `JWT_SECRET`,
`MEILI_MASTER_KEY` и `TOTP_ENC_KEY` не перегенерируются. Их смена на живой
базе отрезала бы приложение от уже созданного кластера и от зашифрованных
TOTP-секретов админов.

### 5. Hardening

```bash
ssh root@ВАШ_VPS
ADMIN_PUBKEY="ssh-ed25519 AAAA..." bash /opt/quetion-site/scripts/harden-server.sh
```

Не закрывая эту сессию, откройте вторую и убедитесь, что вход по ключу
работает. Скрипт откажется выключать пароли, если не найдёт ни одного
`authorized_keys`.

### 6. Автозапуск после reboot

```bash
sudo install -m 644 /opt/quetion-site/deploy/quetion-site.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now quetion-site.service
sudo reboot
```

После перезагрузки сайт должен подняться сам. Проверка:
`systemctl status quetion-site.service`.

### 7. Проверка CI/CD

Push в `main` → workflow **CI** → при успехе **Deploy**. Деплой собирает
образы в GHCR по **digest** (не по тегу), поэтому откат гарантированно
возвращает ровно тот же бинарный образ.

## Как работает защита от битого деплоя

`scripts/deploy-release.sh`:

1. Запоминает текущий commit SHA и ID работающих образов `api` и `web`.
2. Тянет новые образы **до** остановки старых.
3. Ставит `trap rollback_on_error ERR` и обновляет только `api`, `web`, `nginx`
   (`--no-deps`), не трогая Postgres, Meilisearch и сервисы бэкапов.
4. Health-check: `/api/actuator/health`, `/` и `/search`, до 60 попыток с
   интервалом 5 секунд.
5. При любой ошибке возвращает код на прежний SHA, перегенерирует конфиг
   nginx и поднимает предыдущие образы из локального кэша (`--pull never`),
   то есть откат работает даже при недоступном GHCR.
6. При успехе пишет пару образов в `.releases/<sha>` и SHA в `.releases/current`.

### Ручной откат

Workflow **Deploy** → `Run workflow` → в поле `image_tag` указать полный
40-символьный commit SHA ранее задеплоенного релиза. Код не пересобирается:
берётся запись из `.releases/`.

### Ограничение: миграции БД

Автооткат возвращает код и образы, но **не откатывает миграции схемы**.
Поэтому миграции обязаны быть обратно совместимыми:

- сначала добавляем колонку/таблицу, деплоим код, который умеет работать и
  со старой, и с новой схемой;
- удаляем старое только следующим релизом, когда откат назад уже не нужен.

Перед рискованной миграцией снимайте бэкап: `bash scripts/backup-db.sh`.

## Диагностика

```bash
cd /opt/quetion-site
COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml"

$COMPOSE ps                      # что запущено
$COMPOSE logs --tail=200 api     # логи бэкенда
$COMPOSE exec -T nginx nginx -t  # валидация конфига nginx
cat .releases/current            # какой релиз считается текущим

systemctl status quetion-site.service
systemctl list-timers qareerquest-tls-renew.timer
fail2ban-client status sshd
df -h /                          # место на диске
```

Проверка срока сертификата:

```bash
echo | openssl s_client -connect ВАШ_ДОМЕН:443 -servername ВАШ_ДОМЕН 2>/dev/null \
  | openssl x509 -noout -dates
```
