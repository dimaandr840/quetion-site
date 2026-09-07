import { cache } from "react";
export const CONTENT_CACHE_TAG = "content";
const configuredRevalidate = Number(process.env.CONTENT_REVALIDATE_SECONDS ?? 300);
const revalidate = Number.isFinite(configuredRevalidate) && configuredRevalidate >= 0 ? configuredRevalidate : 300;
const INTERNAL_BASE = process.env.API_INTERNAL_BASE_URL ?? "http://localhost:8080/api";
export class ServerApiError extends Error {
  readonly status: number;
  constructor(status: number, path: string) {
    super(`API ${status} на ${path}`); this.name = "ServerApiError"; this.status = status;
  }
}
/** Bounded upstream waits. Search results must not retain unpublished snippets in the fetch cache. */
export const serverFetch = cache(async <T>(path: string): Promise<T> => {
  const response = await fetch(`${INTERNAL_BASE}${path}`, {
    ...(path.startsWith("/search") ? { cache: "no-store" as const }
      : { next: { revalidate, tags: [CONTENT_CACHE_TAG] } }),
    signal: AbortSignal.timeout(10_000),
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new ServerApiError(response.status, path);
  return await response.json() as T;
});
export async function serverFetchOptional<T>(path: string): Promise<T | null> {
  try { return await serverFetch<T>(path); }
  catch (error) {
    if (error instanceof ServerApiError && error.status === 404) return null;
    throw error;
  }
}
export function encodeSlug(slug: string): string { return encodeURIComponent(slug); }
