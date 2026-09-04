# Фичефлаги

## Почему не `NEXT_PUBLIC_*`

`NEXT_PUBLIC_AUTH_ENABLED` подставлялся в бандл на этапе `docker build`. Любое
переключение требовало пересборки образа и деплоя — это конфиг сборки,
а не флаг: нет ни постепенной раскатки, ни быстрого выключения сломавшейся
функциональности.

## Как устроено сейчас

- Таблица `feature_flags` (Liquibase, changeset `20260903-01-feature-flags`).
- `FeatureFlagService` держит кэш в памяти с TTL `devprep.flags.cache-ttl` (15 с).
- Недоступная база не роняет запрос: используется последний снимок, а если его нет —
  `devprep.flags.defaults` из `application.yml`.

## API

| Метод | Адрес | Доступ |
| --- | --- | --- |
| GET | `/api/flags?bucket=<id>` | публичный |
| GET | `/api/admin/flags` | админ |
| PUT | `/api/admin/flags/{key}` | админ |

Пример постепенной раскатки на 10% аудитории:

```bash
curl -X PUT https://example.com/api/admin/flags/registration-enabled \
  -H 'Content-Type: application/json' \
  -d '{"enabled": true, "rolloutPercentage": 10}'
```

Группа вычисляется как `hash(key + ":" + bucket) % 100 < rolloutPercentage`. Ключ входит
в хеш намеренно: иначе один и тот же пользователь всегда попадал бы в первые
проценты по всем флагам сразу.

`bucket` — анонимный идентификатор браузера из `localStorage` (`lib/flags.ts`).
Без него частично раскатанный флаг считается выключенным — иначе интерфейс мигал бы
между запросами.

## Ограничения

`proxy.ts` работает до гидратации и продолжает использовать константу `AUTH_ENABLED`:
сетевой запрос на каждый переход в middleware стоит заметной латентности. Серверная
проверка доступа в Spring Security от этого не зависит.
