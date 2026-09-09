# Наблюдаемость: метрики, трейсы, логи, алерты

Стек поднимается отдельным файлом и не трогает основной `docker-compose.yml`:

```bash
docker compose -f docker-compose.yml -f docker-compose.observability.yml up -d
```

Порты привязаны к `127.0.0.1`: мониторинг не должен быть публичным — доступ через
`ssh -L`.

| Сервис | Адрес | Зачем |
| --- | --- | --- |
| Prometheus | http://127.0.0.1:9090 | метрики, SLO-правила |
| Grafana | http://127.0.0.1:3001 | дашборды `DevPrep API RED` и `VPS — нагрузка и доступность` |
| Alertmanager | http://127.0.0.1:9093 | маршрутизация алертов |
| Loki | внутренний | агрегация JSON-логов |
| Tempo | внутренний | трейсы OTLP |
| node-exporter | внутренний | нагрузка самого VPS |
| cAdvisor | внутренний | нагрузка по контейнерам |
| blackbox-exporter | внутренний | HTTP-пробы доступности и срок TLS |

Доступ с локальной машины:

```bash
ssh -N -L 3001:127.0.0.1:3001 -L 9090:127.0.0.1:9090 deploy@<IP сервера>
```

## Мониторинг VPS: нагрузка и доступность

### Нагрузка

`node-exporter` смотрит на хост (`pid: host`, проброс `/` в `/host`), поэтому метрики
относятся к машине, а не к контейнеру. `cAdvisor` добавляет разрез по контейнерам —
без него нельзя отличить «сервера мало» от «JVM течёт по памяти».

Алерты — `observability/prometheus/rules/host.yml`:

| Алерт | Порог |
| --- | --- |
| `HostCpuHigh` | CPU > 85% более 15 мин |
| `HostLoadHigh` | load5 > 2×числа ядер |
| `HostMemoryHigh` | память > 90% |
| `HostSwapUsageHigh` | swap > 50% |
| `HostDiskSpaceLow` | свободно < 15% |
| `HostDiskWillFillIn4h` | прогноз по `predict_linear` |
| `ContainerMemoryNearLimit` | контейнер > 90% своего лимита |
| `ContainerRestartLoop` | > 3 стартов за 15 мин |
| `NodeExporterDown` | нет метрик хоста 5 мин |

### Доступность

`blackbox-exporter` делает два вида проб:

- внутренние через nginx (`/api/actuator/health`, `/`, `/search`) — те же адреса,
  по которым `scripts/deploy-release.sh` решает, удался ли релиз;
- внешнюю по `https://qareerquest.com/` — проверяет DNS, внешний firewall и TLS.

Алерты: `SiteDown` (probe_success == 0 две минуты, critical), `SiteSlow` (> 3 с),
`TlsCertExpiringSoon` (< 14 дней), `TlsCertExpiringCritical` (< 3 дней),
`BlackboxProbeFailedDns`.

Смена домена: правится одна строка в `job_name: blackbox-http-public`
(`observability/prometheus/prometheus.yml`), затем
`curl -X POST http://127.0.0.1:9090/-/reload`.

⚠️ Саморазмещённые пробы не заметят падения всего VPS — вместе с сайтом умрёт
и Prometheus. Обязательно добавьте внешний uptime-чекер (UptimeRobot, Better Stack,
healthchecks.io) на `https://qareerquest.com/` и `…/api/actuator/health`.

## Метрики

Spring Boot Actuator отдаёт `/actuator/prometheus` только во внутреннюю сеть: nginx
возвращает 404 на всё `/actuator/`, кроме `/actuator/health`.

Ключевые ряды:

- `http_server_requests_seconds_*` — RED (rate/errors/duration), гистограмма включена,
  иначе p95/p99 в Prometheus посчитать невозможно;
- `hikaricp_connections_{active,idle,pending,max}` — глубина пула соединений;
- `devprep_search_up`, `devprep_media_up`, `devprep_mail_up` — состояние зависимостей
  (`NaN` означает «выключено конфигом», а не «сломано»);
- `devprep_search_requests_total{mode="index|fallback"}` — доля деградировавшего поиска;
- `devprep_mail_failures_total` — неотправленные письма;
- `node_*` — CPU, load average, память, swap, диск, сеть хоста;
- `container_*` — CPU и память по контейнерам;
- `probe_success`, `probe_duration_seconds`, `probe_ssl_earliest_cert_expiry` — доступность.

## Трейсинг

nginx генерирует `X-Request-Id` и `traceparent` и пробрасывает их дальше; Spring
продолжает трейс через Micrometer Tracing и шлёт его в Tempo по OTLP.
Семплирование — 10% (`TRACING_SAMPLE_RATE`), на время разбора инцидента ставьте `1.0`.

По `traceId` из лога можно перейти в трейс (derived field в Loki) и обратно
(tracesToLogs в Tempo).

## Логи

`logback-spring.xml` печатает JSON во всех профилях, кроме `dev`/`test`. Каждая запись
содержит `requestId`, `userId`, `traceId`, `spanId`. Promtail читает логи через docker SD
и кладёт их в Loki.

## Алерты и SLO

Цели: доступность 99.9%, p95 \< 500 мс, error-rate \< 1%. Правила — в
`observability/prometheus/rules/slo.yml` (приложение) и `host.yml` (сервер и доступность),
уведомления — Telegram и почта.

Нужные переменные окружения: `ALERT_TELEGRAM_CHAT_ID`, `ALERT_MAIL_FROM`, `ALERT_MAIL_TO`,
`GRAFANA_ADMIN_PASSWORD`, `GRAFANA_ROOT_URL`; токен бота кладётся файлом в
`/etc/alertmanager/secrets/telegram_bot_token`.

## Что добавить в сервисы api/web

В основном `docker-compose.yml` сервису `api` нужно добавить:

```yaml
environment:
  MANAGEMENT_ENDPOINTS: health,info,prometheus
  TRACING_SAMPLE_RATE: "0.1"
  OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: http://tempo:4318/v1/traces
  SEARCH_HEALTH_INTERVAL: PT30S
  FLAGS_CACHE_TTL: PT15S
```

Сети `api`, `web`, `nginx` и сервисы мониторинга должны быть в одной сети compose
(проект `devprep`).
