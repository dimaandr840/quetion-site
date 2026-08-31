# DevPrep

Платформа вопросов и ответов для подготовки к IT-собеседованиям.

## Что нужно установить

- Docker и Docker Compose
- Для локального запуска без Docker: Java 21, Maven 3.9+, Node.js 24+, npm

## Быстрый запуск через Docker Compose

1. Склонируйте репозиторий и перейдите в папку проекта:

```bash
git clone https://github.com/dimaandr840/quetion-site.git
cd quetion-site
```

2. Создайте файл `.env` в корне проекта:

```env
POSTGRES_PASSWORD=change-me
JWT_SECRET=change-me-to-long-random-secret
MEILI_MASTER_KEY=change-me-to-long-random-key
TOTP_ENC_KEY=change-me-to-base64-32-bytes
COOKIE_SECURE=false
PUBLIC_ORIGIN=http://localhost

# Первый администратор, если нужен автосидинг
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=change-me-admin-password
```

Для генерации ключа TOTP можно использовать:

```bash
openssl rand -base64 32
```

3. Соберите и запустите проект:

```bash
docker compose up -d --build
```

4. Откройте приложение:

```text
http://localhost
```

Проверить состояние API можно так:

```bash
curl http://localhost/api/actuator/health
```

## Локальная разработка

### Инфраструктура

Поднимите PostgreSQL и Meilisearch с открытыми портами только на `127.0.0.1`:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d postgres meilisearch
```

### Backend

```bash
cd backend
mvn spring-boot:run
```

Backend использует Java 21. По умолчанию API доступен на `http://localhost:8080`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend доступен на `http://localhost:3000`.

Если frontend должен ходить в локальный backend, задайте переменную окружения:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080/api
```

## Сброс пароля по почте

В проекте есть восстановление доступа по email. Без SMTP приложение запустится, но письма не будут отправляться. Для включения отправки добавьте в `.env`:

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USERNAME=user
SMTP_PASSWORD=password
SMTP_STARTTLS=true
PASSWORD_RESET_MAIL_FROM=no-reply@example.com
PASSWORD_RESET_ENABLED=true
```

Дополнительные настройки:

```env
PASSWORD_RESET_TTL=PT15M
PASSWORD_RESET_COOLDOWN=PT1M
PASSWORD_RESET_MAX_ATTEMPTS=5
PASSWORD_RESET_RESET_TOTP=true
```

## Полезные команды

```bash
# Остановить контейнеры
docker compose down

# Остановить и удалить данные PostgreSQL/Meilisearch
docker compose down -v

# Посмотреть логи API
docker compose logs -f api

# Посмотреть логи frontend
docker compose logs -f web

# Собрать backend
cd backend && mvn -B package

# Собрать frontend
cd frontend && npm run build

# Проверить frontend линтером
cd frontend && npm run lint
```
