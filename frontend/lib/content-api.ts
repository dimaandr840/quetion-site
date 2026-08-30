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

export interface SearchFacets {
  query: string;
  total: number;
  items: QuestionSummary[];
  levelCounts: Record<Level, number>;
  professionCounts: Array<{
    slug: string;
    title: string;
    emoji: string;
    count: number;
  }>;
  fromIndex: boolean;
}

export interface SearchFilters {
  levels?: Level[];
  professions?: string[];
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
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function fetchSearch(
  query: string,
  filters: SearchFilters = {}
): Promise<SearchFacets> {
  return serverFetch<SearchFacets>(`/search${buildSearchQuery(query, filters)}`);
}
