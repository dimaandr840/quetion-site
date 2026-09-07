import type { SearchFacets } from "./content-api";
import type { Level, SortOption } from "./types";
import { serverFetch } from "./server-api";

export interface SearchResult extends SearchFacets {
  unfilteredTotal: number;
  popularCount: number;
}

/** UI uses one-based pages; API uses zero-based pages. */
export function fetchSearchPage(query: string, options: {
  levels: Level[]; professions: string[]; onlyPopular: boolean; sort: SortOption; page: number;
}): Promise<SearchResult> {
  const params = new URLSearchParams({ q: query, page: String(options.page - 1), sort: options.sort });
  for (const level of options.levels) params.append("level", level);
  for (const profession of options.professions) params.append("profession", profession);
  if (options.onlyPopular) params.set("only", "popular");
  return serverFetch<SearchResult>(`/search?${params}`);
}
