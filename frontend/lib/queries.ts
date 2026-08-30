import type {
  Category,
  Level,
  Profession,
  QuestionSummary,
  SortOption,
} from "./types";

export const LEVELS: Level[] = ["Junior", "Middle", "Senior"];

/**
 * `label` — полное описание (title, aria, native select),
 * `short` — подпись для сегментного контрола: в тулбаре нет места на
 * «Сначала популярные», а урезанный текст в кнопке читается лучше подписи,
 * не влезающей в строку.
 */
export const SORT_OPTIONS: Array<{
  value: SortOption;
  label: string;
  short: string;
}> = [
  { value: "popular", label: "Сначала популярные", short: "Популярные" },
  { value: "level", label: "По сложности", short: "Сложность" },
  { value: "alpha", label: "По алфавиту", short: "А–Я" },
];

/* ---- Счётчики по уже загруженной выборке ---- */

export function countByLevel(items: QuestionSummary[]): Record<Level, number> {
  return LEVELS.reduce(
    (acc, level) => {
      acc[level] = items.filter((q) => q.level === level).length;
      return acc;
    },
    { Junior: 0, Middle: 0, Senior: 0 } as Record<Level, number>
  );
}

/** Профессии, у которых в выборке есть хотя бы один вопрос — для фильтра. */
export function professionsWithQuestions(
  items: QuestionSummary[],
  professions: Profession[]
): Profession[] {
  const present = new Set(items.map((question) => question.professionSlug));
  return professions.filter((profession) => present.has(profession.slug));
}

/**
 * Путь вопроса для отображения: Профессия > Специализация > Тема.
 * Бэкенд отдаёт его готовым в `path`; локальная сборка — фолбэк.
 */
export function questionPath(
  question: QuestionSummary,
  professions: Profession[] = [],
  categories: Category[] = [],
  specializations: Array<{ slug: string; professionSlug: string; title: string }> = []
): string {
  if (question.path) return question.path;

  const profession = professions.find((p) => p.slug === question.professionSlug);
  const category = categories.find(
    (c) => c.professionSlug === question.professionSlug && c.slug === question.categorySlug
  );
  const specialization = category
    ? specializations.find(
        (s) =>
          s.professionSlug === question.professionSlug &&
          s.slug === category.specializationSlug
      )
    : undefined;

  return [profession?.title, specialization?.title, category?.title]
    .filter(Boolean)
    .join(" > ");
}

/** Теги выборки, отсортированные по частоте. */
export function popularTags(items: QuestionSummary[], limit = 5): string[] {
  const frequency = new Map<string, number>();
  for (const question of items) {
    for (const tag of question.tags) {
      frequency.set(tag, (frequency.get(tag) ?? 0) + 1);
    }
  }

  return [...frequency.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ru"))
    .slice(0, limit)
    .map(([tag]) => tag);
}

/** Темы с материалами: ссылки и честные счётчики из API. */
export function topicPills(
  categories: Category[]
): Array<{ title: string; href: string; count: number }> {
  return categories
    .filter((category) => (category.questionCount ?? 0) > 0)
    .map((category) => ({
      title: category.title,
      href: `/professions/${category.professionSlug}/${category.slug}`,
      count: category.questionCount ?? 0,
    }))
    .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title, "ru"));
}

/* ---- Сортировка ---- */

export function sortQuestions(
  items: QuestionSummary[],
  sort: SortOption
): QuestionSummary[] {
  const sorted = [...items];

  if (sort === "alpha") {
    return sorted.sort((a, b) => a.title.localeCompare(b.title, "ru"));
  }

  if (sort === "level") {
    return sorted.sort(
      (a, b) =>
        LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level) ||
        a.title.localeCompare(b.title, "ru")
    );
  }

  return sorted.sort(
    (a, b) =>
      Number(Boolean(b.popular)) - Number(Boolean(a.popular)) ||
      a.title.localeCompare(b.title, "ru")
  );
}

/* ---- Разбор фильтров из URL ---- */

export function parseSortOption(value: string | undefined): SortOption {
  return value === "level" || value === "alpha" ? value : "popular";
}

/** ?only=popular — «только частые на собеседованиях». */
export function parseOnlyPopular(value: string | undefined): boolean {
  return value === "popular";
}

function normalize(value: string | string[] | undefined): string[] {
  const raw = Array.isArray(value) ? value : value ? value.split(",") : [];
  return raw.map((item) => item.trim().toLowerCase());
}

/** Принимает значение query-параметра вида "junior,senior" или массив. */
export function parseLevels(value: string | string[] | undefined): Level[] {
  const requested = normalize(value);
  return LEVELS.filter((level) => requested.includes(level.toLowerCase()));
}

/** Неизвестные slug-и отбрасываем: фильтр не должен зависеть от произвольного ввода. */
export function parseSlugs(
  value: string | string[] | undefined,
  allowed: Array<{ slug: string }>
): string[] {
  const requested = normalize(value);
  return allowed.map((item) => item.slug).filter((slug) => requested.includes(slug));
}
