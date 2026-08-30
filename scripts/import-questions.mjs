/**
 * Пакетный импорт вопросов в базу знаний через админский API.
 *
 * Данные лежат в scripts/data/<профессия>.mjs в компактной схеме (см. README ниже):
 * скрипт сам собирает slug, snippet, tldr и создаёт отсутствующие темы.
 *
 * Запуск: node scripts/import-questions.mjs data/java.mjs [--dry]
 *
 * Схема одного вопроса:
 *   { t: заголовок, l: "Junior|Middle|Senior", c: slug темы, g: [теги],
 *     d: TL;DR, s: [ { h: заголовок секции, p: [абзацы], b: [пункты],
 *                      code: { lang, title, lines: [строки] } } ] }
 *
 * Инлайн-разметка в абзацах и пунктах: <strong>, <em>, <code>, <mark>, <u>, <s>, <a href>.
 */

import { pathToFileURL } from "node:url";
import path from "node:path";

const BASE = process.env.DEVPREP_API ?? "http://localhost/api";

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

async function primeCsrf() {
  const response = await fetch(`${BASE}/auth/csrf`, { headers: { Accept: "application/json" } });
  mergeCookies(response);
}

async function request(method, path, body) {
  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (cookieJar) headers.Cookie = cookieJar;
  if (csrfToken && method !== "GET") headers["X-XSRF-TOKEN"] = csrfToken;

  const response = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  mergeCookies(response);

  if (!response.ok) {
    let detail = "";
    try {
      const problem = await response.json();
      detail = problem.detail ?? problem.title ?? "";
    } catch {
      detail = await response.text().catch(() => "");
    }
    throw new Error(`${method} ${path} → ${response.status} ${detail}`);
  }
  if (response.status === 204) return undefined;
  const type = response.headers.get("Content-Type") ?? "";
  return type.includes("json") ? response.json() : undefined;
}

function buildPayload(question, professionSlug, existingSlugs) {
  const sections = question.s.map((section, index) => {
    const built = {
      id: `section-${index + 1}`,
      heading: section.h ?? "Ответ",
    };
    if (section.p?.length) built.paragraphs = section.p;
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
      .flatMap((section) => [...(section.paragraphs ?? []), ...(section.bullets ?? [])])
      .join(" ")
  );

  // Одинаковые заголовки в разных темах дают одинаковый slug — добавляем суффикс.
  let slug = slugify(question.t);
  if (existingSlugs.has(slug)) {
    let counter = 2;
    while (existingSlugs.has(`${slug}-${counter}`)) counter += 1;
    slug = `${slug}-${counter}`;
  }
  existingSlugs.add(slug);

  return {
    slug,
    title: question.t,
    level: question.l,
    professionSlug,
    categorySlug: question.c,
    tags: question.g ?? [],
    snippet: (question.d ?? flat).slice(0, 1024),
    tldr: (question.d ?? flat).slice(0, 512),
    popular: Boolean(question.pop),
    published: true,
    sections,
  };
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

async function main() {
  const [relativePath, ...flags] = process.argv.slice(2);
  if (!relativePath) {
    console.error("Использование: node scripts/import-questions.mjs data/java.mjs [--dry]");
    process.exit(1);
  }
  const dryRun = flags.includes("--dry");

  const fileUrl = pathToFileURL(path.resolve(process.cwd(), "scripts", relativePath));
  const module = await import(fileUrl.href);
  const { professionSlug, categories = [], questions } = module.default;

  console.log(`Направление: ${professionSlug}, вопросов в файле: ${questions.length}`);

  const bySlug = new Map();
  for (const question of questions) {
    const key = `${question.c}::${question.t}`;
    if (bySlug.has(key)) {
      console.warn(`  ! дубликат в файле: ${question.t}`);
      continue;
    }
    bySlug.set(key, question);
  }

  if (dryRun) {
    const levels = questions.reduce((acc, item) => {
      acc[item.l] = (acc[item.l] ?? 0) + 1;
      return acc;
    }, {});
    const byCategory = questions.reduce((acc, item) => {
      acc[item.c] = (acc[item.c] ?? 0) + 1;
      return acc;
    }, {});
    console.log("Уровни:", levels);
    console.log("Темы:", byCategory);
    console.log(`Уникальных: ${bySlug.size}`);
    return;
  }

  await primeCsrf();
  await ensureCategories(professionSlug, categories);

  const existingQuestions = await request("GET", "/admin/questions");
  const existingSlugs = new Set(existingQuestions.map((item) => item.slug));
  const existingTitles = new Set(existingQuestions.map((item) => item.title.trim().toLowerCase()));

  let created = 0;
  let skipped = 0;
  const failures = [];

  for (const question of bySlug.values()) {
    if (existingTitles.has(question.t.trim().toLowerCase())) {
      skipped += 1;
      continue;
    }
    const payload = buildPayload(question, professionSlug, existingSlugs);
    try {
      await request("POST", "/admin/questions", payload);
      created += 1;
    } catch (error) {
      failures.push(`${question.t}: ${error.message}`);
    }
  }

  console.log(`Создано: ${created}, пропущено как дубликаты: ${skipped}`);
  if (failures.length > 0) {
    console.log(`Ошибок: ${failures.length}`);
    for (const failure of failures.slice(0, 15)) console.log(`  ! ${failure}`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
