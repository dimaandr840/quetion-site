/**
 * Пакетный импорт вопросов в базу знаний через админский API.
 *
 * Данные лежат в scripts/data/<профессия>.mjs в компактной схеме (см. ниже):
 * скрипт сам собирает slug, snippet, tldr и создаёт отсутствующие темы.
 *
 * Запуск:
 *   node scripts/import-questions.mjs data/qa.mjs --dry
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=... ADMIN_TOTP_SECRET=... \
 *     node scripts/import-questions.mjs data/qa.mjs
 *
 * Флаги:
 *   --dry            ничего не пишет, только считает и валидирует файл
 *   --update         обновлять уже существующие вопросы (по умолчанию пропуск)
 *   --draft          импортировать как черновики (published=false)
 *   --only=<тема>    только вопросы одной темы (можно указывать несколько раз)
 *   --limit=<N>      импортировать не больше N вопросов (удобно для прогона)
 *
 * Переменные окружения:
 *   DEVPREP_API        база API, по умолчанию http://localhost/api
 *   ADMIN_EMAIL        почта администратора
 *   ADMIN_PASSWORD     пароль администратора
 *   ADMIN_TOTP_SECRET  base32-секрет аутентификатора (или ADMIN_TOTP_CODE — готовый код)
 *
 * Схема одного вопроса:
 *   { t: заголовок, l: "Junior|Middle|Senior", c: slug темы, g: [теги],
 *     d: TL;DR, pop: популярный?,
 *     s: [ { h: заголовок секции, p: [абзацы], b: [пункты],
 *            code: { lang, title, lines: [строки] } } ] }
 *
 * Инлайн-разметка в абзацах и пунктах: <strong>, <em>, <code>, <mark>, <u>, <s>, <a href>.
 * Абзацы уходят в blocks[{kind:"PARAGRAPH"}] — именно это поле читает бэкенд
 * (AnswerSectionDto.blocks); ключа paragraphs в API нет.
 */

import crypto from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";

const BASE = process.env.DEVPREP_API ?? "http://localhost/api";
const LEVELS = new Set(["Junior", "Middle", "Senior"]);

const CYRILLIC_MAP = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh",
  з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o",
  п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c",
  ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu",
  я: "ya",
};

function slugify(value, maxLength = 110) {
  const base = value
    .toLowerCase()
    .split("")
    .map((char) => CYRILLIC_MAP[char] ?? char)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base.slice(0, maxLength);
}

/** Разметка нужна на странице, но не в snippet, tldr и поисковом индексе. */
function stripTags(value) {
  return value.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

// ---------------------------------------------------------------------------
// HTTP: cookie-сессия, CSRF, повторы
// ---------------------------------------------------------------------------

let csrfToken = null;
let cookieJar = "";

function mergeCookies(response) {
  const raw = response.headers.getSetCookie?.() ?? [];
  for (const entry of raw) {
    const [pair] = entry.split(";");
    const [name, value] = pair.split("=");
    if (name === "XSRF-TOKEN") csrfToken = decodeURIComponent(value);
    const others = cookieJar
      .split("; ")
      .filter((item) => item && !item.startsWith(`${name}=`));
    cookieJar = [...others, pair].join("; ");
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** 429 и 5xx — почти всегда временные: три попытки дешевле, чем ручной повтор импорта. */
async function request(method, urlPath, body, attempt = 1) {
  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (cookieJar) headers.Cookie = cookieJar;
  if (csrfToken && method !== "GET") headers["X-XSRF-TOKEN"] = csrfToken;

  const response = await fetch(`${BASE}${urlPath}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  mergeCookies(response);

  if (!response.ok) {
    const retriable = response.status === 429 || response.status >= 500;
    if (retriable && attempt < 3) {
      await sleep(attempt * 1000);
      return request(method, urlPath, body, attempt + 1);
    }
    let detail = "";
    try {
      const problem = await response.json();
      detail = problem.detail ?? problem.title ?? "";
    } catch {
      detail = await response.text().catch(() => "");
    }
    throw new Error(`${method} ${urlPath} → ${response.status} ${detail}`);
  }
  if (response.status === 204) return undefined;
  const type = response.headers.get("Content-Type") ?? "";
  return type.includes("json") ? response.json() : undefined;
}

// ---------------------------------------------------------------------------
// Вход под администратором
// ---------------------------------------------------------------------------

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Decode(input) {
  let bits = 0;
  let value = 0;
  const out = [];
  for (const char of input.trim().replace(/=+$/, "").toUpperCase()) {
    const index = BASE32.indexOf(char);
    if (index === -1) continue;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** Тот же алгоритм, что в scripts/totp-code.cjs: секрет не печатается никогда. */
function totpCode(secret) {
  const counter = Buffer.alloc(8);
  counter.writeBigInt64BE(BigInt(Math.floor(Date.now() / 1000 / 30)));
  const hash = crypto.createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const offset = hash[hash.length - 1] & 0x0f;
  const binary =
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, "0");
}

/**
 * /api/admin/** требует ROLE_ADMIN, поэтому одного CSRF-токена мало: нужен полный вход
 * с паролем и вторым фактором. Токены остаются в httpOnly cookie — скрипт их не читает.
 */
async function login() {
  await request("GET", "/auth/csrf");

  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error("Нужны ADMIN_EMAIL и ADMIN_PASSWORD в окружении");
  }

  const outcome = await request("POST", "/auth/login", { email, password });
  if (outcome?.status === "AUTHENTICATED") return;

  if (outcome?.status === "TOTP_SETUP_REQUIRED") {
    throw new Error(
      "У учётки не привязан аутентификатор: завершите настройку 2FA в админке и повторите"
    );
  }
  if (outcome?.status !== "TOTP_REQUIRED") {
    throw new Error(`Неожиданный ответ входа: ${outcome?.status ?? "нет статуса"}`);
  }

  const code = process.env.ADMIN_TOTP_CODE ?? 
    (process.env.ADMIN_TOTP_SECRET ? totpCode(process.env.ADMIN_TOTP_SECRET) : null);
  if (!code) {
    throw new Error("Требуется код 2FA: задайте ADMIN_TOTP_SECRET или ADMIN_TOTP_CODE");
  }

  const verified = await request("POST", "/auth/totp/verify", { code });
  if (verified?.status !== "AUTHENTICATED") {
    throw new Error("Код 2FA не принят");
  }
}

// ---------------------------------------------------------------------------
// Сборка полезной нагрузки
// ---------------------------------------------------------------------------

function validate(question, index) {
  const where = `#${index + 1} «${question.t ?? "без заголовка"}»`;
  if (!question.t) return `${where}: нет заголовка (t)`;
  if (!LEVELS.has(question.l)) return `${where}: уровень должен быть Junior|Middle|Senior`;
  if (!question.c) return `${where}: нет темы (c)`;
  if (!Array.isArray(question.s) || question.s.length === 0) return `${where}: нет секций (s)`;
  for (const section of question.s) {
    const hasText = section.p?.length || section.b?.length || section.code;
    if (!hasText) return `${where}: пустая секция «${section.h ?? "без заголовка"}»`;
  }
  return null;
}

function buildPayload(question, professionSlug, slug, published) {
  const sections = question.s.map((section, index) => {
    const built = {
      id: `section-${index + 1}`,
      heading: section.h ?? "Ответ",
    };
    // Бэкенд читает только blocks: абзацы, отправленные как paragraphs, молча терялись.
    if (section.p?.length) {
      built.blocks = section.p.map((text) => ({ kind: "PARAGRAPH", text }));
    }
    if (section.b?.length) built.bullets = section.b;
    if (section.code) {
      built.code = {
        language: section.code.lang ?? "text",
        title: section.code.title ?? "Пример",
        lines: section.code.lines,
      };
    }
    return built;
  });

  const flat = stripTags(
    sections
      .flatMap((section) => [
        ...(section.blocks ?? []).map((block) => block.text ?? ""),
        ...(section.bullets ?? []),
      ])
      .join(" ")
  );
  const summary = stripTags(question.d ?? flat) || question.t;

  return {
    slug,
    title: question.t,
    level: question.l,
    professionSlug,
    categorySlug: question.c,
    tags: question.g ?? [],
    snippet: summary.slice(0, 1024),
    tldr: summary.slice(0, 512),
    popular: Boolean(question.pop),
    published,
    sections,
  };
}

function uniqueSlug(title, taken) {
  const base = slugify(title) || "question";
  if (!taken.has(base)) {
    taken.add(base);
    return base;
  }
  // Одинаковые заголовки в разных темах дают одинаковый slug — добавляем суффикс.
  let counter = 2;
  while (taken.has(`${base}-${counter}`)) counter += 1;
  const slug = `${base}-${counter}`;
  taken.add(slug);
  return slug;
}

async function ensureCategories(professionSlug, categories) {
  const existing = await request(
    "GET",
    `/categories?profession=${encodeURIComponent(professionSlug)}`
  );
  const known = new Set(existing.map((item) => item.slug));

  for (const category of categories) {
    if (known.has(category.slug)) continue;
    await request("POST", "/admin/categories", {
      slug: category.slug,
      title: category.title,
      emoji: category.emoji ?? "📁",
      description: category.description ?? category.title,
      professionSlug,
    });
    console.log(`  + тема ${category.slug} — ${category.title}`);
  }
}

// ---------------------------------------------------------------------------
// Точка входа
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const [relativePath, ...flags] = argv;
  const only = new Set();
  let limit = Infinity;
  for (const flag of flags) {
    if (flag.startsWith("--only=")) only.add(flag.slice("--only=".length));
    if (flag.startsWith("--limit=")) limit = Number(flag.slice("--limit=".length));
  }
  return {
    relativePath,
    dryRun: flags.includes("--dry"),
    update: flags.includes("--update"),
    published: !flags.includes("--draft"),
    only,
    limit,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.relativePath) {
    console.error(
      "Использование: node scripts/import-questions.mjs data/qa.mjs " +
        "[--dry] [--update] [--draft] [--only=тема] [--limit=N]"
    );
    process.exit(1);
  }

  const fileUrl = pathToFileURL(
    path.resolve(process.cwd(), "scripts", options.relativePath)
  );
  const module = await import(fileUrl.href);
  const { professionSlug, categories = [], questions } = module.default;

  console.log(`Направление: ${professionSlug}, вопросов в файле: ${questions.length}`);

  // Валидация до первого запроса: половина импорта хуже, чем ноль импорта.
  const problems = questions.map(validate).filter(Boolean);
  if (problems.length > 0) {
    console.error(`Файл не прошёл проверку (${problems.length}):`);
    for (const problem of problems.slice(0, 15)) console.error(`  ! ${problem}`);
    process.exit(1);
  }

  const selected = new Map();
  for (const question of questions) {
    if (options.only.size > 0 && !options.only.has(question.c)) continue;
    const key = `${question.c}::${question.t.trim().toLowerCase()}`;
    if (selected.has(key)) {
      console.warn(`  ! дубликат в файле: ${question.t}`);
      continue;
    }
    selected.set(key, question);
    if (selected.size >= options.limit) break;
  }

  if (options.dryRun) {
    const count = (pick) =>
      [...selected.values()].reduce((acc, item) => {
        const key = pick(item);
        acc[key] = (acc[key] ?? 0) + 1;
        return acc;
      }, {});
    console.log("Уровни:", count((item) => item.l));
    console.log("Темы:", count((item) => item.c));
    console.log(`К импорту: ${selected.size}, проверка пройдена`);
    return;
  }

  await login();
  await ensureCategories(professionSlug, categories);

  const existing = await request("GET", "/admin/questions");
  const takenSlugs = new Set(existing.map((item) => item.slug));
  const slugByTitle = new Map(
    existing.map((item) => [item.title.trim().toLowerCase(), item.slug])
  );

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const failures = [];

  for (const question of selected.values()) {
    const knownSlug = slugByTitle.get(question.t.trim().toLowerCase());
    if (knownSlug && !options.update) {
      skipped += 1;
      continue;
    }
    const slug = knownSlug ?? uniqueSlug(question.t, takenSlugs);
    const payload = buildPayload(question, professionSlug, slug, options.published);
    try {
      if (knownSlug) {
        await request("PUT", `/admin/questions/${encodeURIComponent(slug)}`, payload);
        updated += 1;
      } else {
        await request("POST", "/admin/questions", payload);
        slugByTitle.set(question.t.trim().toLowerCase(), slug);
        created += 1;
      }
    } catch (error) {
      failures.push(`${question.t}: ${error.message}`);
    }
  }

  console.log(`Создано: ${created}, обновлено: ${updated}, пропущено: ${skipped}`);
  if (failures.length > 0) {
    console.log(`Ошибок: ${failures.length}`);
    for (const failure of failures.slice(0, 15)) console.log(`  ! ${failure}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
