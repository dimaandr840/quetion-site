/**
 * Каталог для админки: направления и темы.
 *
 * Чтение идёт через публичные эндпоинты — они отдают то же самое, что увидит
 * посетитель, включая счётчики вопросов. Запись — через /api/admin/**.
 */

import { apiFetch } from "./api";
import type { Category, Industry, Profession } from "./types";

export interface ProfessionPayload {
  slug: string;
  title: string;
  emoji?: string;
  pageTitle?: string;
  description?: string;
  cardDescription?: string;
  industrySlug: string;
  featured?: boolean;
}

export interface CategoryPayload {
  slug: string;
  title: string;
  emoji?: string;
  description?: string;
  professionSlug: string;
  specializationSlug?: string;
}

/**
 * Транслитерация названия в slug. Тот же алгоритм, что для вопросов:
 * адрес страницы — строчная латиница, цифры и дефис.
 *
 * Теперь тот же алгоритм есть и на бэкенде (Slugs.java), так что здесь он нужен
 * только для предпросмотра адреса в форме.
 */
const CYRILLIC_MAP: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh",
  з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o",
  п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c",
  ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu",
  я: "ya",
};

export function slugifyTitle(title: string): string {
  const base = title
    .toLocaleLowerCase("ru")
    .split("")
    .map((char) => CYRILLIC_MAP[char] ?? char)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  // Обрезка по длине могла оставить дефис в конце — такой адрес некрасиво
  // выглядит в URL и раньше отклонялся валидацией.
  return base.slice(0, 64).replace(/-+$/g, "");
}

/**
 * Адрес для отправки на сервер: ручной ввод, иначе название, иначе запасной
 * вариант с меткой времени. Раньше форма просто отказывалась сохранять, если из
 * названия не собирался адрес (например, название из одних эмодзи).
 */
export function normalizeSlug(
  rawSlug: string,
  title: string,
  fallbackPrefix: string
): string {
  return (
    slugifyTitle(rawSlug) ||
    slugifyTitle(title) ||
    `${fallbackPrefix}-${Date.now().toString(36)}`
  );
}

/* ---- Чтение ---- */

export function getIndustries() {
  return apiFetch<Industry[]>("/industries");
}

export function getProfessions() {
  return apiFetch<Profession[]>("/professions");
}

export function getCategories(professionSlug?: string) {
  return apiFetch<Category[]>(
    professionSlug
      ? `/categories?profession=${encodeURIComponent(professionSlug)}`
      : "/categories"
  );
}

/* ---- Направления ---- */

export function createProfession(payload: ProfessionPayload) {
  return apiFetch<Profession>("/admin/professions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateProfession(slug: string, payload: ProfessionPayload) {
  return apiFetch<Profession>(`/admin/professions/${encodeURIComponent(slug)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteProfession(slug: string) {
  return apiFetch<void>(`/admin/professions/${encodeURIComponent(slug)}`, {
    method: "DELETE",
  });
}

/* ---- Темы ---- */

export function createCategory(payload: CategoryPayload) {
  return apiFetch<Category>("/admin/categories", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateCategory(
  professionSlug: string,
  slug: string,
  payload: CategoryPayload
) {
  return apiFetch<Category>(
    `/admin/professions/${encodeURIComponent(professionSlug)}/categories/${encodeURIComponent(slug)}`,
    { method: "PUT", body: JSON.stringify(payload) }
  );
}

export function deleteCategory(professionSlug: string, slug: string) {
  return apiFetch<void>(
    `/admin/professions/${encodeURIComponent(professionSlug)}/categories/${encodeURIComponent(slug)}`,
    { method: "DELETE" }
  );
}
