/**
 * Серверный слой доступа к API — для серверных компонентов и sitemap.
 *
 * От lib/api.ts отличается принципиально: там браузерный клиент с cookie и CSRF,
 * здесь чтение публичных GET-эндпоинтов из процесса Node, поэтому нужен
 * абсолютный адрес (относительный "/api" в серверном fetch невалиден).
 *
 * В Docker web ходит к api напрямую, минуя nginx: API_INTERNAL_BASE_URL.
 */

import { cache } from "react";

/**
 * Контент меняется редко, поэтому серверные запросы кэшируются (ISR).
 * Раньше запросы шли без кеша, и каждый хит краулера доходил до Postgres.
 * После правки в админке вызывайте revalidateTag("content"),
 * чтобы изменения появились сразу, не дожидаясь истечения окна.
 */
export const CONTENT_CACHE_TAG = "content";

const CONTENT_REVALIDATE_SECONDS = Number(
  process.env.CONTENT_REVALIDATE_SECONDS ?? 300
);

const INTERNAL_BASE =
  process.env.API_INTERNAL_BASE_URL ?? "http://localhost:8080/api";

export class ServerApiError extends Error {
  readonly status: number;

  constructor(status: number, path: string) {
    super(`API ${status} на ${path}`);
    this.name = "ServerApiError";
    this.status = status;
  }
}

/**
 * Публичный контент кешируется на CONTENT_REVALIDATE_SECONDS и помечается
 * тегом CONTENT_CACHE_TAG: после правки в админке достаточно вызвать
 * revalidateTag(CONTENT_CACHE_TAG), чтобы изменение стало видно сразу.
 *
 * `cache()` дедуплицирует одинаковые пути внутри одного рендера — layout и
 * страница часто просят один и тот же список, но запрос уходит один.
 */
export const serverFetch = cache(async <T>(path: string): Promise<T> => {
  const response = await fetch(`${INTERNAL_BASE}${path}`, {
    next: { revalidate: CONTENT_REVALIDATE_SECONDS, tags: [CONTENT_CACHE_TAG] },
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new ServerApiError(response.status, path);
  }
  return (await response.json()) as T;
});

/** Возвращает null на 404 — для страниц, которые сами вызывают notFound(). */
export async function serverFetchOptional<T>(path: string): Promise<T | null> {
  try {
    return await serverFetch<T>(path);
  } catch (error) {
    if (error instanceof ServerApiError && error.status === 404) return null;
    throw error;
  }
}

export function encodeSlug(slug: string): string {
  return encodeURIComponent(slug);
}
