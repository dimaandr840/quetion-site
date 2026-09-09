import { NextResponse } from "next/server";
import vm from "node:vm";

/**
 * Разбор загруженного файла вопросов (`scripts/data/*.mjs`) в обычный JSON.
 *
 * Почему это отдельная ручка, а не разбор в браузере: файл — это ES-модуль, его
 * нужно исполнить. В браузере для этого пришлось бы делать `import()` с
 * blob-адреса или `new Function`, а CSP админки (frontend/proxy.ts) не
 * разрешает ни `blob:` в script-src, ни `unsafe-eval` — и ослаблять её ради
 * загрузчика нельзя.
 *
 * Почему это не задача бэкенда: Java не исполняет JavaScript, а превращать .mjs
 * в JSON руками — писать свой парсер.
 *
 * Файл исполняется в контексте node:vm без require, process, fetch и таймеров,
 * с ограничением по времени и размеру, и любые импорты отклоняются заранее.
 * Это не полноценная песочница, поэтому доступ ограничен администратором:
 * права проверяются у бэкенда по cookie запроса.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INTERNAL_BASE = process.env.API_INTERNAL_BASE_URL ?? "http://localhost:8080/api";

/** Файл вопросов на 100 КБ — норма; всё, что кратно больше, скорее ошибка. */
const MAX_SOURCE_LENGTH = 2_000_000;
const EXECUTION_TIMEOUT_MS = 3_000;

/**
 * Конструкции, которых в файле данных быть не может. Это не защита от
 * злоумышленника (её обеспечивают проверка прав и пустой контекст), а понятная
 * ошибка вместо непонятного падения: файл с импортами всё равно не исполнится.
 */
const FORBIDDEN = [
  { pattern: /(^|[\s;])import\s/m, message: "файл импортирует другие модули" },
  { pattern: /\brequire\s*\(/, message: "файл использует require()" },
  { pattern: /\bprocess\b/, message: "файл обращается к process" },
  { pattern: /\bfetch\s*\(/, message: "файл выполняет сетевые запросы" },
];

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** Права проверяет бэкенд: у Next нет ни ролей, ни ключа для разбора JWT. */
async function isAdmin(cookie: string): Promise<boolean> {
  try {
    const response = await fetch(`${INTERNAL_BASE}/admin/questions`, {
      headers: { Accept: "application/json", Cookie: cookie },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  // Ручка исполняет присланный код, поэтому запрос принимается только со своей
  // же страницы: cross-site POST от чужого сайта отклоняется до разбора тела.
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) return bad("Запрос из другого источника", 403);
    } catch {
      return bad("Некорректный заголовок Origin", 403);
    }
  }

  const cookie = request.headers.get("cookie") ?? "";
  if (!cookie || !(await isAdmin(cookie))) {
    return bad("Нужны права администратора", 403);
  }

  let source: string;
  try {
    const body = (await request.json()) as { source?: unknown };
    source = typeof body.source === "string" ? body.source : "";
  } catch {
    return bad("Тело запроса не является JSON");
  }

  if (!source.trim()) return bad("Файл пустой");
  if (source.length > MAX_SOURCE_LENGTH) {
    return bad(`Файл больше ${Math.round(MAX_SOURCE_LENGTH / 1_000_000)} МБ`);
  }

  for (const { pattern, message } of FORBIDDEN) {
    if (pattern.test(source)) {
      return bad(`Так нельзя: ${message}. Ожидается файл с данными вопросов.`);
    }
  }

  const exports = source.match(/export\s+default/g)?.length ?? 0;
  if (exports === 0) return bad("В файле нет `export default` с данными");
  if (exports > 1) return bad("В файле больше одного `export default`");

  // Единственное преобразование: экспорт превращается в присваивание, чтобы
  // модуль можно было исполнить как обычный скрипт.
  const script = `"use strict";\n${source.replace(/export\s+default/, "__out.value =")}`;

  const sandbox: { __out: { value?: unknown } } = { __out: {} };
  const context = vm.createContext(sandbox, {
    codeGeneration: { strings: false, wasm: false },
  });

  try {
    new vm.Script(script, { filename: "questions.mjs" }).runInContext(context, {
      timeout: EXECUTION_TIMEOUT_MS,
      breakOnSigint: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "неизвестная ошибка";
    return bad(`Файл не удалось прочитать: ${message}`);
  }

  const value = sandbox.__out.value;
  if (!value || typeof value !== "object") {
    return bad("`export default` должен быть объектом с полем questions");
  }

  // Круговой прогон через JSON отсекает функции, классы и прототипы: дальше
  // работает только с данными.
  let data: unknown;
  try {
    data = JSON.parse(JSON.stringify(value));
  } catch {
    return bad("Данные файла содержат значения, которые нельзя сериализовать");
  }

  return NextResponse.json({ data }, { headers: { "Cache-Control": "no-store" } });
}
