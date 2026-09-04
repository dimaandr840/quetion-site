/**
 * Загрузка контента из API для серверных компонентов.
 *
 * Единственный источник истины для публичных страниц — база бэкенда: то, что
 * создаёт админка, обязано появляться на сайте. Массивы в lib/content.ts
 * остались только сидом (scripts/export-seed.mjs) и статическими текстами.
 */

import { serverFetch, serverFetchOptional, encodeSlug } from "./server-api";
import type {
  Category,
  Industry,
  Level,
  Profession,
  Question,
  QuestionSummary,
  Specialization,
} from "./types";

export interface IndustryGroup {
  industry: Industry;
  professions: Profession[];
}

export interface SpecializationTreeGroup {
  specialization: Specialization;
  topics: Category[];
}

/**
 * Режим, в котором бэкенд обслужил запрос:
 *  - `index`     — полноценный поиск через Meilisearch;
 *  - `database`  — индекс выключен конфигом, штатный ILIKE по Postgres;
 *  - `fallback`  — индекс должен был работать, но недоступен — это деградация;
 *  - `deep-page` — запрос глубже лимита Meilisearch, обслужен базой.
 */
export type SearchMode = "index" | "database" | "fallback" | "deep-page";

export interface SearchFacets {
  query: string;
  total: number;
  page: number;
  size: number;
  items: QuestionSummary[];
  levelCounts: Record<Level, number>;
  professionCounts: Array<{
    slug: string;
    title: string;
    emoji: string;
    count: number;
  }>;
  fromIndex: boolean;
  searchMode: SearchMode;
  /**
   * true только при вынужденной деградации. Не используйте вместо него `!fromIndex`:
   * при выключенном конфигом индексе поиск по базе — штатный режим,
   * и предупреждать пользователя не о чем.
   */
  degraded: boolean;
}

export interface SearchFilters {
  levels?: Level[];
  professions?: string[];
  page?: number;
  size?: number;
}

/* ---- Вопросы ---- */

export function fetchQuestions(): Promise<QuestionSummary[]> {
  return serverFetch<QuestionSummary[]>("/questions");
}

export function fetchQuestion(slug: string): Promise<Question | null> {
  return serverFetchOptional<Question>(`/questions/${encodeSlug(slug)}`);
}

export function fetchPopularQuestions(limit = 5): Promise<QuestionSummary[]> {
  return serverFetch<QuestionSummary[]>(`/questions/popular?limit=${limit}`);
}

export function fetchCategoryQuestions(
  professionSlug: string,
  categorySlug: string
): Promise<QuestionSummary[]> {
  return serverFetch<QuestionSummary[]>(
    `/professions/${encodeSlug(professionSlug)}/categories/${encodeSlug(categorySlug)}/questions`
  );
}

/* ---- Каталог ---- */

export function fetchIndustries(): Promise<Industry[]> {
  return serverFetch<Industry[]>("/industries");
}

export function fetchIndustryGroups(): Promise<IndustryGroup[]> {
  return serverFetch<IndustryGroup[]>("/industry-groups");
}

export function fetchProfessions(): Promise<Profession[]> {
  return serverFetch<Profession[]>("/professions");
}

export function fetchFeaturedProfessions(limit = 8): Promise<Profession[]> {
  return serverFetch<Profession[]>(`/professions?featured=true&limit=${limit}`);
}

export function fetchProfession(slug: string): Promise<Profession | null> {
  return serverFetchOptional<Profession>(`/professions/${encodeSlug(slug)}`);
}

export function fetchSpecializations(
  professionSlug?: string
): Promise<Specialization[]> {
  return serverFetch<Specialization[]>(
    professionSlug
      ? `/professions/${encodeSlug(professionSlug)}/specializations`
      : "/specializations"
  );
}

export function fetchSpecializationTree(
  professionSlug: string
): Promise<SpecializationTreeGroup[]> {
  return serverFetch<SpecializationTreeGroup[]>(
    `/professions/${encodeSlug(professionSlug)}/specialization-tree`
  );
}

export function fetchCategories(professionSlug?: string): Promise<Category[]> {
  return serverFetch<Category[]>(
    professionSlug
      ? `/categories?profession=${encodeSlug(professionSlug)}`
      : "/categories"
  );
}

export function fetchCategory(
  professionSlug: string,
  categorySlug: string
): Promise<Category | null> {
  return serverFetchOptional<Category>(
    `/professions/${encodeSlug(professionSlug)}/categories/${encodeSlug(categorySlug)}`
  );
}

/* ---- Поиск ---- */

export function buildSearchQuery(query: string, filters: SearchFilters = {}): string {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  for (const level of filters.levels ?? []) params.append("level", level);
  for (const slug of filters.professions ?? []) params.append("profession", slug);
  // page/size передаём только явно заданными: иначе бэкенд не сможет
  // применить свой размер страницы из конфига.
  if (typeof filters.page === "number" && filters.page > 0) {
    params.set("page", String(filters.page));
  }
  if (typeof filters.size === "number" && filters.size > 0) {
    params.set("size", String(filters.size));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function fetchSearch(
  query: string,
  filters: SearchFilters = {}
): Promise<SearchFacets> {
  return serverFetch<SearchFacets>(`/search${buildSearchQuery(query, filters)}`);
}
