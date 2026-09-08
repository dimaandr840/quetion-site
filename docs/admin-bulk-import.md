# Массовая загрузка вопросов

`POST /api/admin/questions/import` — заливка пакета вопросов одним запросом вместо N вызовов
`POST /api/admin/questions`.

Требует `ROLE_ADMIN` (правило `/api/admin/**` в `SecurityConfiguration`) и CSRF-заголовок
`X-XSRF-TOKEN`, как и остальные небезопасные методы.

## Запрос

| Поле | Тип | По умолчанию | Назначение |
| --- | --- | --- | --- |
| `professionSlug` | string | — | направление для элементов без своего `professionSlug` |
| `mode` | `SKIP_EXISTING` \| `UPDATE_EXISTING` \| `FAIL_ON_EXISTING` | `SKIP_EXISTING` | что делать с уже существующим вопросом |
| `createMissingCategories` | boolean | `false` | создавать отсутствующие темы вместо ошибки по элементу |
| `dryRun` | boolean | `false` | только проверить пакет, ничего не записывая |
| `items` | array | — | 1..500 вопросов |

Элемент `items[]`:

| Поле | Обязательно | Комментарий |
| --- | --- | --- |
| `title` | да | до 512 символов |
| `level` | да | `Junior` / `Middle` / `Senior` (регистр не важен) |
| `categorySlug` | да | адрес темы внутри направления |
| `sections` | да | минимум одна секция ответа |
| `slug` | нет | если не задан — выводится из названия, кириллица транслитерируется; коллизии разводятся суффиксом `-2`, `-3`, … |
| `professionSlug` | нет | перебивает значение на уровне запроса |
| `snippet`, `tldr` | нет | если пусто — берётся первый абзац ответа с вычищенной разметкой |
| `tags` | нет | массив строк |
| `popular`, `published` | нет | `popular` по умолчанию `false`, `published` — `true` |
| `categoryTitle`, `categoryEmoji` | нет | используются только при `createMissingCategories` |
| `tasks` | нет | практические задания (`id`, `title`, `statement[]`, `hint`) |

Секция `sections[]`: `heading`, `paragraphs[]` (простые строки, допускается инлайновый HTML
`<strong> <em> <code> <mark> <u> <s> <a href>`), `bullets[]`, `code` (`language`, `title`,
`lines[]`), опционально `blocks[]` — если порядок картинок и абзацев важен. `id` и `heading`
необязательны: подставятся `s1..sN` и «Ответ».

## Ответ

Всегда `200`. Пакет частично успешен по определению: ошибка одного вопроса не отменяет остальные.

```json
{
  "total": 2,
  "created": 1,
  "updated": 0,
  "skipped": 1,
  "failed": 0,
  "dryRun": false,
  "results": [
    { "index": 0, "title": "Что такое JVM?", "slug": "chto-takoe-jvm", "outcome": "CREATED" },
    { "index": 1, "title": "Чем HashMap отличается от Hashtable?", "slug": "chem-hashmap-otlichaetsya-ot-hashtable", "outcome": "SKIPPED", "error": "Вопрос с таким названием уже есть" }
  ]
}
```

`outcome`: `CREATED`, `UPDATED`, `SKIPPED`, `FAILED`, `VALIDATED` (последний — только при `dryRun`).

## Пример

```bash
curl -sS -X POST "$DEVPREP_API/admin/questions/import" \
  -H 'Content-Type: application/json' \
  -H "X-XSRF-TOKEN: $CSRF" -b cookies.txt \
  -d '{
    "professionSlug": "java-developer",
    "mode": "SKIP_EXISTING",
    "createMissingCategories": true,
    "items": [
      {
        "title": "Что такое JVM?",
        "level": "Junior",
        "categorySlug": "core-java",
        "categoryTitle": "Core Java",
        "tags": ["jvm", "основы"],
        "sections": [
          {
            "heading": "Коротко",
            "paragraphs": ["JVM — виртуальная машина, исполняющая <code>bytecode</code>."],
            "bullets": ["загрузка классов", "JIT-компиляция", "сборка мусора"]
          }
        ]
      }
    ]
  }'
```

## Заливка большого пула

1. Прогоните пакет с `"dryRun": true` — вернётся отчёт без записи в базу.
2. Разбейте пул на пакеты по 100–300 вопросов (жёсткий лимит — 500) и отправляйте последовательно.
   Тело запроса целиком держится в памяти, поэтому пакет на несколько тысяч вопросов упрётся в
   таймауты, а не в базу.
3. Повторный запуск безопасен: при `SKIP_EXISTING` уже загруженные вопросы отдадут `SKIPPED`.
   Дедупликация идёт и по `slug`, и по нормализованному названию, поэтому правка запятой в
   заголовке не создаёт дубль.
4. Обновление контента — `"mode": "UPDATE_EXISTING"`; `slug` существующего вопроса при этом не
   меняется, чтобы не ломать ссылки и поисковую выдачу.

Каждый вопрос пишется в своей транзакции, поэтому переиндексация Meilisearch идёт по мере
коммитов. Если поиск был недоступен во время импорта, догоните индекс полной переиндексацией.
