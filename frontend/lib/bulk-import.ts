/**
 * Массовый импорт вопросов из файла вида `scripts/data/*.mjs`.
 *
 * Правила проверки повторяют CLI-импортёр (`scripts/import-questions.mjs`):
 * уровень только Junior/Middle/Senior, обязательны заголовок, тема и хотя бы
 * одна непустая секция, дубликаты внутри файла отбрасываются. Логика вынесена
 * в отдельный модуль, чтобы экран админки и скрипт не разъезжались в трактовке
 * одного и того же файла.
 *
 * Модуль ничего не пишет в API: он только превращает данные файла в готовые
 * payload'ы и список ошибок. Запись выполняет экран импорта, чтобы отчёт можно
 * было показать до первого запроса на сервер.
 */

import { slugify } from "./admin-api";
import type { AnswerSectionPayload, QuestionUpsertPayload } from "./admin-api";
import { stripInlineHtml } from "./inline-html";
import type { Level } from "./types";

export const LEVELS: Level[] = ["Junior", "Middle", "Senior"];

const LEVEL_BY_LOWER = new Map<string, Level>(
  LEVELS.map((level) => [level.toLowerCase(), level])
);

/* ---- Форма исходного файла ---- */

export interface RawCode {
  lang?: unknown;
  title?: unknown;
  lines?: unknown;
}

export interface RawSection {
  h?: unknown;
  p?: unknown;
  b?: unknown;
  code?: RawCode;
}

export interface RawQuestion {
  t?: unknown;
  l?: unknown;
  c?: unknown;
  g?: unknown;
  d?: unknown;
  pop?: unknown;
  s?: unknown;
}

export interface RawCategory {
  slug?: unknown;
  title?: unknown;
  emoji?: unknown;
  description?: unknown;
}

export interface RawImportFile {
  professionSlug?: unknown;
  categories?: unknown;
  questions?: unknown;
}

/* ---- Результат разбора ---- */

export interface PlannedCategory {
  slug: string;
  title: string;
  emoji?: string;
  description?: string;
}

export interface ReportItem {
  /** Номер вопроса в файле, 1-based: по нему админ найдёт строку в .mjs. */
  index: number;
  title: string;
  level?: Level;
  categoryTitle: string;
  categorySlug: string;
  slug: string;
  errors: string[];
  /** Есть только у корректного вопроса. */
  payload?: QuestionUpsertPayload;
}

export interface ImportPlan {
  professionSlug: string;
  /** Ошибки самого файла: не тот формат, нет вопросов, нет professionSlug. */
  fileErrors: string[];
  /** Темы, объявленные в файле: нужны, чтобы создать отсутствующие. */
  categories: PlannedCategory[];
  items: ReportItem[];
}

export interface PlanOptions {
  /** false — загрузить всё черновиками. */
  published: boolean;
  /** Импортировать только одну тему (по названию или slug). */
  onlyCategory?: string;
  /** Ограничение на количество вопросов: для пробного прогона. */
  limit?: number;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item : ""))
    .map((item) => item.replace(/\s+$/g, ""))
    .filter((item) => item.trim().length > 0);
}

function buildSections(rawSections: RawSection[], errors: string[]): AnswerSectionPayload[] {
  const sections: AnswerSectionPayload[] = [];

  rawSections.forEach((section, position) => {
    const heading = asString(section.h) || "Ответ";
    const paragraphs = asStringArray(section.p);
    const bullets = asStringArray(section.b);
    const codeLines = asStringArray(section.code?.lines);

    // Пустая секция — не повод молча её выкинуть: чаще это опечатка в ключе
    // (`pp` вместо `p`), и вопрос уехал бы в базу с потерянным текстом.
    if (paragraphs.length === 0 && bullets.length === 0 && codeLines.length === 0) {
      errors.push(`секция «${heading}» не содержит ни абзацев, ни списка, ни кода`);
      return;
    }

    sections.push({
      id: `section-${position + 1}`,
      heading,
      blocks: paragraphs.length
        ? paragraphs.map((text) => ({ kind: "PARAGRAPH" as const, align: "LEFT" as const, text }))
        : undefined,
      bullets: bullets.length ? bullets : undefined,
      code: codeLines.length
        ? {
            language: asString(section.code?.lang) || "text",
            title: asString(section.code?.title) || "Пример",
            lines: codeLines,
          }
        : undefined,
    });
  });

  return sections;
}

/** Плоский текст ответа: из него собираются snippet и запасной TL;DR. */
function plainText(sections: AnswerSectionPayload[]): string {
  return sections
    .flatMap((section) => [
      section.heading ?? "",
      ...(section.blocks ?? []).map((block) => block.text ?? ""),
      ...(section.bullets ?? []),
    ])
    .filter(Boolean)
    .map(stripInlineHtml)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Превращает разобранный файл в план импорта.
 *
 * Возвращает и корректные, и битые вопросы: экран показывает отчёт целиком,
 * а грузит только корректные. Так админ видит, что именно не поехало, вместо
 * «импортировано 97 из 103».
 */
export function buildImportPlan(raw: RawImportFile, options: PlanOptions): ImportPlan {
  const fileErrors: string[] = [];

  const professionSlug = asString(raw.professionSlug);
  if (!professionSlug) {
    fileErrors.push("в файле не указан professionSlug");
  }

  const rawCategories = Array.isArray(raw.categories) ? (raw.categories as RawCategory[]) : [];
  const categories: PlannedCategory[] = rawCategories
    .map((category) => {
      const title = asString(category.title);
      const slug = asString(category.slug) || slugify(title);
      return {
        slug,
        title: title || slug,
        emoji: asString(category.emoji) || undefined,
        description: asString(category.description) || undefined,
      };
    })
    .filter((category) => Boolean(category.slug));

  const rawQuestions = Array.isArray(raw.questions) ? (raw.questions as RawQuestion[]) : [];
  if (rawQuestions.length === 0) {
    fileErrors.push("в файле нет массива questions");
  }

  const categorySlugByTitle = new Map<string, string>();
  for (const category of categories) {
    categorySlugByTitle.set(category.title.toLowerCase(), category.slug);
  }

  const items: ReportItem[] = [];
  const seenKeys = new Set<string>();
  const usedSlugs = new Set<string>();
  const filter = asString(options.onlyCategory).toLowerCase();

  rawQuestions.forEach((question, position) => {
    const index = position + 1;
    const errors: string[] = [];

    const title = asString(question.t);
    const categoryTitle = asString(question.c);
    const categorySlug = categoryTitle
      ? categorySlugByTitle.get(categoryTitle.toLowerCase()) ?? slugify(categoryTitle)
      : "";

    if (filter && ![categoryTitle.toLowerCase(), categorySlug].includes(filter)) {
      return;
    }

    if (!title) errors.push("нет заголовка (поле t)");
    if (!categoryTitle) errors.push("не указана тема (поле c)");

    const levelRaw = asString(question.l);
    const level = LEVEL_BY_LOWER.get(levelRaw.toLowerCase());
    if (!level) {
      errors.push(
        levelRaw
          ? `неизвестный уровень «${levelRaw}», допустимы ${LEVELS.join(" / ")}`
          : "не указан уровень (поле l)"
      );
    }

    const rawSections = Array.isArray(question.s) ? (question.s as RawSection[]) : [];
    if (rawSections.length === 0) errors.push("нет секций ответа (поле s)");
    const sections = buildSections(rawSections, errors);
    if (rawSections.length > 0 && sections.length === 0) {
      errors.push("все секции ответа пустые");
    }

    // Дубликат внутри файла: тот же вопрос в той же теме. Второй экземпляр
    // перезаписал бы первый по slug, и разница осталась бы незамеченной.
    const key = `${categorySlug}|${title.toLowerCase()}`;
    if (title && seenKeys.has(key)) {
      errors.push("дубликат: такой же вопрос уже есть выше в файле");
    } else if (title) {
      seenKeys.add(key);
    }

    let slug = title ? slugify(title) : "";
    if (slug) {
      // Разные заголовки могут дать один slug (например, различаются только
      // пунктуацией). Разводим суффиксом, как это делает CLI-импортёр.
      let candidate = slug;
      let suffix = 2;
      while (usedSlugs.has(candidate)) {
        candidate = `${slug.slice(0, 106)}-${suffix}`;
        suffix += 1;
      }
      slug = candidate;
      usedSlugs.add(slug);
    }

    const item: ReportItem = {
      index,
      title: title || "— без заголовка —",
      level,
      categoryTitle,
      categorySlug,
      slug,
      errors,
    };

    if (errors.length === 0 && level) {
      const flat = plainText(sections);
      const tldr = asString(question.d) || flat.slice(0, 512) || title;

      item.payload = {
        slug,
        title,
        level,
        professionSlug,
        categorySlug,
        tags: asStringArray(question.g),
        snippet: flat.slice(0, 1024) || title,
        tldr,
        popular: question.pop === true,
        published: options.published,
        sections,
      };
    }

    items.push(item);
  });

  const limited =
    options.limit && options.limit > 0 ? items.slice(0, options.limit) : items;

  return { professionSlug, fileErrors, categories, items: limited };
}

export interface PlanSummary {
  total: number;
  valid: number;
  invalid: number;
  byLevel: Record<Level, number>;
  categories: string[];
}

export function summarizePlan(plan: ImportPlan): PlanSummary {
  const byLevel: Record<Level, number> = { Junior: 0, Middle: 0, Senior: 0 };
  const categories = new Set<string>();

  for (const item of plan.items) {
    if (item.level) byLevel[item.level] += 1;
    if (item.categorySlug) categories.add(item.categorySlug);
  }

  const valid = plan.items.filter((item) => item.payload).length;

  return {
    total: plan.items.length,
    valid,
    invalid: plan.items.length - valid,
    byLevel,
    categories: [...categories],
  };
}
